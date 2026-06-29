# AID-015 — Selectores dependientes de ubicación + checklist de necesidades

**Fecha:** 2026-06-29
**Estado:** Diseño aprobado, en implementación
**Requisito origen:** `requirements/aid-015_concurrent_fields_in_admin_view.md`

## Objetivo

Reemplazar en el editor admin los inputs de **texto libre** de país/estado/ciudad
por **selectores dependientes con búsqueda** (combobox), y el textarea de
**"Necesidades (una por línea)"** por una **checklist** de las necesidades más
comunes + opción de agregar nuevas. Meta: datos normalizados y consistentes,
combinaciones inválidas imposibles (p. ej. "Venezuela → Florida → Lima").

## Contexto: qué ya existe

`src/pages/admin-db-9760b48605/index.astro` (1185 líneas, ruta admin oculta,
`prerender = false`):
- Editor `<dialog id="editor">` / `<form id="form">`. País/Estado/Ciudad son
  `<input>` de texto libre (líneas 318–320, país por defecto "Venezuela").
  Necesidades es `<textarea name="needs">` (línea 330).
- Script `is:inline define:vars={{ ENTRIES: entries }}`. `openForm` rellena
  (needs con `join("\n")`, 507), `collect` arma el payload (needs con
  `split("\n")`, 539), `save` hace POST/PATCH a `/api/admin/points`.
- Sin handlers inline (`onclick=`), sin `window.`, un único `define:vars` →
  convertir el script a **módulo empaquetado** es seguro (igual que se hizo en
  `MapaTab.astro` para AID-014).
- No existe catálogo de ubicaciones; todo es texto libre. Datos actuales: 39
  entradas (30 Venezuela + diáspora: España, Estados Unidos, Chile, Panamá).
  Needs: 92 valores distintos con duplicados ("Agua potable"/"Agua"/"Agua
  embotellada").

## Alcance

### Incluido

1. **Selectores dependientes país → estado → ciudad** (combobox buscable):
   - Jerárquico: elegir país repuebla estados y limpia ciudad; elegir estado
     repuebla ciudades. Combos inválidos imposibles.
   - **Venezuela**: ciudad **restringida** a los municipios del estado.
   - **Otros países**: ciudad es **entrada libre** con autocompletado (no
     tenemos ciudades del mundo), porque el catálogo solo llega a nivel
     estado/provincia fuera de VE.
   - **Auto-selección** cuando un nivel tiene una sola opción.
   - Los tres campos requeridos. Accesible (teclado ↑↓ Enter Esc, roles ARIA).
2. **Checklist de necesidades**:
   - El frontmatter calcula la frecuencia de `needs` sobre `entries` y pasa las
     **top-15** como checkboxes.
   - Botón **"+ Agregar nueva necesidad"** → input que añade un checkbox activo
     al instante.
   - Al **editar**: se pre-marcan las del registro; las que no estén en el
     top-15 se añaden como checkbox custom ya marcado. `collect()` recoge los
     checks marcados (ya no parte un textarea).

### Fuera de alcance (YAGNI)

- ❌ Form público "Sugerir" (`Layout.astro`) y `ReportCenterForm.astro` — mismos
  campos, pero se difieren a un follow-up para mantener foco en el editor admin.
- ❌ Selector para "Especialidad" u otras jerarquías (el requisito lo menciona
  como "si hiciera falta"; no hay catálogo de especialidades).

## Arquitectura

### Catálogo estático: `src/data/geo-catalog.json` (vendorizado, ~74 KB)

Generado por `scripts/build-geo-catalog.mjs` (reproducible, fetch en build time;
NO se vendorizan los datasets crudos). Fuentes:
- **dr5hn/countries-states-cities-database**: países (nombres en español vía
  `translations.es`, para casar con la DB: "España", "Estados Unidos") y estados
  (primer nivel administrativo mundial).
- **zokeber/venezuela-json**: Venezuela autoritativo, 24 estados → 335
  municipios.

Estructura:
```json
{
  "countries": ["Venezuela", "Afganistán", "..."],
  "states": { "Venezuela": ["Amazonas", "..."], "España": ["Madrid", "..."] },
  "cities": { "Venezuela": { "Táchira": ["San Cristóbal", "..."] } }
}
```
Solo los países en `cities` tienen selector de ciudad restringido (hoy solo
Venezuela); el resto es entrada libre.

**Aumento con la DB (red de seguridad):** dr5hn tiene variantes de nombre
("Región Metropolitana de Santiago" vs "Región Metropolitana") y huecos (le
falta la provincia "Panamá"). Para que editar una entrada existente nunca
pierda/desajuste su ubicación, el frontmatter calcula los valores
país/estado/ciudad ya presentes en `entries` y los **fusiona** con el catálogo
en el cliente (la base sigue siendo estática; sin dependencia de red). Esto
también cumple el requisito literal de "derivar cadenas válidas de los registros
existentes".

### Helpers puros: `src/lib/geo.ts` + `src/lib/needs.ts` (con tests)

`geo.ts` (sobre la forma del catálogo, inyectable para tests):
- `listCountries(catalog)` → string[]
- `statesFor(catalog, country)` → string[]
- `citiesFor(catalog, country, state)` → string[]
- `isFreeCity(catalog, country)` → boolean (true si el país no tiene listas de
  ciudad)
- `mergeExtras(catalog, extras)` → catalog aumentado con valores de la DB.

`needs.ts`:
- `topNeeds(entries, n)` → las `n` necesidades más frecuentes (orden por
  frecuencia desc, desempate alfabético), normalizando espacios.

### Combobox accesible: `src/lib/combobox.ts`

Helper vanilla reutilizable: recibe un `<input>` + función proveedora de
opciones; renderiza un dropdown filtrado por lo tecleado; navegación con teclado;
modo `strict` (VE ciudad / estado / país: solo valores de la lista) vs `free`
(ciudad no-VE: permite texto libre). Emite un callback `onChange(value)` para
encadenar los niveles.

### Wiring en el admin

- El script pasa a **módulo empaquetado**: `import` de catálogo, `geo.ts`,
  `combobox.ts`; `ENTRIES` y `extras`/`topNeeds` se entregan por **data island**
  JSON (igual técnica que MapaTab).
- País/Estado/Ciudad: inputs envueltos por comboboxes encadenados. `openForm`
  setea los tres valores y dispara el repoblado dependiente; `collect()` los lee
  igual que antes (siguen siendo inputs `name=country/state/city`).
- Necesidades: el `<textarea>` se reemplaza por un contenedor de checkboxes
  renderizado server-side (top-15) + botón "agregar". `openForm` marca las del
  registro (añadiendo custom las que falten); `collect()` arma `needs` desde los
  checks marcados.

### Sin cambios de backend

No cambia el modelo Prisma ni los endpoints. `needs` sigue siendo `String[]` y
país/estado/ciudad siguen siendo strings en `Location`. El payload de
`/api/admin/points` es idéntico.

## Testing (TDD)

`node --test` (patrón de `auth.test.ts`):
- `src/lib/geo.test.ts`: `listCountries`, `statesFor`, `citiesFor`,
  `isFreeCity` (VE=false / otro=true), `mergeExtras` (agrega país/estado/ciudad
  nuevos sin duplicar, mantiene orden).
- `src/lib/needs.test.ts`: `topNeeds` (frecuencia, corte en n, desempate,
  normalización de espacios, lista vacía).

El combobox y el wiring del DOM (encadenado, checklist, agregar custom) se
verifican manualmente en el navegador (build + render).

## Criterios de aceptación

- En el editor admin, País/Estado/Ciudad son comboboxes buscables encadenados;
  no se puede teclear un país/estado fuera de lista; VE restringe ciudad a
  municipios; otros países permiten ciudad libre.
- Elegir país limpia/repuebla estado y ciudad coherentemente; auto-selección si
  hay una sola opción.
- Editar una entrada existente (incluida diáspora con nombres variantes) carga
  y conserva su país/estado/ciudad.
- Necesidades se muestran como checklist (top-15) con opción de agregar nuevas;
  al editar se pre-marcan las del registro; guardar produce el mismo `needs[]`.
- El payload a `/api/admin/points` no cambia de forma.
- `geo.test.ts` y `needs.test.ts` pasan; el build de producción compila.
