// Namen von Kanyas Tondateien (ohne Anzeige, damit sie sich testen lassen).
// Erzeugt werden sie mit scripts/make-audio.sh, offline gespeichert von sw.js.
// (Die Dialoge haben ihre eigene Regel in dialoge.js.)

// Jede Karte: audio/<id>.m4a
export function cardAudio(card) {
  return `audio/${card.id}.m4a`;
}

// Beispielsatz einer Karte: audio/beispiele/<id>.m4a.
// Hat die englische Fassung einen eigenen Thai-Text (beispiel_thai_en, z. B. anderer Name),
// gibt es dafür audio/beispiele/<id>-en.m4a.
export function exampleAudio(card, english = false) {
  return `audio/beispiele/${card.id}${english && card.beispiel_thai_en ? "-en" : ""}.m4a`;
}

// Alle Tondateien der Beispielsätze mit dem Text, den Kanya dafür spricht
export function exampleAudioFiles(cards) {
  const files = [];
  for (const card of cards) {
    if (card.beispiel_thai) files.push({ file: exampleAudio(card), thai: card.beispiel_thai });
    if (card.beispiel_thai_en) files.push({ file: exampleAudio(card, true), thai: card.beispiel_thai_en });
  }
  return files;
}

// Wort für "Töne hören": audio/toene/<gruppe>-<nummer>.m4a, z. B. audio/toene/maa-2.m4a
export function toneAudio(group, index) {
  return `audio/toene/${group.gruppe}-${index + 1}.m4a`;
}

// Alle Tondateien für "Töne hören" mit dem Text, den Kanya dafür spricht
export function toneAudioFiles(groups) {
  return groups.flatMap(group => group.woerter.map((word, index) => ({ file: toneAudio(group, index), thai: word.thai })));
}
