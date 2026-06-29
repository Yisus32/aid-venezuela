// Pure queries over the static location catalog (AID-015). The catalog shape is
// always passed in so these stay testable and framework-free.
//
//   { countries: string[],
//     states: { [country]: string[] },
//     cities: { [country]: { [state]: string[] } } }  // only constrained countries

export interface GeoCatalog {
  countries: string[];
  states: Record<string, string[]>;
  cities: Record<string, Record<string, string[]>>;
}

export interface LocationExtra {
  country?: string;
  state?: string;
  city?: string;
}

export function listCountries(catalog: GeoCatalog): string[] {
  return catalog.countries || [];
}

export function statesFor(catalog: GeoCatalog, country: string): string[] {
  return (catalog.states && catalog.states[country]) || [];
}

export function citiesFor(catalog: GeoCatalog, country: string, state: string): string[] {
  const c = catalog.cities && catalog.cities[country];
  return (c && c[state]) || [];
}

// A country has a constrained city list only if it appears in `cities` (today:
// Venezuela). Everywhere else the city field is free entry.
export function isFreeCity(catalog: GeoCatalog, country: string): boolean {
  return !(catalog.cities && catalog.cities[country]);
}

function pushUnique(arr: string[], v: string): void {
  if (v && arr.indexOf(v) < 0) arr.push(v);
}

// Returns a new catalog augmented with country/state/city values seen in the DB,
// so existing rows (incl. naming variants the static dataset lacks) stay
// selectable. Never mutates the input; only adds cities for already-constrained
// countries (free-city countries keep free entry).
export function mergeExtras(catalog: GeoCatalog, extras: LocationExtra[]): GeoCatalog {
  const out: GeoCatalog = {
    countries: [...(catalog.countries || [])],
    states: {},
    cities: {},
  };
  for (const k of Object.keys(catalog.states || {})) out.states[k] = [...catalog.states[k]];
  for (const k of Object.keys(catalog.cities || {})) {
    out.cities[k] = {};
    for (const s of Object.keys(catalog.cities[k])) out.cities[k][s] = [...catalog.cities[k][s]];
  }

  for (const ex of extras || []) {
    const country = (ex.country || "").trim();
    const state = (ex.state || "").trim();
    const city = (ex.city || "").trim();
    if (!country) continue;
    pushUnique(out.countries, country);
    if (state) {
      (out.states[country] ??= []);
      pushUnique(out.states[country], state);
    }
    // Only track cities for constrained countries (e.g. Venezuela).
    if (state && city && out.cities[country]) {
      (out.cities[country][state] ??= []);
      pushUnique(out.cities[country][state], city);
    }
  }
  return out;
}
