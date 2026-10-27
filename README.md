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
| `js/sprache.js` | Sprachwahl Deutsch/Englisch und alle englischen Texte der Bedienung |
| `js/backup.js` | Lernstand sichern und laden (Prüfen der Sicherungsdatei) |
| `js/speech.js` | Vorlesen: Kanyas Tondatei, sonst die Thai-Stimme des Geräts |
| `js/audio-files.js` | Namen der Tondateien (Karten, Beispielsätze, Töne hören) |
| `js/pitch.js` | Ton-Kurve: berechnet die Tonhöhe einer Aufnahme |
| `js/tone-curve.js` | Ton-Kurve: lädt die Tondateien und zeichnet die Linien |
| `js/tones.js` | Töne an der Umschrift erkennen, Übung „Töne hören“ |
| `inhalte/vokabeln.json` | **Alle Vokabeln** |
| `inhalte/toene.json` | Wörter für „Töne hören“ (gleiche Silbe, anderer Ton) |
| `inhalte/dialoge.json` | **Alle Dialoge** (kurze Gespräche aus den Einheiten) |
| `js/dialoge.js` | Dialoge: Rollenwechsel (khâ/khá → khráp), Namen der Tondateien |
| `js/dialog-view.js` | Dialoge: Anhören, Mitsprechen, Deine Rolle |
| `audio/` | Kanyas Aussprache jeder Karte als Tondatei (zum Vorlesen und für die Ton-Kurve) |
| `audio/beispiele/` | Kanyas Aussprache jedes Beispielsatzes |
| `audio/toene/` | Kanyas Aussprache der Wörter für „Töne hören“ |
| `audio/dialoge/` | Kanyas Aussprache jedes Dialog-Satzes |
| `scripts/make-audio.sh` | Erzeugt die Tondateien in `audio/` |
| `sw.js` | Service Worker: Offline-Betrieb und frische Dateien |
| `manifest.json`, `icons/` | Name und Symbol für den Home-Bildschirm |
| `scripts/check-content.mjs` | Prüft die Vokabeldatei auf Fehler |
| `tests/` | Tests für die Fächer-Logik |

## So funktioniert das Lernen

- Pro Runde höchstens 20 Karten, davon höchstens 5 neue pro Tag.
- Fach 1 bis 5 = Wiederholung nach 1, 2, 4, 8, 16 Tagen.
- Eine neue Karte wird zuerst nur vorgestellt („Gemerkt, weiter“). Am Ende der Runde fragt die App sie ab, erst diese Antwort zählt.
- **Gewusst:** ein Fach weiter. **Schwer:** Fach bleibt. **Nochmal:** zurück in Fach 1 und in derselben Runde noch einmal.
- Karten mit „aufpassen“ (deine Schwachstellen) bekommen immer den Abstand des Fachs darunter.

## Eine Vokabel ergänzen

1. `inhalte/vokabeln.json` in VS Code öffnen.
2. Die letzte Karte kopieren und darunter einfügen. Zwischen zwei Karten steht ein **Komma**, nach der letzten Karte keins.
3. Die Felder ausfüllen:

```json
{ "id": "taxi-links", "einheit": "4a", "thema": "Taxi", "umschrift": "líao sáai", "thai": "เลี้ยวซ้าย", "deutsch": "links abbiegen", "merkhilfe": "sáai = links", "englisch": "turn left", "merkhilfe_en": "sáai = left" }
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
| `englisch` | ja | Bedeutung auf Englisch |
| `merkhilfe_en` | ja | Eselsbrücke auf Englisch (für Englischsprachige neu ausgedacht, nicht nur übersetzt) |
| `beispiel_en` | nein | Beispielsatz mit englischer Bedeutung |
| `beispiel` | nein | Beispielsatz in Umschrift |
| `beispiel_thai` | bei Beispiel ja | Nur der Thai-Teil des Beispiels (vor dem „=“) in Thai-Schrift, wird nur vorgelesen, nie angezeigt |
| `beispiel_thai_en` | nein | Nur falls der Thai-Teil auf Englisch anders ist (z. B. anderer Name) |
| `aufpassen` | nein | `true` bei Schwachstellen |

4. Im Terminal prüfen: `npm run check`
5. Tondatei für die Ton-Kurve erzeugen (nur auf dem Mac): `zsh scripts/make-audio.sh`
   Das Skript lässt Kanya jede neue Karte und jeden neuen Beispielsatz sprechen und speichert sie in `audio/`.
   Vorhandene Dateien bleiben, es dauert nur bei neuen Karten kurz.
6. Speichern und hochladen (siehe unten).

## Einen Dialog ergänzen

1. `inhalte/dialoge.json` öffnen und einen vorhandenen Dialog kopieren (Komma zwischen zwei Dialogen).
2. `id` (eindeutig, nie mehr ändern), `thema`, `titel`, `einheit` und die beiden `rollen` anpassen.
3. Jeder Satz hat `wer` (`"ich"` = du, `"gegenueber"` = die andere Person), `umschrift`, `thai` und `deutsch`.
   Die andere Person ist eine Frau und sagt khâ/khá. Beim Rollenwechsel macht die App daraus automatisch khráp.
4. Prüfen: `npm run check`, dann Tondateien erzeugen: `zsh scripts/make-audio.sh`
   (fehlt eine Tondatei, liest die Thai-Stimme des Geräts den Satz vor).

## Englische Fassung

Unten auf der Startseite stehen **Deutsch · English**. Beim ersten Öffnen nimmt die App die Sprache des Geräts.
Die Wahl gilt nur für das jeweilige Gerät.

- Texte der Bedienung: in `js/sprache.js` ganz unten, links Deutsch, rechts Englisch.
  Im Programm steht `t("Deutscher Text")`, feste Texte in `index.html` haben das Merkmal `data-t`.
- Karten: Felder `englisch`, `merkhilfe_en`, `beispiel_en` (siehe oben).
- Dialoge: `titel_en`, `rollen_en` und bei jedem Satz `englisch`.
- Töne hören (`inhalte/toene.json`): bei jedem Wort `englisch`.
- Bereiche (`inhalte/bereiche.json`): `name_en` und `themen_en` (englische Namen der Themen).
  Der deutsche Themenname bleibt der Schlüssel, z. B. `"thema": "Taxi"`.

`npm run check` meldet, wo eine englische Fassung fehlt.

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

## Ton-Kurve

Nach „Halten und sprechen“ zeigt die Karte zwei Linien: deine Tonhöhe (farbig) und
Kanyas (grau). Beide sind auf deine bzw. Kanyas eigene mittlere Stimmlage umgerechnet,
deshalb passt eine tiefe Männerstimme genauso gut wie eine hohe Frauenstimme.
Langsam oder schnell gesprochen ist egal, beide Linien werden gleich lang gezogen.
Bei einsilbigen Karten steht darunter ein vorsichtiger Hinweis zum Ton.

## Prüfen und Testen

```bash
npm run check   # prüft die Vokabeldatei
npm test        # prüft die Fächer-Logik
```

## App auf den Geräten installieren

**iPhone und iPad:** Adresse in Safari öffnen → Teilen-Symbol → „Zum Home-Bildschirm“ → „Hinzufügen“.

**Mac:** Adresse in Safari öffnen → Menü **Ablage → Zum Dock hinzufügen**.

Jedes Gerät hat seinen eigenen Lernstand. Der Abgleich zwischen den Geräten kommt in Stufe 2.
Bis dahin: **Statistik → Lernstand sichern** speichert ihn als Datei (iPhone: „In Dateien sichern“, z. B. iCloud Drive),
**Lernstand laden** holt ihn zurück, auch auf ein anderes Gerät.

Fehlt die Thai-Stimme: Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Thai → „Kanya (Erweitert)“ laden
(Mac: Systemeinstellungen → Bedienungshilfen → Gesprochene Inhalte → Systemstimme → Stimmen verwalten).
