// Tests für die Sprachwahl (Deutsch/Englisch). Aufruf: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { t, useLanguage, localizeCards, localizeAreas, themeName, localizeDialogs } from "../js/sprache.js";

test("Deutsch: Text bleibt, Platzhalter werden ersetzt", () => {
  useLanguage("de");
  assert.equal(t("noch {n} von {total}", { n: 3, total: 10 }), "noch 3 von 10");
});

test("Englisch: Übersetzung mit Platzhaltern", () => {
  useLanguage("en");
  assert.equal(t("noch {n} von {total}", { n: 3, total: 10 }), "3 of 10 left");
  assert.equal(t("Lernrunde starten"), "Start round");
  useLanguage("de");
});

test("Englisch: ohne Übersetzung bleibt der deutsche Text", () => {
  useLanguage("en");
  assert.equal(t("Gibt es nicht"), "Gibt es nicht");
  useLanguage("de");
});

test("Karten: englische Felder auf Englisch, sonst die deutschen", () => {
  const card = { id: "x", deutsch: "teuer", merkhilfe: "M", beispiel: "B", englisch: "expensive", merkhilfe_en: "M-en" };
  useLanguage("en");
  const [en] = localizeCards([card]);
  assert.equal(en.deutsch, "expensive");
  assert.equal(en.merkhilfe, "M-en");
  assert.equal(en.beispiel, "B");   // kein beispiel_en: deutsches Beispiel bleibt
  useLanguage("de");
  assert.equal(localizeCards([card])[0].deutsch, "teuer");
});

test("Themen und Bereiche: englische Namen, Schlüssel bleibt deutsch", () => {
  const areas = [{ id: "a", name: "Essen & Einkaufen", name_en: "Food & shopping", themen: ["Markt"], themen_en: { Markt: "Market" } }];
  useLanguage("en");
  const [area] = localizeAreas(areas);
  assert.equal(area.name, "Food & shopping");
  assert.deepEqual(area.themen, ["Markt"]);
  assert.equal(themeName("Markt"), "Market");
  useLanguage("de");
  localizeAreas(areas);
  assert.equal(themeName("Markt"), "Markt");
});

test("Dialoge: Titel, Rollen und Sätze auf Englisch", () => {
  const dialog = { id: "d", titel: "Markt", titel_en: "Market", rollen: { ich: "Kunde", gegenueber: "Verkäuferin" },
    rollen_en: { ich: "Customer", gegenueber: "Seller" }, saetze: [{ wer: "ich", deutsch: "Hallo", englisch: "Hello" }] };
  useLanguage("en");
  const [en] = localizeDialogs([dialog]);
  assert.equal(en.titel, "Market");
  assert.equal(en.rollen.gegenueber, "Seller");
  assert.equal(en.saetze[0].deutsch, "Hello");
  useLanguage("de");
});
