// Hauptdatei der App: verbindet Anzeige (index.html), Logik (leitner.js),
// Speicher (storage.js) und Sprachausgabe (speech.js).

import { buildRound, rateCard, countByBox, unseenCards, practiceRound, themes, streak, toDateString, MAX_NEW_PER_DAY, EXTRA_NEW_STEP } from "./leitner.js";
import { loadStates, saveState, loadMeta, saveMeta, requestPersistence, exportAll, importAll } from "./storage.js";
import { buildBackup, parseBackup, backupFileName } from "./backup.js";
import { initSpeech, play, stopSpeaking, RATE_NORMAL, RATE_SLOW } from "./speech.js";
import { cardAudio, toneAudio } from "./audio-files.js";
import { listenQuiz, themeStats, dueForecast, matchesSearch, todayText } from "./extras.js";
import { canRecord, startRecording, stopRecording, playRecording, clearRecording, recordingBlob } from "./recorder.js";
import { curveFromAudio, kanyaCurve, curveSvg } from "./tone-curve.js";
import { endMovement } from "./pitch.js";
import { toneHint, toneRound, toneOf, TONES } from "./tones.js";
import { numberRound, checkNumberAnswer } from "./numbers.js";
import { initDialogs, resetDialogs } from "./dialog-view.js";
import { t, language, setLanguage, translatePage, localizeCards, localizeAreas, localizeToneGroups, themeName } from "./sprache.js";

// Versionsnummer, wird unten auf der Startseite angezeigt.
// Bei jeder Änderung erhöhen, dann sieht man auf dem iPhone, ob die neue Version da ist.
const VERSION = "1.8.2";

// Adresse der App, die beim Teilen verschickt wird
const APP_URL = "https://aod-fi.github.io/thai-app/";

// Kurzschreibweise, um ein Element über seine id zu finden
const $ = id => document.getElementById(id);

// Zustand der App, solange sie geöffnet ist
let rawCards = [];    // Karten aus vokabeln.json, wie sie in der Datei stehen
let rawAreas = [];    // Bereiche aus bereiche.json, wie sie in der Datei stehen
let cards = [];       // alle Karten, Texte in der gewählten Sprache
let states = {};      // Lernstand pro Karte
let queue = [];       // Karten der laufenden Runde, die noch dran kommen
let roundSize = 0;    // Anzahl Karten zu Beginn der Runde
let current = null;   // Karte, die gerade angezeigt wird
let direction = "";   // "hoeren" (Hören → Deutsch) oder "sprechen" (Deutsch → Thai)
let focus = "";       // Fokus für neue Karten: "" = alle Themen, ein Thema oder "bereich:<id>"
let areas = [];       // Bereiche aus inhalte/bereiche.json
let openArea = "";    // aufgeklappter Bereich auf der Themen-Seite
let practice = false; // true = freies Üben, Bewertungen ändern keinen Lernstand
let introduced = new Set(); // neue Karten, die in dieser Runde schon vorgestellt wurden
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

// Karte vorlesen: Kanyas Tondatei, sonst die Thai-Stimme des Geräts
const sayCard = (card, rate = RATE_NORMAL) => play(cardAudio(card), card.thai, rate);

// ---------- Start ----------

async function start() {
  // "no-cache": immer nachsehen, ob es neue Vokabeln gibt
  const response = await fetch("inhalte/vokabeln.json", { cache: "no-cache" });
  rawCards = await response.json();
  states = await loadStates();
  rawAreas = await (await fetch("inhalte/bereiche.json", { cache: "no-cache" })).json();
  applyLanguage();
  focus = await loadMeta("focus", "");
  if (!validFocus(focus)) focus = "";
  $("version").textContent = VERSION;
  showHome();
  requestPersistence();

  const hasVoice = await initSpeech();
  $("voice-warning").hidden = hasVoice;
}

// Texte der Seite und der Inhalte in der gewählten Sprache
function applyLanguage() {
  areas = localizeAreas(rawAreas);
  cards = localizeCards(rawCards);
  toneGroups = [];   // werden bei Bedarf in der neuen Sprache geladen
  resetDialogs();
  translatePage();
  $("lang-de").classList.toggle("on", language() === "de");
  $("lang-en").classList.toggle("on", language() === "en");
}

function switchLanguage(value) {
  setLanguage(value);
  applyLanguage();
  showHome();
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
  return buildRound(cards, states, today(), await newSeenToday(), await newLimitToday(), focusThemes());
}

// ---------- Ansichten wechseln ----------

function showView(name) {
  for (const view of ["home", "round", "listen-menu", "listen", "numbers", "tones", "stats", "overview", "dialog-list", "dialog", "topics", "info"]) {
    $(`view-${view}`).hidden = view !== name;
  }
  window.scrollTo(0, 0);
}

// ---------- Startseite ----------

async function showHome() {
  const round = await todaysRound();
  $("due-count").textContent = todayText(round, states);
  // Nichts fällig: das sagt schon die Taste "Heute alles erledigt", kein zweiter Hinweis
  $("today-panel").hidden = round.length === 0;
  $("start-button").disabled = round.length === 0;
  $("start-button").textContent = round.length === 0 ? t("Heute alles erledigt 🎉") : t("Lernrunde starten");

  // Ist heute alles erledigt und gibt es noch ungelernte Karten,
  // kann man freiwillig weitere neue Karten lernen.
  const fresh = unseenCards(cards, states, focusThemes()).length;
  $("more-button").hidden = round.length > 0 || fresh === 0;

  // Aktuelle Wahl "Neue Karten aus", Antippen öffnet die Themen-Seite
  const area = focusArea();
  $("focus-name").textContent = area ? `${area.emoji} ${area.name}` : focus ? themeName(focus) : t("🎲 Alle Themen gemischt");
  $("focus-info").textContent = area ? t("alle {n} Themen · {fresh} neu", { n: area.themen.length, fresh }) : t("{fresh} neu", { fresh });
  $("practice-button").textContent = t("Frei üben: {what}", { what: area ? area.name : focus ? themeName(focus) : t("alle Themen") });
  $("listen-focus").textContent = t("Wörter aus: {what}", { what: area ? `${area.emoji} ${area.name}` : focus ? themeName(focus) : t("allen Themen") });

  $("boxes").innerHTML = boxesHtml();

  const days = streak(await loadMeta("learnedDays", []), today());
  $("streak").textContent = t(days === 1 ? "{n} Lerntag in Folge" : "{n} Lerntage in Folge", { n: days });
  showView("home");
}

// Fächer-Anzeige (Startseite und Statistik)
function boxesHtml() {
  const counts = countByBox(cards, states);
  const labels = [t("neu"), ...[1, 2, 3, 4, 5].map(n => t("Fach {n}", { n }))];
  return counts
    .map((count, i) => `<div><div class="count">${count}</div><div class="label">${labels[i]}</div></div>`)
    .join("");
}

// ---------- Lernrunde ----------

async function startRound() {
  practice = false;
  introduced = new Set();
  queue = await todaysRound();
  // Neue Karten kommen zweimal dran: erst vorstellen, am Ende der Runde abfragen
  roundSize = queue.length + queue.filter(card => !states[card.id]).length;
  showView("round");
  showNextCard();
}

// Freies Üben: Karten des gewählten Themas, ohne Einfluss auf die Fächer
function startPractice() {
  practice = true;
  introduced = new Set();
  queue = practiceRound(cards, focusThemes());
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

  // Noch offen: diese Karte, der Rest der Runde und die Abfragen noch nicht vorgestellter neuer Karten
  const pendingIntros = practice ? 0 : [current, ...queue].filter(card => !states[card.id] && !introduced.has(card.id)).length;
  $("round-counter").textContent = t("noch {n} von {total}", { n: queue.length + 1 + pendingIntros, total: roundSize });
  const badges = [];
  if (practice) badges.push(t("Freies Üben"));
  if (isNew) badges.push(t(introduced.has(current.id) ? "Neu · Abfrage" : "Neu"));
  if (current.aufpassen) badges.push(t("⚠ Aufpassen"));
  $("card-badges").innerHTML = badges.map(b => `<span class="badge">${b}</span>`).join("");

  // Neue Karte zum ersten Mal: nur vorstellen (Lernrunde) bzw. gleich die Lösung zeigen
  // (freies Üben). In der Lernrunde kommt sie am Ende der Runde zum Abfragen wieder.
  if (isNew && !introduced.has(current.id)) {
    if (practice) {
      showBack();
    } else {
      introduced.add(current.id);
      queue.push(current);
      showBack(true);
    }
    return;
  }

  $("card-front").hidden = false;
  $("card-back").hidden = true;
  $("flip-button").hidden = false;
  $("rating-buttons").hidden = true;
  $("intro-buttons").hidden = true;

  if (direction === "hoeren") {
    $("front-hint").textContent = t("Hör zu: Was bedeutet das?");
    $("front-text").textContent = "🔊";
    $("front-speak").hidden = false;
    sayCard(current);
  } else {
    $("front-hint").textContent = t("Sag es laut auf Thai:");
    $("front-text").textContent = current.deutsch;
    $("front-speak").hidden = true;
  }
}

// intro = true: neue Karte wird nur vorgestellt, statt Bewerten gibt es "Gemerkt, weiter"
function showBack(intro = false) {
  $("card-front").hidden = true;
  $("card-back").hidden = false;
  $("flip-button").hidden = true;
  $("rating-buttons").hidden = intro;
  $("intro-buttons").hidden = !intro;

  $("back-umschrift").textContent = current.umschrift;
  $("back-deutsch").textContent = current.deutsch;
  $("back-merkhilfe").textContent = current.merkhilfe ? "💡 " + current.merkhilfe : "";
  $("back-beispiel-text").textContent = current.beispiel ? t("z. B. ") + current.beispiel : "";
  $("back-beispiel-speak").hidden = !(current.beispiel && current.beispiel_thai);
  $("back-beispiel-speak").setAttribute("aria-label", t("Beispiel anhören"));

  resetVoice();

  // Nach dem Umdrehen die richtige Aussprache vorspielen
  sayCard(current);
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
  $("hold-button").textContent = t("🎙 Halten und sprechen");
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
  stopSpeaking();   // Kanya darf nicht in die Aufnahme sprechen
  $("hold-button").textContent = t("🔴 Ich höre zu … (loslassen = fertig)");
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
    $("hold-button").textContent = t("🎙 Halten und sprechen");
    $("hold-button").classList.remove("active");
    showVoiceResult(t("Kein Zugriff auf das Mikrofon. Bitte in den Einstellungen erlauben."), "no");
  }
}

async function holdEndHandler() {
  if (!holding) return;
  holding = false;
  clearTimeout(holdTimer);
  $("hold-button").textContent = t("🎙 Nochmal sprechen");
  $("hold-button").classList.remove("active");

  if (Date.now() - holdStart < MIN_HOLD_MS) {
    await stopRecording();
    showVoiceResult(t("Taste gedrückt halten, solange du sprichst, dann loslassen."));
    return;
  }

  showVoiceResult(t("Einen Moment …"));
  try {
    const hasRecording = await stopRecording();
    if (voiceCard !== current) return;   // inzwischen weitergeblättert
    $("play-own").hidden = !hasRecording;
    if (!hasRecording) {
      showVoiceResult(t("Keine Aufnahme. Bitte nochmal halten und sprechen."), "no");
      return;
    }
    await showToneCurve(voiceCard);
  } catch {
    showVoiceResult(t("Ton-Kurve konnte nicht berechnet werden. Vergleichen geht trotzdem mit ▶ Normal und ▶ Ich."), "no");
  }
}

// Eigene Kurve und Kanyas Kurve zeigen, bei einsilbigen Karten mit Ton-Hinweis
async function showToneCurve(card) {
  const [own, kanya] = await Promise.all([curveFromAudio(recordingBlob()), kanyaCurve(card)]);
  if (card !== current) return;
  if (own.length === 0) {
    showVoiceResult(t("Keine Stimme erkannt. Nochmal halten, deutlich sprechen und erst danach loslassen."), "no");
    return;
  }
  $("tone-curve-svg").innerHTML = curveSvg(own, kanya);
  $("tone-curve-kanya").hidden = !kanya;
  $("tone-curve").hidden = false;

  // Nur wenig Stimme gefunden (z. B. sehr kurze oder geflüsterte Silben)
  const voicedShare = own.filter(Boolean).length / own.length;
  const tip = voicedShare < 0.3 ? " " + t("Tipp: Nur wenig Stimme erkannt. Sprich die Vokale etwas länger und lauter.") : "";

  const hint = toneHint(card.umschrift, endMovement(own));
  if (hint) showVoiceResult(hint.text + tip, hint.kind);
  else showVoiceResult(t("Vergleiche den Verlauf: geht deine Linie an denselben Stellen hoch und runter wie die graue?") + tip);
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

// ---------- Themen-Seite ("Neue Karten aus …") ----------
// Die Themen sind in Bereiche gegliedert (inhalte/bereiche.json).
// Antippen eines Bereichs wählt den ganzen Bereich, der Pfeil klappt ihn auf.

const AREA_PREFIX = "bereich:";

// Gewählter Bereich, oder undefined, wenn ein Thema oder alle Themen gewählt sind
function focusArea() {
  return areas.find(area => AREA_PREFIX + area.id === focus);
}

// Fokus als Thema ("Taxi"), Liste von Themen (Bereich) oder "" (alle)
function focusThemes() {
  const area = focusArea();
  return area ? area.themen : focus;
}

function validFocus(value) {
  return value === "" || themes(cards).includes(value) || areas.some(area => AREA_PREFIX + area.id === value);
}

// Bereiche mit ihren Themen, die es in den Karten gibt.
// Themen, die in keinem Bereich stehen, landen unter "Weitere".
function areaGroups() {
  const all = themes(cards);
  const groups = areas
    .map(area => ({ ...area, themen: area.themen.filter(theme => all.includes(theme)) }))
    .filter(area => area.themen.length > 0);
  const rest = all.filter(theme => !areas.some(area => area.themen.includes(theme)));
  if (rest.length > 0) groups.push({ id: "weitere", name: t("Weitere"), emoji: "📦", themen: rest });
  return groups;
}

// Fortschrittsbalken: grün = sicher (ab Fach 4), gelb = gelernt
function barHtml(total, learned, sure) {
  return `<div class="bar"><div class="sure" style="width:${(sure / total) * 100}%"></div>` +
    `<div class="learned" style="width:${((learned - sure) / total) * 100}%"></div></div>`;
}

async function chooseFocus(value) {
  focus = value;
  await saveMeta("focus", focus);
  showHome();
}

function showTopics() {
  const stats = new Map(themeStats(cards, states).map(s => [s.theme, s]));
  const fresh = list => unseenCards(cards, states, list).length;
  const list = $("topics-list");
  list.innerHTML = "";

  // Erste Zeile: alle Themen gemischt
  const all = document.createElement("button");
  all.className = "area-all" + (focus === "" ? " chosen" : "");
  all.innerHTML = '<span></span><span class="muted"></span>';
  all.firstChild.textContent = t("🎲 Alle Themen gemischt");
  all.lastChild.textContent = t("{fresh} neu", { fresh: fresh("") });
  all.addEventListener("click", () => chooseFocus(""));
  list.appendChild(all);

  for (const area of areaGroups()) {
    const value = AREA_PREFIX + area.id;
    const isOpen = openArea === area.id;
    const box = document.createElement("div");
    box.className = "area" + (focus === value ? " chosen" : "");

    const head = document.createElement("div");
    head.className = "area-head";
    head.innerHTML = '<button class="area-name"></button><button class="area-toggle"></button>';
    head.querySelector(".area-name").textContent = `${area.emoji} ${area.name}` + (focus === value ? " ✓" : "");
    head.querySelector(".area-toggle").textContent = t("{fresh} neu", { fresh: fresh(area.themen) }) + (isOpen ? " ⌄" : " ›");
    head.querySelector(".area-name").addEventListener("click", () => chooseFocus(value));
    head.querySelector(".area-toggle").addEventListener("click", () => {
      openArea = isOpen ? "" : area.id;
      showTopics();
    });
    box.appendChild(head);

    const sum = key => area.themen.reduce((n, theme) => n + stats.get(theme)[key], 0);
    box.insertAdjacentHTML("beforeend", barHtml(sum("total"), sum("learned"), sum("sure")));

    if (isOpen) {
      for (const theme of area.themen) {
        const row = document.createElement("button");
        row.className = "area-theme" + (focus === theme ? " chosen" : "");
        row.innerHTML = '<span></span><span class="muted"></span>';
        row.firstChild.textContent = themeName(theme) + (focus === theme ? " ✓" : "");
        row.lastChild.textContent = t("{fresh} neu", { fresh: fresh(theme) });
        row.addEventListener("click", () => chooseFocus(theme));
        box.appendChild(row);
      }
    }
    list.appendChild(box);
  }
  showView("topics");
}

function openTopics() {
  // Aufgeklappt ist der Bereich, in dem die aktuelle Wahl liegt
  const area = focusArea() || areaGroups().find(group => group.themen.includes(focus));
  openArea = area ? area.id : "";
  showTopics();
}

// ---------- Hörübung ----------
// Die App spricht, man wählt die Bedeutung. Zählt nicht für die Fächer.

function startListen() {
  quiz = listenQuiz(cards, states, focusThemes());
  quizIndex = 0;
  quizScore = 0;
  $("listen-result").hidden = true;
  showView("listen");
  showQuestion();
}

function showQuestion() {
  const { card, options } = quiz[quizIndex];
  $("listen-counter").textContent = t("Frage {n} von {total}", { n: quizIndex + 1, total: quiz.length });
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
  sayCard(card);
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
  $("listen-score").textContent = t("{n} von {total}", { n: quizScore, total: quiz.length });
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
  $("numbers-counter").textContent = t("Aufgabe {n} von {total}", { n: numberIndex + 1, total: numberTasks.length });
  $("numbers-question").hidden = false;
  $("numbers-input").value = "";
  $("numbers-input").disabled = false;
  $("numbers-check").hidden = false;
  $("numbers-feedback").hidden = true;
  $("numbers-solution").hidden = true;
  $("numbers-next").hidden = true;
  $("numbers-input").focus();
  sayNumber(task);
}

// Zahl oder Preis vorlesen: Gibt es eine Karte mit genau diesem Thai (z. B. zahl-7,
// preis-40), spielt Kanyas Tondatei, sonst spricht die Thai-Stimme des Geräts.
function sayNumber(task, rate = RATE_NORMAL) {
  const card = rawCards.find(c => c.thai === task.thai);
  play(card ? cardAudio(card) : "", task.thai, rate);
}

function checkNumber(event) {
  event.preventDefault();
  const task = numberTasks[numberIndex];
  if ($("numbers-input").value.trim() === "") return;
  const right = checkNumberAnswer(task, $("numbers-input").value);
  if (right) numberScore++;

  const label = numberLevel === 3 ? `${task.number} Baht` : `${task.number}`;
  $("numbers-feedback").textContent = t(right ? "✓ Richtig: {label}" : "✗ Richtig wäre: {label}", { label });
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
  $("numbers-score").textContent = t("{n} von {total}", { n: numberScore, total: numberTasks.length });
  $("numbers-result").hidden = false;
}

// ---------- Töne hören ----------
// Kanya sagt ein Wort, man wählt zwischen Umschriften, die sich nur im Ton
// unterscheiden. Zählt nicht für die Fächer.

async function startTones() {
  if (toneGroups.length === 0) {
    const response = await fetch("inhalte/toene.json", { cache: "no-cache" });
    toneGroups = localizeToneGroups(await response.json());
    for (const group of toneGroups) group.woerter.forEach((word, i) => { word.audio = toneAudio(group, i); });
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
  $("tones-counter").textContent = t("Frage {n} von {total}", { n: toneIndex + 1, total: toneQuiz.length });
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
  play(word.audio, word.thai);
}

// Ton als kurzer Text, z. B. "fallend (â)"
function toneLabel(umschrift) {
  const tone = toneOf(umschrift);
  return tone === "mittel" ? t("mittel (keine Marke)") : `${t(tone)} (${TONES[tone].mark})`;
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
    ? t("✓ Richtig: {u} = {d}", { u: word.umschrift, d: word.deutsch })
    : t("✗ Es war {u} = {d}", { u: word.umschrift, d: word.deutsch });
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
  $("tones-score").textContent = t("{n} von {total}", { n: toneScore, total: toneQuiz.length });
  $("tones-result").hidden = false;
}

// ---------- Statistik ----------

async function showStats() {
  const learnedDays = await loadMeta("learnedDays", []);
  $("stats-streak").textContent = streak(learnedDays, today());
  $("stats-days").textContent = learnedDays.length;
  $("stats-boxes").innerHTML = boxesHtml();

  // Pro Thema, nach Bereichen: Balken, grün = sicher (ab Fach 4), gelb = gelernt
  const list = $("stats-themes");
  list.innerHTML = "";
  const stats = new Map(themeStats(cards, states).map(s => [s.theme, s]));
  for (const area of areaGroups()) {
    const title = document.createElement("h3");
    title.className = "area-title";
    title.textContent = `${area.emoji} ${area.name}`;
    list.appendChild(title);
    for (const theme of area.themen) {
      const { total, learned, sure } = stats.get(theme);
      const row = document.createElement("div");
      row.className = "theme-row";
      row.innerHTML =
        '<div class="theme-head"><span class="name"></span><span class="muted numbers"></span></div>' +
        '<div class="bar"><div class="sure"></div><div class="learned"></div></div>';
      row.querySelector(".name").textContent = themeName(theme);
      row.querySelector(".numbers").textContent = t("{learned} von {total} gelernt, {sure} sicher", { learned, total, sure });
      row.querySelector(".sure").style.width = `${(sure / total) * 100}%`;
      row.querySelector(".learned").style.width = `${((learned - sure) / total) * 100}%`;
      list.appendChild(row);
    }
  }

  // Vorschau: wie viele Wiederholungen an den nächsten 7 Tagen anstehen
  const forecast = dueForecast(cards, states, today());
  const max = Math.max(1, ...forecast.map(f => f.count));
  const weekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"].map(day => t(day));
  $("stats-forecast").innerHTML = forecast
    .map(({ day, count }, i) => {
      const [y, m, d] = day.split("-").map(Number);
      const label = i === 0 ? t("heute") : weekdays[new Date(y, m - 1, d).getDay()];
      return `<div class="col"><div class="num">${count}</div>` +
        `<div class="pillar" style="height:${(count / max) * 70}px"></div>` +
        `<div class="day">${label}</div></div>`;
    })
    .join("");

  $("backup-message").hidden = true;
  showView("stats");
}

// ---------- Lernstand sichern und laden ----------

function showBackupMessage(text) {
  $("backup-message").textContent = text;
  $("backup-message").hidden = false;
}

// Speichert den Lernstand als Datei. Auf dem iPhone öffnet sich das Teilen-Menü,
// dort "In Dateien sichern" wählen. Sonst wird die Datei heruntergeladen.
async function saveBackup() {
  const backup = buildBackup(await exportAll(), VERSION);
  const name = backupFileName(today());
  const file = new File([JSON.stringify(backup, null, 1)], name, { type: "application/json" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: t("MyThai Lernstand") });
      showBackupMessage(t("✓ Gesichert. Tipp: „In Dateien sichern“ und iCloud Drive wählen."));
    } catch (error) {
      if (error.name !== "AbortError") showBackupMessage(t("Sichern hat nicht geklappt. Bitte nochmal versuchen."));
    }
    return;
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  showBackupMessage(t("✓ Gesichert als „{name}“ (Ordner Downloads).", { name }));
}

// Lädt eine Sicherungsdatei und ersetzt nach Rückfrage den Lernstand auf diesem Gerät
async function loadBackup(event) {
  const file = event.target.files[0];
  event.target.value = "";   // dieselbe Datei später nochmal wählbar
  if (!file) return;
  let backup;
  try {
    backup = parseBackup(await file.text());
  } catch (error) {
    showBackupMessage(error.message);
    return;
  }
  const count = Object.keys(backup.progress).length;
  const date = backup.gesichertAm ? new Date(backup.gesichertAm).toLocaleDateString(language() === "en" ? "en-GB" : "de-DE") : "";
  const question = date ? "Sicherung vom {date} mit {count} gelernten Karten laden?" : "Sicherung mit {count} gelernten Karten laden?";
  if (!confirm(t(question, { date, count }) + "\n" + t("Der jetzige Lernstand auf diesem Gerät wird dabei ersetzt."))) return;
  try {
    await importAll(backup);
  } catch {
    showBackupMessage(t("Laden hat nicht geklappt. Dein bisheriger Lernstand ist unverändert."));
    return;
  }
  states = await loadStates();
  focus = await loadMeta("focus", "");
  if (!validFocus(focus)) focus = "";
  await showStats();
  showBackupMessage(t("✓ Lernstand geladen: {count} gelernte Karten.", { count }));
}

// ---------- Info und Teilen ----------

// Info-Seite: Beschreibung aller Funktionen in der gewählten Sprache
function showInfo() {
  for (const block of document.querySelectorAll("#view-info [data-lang]")) {
    block.hidden = block.dataset.lang !== language();
  }
  showView("info");
}

// App teilen: auf dem iPhone öffnet sich das Teilen-Menü (Nachrichten, WhatsApp, Mail …).
// Geht das nicht, wird der Link in die Zwischenablage kopiert.
async function shareApp() {
  const text = t("Ich lerne Thai mit MyThai: Karteikarten mit Aussprache, Hörübungen und kurze Dialoge für den Alltag. Kostenlos, einfach in Safari öffnen und zum Home-Bildschirm hinzufügen:");
  if (navigator.share) {
    try {
      await navigator.share({ title: "MyThai", text, url: APP_URL });
    } catch {
      // abgebrochen: nichts tun
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${text} ${APP_URL}`);
    alert(t("Link kopiert. Du kannst ihn jetzt in eine Nachricht einfügen."));
  } catch {
    prompt(t("Diesen Link kannst du teilen:"), APP_URL);
  }
}

// ---------- Übersicht ----------

function showOverview() {
  $("overview-search").value = "";
  $("overview-search").placeholder = t("Suchen …");
  renderOverview();
  showView("overview");
}

// Karten nach Bereich und Thema gliedern, innerhalb eines Themas
// in der Reihenfolge der Vokabeldatei. Mit Suche nur die passenden Karten
// (gesucht wird in den Feldern der Datei, also Deutsch und Englisch zugleich).
function renderOverview() {
  const query = $("overview-search").value;
  const raw = new Map(rawCards.map(card => [card.id, card]));
  const found = cards.filter(card => matchesSearch(raw.get(card.id), query));
  const list = $("overview-list");
  list.innerHTML = "";
  $("overview-empty").hidden = found.length > 0;
  for (const area of areaGroups()) {
    if (!found.some(card => area.themen.includes(card.thema))) continue;
    const areaTitle = document.createElement("h2");
    areaTitle.className = "area-title";
    areaTitle.textContent = `${area.emoji} ${area.name}`;
    list.appendChild(areaTitle);

    for (const theme of area.themen) {
      const themeCards = found.filter(c => c.thema === theme);
      if (themeCards.length === 0) continue;
      const title = document.createElement("h3");
      title.className = "unit-title";
      title.textContent = themeName(theme);
      list.appendChild(title);

      for (const card of themeCards) {
        const row = document.createElement("div");
        row.className = "row";
        row.innerHTML =
          '<div class="text"><div class="umschrift-small"></div><div class="muted"></div></div>' +
          '<button class="secondary">▶</button><button class="secondary">🐢</button>';
        row.querySelector(".umschrift-small").textContent = card.umschrift + (card.aufpassen ? " ⚠" : "");
        row.querySelector(".muted").textContent = card.deutsch;
        const [normal, slow] = row.querySelectorAll("button");
        normal.addEventListener("click", () => sayCard(card, RATE_NORMAL));
        slow.addEventListener("click", () => sayCard(card, RATE_SLOW));
        list.appendChild(row);
      }
    }
  }
}

// ---------- Tasten verbinden ----------

$("start-button").addEventListener("click", startRound);
$("more-button").addEventListener("click", learnMore);
$("focus-button").addEventListener("click", openTopics);
$("topics-close").addEventListener("click", showHome);
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
$("tones-speak").addEventListener("click", () => play(toneQuiz[toneIndex].word.audio, toneQuiz[toneIndex].word.thai, RATE_NORMAL));
$("tones-speak-slow").addEventListener("click", () => play(toneQuiz[toneIndex].word.audio, toneQuiz[toneIndex].word.thai, RATE_SLOW));
for (const button of document.querySelectorAll("[data-number-level]")) {
  button.addEventListener("click", () => startNumbers(Number(button.dataset.numberLevel)));
}
$("numbers-form").addEventListener("submit", checkNumber);
$("numbers-next").addEventListener("click", nextNumber);
$("numbers-close").addEventListener("click", showHome);
$("numbers-home").addEventListener("click", showHome);
$("numbers-again").addEventListener("click", () => startNumbers(numberLevel));
$("numbers-speak").addEventListener("click", () => sayNumber(numberTasks[numberIndex], RATE_NORMAL));
$("numbers-speak-slow").addEventListener("click", () => sayNumber(numberTasks[numberIndex], RATE_SLOW));
$("listen-close").addEventListener("click", showHome);
$("listen-home").addEventListener("click", showHome);
$("listen-again").addEventListener("click", startListen);
$("listen-next").addEventListener("click", nextQuestion);
$("listen-speak").addEventListener("click", () => sayCard(quiz[quizIndex].card, RATE_NORMAL));
$("listen-speak-slow").addEventListener("click", () => sayCard(quiz[quizIndex].card, RATE_SLOW));
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
$("overview-search").addEventListener("input", renderOverview);
$("round-close").addEventListener("click", () => {
  resetVoice();
  showHome();
});
$("flip-button").addEventListener("click", () => showBack());
$("intro-next").addEventListener("click", showNextCard);
$("backup-save").addEventListener("click", saveBackup);
$("backup-load").addEventListener("click", () => $("backup-file").click());
$("backup-file").addEventListener("change", loadBackup);
$("lang-de").addEventListener("click", () => switchLanguage("de"));
$("info-button").addEventListener("click", showInfo);
$("info-close").addEventListener("click", showHome);
$("share-button").addEventListener("click", shareApp);
$("info-share").addEventListener("click", shareApp);
$("lang-en").addEventListener("click", () => switchLanguage("en"));
$("front-speak").addEventListener("click", () => sayCard(current));
$("back-speak").addEventListener("click", () => sayCard(current, RATE_NORMAL));
$("back-speak-slow").addEventListener("click", () => sayCard(current, RATE_SLOW));
$("back-beispiel-speak").addEventListener("click", () => play(current.beispiel_audio, current.beispiel_thai));
for (const button of $("rating-buttons").querySelectorAll("button")) {
  button.addEventListener("click", () => rate(button.dataset.rating));
}

start();

// Service Worker anmelden (Offline-Betrieb und immer frische Dateien, siehe sw.js)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
