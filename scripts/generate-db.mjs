import {
  readdirSync,
  writeFileSync,
  readFileSync,
  statSync,
  mkdirSync,
  renameSync,
  rmdirSync,
} from "node:fs";
import { join, dirname, extname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const imagesDir = join(__dirname, "..", "public", "images");
const publicDir = join(__dirname, "..", "public");

// Curated content extracted from each image (the "static DB" of humanitarian
// information). The script only adds file-system facts on top of this — all
// human-readable data lives here, keyed by filename (basename).
const metadata = JSON.parse(
  readFileSync(join(__dirname, "image-metadata.json"), "utf-8"),
);

const IMAGE_RE = /\.(webp|png|jpe?g)$/i;
const emptyLocation = { country: "", state: "", city: "" };
const warnings = [];

// Turn a free-text country/state name into a filesystem-safe folder slug.
const slug = (s) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Recursively collect every image file under `dir`.
function collectImages(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectImages(full));
    else if (IMAGE_RE.test(entry.name)) out.push(full);
  }
  return out;
}

// The folder a file belongs in, derived purely from its curated metadata:
//   images/{category}/{country}/{state}
function targetDirFor(file, meta) {
  const category =
    meta?.category ?? (file.startsWith("cen-") ? "center" : "professional");
  const country = slug(meta?.location?.country) || "sin-pais";
  const state = slug(meta?.location?.state) || "nacional";
  return join(category, country, state);
}

// Remove now-empty directories left behind after moving files (depth-first).
function pruneEmptyDirs(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) pruneEmptyDirs(join(dir, entry.name));
  }
  if (dir !== imagesDir && readdirSync(dir).length === 0) rmdirSync(dir);
}

// --- 1. Organize: move each image into its data-driven folder. ----------------
const moved = [];
for (const full of collectImages(imagesDir)) {
  const file = full.split(sep).pop();
  const meta = metadata[file];
  if (!meta) warnings.push(`No metadata for "${file}" — left in place.`);

  const targetRel = targetDirFor(file, meta);
  const targetAbs = join(imagesDir, targetRel);
  const destAbs = join(targetAbs, file);

  if (destAbs !== full) {
    mkdirSync(targetAbs, { recursive: true });
    renameSync(full, destAbs);
    moved.push(`${file} → images/${targetRel.split(sep).join("/")}/`);
  }
}
pruneEmptyDirs(imagesDir);

// --- Curated image-less points from public/data/locations.md ------------------
// AID-05 designated locations.md as the canonical address list. Non-indented
// lines are state headers; indented lines are addresses under that state.
const STATE_CANON = {
  anzoategui: "Anzoátegui",
  tachira: "Táchira",
  merida: "Mérida",
  zulia: "Zulia",
  aragua: "Aragua",
  carabobo: "Carabobo",
  miranda: "Miranda",
  "distrito-capital": "Distrito Capital",
};
const STATE_COORDS = {
  anzoategui: { lat: 10.134, lng: -64.6836 },
  tachira: { lat: 7.7669, lng: -72.225 },
  merida: { lat: 8.5897, lng: -71.1561 },
  zulia: { lat: 10.6545, lng: -71.6406 },
  aragua: { lat: 10.2469, lng: -67.5958 },
  carabobo: { lat: 10.162, lng: -68.0077 },
  miranda: { lat: 10.49, lng: -66.85 },
  "distrito-capital": { lat: 10.4806, lng: -66.9036 },
};
// More specific than state level when a known place is named in the address.
const PLACE_COORDS = [
  { re: /lecher[ií]a/i, lat: 10.18, lng: -64.68 },
  { re: /santa ana|c[oó]rdoba|timoteo chac[oó]n/i, lat: 7.566, lng: -72.233 },
];
const canonState = (s) => STATE_CANON[slug(s)] || s;
function geocode(address, state) {
  for (const p of PLACE_COORDS)
    if (p.re.test(address)) return { lat: p.lat, lng: p.lng };
  return STATE_COORDS[slug(state)];
}
function parseLocations() {
  let txt;
  try {
    txt = readFileSync(join(publicDir, "data", "locations.md"), "utf-8");
  } catch {
    return [];
  }
  const out = [];
  let state = "";
  let n = 0;
  for (const raw of txt.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    if (/^\s/.test(raw)) {
      const address = raw.trim();
      const name = address.split(",")[0].trim();
      const coords = geocode(address, state);
      n += 1;
      out.push({
        filename: `loc-${slug(state)}-${n}`,
        path: "",
        format: "",
        fileSize: 0,
        code: slug(name),
        category: "center",
        title: name,
        organization: name,
        location: { country: "Venezuela", state: canonState(state), city: "", address },
        ...(coords && { coords }),
        notes: "Dirección curada en public/data/locations.md.",
        source: "locations.md",
      });
    } else {
      state = raw.trim();
    }
  }
  return out;
}

// --- 2. Build the DB from the now-organized tree. -----------------------------
const imageEntries = collectImages(imagesDir)
  .map((full) => {
    const file = full.split(sep).pop();
    const name = file.replace(/\.\w+$/, "");
    const parts = name.split("-");
    const code = parts.slice(1).join("-");
    const meta = metadata[file];

    const { stat } = (() => {
      try {
        return { stat: statSync(full) };
      } catch {
        return { stat: { size: 0 } };
      }
    })();

    // Path mirrors the real on-disk location (POSIX separators for the web).
    const relPath = relative(publicDir, full).split(sep).join("/");

    return {
      filename: file,
      path: `/${relPath}`,
      format: extname(file).slice(1).toLowerCase(),
      fileSize: stat.size,
      code,
      category:
        meta?.category ?? (parts[0] === "cen" ? "center" : "professional"),
      ...(meta?.urgency && { urgency: meta.urgency }),
      title: meta?.title ?? code.toUpperCase(),
      ...(meta?.organization && { organization: meta.organization }),
      ...(meta?.specialty && { specialty: meta.specialty }),
      ...(meta?.description && { description: meta.description }),
      location: meta?.location ?? { ...emptyLocation },
      ...(meta?.coords && { coords: meta.coords }),
      ...(meta?.schedule && { schedule: meta.schedule }),
      ...(meta?.contact && { contact: meta.contact }),
      ...(meta?.needs && { needs: meta.needs }),
      ...(meta?.acceptsMonetary && { acceptsMonetary: meta.acceptsMonetary }),
      ...(meta?.people && { people: meta.people }),
      ...(meta?.collectionPoints && { collectionPoints: meta.collectionPoints }),
      ...(meta?.notes && { notes: meta.notes }),
    };
  });

// Image-less addresses curated in public/data/locations.md.
const extraEntries = parseLocations();
if (extraEntries.length)
  console.log(`📍 ${extraEntries.length} dirección(es) desde locations.md`);

// Group by category, then country / state / city for a stable, readable DB.
const sortKey = (e) =>
  [e.category, e.location.country, e.location.state, e.location.city, e.filename].join(
    "|",
  );
const entries = [...imageEntries, ...extraEntries].sort((a, b) =>
  sortKey(a).localeCompare(sortKey(b), "es"),
);

// Surface metadata entries that no longer have a matching image file.
const present = new Set(entries.map((e) => e.filename));
for (const key of Object.keys(metadata)) {
  if (!present.has(key)) {
    warnings.push(`Metadata for "${key}" has no matching image file.`);
  }
}

const result = { entries, generatedAt: new Date().toISOString() };

writeFileSync(
  join(publicDir, "images.json"),
  JSON.stringify(result, null, 2),
  "utf-8",
);

for (const m of moved) console.log(`📁 ${m}`);
for (const w of warnings) console.warn(`⚠️  ${w}`);
console.log(`Generated images.json with ${entries.length} entries.`);
