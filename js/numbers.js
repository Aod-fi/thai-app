// Zahlen und Preise: wandelt eine Zahl in Thai um (für die Stimme) und in Umschrift
// (zum Anzeigen), und stellt Aufgaben für die Übung "Zahlen und Preise" zusammen.
// Nur Rechnen, keine Anzeige. Getestet in tests/numbers.test.mjs.
// Schreibweise der Umschrift wie in vokabeln.json, z. B. "sɔ̌ɔng rɔ́ɔi hâa-sìp bàat".

const DIGITS = [
  null,
  { thai: "หนึ่ง", umschrift: "nʉ̀ng" },
  { thai: "สอง", umschrift: "sɔ̌ɔng" },
  { thai: "สาม", umschrift: "sǎam" },
  { thai: "สี่", umschrift: "sìi" },
  { thai: "ห้า", umschrift: "hâa" },
  { thai: "หก", umschrift: "hòk" },
  { thai: "เจ็ด", umschrift: "jèt" },
  { thai: "แปด", umschrift: "pɛ̀ɛt" },
  { thai: "เก้า", umschrift: "kâo" },
];

export const ROUND_SIZE = 10;

// Zahlen von 1 bis 99, z. B. 21 → "yîi-sìp-èt", 35 → "sǎam-sìp hâa"
function belowHundred(n) {
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (tens === 0) return { thai: DIGITS[ones].thai, umschrift: DIGITS[ones].umschrift };

  // 10 = sìp, 20 = yîi-sìp (Ausnahme), sonst Ziffer + sìp
  let thai = "สิบ";
  let umschrift = "sìp";
  if (tens === 2) {
    thai = "ยี่สิบ";
    umschrift = "yîi-sìp";
  } else if (tens > 2) {
    thai = DIGITS[tens].thai + "สิบ";
    umschrift = `${DIGITS[tens].umschrift}-sìp`;
  }

  // Eine 1 nach den Zehnern heißt èt (11 = sìp-èt), nicht nʉ̀ng
  if (ones === 1) return { thai: thai + "เอ็ด", umschrift: `${umschrift}-èt` };
  if (ones > 1) return { thai: thai + DIGITS[ones].thai, umschrift: `${umschrift} ${DIGITS[ones].umschrift}` };
  return { thai, umschrift };
}

// Zahlen von 1 bis 9999 als { thai, umschrift }
export function numberToThai(n) {
  if (!Number.isInteger(n) || n < 1 || n > 9999) throw new Error(`Zahl außerhalb 1 bis 9999: ${n}`);
  const parts = [];
  const thousands = Math.floor(n / 1000);
  const hundreds = Math.floor((n % 1000) / 100);
  const rest = n % 100;

  if (thousands) parts.push({ thai: DIGITS[thousands].thai + "พัน", umschrift: `${DIGITS[thousands].umschrift} phan` });
  if (hundreds) parts.push({ thai: DIGITS[hundreds].thai + "ร้อย", umschrift: `${DIGITS[hundreds].umschrift} rɔ́ɔi` });
  // Eine 1 nach Hunderten oder Tausenden heißt ebenfalls èt (101 = nʉ̀ng rɔ́ɔi èt)
  if (rest === 1 && parts.length > 0) parts.push({ thai: "เอ็ด", umschrift: "èt" });
  else if (rest) parts.push(belowHundred(rest));

  return {
    thai: parts.map(p => p.thai).join(""),
    umschrift: parts.map(p => p.umschrift).join(" "),
  };
}

// Die drei Schwierigkeitsstufen
export const LEVELS = {
  1: { name: "Zahlen 1 bis 10", min: 1, max: 10, step: 1, baht: false },
  2: { name: "Zahlen bis 100", min: 1, max: 100, step: 1, baht: false },
  3: { name: "Preise bis 1.000 Baht", min: 20, max: 1000, step: 10, baht: true },
};

// Eine Aufgabe: { number, thai, umschrift } (bei Preisen mit "bàat" am Ende)
export function makeTask(number, baht = false) {
  const { thai, umschrift } = numberToThai(number);
  return baht
    ? { number, thai: thai + "บาท", umschrift: `${umschrift} bàat` }
    : { number, thai, umschrift };
}

// Kanyas Tondatei einer Aufgabe: audio/zahlen/<zahl>.m4a, Preise audio/zahlen/<zahl>-baht.m4a
// (erzeugt mit scripts/make-audio.sh, offline gespeichert von sw.js)
export function numberAudio(task) {
  return `audio/zahlen/${task.number}${task.thai.endsWith("บาท") ? "-baht" : ""}.m4a`;
}

// Alle Tondateien der Zahlenübung mit dem Text, den Kanya dafür spricht:
// Zahlen 1 bis 100 (Stufe 1 und 2) und alle Preise der Stufe 3
export function numberAudioFiles() {
  const files = [];
  for (let n = 1; n <= LEVELS[2].max; n++) files.push(makeTask(n));
  const { min, max, step } = LEVELS[3];
  for (let n = min; n <= max; n += step) files.push(makeTask(n, true));
  return files.map(task => ({ file: numberAudio(task), thai: task.thai }));
}

// Stellt eine Runde mit 10 Aufgaben zusammen, möglichst ohne Wiederholung
//   random: Zufallsfunktion, in Tests ersetzbar
export function numberRound(level, random = Math.random) {
  const { min, max, step, baht } = LEVELS[level];
  const choices = [];
  for (let n = min; n <= max; n += step) choices.push(n);

  const picked = [];
  while (picked.length < ROUND_SIZE) {
    const pool = choices.filter(n => !picked.includes(n));
    const from = pool.length > 0 ? pool : choices;
    picked.push(from[Math.floor(random() * from.length)]);
  }
  return picked.map(n => makeTask(n, baht));
}

// Prüft die Eingabe: Leerzeichen, Punkte und "Baht" werden ignoriert, z. B. "1.000" = 1000
export function checkNumberAnswer(task, input) {
  const digits = String(input).replace(/[^\d]/g, "");
  return digits !== "" && Number(digits) === task.number;
}
