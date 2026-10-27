// Sprache der App: Deutsch oder Englisch.
// Die App ist auf Deutsch geschrieben. Für Englisch steht unten zu jedem deutschen
// Text die Übersetzung. Im Programm schreibt man t("Deutscher Text"), dann kommt
// je nach gewählter Sprache der deutsche oder der englische Text.
// Platzhalter in geschweiften Klammern werden ersetzt: t("noch {n}", { n: 5 }).
//
// Die Inhalte (Karten, Dialoge, Töne) haben eigene englische Felder,
// siehe localizeCards, localizeDialogs usw. weiter unten.

import { exampleAudio } from "./audio-files.js";

const KEY = "mythai-sprache-test";   // Testfassung: eigene Sprachwahl
export const LANGUAGES = ["de", "en"];

let lang = initialLanguage();

// Erste Wahl: gespeicherte Sprache, sonst die Sprache des Geräts
function initialLanguage() {
  if (typeof document === "undefined") return "de";   // Tests im Terminal: Deutsch
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGUAGES.includes(saved)) return saved;
  } catch {
    // kein Speicher verfügbar, dann eben die Gerätesprache
  }
  const device = (typeof navigator !== "undefined" && navigator.language) || "de";
  return device.toLowerCase().startsWith("de") ? "de" : "en";
}

export function language() {
  return lang;
}

export function setLanguage(value) {
  lang = LANGUAGES.includes(value) ? value : "de";
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // nicht schlimm, gilt dann nur bis zum Schließen
  }
}

// Nur für Tests: Sprache ohne Speichern setzen
export function useLanguage(value) {
  lang = value;
}

function fill(text, values) {
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in values ? values[name] : match));
}

export function t(german, values = {}) {
  const text = lang === "en" && german in EN ? EN[german] : german;
  return fill(text, values);
}

// Feste Texte in index.html: Elemente mit dem Merkmal data-t bekommen ihren Text
// in der gewählten Sprache. Der deutsche Text wird beim ersten Mal gemerkt.
export function translatePage(root = document) {
  document.documentElement.lang = lang;
  for (const element of root.querySelectorAll("[data-t]")) {
    if (!element.dataset.de) element.dataset.de = element.textContent.trim();
    element.textContent = t(element.dataset.de);
  }
}

// ---------- Inhalte ----------
// Die App zeigt immer die Felder "deutsch", "merkhilfe", "beispiel", "titel" usw.
// Auf Englisch werden diese Felder vorher mit den englischen Fassungen gefüllt.
// Fehlt eine Übersetzung, bleibt der deutsche Text stehen.

const pick = (english, german) => (lang === "en" && english ? english : german);

// Themen haben einen deutschen Namen, der auch als Schlüssel dient (z. B. "Taxi").
// Die englischen Namen stehen in inhalte/bereiche.json unter "themen_en".
let themeNames = {};

export function themeName(theme) {
  return pick(themeNames[theme], theme);
}

export function localizeAreas(areas) {
  themeNames = {};
  for (const area of areas) Object.assign(themeNames, area.themen_en || {});
  return areas.map(area => ({ ...area, name: pick(area.name_en, area.name) }));
}

export function localizeCards(cards) {
  return cards.map(card => ({
    ...card,
    deutsch: pick(card.englisch, card.deutsch),
    merkhilfe: pick(card.merkhilfe_en, card.merkhilfe),
    beispiel: pick(card.beispiel_en, card.beispiel),
    // Thai-Text des Beispiels (nur zum Vorlesen); meist in beiden Sprachen gleich
    beispiel_thai: pick(card.beispiel_thai_en, card.beispiel_thai),
    beispiel_audio: card.beispiel_thai ? exampleAudio(card, lang === "en") : "",
  }));
}

export function localizeDialogs(dialogs) {
  return dialogs.map(dialog => ({
    ...dialog,
    titel: pick(dialog.titel_en, dialog.titel),
    rollen: pick(dialog.rollen_en, dialog.rollen),
    saetze: dialog.saetze.map(line => ({ ...line, deutsch: pick(line.englisch, line.deutsch) })),
  }));
}

export function localizeToneGroups(groups) {
  return groups.map(group => ({
    ...group,
    woerter: group.woerter.map(word => ({ ...word, deutsch: pick(word.englisch, word.deutsch) })),
  }));
}

// ---------- Englische Texte ----------
// Links der deutsche Text genau wie im Programm, rechts die Übersetzung.

const EN = {
  "📤 Teilen": "📤 Share",
  "ⓘ Info": "ⓘ Info",
  "So funktioniert MyThai": "How MyThai works",
  "📤 App mit Freunden teilen": "📤 Share the app with friends",
  "Ich lerne Thai mit MyThai: Karteikarten mit Aussprache, Hörübungen und kurze Dialoge für den Alltag. Kostenlos, einfach in Safari öffnen und zum Home-Bildschirm hinzufügen:": "I'm learning Thai with MyThai: flashcards with pronunciation, listening practice and short everyday dialogues. It's free – just open it in Safari and add it to your home screen:",
  "Link kopiert. Du kannst ihn jetzt in eine Nachricht einfügen.": "Link copied. You can now paste it into a message.",
  "Diesen Link kannst du teilen:": "You can share this link:",
  "Keine Thai-Stimme gefunden. Lade sie unter Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Thai → „Kanya (Erweitert)“.": "No Thai voice found. Download it under Settings → Accessibility → Spoken Content → Voices → Thai → “Kanya (Enhanced)”.",
  "{n} Wiederholung": "{n} review",
  "{n} Wiederholungen": "{n} reviews",
  "{n} neue": "{n} new",
  "Heute: {a} + {b}": "Today: {a} + {b}",
  "Heute: {a}": "Today: {a}",
  "Heute: nichts fällig": "Today: nothing due",
  "Suchen …": "Search …",
  "Keine Karte gefunden.": "No card found.",
  "Wörter aus: {what}": "Words from: {what}",
  "allen Themen": "all topics",
  "Neue Karten aus:": "New cards from:",
  "Lernrunde starten": "Start round",
  "5 weitere neue Karten lernen": "Learn 5 more new cards",
  "Frei üben": "Free practice",
  "Frei üben zählt nicht für die Fächer.": "Free practice doesn't count towards your boxes.",
  "Fortschritt": "Progress",
  "🎧 Hörübung": "🎧 Listening",
  "📊 Statistik": "📊 Statistics",
  "💬 Dialoge": "💬 Dialogues",
  "Alle Karten ansehen": "View all cards",
  "Version": "Version",
  "✕ Beenden": "✕ Finish",
  "🔊 Nochmal hören": "🔊 Listen again",
  "▶ Normal": "▶ Normal",
  "🐢 Langsam": "🐢 Slow",
  "🎙 Halten und sprechen": "🎙 Hold and speak",
  "▶ Ich": "▶ Me",
  "━ du": "━ you",
  "━ Kanya": "━ Kanya",
  "hoch ↑ · tief ↓": "high ↑ · low ↓",
  "Umdrehen": "Turn over",
  "Gemerkt, weiter": "Got it, next",
  "Neue Karte: anhören und nachsprechen. Am Ende der Runde fragt die App sie ab.": "New card: listen and repeat it. The app will test you on it at the end of the round.",
  "Nochmal": "Again",
  "Schwer": "Hard",
  "Gewusst": "Knew it",
  "← Zurück": "← Back",
  "Hörübung": "Listening",
  "Wörter verstehen": "Understand words",
  "Töne hören": "Hear the tones",
  "Gleiche Silbe, anderer Ton: welches Wort war es?": "Same syllable, different tone: which word was it?",
  "Zahlen und Preise": "Numbers and prices",
  "Die App spricht eine Zahl, du tippst sie ein.": "The app says a number, you type it in.",
  "Zahlen 1 bis 10": "Numbers 1 to 10",
  "Zahlen bis 100": "Numbers up to 100",
  "Preise bis 1.000 Baht": "Prices up to 1,000 baht",
  "Hör zu und tippe die Zahl ein:": "Listen and type the number:",
  "▶ Nochmal": "▶ Again",
  "Prüfen": "Check",
  "Weiter": "Next",
  "richtig": "correct",
  "Die Übung zählt nicht für die Fächer.": "This exercise doesn't count towards your boxes.",
  "Nochmal üben": "Practise again",
  "Zur Startseite": "Back to start",
  "Hör zu: Was bedeutet das?": "Listen: what does it mean?",
  "Die Hörübung zählt nicht für die Fächer.": "Listening practice doesn't count towards your boxes.",
  "Hör zu: Welcher Ton war es?": "Listen: which tone was it?",
  "Dialoge": "Dialogues",
  "Kurze Gespräche aus deinen Einheiten. Zählen nicht für die Fächer.": "Short everyday conversations. They don't count towards your boxes.",
  "← Dialoge": "← Dialogues",
  "🎧 Anhören": "🎧 Listen",
  "🗣 Mitsprechen": "🗣 Repeat",
  "🎭 Deine Rolle": "🎭 Your part",
  "Du bist:": "You are:",
  "Auflösen": "Show answer",
  "Andere Dialoge": "Other dialogues",
  "⏸ Pause": "⏸ Pause",
  "Deutsch aus": "Translation off",
  "Deutsch an": "Translation on",
  "Statistik": "Statistics",
  "Lerntage in Folge": "days in a row",
  "Lerntage gesamt": "learning days in total",
  "Karten pro Fach": "Cards per box",
  "Ab Fach 4 gilt eine Karte als sicher.": "From box 4 on, a card counts as secure.",
  "Pro Thema": "By topic",
  "Wiederholungen der nächsten 7 Tage": "Reviews in the next 7 days",
  "Lernstand sichern": "Back up your progress",
  "Dein Lernstand ist nur auf diesem Gerät gespeichert. Sichere ihn ab und zu als Datei, z. B. in iCloud Drive. Mit „Lernstand laden“ holst du ihn zurück, auch auf ein anderes Gerät.": "Your progress is only stored on this device. Save it as a file now and then, e.g. in iCloud Drive. “Load progress” brings it back, also on another device.",
  "💾 Lernstand sichern": "💾 Save progress",
  "📂 Lernstand laden": "📂 Load progress",
  "Alle Karten": "All cards",
  "Neue Karten aus …": "New cards from …",
  "Bereich antippen = ganzer Bereich. Der Pfeil klappt ihn auf, dann kannst du ein einzelnes Thema wählen.": "Tap an area to choose all of it. The arrow opens it so you can pick a single topic.",
  "Das ist keine Sicherung von MyThai (Datei nicht lesbar).": "This is not a MyThai backup (file can't be read).",
  "Das ist keine Sicherung von MyThai.": "This is not a MyThai backup.",
  "Diese Sicherung stammt aus einer neueren Version der App. Bitte die App zuerst aktualisieren.": "This backup comes from a newer version of the app. Please update the app first.",
  "Die Sicherung ist unvollständig.": "The backup is incomplete.",
  "Die Sicherung ist beschädigt (Karte {id}).": "The backup is damaged (card {id}).",
  "Einheit {unit} · {n} Sätze": "Unit {unit} · {n} lines",
  "Du bist dran": "Your turn",
  "Sag es auf Thai.": "Say it in Thai.",
  "🗣 jetzt du": "🗣 your turn",
  "Satz {n} / {total}": "Line {n} / {total}",
  "🔴 Ich höre zu … (loslassen = fertig)": "🔴 Listening … (let go when done)",
  "Kein Zugriff auf das Mikrofon. Bitte in den Einstellungen erlauben.": "No access to the microphone. Please allow it in Settings.",
  "🎙 Nochmal sprechen": "🎙 Speak again",
  "Taste gedrückt halten, solange du sprichst, dann loslassen.": "Keep holding the button while you speak, then let go.",
  "mittel (keine Marke)": "mid (no mark)",
  "mittel": "mid",
  "tief": "low",
  "fallend": "falling",
  "hoch": "high",
  "steigend": "rising",
  "Ton: {label}. Deine Kurve war zu kurz zum Vergleichen.": "Tone: {label}. Your curve was too short to compare.",
  "Ton: {label}. Deine Stimme fällt am Ende, das passt gut.": "Tone: {label}. Your voice falls at the end, that's good.",
  "Ton: {label}. Die Stimme sollte am Ende deutlich fallen, bei dir eher wenig. Vergleiche mit der grauen Linie.": "Tone: {label}. The voice should fall clearly at the end, yours only a little. Compare with the grey line.",
  "Ton: {label}. Deine Stimme steigt am Ende, das passt gut.": "Tone: {label}. Your voice rises at the end, that's good.",
  "Ton: {label}. Die Stimme sollte erst etwas sinken und am Ende hochgehen, bei dir eher wenig. Vergleiche mit der grauen Linie.": "Tone: {label}. The voice should dip a little first and rise at the end, yours only a little. Compare with the grey line.",
  "Ton: {label}.": "Tone: {label}.",
  "Vergleiche mit der grauen Linie.": "Compare with the grey line.",
  "Die Stimme bleibt ruhig in der Mitte.": "The voice stays level in the middle.",
  "Die Stimme bleibt tief und ruhig, am Ende eher etwas tiefer.": "The voice stays low and level, if anything a little lower at the end.",
  "Die Stimme liegt hoch, oft mit leichtem Anstieg.": "The voice is high, often rising slightly.",
  "Heute alles erledigt 🎉": "All done for today 🎉",
  "🎲 Alle Themen gemischt": "🎲 All topics mixed",
  "alle {n} Themen · {fresh} neu": "all {n} topics · {fresh} new",
  "{fresh} neu": "{fresh} new",
  "Frei üben: {what}": "Free practice: {what}",
  "alle Themen": "all topics",
  "neu": "new",
  "Fach {n}": "Box {n}",
  "noch {n} von {total}": "{n} of {total} left",
  "Freies Üben": "Free practice",
  "⚠ Aufpassen": "⚠ Watch out",
  "Neu · Abfrage": "New · test",
  "Neu": "New",
  "Sag es laut auf Thai:": "Say it out loud in Thai:",
  "z. B. ": "e.g. ",
  "Beispiel anhören": "Listen to the example",
  "Einen Moment …": "One moment …",
  "Keine Aufnahme. Bitte nochmal halten und sprechen.": "Nothing recorded. Please hold and speak again.",
  "Ton-Kurve konnte nicht berechnet werden. Vergleichen geht trotzdem mit ▶ Normal und ▶ Ich.": "The tone curve couldn't be calculated. You can still compare with ▶ Normal and ▶ Me.",
  "Keine Stimme erkannt. Nochmal halten, deutlich sprechen und erst danach loslassen.": "No voice detected. Hold again, speak clearly and only then let go.",
  "Tipp: Nur wenig Stimme erkannt. Sprich die Vokale etwas länger und lauter.": "Tip: only a little voice detected. Make the vowels a bit longer and louder.",
  "Vergleiche den Verlauf: geht deine Linie an denselben Stellen hoch und runter wie die graue?": "Compare the shape: does your line go up and down in the same places as the grey one?",
  "Weitere": "Other",
  "Frage {n} von {total}": "Question {n} of {total}",
  "{n} von {total}": "{n} of {total}",
  "Aufgabe {n} von {total}": "Task {n} of {total}",
  "✓ Richtig: {label}": "✓ Correct: {label}",
  "✗ Richtig wäre: {label}": "✗ The answer was: {label}",
  "✓ Richtig: {u} = {d}": "✓ Correct: {u} = {d}",
  "✗ Es war {u} = {d}": "✗ It was {u} = {d}",
  "{learned} von {total} gelernt, {sure} sicher": "{learned} of {total} learned, {sure} secure",
  "heute": "today",
  "So": "Sun",
  "Mo": "Mon",
  "Di": "Tue",
  "Mi": "Wed",
  "Do": "Thu",
  "Fr": "Fri",
  "Sa": "Sat",
  "MyThai Lernstand": "MyThai progress",
  "✓ Gesichert. Tipp: „In Dateien sichern“ und iCloud Drive wählen.": "✓ Saved. Tip: choose “Save to Files” and iCloud Drive.",
  "Sichern hat nicht geklappt. Bitte nochmal versuchen.": "Saving didn't work. Please try again.",
  "✓ Gesichert als „{name}“ (Ordner Downloads).": "✓ Saved as “{name}” (Downloads folder).",
  "Sicherung vom {date} mit {count} gelernten Karten laden?": "Load the backup from {date} with {count} learned cards?",
  "Sicherung mit {count} gelernten Karten laden?": "Load the backup with {count} learned cards?",
  "Der jetzige Lernstand auf diesem Gerät wird dabei ersetzt.": "Your current progress on this device will be replaced.",
  "Laden hat nicht geklappt. Dein bisheriger Lernstand ist unverändert.": "Loading didn't work. Your progress is unchanged.",
  "✓ Lernstand geladen: {count} gelernte Karten.": "✓ Progress loaded: {count} learned cards.",
  "Du ({role})": "You ({role})",
  "Du": "You",
  "„{text}“": "“{text}”",
  "Hör dir das Gespräch an. Tippe auf einen Satz, um ihn nochmal zu hören.": "Listen to the conversation. Tap a line to hear it again.",
  "Nach jedem Satz kommt eine Pause: sprich ihn laut nach.": "After each line there's a pause: repeat it out loud.",
  "Die andere Person spricht. Bei deinem Satz sagst du ihn auf Thai und tippst dann auf „Auflösen“.": "The other person speaks. When it's your line, say it in Thai, then tap “Show answer”.",
  "▶ Von vorn": "▶ From the start",
  "▶ Weiter": "▶ Continue",
  "Geschafft! 🎉": "Well done! 🎉",
  "Ende des Gesprächs": "End of the conversation",
  "🔄 Rolle tauschen": "🔄 Swap roles",
  "🎭 Jetzt deine Rolle": "🎭 Now your part",
  "Aufgenommen. Tippe auf „Auflösen“ und vergleiche mit ▶ Ich.": "Recorded. Tap “Show answer” and compare with ▶ Me.",
};
