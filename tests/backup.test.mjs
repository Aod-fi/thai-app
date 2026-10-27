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
