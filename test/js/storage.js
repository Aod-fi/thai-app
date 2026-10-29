// Speichert den Lernfortschritt auf dem Gerät (IndexedDB = kleine Datenbank im Browser).
// Alles, was mit Speichern zu tun hat, steht nur in dieser Datei.
// In Stufe 2 kommt hier der Abgleich mit Supabase dazu, der Rest der App bleibt gleich.

const DB_NAME = "thai-app-test";   // Testfassung: eigener Lernstand
const DB_VERSION = 1;

// Zwei "Tabellen":
//   progress: Lernstand pro Karte, Schlüssel = Karten-id, Wert = { box, due }
//   meta:     sonstige Werte, z. B. Lerntage oder neue Karten heute
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("progress");
        db.createObjectStore("meta");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

// Führt eine Aktion in einer Tabelle aus und wartet auf das Ergebnis
async function run(storeName, mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = db.transaction(storeName, mode).objectStore(storeName);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Lädt den Lernstand aller Karten als Objekt { id: { box, due } }
export async function loadStates() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const states = {};
    const request = db.transaction("progress").objectStore("progress").openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        states[cursor.key] = cursor.value;
        cursor.continue();
      } else {
        resolve(states);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export function saveState(cardId, state) {
  return run("progress", "readwrite", store => store.put(state, cardId));
}

export async function loadMeta(key, fallback) {
  const value = await run("meta", "readonly", store => store.get(key));
  return value === undefined ? fallback : value;
}

export function saveMeta(key, value) {
  return run("meta", "readwrite", store => store.put(value, key));
}

// Bittet das Gerät, die Daten der App dauerhaft zu behalten. Ohne diese Bitte darf
// das iPhone sie bei Speichermangel löschen. Fehlt die Funktion, passiert nichts.
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
  } catch {
    // nicht schlimm, die App läuft trotzdem
  }
}

// Liest eine ganze Tabelle als Objekt { Schlüssel: Wert }
async function readAll(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const all = {};
    const request = db.transaction(storeName).objectStore(storeName).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        all[cursor.key] = cursor.value;
        cursor.continue();
      } else {
        resolve(all);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Für "Lernstand sichern": alles, was gespeichert ist
export async function exportAll() {
  return { progress: await readAll("progress"), meta: await readAll("meta") };
}

// Für "Lernstand laden": ersetzt den ganzen Lernstand auf einmal.
// Klappt etwas nicht, bleibt der alte Lernstand unverändert.
export async function importAll({ progress, meta }) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["progress", "meta"], "readwrite");
    const progressStore = transaction.objectStore("progress");
    const metaStore = transaction.objectStore("meta");
    progressStore.clear();
    metaStore.clear();
    for (const [key, value] of Object.entries(progress)) progressStore.put(value, key);
    for (const [key, value] of Object.entries(meta)) metaStore.put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
