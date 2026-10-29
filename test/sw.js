// Die Testfassung ist beendet. Dieser Service Worker räumt nur auf:
// gespeicherte Dateien der Testfassung löschen, sich selbst abmelden und
// offene Fenster zur Haupt-App schicken. Die Haupt-App bleibt unberührt.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await caches.delete("thai-app-test");
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: "window" })) client.navigate("../");
  })());
});
