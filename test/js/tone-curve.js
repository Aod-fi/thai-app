// Ton-Kurve: berechnet die Kurven aus den Tondateien und zeigt sie als Linien.
//   - eigene Aufnahme (vom Mikrofon) in der Akzentfarbe
//   - Kanya (Datei audio/<id>.m4a, mit scripts/make-audio.sh erzeugt) grau
// Beide werden mit derselben Funktion aus pitch.js berechnet.

import { pitchTrack, normalizeTrack } from "./pitch.js";

const SAMPLE_RATE = 22050;
const RANGE = 7;          // angezeigter Bereich: ±7 Halbtöne um den eigenen Mittelwert
const kanyaCache = new Map();

// Tondatei (Blob oder ArrayBuffer) in Messwerte umwandeln. OfflineAudioContext spielt
// nichts ab und lässt deshalb die Tonausgabe des iPhones in Ruhe.
async function decode(data) {
  const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
  const context = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const audio = await context.decodeAudioData(buffer);
  return audio.getChannelData(0);
}

// Kurve einer Aufnahme: Liste von Punkten { x, y } oder null (Lücke)
export async function curveFromAudio(data) {
  return normalizeTrack(pitchTrack(await decode(data), SAMPLE_RATE));
}

// Kanyas Kurve zu einer Karte (wird pro Karte nur einmal berechnet).
// Gibt null zurück, wenn es keine Tondatei gibt.
export async function kanyaCurve(card) {
  if (!kanyaCache.has(card.id)) {
    const promise = fetch(`audio/${card.id}.m4a`)
      .then(response => (response.ok ? response.arrayBuffer() : null))
      .then(buffer => (buffer ? curveFromAudio(buffer) : null))
      .catch(() => null);
    kanyaCache.set(card.id, promise);
  }
  return kanyaCache.get(card.id);
}

// Punkte → SVG-Pfad. Lücken (stimmlose Laute) unterbrechen die Linie.
function path(points, width, height) {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (!p) { pen = false; continue; }
    const y = Math.max(-RANGE, Math.min(RANGE, p.y));
    const x = (p.x * width).toFixed(1);
    const top = ((1 - (y + RANGE) / (2 * RANGE)) * height).toFixed(1);
    d += `${pen ? "L" : "M"}${x} ${top} `;
    pen = true;
  }
  return d.trim();
}

// SVG mit beiden Linien. Farben kommen aus style.css (hell und dunkel).
export function curveSvg(own, kanya) {
  const width = 300;
  const height = 120;
  const lines = [];
  if (kanya && kanya.length) lines.push(`<path class="curve-kanya" d="${path(kanya, width, height)}"/>`);
  if (own && own.length) lines.push(`<path class="curve-own" d="${path(own, width, height)}"/>`);
  return `<svg viewBox="-6 -6 ${width + 12} ${height + 12}" role="img" aria-label="Ton-Kurve: du und Kanya">` +
    `<line class="curve-mid" x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}"/>` +
    lines.join("") + "</svg>";
}
