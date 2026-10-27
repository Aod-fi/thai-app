// Tests für die Namen der Tondateien. Aufruf: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { cardAudio, exampleAudio, exampleAudioFiles, toneAudio, toneAudioFiles } from "../js/audio-files.js";
import { localizeCards, useLanguage } from "../js/sprache.js";

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const exists = file => existsSync(new URL(`../${file}`, import.meta.url));

test("Namen: Karte, Beispiel, englisches Beispiel, Töne", () => {
  assert.equal(cardAudio({ id: "taxi-pai" }), "audio/taxi-pai.m4a");
  assert.equal(exampleAudio({ id: "taxi-pai", beispiel_thai: "x" }), "audio/beispiele/taxi-pai.m4a");
  assert.equal(exampleAudio({ id: "taxi-pai", beispiel_thai: "x" }, true), "audio/beispiele/taxi-pai.m4a");
  assert.equal(exampleAudio({ id: "n", beispiel_thai: "x", beispiel_thai_en: "y" }, true), "audio/beispiele/n-en.m4a");
  assert.equal(toneAudio({ gruppe: "maa" }, 1), "audio/toene/maa-2.m4a");
});

test("Englisch: eigener Thai-Text des Beispiels und eigene Datei", () => {
  const card = { id: "n", beispiel: "B", beispiel_thai: "ผมชื่ออ๊อดครับ", beispiel_thai_en: "ผมชื่อทอมครับ" };
  useLanguage("en");
  const [en] = localizeCards([card]);
  assert.equal(en.beispiel_thai, "ผมชื่อทอมครับ");
  assert.equal(en.beispiel_audio, "audio/beispiele/n-en.m4a");
  useLanguage("de");
  const [de] = localizeCards([card]);
  assert.equal(de.beispiel_thai, "ผมชื่ออ๊อดครับ");
  assert.equal(de.beispiel_audio, "audio/beispiele/n.m4a");
});

test("Jede Karte, jedes Beispiel und jedes Wort für Töne hören hat eine Tondatei", () => {
  const cards = read("inhalte/vokabeln.json");
  const missing = [
    ...cards.map(cardAudio),
    ...exampleAudioFiles(cards).map(f => f.file),
    ...toneAudioFiles(read("inhalte/toene.json")).map(f => f.file),
  ].filter(file => !exists(file));
  assert.deepEqual(missing, []);
});
