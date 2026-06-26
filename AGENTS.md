# AGENTS.md

## Project Context

This project is a static humanitarian information portal focused on the current earthquake situation in Venezuela.

- **Stack**: [Astro](https://astro.build/) for site generation, TypeScript for type safety, with possible future use of [Prisma](https://www.prisma.io/) if persistent storage becomes necessary (currently, NO persistence).
- **Static Information System**: All data is currently static and sourced from files.
- **Image Data**: The primary source of information is `public/images/`. The images are humanitarian infographics whose **textual content** (needed supplies, addresses, schedules, contacts, professionals' names/phones) is the real data. That content is transcribed by hand into `scripts/image-metadata.json` (keyed by filename) and merged with file-system facts into `public/images.json`, which serves as a "static DB" for the site. The goal is to map ALL information shown inside each image into the JSON — not merely to reference the image files for display.
- **Requirements**: Detailed feature and design requirements can be found in the `@requirements` directory.

## Additional Notes

- There is currently **no need for persistent storage**, so no database setup is required at this stage. Data lives in static JSON.
- If persistence or relational queries are needed later, evaluate using SQLite + Prisma, as both are suitable for deployment to static site platforms (like Netlify) with minimal configuration.
- All humanitarian data and images shown on the site MUST be sourced from the specified directories. Keep augmentation and external data fetching out unless requirements change.

## Deployment Considerations

- Deployments to Netlify work best with static assets and data (JSON).
- If switching to a real DB: SQLite is deployable on Netlify with proper configuration, but many projects keep using static JSON to avoid runtime complexity.

## Scripts

- `npm run dev` — Generate DB and start dev server
- `npm run build` — Generate DB and build for production
- `npm run generate-db` — Scan `public/images/` and generate `public/images.json`

## Data Mapping

`scripts/image-metadata.json` is the single source of truth for everything transcribed from the images, keyed by exact filename. Each entry can hold: `category` (`center` | `professional`), `urgency` (`high`/`medium`/`low`, centers), `title`, `organization`, `specialty`, `description`, `location` (`country`/`state`/`city`/`address`), `coords` (`{lat,lng}`, hand-geocoded — used by the map), `schedule`, `contact`, `needs[]`, `acceptsMonetary`, `people[]`, `collectionPoints[]`, `notes`.

`scripts/generate-db.mjs` scans `public/images/`, adds file-system facts (`filename`, `path`, `format`, `fileSize`, `code`), merges the curated metadata, and writes `public/images.json`. It warns when an image has no metadata or when metadata points to a missing image.

To add or correct data: edit `image-metadata.json` (add a key for any new image filename, including `coords` and `urgency`) and run `npm run generate-db`. `category` derived from the filename prefix (`cen-` → center) is only a fallback; metadata `category` always wins, so an image can be reclassified by content (e.g. a `help-*` supply drive is a `center`).

**Filters (AID-02):** ACOPIOS and PERSONAL render all items server-side with `data-*` attributes and filter client-side (no reload). Filter options are derived from the data, never hardcoded — donation types come from keyword rules over `needs`, "area" from `specialty`. State options depend on the selected country.

**Map (AID-03):** MAPA uses Leaflet + OpenStreetMap (CDN, no API key) with colored markers — acopios blue/cross, personal red/user, earthquakes yellow/wave. Earthquakes are fetched client-side in real time from the USGS `2.5_month` GeoJSON feed (loaded lazily on first map open) and clipped to a Venezuela bounding box. NOTE: the spec named funvisis.gob.ve, but that page has no machine-readable list and itself defers to USGS, so we source USGS directly. Global location search uses the Nominatim geocoder control.

---

## Instructions/Todos

- [x] Write a script to scan the `@images` directory and map image metadata (filename, path, basic EXIF if useful) to a `images.json` file in the static assets.
- [x] Load and display information from this JSON throughout the Astro/TS site.
- [x] Transcribe ALL information shown inside each image (needs, addresses, schedules, contacts, people) into `scripts/image-metadata.json` and surface it across the ACOPIOS / PERSONAL / MAPA tabs.
- [x] AID-01 layout: three-tab sidebar, country→state grouping.
- [x] AID-02 filters: ACOPIOS (country, dependent state, urgency, donation type, organization) and PERSONAL (state, profession, area), data-driven and real-time.
- [x] AID-03 map: Leaflet + OSM with type-colored markers and real-time USGS earthquakes, centered on Venezuela, with global search.
- [x] AID-04 social channels: "Canales" tab links to live X/TikTok hashtag results. NOTE: a true in-page aggregated feed needs a backend + paid X API + TikTok access — not possible on this static deploy, so we link to live results and document it in the UI.
- [x] AID-05 homologation: organizations normalized, locations reviewed; audit log at `public/data/homologation-audit.md`.
- [x] AID-06 "how to get there": every address on ACOPIOS is a Google Maps directions link (`maps/dir/?api=1&destination=`), new tab.
- [x] AID-07 org names: ACOPIOS accordion row is labelled by `organization` (fallback "Centros de Acopio Sociedad Civil").
- [x] AID-08 services: "Servicios" sidebar tab listing missing-persons platforms (edit the array in `ServiciosTab.astro` to maintain).
- [~] AID-09 backend/admin: POSTPONED. Foundation done & verified — `prisma/schema.prisma` (validated), `prisma.config.ts`, `scripts/seed-db.mjs` (JSON→DB). Remaining (admin CRUD page, SSR conversion, live DB queries, deploy) needs the user's Prisma Compute login + a provisioned `DATABASE_URL` + switching off static hosting.
- [x] AID-10 brand icons: X/TikTok favicons in the Canales tab headers (Servicios stays text-only).
- [x] AID-11 Discord report form: `ReportCenterForm.astro`, POSTs a Discord embed client-side (CORS confirmed OK). Lives only in the "Reporta" tab; the dashboard links to it.
- [x] AID-12 branding: sidebar footer "Powered by Talos Software" with Venezuela-flag + Talos favicons, links to talosware.com.ve. Assets in `public/branding/`.

The sidebar now has seven tabs: Inicio (dashboard), Acopios, Personal, Mapa, Servicios, Canales, Reporta. On mobile it collapses into a burger-toggled drawer. The MAPA tab has a País→Estado list filter, a "⟳ Actualizar sismos" on-demand USGS refresh, and a "⟲ Centrar en Venezuela" reset.

Image-less addresses curated in `public/data/locations.md` (state header + indented address lines) are parsed by `generate-db.mjs`, geocoded, and emitted as centers.

---

