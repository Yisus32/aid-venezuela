import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseQuake,
  filterQuakes,
  depthBucket,
  isRecent,
  formatRelativeTime,
  severityClass,
  VE_BBOX,
} from "./quakes.ts";

// A USGS GeoJSON feature inside the Venezuela bbox (Caracas-ish), 4.7M, 16km deep.
function feat(over = {}) {
  return {
    id: "us7000abcd",
    properties: { mag: 4.7, place: "10 km N of Vargas, Venezuela", time: 1_000_000, url: "https://usgs/abcd", ...(over.properties || {}) },
    geometry: { type: "Point", coordinates: [-66.9, 10.5, 16], ...(over.geometry || {}) },
    ...over,
  };
}

test("parseQuake maps a valid in-bbox feature", () => {
  const q = parseQuake(feat(), VE_BBOX);
  assert.deepEqual(q, {
    id: "us7000abcd",
    mag: 4.7,
    place: "10 km N of Vargas, Venezuela",
    time: 1_000_000,
    depthKm: 16,
    lat: 10.5,
    lng: -66.9,
    url: "https://usgs/abcd",
  });
});

test("parseQuake returns null outside the bbox", () => {
  // Off the coast of California — well outside Venezuela.
  const q = parseQuake(feat({ geometry: { coordinates: [-122, 37, 8] } }), VE_BBOX);
  assert.equal(q, null);
});

test("parseQuake returns null when geometry or coords are missing", () => {
  assert.equal(parseQuake(feat({ geometry: null }), VE_BBOX), null);
  assert.equal(parseQuake(feat({ geometry: { coordinates: [] } }), VE_BBOX), null);
});

test("depthBucket classifies surface/shallow/deep at the boundaries", () => {
  assert.equal(depthBucket(0), "surface");
  assert.equal(depthBucket(10), "surface");
  assert.equal(depthBucket(10.1), "shallow");
  assert.equal(depthBucket(70), "shallow");
  assert.equal(depthBucket(70.1), "deep");
  assert.equal(depthBucket(300), "deep");
});

test("severityClass buckets by magnitude", () => {
  assert.equal(severityClass(2.9), "sev-low");
  assert.equal(severityClass(4.0), "sev-mid");
  assert.equal(severityClass(4.9), "sev-mid");
  assert.equal(severityClass(5.0), "sev-high");
  assert.equal(severityClass(null), "sev-low");
});

test("isRecent is true within the last hour, false otherwise", () => {
  const now = 10_000_000;
  assert.equal(isRecent(now - 60_000, now), true); // 1 min ago
  assert.equal(isRecent(now - 59 * 60_000, now), true); // 59 min ago
  assert.equal(isRecent(now - 61 * 60_000, now), false); // 61 min ago
  assert.equal(isRecent(now + 5_000, now), false); // future
});

test("formatRelativeTime shows 'Hoy HH:MM' for same UTC day, full date otherwise", () => {
  const now = Date.UTC(2026, 5, 29, 12, 0, 0); // 2026-06-29 12:00 UTC
  const sameDay = Date.UTC(2026, 5, 29, 7, 38, 0);
  const otherDay = Date.UTC(2026, 5, 28, 18, 10, 0);
  assert.equal(formatRelativeTime(sameDay, now), "Hoy 07:38");
  assert.equal(formatRelativeTime(otherDay, now), "2026-06-28 18:10 UTC");
});

test("filterQuakes filters by minimum magnitude", () => {
  const qs = [
    { id: "a", mag: 2.6, time: 0, depthKm: 5, lat: 0, lng: 0 },
    { id: "b", mag: 4.2, time: 0, depthKm: 5, lat: 0, lng: 0 },
    { id: "c", mag: null, time: 0, depthKm: 5, lat: 0, lng: 0 },
  ];
  const out = filterQuakes(qs, { minMag: 4.0, dateRange: "month", depthBucket: "any" }, 0);
  assert.deepEqual(out.map((q) => q.id), ["b"]);
});

test("filterQuakes filters by date range window", () => {
  const now = 100 * 86_400_000; // day 100 in ms
  const qs = [
    { id: "today", mag: 3, time: now - 3_600_000, depthKm: 5, lat: 0, lng: 0 }, // 1h ago
    { id: "thisweek", mag: 3, time: now - 5 * 86_400_000, depthKm: 5, lat: 0, lng: 0 }, // 5d ago
    { id: "old", mag: 3, time: now - 20 * 86_400_000, depthKm: 5, lat: 0, lng: 0 }, // 20d ago
  ];
  assert.deepEqual(
    filterQuakes(qs, { minMag: 2.5, dateRange: "today", depthBucket: "any" }, now).map((q) => q.id),
    ["today"],
  );
  assert.deepEqual(
    filterQuakes(qs, { minMag: 2.5, dateRange: "week", depthBucket: "any" }, now).map((q) => q.id),
    ["today", "thisweek"],
  );
  assert.deepEqual(
    filterQuakes(qs, { minMag: 2.5, dateRange: "month", depthBucket: "any" }, now).map((q) => q.id),
    ["today", "thisweek", "old"],
  );
});

test("filterQuakes filters by depth bucket", () => {
  const qs = [
    { id: "surf", mag: 3, time: 0, depthKm: 5, lat: 0, lng: 0 },
    { id: "shal", mag: 3, time: 0, depthKm: 40, lat: 0, lng: 0 },
    { id: "deep", mag: 3, time: 0, depthKm: 120, lat: 0, lng: 0 },
  ];
  assert.deepEqual(
    filterQuakes(qs, { minMag: 2.5, dateRange: "month", depthBucket: "surface" }, 0).map((q) => q.id),
    ["surf"],
  );
  assert.deepEqual(
    filterQuakes(qs, { minMag: 2.5, dateRange: "month", depthBucket: "deep" }, 0).map((q) => q.id),
    ["deep"],
  );
});
