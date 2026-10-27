#!/bin/zsh
# Erzeugt für jede Karte eine kleine Tondatei mit der Thai-Stimme Kanya:
#   audio/<id>.m4a
# für jeden Beispielsatz (Feld "beispiel_thai"):
#   audio/beispiele/<id>.m4a
# für jedes Wort von "Töne hören" (inhalte/toene.json):
#   audio/toene/<gruppe>-<nummer>.m4a
# und für jeden Satz der Dialoge (inhalte/dialoge.json):
#   audio/dialoge/<dialog>-<satz>.m4a
# Die App spielt diese Dateien beim Vorlesen ab und berechnet daraus Kanyas Ton-Kurve
# (zum Vergleich mit der eigenen Aussprache).
#
# Aufruf auf dem Mac, im Ordner thai-app:   zsh scripts/make-audio.sh
# Nach neuen Vokabeln einfach nochmal aufrufen. Vorhandene Dateien werden übersprungen;
# alle neu erzeugen:                         zsh scripts/make-audio.sh --alle
#
# Voraussetzung: Stimme "Kanya" ist installiert (Prüfen: say -v '?' | grep -i kanya).

set -e
cd "${0:A:h}/.."

if ! say -v '?' | grep -qi kanya; then
  echo "❌ Stimme Kanya fehlt. Systemeinstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen verwalten → Thai."
  exit 1
fi

mkdir -p audio
tmp=$(mktemp -d)

# id und Thai-Text jeder Karte aus inhalte/vokabeln.json lesen (eine Zeile pro Karte)
node -e '
  const cards = require("./inhalte/vokabeln.json");
  for (const c of cards) console.log(c.id + "\t" + c.thai);
' | while IFS=$'\t' read -r id thai; do
  ziel="audio/$id.m4a"
  if [[ -f "$ziel" && "$1" != "--alle" ]]; then continue; fi
  say -v Kanya -o "$tmp/$id.aiff" "$thai"
  # Klein und gut genug für die Tonhöhe: eine Spur (mono), 22050 Hz, AAC mit 32 kbit/s
  afconvert -f m4af -d aac@22050 -c 1 -b 32000 "$tmp/$id.aiff" "$ziel"
  echo "  $ziel"
done

# Beispielsätze und "Töne hören": Dateinamen und Texte kommen aus js/audio-files.js
mkdir -p audio/beispiele audio/toene
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  import { exampleAudioFiles, toneAudioFiles } from "./js/audio-files.js";
  const cards = JSON.parse(readFileSync("inhalte/vokabeln.json", "utf8"));
  const groups = JSON.parse(readFileSync("inhalte/toene.json", "utf8"));
  for (const f of [...exampleAudioFiles(cards), ...toneAudioFiles(groups)]) console.log(f.file + "\t" + f.thai);
' | while IFS=$'\t' read -r ziel thai; do
  if [[ -f "$ziel" && "$1" != "--alle" ]]; then continue; fi
  name="${ziel:t:r}"
  say -v Kanya -o "$tmp/$name.aiff" "$thai"
  afconvert -f m4af -d aac@22050 -c 1 -b 32000 "$tmp/$name.aiff" "$ziel"
  echo "  $ziel"
done

# Dialoge: jeder Satz als eigene Datei in audio/dialoge/
# (Welche Dateien es gibt, berechnet js/dialoge.js, auch die khráp-Fassungen für den Rollenwechsel.)
mkdir -p audio/dialoge
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  import { audioFiles } from "./js/dialoge.js";
  const dialogs = JSON.parse(readFileSync("inhalte/dialoge.json", "utf8"));
  for (const f of audioFiles(dialogs)) console.log(f.file + "\t" + f.thai);
' | while IFS=$'\t' read -r ziel thai; do
  if [[ -f "$ziel" && "$1" != "--alle" ]]; then continue; fi
  name="${ziel:t:r}"
  say -v Kanya -o "$tmp/$name.aiff" "$thai"
  afconvert -f m4af -d aac@22050 -c 1 -b 32000 "$tmp/$name.aiff" "$ziel"
  echo "  $ziel"
done

rm -rf "$tmp"
echo "✅ Fertig. Ordner audio: $(du -sh audio | cut -f1)"
