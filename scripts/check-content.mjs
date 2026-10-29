// Prüfskript für inhalte/vokabeln.json, inhalte/toene.json und inhalte/dialoge.json
// Aufruf im Terminal (im Ordner thai-app):  node scripts/check-content.mjs
// Es meldet jede Karte, bei der etwas fehlt oder falsch ist.

import { readFileSync, existsSync } from "node:fs";
import { toneOf, withoutTone } from "../js/tones.js";
import { audioFiles, womanAudioFiles } from "../js/dialoge.js";
import { exampleAudioFiles, toneAudioFiles, womanCardAudioFiles } from "../js/audio-files.js";
import { matchingParticles, meansHair, profileCards, MANN } from "../js/profil.js";

const file = new URL("../inhalte/vokabeln.json", import.meta.url);
const cards = JSON.parse(readFileSync(file, "utf8"));

// Diese Felder darf das Feld "frau" (eigene Texte für das Profil Frau) enthalten
const frauFields = ["umschrift", "thai", "deutsch", "englisch", "merkhilfe", "merkhilfe_en", "beispiel", "beispiel_en", "beispiel_thai", "beispiel_thai_en"];

// Erlaubte Werte im Feld "art"
const KINDS = ["wort", "satz", "hoeren"];

// Diese Felder muss jede Karte haben
const requiredFields = ["id", "einheit", "thema", "umschrift", "thai", "deutsch", "merkhilfe", "englisch", "merkhilfe_en"];
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
  for (const field of ["umschrift", "deutsch", "merkhilfe", "beispiel", "englisch", "merkhilfe_en", "beispiel_en"]) {
    if (card[field] && thaiLetters.test(card[field])) {
      errors.push(`${name}: Feld "${field}" enthält Thai-Schrift`);
    }
  }

  // Beispielsatz: der Thai-Teil in Thai-Schrift, nur zum Vorlesen (Tondatei audio/beispiele/<id>.m4a)
  if ((card.beispiel || card.beispiel_en) && !card.beispiel_thai) {
    errors.push(`${name}: hat ein Beispiel, aber kein Feld "beispiel_thai"`);
  }
  for (const field of ["beispiel_thai", "beispiel_thai_en"]) {
    if (field in card && (typeof card[field] !== "string" || !thaiLetters.test(card[field]))) {
      errors.push(`${name}: Feld "${field}" enthält keine Thai-Schrift`);
    }
  }

  // Art der Karte: "wort" (Wort oder kurze Wendung), "satz" (Satz, den man selbst sagt)
  // oder "hoeren" (Satz, den andere zu einem sagen)
  if (!KINDS.includes(card.art)) errors.push(`${name}: Feld "art" muss ${KINDS.join(", ")} sein`);

  if ("aufpassen" in card && typeof card.aufpassen !== "boolean") {
    errors.push(`${name}: "aufpassen" muss true oder false sein`);
  }

  // Profil Frau (js/profil.js): khráp/ครับ und phǒm/ผม müssen in Umschrift und Thai-Text gleich oft
  // vorkommen, sonst lässt sich der Thai-Text nicht umstellen. Merkhilfen, die "ich (Mann)" erklären,
  // brauchen eine eigene Fassung für Frauen im Feld "frau".
  const frau = card.frau || {};
  if ("frau" in card && (typeof card.frau !== "object" || Object.keys(card.frau).some(key => !frauFields.includes(key)))) {
    errors.push(`${name}: Feld "frau" darf nur ${frauFields.join(", ")} enthalten`);
  }
  if (!meansHair(card)) {
    if (card.umschrift && card.thai && !frau.thai && !matchingParticles(card.umschrift, card.thai)) {
      errors.push(`${name}: khráp/phǒm in "umschrift" und ครับ/ผม in "thai" kommen nicht gleich oft vor`);
    }
    const example = (card.beispiel || card.beispiel_en || "").split(" = ")[0];
    if (card.beispiel_thai && !matchingParticles(example, card.beispiel_thai)) {
      errors.push(`${name}: khráp/phǒm im Beispiel und ครับ/ผม in "beispiel_thai" kommen nicht gleich oft vor`);
    }
    if (card.beispiel_thai_en && !matchingParticles((card.beispiel_en || "").split(" = ")[0], card.beispiel_thai_en)) {
      errors.push(`${name}: khráp/phǒm in "beispiel_en" und ครับ/ผม in "beispiel_thai_en" kommen nicht gleich oft vor`);
    }
    for (const field of ["merkhilfe", "merkhilfe_en", "deutsch", "englisch"]) {
      if (card[field] && /phǒm|\bMann\b|\ba man\b|\(man\)/.test(card[field].normalize("NFC")) && !frau[field]) {
        errors.push(`${name}: "${field}" spricht vom Mann (phǒm/Mann), es fehlt "frau": { "${field}": … }`);
      }
    }
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
    for (const field of ["umschrift", "thai", "deutsch", "englisch"]) {
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
  for (const field of ["id", "thema", "titel", "einheit", "titel_en"]) {
    if (typeof dialog[field] !== "string" || dialog[field].trim() === "") errors.push(`${name}: Feld "${field}" fehlt oder ist leer`);
  }
  if (dialog.id) {
    if (dialogIds.has(dialog.id)) errors.push(`${name}: id kommt doppelt vor`);
    dialogIds.add(dialog.id);
  }
  if (!dialog.rollen || !dialog.rollen.ich || !dialog.rollen.gegenueber) {
    errors.push(`${name}: "rollen" braucht "ich" und "gegenueber"`);
  }
  if (!dialog.rollen_en || !dialog.rollen_en.ich || !dialog.rollen_en.gegenueber) {
    errors.push(`${name}: "rollen_en" braucht "ich" und "gegenueber"`);
  }
  const lines = Array.isArray(dialog.saetze) ? dialog.saetze : [];
  if (lines.length < 2) errors.push(`${name}: braucht mindestens 2 Sätze`);
  lines.forEach((line, i) => {
    dialogLineCount++;
    const where = `${name}, Satz ${i + 1}`;
    if (line.wer !== "ich" && line.wer !== "gegenueber") errors.push(`${where}: "wer" muss "ich" oder "gegenueber" sein`);
    for (const field of ["umschrift", "thai", "deutsch", "englisch"]) {
      if (typeof line[field] !== "string" || line[field].trim() === "") errors.push(`${where}: Feld "${field}" fehlt oder ist leer`);
    }
    if (line.thai && !thaiLetters.test(line.thai)) errors.push(`${where}: Feld "thai" enthält keine Thai-Schrift`);
    if (line.umschrift && line.thai && !matchingParticles(line.umschrift, line.thai)) {
      errors.push(`${where}: khráp/phǒm in "umschrift" und ครับ/ผม in "thai" kommen nicht gleich oft vor (Profil Frau)`);
    }
    for (const field of ["umschrift", "deutsch", "englisch"]) {
      if (line[field] && thaiLetters.test(line[field])) errors.push(`${where}: Feld "${field}" enthält Thai-Schrift`);
    }
  });
  for (const field of ["titel", "thema"]) {
    if (dialog[field] && thaiLetters.test(dialog[field])) errors.push(`${name}: Feld "${field}" enthält Thai-Schrift`);
  }
});

// Bereiche (inhalte/bereiche.json): jedes Thema der Karten steht in genau einem Bereich
const areaFile = new URL("../inhalte/bereiche.json", import.meta.url);
const areas = JSON.parse(readFileSync(areaFile, "utf8"));
const areaIds = new Set();
for (const area of areas) {
  for (const field of ["id", "name", "emoji", "name_en"]) {
    if (typeof area[field] !== "string" || area[field].trim() === "") errors.push(`bereiche.json: Feld "${field}" fehlt oder ist leer`);
  }
  if (areaIds.has(area.id)) errors.push(`bereiche.json: id "${area.id}" kommt doppelt vor`);
  areaIds.add(area.id);
  if (!Array.isArray(area.themen) || area.themen.length === 0) errors.push(`bereiche.json, ${area.id}: "themen" fehlt oder ist leer`);
}
for (const theme of new Set(cards.map(card => card.thema))) {
  const count = areas.filter(area => (area.themen || []).includes(theme)).length;
  if (count !== 1) errors.push(`Thema "${theme}" steht in ${count} Bereichen (muss genau 1 sein)`);
  if (!areas.some(area => area.themen_en && area.themen_en[theme])) errors.push(`Thema "${theme}" hat keinen englischen Namen (bereiche.json, "themen_en")`);
}

// Tondateien zum Vorlesen und für die Ton-Kurve: fehlende sind kein Fehler, nur ein Hinweis
const missingAudio = cards.filter(card => card.id && !existsSync(new URL(`../audio/${card.id}.m4a`, import.meta.url)));

if (errors.length > 0) {
  console.log(`❌ ${errors.length} Fehler gefunden:`);
  for (const error of errors) console.log("  - " + error);
  process.exit(1);
} else {
  console.log(`✅ Alle ${cards.length} Karten in ${areas.length} Bereichen, ${toneWords} Wörter für "Töne hören" und ${dialogs.length} Dialoge (${dialogLineCount} Sätze) sind in Ordnung.`);
}

if (missingAudio.length > 0) {
  console.log(`ℹ️  ${missingAudio.length} Karten ohne Tondatei für die Ton-Kurve (${missingAudio.map(c => c.id).join(", ")}).`);
  console.log("   Auf dem Mac nachholen mit:  zsh scripts/make-audio.sh");
}

const missingOtherAudio = [...exampleAudioFiles(cards), ...toneAudioFiles(groups)]
  .filter(({ file }) => !existsSync(new URL(`../${file}`, import.meta.url)));
if (missingOtherAudio.length > 0) {
  console.log(`ℹ️  ${missingOtherAudio.length} Beispielsätze oder Wörter für "Töne hören" ohne Tondatei (${missingOtherAudio.map(f => f.file).join(", ")}).`);
  console.log("   Auf dem Mac nachholen mit:  zsh scripts/make-audio.sh");
}

const missingDialogAudio = audioFiles(dialogs).filter(({ file }) => !existsSync(new URL(`../${file}`, import.meta.url)));
if (missingDialogAudio.length > 0) {
  console.log(`ℹ️  ${missingDialogAudio.length} Dialog-Sätze ohne Tondatei (die App liest sie dann mit der Thai-Stimme des Geräts vor).`);
  console.log("   Auf dem Mac nachholen mit:  zsh scripts/make-audio.sh");
}

const womanCards = profileCards(cards, { ...MANN, geschlecht: "frau" });
const missingWomanAudio = [...womanCardAudioFiles(womanCards), ...exampleAudioFiles(womanCards), ...womanAudioFiles(dialogs)]
  .filter(({ file }) => !existsSync(new URL(`../${file}`, import.meta.url)));
if (missingWomanAudio.length > 0) {
  console.log(`ℹ️  ${missingWomanAudio.length} Sätze für das Profil Frau ohne Tondatei (die App liest sie dann mit der Thai-Stimme des Geräts vor).`);
  console.log("   Auf dem Mac nachholen mit:  zsh scripts/make-audio.sh");
}
