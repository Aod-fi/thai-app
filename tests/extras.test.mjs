// Tests für Hörübung und Statistik. Aufruf: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { listenQuiz, themeStats, dueForecast, searchKey, matchesSearch, todayText } from "../js/extras.js";
import { useLanguage } from "../js/sprache.js";

const today = "2026-10-22";

// Karten mit Thema, z. B. themed("Taxi", 3) = Taxi1, Taxi2, Taxi3
function themed(thema, n) {
  return Array.from({ length: n }, (_, i) => ({ id: `${thema}${i + 1}`, thema, deutsch: `${thema}-Wort ${i + 1}` }));
}

test("Hörübung: höchstens 10 Fragen mit je 4 verschiedenen Antworten", () => {
  const quiz = listenQuiz([...themed("Taxi", 8), ...themed("Essen", 8)], {});
  assert.equal(quiz.length, 10);
  for (const question of quiz) {
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options).size, 4);
    assert.ok(question.options.includes(question.card.deutsch));
  }
});

test("Hörübung: falsche Antworten möglichst aus demselben Thema", () => {
  const quiz = listenQuiz([...themed("Taxi", 5), ...themed("Essen", 5)], {}, "Taxi");
  for (const question of quiz) {
    assert.ok(question.options.every(option => option.startsWith("Taxi")));
  }
});

test("Hörübung: ab 4 gelernten Karten nur gelernte", () => {
  const cards = themed("Taxi", 8);
  const states = {};
  for (let i = 1; i <= 4; i++) states[`Taxi${i}`] = { box: 1, due: today };
  const quiz = listenQuiz(cards, states);
  assert.equal(quiz.length, 4);
  assert.ok(quiz.every(question => states[question.card.id]));
});

test("Statistik pro Thema: gelernt und sicher (ab Fach 4)", () => {
  const cards = [...themed("Taxi", 3), ...themed("Essen", 2)];
  const states = { Taxi1: { box: 1, due: today }, Taxi2: { box: 4, due: today } };
  assert.deepEqual(themeStats(cards, states), [
    { theme: "Taxi", total: 3, learned: 2, sure: 1 },
    { theme: "Essen", total: 2, learned: 0, sure: 0 },
  ]);
});

test("Vorschau: heute zählt Überfälliges mit", () => {
  const states = { Taxi1: { box: 1, due: "2026-10-20" }, Taxi2: { box: 2, due: "2026-10-23" } };
  const forecast = dueForecast(themed("Taxi", 2), states, today, 3);
  assert.deepEqual(forecast.map(f => f.count), [1, 1, 0]);
});

test("Hörübung: eine gleich klingende Karte ist nie eine falsche Antwort", () => {
  const cards = [
    { id: "markt-nein", thema: "Markt", thai: "ไม่เอาครับ", deutsch: "Nein, nehme ich nicht" },
    { id: "essen-nein", thema: "Essen", thai: "ไม่เอาครับ", deutsch: "Ich möchte nicht" },
    ...themed("Taxi", 6),
  ];
  for (let run = 0; run < 20; run++) {
    for (const { card, options } of listenQuiz(cards, {})) {
      const twin = cards.find(c => c !== card && c.thai && c.thai === card.thai);
      if (twin) assert.ok(!options.includes(twin.deutsch));
    }
  }
});

test("Suche: ohne Tonzeichen, Lautschrift-Buchstaben, Sonderzeichen und doppelte Buchstaben", () => {
  assert.equal(searchKey("khâo-jai"), "khaojai");
  assert.equal(searchKey("phɛɛng"), "pheng");
  assert.equal(searchKey("khɔ̀ɔp-khun"), "khopkhun");
  assert.equal(searchKey("chʉ̂ʉ"), "chu");
  assert.equal(searchKey("pə̀ət"), "pet");
  assert.equal(searchKey("Kein Problem!"), "keinproblem");
});

test("Suche: in Deutsch, Englisch und Umschrift, leer = alle", () => {
  const card = { umschrift: "khɔ̀ɔp-khun khráp", deutsch: "Danke", englisch: "Thank you" };
  assert.ok(matchesSearch(card, ""));
  assert.ok(matchesSearch(card, "  "));
  assert.ok(matchesSearch(card, "danke"));
  assert.ok(matchesSearch(card, "THANK"));
  assert.ok(matchesSearch(card, "khoop khun"));
  assert.ok(matchesSearch(card, "khop khun"));
  assert.ok(matchesSearch(card, "khrap"));
  assert.ok(!matchesSearch(card, "teuer"));
});

test("Startzahl: Wiederholungen und neue getrennt, Einzahl beachtet", () => {
  const states = { a: { box: 1, due: today }, b: { box: 2, due: today } };
  const card = id => ({ id });
  useLanguage("de");
  assert.equal(todayText([card("a"), card("b"), card("x"), card("y"), card("z")], states), "Heute: 2 Wiederholungen + 3 neue");
  assert.equal(todayText([card("a"), card("x")], states), "Heute: 1 Wiederholung + 1 neue");
  assert.equal(todayText([card("a")], states), "Heute: 1 Wiederholung");
  assert.equal(todayText([card("x"), card("y")], states), "Heute: 2 neue");
  assert.equal(todayText([], states), "Heute: nichts fällig");
  useLanguage("en");
  assert.equal(todayText([card("a"), card("b"), card("x")], states), "Today: 2 reviews + 1 new");
  assert.equal(todayText([card("a")], states), "Today: 1 review");
  useLanguage("de");
});
