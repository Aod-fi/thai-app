// Tests für die Leitner-Logik.
// Aufruf im Terminal (im Ordner thai-app):  npm test
// Jeder Test beschreibt in einem Satz, was er prüft.

import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, rateCard, buildRound, countByBox, unseenCards, streak } from "../js/leitner.js";

const today = "2026-10-19";

test("addDays rechnet über das Monatsende", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
});

test("Neue Karte und Gewusst: Fach 2, wiederkommen in 2 Tagen", () => {
  assert.deepEqual(rateCard(null, "gewusst", false, today), { box: 2, due: "2026-10-21" });
});

test("Gewusst schiebt ein Fach weiter", () => {
  const state = { box: 3, due: today };
  assert.deepEqual(rateCard(state, "gewusst", false, today), { box: 4, due: "2026-10-27" });
});

test("Fach 5 ist das höchste Fach", () => {
  const state = { box: 5, due: today };
  assert.deepEqual(rateCard(state, "gewusst", false, today), { box: 5, due: "2026-11-04" });
});

test("Schwer: Fach bleibt gleich", () => {
  const state = { box: 3, due: today };
  assert.deepEqual(rateCard(state, "schwer", false, today), { box: 3, due: "2026-10-23" });
});

test("Nochmal: zurück in Fach 1 und heute noch einmal", () => {
  const state = { box: 4, due: today };
  assert.deepEqual(rateCard(state, "nochmal", false, today), { box: 1, due: today });
});

test("Aufpassen-Karten bekommen den Abstand des Fachs darunter", () => {
  const state = { box: 3, due: today };
  // normal wäre Fach 4 = 8 Tage, mit aufpassen nur 4 Tage
  assert.deepEqual(rateCard(state, "gewusst", true, today), { box: 4, due: "2026-10-23" });
});

// Hilfsfunktion: erzeugt n Karten mit den ids k1, k2, ...
function makeCards(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `k${i + 1}` }));
}

test("Runde: höchstens 5 neue Karten pro Tag", () => {
  const round = buildRound(makeCards(30), {}, today);
  assert.equal(round.length, 5);
});

test("Runde: neue Karten zählen über den Tag zusammen", () => {
  const round = buildRound(makeCards(30), {}, today, 3);
  assert.equal(round.length, 2);
});

test("Runde: nach \"5 weitere neue Karten\" kommen 5 neue dazu", () => {
  const round = buildRound(makeCards(30), {}, today, 5, 10);
  assert.equal(round.length, 5);
});

// Karten mit Thema, z. B. themed("Zahlen", 3) = z1, z2, z3
function themed(thema, n) {
  return Array.from({ length: n }, (_, i) => ({ id: `${thema}${i + 1}`, thema }));
}

test("Neue Karten kommen reihum aus den Themen", () => {
  const cards = [...themed("Markt", 2), ...themed("Zahlen", 4), ...themed("Taxi", 1)];
  const round = buildRound(cards, {}, today);
  assert.deepEqual(round.map(c => c.id), ["Markt1", "Zahlen1", "Taxi1", "Markt2", "Zahlen2"]);
});

test("Fokus-Thema: neue Karten nur aus diesem Thema", () => {
  const cards = [...themed("Zahlen", 6), ...themed("Taxi", 3)];
  const round = buildRound(cards, {}, today, 0, 5, "Taxi");
  assert.deepEqual(round.map(c => c.id), ["Taxi1", "Taxi2", "Taxi3"]);
});

test("Fokus-Thema: Wiederholungen kommen trotzdem aus allen Themen", () => {
  const cards = [...themed("Zahlen", 2), ...themed("Taxi", 2)];
  const states = { Zahlen1: { box: 1, due: today } };
  const round = buildRound(cards, states, today, 0, 5, "Taxi");
  assert.deepEqual(round.map(c => c.id), ["Zahlen1", "Taxi1", "Taxi2"]);
});

test("unseenCards zählt nur ungelernte Karten des Fokus-Themas", () => {
  const cards = [...themed("Zahlen", 2), ...themed("Taxi", 2)];
  const states = { Taxi1: { box: 1, due: today } };
  assert.equal(unseenCards(cards, states, "Taxi").length, 1);
  assert.equal(unseenCards(cards, states).length, 3);
});

test("Runde: höchstens 20 Karten, fällige zuerst", () => {
  const cards = makeCards(30);
  const states = {};
  for (let i = 1; i <= 25; i++) states[`k${i}`] = { box: 1, due: today };
  const round = buildRound(cards, states, today);
  assert.equal(round.length, 20);
  assert.ok(round.every(card => states[card.id]));
});

test("Runde: Karten, die erst morgen fällig sind, kommen nicht dran", () => {
  const states = { k1: { box: 2, due: "2026-10-20" } };
  const round = buildRound(makeCards(1), states, today);
  assert.equal(round.length, 0);
});

test("countByBox zählt neue Karten und Fächer", () => {
  const states = { k1: { box: 1, due: today }, k2: { box: 3, due: today } };
  assert.deepEqual(countByBox(makeCards(3), states), [1, 1, 0, 1, 0, 0]);
});

test("Lerntage in Folge, auch wenn heute noch nicht gelernt wurde", () => {
  assert.equal(streak(["2026-10-17", "2026-10-18", "2026-10-19"], today), 3);
  assert.equal(streak(["2026-10-17", "2026-10-18"], today), 2);
  assert.equal(streak(["2026-10-15"], today), 0);
});
