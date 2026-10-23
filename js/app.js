// Hauptdatei der App: verbindet Anzeige (index.html), Logik (leitner.js),
// Speicher (storage.js) und Sprachausgabe (speech.js).

import { buildRound, rateCard, countByBox, unseenCards, practiceRound, themes, streak, toDateString, MAX_NEW_PER_DAY, EXTRA_NEW_STEP } from "./leitner.js";
import { loadStates, saveState, loadMeta, saveMeta } from "./storage.js";
import { initSpeech, speak, RATE_NORMAL, RATE_SLOW } from "./speech.js";
import { listenQuiz, themeStats, dueForecast } from "./extras.js";
import { canRecord, startRecording, stopRecording, playRecording, clearRecording, recordingBlob } from "./recorder.js";
import { curveFromAudio, kanyaCurve, curveSvg } from "./tone-curve.js";
import { endMovement } from "./pitch.js";
import { toneHint, toneRound, toneOf, TONES } from "./tones.js";
import { numberRound, checkNumberAnswer } from "./numbers.js";
import { initDialogs } from "./dialog-view.js";

// Versionsnummer, wird unten auf der Startseite angezeigt.
// Bei jeder Änderung erhöhen, dann sieht man auf dem iPhone, ob die neue Version da ist.
const VERSION = "1.7.3";

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
let numberLevel = 1;  // Stufe der Übung "Zahlen und Preise"
let numberTasks = []; // Aufgaben der laufenden Runde
let numberIndex = 0;
let numberScore = 0;
let toneGroups = [];  // Inhalt von inhalte/toene.json
let toneQuiz = [];    // Fragen der Übung "Töne hören"
let toneIndex = 0;
let toneScore = 0;

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
  for (const view of ["home", "round", "listen-menu", "listen", "numbers", "tones", "stats", "overview", "dialog-list", "dialog"]) {
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
// Eine Taste "Halten und sprechen": solange sie gedrückt ist, nimmt die App auf.
// Beim Loslassen:
//   - "▶ Ich" spielt die eigene Aufnahme ab (zum Vergleich mit "▶ Normal")
//   - die Ton-Kurve zeigt die eigene Tonhöhe neben der von Kanya.
// Die Spracherkennung des Geräts ("verstanden ja/nein") ist seit Stufe 5 aus:
// In Home-Bildschirm-Apps auf iOS 27 hört sie nach der ersten Karte nichts mehr.

const MIN_HOLD_MS = 400;      // kürzer gilt als versehentliches Antippen
const MAX_HOLD_MS = 8000;     // danach endet die Aufnahme von selbst

let holding = false;
let holdStart = 0;
let holdTimer = null;
let voiceCard = null;         // Karte, zu der gerade gesprochen wird

function resetVoice() {
  holding = false;
  clearTimeout(holdTimer);
  clearRecording();
  $("voice-row").hidden = !canRecord();
  $("hold-button").textContent = "🎙 Halten und sprechen";
  $("hold-button").classList.remove("active");
  $("play-own").hidden = true;
  $("voice-result").hidden = true;
  $("tone-curve").hidden = true;
}

function showVoiceResult(text, kind = "") {
  $("voice-result").textContent = text;
  $("voice-result").className = `voice-result ${kind}`;
  $("voice-result").hidden = false;
}

async function holdStartHandler(event) {
  event.preventDefault();
  if (holding) return;
  holding = true;
  holdStart = Date.now();
  voiceCard = current;
  speechSynthesis.cancel();
  $("hold-button").textContent = "🔴 Ich höre zu … (loslassen = fertig)";
  $("hold-button").classList.add("active");
  $("play-own").hidden = true;
  $("voice-result").hidden = true;
  $("tone-curve").hidden = true;
  holdTimer = setTimeout(holdEndHandler, MAX_HOLD_MS);
  kanyaCurve(current);   // Kanyas Kurve schon mal vorbereiten

  try {
    await startRecording();
  } catch {
    holding = false;
    clearTimeout(holdTimer);
    $("hold-button").textContent = "🎙 Halten und sprechen";
    $("hold-button").classList.remove("active");
    showVoiceResult("Kein Zugriff auf das Mikrofon. Bitte in den Einstellungen erlauben.", "no");
  }
}

async function holdEndHandler() {
  if (!holding) return;
  holding = false;
  clearTimeout(holdTimer);
  $("hold-button").textContent = "🎙 Nochmal sprechen";
  $("hold-button").classList.remove("active");

  if (Date.now() - holdStart < MIN_HOLD_MS) {
    await stopRecording();
    showVoiceResult("Taste gedrückt halten, solange du sprichst, dann loslassen.");
    return;
  }

  showVoiceResult("Einen Moment …");
  try {
    const hasRecording = await stopRecording();
    if (voiceCard !== current) return;   // inzwischen weitergeblättert
    $("play-own").hidden = !hasRecording;
    if (!hasRecording) {
      showVoiceResult("Keine Aufnahme. Bitte nochmal halten und sprechen.", "no");
      return;
    }
    await showToneCurve(voiceCard);
  } catch {
    showVoiceResult(`Ton-Kurve konnte nicht berechnet werden. Vergleichen geht trotzdem mit ▶ Normal und ▶ Ich.`, "no");
  }
}

// Eigene Kurve und Kanyas Kurve zeigen, bei einsilbigen Karten mit Ton-Hinweis
async function showToneCurve(card) {
  const [own, kanya] = await Promise.all([curveFromAudio(recordingBlob()), kanyaCurve(card)]);
  if (card !== current) return;
  if (own.length === 0) {
    showVoiceResult(`Keine Stimme erkannt. Nochmal halten, deutlich sprechen und erst danach loslassen.`, "no");
    return;
  }
  $("tone-curve-svg").innerHTML = curveSvg(own, kanya);
  $("tone-curve-kanya").hidden = !kanya;
  $("tone-curve").hidden = false;

  // Nur wenig Stimme gefunden (z. B. sehr kurze oder geflüsterte Silben)
  const voicedShare = own.filter(Boolean).length / own.length;
  const tip = voicedShare < 0.3 ? " Tipp: Nur wenig Stimme erkannt. Sprich die Vokale etwas länger und lauter." : "";

  const hint = toneHint(card.umschrift, endMovement(own));
  if (hint) showVoiceResult(hint.text + tip, hint.kind);
  else showVoiceResult("Vergleiche den Verlauf: geht deine Linie an denselben Stellen hoch und runter wie die graue?" + tip);
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

// ---------- Zahlen und Preise ----------
// Die App spricht eine Zahl oder einen Preis, man tippt die Zahl ein.
// Zählt nicht für die Fächer.

function startNumbers(level) {
  numberLevel = level;
  numberTasks = numberRound(level);
  numberIndex = 0;
  numberScore = 0;
  $("numbers-result").hidden = true;
  showView("numbers");
  showNumberTask();
}

function showNumberTask() {
  const task = numberTasks[numberIndex];
  $("numbers-counter").textContent = `Aufgabe ${numberIndex + 1} von ${numberTasks.length}`;
  $("numbers-question").hidden = false;
  $("numbers-input").value = "";
  $("numbers-input").disabled = false;
  $("numbers-check").hidden = false;
  $("numbers-feedback").hidden = true;
  $("numbers-solution").hidden = true;
  $("numbers-next").hidden = true;
  $("numbers-input").focus();
  speak(task.thai);
}

function checkNumber(event) {
  event.preventDefault();
  const task = numberTasks[numberIndex];
  if ($("numbers-input").value.trim() === "") return;
  const right = checkNumberAnswer(task, $("numbers-input").value);
  if (right) numberScore++;

  const label = numberLevel === 3 ? `${task.number} Baht` : `${task.number}`;
  $("numbers-feedback").textContent = right ? `✓ Richtig: ${label}` : `✗ Richtig wäre: ${label}`;
  $("numbers-feedback").className = `number-feedback ${right ? "right" : "wrong"}`;
  $("numbers-feedback").hidden = false;
  $("numbers-solution").textContent = task.umschrift;
  $("numbers-solution").hidden = false;
  $("numbers-input").disabled = true;
  $("numbers-check").hidden = true;
  $("numbers-next").hidden = false;
  $("numbers-input").blur();
}

function nextNumber() {
  numberIndex++;
  if (numberIndex < numberTasks.length) {
    showNumberTask();
    return;
  }
  $("numbers-question").hidden = true;
  $("numbers-next").hidden = true;
  $("numbers-counter").textContent = "";
  $("numbers-score").textContent = `${numberScore} von ${numberTasks.length}`;
  $("numbers-result").hidden = false;
}

// ---------- Töne hören ----------
// Kanya sagt ein Wort, man wählt zwischen Umschriften, die sich nur im Ton
// unterscheiden. Zählt nicht für die Fächer.

async function startTones() {
  if (toneGroups.length === 0) {
    const response = await fetch("inhalte/toene.json", { cache: "no-cache" });
    toneGroups = await response.json();
  }
  toneQuiz = toneRound(toneGroups);
  toneIndex = 0;
  toneScore = 0;
  $("tones-result").hidden = true;
  showView("tones");
  showToneQuestion();
}

function showToneQuestion() {
  const { word, options } = toneQuiz[toneIndex];
  $("tones-counter").textContent = `Frage ${toneIndex + 1} von ${toneQuiz.length}`;
  $("tones-question").hidden = false;
  $("tones-solution").hidden = true;
  $("tones-next").hidden = true;

  const list = $("tones-options");
  list.innerHTML = "";
  for (const option of options) {
    const button = document.createElement("button");
    button.innerHTML = '<span class="syllable"></span><span class="meaning"></span>';
    button.querySelector(".syllable").textContent = option.umschrift;
    button.addEventListener("click", () => answerTone(button, option));
    button.dataset.umschrift = option.umschrift;
    list.appendChild(button);
  }
  speak(word.thai);
}

// Ton als kurzer Text, z. B. "fallend (â)"
function toneLabel(umschrift) {
  const tone = toneOf(umschrift);
  return tone === "mittel" ? "mittel (keine Marke)" : `${tone} (${TONES[tone].mark})`;
}

function answerTone(chosen, option) {
  const { word, options } = toneQuiz[toneIndex];
  const correct = option === word;
  if (correct) toneScore++;
  // Nach der Antwort bei allen Tasten Bedeutung und Ton zeigen
  for (const button of $("tones-options").querySelectorAll("button")) {
    const shown = options.find(o => o.umschrift === button.dataset.umschrift);
    button.querySelector(".meaning").textContent = `${shown.deutsch} · ${toneLabel(shown.umschrift)}`;
    if (shown === word) button.classList.add("right");
    button.disabled = true;
  }
  if (!correct) chosen.classList.add("wrong");
  $("tones-solution").textContent = correct
    ? `✓ Richtig: ${word.umschrift} = ${word.deutsch}`
    : `✗ Es war ${word.umschrift} = ${word.deutsch}`;
  $("tones-solution").className = `tone-solution ${correct ? "right" : "wrong"}`;
  $("tones-solution").hidden = false;
  $("tones-next").hidden = false;
}

function nextToneQuestion() {
  toneIndex++;
  if (toneIndex < toneQuiz.length) {
    showToneQuestion();
    return;
  }
  $("tones-question").hidden = true;
  $("tones-options").innerHTML = "";
  $("tones-next").hidden = true;
  $("tones-counter").textContent = "";
  $("tones-score").textContent = `${toneScore} von ${toneQuiz.length}`;
  $("tones-result").hidden = false;
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
  // Karten nach Einheit gruppieren, in der Reihenfolge der Vokabeldatei
  // (Map statt Objekt: bei einem Objekt kämen "4" bis "11" vor "3a")
  const units = new Map();
  for (const card of cards) {
    if (!units.has(card.einheit)) units.set(card.einheit, []);
    units.get(card.einheit).push(card);
  }

  const list = $("overview-list");
  list.innerHTML = "";
  for (const [unit, unitCards] of units) {
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
$("listen-button").addEventListener("click", () => showView("listen-menu"));
$("listen-menu-close").addEventListener("click", showHome);
$("listen-words").addEventListener("click", startListen);
$("listen-tones").addEventListener("click", startTones);
$("tones-close").addEventListener("click", showHome);
$("tones-home").addEventListener("click", showHome);
$("tones-again").addEventListener("click", startTones);
$("tones-next").addEventListener("click", nextToneQuestion);
$("tones-speak").addEventListener("click", () => speak(toneQuiz[toneIndex].word.thai, RATE_NORMAL));
$("tones-speak-slow").addEventListener("click", () => speak(toneQuiz[toneIndex].word.thai, RATE_SLOW));
for (const button of document.querySelectorAll("[data-number-level]")) {
  button.addEventListener("click", () => startNumbers(Number(button.dataset.numberLevel)));
}
$("numbers-form").addEventListener("submit", checkNumber);
$("numbers-next").addEventListener("click", nextNumber);
$("numbers-close").addEventListener("click", showHome);
$("numbers-home").addEventListener("click", showHome);
$("numbers-again").addEventListener("click", () => startNumbers(numberLevel));
$("numbers-speak").addEventListener("click", () => speak(numberTasks[numberIndex].thai, RATE_NORMAL));
$("numbers-speak-slow").addEventListener("click", () => speak(numberTasks[numberIndex].thai, RATE_SLOW));
$("listen-close").addEventListener("click", showHome);
$("listen-home").addEventListener("click", showHome);
$("listen-again").addEventListener("click", startListen);
$("listen-next").addEventListener("click", nextQuestion);
$("listen-speak").addEventListener("click", () => speak(quiz[quizIndex].card.thai, RATE_NORMAL));
$("listen-speak-slow").addEventListener("click", () => speak(quiz[quizIndex].card.thai, RATE_SLOW));
$("stats-button").addEventListener("click", showStats);
initDialogs({ showView, showHome });
// Halten und sprechen: Pointer-Ereignisse gelten für Finger und Maus
$("hold-button").addEventListener("pointerdown", holdStartHandler);
for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
  $("hold-button").addEventListener(type, holdEndHandler);
}
$("hold-button").addEventListener("contextmenu", event => event.preventDefault());
$("play-own").addEventListener("click", playRecording);
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
