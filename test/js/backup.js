// Lernstand sichern und laden: nur Rechnen und Prüfen, keine Anzeige, kein Speichern.
// Getestet in tests/backup.test.mjs.
//
// Die Sicherung ist eine kleine Textdatei (JSON) mit dem Lernstand aller Karten
// und den übrigen gespeicherten Werten (Lerntage, gewähltes Thema usw.),
// dazu "Mein Profil" (Name, Mann/Frau, Alter), falls eins angelegt ist.
// Ältere Sicherungen ohne Profil lassen sich weiter laden.

import { t } from "./sprache.js";
import { cleanProfile } from "./profil.js";

const KIND = "mythai-lernstand";

// Baut den Inhalt der Sicherungsdatei. data.profil: gespeichertes Profil oder null
export function buildBackup(data, appVersion, now = new Date()) {
  const backup = {
    art: KIND,
    version: 1,
    appVersion,
    gesichertAm: now.toISOString(),
    progress: data.progress,
    meta: data.meta,
  };
  if (data.profil) backup.profil = cleanProfile(data.profil);
  return backup;
}

// Dateiname, z. B. "mythai-lernstand-2026-10-27.json"
export function backupFileName(dateString) {
  return `${KIND}-${dateString}.json`;
}

// Ein gültiger Lernstand einer Karte: Fach 1 bis 5 und Datum "JJJJ-MM-TT"
function validState(state) {
  return state && Number.isInteger(state.box) && state.box >= 1 && state.box <= 5 &&
    typeof state.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(state.due);
}

// Prüft den Text einer Sicherungsdatei und gibt { progress, meta, gesichertAm, profil } zurück
// (profil = null, wenn die Sicherung keins enthält).
// Bei einer falschen Datei gibt es einen Fehler mit verständlicher Meldung.
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(t("Das ist keine Sicherung von MyThai (Datei nicht lesbar)."));
  }
  if (!data || data.art !== KIND) throw new Error(t("Das ist keine Sicherung von MyThai."));
  if (data.version !== 1) throw new Error(t("Diese Sicherung stammt aus einer neueren Version der App. Bitte die App zuerst aktualisieren."));
  if (!data.progress || typeof data.progress !== "object" || !data.meta || typeof data.meta !== "object") {
    throw new Error(t("Die Sicherung ist unvollständig."));
  }
  for (const [id, state] of Object.entries(data.progress)) {
    if (!validState(state)) throw new Error(t("Die Sicherung ist beschädigt (Karte {id}).", { id }));
  }
  const profil = data.profil && typeof data.profil === "object" ? cleanProfile(data.profil) : null;
  return { progress: data.progress, meta: data.meta, gesichertAm: data.gesichertAm || "", profil };
}
