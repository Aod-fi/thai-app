// Sprachausgabe: zuerst Kanyas Tondatei (audio/...m4a, mit scripts/make-audio.sh erzeugt),
// sonst die Thai-Stimme des Geräts (Web Speech API) mit dem Feld "thai" einer Karte.
// Es läuft immer nur ein Ton: jedes neue Vorlesen beendet das vorige.

export const RATE_NORMAL = 1;
// Safari auf dem iPhone verlangsamt erst bei kleinen Werten hörbar, deshalb 0.4.
export const RATE_SLOW = 0.4;
// Tempo der Tondateien bei "Langsam" (die Tonhöhe bleibt gleich)
export const SLOW_PLAYBACK = 0.7;

let thaiVoice = null;

// Sucht die beste Thai-Stimme: zuerst "Kanya", sonst irgendeine Thai-Stimme
function findThaiVoice() {
  const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith("th"));
  thaiVoice = voices.find(v => v.name.includes("Kanya")) || voices[0] || null;
}

// Wartet kurz, bis der Browser die Stimmen geladen hat (manche brauchen etwas).
// Gibt true zurück, wenn eine Thai-Stimme da ist.
export function initSpeech() {
  return new Promise(resolve => {
    findThaiVoice();
    if (thaiVoice) return resolve(true);
    speechSynthesis.addEventListener("voiceschanged", () => {
      findThaiVoice();
      resolve(Boolean(thaiVoice));
    });
    setTimeout(() => resolve(Boolean(thaiVoice)), 1500);
  });
}

// Zerlegt Thai-Text in einzelne Wörter, z. B. "สองร้อยห้าสิบบาท" → สอง | ร้อย | ห้า | สิบ | บาท
// (Thai schreibt ohne Leerzeichen, der Browser kennt aber die Wortgrenzen.)
function splitWords(text) {
  const segmenter = new Intl.Segmenter("th", { granularity: "word" });
  return [...segmenter.segment(text)].filter(s => s.isWordLike).map(s => s.segment);
}

function say(text, rate) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "th-TH";
  utterance.rate = rate;
  if (thaiVoice) utterance.voice = thaiVoice;
  speechSynthesis.speak(utterance);
}

// Ein einziges Audio-Element für alle Tondateien: iOS erlaubt Ton nur nach einer
// Berührung, ein einmal freigegebenes Element darf danach weiter abspielen.
// Erst beim ersten Abspielen anlegen (die Tests im Terminal kennen kein Audio).
let player = null;
let playToken = 0;   // erhöht sich bei jedem Stopp; eine alte Wiedergabe liest dann nicht mehr vor

// Alles anhalten: Tondatei und Thai-Stimme (z. B. vor einer Aufnahme)
export function stopSpeaking() {
  playToken++;
  if (player) {
    player.onerror = null;
    player.pause();
  }
  speechSynthesis.cancel();
}

// Spielt Kanyas Tondatei. Fehlt sie oder lässt sie sich nicht abspielen,
// liest die Thai-Stimme des Geräts den Text vor.
export function play(file, text, rate = RATE_NORMAL) {
  stopSpeaking();
  if (!file) return speakNow(text, rate);
  const token = playToken;
  // Fehler kommen oft doppelt (Ereignis "error" und abgelehntes play), vorgelesen wird nur einmal
  const fallback = () => {
    if (token !== playToken) return;
    playToken++;
    speakNow(text, rate);
  };
  if (!player) {
    player = new Audio();
    player.preload = "auto";
  }
  const speed = rate === RATE_NORMAL ? 1 : SLOW_PLAYBACK;
  player.onerror = fallback;
  player.src = file;
  player.defaultPlaybackRate = speed;
  player.playbackRate = speed;
  player.preservesPitch = true;
  const playing = player.play();
  if (playing) playing.catch(error => {
    // Abgebrochen, weil schon etwas anderes abgespielt wird: nichts tun
    if (error.name !== "AbortError") fallback();
  });
}

// Liest vor. Bei "langsam" wird jedes Wort einzeln gesprochen, mit kleiner Pause
// dazwischen. Das ist auf dem iPhone deutlich hörbar, auch wenn Safari das
// Tempo (rate) kaum verändert.
export function speak(text, rate = RATE_NORMAL) {
  stopSpeaking();
  speakNow(text, rate);
}

function speakNow(text, rate) {
  if (rate === RATE_NORMAL || !("Segmenter" in Intl)) {
    say(text, rate);
    return;
  }
  for (const word of splitWords(text)) say(word, rate);
}

// Wie speak, wartet aber, bis fertig gesprochen ist (für die Dialoge).
// Sicherheitsnetz: nach spätestens 15 Sekunden geht es weiter, falls das Gerät
// das Ende nicht meldet.
export function speakAndWait(text, rate = RATE_NORMAL) {
  return new Promise(resolve => {
    speechSynthesis.cancel();
    const words = rate === RATE_NORMAL || !("Segmenter" in Intl) ? [text] : splitWords(text);
    let last = null;
    for (const word of words) {
      last = new SpeechSynthesisUtterance(word);
      last.lang = "th-TH";
      last.rate = rate;
      if (thaiVoice) last.voice = thaiVoice;
      speechSynthesis.speak(last);
    }
    const timer = setTimeout(resolve, 15000);
    const done = () => { clearTimeout(timer); resolve(); };
    if (!last) return done();
    last.onend = done;
    last.onerror = done;
  });
}
