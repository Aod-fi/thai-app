// Tests für Töne: Ton an der Umschrift erkennen, Ton-Hinweis, Übung "Töne hören".
// Aufruf: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toneOf, withoutTone, singleSyllable, toneHint, toneRound, TONE_QUESTIONS } from "../js/tones.js";

test("Ton an der Umschrift erkennen", () => {
  assert.equal(toneOf("maa"), "mittel");
  assert.equal(toneOf("pàa"), "tief");
  assert.equal(toneOf("khâao"), "fallend");
  assert.equal(toneOf("máa"), "hoch");
  assert.equal(toneOf("mǎa"), "steigend");
  assert.equal(toneOf("sʉ̂a"), "fallend");
  assert.equal(toneOf("sɔ̌ɔng"), "steigend");
});

test("Tonzeichen entfernen", () => {
  assert.equal(withoutTone("khâao"), "khaao");
  assert.equal(withoutTone("sʉ̌a"), "sʉa");
});

test("Einsilbig: nur ein Wort ohne Bindestrich, Satzzeichen zählen nicht", () => {
  assert.equal(singleSyllable("mâi"), "mâi");
  assert.equal(singleSyllable("mǎi?"), "mǎi");
  assert.equal(singleSyllable("mâi pen rai"), null);
  assert.equal(singleSyllable("sìp-èt"), null);
});

test("Ton-Hinweis: fallend und steigend werden geprüft, vorsichtig formuliert", () => {
  assert.equal(toneHint("mâi", -4).kind, "ok");
  assert.equal(toneHint("mâi", 0.5).kind, "");
  assert.match(toneHint("mâi", 0.5).text, /sollte am Ende deutlich fallen/);
  assert.equal(toneHint("mǎi", 2.5).kind, "ok");
  assert.equal(toneHint("mǎi", -1).kind, "");
  assert.match(toneHint("maa", 0).text, /mittel/);
  assert.equal(toneHint("mâi pen rai", -4), null);
  assert.match(toneHint("dâi", null).text, /zu kurz/);
});

test("Töne hören: 10 Fragen, Antworten stammen aus derselben Gruppe", () => {
  const groups = JSON.parse(readFileSync(new URL("../inhalte/toene.json", import.meta.url), "utf8"));
  const round = toneRound(groups);
  assert.equal(round.length, TONE_QUESTIONS);
  for (const { word, options } of round) {
    assert.ok(options.includes(word));
    assert.ok(options.length >= 2 && options.length <= 4);
    assert.equal(new Set(options.map(o => withoutTone(o.umschrift))).size, 1);
  }
  // Bei 6 Gruppen kommt in den ersten 6 Fragen jede Gruppe genau einmal
  const firstSix = new Set(round.slice(0, groups.length).map(q => withoutTone(q.word.umschrift)));
  assert.equal(firstSix.size, groups.length);
});
