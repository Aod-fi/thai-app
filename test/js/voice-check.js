// Verstanden-Test: vergleicht, was die Spracherkennung des Geräts gehört hat,
// mit der Karte. Nur Rechnen, keine Anzeige. Getestet in tests/voice-check.test.mjs.
//
// Wichtig: Das ist keine echte Aussprache-Bewertung. Die Erkennung sucht das
// wahrscheinlichste Wort und verzeiht dabei oft falsche Töne.

// Höflichkeitswörter, Leerzeichen, Satzzeichen und das Wiederholungszeichen ๆ
// spielen für den Vergleich keine Rolle
function normalize(text) {
  return text
    .replace(/ครับ|ค่ะ|คะ|ๆ/g, "")
    .replace(/[\s.,!?…"'“”]/g, "")
    .toLowerCase();
}

// Gehört die erkannte Aussage zur Karte?
//   card:        die Karte, die man sprechen wollte
//   transcripts: was die Erkennung gehört hat (oft mehrere Vorschläge)
//   cards:       alle Karten, um zu sagen, wonach es stattdessen klang
// Gibt { ok, heard } zurück; heard ist eine andere Karte, nach der es klang, oder null.
export function checkSpoken(card, transcripts, cards = []) {
  const target = normalize(card.thai);
  for (const transcript of transcripts) {
    const heard = normalize(transcript);
    if (!heard) continue;
    if (heard.includes(target) || (target.includes(heard) && heard.length >= target.length / 2)) {
      return { ok: true, heard: null };
    }
    // Zahlen erkennt das iPhone oft als Ziffern, z. B. "7" statt เจ็ด
    if (/^\d+$/.test(card.deutsch) && heard.replace(/\D/g, "") === card.deutsch) {
      return { ok: true, heard: null };
    }
  }

  // Klang es nach einer anderen Karte?
  const first = normalize(transcripts[0] || "");
  const heard = first ? cards.find(other => other.id !== card.id && normalize(other.thai) === first) : null;
  return { ok: false, heard: heard || null };
}
