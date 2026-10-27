// Stufe 4: Dialoge anhören, mitsprechen und in einer Rolle selbst sprechen.
// Die Regeln (Rollenwechsel, Tondateien) stehen in dialoge.js, hier nur Anzeige und Ablauf.
// Dialoge zählen nicht für die Fächer der Karteikarten.

import { dialogLines, repeatPauseMs } from "./dialoge.js";
import { speakAndWait, RATE_NORMAL, RATE_SLOW } from "./speech.js";
import { canRecord, startRecording, stopRecording, playRecording, clearRecording } from "./recorder.js";
import { loadMeta, saveMeta } from "./storage.js";
import { t, localizeDialogs, themeName } from "./sprache.js";

const $ = id => document.getElementById(id);

const SLOW_PLAYBACK = 0.7;   // Tempo der Tondateien bei "Langsam"
const GAP_MS = 600;          // kleine Pause zwischen zwei Sätzen
const MIN_HOLD_MS = 400;     // kürzer gilt als versehentliches Antippen
const MAX_HOLD_MS = 10000;   // danach endet die Aufnahme von selbst

let showView = () => {};
let showHome = () => {};

let dialogs = [];        // Inhalt von inhalte/dialoge.json
let dialog = null;       // geöffneter Dialog
let mode = "hoeren";     // "hoeren", "mitsprechen" oder "rolle"
let swapped = false;     // true = Aod spielt die andere Rolle
let slow = false;
let showGerman = true;
let lines = [];          // Sätze des Dialogs (aus dialogLines)
let index = 0;           // Satz, der gerade dran ist
let revealed = false;    // "Deine Rolle": aktueller eigener Satz aufgelöst?
let running = false;     // Anhören/Mitsprechen läuft gerade
let waitingRepeat = false; // Mitsprechen: Pause zum Nachsprechen
let rolePlaying = false; // "Deine Rolle": die andere Person spricht gerade
let token = 0;           // erhöht sich bei jedem Stopp; alte Abläufe hören dann auf
let endPrevious = null;  // beendet den vorigen Satz, wenn ein neuer startet

// Ein einziges Audio-Element für alle Sätze: iOS erlaubt Ton nur nach einer Berührung,
// ein einmal freigegebenes Element darf danach aber weiter abspielen.
const player = new Audio();
player.preload = "auto";

// ---------- Abspielen ----------

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Spielt Kanyas Tondatei des Satzes. Fehlt sie, liest die Thai-Stimme des Geräts vor.
// Gibt zurück, wie lange gesprochen wurde (Millisekunden).
function playLine(line) {
  const started = Date.now();
  speechSynthesis.cancel();
  if (endPrevious) endPrevious();
  return new Promise(resolve => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (endPrevious === finish) endPrevious = null;
      player.onended = player.onerror = null;
      resolve(Date.now() - started);
    };
    const fallback = () => {
      if (finished) return;
      player.onended = player.onerror = null;
      speakAndWait(line.thai, slow ? RATE_SLOW : RATE_NORMAL).then(finish);
    };
    endPrevious = finish;
    player.onended = finish;
    player.onerror = fallback;
    player.src = line.audio;
    player.defaultPlaybackRate = slow ? SLOW_PLAYBACK : 1;
    player.playbackRate = slow ? SLOW_PLAYBACK : 1;
    player.preservesPitch = true;
    const playing = player.play();
    if (playing) playing.catch(error => {
      // Abgebrochen, weil schon der nächste Satz startet: nichts tun
      if (error.name === "AbortError") return finish();
      fallback();
    });
  });
}

// Alles anhalten: Ton, Pausen, laufende Abläufe
function stopAll() {
  token++;
  running = false;
  waitingRepeat = false;
  rolePlaying = false;
  if (endPrevious) endPrevious();
  player.onended = player.onerror = null;
  player.pause();
  speechSynthesis.cancel();
}

// ---------- Liste ----------

export function initDialogs(options) {
  showView = options.showView;
  showHome = options.showHome;

  $("dialogs-button").addEventListener("click", showList);
  $("dialog-list-close").addEventListener("click", showHome);
  $("dialog-close").addEventListener("click", leaveDialog);
  for (const button of document.querySelectorAll("[data-dialog-mode]")) {
    button.addEventListener("click", () => switchMode(button.dataset.dialogMode));
  }
  for (const button of document.querySelectorAll("[data-dialog-role]")) {
    button.addEventListener("click", () => switchRole(button.dataset.dialogRole === "gegenueber"));
  }
  $("dialog-pause").addEventListener("click", togglePause);
  $("dialog-slow").addEventListener("click", toggleSlow);
  $("dialog-german").addEventListener("click", toggleGerman);
  $("dialog-reveal").addEventListener("click", reveal);
  $("dialog-next").addEventListener("click", nextOwnLine);
  $("dialog-again").addEventListener("click", () => playLine(lines[index]));
  $("dialog-play-own").addEventListener("click", () => {
    player.pause();
    playRecording();
  });
  $("dialog-restart").addEventListener("click", () => switchMode(mode));
  $("dialog-to-role").addEventListener("click", () => {
    if (mode === "rolle") switchRole(!swapped);
    else switchMode("rolle");
  });
  $("dialog-back-list").addEventListener("click", leaveDialog);

  const hold = $("dialog-hold");
  hold.addEventListener("pointerdown", holdStart);
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) hold.addEventListener(type, holdEnd);
  hold.addEventListener("contextmenu", event => event.preventDefault());
}

async function loadDialogs() {
  if (dialogs.length === 0) {
    const response = await fetch("inhalte/dialoge.json", { cache: "no-cache" });
    dialogs = localizeDialogs(await response.json());
  }
  return dialogs;
}

// Nach einem Sprachwechsel: Dialoge beim nächsten Öffnen neu laden
export function resetDialogs() {
  dialogs = [];
}

async function showList() {
  await loadDialogs();
  const done = await loadMeta("dialogeGeschafft", {});
  const list = $("dialog-list");
  list.innerHTML = "";
  let theme = "";
  for (const item of dialogs) {
    if (item.thema !== theme) {
      theme = item.thema;
      const title = document.createElement("h2");
      title.className = "unit-title";
      title.textContent = themeName(theme);
      list.appendChild(title);
    }
    const button = document.createElement("button");
    button.className = "dialog-item";
    button.innerHTML = '<span><b></b><small class="muted"></small></span><span class="done"></span>';
    button.querySelector("b").textContent = item.titel;
    button.querySelector("small").textContent = t("Einheit {unit} · {n} Sätze", { unit: item.einheit, n: item.saetze.length });
    button.querySelector(".done").textContent = done[item.id] ? `✓ ${done[item.id]}×` : "";
    button.addEventListener("click", () => openDialog(item));
    list.appendChild(button);
  }
  showView("dialog-list");
}

// ---------- Dialog ----------

function openDialog(item) {
  dialog = item;
  swapped = false;
  $("dialog-title").textContent = item.titel;
  showView("dialog");
  switchMode(mode);
}

function leaveDialog() {
  stopAll();
  holdReset();
  showList();
}

function switchMode(newMode) {
  stopAll();
  holdReset();
  mode = newMode;
  lines = dialogLines(dialog, swapped);
  index = 0;
  revealed = false;
  for (const button of document.querySelectorAll("[data-dialog-mode]")) {
    button.classList.toggle("on", button.dataset.dialogMode === mode);
  }
  $("dialog-roles").hidden = mode !== "rolle";
  $("dialog-pause").hidden = mode === "rolle";
  $("dialog-mode-hint").textContent = t({
    hoeren: "Hör dir das Gespräch an. Tippe auf einen Satz, um ihn nochmal zu hören.",
    mitsprechen: "Nach jedem Satz kommt eine Pause: sprich ihn laut nach.",
    rolle: "Die andere Person spricht. Bei deinem Satz sagst du ihn auf Thai und tippst dann auf „Auflösen“.",
  }[mode]);
  for (const button of document.querySelectorAll("[data-dialog-role]")) {
    const isOther = button.dataset.dialogRole === "gegenueber";
    button.textContent = dialog.rollen[button.dataset.dialogRole];
    button.className = isOther === swapped ? "primary" : "secondary";
  }
  if (mode === "rolle") runRole();
  else runListen();
}

function switchRole(newSwapped) {
  swapped = newSwapped;
  switchMode("rolle");
}

// ---------- Anzeige ----------

function render() {
  const box = $("dialog-lines");
  box.innerHTML = "";
  const finished = index >= lines.length;
  const shown = finished ? lines.length : index + 1;
  for (let i = 0; i < shown; i++) {
    const line = lines[i];
    const bubble = document.createElement("div");
    const hiddenOwn = mode === "rolle" && line.mine && i === index && !revealed;
    bubble.className = `bubble ${line.mine ? "me" : "them"}`;
    if (i === index && !finished) bubble.classList.add("now");

    if (hiddenOwn) {
      bubble.classList.add("ask");
      bubble.innerHTML = '<div class="who"></div><div class="ask-text"></div><div class="d"></div>';
      bubble.querySelector(".who").textContent = t("Du bist dran");
      bubble.querySelector(".d").textContent = t("Sag es auf Thai.");
      bubble.querySelector(".ask-text").textContent = t("„{text}“", { text: line.deutsch });
    } else {
      bubble.innerHTML = '<div class="who"></div><div class="u"></div><div class="d"></div>';
      let who = line.wer;
      if (i === index && (running || rolePlaying)) who += waitingRepeat ? " · " + t("🗣 jetzt du") : " · 🔊";
      bubble.querySelector(".who").textContent = who;
      bubble.querySelector(".u").textContent = line.umschrift;
      bubble.querySelector(".d").textContent = line.deutsch;
      bubble.querySelector(".d").hidden = !showGerman;
      // Antippen: Satz nochmal hören (ein laufender Ablauf hält dafür an)
      bubble.addEventListener("click", () => {
        if (rolePlaying) return;   // erst ausreden lassen
        if (running) pauseListen();
        playLine(line);
      });
    }
    box.appendChild(bubble);
  }

  // Tasten unten
  const ownTurn = mode === "rolle" && !finished && lines[index].mine;
  $("dialog-own").hidden = !ownTurn;
  $("dialog-hold-row").hidden = !ownTurn || revealed || !canRecord();
  $("dialog-reveal").hidden = !ownTurn || revealed;
  $("dialog-after").hidden = !ownTurn || !revealed;
  $("dialog-pause").textContent = t(running ? "⏸ Pause" : finished ? "▶ Von vorn" : "▶ Weiter");
  $("dialog-slow").classList.toggle("on", slow);
  $("dialog-german").textContent = t(showGerman ? "Deutsch aus" : "Deutsch an");
  $("dialog-counter").textContent = finished ? "" : t("Satz {n} / {total}", { n: index + 1, total: lines.length });
  $("dialog-end").hidden = !finished;
  if (finished) {
    $("dialog-end-title").textContent = t(mode === "rolle" ? "Geschafft! 🎉" : "Ende des Gesprächs");
    $("dialog-to-role").textContent = t(mode === "rolle" ? "🔄 Rolle tauschen" : "🎭 Jetzt deine Rolle");
  }

  // Der aktuelle Satz soll sichtbar sein
  const current = box.querySelector(".now") || box.lastElementChild;
  if (current && current.scrollIntoView) current.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// ---------- Anhören und Mitsprechen ----------

async function runListen() {
  const myToken = ++token;
  running = true;
  if (index >= lines.length) index = 0;
  while (index < lines.length) {
    waitingRepeat = false;
    render();
    const spoken = await playLine(lines[index]);
    if (myToken !== token) return;
    if (mode === "mitsprechen") {
      waitingRepeat = true;
      render();
      await wait(repeatPauseMs(spoken));
    } else {
      await wait(GAP_MS);
    }
    if (myToken !== token) return;
    index++;
  }
  running = false;
  waitingRepeat = false;
  render();
}

function pauseListen() {
  stopAll();
  render();
}

function togglePause() {
  if (running) pauseListen();
  else runListen();
}

// ---------- Deine Rolle ----------

// Sätze der anderen Person nacheinander abspielen, bis Aod dran ist
async function runRole() {
  const myToken = ++token;
  while (index < lines.length && !lines[index].mine) {
    rolePlaying = true;
    render();
    await playLine(lines[index]);
    if (myToken !== token) return;
    await wait(GAP_MS);
    if (myToken !== token) return;
    index++;
  }
  rolePlaying = false;
  revealed = false;
  render();
  if (index >= lines.length) await countDone();
}

// "Auflösen": richtigen Satz zeigen und vorspielen
function reveal() {
  if (holding) return;
  revealed = true;
  render();
  $("dialog-play-own").hidden = !hasRecording;
  playLine(lines[index]);
}

function nextOwnLine() {
  stopAll();
  holdReset();
  index++;
  revealed = false;
  runRole();
}

// Geschaffte Dialoge zählen (nur "Deine Rolle")
async function countDone() {
  const done = await loadMeta("dialogeGeschafft", {});
  done[dialog.id] = (done[dialog.id] || 0) + 1;
  await saveMeta("dialogeGeschafft", done);
}

// ---------- Eigene Aufnahme ("Halten und sprechen") ----------

let holding = false;
let holdBegin = 0;
let holdTimer = null;
let hasRecording = false;

function holdReset() {
  holding = false;
  hasRecording = false;
  clearTimeout(holdTimer);
  clearRecording();
  $("dialog-hold").textContent = t("🎙 Halten und sprechen");
  $("dialog-hold").classList.remove("active");
  $("dialog-play-own").hidden = true;
  $("dialog-voice-note").hidden = true;
}

function voiceNote(text) {
  $("dialog-voice-note").textContent = text;
  $("dialog-voice-note").hidden = !text;
}

async function holdStart(event) {
  event.preventDefault();
  if (holding) return;
  holding = true;
  holdBegin = Date.now();
  player.pause();
  speechSynthesis.cancel();
  $("dialog-hold").textContent = t("🔴 Ich höre zu … (loslassen = fertig)");
  $("dialog-hold").classList.add("active");
  voiceNote("");
  holdTimer = setTimeout(holdEnd, MAX_HOLD_MS);
  try {
    await startRecording();
  } catch {
    holding = false;
    clearTimeout(holdTimer);
    $("dialog-hold").textContent = t("🎙 Halten und sprechen");
    $("dialog-hold").classList.remove("active");
    voiceNote(t("Kein Zugriff auf das Mikrofon. Bitte in den Einstellungen erlauben."));
  }
}

async function holdEnd() {
  if (!holding) return;
  holding = false;
  clearTimeout(holdTimer);
  $("dialog-hold").textContent = t("🎙 Nochmal sprechen");
  $("dialog-hold").classList.remove("active");
  const tooShort = Date.now() - holdBegin < MIN_HOLD_MS;
  const recorded = await stopRecording();
  if (tooShort) {
    voiceNote(t("Taste gedrückt halten, solange du sprichst, dann loslassen."));
    return;
  }
  hasRecording = recorded;
  voiceNote(t(recorded ? "Aufgenommen. Tippe auf „Auflösen“ und vergleiche mit ▶ Ich." : "Keine Aufnahme. Bitte nochmal halten und sprechen."));
}

// ---------- Einstellungen ----------

function toggleSlow() {
  slow = !slow;
  render();
}

function toggleGerman() {
  showGerman = !showGerman;
  render();
}
