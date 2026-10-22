// Hauptdatei der App: verbindet Anzeige (index.html), Logik (leitner.js),
// Speicher (storage.js) und Sprachausgabe (speech.js).

import { buildRound, rateCard, countByBox, unseenCards, practiceRound, themes, streak, toDateString, MAX_NEW_PER_DAY, EXTRA_NEW_STEP } from "./leitner.js";
import { loadStates, saveState, loadMeta, saveMeta } from "./storage.js";
import { initSpeech, speak, RATE_NORMAL, RATE_SLOW } from "./speech.js";
import { listenQuiz, themeStats, dueForecast } from "./extras.js";
import { canRecord, isRecording, startRecording, stopRecording, playRecording, clearRecording } from "./recorder.js";
import { checkSpoken } from "./voice-check.js";

// Versionsnummer, wird unten auf der Startseite angezeigt.
// Bei jeder Änderung erhöhen, dann sieht man auf dem iPhone, ob die neue Version da ist.
const VERSION = "1.6";

// Kurzschreibweise, um ein Element über seine id zu finden
const $ = id => document.getElementById(id);

// Zustand der App, solange sie geöffnet ist
let cards = [];       // alle Karten aus vokabeln.json
let states = {};      // Lernstand pro Karte
let queue = [];       // Karten der laufenden Runde, die noch dran kommen
let roundSize = 0;    // Anzahl Karten zu Beginn der Runde
let current = null;   // Karte, die gerade angezeigt wird
let direction = "";   // "hoeren" (Hören → Deutsch) oder "sprechen" (Deutsch → Thai)
let focus = "";       // Fokus-Thema für neue Karten, "" = alle Themen
let practice = false; // true = freies Üben, Bewertungen ändern keinen Lernstand
let quiz = [];        // Fragen der Hörübung
let quizIndex = 0;    // aktuelle Frage
let quizScore = 0;    // richtige Antworten

const today = () => toDateString(new Date());

// ---------- Start ----------

async function start() {
  // "no-cache": immer nachsehen, ob es neue Vokabeln gibt
  const response = await fetch("inhalte/vokabeln.json", { cache: "no-cache" });
  cards = await response.json();
  states = await loadStates();
  focus = await loadMeta("focus", "");
  if (!themes(cards).includes(focus)) focus = "";
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
  return buildRound(cards, states, today(), await newSeenToday(), await newLimitToday(), focus);
}

// ---------- Ansichten wechseln ----------

function showView(name) {
  for (const view of ["home", "round", "listen", "stats", "overview"]) {
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
  $("more-button").hidden = round.length > 0 || unseenCards(cards, states, focus).length === 0;

  // Auswahl Fokus-Thema, mit Anzahl noch neuer Karten pro Thema
  const options = [["", `Alle Themen gemischt (${unseenCards(cards, states).length} neu)`]];
  for (const theme of themes(cards)) {
    options.push([theme, `${theme} (${unseenCards(cards, states, theme).length} neu)`]);
  }
  $("focus-select").innerHTML = "";
  for (const [value, label] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    $("focus-select").appendChild(option);
  }
  $("focus-select").value = focus;
  $("practice-button").textContent = `Frei üben: ${focus || "alle Themen"}`;

  $("boxes").innerHTML = boxesHtml();

  $("streak").textContent = streak(await loadMeta("learnedDays", []), today());
  showView("home");
}

// Fächer-Anzeige (Startseite und Statistik)
function boxesHtml() {
  const counts = countByBox(cards, states);
  const labels = ["neu", "Fach 1", "Fach 2", "Fach 3", "Fach 4", "Fach 5"];
  return counts
    .map((count, i) => `<div><div class="count">${count}</div><div class="label">${labels[i]}</div></div>`)
    .join("");
}

// ---------- Lernrunde ----------

async function startRound() {
  practice = false;
  queue = await todaysRound();
  roundSize = queue.length;
  showView("round");
  showNextCard();
}

// Freies Üben: Karten des gewählten Themas, ohne Einfluss auf die Fächer
function startPractice() {
  practice = true;
  queue = practiceRound(cards, focus);
  roundSize = queue.length;
  showView("round");
  showNextCard();
}

function showNextCard() {
  resetVoice();
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
  if (practice) badges.push("Freies Üben");
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

  resetVoice();

  // Nach dem Umdrehen die richtige Aussprache vorspielen
  speak(current.thai);
}

// ---------- Eigene Aussprache ----------
// "Aufnehmen": selbst sprechen, dann mit "▶ Normal" (Kanya) und "▶ Ich" vergleichen.
// "Prüfen": die Spracherkennung des Geräts versucht, das Gesagte zu verstehen.
// Das ist nur ein grober Test, Töne bewertet er nicht zuverlässig.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

function resetVoice() {
  clearRecording();
  if (recognition) recognition.abort();
  $("record-button").hidden = !canRecord();
  $("record-button").textContent = "🎤 Aufnehmen";
  $("record-button").classList.remove("active");
  $("play-own").hidden = true;
  $("check-button").hidden = !Recognition;
  $("check-button").textContent = "🗣 Prüfen";
  $("check-button").classList.remove("active");
  $("voice-result").hidden = true;
}

function showVoiceResult(text, kind = "") {
  $("voice-result").textContent = text;
  $("voice-result").className = `voice-result ${kind}`;
  $("voice-result").hidden = false;
}

async function toggleRecording() {
  if (isRecording()) {
    stopRecording();
    return;
  }
  speechSynthesis.cancel();
  try {
    await startRecording(() => {
      $("record-button").textContent = "🎤 Nochmal";
      $("record-button").classList.remove("active");
      $("play-own").hidden = false;
      showVoiceResult("Jetzt vergleichen: ▶ Normal (Kanya) und ▶ Ich");
    });
    $("record-button").textContent = "⏹ Stopp";
    $("record-button").classList.add("active");
    $("voice-result").hidden = true;
  } catch {
    showVoiceResult("Kein Zugriff auf das Mikrofon. Bitte in den Einstellungen erlauben.", "no");
  }
}

function checkPronunciation() {
  if (recognition) {
    recognition.abort();
    return;
  }
  speechSynthesis.cancel();
  const card = current;
  recognition = new Recognition();
  recognition.lang = "th-TH";
  recognition.interimResults = false;
  recognition.maxAlternatives = 5;

  let answered = false;
  recognition.onresult = event => {
    answered = true;
    const transcripts = [...event.results[0]].map(alternative => alternative.transcript);
    const { ok, heard } = checkSpoken(card, transcripts, cards);
    if (ok) showVoiceResult("✓ Verstanden!", "ok");
    else if (heard) showVoiceResult(`✗ Klang eher nach: ${heard.umschrift}`, "no");
    else showVoiceResult("✗ Nicht verstanden. Hör nochmal zu und versuch es erneut.", "no");
  };
  recognition.onerror = event => {
    answered = true;
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      showVoiceResult("Spracherkennung nicht erlaubt. Bitte Mikrofon und Diktierfunktion erlauben.", "no");
    } else if (event.error !== "aborted") {
      showVoiceResult("Nichts gehört. Tippe auf Prüfen und sprich direkt los.", "no");
    }
  };
  recognition.onend = () => {
    recognition = null;
    $("check-button").textContent = "🗣 Prüfen";
    $("check-button").classList.remove("active");
    if (!answered) showVoiceResult("Nichts gehört. Tippe auf Prüfen und sprich direkt los.", "no");
  };

  $("check-button").textContent = "👂 Ich höre …";
  $("check-button").classList.add("active");
  $("voice-result").hidden = true;
  recognition.start();
}

async function rate(rating) {
  // Freies Üben: nichts speichern, "Nochmal" kommt in der Runde wieder
  if (practice) {
    if (rating === "nochmal") queue.push(current);
    showNextCard();
    return;
  }

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

// Fokus-Thema gewählt: merken und Startseite neu berechnen
async function changeFocus() {
  focus = $("focus-select").value;
  await saveMeta("focus", focus);
  showHome();
}

// ---------- Hörübung ----------
// Die App spricht, man wählt die Bedeutung. Zählt nicht für die Fächer.

function startListen() {
  quiz = listenQuiz(cards, states, focus);
  quizIndex = 0;
  quizScore = 0;
  $("listen-result").hidden = true;
  showView("listen");
  showQuestion();
}

function showQuestion() {
  const { card, options } = quiz[quizIndex];
  $("listen-counter").textContent = `Frage ${quizIndex + 1} von ${quiz.length}`;
  $("listen-question").hidden = false;
  $("listen-solution").hidden = true;
  $("listen-next").hidden = true;

  const list = $("listen-options");
  list.innerHTML = "";
  for (const option of options) {
    const button = document.createElement("button");
    button.textContent = option;
    button.addEventListener("click", () => answer(button, option === card.deutsch));
    list.appendChild(button);
  }
  speak(card.thai);
}

function answer(chosen, correct) {
  const { card } = quiz[quizIndex];
  if (correct) quizScore++;
  // Richtige Antwort grün, falsch gewählte rot; danach nichts mehr antippbar
  for (const button of $("listen-options").querySelectorAll("button")) {
    if (button.textContent === card.deutsch) button.classList.add("right");
    button.disabled = true;
  }
  if (!correct) chosen.classList.add("wrong");
  $("listen-solution").textContent = card.umschrift;
  $("listen-solution").hidden = false;
  $("listen-next").hidden = false;
}

function nextQuestion() {
  quizIndex++;
  if (quizIndex < quiz.length) {
    showQuestion();
    return;
  }
  // Ergebnis zeigen
  $("listen-question").hidden = true;
  $("listen-options").innerHTML = "";
  $("listen-next").hidden = true;
  $("listen-counter").textContent = "";
  $("listen-score").textContent = `${quizScore} von ${quiz.length}`;
  $("listen-result").hidden = false;
}

// ---------- Statistik ----------

async function showStats() {
  const learnedDays = await loadMeta("learnedDays", []);
  $("stats-streak").textContent = streak(learnedDays, today());
  $("stats-days").textContent = learnedDays.length;
  $("stats-boxes").innerHTML = boxesHtml();

  // Pro Thema: Balken, grün = sicher (ab Fach 4), gelb = gelernt
  const list = $("stats-themes");
  list.innerHTML = "";
  for (const { theme, total, learned, sure } of themeStats(cards, states)) {
    const row = document.createElement("div");
    row.className = "theme-row";
    row.innerHTML =
      '<div class="theme-head"><span class="name"></span><span class="muted numbers"></span></div>' +
      '<div class="bar"><div class="sure"></div><div class="learned"></div></div>';
    row.querySelector(".name").textContent = theme;
    row.querySelector(".numbers").textContent = `${learned} von ${total} gelernt, ${sure} sicher`;
    row.querySelector(".sure").style.width = `${(sure / total) * 100}%`;
    row.querySelector(".learned").style.width = `${((learned - sure) / total) * 100}%`;
    list.appendChild(row);
  }

  // Vorschau: wie viele Wiederholungen an den nächsten 7 Tagen anstehen
  const forecast = dueForecast(cards, states, today());
  const max = Math.max(1, ...forecast.map(f => f.count));
  const weekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  $("stats-forecast").innerHTML = forecast
    .map(({ day, count }, i) => {
      const [y, m, d] = day.split("-").map(Number);
      const label = i === 0 ? "heute" : weekdays[new Date(y, m - 1, d).getDay()];
      return `<div class="col"><div class="num">${count}</div>` +
        `<div class="pillar" style="height:${(count / max) * 70}px"></div>` +
        `<div class="day">${label}</div></div>`;
    })
    .join("");

  showView("stats");
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
$("focus-select").addEventListener("change", changeFocus);
$("practice-button").addEventListener("click", startPractice);
$("overview-button").addEventListener("click", showOverview);
$("listen-button").addEventListener("click", startListen);
$("listen-close").addEventListener("click", showHome);
$("listen-home").addEventListener("click", showHome);
$("listen-again").addEventListener("click", startListen);
$("listen-next").addEventListener("click", nextQuestion);
$("listen-speak").addEventListener("click", () => speak(quiz[quizIndex].card.thai, RATE_NORMAL));
$("listen-speak-slow").addEventListener("click", () => speak(quiz[quizIndex].card.thai, RATE_SLOW));
$("stats-button").addEventListener("click", showStats);
$("record-button").addEventListener("click", toggleRecording);
$("play-own").addEventListener("click", playRecording);
$("check-button").addEventListener("click", checkPronunciation);
$("stats-close").addEventListener("click", showHome);
$("overview-close").addEventListener("click", showHome);
$("round-close").addEventListener("click", () => {
  resetVoice();
  showHome();
});
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
