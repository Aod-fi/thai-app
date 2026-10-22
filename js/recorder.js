// Aufnahme über das Mikrofon, um die eigene Aussprache mit der Thai-Stimme zu vergleichen.
// Die Aufnahme bleibt nur im Speicher, bis die nächste Karte kommt. Nichts wird hochgeladen.

let recorder = null;
let stream = null;
let chunks = [];
let lastAudio = null;
let stopRequested = false;

export function canRecord() {
  return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

let finished = null;   // Promise: erfüllt, sobald die Aufnahme fertig verarbeitet ist

// Startet die Aufnahme. Wartet auf das Mikrofon (beim ersten Mal fragt das iPhone nach).
// Wurde die Taste schon losgelassen, bevor das Mikrofon bereit war, wird gleich wieder gestoppt.
export async function startRecording() {
  stopRequested = false;
  chunks = [];
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recorder = new MediaRecorder(stream);
  const current = recorder;
  const currentStream = stream;
  recorder.ondataavailable = event => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };
  // Auch wenn das iPhone die Aufnahme von sich aus beendet, wird sie hier gesichert
  finished = new Promise(resolve => {
    current.onstop = () => {
      // Mikrofon freigeben: sonst bleibt der Punkt oben im iPhone an,
      // und die Thai-Stimme klingt danach leise über den Hörer
      currentStream.getTracks().forEach(track => track.stop());
      if (recorder === current) recorder = null;
      if (chunks.length === 0) return resolve(false);
      const blob = new Blob(chunks, { type: current.mimeType || "audio/mp4" });
      if (lastAudio) URL.revokeObjectURL(lastAudio.src);
      lastAudio = new Audio(URL.createObjectURL(blob));
      resolve(true);
    };
  });
  recorder.start();
  if (stopRequested) await stopRecording();
}

// Stoppt die Aufnahme und gibt das Mikrofon frei.
// Gibt true zurück, wenn eine Aufnahme da ist.
export function stopRecording() {
  stopRequested = true;
  if (!finished) return Promise.resolve(false);
  if (recorder && recorder.state === "recording") recorder.stop();
  const result = finished;
  finished = null;
  return result;
}

export function playRecording() {
  if (lastAudio) {
    speechSynthesis.cancel();
    lastAudio.currentTime = 0;
    lastAudio.play();
  }
}

// Neue Karte: laufende Aufnahme abbrechen und alte Aufnahme vergessen
export function clearRecording() {
  stopRecording();
  if (lastAudio) URL.revokeObjectURL(lastAudio.src);
  lastAudio = null;
}
