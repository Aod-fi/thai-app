// Aufnahme über das Mikrofon, um die eigene Aussprache mit der Thai-Stimme zu vergleichen.
// Die Aufnahme bleibt nur im Speicher, bis die nächste Karte kommt. Nichts wird hochgeladen.

const MAX_SECONDS = 6;

let recorder = null;
let chunks = [];
let lastAudio = null;
let stopTimer = null;

export function canRecord() {
  return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

export function isRecording() {
  return Boolean(recorder && recorder.state === "recording");
}

// Startet die Aufnahme. onDone wird nach dem Stopp aufgerufen (auch nach 6 Sekunden automatisch).
export async function startRecording(onDone) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = event => chunks.push(event.data);
  recorder.onstop = () => {
    clearTimeout(stopTimer);
    // Mikrofon wieder freigeben (sonst bleibt der rote Punkt im iPhone sichtbar)
    stream.getTracks().forEach(track => track.stop());
    const blob = new Blob(chunks, { type: recorder.mimeType });
    if (lastAudio) URL.revokeObjectURL(lastAudio.src);
    lastAudio = new Audio(URL.createObjectURL(blob));
    onDone();
  };
  recorder.start();
  stopTimer = setTimeout(stopRecording, MAX_SECONDS * 1000);
}

export function stopRecording() {
  if (isRecording()) recorder.stop();
}

export function hasRecording() {
  return Boolean(lastAudio);
}

export function playRecording() {
  if (lastAudio) {
    speechSynthesis.cancel();
    lastAudio.currentTime = 0;
    lastAudio.play();
  }
}

// Neue Karte: alte Aufnahme vergessen
export function clearRecording() {
  stopRecording();
  if (lastAudio) URL.revokeObjectURL(lastAudio.src);
  lastAudio = null;
}
