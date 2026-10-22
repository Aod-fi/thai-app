// Thai-Töne: erkennt den Ton an der Umschrift, gibt einen vorsichtigen Hinweis zur
// eigenen Ton-Kurve und stellt die Übung "Töne hören" zusammen.
// Nur Rechnen, keine Anzeige. Getestet in tests/tones.test.mjs.

import { shuffle } from "./extras.js";

// Tonzeichen der Umschrift (als eigene Zeichen nach dem Vokal, Unicode "NFD")
export const TONES = {
  mittel: { name: "mittel", mark: "keine Marke", example: "maa" },
  tief: { name: "tief", mark: "à", example: "pàa" },
  fallend: { name: "fallend", mark: "â", example: "mâi" },
  hoch: { name: "hoch", mark: "á", example: "máa" },
  steigend: { name: "steigend", mark: "ǎ", example: "mǎa" },
};
const MARKS = { "̀": "tief", "̂": "fallend", "́": "hoch", "̌": "steigend" };

// Ton einer Silbe, z. B. "khâao" → "fallend", "maa" → "mittel"
export function toneOf(syllable) {
  for (const char of syllable.normalize("NFD")) {
    if (MARKS[char]) return MARKS[char];
  }
  return "mittel";
}

// Silbe ohne Tonzeichen, z. B. "khâao" → "khaao" (für die Prüfung der Minimalpaare)
export function withoutTone(syllable) {
  return syllable.normalize("NFD").replace(/[̀́̂̌]/g, "").normalize("NFC");
}

// Einsilbige Karte? Dann gibt es einen Ton-Hinweis. Satzzeichen zählen nicht.
export function singleSyllable(umschrift) {
  const parts = umschrift.replace(/[?!.,…]/g, "").trim().split(/[\s-]+/).filter(Boolean);
  return parts.length === 1 ? parts[0] : null;
}

const STEP = { fallend: -2, steigend: 1 };   // Halbtöne, ab denen es "deutlich" ist

// Vorsichtiger Hinweis zur eigenen Kurve einer einsilbigen Karte.
//   umschrift: z. B. "mâi"
//   movement:  Ergebnis von endMovement() aus pitch.js (Halbtöne, + steigt, − fällt)
// Gibt { text, kind } zurück; kind "ok" = passt, "" = nur Hinweis. Oder null.
export function toneHint(umschrift, movement) {
  const syllable = singleSyllable(umschrift);
  if (!syllable) return null;
  const tone = toneOf(syllable);
  const label = tone === "mittel" ? "mittel (keine Marke)" : `${tone} (${TONES[tone].mark})`;

  if (movement === null || movement === undefined) {
    return { text: `Ton: ${label}. Deine Kurve war zu kurz zum Vergleichen.`, kind: "" };
  }
  if (tone === "fallend") {
    return movement <= STEP.fallend
      ? { text: `Ton: ${label}. Deine Stimme fällt am Ende, das passt gut.`, kind: "ok" }
      : { text: `Ton: ${label}. Die Stimme sollte am Ende deutlich fallen, bei dir eher wenig. Vergleiche mit der grauen Linie.`, kind: "" };
  }
  if (tone === "steigend") {
    return movement >= STEP.steigend
      ? { text: `Ton: ${label}. Deine Stimme steigt am Ende, das passt gut.`, kind: "ok" }
      : { text: `Ton: ${label}. Die Stimme sollte erst etwas sinken und am Ende hochgehen, bei dir eher wenig. Vergleiche mit der grauen Linie.`, kind: "" };
  }
  // Mittel, tief und hoch lassen sich ohne feste Bezugshöhe nicht sicher prüfen
  const expect = {
    mittel: "Die Stimme bleibt ruhig in der Mitte.",
    tief: "Die Stimme bleibt tief und ruhig, am Ende eher etwas tiefer.",
    hoch: "Die Stimme liegt hoch, oft mit leichtem Anstieg.",
  };
  return { text: `Ton: ${label}. ${expect[tone]} Vergleiche mit der grauen Linie.`, kind: "" };
}

export const TONE_QUESTIONS = 10;

// Übung "Töne hören": Kanya sagt ein Wort, man wählt die Umschrift.
//   groups: Inhalt von inhalte/toene.json, Gruppen von Wörtern, die sich nur im Ton unterscheiden
// Gibt eine Liste von Fragen zurück: { word, options: [word, ...] }
// Jede Gruppe kommt möglichst nur einmal dran, solange es genug Gruppen gibt.
export function toneRound(groups, random = Math.random) {
  const questions = [];
  let pool = [];
  while (questions.length < TONE_QUESTIONS) {
    if (pool.length === 0) pool = shuffle(groups, random);
    const group = pool.pop();
    const word = group.woerter[Math.floor(random() * group.woerter.length)];
    questions.push({ word, options: shuffle(group.woerter, random) });
  }
  return questions;
}
