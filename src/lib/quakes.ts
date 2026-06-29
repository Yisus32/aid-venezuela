// Pure helpers for the USGS earthquake ("sismos") sidebar listing (AID-014).
// No DOM and no network here so the parsing/filtering/formatting logic can be
// unit-tested deterministically (now-time is always injected, never read).

export interface BBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// Venezuela region clip — same box used by the map markers in MapaTab.astro.
export const VE_BBOX: BBox = { minLat: 0, maxLat: 14, minLng: -74, maxLng: -59 };

export interface Quake {
  id: string;
  mag: number | null;
  place: string;
  time: number; // ms epoch
  depthKm: number;
  lat: number;
  lng: number;
  url: string;
}

export type DateRange = "today" | "week" | "month";
export type DepthBucket = "surface" | "shallow" | "deep";

export interface QuakeFilter {
  minMag: number;
  dateRange: DateRange;
  depthBucket: DepthBucket | "any";
}

export function inBbox(lat: number, lng: number, bbox: BBox): boolean {
  return (
    lat > bbox.minLat && lat < bbox.maxLat &&
    lng > bbox.minLng && lng < bbox.maxLng
  );
}

// Map a raw USGS GeoJSON feature to a Quake, or null if it's malformed or
// falls outside the bbox.
export function parseQuake(feature: any, bbox: BBox): Quake | null {
  const geo = feature && feature.geometry;
  const coords = geo && geo.coordinates;
  if (!coords || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!inBbox(lat, lng, bbox)) return null;
  const p = feature.properties || {};
  return {
    id: String(feature.id),
    mag: typeof p.mag === "number" ? p.mag : null,
    place: p.place || "",
    time: Number(p.time),
    depthKm: Number(coords[2]) || 0,
    lat,
    lng,
    url: p.url || "",
  };
}

export function depthBucket(depthKm: number): DepthBucket {
  if (depthKm <= 10) return "surface";
  if (depthKm <= 70) return "shallow";
  return "deep";
}

export function severityClass(mag: number | null): string {
  if (mag == null) return "sev-low";
  if (mag >= 5) return "sev-high";
  if (mag >= 4) return "sev-mid";
  return "sev-low";
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

// "New" = less than an hour old (and not in the future).
export function isRecent(timeMs: number, nowMs: number): boolean {
  const age = nowMs - timeMs;
  return age >= 0 && age < HOUR_MS;
}

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

// "Hoy HH:MM" when the event is on the same UTC day as now, otherwise the full
// "YYYY-MM-DD HH:MM UTC" timestamp. UTC keeps it deterministic and matches the
// USGS feed's own convention.
export function formatRelativeTime(timeMs: number, nowMs: number): string {
  const d = new Date(timeMs);
  const now = new Date(nowMs);
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const sameDay =
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate();
  if (sameDay) return `Hoy ${hh}:${mm}`;
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return `${date} ${hh}:${mm} UTC`;
}

function rangeWindowMs(range: DateRange): number {
  if (range === "today") return DAY_MS;
  if (range === "week") return 7 * DAY_MS;
  return Infinity; // month: feed already covers the past month
}

export function filterQuakes(quakes: Quake[], filter: QuakeFilter, nowMs: number): Quake[] {
  const window = rangeWindowMs(filter.dateRange);
  return quakes.filter((q) => {
    if (q.mag == null || q.mag < filter.minMag) return false;
    if (nowMs - q.time > window) return false;
    if (filter.depthBucket !== "any" && depthBucket(q.depthKm) !== filter.depthBucket) return false;
    return true;
  });
}
