import type { ImageEntry } from "../types";

// Approximate coordinates (state capital / main city) used to place the
// individual points of a multi-state compilation on the map and to group them
// in their real state. Extend as new states appear in the data.
export const VE_STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  Táchira: { lat: 7.7669, lng: -72.225 },
  Mérida: { lat: 8.5897, lng: -71.1561 },
  Zulia: { lat: 10.6545, lng: -71.6406 },
  "Distrito Capital": { lat: 10.4806, lng: -66.9036 },
  Miranda: { lat: 10.49, lng: -66.85 },
  Aragua: { lat: 10.2469, lng: -67.5958 },
  Carabobo: { lat: 10.162, lng: -68.0077 },
  Anzoátegui: { lat: 10.134, lng: -64.6836 },
  Lara: { lat: 10.0647, lng: -69.3301 },
  Bolívar: { lat: 8.1222, lng: -63.5497 },
  Falcón: { lat: 11.4081, lng: -69.6709 },
};

// A "compilation" is a single image that lists collection points across more
// than one state (e.g. the nationwide "Centros de Acopio en Venezuela" flyer).
// Returns the distinct states if it qualifies, otherwise null.
export function compilationStates(e: ImageEntry): string[] | null {
  const states = [
    ...new Set((e.collectionPoints || []).map((p) => p.state).filter(Boolean)),
  ] as string[];
  return states.length > 1 ? states : null;
}

// Split each multi-state compilation into one entry per state so the ACOPIOS
// list shows its points under their real state. Single-location centers pass
// through unchanged.
export function expandCenters(centers: ImageEntry[]): ImageEntry[] {
  const out: ImageEntry[] = [];
  for (const c of centers) {
    const states = compilationStates(c);
    if (states) {
      for (const st of states) {
        out.push({
          ...c,
          location: { ...c.location, state: st, city: "" },
          collectionPoints: (c.collectionPoints || []).filter(
            (p) => p.state === st,
          ),
          coords: VE_STATE_COORDS[st] || c.coords,
        });
      }
    } else {
      out.push(c);
    }
  }
  return out;
}
