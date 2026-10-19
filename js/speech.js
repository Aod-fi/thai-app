// Sprachausgabe mit der Thai-Stimme des Geräts (Web Speech API).
// Vorgelesen wird immer das Feld "thai" einer Karte.

export const RATE_NORMAL = 1;
// Safari auf dem iPhone verlangsamt erst bei kleinen Werten hörbar, deshalb 0.4.
export const RATE_SLOW = 0.4;

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

export function speak(text, rate = RATE_NORMAL) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "th-TH";
  utterance.rate = rate;
  if (thaiVoice) utterance.voice = thaiVoice;
  speechSynthesis.speak(utterance);
}
