// Mein Profil: Name, Mann oder Frau, Alter. Bleibt nur auf dem Gerät (localStorage "mythai-profil").
// Hier steht auch, wie die Inhalte zum Profil passend gemacht werden:
//   - Frau: phǒm → chán, khráp → khâ (bei Fragen und Anreden khá), im Thai-Text ผม → ฉัน, ครับ → ค่ะ/คะ
//   - Name und Alter werden in die Karten "Ich heiße …" und "Ich bin … Jahre alt" und in den Dialog
//     "Sich vorstellen" eingesetzt. Diese Sätze liest dann die Stimme des Geräts (keine Tondatei).
// Nur Rechnen, keine Anzeige. Getestet in tests/profil.test.mjs.

import { numberToThai } from "./numbers.js";

const KEY = "mythai-profil-test";   // Testfassung: eigenes Profil

export const MANN = { name: "", geschlecht: "mann", alter: null };

export const MAX_NAME = 30;
export const MIN_ALTER = 1;
export const MAX_ALTER = 120;

// ---------- Speichern ----------

// Gespeichertes Profil, oder null, wenn noch keins angelegt wurde
export function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return saved && typeof saved === "object" ? cleanProfile(saved) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cleanProfile(profile)));
  } catch {
    // kein Speicher verfügbar: gilt dann nur bis zum Schließen
  }
}

// Nur erlaubte Werte: Name gekürzt, "mann" oder "frau", Alter 1 bis 120 oder null
export function cleanProfile(profile) {
  const alter = Number(profile.alter);
  return {
    name: typeof profile.name === "string" ? profile.name.trim().replace(/\s+/g, " ").slice(0, MAX_NAME) : "",
    geschlecht: profile.geschlecht === "frau" ? "frau" : "mann",
    alter: Number.isInteger(alter) && alter >= MIN_ALTER && alter <= MAX_ALTER ? alter : null,
  };
}

// Eingabe im Feld "Alter": leer = kein Alter, sonst eine ganze Zahl von 1 bis 120.
// Gibt { alter } zurück, bei einer falschen Eingabe { fehler: true }.
export function parseAge(input) {
  const text = String(input).trim();
  if (text === "") return { alter: null };
  if (!/^\d{1,3}$/.test(text)) return { fehler: true };
  const alter = Number(text);
  return alter >= MIN_ALTER && alter <= MAX_ALTER ? { alter } : { fehler: true };
}

// Erster Start: noch kein Profil und noch gar nichts gespeichert (kein Lernstand, keine Werte).
// Bestehende Nutzer haben immer schon etwas gespeichert und sehen die Seite deshalb nie von selbst.
export function isFirstStart(profile, saved) {
  return !profile && Object.keys(saved.progress).length === 0 && Object.keys(saved.meta).length === 0;
}

// ---------- Mann → Frau ----------

// khráp als eigenes Wort, phǒm als eigenes Wort
const KHRAP = /(^|[\s("„])khráp(?=[\s.?!,;:…)"“/]|$)/g;
const PHOM = /(^|[\s("„])phǒm(?=[\s.?!,;:…)"“/]|$)/g;
// Fragewörter: steht eins davon im selben Satzteil vor khráp, ist es eine Frage (khá)
const QUESTION_WORDS = ["mǎi", "mái", "rʉ̌ʉ", "nǎi", "à-rai", "arai", "tâo-rài", "mʉ̂a-rài", "yang-ngai", "yang ngai", "tham-mai", "thammai", "kìi", "khrai", "lâ"];
// Anreden: "nɔ́ɔng khráp!" ruft jemanden, das heißt bei Frauen nɔ́ɔng khá!
const CALLS = ["nɔ́ɔng", "phîi", "khun"];
// Ein Satzteil endet an . ! ? , ; – oder /
const CLAUSE_END = /[.!?,;–/]/;

// Ist dieses khráp eine Frage oder Anrede (khá) oder eine Aussage (khâ)?
//   before: Text vor khráp, after: Text danach
function isKha(before, after) {
  if (after.trimStart().startsWith("?")) return true;
  const parts = before.split(CLAUSE_END);
  const clause = parts[parts.length - 1].trim();
  const words = clause.split(/\s+/).filter(Boolean);
  if (words[words.length - 1] === "ná") return true;
  if (words.length === 1 && CALLS.includes(words[0])) return true;
  const padded = ` ${clause} `;
  return QUESTION_WORDS.some(word => padded.includes(` ${word} `));
}

// Für jedes khráp der Reihe nach: true = khá, false = khâ
export function khaPattern(umschrift) {
  const text = umschrift.normalize("NFC");
  const pattern = [];
  for (const match of text.matchAll(KHRAP)) {
    const at = match.index + match[1].length;
    pattern.push(isKha(text.slice(0, at), text.slice(at + "khráp".length)));
  }
  return pattern;
}

// Umschrift für Frauen, z. B. "phǒm maa jàak yəə-rá-man khráp" → "chán maa jàak yəə-rá-man khâ"
export function feminizeUmschrift(text) {
  const pattern = khaPattern(text);
  let i = 0;
  return text.normalize("NFC")
    .replace(KHRAP, (match, start) => start + (pattern[i++] ? "khá" : "khâ"))
    .replace(PHOM, "$1chán");
}

// Thai-Text für Frauen. Ob ครับ zu คะ (Frage) oder ค่ะ wird, steht in der Umschrift desselben Satzes.
// Passt die Anzahl nicht zusammen, bleibt der Text, wie er ist (check-content meldet das).
export function feminizeThai(thai, umschrift) {
  const pattern = khaPattern(umschrift);
  if (count(thai, /ครับ/g) !== pattern.length) return thai;
  let i = 0;
  return thai.replace(/ครับ/g, () => (pattern[i++] ? "คะ" : "ค่ะ")).replace(/ผม/g, "ฉัน");
}

const count = (text, regex) => (text.match(regex) || []).length;

// Stimmen Umschrift und Thai-Text zusammen (gleich viele khráp/ครับ und phǒm/ผม)?
// Für check-content und die Tests.
export function matchingParticles(umschrift, thai) {
  const text = umschrift.normalize("NFC");
  return count(text, KHRAP) === count(thai, /ครับ/g) && count(text, PHOM) === count(thai, /ผม/g);
}

// phǒm/ผม heißt auch "Haar". Solche Karten bleiben unverändert.
export function meansHair(card) {
  return /\bhaar|\bhair/i.test(`${card.deutsch || ""} ${card.englisch || ""}`);
}

// ---------- Karten ----------

export const NAME_CARD = "small-ich-heisse";
export const AGE_CARD = "small-alter";
// Name im Beispielsatz, wenn keiner eingetragen ist
const DEFAULT_NAMES = [{ umschrift: "Aod", thai: "อ๊อด" }, { umschrift: "Tom", thai: "ทอม" }];
// Für Frauen ohne eingetragenen Namen ein Frauenname (Kanya spricht ihn in der Tondatei)
const DEFAULT_WOMAN = { umschrift: "Anna", thai: "แอนนา" };
// Alter im Beispielsatz, wenn keins eingetragen ist
export const DEFAULT_AGE = 35;

// Felder einer Karte, die für Frauen umgestellt werden
const UMSCHRIFT_FIELDS = ["umschrift", "beispiel", "beispiel_en", "merkhilfe", "merkhilfe_en"];

// Setzt den Namen ein: ersetzt "Aod" bzw. "Tom" (Umschrift) und อ๊อด bzw. ทอม (Thai-Text)
function insertName(text, name) {
  let result = text;
  for (const old of DEFAULT_NAMES) {
    result = result.replaceAll(old.umschrift, name.umschrift).replaceAll(old.thai, name.thai);
  }
  return result;
}

// Name, der eingesetzt wird: eingetragener Name, für Frauen sonst "Anna", für Männer null (bleibt Aod/Tom)
function profileName(profile) {
  // Leerzeichen um den Namen, damit die Stimme des Geräts ihn als eigenes Wort liest
  if (profile.name) return { umschrift: profile.name, thai: ` ${profile.name} `, own: true };
  return profile.geschlecht === "frau" ? DEFAULT_WOMAN : null;
}

// Beispielsatz der Alter-Karte
export function ageExample(age) {
  const { thai, umschrift } = numberToThai(age);
  return {
    beispiel: `phǒm aa-yú ${umschrift} pii khráp = Ich bin ${age} Jahre alt`,
    beispiel_en: `phǒm aa-yú ${umschrift} pii khráp = I am ${age} years old`,
    beispiel_thai: `ผมอายุ${thai}ปีครับ`,
  };
}

// Eine Karte passend zum Profil. Neue Felder:
//   audio_frau:          Kanyas Tondatei liegt in audio/frau/ (Text für Frauen geändert)
//   beispiel_audio_frau: dasselbe für den Beispielsatz
//   beispiel_geraet: Beispiel mit eingesetztem Namen oder Alter, liest die Stimme des Geräts
export function profileCard(card, profile = MANN) {
  let result = { ...card };

  // Name und Alter einsetzen (zuerst in die Männer-Fassung, die Frau-Fassung folgt unten)
  const name = card.id === NAME_CARD ? profileName(profile) : null;
  if (name) {
    for (const field of ["beispiel", "beispiel_en", "beispiel_thai", "beispiel_thai_en"]) {
      if (result[field]) result[field] = insertName(result[field], name);
    }
    if (name.own) result.beispiel_geraet = true;
  }
  if (card.id === AGE_CARD && profile.alter) {
    Object.assign(result, ageExample(profile.alter));
    result.beispiel_geraet = true;
  }

  if (profile.geschlecht !== "frau" || meansHair(card)) return result;

  const male = result;
  result = { ...male };
  for (const field of UMSCHRIFT_FIELDS) {
    if (result[field]) result[field] = feminizeUmschrift(result[field]);
  }
  result.thai = feminizeThai(male.thai, male.umschrift);
  if (male.beispiel_thai) result.beispiel_thai = feminizeThai(male.beispiel_thai, male.beispiel || male.beispiel_en);
  if (male.beispiel_thai_en) result.beispiel_thai_en = feminizeThai(male.beispiel_thai_en, male.beispiel_en);
  // Eigene Texte für Frauen aus vokabeln.json (Feld "frau"), z. B. andere Merkhilfe
  Object.assign(result, card.frau || {});
  delete result.frau;

  result.audio_frau = result.thai !== card.thai;
  result.beispiel_audio_frau = Boolean(male.beispiel_thai) &&
    (result.beispiel_thai !== male.beispiel_thai || result.beispiel_thai_en !== male.beispiel_thai_en);
  return result;
}

export function profileCards(cards, profile = MANN) {
  return cards.map(card => profileCard(card, profile));
}

// ---------- Dialoge ----------

export const NAME_DIALOG = "small-kennenlernen";

// Ein Dialog passend zum Profil, vor dem Übersetzen (localizeDialogs). Für Frauen gelten die
// eigenen Texte aus dialoge.json (Feld "frau": titel, titel_en, rollen, rollen_en, Sätze nach Nummer
// und gegenueber_mann = die andere Person ist ein Mann und sagt khráp). thai_mann merkt sich den
// ursprünglichen Thai-Text, daran erkennt profileLine, ob es eine Frau-Tondatei gibt.
export function profileDialog(dialog, profile = MANN) {
  if (profile.geschlecht !== "frau" || !dialog.frau) return dialog;
  const { saetze = {}, ...rest } = dialog.frau;
  return {
    ...dialog,
    ...rest,
    frau: undefined,
    saetze: dialog.saetze.map((line, index) => {
      const own = saetze[index + 1];
      return own ? { ...line, ...own, thai_mann: line.thai } : line;
    }),
  };
}

export function profileDialogs(dialogs, profile = MANN) {
  return dialogs.map(dialog => profileDialog(dialog, profile));
}

// Ein eigener Satz des Lernenden (Rolle "ich") passend zum Profil.
// Gibt { umschrift, thai, deutsch, frau, geraet } zurück:
//   frau:   Tondatei in audio/frau/dialoge/, geraet: liest die Stimme des Geräts (eigener Name)
export function profileLine(dialog, line, profile = MANN) {
  let { umschrift, thai, deutsch } = line;
  const name = dialog.id === NAME_DIALOG ? profileName(profile) : null;
  const named = name && insertName(umschrift, name) !== umschrift;
  if (named) {
    umschrift = insertName(umschrift, name);
    thai = insertName(thai, name);
    deutsch = insertName(deutsch, name);
  }
  if (profile.geschlecht !== "frau") return { umschrift, thai, deutsch, frau: false, geraet: Boolean(named && name.own) };
  const female = feminizeThai(thai, umschrift);
  return {
    umschrift: feminizeUmschrift(umschrift),
    thai: female,
    deutsch,
    frau: female !== (line.thai_mann || line.thai),
    geraet: Boolean(named && name.own),
  };
}
