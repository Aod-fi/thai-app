// Kartenart: jede Karte ist ein Wort, ein Satz (sagst du selbst) oder ein Satz zum Verstehen
// (sagen andere zu dir), Feld "art" in vokabeln.json. Auf der Startseite wählt man unter
// "Karten:", welche Arten in Lernrunde und Frei üben drankommen.
// Nur Rechnen und die gespeicherte Wahl, keine Anzeige. Getestet in tests/kartenart.test.mjs.

const KEY = "mythai-kartenart";

// Wahl auf der Startseite: "alle" oder eine Art
export const CHOICES = ["alle", "wort", "satz", "hoeren"];
// Reihenfolge neuer Karten innerhalb eines Themas bei "Alle": erst Wörter, dann Sätze, dann Verstehen
const ORDER = { wort: 0, satz: 1, hoeren: 2 };

export function loadKind() {
  try {
    const saved = localStorage.getItem(KEY);
    return CHOICES.includes(saved) ? saved : "alle";
  } catch {
    return "alle";
  }
}

export function saveKind(kind) {
  try {
    localStorage.setItem(KEY, validKind(kind));
  } catch {
    // kein Speicher verfügbar: gilt dann nur bis zum Schließen
  }
}

export function validKind(kind) {
  return CHOICES.includes(kind) ? kind : "alle";
}

// Karten der gewählten Art. Bei "alle" alle Karten, innerhalb eines Themas sortiert
// nach Wort, Satz, Verstehen (sonst bleibt die Reihenfolge aus vokabeln.json).
export function cardsOfKind(cards, kind = "alle") {
  if (kind !== "alle") return cards.filter(card => card.art === kind);
  // Stabil sortieren: Themen bleiben in ihrer Reihenfolge, darin zuerst die Wörter
  const themeIndex = new Map();
  for (const card of cards) if (!themeIndex.has(card.thema)) themeIndex.set(card.thema, themeIndex.size);
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => themeIndex.get(a.card.thema) - themeIndex.get(b.card.thema) ||
      (ORDER[a.card.art] ?? 1) - (ORDER[b.card.art] ?? 1) || a.index - b.index)
    .map(({ card }) => card);
}

// Text des Abzeichens auf der Karte (deutsch, mit t() übersetzen)
export const BADGES = { wort: "Wort", satz: "Satz", hoeren: "👂 Verstehen" };
