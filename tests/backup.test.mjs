// Tests für "Lernstand sichern und laden". Aufruf: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBackup, parseBackup, backupFileName } from "../js/backup.js";

const data = {
  progress: { "gruss-hallo": { box: 3, due: "2026-10-30" } },
  meta: { learnedDays: ["2026-10-26", "2026-10-27"], focus: "Taxi" },
};

test("Sichern und wieder laden ergibt denselben Lernstand", () => {
  const text = JSON.stringify(buildBackup(data, "1.7.5", new Date("2026-10-27T10:00:00Z")));
  const loaded = parseBackup(text);
  assert.deepEqual(loaded.progress, data.progress);
  assert.deepEqual(loaded.meta, data.meta);
  assert.equal(loaded.gesichertAm, "2026-10-27T10:00:00.000Z");
});

test("Dateiname enthält das Datum", () => {
  assert.equal(backupFileName("2026-10-27"), "mythai-lernstand-2026-10-27.json");
});

test("Eine fremde Datei wird abgelehnt", () => {
  assert.throws(() => parseBackup("Hallo"), /keine Sicherung/);
  assert.throws(() => parseBackup(JSON.stringify({ progress: {}, meta: {} })), /keine Sicherung/);
});

test("Eine beschädigte Karte wird gemeldet", () => {
  const broken = buildBackup({ progress: { x: { box: 9, due: "morgen" } }, meta: {} }, "1.7.5");
  assert.throws(() => parseBackup(JSON.stringify(broken)), /beschädigt \(Karte x\)/);
});

test("Mein Profil wird mitgesichert und wieder geladen", () => {
  const profil = { name: "Mia", geschlecht: "frau", alter: 42 };
  const backup = buildBackup({ ...data, profil }, "1.8.2");
  assert.deepEqual(backup.profil, profil);
  assert.deepEqual(parseBackup(JSON.stringify(backup)).profil, profil);
  // Ohne Profil steht in der Sicherung auch keins
  assert.equal("profil" in buildBackup({ ...data, profil: null }, "1.8.2"), false);
});

test("Ältere Sicherungen ohne Profil lassen sich weiter laden", () => {
  const old = { art: "mythai-lernstand", version: 1, appVersion: "1.8.2", gesichertAm: "2026-10-27T10:00:00.000Z", ...data };
  const loaded = parseBackup(JSON.stringify(old));
  assert.deepEqual(loaded.progress, data.progress);
  assert.equal(loaded.profil, null);
});
