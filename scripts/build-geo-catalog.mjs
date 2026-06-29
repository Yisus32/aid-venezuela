// Builds src/data/geo-catalog.json — the static country → state → city catalog
// for the admin location selectors (AID-015).
//
// Sources (public datasets, fetched at build time, NOT vendored raw):
//   - dr5hn/countries-states-cities-database: countries (for Spanish names) and
//     states (first-level divisions worldwide).
//   - zokeber/venezuela-json: authoritative Venezuela estados → municipios (335).
//
// Coverage (per the AID-015 design): Venezuela deep (estado → municipio); the
// rest of the world to state/province level only (city is free-entry there).
//
// Re-run with:  node scripts/build-geo-catalog.mjs
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "src", "data", "geo-catalog.json");

const SRC = {
  countries: "https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/countries.json",
  states: "https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/states.json",
  veMunicipios: "https://raw.githubusercontent.com/zokeber/venezuela-json/master/venezuela.json",
};

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`);
  return r.json();
}

// Spanish country name (the app is in Spanish and existing DB rows use Spanish
// names like "España", "Estados Unidos"); fall back to the canonical name.
function esName(country) {
  let t = country.translations;
  if (typeof t === "string") { try { t = JSON.parse(t); } catch { t = {}; } }
  return (t && t.es) || country.name;
}

const collator = new Intl.Collator("es");
const sortEs = (arr) => arr.slice().sort((a, b) => collator.compare(a, b));
const uniq = (arr) => [...new Set(arr)];

const [countries, states, ve] = await Promise.all([
  getJson(SRC.countries),
  getJson(SRC.states),
  getJson(SRC.veMunicipios),
]);

// country English name -> Spanish display name
const enToEs = new Map(countries.map((c) => [c.name, esName(c)]));

// Group world states by Spanish country name, dropping the stray rows where the
// "state" is just the country itself.
const statesByCountry = {};
for (const s of states) {
  const country = enToEs.get(s.country_name) || s.country_name;
  if (!s.name || s.name === country || s.name === s.country_name) continue;
  (statesByCountry[country] ??= []).push(s.name);
}
for (const k of Object.keys(statesByCountry)) {
  statesByCountry[k] = sortEs(uniq(statesByCountry[k]));
}

// Override Venezuela with the authoritative estados → municipios.
const veStates = sortEs(ve.map((e) => e.estado));
statesByCountry["Venezuela"] = veStates;
const veCities = {};
for (const e of ve) {
  veCities[e.estado] = sortEs(e.municipios.map((m) => m.municipio));
}

// Country list: every country that has states, Venezuela pinned first.
const countryList = sortEs(Object.keys(statesByCountry)).filter((c) => c !== "Venezuela");
countryList.unshift("Venezuela");

const catalog = {
  countries: countryList,
  states: statesByCountry,
  // Only countries present here get a constrained city selector; everything else
  // is free-entry (see isFreeCity in src/lib/geo.ts).
  cities: { Venezuela: veCities },
};

writeFileSync(OUT, JSON.stringify(catalog));
const muni = Object.values(veCities).reduce((n, a) => n + a.length, 0);
console.log(
  `geo-catalog.json written: ${countryList.length} countries, ` +
    `${Object.values(statesByCountry).reduce((n, a) => n + a.length, 0)} states, ` +
    `${veStates.length} VE estados, ${muni} VE municipios`,
);
