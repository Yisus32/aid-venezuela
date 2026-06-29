import { test } from "node:test";
import assert from "node:assert/strict";

import { filterVisible, annotate, groupDuplicates } from "./moderation.ts";

test("filterVisible drops only hidden entries", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const mod = { b: { status: "hidden", flagReason: null } };
  assert.deepEqual(filterVisible(items, mod).map((i) => i.id), ["a", "c"]);
});

test("filterVisible keeps everything when there is no moderation data", () => {
  const items = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(filterVisible(items, {}).map((i) => i.id), ["a", "b"]);
});

test("annotate attaches status/flag, defaulting to visible/null", () => {
  const items = [{ id: "a" }, { id: "b" }];
  const mod = { b: { status: "hidden", flagReason: "unfair" } };
  const out = annotate(items, mod);
  assert.deepEqual(out[0]._mod, { status: "visible", flagReason: null });
  assert.deepEqual(out[1]._mod, { status: "hidden", flagReason: "unfair" });
  // does not mutate input
  assert.equal(items[0]._mod, undefined);
});

test("groupDuplicates flags entries that share a photo", () => {
  const items = [
    { id: "a", display_name: "Juan Pérez", photo_path: "http://x/p1" },
    { id: "b", display_name: "J. Perez", photo_path: "http://x/p1" },
    { id: "c", display_name: "Ana Gil", photo_path: "http://x/p2" },
  ];
  const out = groupDuplicates(items);
  assert.equal(out[0]._duplicate, true);
  assert.equal(out[1]._duplicate, true);
  assert.equal(out[0]._dupKey, out[1]._dupKey);
  assert.equal(out[2]._duplicate, false);
});

test("groupDuplicates flags same name+location when no photo, but not generic names", () => {
  const items = [
    { id: "a", display_name: "María López", municipio: "Libertador", parroquia: "Sucre", photo_path: null },
    { id: "b", display_name: "maría lópez", municipio: "Libertador", parroquia: "Sucre", photo_path: null },
    { id: "c", display_name: "Menor reportado", municipio: null, parroquia: "Catia", photo_path: null },
    { id: "d", display_name: "Menor reportado", municipio: null, parroquia: "Maiquetía", photo_path: null },
  ];
  const out = groupDuplicates(items);
  assert.equal(out[0]._duplicate, true);
  assert.equal(out[1]._duplicate, true);
  // same generic name but different parroquia → different key → not duplicates
  assert.equal(out[2]._duplicate, false);
  assert.equal(out[3]._duplicate, false);
});
