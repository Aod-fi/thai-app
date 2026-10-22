// Tests für die Dialoge: Rollenwechsel (khâ/khá → khráp), Sätze, Tondateien.
// Aufruf: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { khrapUmschrift, khrapThai, dialogLines, audioFiles, needsKhrap, repeatPauseMs } from "../js/dialoge.js";

const dialogs = JSON.parse(readFileSync(new URL("../inhalte/dialoge.json", import.meta.url), "utf8"));
const taxi = dialogs.find(d => d.id === "taxi-einsteigen");

test("khâ und khá werden zu khráp, andere Wörter bleiben", () => {
  assert.equal(khrapUmschrift("sà-wàt-dii khâ. pai nǎi khá?"), "sà-wàt-dii khráp. pai nǎi khráp?");
  assert.equal(khrapUmschrift("khâ."), "khráp.");
  assert.equal(khrapUmschrift("khâa rót tâo-rài khráp?"), "khâa rót tâo-rài khráp?");
  assert.equal(khrapUmschrift("khâao phàt kài"), "khâao phàt kài");
});

test("ค่ะ und คะ am Satzende werden zu ครับ", () => {
  assert.equal(khrapThai("สวัสดีค่ะ ไปไหนคะ"), "สวัสดีครับ ไปไหนครับ");
  assert.equal(khrapThai("ค่ะ"), "ครับ");
  assert.equal(khrapThai("ค่ารถเท่าไหร่ครับ"), "ค่ารถเท่าไหร่ครับ");
});

test("Normale Rolle: Aod spricht die ich-Sätze, Kanya die anderen", () => {
  const lines = dialogLines(taxi);
  assert.equal(lines.length, 6);
  assert.deepEqual(lines.map(l => l.mine), [false, true, true, false, true, false]);
  assert.equal(lines[0].wer, "Fahrerin");
  assert.equal(lines[1].wer, "Du");
  assert.equal(lines[0].umschrift, "sà-wàt-dii khâ. pai nǎi khá?");
  assert.equal(lines[0].audio, "audio/dialoge/taxi-einsteigen-1.m4a");
});

test("Rollenwechsel: Aod spricht die Fahrerin mit khráp", () => {
  const lines = dialogLines(taxi, true);
  assert.deepEqual(lines.map(l => l.mine), [true, false, false, true, false, true]);
  assert.equal(lines[0].wer, "Du (Fahrerin)");
  assert.equal(lines[1].wer, "Fahrgast");
  assert.equal(lines[0].umschrift, "sà-wàt-dii khráp. pai nǎi khráp?");
  assert.equal(lines[0].thai, "สวัสดีครับ ไปไหนครับ");
  assert.equal(lines[0].audio, "audio/dialoge/taxi-einsteigen-1-khrap.m4a");
  // Der Fahrgast bleibt unverändert
  assert.equal(lines[1].umschrift, taxi.saetze[1].umschrift);
});

test("Jeder Satz der anderen Person mit khâ/khá hat eine khráp-Tondatei", () => {
  const files = audioFiles(dialogs).map(f => f.file);
  const lineCount = dialogs.reduce((n, d) => n + d.saetze.length, 0);
  const khrapCount = dialogs.reduce((n, d) => n + d.saetze.filter(needsKhrap).length, 0);
  assert.equal(files.length, lineCount + khrapCount);
  assert.equal(new Set(files).size, files.length);
  for (const dialog of dialogs) {
    for (const swapped of [false, true]) {
      for (const line of dialogLines(dialog, swapped)) assert.ok(files.includes(line.audio), line.audio);
    }
  }
});

test("Alle Sätze der anderen Person enden auf khâ/khá, alle eigenen auf khráp", () => {
  for (const dialog of dialogs) {
    for (const swapped of [false, true]) {
      for (const line of dialogLines(dialog, swapped)) {
        if (line.mine) assert.match(line.umschrift, /khráp[.?!]?$/, line.umschrift);
        assert.doesNotMatch(line.mine ? line.thai : "", /ค่?ะ/, line.thai);
      }
    }
  }
});

test("Pause zum Nachsprechen", () => {
  assert.equal(repeatPauseMs(0), 2000);
  assert.equal(repeatPauseMs(2000), 3600);
});
