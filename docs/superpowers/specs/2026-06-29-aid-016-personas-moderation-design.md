# AID-016 — Moderación de personas importadas ("Personal") desde la API SOS

**Fecha:** 2026-06-29
**Estado:** Diseño aprobado, en implementación
**Requisito origen:** `requirements/aid-016_personas_moderation.md`
**Rama:** `aid-016` (apilada sobre `aid-015` porque ambas tocan el archivo admin)

## Objetivo

Permitir **ocultar/marcar** entradas de personas importadas de la API externa
(SOS Venezuela 2026) **en la capa de servicio**, sin borrar ni alterar nunca el
dato de origen. Entradas inapropiadas, duplicadas o irrelevantes se suprimen del
front público; los flags se ven solo en el admin.

## Contexto: qué ya existe

- **Proxy público** `src/pages/api/sos/persons.ts` → `GET
  https://sosvenezuela2026.com/api/persons/list` (q/status/limit/offset),
  cacheado, fail-soft a `{ items: [] }`. Devuelve los items **tal cual**.
- **Tab público** `src/components/PersonasTab.astro`: directorio de solo lectura,
  cards con `display_name`, `parroquia`, `municipio`, `photo_path`,
  `hospital_name`, `cedula_masked`, `source_date`, `status`.
- **Stats** `src/pages/api/sos/persons-stats.ts` (agregados del upstream).
- **Admin** `src/pages/admin-db-9760b48605/index.astro`: tabs Registros /
  Auditoría / Pendientes / Usuarios (`.tab[data-view]` → `#view-<name>`,
  lazy-load por vista). Script ya es **módulo empaquetado** (tras AID-015).
- **Identificador estable confirmado en la API**: cada persona trae un `id` UUID
  (p. ej. `33625a9b-bdeb-4a48-a790-7fd1173c53b5`) → ese es el `externalId`.
- Auth: `requireAdmin(request)` en `src/lib/accounts.ts`; endpoints admin
  guardan con `if (!(await requireAdmin(request))) return 401`.

## Alcance

### Incluido

1. **Tabla de moderación (Prisma)** — nunca borra datos de la API.
2. **Ocultar en runtime**: el proxy público filtra los `externalId` ocultos.
3. **Vista admin "Personas"**: lista TODAS las personas (incluidas las ocultas)
   con foto/nombre/ubicación, su estado (visible/oculto) y flag; filtros, búsqueda
   y paginación; acciones de moderación por entrada.
4. **Detección de duplicados (heurística simple)**: marca posibles duplicados y
   un filtro para triaje.

### Fuera de alcance (YAGNI)

- ❌ Hash de imagen para duplicados visuales (costoso en serverless).
- ❌ Ajustar los contadores de `persons-stats` por las ocultas (son pocas; los
  stats siguen reflejando el upstream — se documenta la pequeña inconsistencia).
- ❌ Historial de auditoría dedicado para moderación más allá de
  `moderatedBy`/`moderatedAt` en la tabla (se puede añadir como follow-up).

## Arquitectura

### Modelo Prisma (`prisma/schema.prisma`)

```prisma
enum PersonStatus { visible hidden }

/// AID-016: estado de publicación de una persona importada de la API SOS.
/// Append/upsert por externalId; nunca borra ni altera el dato de origen.
model PersonModeration {
  externalId  String       @id            // UUID de la API SOS
  status      PersonStatus @default(visible)
  flagReason  String?                      // "duplicated" | "unfair" | "unrespectful" | "irrelevant" | libre
  moderatedBy String?                      // nickname del admin
  moderatedAt DateTime     @updatedAt
}
```
Se aplica con `prisma db push` (sin historial de migraciones, como el resto).
**Es aditivo (tabla nueva) → seguro/reversible**, pero al ser la DB de prod se
confirma con el usuario antes de empujar.

### Helpers puros: `src/lib/moderation.ts` (con tests)

- `filterVisible(items, modMap)` → quita los `id` con `status === "hidden"`.
- `annotate(items, modMap)` → añade `_mod = { status, flagReason }` a cada item
  (para el admin).
- `groupDuplicates(items)` → asigna `_dupKey` y marca `_duplicate = true` a los
  que comparten clave con otro. Clave = `photo_path` si existe, si no
  `nombre|municipio|parroquia` normalizado (acentos/minúsculas/espacios). Evita
  falsos positivos por nombres genéricos sin foto.

I/O fina (no en los puros): `getModerationMap()` y
`setModeration(externalId, { status, flagReason, by })` sobre Prisma; con guarda
`dbAvailable()` (si no hay DB, no se filtra nada).

### Endpoints

- **Público** `api/sos/persons.ts` (modificado): tras traer del upstream, carga
  el mapa de moderación y aplica `filterVisible`. Si la DB no está disponible,
  devuelve todo (degradación).
- **Admin GET** `api/admin/persons.ts` (nuevo, `requireAdmin`): proxy del
  upstream (q/limit/offset) + `annotate` + `groupDuplicates`; devuelve **todas**
  las personas (incluidas ocultas) con su estado/flag/duplicado.
- **Admin POST** `api/admin/persons/[id]/moderate.ts` (nuevo, `requireAdmin`):
  body `{ status?, flagReason? }` (flagReason `null` = limpiar). `upsert` en
  `PersonModeration` con `moderatedBy` = nickname del usuario actual. Devuelve el
  registro actualizado.

### UI admin: tab "Personas"

- Nuevo `.tab[data-view="personas"]` + `<section id="view-personas">`, lazy-load
  (`loadPersonsMod()`), mismo patrón que Pendientes/Usuarios.
- Cabecera: buscador por nombre/ID + filtros (Todas / Visibles / Ocultas /
  Flagged / Duplicados) + paginación (offset/limit del upstream).
- Cards: foto (thumbnail), nombre, ubicación, fuente; chip de estado
  (visible/oculto) y de flag; marca "posible duplicado".
- Acciones por card: **Ocultar/Mostrar**, **Flag injusto**, **Flag duplicado**,
  **Limpiar flag** → POST al endpoint y refresco optimista de esa card.
- Nota: la detección de duplicados opera sobre el conjunto cargado (página
  actual); subir el límite amplía la cobertura.

### Sin cambios en el tab público salvo el filtrado

`PersonasTab.astro` no cambia: consume `/api/sos/persons`, que ahora ya viene
filtrado. Las ocultas simplemente no aparecen.

## Testing (TDD)

`node --test` sobre `src/lib/moderation.test.ts`:
- `filterVisible`: quita ocultas, conserva visibles/sin registro.
- `annotate`: adjunta status/flag correctos; sin registro → visible/sin flag.
- `groupDuplicates`: agrupa por foto compartida; por nombre+ubicación cuando no
  hay foto; no marca únicos; nombres genéricos sin foto no se agrupan entre sí.

Endpoints y UI admin se verifican manualmente (build + render; mutaciones contra
la DB de prueba/prod).

## Criterios de aceptación

- Existe `PersonModeration` en la DB; ninguna acción borra datos de la API.
- Ocultar una persona en el admin la suprime de `/api/sos/persons` y por tanto
  del tab público; mostrarla la reactiva.
- El admin lista todas las personas (incluidas ocultas) con su estado y flag,
  con búsqueda, filtros (incl. duplicados) y paginación.
- Flag injusto/duplicado y limpiar flag persisten con `moderatedBy`/`moderatedAt`.
- Los posibles duplicados se marcan visualmente y son filtrables.
- `moderation.test.ts` pasa; el build de producción compila.
