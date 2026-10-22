#!/bin/zsh
# Erzeugt für jede Karte eine kleine Tondatei mit der Thai-Stimme Kanya:
#   audio/<id>.m4a
# Daraus berechnet die App Kanyas Ton-Kurve (zum Vergleich mit der eigenen Aussprache).
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

rm -rf "$tmp"
echo "✅ Fertig. Ordner audio: $(du -sh audio | cut -f1)"
