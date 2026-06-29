# AID-014 — Listado y filtrado de Sismos en el sidebar del Mapa

**Fecha:** 2026-06-29
**Estado:** Diseño aprobado, pendiente de implementación
**Requisito origen:** `requirements/aid-014_listing_earthquakes.md`

## Objetivo

En la vista `/mapa`, añadir un listado dedicado de **Sismos** en el sidebar (al
estilo de la lista de Lugares: Acopios/Personal), con eventos sísmicos recientes
en/cerca de Venezuela. El usuario puede ordenar/filtrar, resaltar eventos, y
hacer click para centrar el mapa en un evento.

## Contexto: qué ya existe

`src/components/MapaTab.astro` (archivo único: frontmatter + script inline +
estilos) **ya**:

- Consume el feed USGS GeoJSON `2.5_month.geojson` (`loadQuakes(force)`, ~líneas
  405–445), clipeado al bounding box de Venezuela (`BBOX`, ~línea 395).
- Pinta los sismos como marcadores en una capa Leaflet `layers.quake`,
  dimensionados por magnitud.
- Tiene contador `#quake-count` en la leyenda, botón "Actualizar sismos"
  (`#quake-refresh`), y manejo de error `#quake-error` para degradación.
- Dispara `loadQuakes` en `tabchange === "mapa"` o si Mapa es la pestaña activa.

Lo que **falta** y entrega este spec: el **listado en el sidebar** con detalle por
evento, filtros, multi-select y click-para-centrar.

## Alcance

### Incluido (MVP)

1. **Sub-pestañas en el list-pane**: switch `[ Lugares ] [ Sismos ]`.
   - "Lugares" = la vista actual (centros/profesionales agrupados por
     país/estado) intacta.
   - Activar "Sismos" auto-enciende la capa `quake` del mapa y muestra la lista
     de sismos con sus filtros.
2. **Tarjeta por evento** con: badge de magnitud coloreado por severidad, lugar
   (`feature.properties.place`), tiempo relativo ("Hoy 07:38" si es de hoy, o
   "2026-06-28 18:10 UTC"), profundidad en km, badge 🆕 si el evento tiene <1h.
3. **Acciones por tarjeta**:
   - `📍` (y click en la tarjeta): centra el mapa y hace zoom al marcador, abre
     su popup.
   - `⦿` checkbox multi-select: resalta el sismo en el mapa con estilo distinto.
   - `📋` copiar coordenadas al portapapeles.
   - `↗ USGS`: enlace a `feature.properties.url`.
4. **Filtros** (en memoria, sin recarga):
   - **Magnitud**: botones rápidos `≥2.5 / ≥4.0 / ≥5.0` (un mínimo activo a la
     vez; por defecto ≥2.5).
   - **Fecha**: select `Hoy / Esta semana / Este mes` (el feed cubre el mes).
   - **Profundidad**: select `Cualquiera / Superficial ≤10km / Somero 10–70km /
     Profundo >70km`.
5. **Sincronización mapa↔lista**: los filtros re-renderizan la lista **y**
   filtran los marcadores visibles en el mapa; se mantienen consistentes.
6. **Multi-select**: control "Limpiar selección"; los seleccionados se resaltan
   en el mapa.
7. **Timestamp del feed** + botón **⟳ Refresh** (reusa/renombra el existente).
8. **Estado vacío**: "No hay sismos recientes" cuando el filtro da cero
   resultados.
9. **Degradación**: si USGS cae, reusar `#quake-error`; la app sigue funcionando.

### Fuera de alcance (YAGNI)

- ❌ **"Solo réplicas / aftershocks"**: el feed USGS no marca réplicas; no es
  viable de forma fiable. Documentado como no soportado.
- ❌ **Rango de fecha custom**: solo presets (hoy/semana/mes).
- ❌ Búsqueda por región/lugar (texto libre) — diferible si se pide después.

## Arquitectura

### Lógica pura extraída: `src/lib/quakes.ts` (nuevo)

Funciones puras y testeables (sin DOM, sin red):

- `parseQuake(feature)` → `Quake | null`: mapea un feature GeoJSON de USGS a
  `{ id, mag, place, time /*ms epoch*/, depthKm, lat, lng, url }`. Devuelve
  `null` si está fuera del `BBOX` o le faltan campos.
- `inBbox(lat, lng, bbox)` → boolean.
- `filterQuakes(quakes, { minMag, dateRange, depthBucket }, nowMs)` → `Quake[]`.
- `depthBucket(depthKm)` → `"surface" | "shallow" | "deep"`.
- `isRecent(timeMs, nowMs)` → boolean (umbral <1h).
- `formatRelativeTime(timeMs, nowMs)` → string ("Hoy 07:38" |
  "2026-06-28 18:10 UTC").
- `severityClass(mag)` → string (clase CSS por tramo de magnitud).

`nowMs` se inyecta como parámetro (no se llama a `Date.now()` dentro de las
funciones puras) para que los tests sean deterministas.

### Wiring de DOM en `MapaTab.astro`

- `loadQuakes()` pasa a mantener un array `Quake[]` en memoria + un `Map<id,
  marker>` para zoom/resaltado, además de crear los marcadores.
- Markup nuevo en `.list-pane`: el switch de sub-pestañas, la barra de filtros de
  sismos, y el contenedor de la lista de tarjetas.
- Handlers: cambio de sub-pestaña, cambio de filtros (re-render + filtrado de
  marcadores), click/📍 (centrar+zoom), ⦿ (multi-select + resaltado), 📋
  (copiar), ⟳ (refresh).
- Estado de filtros y selección en variables de módulo (en memoria).

### Sin cambios de backend

No se añaden endpoints, modelos Prisma ni migraciones. El feed USGS se consume
client-side como hasta ahora.

## Testing

TDD sobre `src/lib/quakes.ts` con vitest (mismo patrón que
`src/lib/auth.test.ts`), en `src/lib/quakes.test.ts`:

- `parseQuake`: feature válido → objeto correcto; fuera de bbox → `null`; campos
  faltantes → `null`.
- `filterQuakes`: por magnitud mínima, por rango de fecha (hoy/semana/mes con
  `nowMs` fijo), por bucket de profundidad, y combinaciones.
- `depthBucket`: límites ≤10 / 10–70 / >70.
- `isRecent`: justo dentro/fuera de 1h.
- `formatRelativeTime`: evento de hoy vs. de otro día.
- `severityClass`: tramos de magnitud.

El wiring del DOM (sub-pestañas, click-para-centrar, multi-select, copiar) se
verifica manualmente en el navegador.

## Criterios de aceptación

- En `/mapa`, el list-pane muestra el switch `Lugares | Sismos`; "Lugares" sigue
  funcionando igual que antes.
- Al activar "Sismos" se enciende la capa de sismos y se listan los eventos del
  feed con magnitud, lugar, tiempo relativo, profundidad y enlace USGS.
- Los eventos <1h muestran el badge 🆕.
- Los filtros de magnitud/fecha/profundidad afectan lista y marcadores de forma
  consistente y sin recargar.
- Click en una tarjeta (o 📍) centra y hace zoom al evento en el mapa.
- Multi-select resalta los eventos en el mapa; "Limpiar selección" los limpia.
- 📋 copia las coordenadas; ↗ USGS abre la ficha oficial.
- Filtro sin resultados muestra "No hay sismos recientes"; USGS caído muestra el
  mensaje de error y no rompe la app.
- `src/lib/quakes.test.ts` pasa.
