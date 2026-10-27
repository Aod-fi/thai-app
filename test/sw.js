// Service Worker: ein Hintergrund-Skript, das zwischen App und Internet sitzt.
// Es hat zwei Aufgaben:
//   1. Mit Netz:  immer die neueste Version der Dateien holen (nichts Veraltetes).
//   2. Ohne Netz: die zuletzt gespeicherte Kopie liefern, damit die App offline läuft.

const CACHE_NAME = "thai-app-test";

// Diese Dateien werden beim ersten Öffnen sofort auf dem Gerät gespeichert
const FILES = [
  "./",
  "index.html",
  "css/style.css",
  "js/app.js",
  "js/leitner.js",
  "js/storage.js",
  "js/speech.js",
  "js/extras.js",
  "js/backup.js",
  "js/sprache.js",
  "js/recorder.js",
  "js/voice-check.js",
  "js/numbers.js",
  "js/pitch.js",
  "js/tones.js",
  "js/tone-curve.js",
  "js/dialoge.js",
  "js/dialog-view.js",
  "js/audio-files.js",
  "inhalte/vokabeln.json",
  "inhalte/dialoge.json",
  "inhalte/toene.json",
  "inhalte/bereiche.json",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

// Kanyas Tondateien zum Vorlesen und für die Ton-Kurve. Fehlt eine Datei, ist das kein Fehler.
//   audio/<id>.m4a                 jede Karte (vokabeln.json)
//   audio/beispiele/<id>.m4a       Beispielsatz (Feld beispiel_thai), dazu <id>-en.m4a bei beispiel_thai_en
//   audio/toene/<gruppe>-<n>.m4a   Wörter für "Töne hören" (toene.json)
// (Gleiche Namensregel wie in js/audio-files.js; ein Service Worker kann sie nicht importieren.)
async function cacheAudio(cache) {
  const cards = await (await fetch("inhalte/vokabeln.json", { cache: "reload" })).json();
  const groups = await (await fetch("inhalte/toene.json", { cache: "reload" })).json();
  const files = [];
  for (const card of cards) {
    files.push(`audio/${card.id}.m4a`);
    if (card.beispiel_thai) files.push(`audio/beispiele/${card.id}.m4a`);
    if (card.beispiel_thai_en) files.push(`audio/beispiele/${card.id}-en.m4a`);
  }
  for (const group of groups) {
    group.woerter.forEach((word, index) => files.push(`audio/toene/${group.gruppe}-${index + 1}.m4a`));
  }
  await Promise.all(files.map(file => cache.add(file).catch(() => {})));
}

// Tondateien der Dialoge: audio/dialoge/<dialog>-<satz>.m4a, für Sätze der anderen
// Person zusätzlich -khrap.m4a (Rollenwechsel). Fehlt eine Datei, ist das kein Fehler.
// (Gleiche Namensregel wie in js/dialoge.js; ein Service Worker kann sie nicht importieren.)
async function cacheDialogAudio(cache) {
  const response = await fetch("inhalte/dialoge.json", { cache: "reload" });
  const files = [];
  for (const dialog of await response.json()) {
    dialog.saetze.forEach((line, index) => {
      const id = `${dialog.id}-${index + 1}`;
      files.push(`audio/dialoge/${id}.m4a`);
      if (line.wer === "gegenueber") files.push(`audio/dialoge/${id}-khrap.m4a`);
    });
  }
  await Promise.all(files.map(file => cache.add(file).catch(() => {})));
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        await cache.addAll(FILES.map(file => new Request(file, { cache: "reload" })));
        await cacheAudio(cache).catch(() => {});
        await cacheDialogAudio(cache).catch(() => {});
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

// So lange wird höchstens auf das Netz gewartet. Antwortet es nicht schneller
// (schwacher Empfang), kommt die gespeicherte Kopie, damit die App sofort startet.
// Die Antwort aus dem Netz wird trotzdem noch gespeichert und gilt beim nächsten Mal.
const NETWORK_TIMEOUT_MS = 3000;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Jede Anfrage der App läuft hier durch
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;

  // "no-cache": beim Server nachfragen, ob es eine neuere Version gibt
  const network = fetch(request, { cache: "no-cache" }).then(async response => {
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  });
  // Auch wenn schon die gespeicherte Kopie geliefert wurde: das Speichern fertig machen
  event.waitUntil(network.catch(() => {}));

  event.respondWith((async () => {
    // Netz antwortet rechtzeitig: frische Datei. Kein Netz oder zu langsam: null
    const quick = await Promise.race([network.catch(() => null), wait(NETWORK_TIMEOUT_MS).then(() => null)]);
    if (quick) return quick;
    const cached = await caches.match(request, { ignoreSearch: true });
    // Noch keine Kopie gespeichert: dann eben weiter auf das Netz warten
    return cached || network;
  })());
});
