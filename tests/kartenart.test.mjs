// Tests für die Kartenart (Wort, Satz, Verstehen) und die Auswahl "Karten:". Aufruf: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cardsOfKind, validKind, CHOICES } from "../js/kartenart.js";
import { buildRound, unseenCards, practiceRound } from "../js/leitner.js";

const cards = JSON.parse(readFileSync(new URL("../inhalte/vokabeln.json", import.meta.url), "utf8"));

test("Jede Karte hat eine Art: wort, satz oder hoeren", () => {
  for (const card of cards) assert.ok(["wort", "satz", "hoeren"].includes(card.art), card.id);
  // Sätze, die andere zu einem sagen
  for (const id of ["taxi-pai-nai", "hotel-wie-viele-naechte", "verstehen-verstehst-du"]) {
    assert.equal(cards.find(c => c.id === id).art, "hoeren", id);
  }
});

test("Filter: nur Karten der gewählten Art, bei Alle alle", () => {
  assert.equal(cardsOfKind(cards, "alle").length, cards.length);
  for (const kind of ["wort", "satz", "hoeren"]) {
    const some = cardsOfKind(cards, kind);
    assert.ok(some.length > 0);
    assert.ok(some.every(card => card.art === kind));
  }
  assert.equal(validKind("quatsch"), "alle");
  assert.deepEqual(CHOICES, ["alle", "wort", "satz", "hoeren"]);
});

test("Alle: innerhalb eines Themas erst Wörter, dann Sätze, dann Verstehen", () => {
  const sorted = cardsOfKind(cards, "alle");
  const rank = { wort: 0, satz: 1, hoeren: 2 };
  for (const theme of new Set(cards.map(c => c.thema))) {
    const ranks = sorted.filter(c => c.thema === theme).map(c => rank[c.art]);
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), theme);
  }
  // Taxi: die ersten neuen Karten sind Wörter
  const taxi = unseenCards(sorted, {}, "Taxi").slice(0, 5);
  assert.ok(taxi.every(c => c.art === "wort"), taxi.map(c => c.id).join());
});

test("Lernrunde und Frei üben enthalten nur Karten der gewählten Art, auch fällige", () => {
  const states = {
    "zahl-1": { box: 1, due: "2026-10-01" },              // Wort, fällig
    "gruss-hallo": { box: 1, due: "2026-10-01" },         // Satz, fällig
    "taxi-pai-nai": { box: 1, due: "2026-10-01" },        // Verstehen, fällig
  };
  const words = buildRound(cardsOfKind(cards, "wort"), states, "2026-10-29");
  assert.ok(words.some(c => c.id === "zahl-1"));
  assert.ok(words.every(c => c.art === "wort"));
  const listen = buildRound(cardsOfKind(cards, "hoeren"), states, "2026-10-29");
  assert.deepEqual(listen.map(c => c.id).slice(0, 1), ["taxi-pai-nai"]);
  assert.ok(practiceRound(cardsOfKind(cards, "satz")).every(c => c.art === "satz"));
});
