// Tests für Zahlen und Preise. Aufruf: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { numberToThai, makeTask, numberRound, checkNumberAnswer, ROUND_SIZE } from "../js/numbers.js";

test("Die erzeugten Zahlen stimmen mit den Vokabelkarten überein", () => {
  const cards = JSON.parse(readFileSync(new URL("../inhalte/vokabeln.json", import.meta.url), "utf8"));
  const numberCards = cards.filter(card => card.thema === "Zahlen" || card.thema === "Preise");
  assert.ok(numberCards.length > 20);
  for (const card of numberCards) {
    const number = Number(card.deutsch.replace(" Baht", ""));
    const expected = makeTask(number, card.deutsch.endsWith("Baht"));
    assert.equal(expected.thai, card.thai, card.deutsch);
    assert.equal(expected.umschrift, card.umschrift, card.deutsch);
  }
});

test("Sonderfälle: 11, 21, 101, 1000, 1250", () => {
  assert.equal(numberToThai(11).umschrift, "sìp-èt");
  assert.equal(numberToThai(21).thai, "ยี่สิบเอ็ด");
  assert.equal(numberToThai(110).umschrift, "nʉ̀ng rɔ́ɔi sìp");
  assert.equal(numberToThai(1000).umschrift, "nʉ̀ng phan");
  assert.equal(numberToThai(1250).umschrift, "nʉ̀ng phan sɔ̌ɔng rɔ́ɔi hâa-sìp");
});

test("Runde: 10 verschiedene Aufgaben im Bereich der Stufe", () => {
  for (const level of [1, 2, 3]) {
    const round = numberRound(level);
    assert.equal(round.length, ROUND_SIZE);
    assert.equal(new Set(round.map(t => t.number)).size, ROUND_SIZE);
  }
  assert.ok(numberRound(1).every(t => t.number >= 1 && t.number <= 10));
  assert.ok(numberRound(3).every(t => t.number % 10 === 0 && t.umschrift.endsWith("bàat")));
});

test("Eingabe prüfen: Punkte und Baht werden ignoriert", () => {
  const task = makeTask(1000, true);
  assert.equal(checkNumberAnswer(task, "1.000"), true);
  assert.equal(checkNumberAnswer(task, "1000 Baht"), true);
  assert.equal(checkNumberAnswer(task, "100"), false);
  assert.equal(checkNumberAnswer(task, ""), false);
});
