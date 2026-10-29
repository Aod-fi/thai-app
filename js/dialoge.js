// Dialoge: Regeln ohne Anzeige (damit sie sich testen lassen).
// Die Dialoge selbst stehen in inhalte/dialoge.json.
//
// Jeder Satz hat "wer": "ich" (Aods Rolle) oder "gegenueber" (die andere Person).
// Beim Rollenwechsel spricht Aod die andere Rolle. Für Männer werden deren khâ/khá
// dann zu khráp, in der Umschrift und im Thai-Text fürs Vorlesen (Profil Frau: siehe profil.js).

import { t } from "./sprache.js";
import { MANN, profileLine, profileDialog } from "./profil.js";

// khâ / khá als eigenes Wort (danach Satzzeichen, Leerzeichen oder Ende)
const KHA_UMSCHRIFT = /(^|\s)kh[âá](?=[.?!,…]|\s|$)/g;
// ค่ะ / คะ am Ende eines Satzes (danach Leerzeichen oder Ende)
const KHA_THAI = /ค่?ะ(?=\s|$)/g;

export function khrapUmschrift(text) {
  return text.normalize("NFC").replace(KHA_UMSCHRIFT, "$1khráp");
}

export function khrapThai(text) {
  return text.replace(KHA_THAI, "ครับ");
}

// Eindeutiger Name eines Satzes, z. B. "taxi-einsteigen-3"
export function lineId(dialog, index) {
  return `${dialog.id}-${index + 1}`;
}

// Braucht dieser Satz eine eigene khráp-Fassung (für den Rollenwechsel)?
export function needsKhrap(line) {
  return line.wer === "gegenueber" && khrapUmschrift(line.umschrift) !== line.umschrift.normalize("NFC");
}

// Sätze eines Dialogs so, wie sie angezeigt werden.
// swapped = false: Aod ist "ich", true: Aod spielt die andere Rolle.
// profile (profil.js): Bei Frauen werden die eigenen Sätze umgestellt (phǒm → chán, khráp → khâ/khá),
// beim Rollenwechsel bleiben khâ/khá der anderen Person dann stehen. Mit eigenem Namen
// liest die Stimme des Geräts den Satz (audio = "").
// Dialoge mit "gegenueber_mann" (profileDialog, z. B. Dating): Für Frauen ist die andere Person
// ein Mann und sagt khráp; die Rolle "ich" ist dann immer eine Frau, auch beim Rollenwechsel.
export function dialogLines(dialog, swapped = false, profile = MANN) {
  const woman = profile.geschlecht === "frau";
  const manOpposite = woman && dialog.gegenueber_mann;
  return dialog.saetze.map((line, index) => {
    const id = lineId(dialog, index);
    const mine = swapped ? line.wer === "gegenueber" : line.wer === "ich";
    const khrap = (mine ? !woman : manOpposite && line.wer === "gegenueber") && needsKhrap(line);
    const own = line.wer === "ich" && (mine || manOpposite) ? profileLine(dialog, line, profile) : null;
    const otherRole = swapped ? dialog.rollen.ich : dialog.rollen.gegenueber;
    let audio = `audio/dialoge/${id}${khrap ? "-khrap" : ""}.m4a`;
    if (own && own.frau) audio = `audio/frau/dialoge/${id}.m4a`;
    if (own && own.geraet) audio = "";
    return {
      id,
      mine,
      wer: mine ? (swapped ? t("Du ({role})", { role: dialog.rollen.gegenueber }) : t("Du")) : otherRole,
      umschrift: own ? own.umschrift : khrap ? khrapUmschrift(line.umschrift) : line.umschrift,
      thai: own ? own.thai : khrap ? khrapThai(line.thai) : line.thai,
      deutsch: own ? own.deutsch : line.deutsch,
      audio,
    };
  });
}

// Tondateien für das Profil Frau: eigene Sätze ("ich") mit geändertem Text, audio/frau/dialoge/<id>.m4a
export function womanAudioFiles(dialogs) {
  const files = [];
  for (const dialog of dialogs.map(d => profileDialog(d, { ...MANN, geschlecht: "frau" }))) {
    dialog.saetze.forEach((line, index) => {
      if (line.wer !== "ich") return;
      const own = profileLine(dialog, line, { ...MANN, geschlecht: "frau" });
      if (own.frau) files.push({ file: `audio/frau/dialoge/${lineId(dialog, index)}.m4a`, thai: own.thai });
    });
  }
  return files;
}

// Alle Tondateien der Dialoge mit dem Text, den Kanya dafür spricht.
// Wird von scripts/make-audio.sh (erzeugen) und sw.js (offline speichern) gebraucht.
export function audioFiles(dialogs) {
  const files = [];
  for (const dialog of dialogs) {
    dialog.saetze.forEach((line, index) => {
      const id = lineId(dialog, index);
      files.push({ file: `audio/dialoge/${id}.m4a`, thai: line.thai });
      if (needsKhrap(line)) files.push({ file: `audio/dialoge/${id}-khrap.m4a`, thai: khrapThai(line.thai) });
    });
  }
  return files;
}

// Pause zum Nachsprechen: etwas länger als der Satz selbst, mindestens 2 Sekunden
export function repeatPauseMs(spokenMs) {
  return Math.max(2000, Math.round(spokenMs * 1.3) + 1000);
}
