// Ton-Kurve: berechnet aus einer Aufnahme, wie hoch die Stimme gerade ist (Tonhöhe),
// und bereitet die Kurve für den Vergleich vor. Nur Rechnen, keine Anzeige.
// Getestet in tests/pitch.test.mjs.
//
// Verfahren: YIN (de Cheveigné & Kawahara, 2002). Für jedes kurze Stück der Aufnahme
// wird gesucht, nach wie vielen Messpunkten sich die Schwingung wiederholt.
// Daraus ergibt sich die Tonhöhe in Hertz.

const FRAME = 1024;        // Länge eines Stücks in Messpunkten (bei 22050 Hz etwa 46 ms)
const HOP = 256;           // Abstand zwischen zwei Stücken (etwa 12 ms)
const MIN_HZ = 70;         // tiefe Männerstimme
const MAX_HZ = 500;        // hohe Frauenstimme
const THRESHOLD = 0.2;     // YIN-Schwelle: darunter gilt ein Stück als klar gestimmt
const FALLBACK = 0.35;     // kein Wert unter THRESHOLD: tiefstes Minimum nehmen, wenn darunter
const QUIET_DB = -35;      // leiser als das (gegenüber dem lautesten Stück) = Stille

// Tonhöhe einer Aufnahme.
//   samples:    Messwerte (Float32Array oder Liste), Werte zwischen -1 und 1
//   sampleRate: Messpunkte pro Sekunde
// Gibt eine Liste zurück, ein Wert pro Stück: Hertz, oder null bei Stille oder
// stimmlosen Lauten (s, t, kh …). Abstand zwischen zwei Werten: HOP / sampleRate.
export function pitchTrack(samples, sampleRate) {
  const minTau = Math.floor(sampleRate / MAX_HZ);
  const maxTau = Math.min(Math.ceil(sampleRate / MIN_HZ), FRAME - 1);
  const frames = [];
  for (let start = 0; start + FRAME + maxTau <= samples.length; start += HOP) frames.push(start);

  // Lautstärke pro Stück, um Stille zu erkennen
  const energies = frames.map(start => {
    let sum = 0;
    for (let i = start; i < start + FRAME; i++) sum += samples[i] * samples[i];
    return Math.sqrt(sum / FRAME);
  });
  const loudest = Math.max(0, ...energies);
  const quiet = loudest * 10 ** (QUIET_DB / 20);

  const diff = new Float64Array(maxTau + 1);
  const raw = frames.map((start, f) => {
    if (loudest === 0 || energies[f] < quiet) return null;

    // Unterschied zwischen dem Stück und dem um tau verschobenen Stück
    for (let tau = 1; tau <= maxTau; tau++) {
      let sum = 0;
      for (let i = start; i < start + FRAME; i++) {
        const d = samples[i] - samples[i + tau];
        sum += d * d;
      }
      diff[tau] = sum;
    }

    // Normieren (YIN Schritt 3) und erstes deutliches Minimum suchen (Schritt 4)
    let running = 0;
    let best = -1;
    let bestValue = Infinity;
    const norm = new Float64Array(maxTau + 1);
    norm[0] = 1;
    for (let tau = 1; tau <= maxTau; tau++) {
      running += diff[tau];
      norm[tau] = running === 0 ? 1 : (diff[tau] * tau) / running;
    }
    for (let tau = minTau; tau <= maxTau; tau++) {
      if (norm[tau] < THRESHOLD) {
        while (tau + 1 <= maxTau && norm[tau + 1] < norm[tau]) tau++;
        best = tau;
        bestValue = norm[tau];
        break;
      }
    }
    // Rauschige Handy-Aufnahmen: kein Wert unter der Schwelle, dann das tiefste Minimum
    if (best < 0) {
      for (let tau = minTau; tau <= maxTau; tau++) {
        if (norm[tau] < bestValue) {
          bestValue = norm[tau];
          best = tau;
        }
      }
      if (bestValue > FALLBACK) return null;
    }

    // Feiner: Parabel durch die drei Punkte um das Minimum (Schritt 5)
    let tau = best;
    if (best > 1 && best < maxTau) {
      const a = norm[best - 1];
      const b = bestValue;
      const c = norm[best + 1];
      const shift = (a - c) / (2 * (a - 2 * b + c));
      if (Number.isFinite(shift) && Math.abs(shift) < 1) tau = best + shift;
    }
    return sampleRate / tau;
  });

  return cleanTrack(raw);
}

// Ausreißer entfernen: einzelne Sprünge um eine Oktave und kurze Inseln
function cleanTrack(track) {
  const voiced = track.filter(v => v !== null).sort((a, b) => a - b);
  if (voiced.length === 0) return track;
  const median = voiced[Math.floor(voiced.length / 2)];

  // Mehr als 9 Halbtöne vom Mittelwert weg ist fast immer ein Messfehler
  let cleaned = track.map(v => (v !== null && Math.abs(semitones(v, median)) > 9 ? null : v));

  // Gestimmte Inseln kürzer als 4 Stücke (etwa 45 ms) weglassen
  cleaned = cleaned.slice();
  let i = 0;
  while (i < cleaned.length) {
    if (cleaned[i] === null) { i++; continue; }
    let end = i;
    while (end < cleaned.length && cleaned[end] !== null) end++;
    if (end - i < 4) for (let k = i; k < end; k++) cleaned[k] = null;
    i = end;
  }

  // Oktavsprünge gegenüber dem vorherigen Wert zurückfalten (Messfehler: doppelte
  // oder halbe Tonhöhe). Eine echte Stimme springt nicht in 12 ms um 8 Halbtöne.
  let previous = null;
  cleaned = cleaned.map(v => {
    if (v === null) return null;
    if (previous !== null && Math.abs(semitones(v, previous)) > 8) {
      const folded = [v * 2, v / 2].reduce((a, b) => (Math.abs(semitones(a, previous)) < Math.abs(semitones(b, previous)) ? a : b));
      if (Math.abs(semitones(folded, previous)) < Math.abs(semitones(v, previous))) v = folded;
    }
    previous = v;
    return v;
  });

  // Kleine Lücken (bis 6 Stücke, etwa 70 ms) geradlinig füllen, damit die Linie
  // nicht bei jedem kurzen Aussetzer abreißt
  for (let start = 0; start < cleaned.length; start++) {
    if (cleaned[start] === null || cleaned[start + 1] !== null) continue;
    let end = start + 1;
    while (end < cleaned.length && cleaned[end] === null) end++;
    if (end < cleaned.length && end - start - 1 <= 6) {
      for (let k = start + 1; k < end; k++) {
        cleaned[k] = cleaned[start] + ((cleaned[end] - cleaned[start]) * (k - start)) / (end - start);
      }
    }
    start = end - 1;
  }

  // Glätten: Median aus 5 Nachbarn (nur gestimmte)
  return cleaned.map((v, index) => {
    if (v === null) return null;
    const near = cleaned.slice(Math.max(0, index - 2), index + 3).filter(n => n !== null).sort((a, b) => a - b);
    return near[Math.floor(near.length / 2)];
  });
}

// Abstand zweier Tonhöhen in Halbtönen (12 Halbtöne = 1 Oktave)
function semitones(hz, reference) {
  return 12 * Math.log2(hz / reference);
}

// Bereitet eine Kurve zum Vergleichen vor:
//   - Halbtöne relativ zum eigenen Mittelwert (tiefe Männerstimme und hohe
//     Frauenstimme liegen dann auf derselben Höhe)
//   - Zeit von 0 bis 1, vom ersten bis zum letzten gestimmten Stück
//     (langsames und schnelles Sprechen werden gleich lang)
// Gibt eine Liste von Punkten { x, y } zurück; null = Lücke (stimmloser Laut).
export function normalizeTrack(track) {
  const first = track.findIndex(v => v !== null);
  if (first < 0) return [];
  let last = track.length - 1;
  while (track[last] === null) last--;
  if (last === first) return [];

  const part = track.slice(first, last + 1);
  const voiced = part.filter(v => v !== null).map(v => Math.log2(v));
  const mean = 2 ** (voiced.reduce((a, b) => a + b, 0) / voiced.length);

  return part.map((v, i) => (v === null ? null : { x: i / (part.length - 1), y: semitones(v, mean) }));
}

// Wie stark die Kurve am Ende gegenüber der Mitte steigt (+) oder fällt (−), in Halbtönen.
// Mitte = 40 bis 60 % der Zeit, Ende = letzte 20 %. Thai-Töne unterscheiden sich vor
// allem am Ende: der fallende Ton (â) stürzt ab, der steigende (ǎ) geht nach einer
// Senke wieder hoch. Gibt null zurück, wenn zu wenig gestimmte Punkte da sind.
export function endMovement(points) {
  const average = (from, to) => {
    const part = points.filter(p => p && p.x >= from && p.x <= to);
    return part.length === 0 ? null : part.reduce((sum, p) => sum + p.y, 0) / part.length;
  };
  if (points.filter(Boolean).length < 6) return null;
  const middle = average(0.4, 0.6);
  const end = average(0.8, 1);
  return middle === null || end === null ? null : end - middle;
}
