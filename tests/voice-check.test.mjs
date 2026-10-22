// Tests für den Verstanden-Test. Aufruf: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSpoken } from "../js/voice-check.js";

const tee = { id: "a", thai: "ช้าๆหน่อยครับ", deutsch: "Etwas langsamer, bitte" };
const seven = { id: "z7", thai: "เจ็ด", deutsch: "7" };
const water = { id: "w", thai: "น้ำเปล่า", deutsch: "stilles Wasser" };
const ice = { id: "i", thai: "น้ำแข็ง", deutsch: "Eis" };

test("Erkannt, auch ohne khráp und mit ausgeschriebener Wiederholung", () => {
  assert.equal(checkSpoken(tee, ["ช้าช้าหน่อย"]).ok, true);
});

test("Erkannt, wenn einer der Vorschläge passt", () => {
  assert.equal(checkSpoken(water, ["น้ำแข็ง", "น้ำเปล่า"]).ok, true);
});

test("Zahlen dürfen als Ziffer erkannt werden", () => {
  assert.equal(checkSpoken(seven, ["7"]).ok, true);
});

test("Nicht erkannt: sagt, nach welcher Karte es klang", () => {
  const result = checkSpoken(water, ["น้ำแข็ง"], [water, ice]);
  assert.equal(result.ok, false);
  assert.equal(result.heard.id, "i");
});

test("Leeres Ergebnis zählt nicht", () => {
  assert.deepEqual(checkSpoken(water, [""]), { ok: false, heard: null });
});
