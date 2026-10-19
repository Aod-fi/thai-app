// Prüfskript für inhalte/vokabeln.json
// Aufruf im Terminal (im Ordner thai-app):  node scripts/check-content.mjs
// Es meldet jede Karte, bei der etwas fehlt oder falsch ist.

import { readFileSync } from "node:fs";

const file = new URL("../inhalte/vokabeln.json", import.meta.url);
const cards = JSON.parse(readFileSync(file, "utf8"));

// Diese Felder muss jede Karte haben
const requiredFields = ["id", "einheit", "thema", "umschrift", "thai", "deutsch", "merkhilfe"];
// Thai-Schrift liegt im Unicode-Bereich U+0E00 bis U+0E7F
const thaiLetters = /[฀-๿]/;

const errors = [];
const seenIds = new Set();

cards.forEach((card, index) => {
  const name = card.id || `Karte Nr. ${index + 1}`;

  for (const field of requiredFields) {
    if (typeof card[field] !== "string" || card[field].trim() === "") {
      errors.push(`${name}: Feld "${field}" fehlt oder ist leer`);
    }
  }

  if (card.id) {
    if (seenIds.has(card.id)) errors.push(`${name}: id kommt doppelt vor`);
    seenIds.add(card.id);
  }

  if (card.thai && !thaiLetters.test(card.thai)) {
    errors.push(`${name}: Feld "thai" enthält keine Thai-Schrift`);
  }

  // Die Umschrift darf keine Thai-Schrift enthalten, die soll man nie sehen
  for (const field of ["umschrift", "deutsch", "merkhilfe", "beispiel"]) {
    if (card[field] && thaiLetters.test(card[field])) {
      errors.push(`${name}: Feld "${field}" enthält Thai-Schrift`);
    }
  }

  if ("aufpassen" in card && typeof card.aufpassen !== "boolean") {
    errors.push(`${name}: "aufpassen" muss true oder false sein`);
  }
});

if (errors.length > 0) {
  console.log(`❌ ${errors.length} Fehler gefunden:`);
  for (const error of errors) console.log("  - " + error);
  process.exit(1);
} else {
  console.log(`✅ Alle ${cards.length} Karten sind in Ordnung.`);
}
