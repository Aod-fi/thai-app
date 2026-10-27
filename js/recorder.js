// Aufnahme über das Mikrofon, um die eigene Aussprache mit der Thai-Stimme zu vergleichen.
// Die Aufnahme bleibt nur im Speicher, bis die nächste Karte kommt. Nichts wird hochgeladen.

import { stopSpeaking } from "./speech.js";

let recorder = null;
let stream = null;
let chunks = [];
let lastAudio = null;
let lastBlob = null;     // die letzte Aufnahme als Datei, für die Ton-Kurve
let stopRequested = false;

export function canRecord() {
  return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

// Startet die Aufnahme. Wartet auf das Mikrofon (beim ersten Mal fragt das iPhone nach).
// Wurde die Taste schon losgelassen, bevor das Mikrofon bereit war, wird gleich wieder gestoppt.
export async function startRecording() {
  stopSpeaking();   // nichts abspielen, solange aufgenommen wird
  stopRequested = false;
  chunks = [];
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  try {
    recorder = new MediaRecorder(stream);
  } catch (error) {
    releaseMicrophone();
    throw error;
  }
  recorder.ondataavailable = event => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };
  recorder.start();
  if (stopRequested) await stopRecording();
}

// Stoppt die Aufnahme und gibt das Mikrofon frei.
// Gibt true zurück, wenn eine Aufnahme da ist.
export function stopRecording() {
  stopRequested = true;
  if (!recorder || recorder.state !== "recording") {
    releaseMicrophone();
    return Promise.resolve(false);
  }
  const current = recorder;
  return new Promise(resolve => {
    current.onstop = () => {
      // Mikrofon freigeben: sonst bleibt der Punkt oben im iPhone an,
      // und die Thai-Stimme klingt danach leise über den Hörer
      releaseMicrophone();
      recorder = null;
      if (chunks.length === 0) return resolve(false);
      const blob = new Blob(chunks, { type: current.mimeType || "audio/mp4" });
      if (lastAudio) URL.revokeObjectURL(lastAudio.src);
      lastBlob = blob;
      lastAudio = new Audio(URL.createObjectURL(blob));
      resolve(true);
    };
    current.stop();
  });
}

// Mikrofon ganz freigeben (alle Spuren stoppen)
function releaseMicrophone() {
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
}

// Die letzte Aufnahme als Datei (oder null)
export function recordingBlob() {
  return lastBlob;
}

export function playRecording() {
  if (lastAudio) {
    stopSpeaking();
    lastAudio.currentTime = 0;
    lastAudio.play();
  }
}

// Neue Karte: laufende Aufnahme abbrechen und alte Aufnahme vergessen
export function clearRecording() {
  stopRecording();
  if (lastAudio) URL.revokeObjectURL(lastAudio.src);
  lastAudio = null;
  lastBlob = null;
}
