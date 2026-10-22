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
  "inhalte/vokabeln.json",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES.map(file => new Request(file, { cache: "reload" }))))
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
