# Ayuda Venezuela · Respuesta al terremoto

Portal informativo y humanitario para la respuesta al terremoto en Venezuela.
Centraliza **centros de acopio**, **ayuda profesional**, un **mapa interactivo**
con sismos en tiempo real, **servicios de búsqueda de personas** y un canal para
**reportar** nuevos centros o pedir ayuda.

Sitio **estático** (sin servidor ni base de datos): toda la información se
transcribe desde los avisos/infografías de cada centro y se publica como un
"DB estático" en JSON, fácil de consultar y desplegar.

---

## ✨ Funcionalidades

El sidebar organiza el sitio en siete secciones:

| Sección | Qué hace |
|---|---|
| **Inicio** | Panel resumen con estadísticas y accesos directos a cada sección. |
| **Acopios** | Centros de acopio agrupados por país → estado, en lista desplegable. Filtros jerárquicos (país, estado, urgencia, tipo de donación, organización), paginación de 10 por página, y enlaces "cómo llegar" a Google Maps. |
| **Personal** | Profesionales y servicios voluntarios (médicos, psicólogos, etc.) con teléfonos `tel:` y enlaces a redes. Filtros por estado, profesión y área. |
| **Mapa** | Mapa Leaflet + OpenStreetMap centrado en Venezuela. Marcadores por tipo (acopios, personal, sismos), filtro país→estado, búsqueda global, y **sismos recientes de USGS en tiempo real** (con botón de actualización on-demand). |
| **Servicios** | Plataformas en línea para buscar/reportar personas desaparecidas. |
| **Canales** | Acceso a la cobertura en vivo de X y TikTok por hashtags del terremoto. |
| **Reporta** | Formulario para **pedir ayuda**, **reportar un centro de acopio** o **anunciarse como profesional**. Envía un *embed* a Discord para que los moderadores lo revisen. |

Características transversales: diseño responsive con **sidebar desplegable (burger)**
en móvil, accesibilidad (foco visible, `prefers-reduced-motion`), y branding en
español neutro.

---

## 🧱 Stack

- **[Astro](https://astro.build/)** — generación del sitio estático
- **TypeScript** — tipado de los datos (`src/types.ts`)
- **[Leaflet](https://leafletjs.com/)** + OpenStreetMap — mapa interactivo (sin API key)
- **[USGS GeoJSON feed](https://earthquake.usgs.gov/earthquakes/feed/)** — sismos en tiempo real
- **Discord Webhooks** — recepción de reportes (sin backend)
- **[Prisma](https://www.prisma.io/)** — esquema y migración preparados para una futura base de datos (ver AID-09)

No requiere persistencia ni servidor: los datos viven en archivos estáticos.

---

## 🚀 Inicio rápido

Requiere **Node.js ≥ 22.12**.

```bash
npm install        # instalar dependencias
npm run dev        # genera el DB y levanta el servidor de desarrollo
npm run build      # genera el DB y compila para producción → dist/
npm run preview    # previsualiza el build de producción
```

`npm run dev` y `npm run build` ejecutan automáticamente `generate-db` antes de
arrancar, así que `public/images.json` siempre queda actualizado.

| Script | Descripción |
|---|---|
| `npm run dev` | Genera el DB y arranca el servidor de desarrollo |
| `npm run build` | Genera el DB y compila para producción |
| `npm run preview` | Previsualiza el build |
| `npm run generate-db` | Escanea `public/images/` y genera `public/images.json` |

---

## 🗂️ Arquitectura de datos

El corazón del proyecto es un pipeline que convierte **imágenes** en **datos
consultables**:

```
public/images/**            scripts/image-metadata.json      public/data/locations.md
 (infografías)                (transcripción curada)            (direcciones sin imagen)
        │                            │                                  │
        └──────────────┬────────────┴──────────────┬───────────────────┘
                       ▼                            ▼
              scripts/generate-db.mjs  ──────►  public/images.json
              (organiza, fusiona,                ("DB estático" que
               geocodifica)                       consume el sitio)
```

- **`scripts/image-metadata.json`** es la fuente de verdad de todo lo transcrito
  de las imágenes, indexado por nombre de archivo. Cada entrada puede incluir:
  `category` (`center`/`professional`), `urgency`, `title`, `organization`,
  `specialty`, `description`, `location` (`country`/`state`/`city`/`address`),
  `coords` (`{lat,lng}`), `schedule`, `contact`, `needs[]`, `acceptsMonetary`,
  `people[]`, `collectionPoints[]`, `notes`.
- **`scripts/generate-db.mjs`** escanea `public/images/`, organiza cada imagen en
  carpetas `images/{categoría}/{país}/{estado}/`, agrega datos del sistema de
  archivos (`filename`, `path`, `format`, `fileSize`, `code`), fusiona la
  metadata y escribe `public/images.json`. Avisa si una imagen no tiene metadata
  o si la metadata apunta a un archivo inexistente.
- **`public/data/locations.md`** lista direcciones de puntos **sin imagen**
  (encabezado de estado + direcciones indentadas). El script las parsea,
  geocodifica y emite como centros.

### Agregar un nuevo centro

1. Coloca la imagen en `public/images/` con un nombre tipo `cen-<código>.png`.
2. Agrega su entrada en `scripts/image-metadata.json` (con `coords` y `urgency`).
3. Ejecuta `npm run generate-db`.

La imagen se mueve a su carpeta por país/estado y el centro aparece
automáticamente en las listas, el mapa, los filtros y el dashboard.

---

## 📁 Estructura

```
.
├── public/
│   ├── images/              # infografías, organizadas por categoría/país/estado
│   ├── images.json          # DB estático generado
│   ├── data/                # locations.md + auditoría de homologación
│   └── branding/            # favicons (bandera de Venezuela, Talos)
├── scripts/
│   ├── generate-db.mjs      # pipeline imágenes → images.json
│   ├── image-metadata.json  # transcripción curada
│   └── seed-db.mjs          # migración JSON → DB (Prisma, AID-09)
├── prisma/
│   └── schema.prisma        # modelo de datos para la futura base de datos
├── src/
│   ├── components/          # tabs: Acopios, Personal, Mapa, Servicios, Canales, Reporta…
│   ├── layouts/Layout.astro # sidebar, drawer móvil, navegación
│   ├── lib/                 # utilidades (geocodificación de estados, etc.)
│   ├── pages/index.astro    # página principal
│   └── types.ts             # tipos del dominio
├── requirements/            # especificaciones AID-01 … AID-12
└── AGENTS.md                # guía del proyecto para asistentes de IA
```

---

## ✅ Estado de los requisitos

| Req | Descripción | Estado |
|---|---|---|
| AID-01 | Layout con sidebar y agrupación país→estado | ✅ |
| AID-02 | Filtros (acopios y personal), data-driven y en tiempo real | ✅ |
| AID-03 | Mapa con marcadores por tipo + sismos USGS en vivo | ✅ |
| AID-04 | Canales sociales (X/TikTok por hashtag) | ✅ |
| AID-05 | Homologación de ubicaciones + auditoría | ✅ |
| AID-06 | Enlaces "cómo llegar" a Google Maps | ✅ |
| AID-07 | Nombre de la organización como título del acopio | ✅ |
| AID-08 | Sección de servicios de búsqueda de personas | ✅ |
| AID-09 | Migración a base de datos Prisma + admin | 🟡 Fundación lista (schema + seed); pendiente de aprovisionar la DB |
| AID-10 | Favicons de marca (X/TikTok) | ✅ |
| AID-11 | Formulario de reporte vía Discord | ✅ |
| AID-12 | Footer de branding en el sidebar | ✅ |

---

## 🌎 Despliegue

El sitio es estático y se despliega bien en plataformas como **Netlify**:

- Comando de build: `npm run build`
- Directorio de publicación: `dist/`

El build ejecuta `generate-db` automáticamente, así que `images.json` se
regenera en cada despliegue.

---

## 📝 Notas

- Los sismos se obtienen del feed mensual de USGS (la página de FUNVISIS no
  expone datos legibles por máquina y a su vez referencia a USGS).
- Un feed agregado de X/TikTok dentro del sitio requeriría un backend y claves
  de API; por eso la sección **Canales** enlaza a los resultados en vivo.
- Toda la información humanitaria proviene de las imágenes y de
  `public/data/locations.md`. Verifica siempre en la fuente original antes de
  actuar.

---

🤖 Desarrollado con la asistencia de [Claude Code](https://claude.com/claude-code).
