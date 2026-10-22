// Service Worker: ein Hintergrund-Skript, das zwischen App und Internet sitzt.
// Es hat zwei Aufgaben:
//   1. Mit Netz:  immer die neueste Version der Dateien holen (nichts Veraltetes).
//   2. Ohne Netz: die zuletzt gespeicherte Kopie liefern, damit die App offline läuft.

const CACHE_NAME = "thai-app";

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
  "js/recorder.js",
  "js/voice-check.js",
  "js/numbers.js",
  "js/pitch.js",
  "js/tones.js",
  "js/tone-curve.js",
  "inhalte/vokabeln.json",
  "inhalte/toene.json",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

// Kanyas Tondateien für die Ton-Kurve (audio/<id>.m4a, zusammen etwa 0,6 MB).
// Welche es gibt, steht in vokabeln.json. Fehlt eine Datei, ist das kein Fehler.
async function cacheAudio(cache) {
  const response = await fetch("inhalte/vokabeln.json", { cache: "reload" });
  const cards = await response.json();
  await Promise.all(cards.map(card => cache.add(`audio/${card.id}.m4a`).catch(() => {})));
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        await cache.addAll(FILES.map(file => new Request(file, { cache: "reload" })));
        await cacheAudio(cache).catch(() => {});
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

// Jede Anfrage der App läuft hier durch
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;

  event.respondWith(
    // "no-cache": beim Server nachfragen, ob es eine neuere Version gibt
    fetch(request, { cache: "no-cache" })
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      })
      // Kein Netz: gespeicherte Kopie nehmen
      .catch(() => caches.match(request, { ignoreSearch: true }))
  );
});
