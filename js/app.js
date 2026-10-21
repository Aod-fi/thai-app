// Hauptdatei der App: verbindet Anzeige (index.html), Logik (leitner.js),
// Speicher (storage.js) und Sprachausgabe (speech.js).

import { buildRound, rateCard, countByBox, countUnseen, streak, toDateString, MAX_NEW_PER_DAY, EXTRA_NEW_STEP } from "./leitner.js";
import { loadStates, saveState, loadMeta, saveMeta } from "./storage.js";
import { initSpeech, speak, RATE_NORMAL, RATE_SLOW } from "./speech.js";

// Versionsnummer, wird unten auf der Startseite angezeigt.
// Bei jeder Änderung erhöhen, dann sieht man auf dem iPhone, ob die neue Version da ist.
const VERSION = "1.1";

// Kurzschreibweise, um ein Element über seine id zu finden
const $ = id => document.getElementById(id);

// Zustand der App, solange sie geöffnet ist
let cards = [];       // alle Karten aus vokabeln.json
let states = {};      // Lernstand pro Karte
let queue = [];       // Karten der laufenden Runde, die noch dran kommen
let roundSize = 0;    // Anzahl Karten zu Beginn der Runde
let current = null;   // Karte, die gerade angezeigt wird
let direction = "";   // "hoeren" (Hören → Deutsch) oder "sprechen" (Deutsch → Thai)

const today = () => toDateString(new Date());

// ---------- Start ----------

async function start() {
  // "no-cache": immer nachsehen, ob es neue Vokabeln gibt
  const response = await fetch("inhalte/vokabeln.json", { cache: "no-cache" });
  cards = await response.json();
  states = await loadStates();
  $("version").textContent = VERSION;
  showHome();

  const hasVoice = await initSpeech();
  $("voice-warning").hidden = hasVoice;
}

// Wie viele neue Karten heute schon dran waren
async function newSeenToday() {
  const record = await loadMeta("newSeen", { date: "", count: 0 });
  return record.date === today() ? record.count : 0;
}

// Wie viele neue Karten heute insgesamt erlaubt sind:
// 5 plus alles, was über "5 weitere neue Karten" dazugekommen ist
async function newLimitToday() {
  const record = await loadMeta("extraNew", { date: "", count: 0 });
  return MAX_NEW_PER_DAY + (record.date === today() ? record.count : 0);
}

// Heutige Runde zusammenstellen
async function todaysRound() {
  return buildRound(cards, states, today(), await newSeenToday(), await newLimitToday());
}

// ---------- Ansichten wechseln ----------

function showView(name) {
  for (const view of ["home", "round", "overview"]) {
    $(`view-${view}`).hidden = view !== name;
  }
  window.scrollTo(0, 0);
}

// ---------- Startseite ----------

async function showHome() {
  const round = await todaysRound();
  $("due-count").textContent = round.length;
  $("start-button").disabled = round.length === 0;
  $("start-button").textContent = round.length === 0 ? "Heute alles erledigt 🎉" : "Lernrunde starten";

  // Ist heute alles erledigt und gibt es noch ungelernte Karten,
  // kann man freiwillig weitere neue Karten lernen.
  $("more-button").hidden = round.length > 0 || countUnseen(cards, states) === 0;

  const counts = countByBox(cards, states);
  const labels = ["neu", "Fach 1", "Fach 2", "Fach 3", "Fach 4", "Fach 5"];
  $("boxes").innerHTML = counts
    .map((count, i) => `<div><div class="count">${count}</div><div class="label">${labels[i]}</div></div>`)
    .join("");

  $("streak").textContent = streak(await loadMeta("learnedDays", []), today());
  showView("home");
}

// ---------- Lernrunde ----------

async function startRound() {
  queue = await todaysRound();
  roundSize = queue.length;
  showView("round");
  showNextCard();
}

function showNextCard() {
  if (queue.length === 0) {
    showHome();
    return;
  }
  current = queue.shift();
  const isNew = !states[current.id];

  // Richtung zufällig wählen; neue Karten werden zuerst einmal vorgestellt
  direction = Math.random() < 0.5 ? "hoeren" : "sprechen";

  $("round-counter").textContent = `noch ${queue.length + 1} von ${roundSize}`;
  const badges = [];
  if (isNew) badges.push("Neu");
  if (current.aufpassen) badges.push("⚠ Aufpassen");
  $("card-badges").innerHTML = badges.map(b => `<span class="badge">${b}</span>`).join("");

  if (isNew) {
    showBack();
    return;
  }

  $("card-front").hidden = false;
  $("card-back").hidden = true;
  $("flip-button").hidden = false;
  $("rating-buttons").hidden = true;

  if (direction === "hoeren") {
    $("front-hint").textContent = "Hör zu: Was bedeutet das?";
    $("front-text").textContent = "🔊";
    $("front-speak").hidden = false;
    speak(current.thai);
  } else {
    $("front-hint").textContent = "Sag es laut auf Thai:";
    $("front-text").textContent = current.deutsch;
    $("front-speak").hidden = true;
  }
}

function showBack() {
  $("card-front").hidden = true;
  $("card-back").hidden = false;
  $("flip-button").hidden = true;
  $("rating-buttons").hidden = false;

  $("back-umschrift").textContent = current.umschrift;
  $("back-deutsch").textContent = current.deutsch;
  $("back-merkhilfe").textContent = current.merkhilfe ? "💡 " + current.merkhilfe : "";
  $("back-beispiel").textContent = current.beispiel ? "z. B. " + current.beispiel : "";

  // Nach dem Umdrehen die richtige Aussprache vorspielen
  speak(current.thai);
}

async function rate(rating) {
  const isNew = !states[current.id];
  const newState = rateCard(states[current.id], rating, Boolean(current.aufpassen), today());
  const ratedCard = current;
  states[ratedCard.id] = newState;

  // "Nochmal": Karte kommt in dieser Runde später noch einmal
  if (rating === "nochmal") queue.push(ratedCard);

  // Zuerst die nächste Karte zeigen, dann speichern. So spricht die Stimme
  // direkt nach dem Tippen (iOS erlaubt Ton nur unmittelbar nach einer Berührung).
  // Ist die Runde zu Ende, erst speichern und dann die Startseite zeigen.
  const roundOver = queue.length === 0;
  if (!roundOver) showNextCard();

  await saveState(ratedCard.id, newState);
  if (isNew) {
    await saveMeta("newSeen", { date: today(), count: (await newSeenToday()) + 1 });
  }

  // Heutigen Tag als Lerntag merken
  const days = await loadMeta("learnedDays", []);
  if (!days.includes(today())) {
    days.push(today());
    await saveMeta("learnedDays", days);
  }

  if (roundOver) showHome();
}

// "5 weitere neue Karten": erlaubt für heute 5 neue Karten mehr und startet die Runde
async function learnMore() {
  const record = await loadMeta("extraNew", { date: "", count: 0 });
  const extra = record.date === today() ? record.count : 0;
  await saveMeta("extraNew", { date: today(), count: extra + EXTRA_NEW_STEP });
  startRound();
}

// ---------- Übersicht ----------

function showOverview() {
  // Karten nach Einheit gruppieren
  const units = {};
  for (const card of cards) {
    (units[card.einheit] ||= []).push(card);
  }

  const list = $("overview-list");
  list.innerHTML = "";
  for (const [unit, unitCards] of Object.entries(units)) {
    const title = document.createElement("h2");
    title.className = "unit-title";
    title.textContent = `Einheit ${unit}`;
    list.appendChild(title);

    for (const card of unitCards) {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML =
        '<div class="text"><div class="umschrift-small"></div><div class="muted"></div></div>' +
        '<button class="secondary">▶</button><button class="secondary">🐢</button>';
      row.querySelector(".umschrift-small").textContent = card.umschrift + (card.aufpassen ? " ⚠" : "");
      row.querySelector(".muted").textContent = card.deutsch;
      const [normal, slow] = row.querySelectorAll("button");
      normal.addEventListener("click", () => speak(card.thai, RATE_NORMAL));
      slow.addEventListener("click", () => speak(card.thai, RATE_SLOW));
      list.appendChild(row);
    }
  }
  showView("overview");
}

// ---------- Tasten verbinden ----------

$("start-button").addEventListener("click", startRound);
$("more-button").addEventListener("click", learnMore);
$("overview-button").addEventListener("click", showOverview);
$("overview-close").addEventListener("click", showHome);
$("round-close").addEventListener("click", showHome);
$("flip-button").addEventListener("click", showBack);
$("front-speak").addEventListener("click", () => speak(current.thai));
$("back-speak").addEventListener("click", () => speak(current.thai, RATE_NORMAL));
$("back-speak-slow").addEventListener("click", () => speak(current.thai, RATE_SLOW));
for (const button of $("rating-buttons").querySelectorAll("button")) {
  button.addEventListener("click", () => rate(button.dataset.rating));
}

start();

// Service Worker anmelden (Offline-Betrieb und immer frische Dateien, siehe sw.js)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
