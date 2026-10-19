# MyThai

Eine kleine Web-App zum Wiederholen von Thai-Vokabeln mit Sprachausgabe.
Läuft auf iPhone, iPad und Mac, auch offline.

**Adresse:** https://aod-fi.github.io/thai-app/

## Was liegt wo?

| Datei / Ordner | Was steht drin |
|---|---|
| `index.html` | Der Inhalt der Seiten: Startseite, Lernrunde, Übersicht |
| `css/style.css` | Das Aussehen: Farben, Schriftgrößen, Abstände |
| `js/app.js` | Der Ablauf: Karte zeigen, umdrehen, bewerten |
| `js/leitner.js` | Die Regeln, wann eine Karte wiederkommt (5 Fächer) |
| `js/storage.js` | Speichert den Lernstand auf dem Gerät |
| `js/speech.js` | Die Sprachausgabe mit der Thai-Stimme |
| `inhalte/vokabeln.json` | **Alle Vokabeln** |
| `sw.js` | Service Worker: Offline-Betrieb und frische Dateien |
| `manifest.json`, `icons/` | Name und Symbol für den Home-Bildschirm |
| `scripts/check-content.mjs` | Prüft die Vokabeldatei auf Fehler |
| `tests/` | Tests für die Fächer-Logik |

## So funktioniert das Lernen

- Pro Runde höchstens 20 Karten, davon höchstens 5 neue pro Tag.
- Fach 1 bis 5 = Wiederholung nach 1, 2, 4, 8, 16 Tagen.
- **Gewusst:** ein Fach weiter. **Schwer:** Fach bleibt. **Nochmal:** zurück in Fach 1 und in derselben Runde noch einmal.
- Karten mit „aufpassen“ (deine Schwachstellen) bekommen immer den Abstand des Fachs darunter.

## Eine Vokabel ergänzen

1. `inhalte/vokabeln.json` in VS Code öffnen.
2. Die letzte Karte kopieren und darunter einfügen. Zwischen zwei Karten steht ein **Komma**, nach der letzten Karte keins.
3. Die Felder ausfüllen:

```json
{ "id": "taxi-links", "einheit": "4a", "thema": "Taxi", "umschrift": "líao sáai", "thai": "เลี้ยวซ้าย", "deutsch": "links abbiegen", "merkhilfe": "sáai = links" }
```

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | Eindeutiger Name, **nie mehr ändern** (daran hängt der Lernstand) |
| `einheit` | ja | Einheit aus dem Chat, z. B. `"4a"` |
| `thema` | ja | z. B. `"Taxi"` |
| `umschrift` | ja | Mit Tonzeichen, lange Vokale doppelt |
| `thai` | ja | Thai-Schrift, wird nur vorgelesen, nie angezeigt |
| `deutsch` | ja | Bedeutung |
| `merkhilfe` | ja | Eselsbrücke |
| `beispiel` | nein | Beispielsatz in Umschrift |
| `aufpassen` | nein | `true` bei Schwachstellen |

4. Im Terminal prüfen: `npm run check`
5. Speichern und hochladen (siehe unten).

## Eine Farbe ändern

Alle Farben stehen ganz oben in `css/style.css`, z. B.

```css
--accent: #2f6f5e;
```

`--accent` ist die Hauptfarbe (Tasten, große Zahl). Den Wert ändern, z. B. in `#c0392b` (Rot).
Der Block darunter (`@media (prefers-color-scheme: dark)`) enthält die Farben für den Dunkelmodus.
Farbcodes findest du, wenn du in VS Code auf das kleine Farbquadrat neben dem Wert klickst.

## Änderungen speichern und veröffentlichen

Vorher in `js/app.js` die `VERSION` erhöhen (z. B. von `"0.7"` auf `"0.8"`). Dann siehst du unten auf der Startseite, ob das Gerät schon die neue Version hat.

Im Terminal (im Ordner `thai-app`):

```bash
git add -A
git commit -m "Kurze Beschreibung der Änderung"
git push
```

- `git add -A`: alle Änderungen für den nächsten Commit vormerken
- `git commit`: einen Zwischenstand mit Beschreibung speichern
- `git push`: zu GitHub hochladen

Nach 1 bis 2 Minuten ist die Änderung online. Auf dem Gerät die App einmal schließen und neu öffnen.

Alternativ in VS Code: links das Symbol **Quellcodeverwaltung** (drei Punkte mit Linien), Nachricht eintippen, **Commit**, dann **Änderungen synchronisieren**.

## Prüfen und Testen

```bash
npm run check   # prüft die Vokabeldatei
npm test        # prüft die Fächer-Logik
```

## App auf den Geräten installieren

**iPhone und iPad:** Adresse in Safari öffnen → Teilen-Symbol → „Zum Home-Bildschirm“ → „Hinzufügen“.

**Mac:** Adresse in Safari öffnen → Menü **Ablage → Zum Dock hinzufügen**.

Jedes Gerät hat seinen eigenen Lernstand. Der Abgleich zwischen den Geräten kommt in Stufe 2.

Fehlt die Thai-Stimme: Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Thai → „Kanya (Erweitert)“ laden
(Mac: Systemeinstellungen → Bedienungshilfen → Gesprochene Inhalte → Systemstimme → Stimmen verwalten).
