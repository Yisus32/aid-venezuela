// Llenado masivo: importa SOLO los centros de acopio (category "aid_point") de
// la API de SOS Venezuela 2026 a nuestra DB, homologados como category "center"
// (icono de acopio). Los incidentes (damaged_building / collapsed_building /
// trapped_people) NO se importan.
//
// Aditivo e idempotente: upsert por filename = "sos-<id>". Re-ejecutar actualiza
// los mismos registros; NUNCA borra datos existentes.
//
//   DATABASE_URL=... node scripts/import-aid-points.mjs [--dry]
//
// --dry: no escribe; imprime un resumen y una muestra de lo que se importaría.

const DRY = process.argv.includes("--dry");
const REPORTS = "https://sosvenezuela2026.com/api/reports";

// Centroides de estados (fallback si el reverse-geocoding falla en un punto).
const STATE_CENTROIDS = {
  Amazonas: [5.66, -67.62], Anzoátegui: [9.5, -64.5], Apure: [7.89, -67.47],
  Aragua: [10.25, -67.6], Barinas: [8.62, -70.21], Bolívar: [7.5, -63.3],
  Carabobo: [10.16, -68.0], Cojedes: [9.66, -68.58], "Delta Amacuro": [9.06, -62.05],
  "Distrito Capital": [10.5, -66.92], Falcón: [11.4, -69.67], Guárico: [9.9, -67.35],
  "La Guaira": [10.6, -66.93], Lara: [10.06, -69.33], Mérida: [8.59, -71.15],
  Miranda: [10.3, -66.6], Monagas: [9.75, -63.18], "Nueva Esparta": [11.03, -63.86],
  Portuguesa: [9.04, -69.75], Sucre: [10.45, -64.18], Táchira: [7.77, -72.22],
  Trujillo: [9.37, -70.43], Yaracuy: [10.34, -68.74], Zulia: [10.65, -71.64],
};
// Normaliza nombres que Nominatim devuelve distinto a los nuestros.
const STATE_ALIASES = {
  "Vargas": "La Guaira",
  "Estado La Guaira": "La Guaira",
  "Capital District": "Distrito Capital",
  "Caracas": "Distrito Capital",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist2 = (a, b, c, d) => (a - c) ** 2 + (b - d) ** 2;

function nearestState(lat, lng) {
  let best = "", bd = Infinity;
  for (const [st, [slat, slng]] of Object.entries(STATE_CENTROIDS)) {
    const d = dist2(lat, lng, slat, slng);
    if (d < bd) { bd = d; best = st; }
  }
  return best;
}

// Parsea "Recibe: … · Dirección: … · Contacto: … · (vía …)" del campo description.
function grab(desc, label) {
  const re = new RegExp(label + "\\s*:\\s*([^]*?)(?=\\s*·|$)", "i");
  const m = desc.match(re);
  return m ? m[1].trim() : "";
}
function parseNeeds(recibe) {
  if (!recibe) return [];
  return recibe
    .split(/,|·|\sy\s/i)
    .map((s) => s.replace(/\.$/, "").trim())
    .filter(Boolean)
    .filter((s, i, a) => a.indexOf(s) === i)
    .slice(0, 14);
}
function classifyContact(c) {
  if (!c) return null;
  c = c.trim().replace(/\.$/, "");
  if (/instagram\.com/i.test(c) || /^@/.test(c)) return { instagram: c };
  if (/^https?:\/\//i.test(c)) return { website: c };
  if (/\+?\d[\d\s().-]{6,}\d/.test(c)) return { phone: c };
  return { website: c };
}
const MONEY_RE = /(dinero|monetari|efectivo|transferenc|pago\s*m[óo]vil|zelle|donaci[óo]n econ)/i;

async function reverseGeocode(lat, lng) {
  try {
    const u = new URL("https://nominatim.openstreetmap.org/reverse");
    u.searchParams.set("format", "jsonv2");
    u.searchParams.set("lat", String(lat));
    u.searchParams.set("lon", String(lng));
    u.searchParams.set("zoom", "12");
    u.searchParams.set("accept-language", "es");
    const r = await fetch(u, {
      headers: { "User-Agent": "AyudaVenezuela/1.0 (importador acopios)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const a = d.address || {};
    let state = a.state || a.region || "";
    state = STATE_ALIASES[state] || state.replace(/^Estado\s+/i, "");
    const city = a.city || a.town || a.village || a.municipality || a.county || "";
    return { state, city };
  } catch {
    return null;
  }
}

function toEntry(rp, geo) {
  const desc = rp.description || "";
  const recibe = grab(desc, "Recibe");
  const direccion = grab(desc, "Direcci[óo]n");
  const contacto = grab(desc, "Contacto");
  const name = (rp.title || "Centro de acopio")
    .replace(/^centro de acopio\s*[—–-]\s*/i, "")
    .trim() || "Centro de acopio";
  const state = (geo && geo.state) || nearestState(rp.lat_pub, rp.lng_pub) || "";
  const contact = classifyContact(contacto);
  const needs = parseNeeds(recibe);
  return {
    filename: "sos-" + rp.id,
    code: "",
    category: "center",
    title: name,
    description: undefined,
    location: {
      country: "Venezuela",
      state,
      city: (geo && geo.city) || "",
      address: direccion || undefined,
    },
    coords: { lat: rp.lat_pub, lng: rp.lng_pub },
    needs,
    acceptsMonetary: MONEY_RE.test(recibe) || MONEY_RE.test(desc),
    ...(contact && { contact }),
    notes: rp.source_url ? "Importado vía " + rp.source_url : "Importado de SOS Venezuela 2026",
    source: "SOS Venezuela 2026",
  };
}

async function main() {
  const conn = process.env.DATABASE_URL;
  if (!conn && !DRY) {
    console.error("Falta DATABASE_URL. Aborto. (usa --dry para previsualizar sin DB)");
    process.exit(1);
  }

  console.log("Descargando reportes…");
  const res = await fetch(REPORTS, {
    headers: { "User-Agent": "Mozilla/5.0 (AyudaVenezuela bot)" },
    signal: AbortSignal.timeout(20000),
  });
  const all = await res.json();
  const aid = (Array.isArray(all) ? all : []).filter(
    (x) =>
      x.category === "aid_point" &&
      Number.isFinite(x.lat_pub) &&
      Number.isFinite(x.lng_pub),
  );
  console.log(`Centros de acopio (aid_point) con coordenadas: ${aid.length}`);

  console.log("Geocodificando (Nominatim, ~1/seg)…");
  const entries = [];
  let geoOk = 0;
  for (let i = 0; i < aid.length; i++) {
    const geo = await reverseGeocode(aid[i].lat_pub, aid[i].lng_pub);
    if (geo && geo.state) geoOk++;
    entries.push(toEntry(aid[i], geo));
    if ((i + 1) % 10 === 0 || i === aid.length - 1)
      console.log(`  ${i + 1}/${aid.length}`);
    await sleep(1100); // respeta la política de uso de Nominatim
  }
  console.log(`Geocodificados con estado: ${geoOk}/${aid.length} (resto por centroide)`);

  // Resumen por estado.
  const byState = {};
  for (const e of entries) byState[e.location.state || "—"] = (byState[e.location.state || "—"] || 0) + 1;
  console.log("Por estado:", JSON.stringify(byState, null, 0));

  if (DRY) {
    console.log("\n--- MUESTRA (3) ---");
    for (const e of entries.slice(0, 3)) console.log(JSON.stringify(e, null, 1));
    console.log("\n[dry-run] No se escribió nada.");
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conn }) });

  let created = 0, updated = 0;
  for (const e of entries) {
    const existing = await prisma.point.findUnique({
      where: { filename: e.filename },
      select: { id: true, locationId: true },
    });
    const locData = {
      country: e.location.country, state: e.location.state, city: e.location.city,
      address: e.location.address ?? null, lat: e.coords.lat, lng: e.coords.lng,
    };
    const scalars = {
      code: e.code, category: e.category, title: e.title,
      description: e.description ?? null, needs: e.needs,
      acceptsMonetary: e.acceptsMonetary, notes: e.notes ?? null,
      source: e.source ?? null, path: "", format: "", fileSize: 0,
    };
    const nested = e.contact
      ? { contact: { create: {
          phone: e.contact.phone ?? null, whatsapp: null,
          instagram: e.contact.instagram ?? null,
          website: e.contact.website ?? null, email: null,
        } } }
      : {};

    if (existing) {
      await prisma.location.update({ where: { id: existing.locationId }, data: locData });
      await prisma.contact.deleteMany({ where: { pointId: existing.id } });
      await prisma.point.update({ where: { id: existing.id }, data: { ...scalars, ...nested } });
      updated++;
    } else {
      const loc = await prisma.location.create({ data: locData });
      await prisma.point.create({
        data: { filename: e.filename, ...scalars, locationId: loc.id, ...nested },
      });
      created++;
    }
  }
  console.log(`\nListo. Creados: ${created} · Actualizados: ${updated}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
