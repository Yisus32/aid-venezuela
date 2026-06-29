import { test } from "node:test";
import assert from "node:assert/strict";

import { topNeeds } from "./needs.ts";

test("topNeeds ranks by frequency, capped at n", () => {
  const entries = [
    { needs: ["Agua", "Ropa"] },
    { needs: ["Agua", "Medicinas"] },
    { needs: ["Agua", "Ropa"] },
    { needs: ["Pañales"] },
  ];
  // Agua=3, Ropa=2, Medicinas=1, Pañales=1
  assert.deepEqual(topNeeds(entries, 2), ["Agua", "Ropa"]);
});

test("topNeeds breaks ties alphabetically", () => {
  const entries = [{ needs: ["Zapatos", "Agua", "Mantas"] }];
  // all freq 1 -> alpha
  assert.deepEqual(topNeeds(entries, 3), ["Agua", "Mantas", "Zapatos"]);
});

test("topNeeds normalizes surrounding/collapsed whitespace", () => {
  const entries = [
    { needs: ["Agua potable"] },
    { needs: ["  Agua potable  "] },
    { needs: ["Agua   potable"] },
  ];
  assert.deepEqual(topNeeds(entries, 5), ["Agua potable"]);
});

test("topNeeds merges case variants under the most common spelling", () => {
  const entries = [
    { needs: ["Alimentos no perecederos"] },
    { needs: ["Alimentos no perecederos"] },
    { needs: ["alimentos no perecederos"] },
    { needs: ["Agua"] },
  ];
  // "alimentos..." group totals 3 (canonical = capitalized, the majority spelling)
  assert.deepEqual(topNeeds(entries, 5), ["Alimentos no perecederos", "Agua"]);
});

test("topNeeds handles missing/empty needs and returns all when n exceeds distinct", () => {
  const entries = [{ needs: ["Agua"] }, {}, { needs: [] }, { needs: ["", "  "] }];
  assert.deepEqual(topNeeds(entries, 10), ["Agua"]);
  assert.deepEqual(topNeeds([], 5), []);
});
