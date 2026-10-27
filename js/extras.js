// Hörübung, Lernstatistik, Suche und Startzahl: nur Rechnen, keine Anzeige, kein Speichern.
// Getestet in tests/extras.test.mjs.

import { themes, addDays, inFocus } from "./leitner.js";
import { t } from "./sprache.js";

export const LISTEN_QUESTIONS = 10;
export const LISTEN_OPTIONS = 4;

// Mischt eine Liste (Fisher-Yates), gibt eine neue Liste zurück
export function shuffle(list, random = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Hörübung: die App spricht eine Karte, man wählt die richtige Bedeutung.
// Gefragt wird nach Karten im Fokus (ein Thema, ein Bereich oder alle Themen). Gibt es dort
// schon mindestens 4 gelernte Karten, kommen nur gelernte dran.
// Die falschen Antworten stammen möglichst aus demselben Thema.
// Gibt eine Liste von Fragen zurück: { card, options: [deutsch, ...] }
export function listenQuiz(cards, states, focus = "", random = Math.random) {
  const pool = cards.filter(card => inFocus(card, focus));
  const learned = pool.filter(card => states[card.id]);
  const asked = shuffle(learned.length >= LISTEN_OPTIONS ? learned : pool, random)
    .slice(0, LISTEN_QUESTIONS);

  return asked.map(card => {
    // Falsche Antworten: andere Bedeutung und anders klingend. Zwei Karten mit
    // demselben Thai (z. B. "mâi ao khráp" bei Markt und Essen) wären sonst beide richtig.
    const others = card2 => card2.deutsch !== card.deutsch && (!card.thai || card2.thai !== card.thai);
    const sameTheme = shuffle(cards.filter(c => c.thema === card.thema && others(c)), random);
    const otherTheme = shuffle(cards.filter(c => c.thema !== card.thema && others(c)), random);
    const wrong = [];
    for (const c of [...sameTheme, ...otherTheme]) {
      if (wrong.length === LISTEN_OPTIONS - 1) break;
      if (!wrong.includes(c.deutsch)) wrong.push(c.deutsch);
    }
    return { card, options: shuffle([card.deutsch, ...wrong], random) };
  });
}

// Statistik pro Thema: wie viele Karten, davon gelernt, davon sicher (Fach 4 oder 5)
export function themeStats(cards, states) {
  return themes(cards).map(theme => {
    const themeCards = cards.filter(card => card.thema === theme);
    const learned = themeCards.filter(card => states[card.id]);
    return {
      theme,
      total: themeCards.length,
      learned: learned.length,
      sure: learned.filter(card => states[card.id].box >= 4).length,
    };
  });
}

// Wie viele Karten in den nächsten Tagen fällig werden (heute zählt alles Überfällige mit)
export function dueForecast(cards, states, today, days = 7) {
  const forecast = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    const count = cards.filter(card => {
      const state = states[card.id];
      if (!state) return false;
      return i === 0 ? state.due <= day : state.due === day;
    }).length;
    forecast.push({ day, count });
  }
  return forecast;
}

// ---------- Suche in "Alle Karten" ----------

// Text zum Vergleichen: klein, ohne Tonzeichen, Lautschrift-Buchstaben als normale
// Buchstaben (ɛ → e, ɔ → o, ʉ → u, ə → e), ohne Leer- und Sonderzeichen, doppelte
// Buchstaben (lange Vokale) einfach. So findet "khao jai" auch "khâo-jai",
// und "pheng" wie "pheeng" findet "phɛɛng".
const PLAIN_LETTERS = { "ɛ": "e", "ɔ": "o", "ʉ": "u", "ə": "e" };

export function searchKey(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[ɛɔʉə]/g, letter => PLAIN_LETTERS[letter])
    .replace(/[^\p{L}\p{N}]/gu, "")
    .replace(/(.)\1+/gu, "$1");
}

// Passt eine Karte zur Suche? Gesucht wird in Deutsch, Englisch und Umschrift.
// Leere Suche: jede Karte passt.
export function matchesSearch(card, query) {
  const key = searchKey(query);
  if (key === "") return true;
  return [card.deutsch, card.englisch, card.umschrift].some(field => searchKey(field).includes(key));
}

// ---------- Startseite ----------

// Was heute in der Lernrunde dran ist: Wiederholungen und neue Karten
//   round:  Karten der heutigen Runde (buildRound), states: Lernstand pro Karte
export function todayText(round, states) {
  const reviews = round.filter(card => states[card.id]).length;
  const fresh = round.length - reviews;
  const reviewText = t(reviews === 1 ? "{n} Wiederholung" : "{n} Wiederholungen", { n: reviews });
  const freshText = t("{n} neue", { n: fresh });   // "1 neue" wie "3 neue"
  if (reviews > 0 && fresh > 0) return t("Heute: {a} + {b}", { a: reviewText, b: freshText });
  if (reviews > 0) return t("Heute: {a}", { a: reviewText });
  if (fresh > 0) return t("Heute: {a}", { a: freshText });
  return t("Heute: nichts fällig");
}
