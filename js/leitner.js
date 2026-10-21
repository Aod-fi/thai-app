// Leitner-System: entscheidet, wann eine Karte wiederkommt.
// Diese Datei rechnet nur, sie zeigt nichts an und speichert nichts.
// Dadurch lässt sie sich mit Tests prüfen (siehe tests/leitner.test.mjs).

// Abstand in Tagen für Fach 1 bis 5
export const INTERVALS = [1, 2, 4, 8, 16];
export const MAX_BOX = INTERVALS.length;

// Grenzen für eine Lernrunde
export const MAX_CARDS_PER_ROUND = 20;
export const MAX_NEW_PER_DAY = 5;
// So viele neue Karten kommen dazu, wenn man "5 weitere neue Karten" tippt
export const EXTRA_NEW_STEP = 5;

// Datum als Text "JJJJ-MM-TT" in Ortszeit, z. B. "2026-10-19".
// Texte in diesem Format lassen sich einfach mit < und > vergleichen.
export function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Zählt zu einem Datum "JJJJ-MM-TT" eine Anzahl Tage dazu
export function addDays(dateString, days) {
  const [y, m, d] = dateString.split("-").map(Number);
  return toDateString(new Date(y, m - 1, d + days));
}

// Wie viele Tage bis zur nächsten Wiederholung?
// Karten mit "aufpassen" bekommen den Abstand des Fachs darunter,
// kommen also ein Fach langsamer voran.
export function intervalFor(box, careful) {
  const index = careful ? Math.max(box - 2, 0) : box - 1;
  return INTERVALS[index];
}

// Bewertet eine Karte und gibt den neuen Lernstand zurück.
//   state:   bisheriger Lernstand { box, due } oder null bei einer neuen Karte
//   rating:  "nochmal", "schwer" oder "gewusst"
//   careful: true, wenn die Karte "aufpassen" hat
//   today:   heutiges Datum "JJJJ-MM-TT"
export function rateCard(state, rating, careful, today) {
  const oldBox = state ? state.box : 1;
  let box;

  if (rating === "gewusst") {
    box = Math.min(oldBox + 1, MAX_BOX);
  } else if (rating === "schwer") {
    box = oldBox;
  } else if (rating === "nochmal") {
    // Zurück in Fach 1 und heute noch einmal
    return { box: 1, due: today };
  } else {
    throw new Error(`Unbekannte Bewertung: ${rating}`);
  }

  return { box, due: addDays(today, intervalFor(box, careful)) };
}

// Alle Themen in der Reihenfolge, in der sie in vokabeln.json zuerst vorkommen
export function themes(cards) {
  return [...new Set(cards.map(card => card.thema))];
}

// Sortiert neue Karten reihum nach Thema: erste Karte jedes Themas,
// dann zweite Karte jedes Themas usw. Innerhalb eines Themas bleibt
// die Reihenfolge aus vokabeln.json (also die des Unterrichts).
export function mixByTheme(cards) {
  const groups = themes(cards).map(theme => cards.filter(card => card.thema === theme));
  const mixed = [];
  for (let i = 0; mixed.length < cards.length; i++) {
    for (const group of groups) {
      if (i < group.length) mixed.push(group[i]);
    }
  }
  return mixed;
}

// Stellt die Lernrunde für heute zusammen.
//   cards:        alle Karten aus vokabeln.json
//   states:       Lernstand pro Karte, z. B. { "zahl-20": { box: 2, due: "2026-10-20" } }
//   today:        heutiges Datum "JJJJ-MM-TT"
//   newSeenToday: wie viele neue Karten heute schon dran waren
//   newLimit:     wie viele neue Karten heute insgesamt erlaubt sind
//                 (normal 5, mehr nach "5 weitere neue Karten")
//   focus:        Fokus-Thema für neue Karten, z. B. "Taxi"; "" = alle Themen gemischt
// Gibt eine Liste von Karten zurück: zuerst die fälligen, dann neue.
// Das Fokus-Thema wirkt nur auf die neuen Karten, Wiederholungen kommen aus allen Themen.
export function buildRound(cards, states, today, newSeenToday = 0, newLimit = MAX_NEW_PER_DAY, focus = "") {
  const due = cards
    .filter(card => states[card.id] && states[card.id].due <= today)
    .sort((a, b) => states[a.id].due.localeCompare(states[b.id].due))
    .slice(0, MAX_CARDS_PER_ROUND);

  const freeSlots = Math.min(
    newLimit - newSeenToday,
    MAX_CARDS_PER_ROUND - due.length
  );
  const fresh = unseenCards(cards, states, focus).slice(0, Math.max(freeSlots, 0));

  return [...due, ...fresh];
}

// Freies Üben: bis zu 20 Karten des Themas (oder aller Themen) in zufälliger
// Reihenfolge, egal ob fällig, gelernt oder neu. Ändert keinen Lernstand.
//   random: Zufallsfunktion, in Tests ersetzbar
export function practiceRound(cards, focus = "", random = Math.random) {
  const pool = focus ? cards.filter(card => card.thema === focus) : [...cards];
  // Mischen (Fisher-Yates): jede Reihenfolge ist gleich wahrscheinlich
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, MAX_CARDS_PER_ROUND);
}

// Noch nie gelernte Karten, in der Reihenfolge, in der sie drankommen:
// mit Fokus-Thema nur dieses Thema, sonst reihum aus allen Themen
export function unseenCards(cards, states, focus = "") {
  const unseen = cards.filter(card => !states[card.id]);
  return focus ? unseen.filter(card => card.thema === focus) : mixByTheme(unseen);
}

// Zählt für die Fortschrittsanzeige, wie viele Karten in welchem Fach liegen.
// Index 0 = noch nie gelernt, 1 bis 5 = Fach 1 bis 5.
export function countByBox(cards, states) {
  const counts = new Array(MAX_BOX + 1).fill(0);
  for (const card of cards) {
    const state = states[card.id];
    counts[state ? state.box : 0]++;
  }
  return counts;
}

// Lerntage in Folge: zählt rückwärts ab heute (oder gestern, falls heute
// noch nicht gelernt wurde), solange jeder Tag in der Liste vorkommt.
export function streak(learnedDays, today) {
  const days = new Set(learnedDays);
  let day = days.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (days.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}
