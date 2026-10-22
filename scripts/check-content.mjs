// Prüfskript für inhalte/vokabeln.json, inhalte/toene.json und inhalte/dialoge.json
// Aufruf im Terminal (im Ordner thai-app):  node scripts/check-content.mjs
// Es meldet jede Karte, bei der etwas fehlt oder falsch ist.

import { readFileSync, existsSync } from "node:fs";
import { toneOf, withoutTone } from "../js/tones.js";
import { audioFiles } from "../js/dialoge.js";

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

// Töne hören: jede Gruppe hat 2 bis 4 Wörter, die gleich geschrieben sind bis auf
// das Tonzeichen, und jedes Wort hat einen anderen Ton
const toneFile = new URL("../inhalte/toene.json", import.meta.url);
const groups = JSON.parse(readFileSync(toneFile, "utf8"));
let toneWords = 0;
groups.forEach((group, index) => {
  const name = `toene.json, Gruppe ${group.gruppe || index + 1}`;
  const words = Array.isArray(group.woerter) ? group.woerter : [];
  if (words.length < 2 || words.length > 4) errors.push(`${name}: braucht 2 bis 4 Wörter`);
  for (const word of words) {
    toneWords++;
    for (const field of ["umschrift", "thai", "deutsch"]) {
      if (typeof word[field] !== "string" || word[field].trim() === "") {
        errors.push(`${name}: Wort "${word.umschrift}": Feld "${field}" fehlt oder ist leer`);
      }
    }
    if (word.thai && !thaiLetters.test(word.thai)) errors.push(`${name}: "${word.umschrift}" ohne Thai-Schrift`);
    for (const field of ["umschrift", "deutsch"]) {
      if (word[field] && thaiLetters.test(word[field])) errors.push(`${name}: "${word.umschrift}": Feld "${field}" enthält Thai-Schrift`);
    }
  }
  const bases = new Set(words.map(w => withoutTone(w.umschrift || "")));
  if (bases.size > 1) errors.push(`${name}: Wörter unterscheiden sich nicht nur im Ton (${[...bases].join(", ")})`);
  const tones = words.map(w => toneOf(w.umschrift || ""));
  if (new Set(tones).size !== tones.length) errors.push(`${name}: zwei Wörter haben denselben Ton`);
});

// Dialoge: Pflichtfelder, eindeutige ids, "wer" ist "ich" oder "gegenueber",
// keine Thai-Schrift außer im Feld "thai"
const dialogFile = new URL("../inhalte/dialoge.json", import.meta.url);
const dialogs = JSON.parse(readFileSync(dialogFile, "utf8"));
const dialogIds = new Set();
let dialogLineCount = 0;
dialogs.forEach((dialog, index) => {
  const name = `dialoge.json, ${dialog.id || `Dialog Nr. ${index + 1}`}`;
  for (const field of ["id", "thema", "titel", "einheit"]) {
    if (typeof dialog[field] !== "string" || dialog[field].trim() === "") errors.push(`${name}: Feld "${field}" fehlt oder ist leer`);
  }
  if (dialog.id) {
    if (dialogIds.has(dialog.id)) errors.push(`${name}: id kommt doppelt vor`);
    dialogIds.add(dialog.id);
  }
  if (!dialog.rollen || !dialog.rollen.ich || !dialog.rollen.gegenueber) {
    errors.push(`${name}: "rollen" braucht "ich" und "gegenueber"`);
  }
  const lines = Array.isArray(dialog.saetze) ? dialog.saetze : [];
  if (lines.length < 2) errors.push(`${name}: braucht mindestens 2 Sätze`);
  lines.forEach((line, i) => {
    dialogLineCount++;
    const where = `${name}, Satz ${i + 1}`;
    if (line.wer !== "ich" && line.wer !== "gegenueber") errors.push(`${where}: "wer" muss "ich" oder "gegenueber" sein`);
    for (const field of ["umschrift", "thai", "deutsch"]) {
      if (typeof line[field] !== "string" || line[field].trim() === "") errors.push(`${where}: Feld "${field}" fehlt oder ist leer`);
    }
    if (line.thai && !thaiLetters.test(line.thai)) errors.push(`${where}: Feld "thai" enthält keine Thai-Schrift`);
    for (const field of ["umschrift", "deutsch"]) {
      if (line[field] && thaiLetters.test(line[field])) errors.push(`${where}: Feld "${field}" enthält Thai-Schrift`);
    }
  });
  for (const field of ["titel", "thema"]) {
    if (dialog[field] && thaiLetters.test(dialog[field])) errors.push(`${name}: Feld "${field}" enthält Thai-Schrift`);
  }
});

// Tondateien für die Ton-Kurve: fehlende sind kein Fehler, nur ein Hinweis
const missingAudio = cards.filter(card => card.id && !existsSync(new URL(`../audio/${card.id}.m4a`, import.meta.url)));

if (errors.length > 0) {
  console.log(`❌ ${errors.length} Fehler gefunden:`);
  for (const error of errors) console.log("  - " + error);
  process.exit(1);
} else {
  console.log(`✅ Alle ${cards.length} Karten, ${toneWords} Wörter für "Töne hören" und ${dialogs.length} Dialoge (${dialogLineCount} Sätze) sind in Ordnung.`);
}

if (missingAudio.length > 0) {
  console.log(`ℹ️  ${missingAudio.length} Karten ohne Tondatei für die Ton-Kurve (${missingAudio.map(c => c.id).join(", ")}).`);
  console.log("   Auf dem Mac nachholen mit:  zsh scripts/make-audio.sh");
}

const missingDialogAudio = audioFiles(dialogs).filter(({ file }) => !existsSync(new URL(`../${file}`, import.meta.url)));
if (missingDialogAudio.length > 0) {
  console.log(`ℹ️  ${missingDialogAudio.length} Dialog-Sätze ohne Tondatei (die App liest sie dann mit der Thai-Stimme des Geräts vor).`);
  console.log("   Auf dem Mac nachholen mit:  zsh scripts/make-audio.sh");
}
