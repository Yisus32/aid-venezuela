import { test } from "node:test";
import assert from "node:assert/strict";

import { listCountries, statesFor, citiesFor, isFreeCity, mergeExtras } from "./geo.ts";

const CAT = {
  countries: ["Venezuela", "España"],
  states: { Venezuela: ["Aragua", "Táchira"], España: ["Madrid"] },
  cities: { Venezuela: { Aragua: ["Girardot"], Táchira: ["San Cristóbal"] } },
};

test("listCountries returns the country list", () => {
  assert.deepEqual(listCountries(CAT), ["Venezuela", "España"]);
});

test("statesFor returns a country's states, or [] when unknown", () => {
  assert.deepEqual(statesFor(CAT, "Venezuela"), ["Aragua", "Táchira"]);
  assert.deepEqual(statesFor(CAT, "Narnia"), []);
});

test("citiesFor returns municipios for a constrained country, [] otherwise", () => {
  assert.deepEqual(citiesFor(CAT, "Venezuela", "Aragua"), ["Girardot"]);
  assert.deepEqual(citiesFor(CAT, "España", "Madrid"), []);
  assert.deepEqual(citiesFor(CAT, "Venezuela", "Zulia"), []);
});

test("isFreeCity is false only for countries with a city catalog", () => {
  assert.equal(isFreeCity(CAT, "Venezuela"), false);
  assert.equal(isFreeCity(CAT, "España"), true);
  assert.equal(isFreeCity(CAT, "Narnia"), true);
});

test("mergeExtras adds new country/state/city without duplicating or mutating", () => {
  const extras = [
    { country: "Chile", state: "Región Metropolitana", city: "Santiago" },
    { country: "Venezuela", state: "Aragua", city: "Mariño" },
    { country: "Venezuela", state: "Zulia", city: "Maracaibo" },
    { country: "Venezuela", state: "Aragua", city: "Girardot" }, // dup, ignored
  ];
  const m = mergeExtras(CAT, extras);

  // new free-city country added at the state level, but not constrained for city
  assert.ok(m.countries.includes("Chile"));
  assert.deepEqual(m.states["Chile"], ["Región Metropolitana"]);
  assert.equal(m.cities["Chile"], undefined);

  // new state under an existing country
  assert.ok(m.states["Venezuela"].includes("Zulia"));
  assert.deepEqual(m.states["Venezuela"], ["Aragua", "Táchira", "Zulia"]);

  // new municipio under existing/new VE state, no duplicate of Girardot
  assert.deepEqual(m.cities["Venezuela"]["Aragua"], ["Girardot", "Mariño"]);
  assert.deepEqual(m.cities["Venezuela"]["Zulia"], ["Maracaibo"]);

  // original untouched
  assert.deepEqual(CAT.states["Venezuela"], ["Aragua", "Táchira"]);
  assert.deepEqual(CAT.cities["Venezuela"]["Aragua"], ["Girardot"]);
  assert.equal(CAT.countries.includes("Chile"), false);
});
