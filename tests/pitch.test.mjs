// Tests für die Ton-Kurve. Aufruf: npm test
// Statt echter Stimmen: künstliche Töne (Sinus), deren Tonhöhe wir genau kennen.

import { test } from "node:test";
import assert from "node:assert/strict";
import { pitchTrack, normalizeTrack, endMovement } from "../js/pitch.js";

const RATE = 22050;

// Ton, der in "seconds" Sekunden gleichmäßig von "fromHz" zu "toHz" gleitet,
// mit Obertönen wie eine Stimme. Optional Stille davor und danach.
function glide(fromHz, toHz, seconds = 0.6, silence = 0) {
  const pad = Math.round(silence * RATE);
  const length = Math.round(seconds * RATE);
  const samples = new Float32Array(length + 2 * pad);
  let phase = 0;
  for (let i = 0; i < length; i++) {
    const hz = fromHz + ((toHz - fromHz) * i) / length;
    phase += (2 * Math.PI * hz) / RATE;
    samples[pad + i] = 0.5 * Math.sin(phase) + 0.25 * Math.sin(2 * phase) + 0.1 * Math.sin(3 * phase);
  }
  return samples;
}

const voiced = track => track.filter(v => v !== null);

test("Gleichbleibender Ton: 200 Hz wird erkannt", () => {
  const track = voiced(pitchTrack(glide(200, 200), RATE));
  assert.ok(track.length > 20);
  for (const hz of track) assert.ok(Math.abs(hz - 200) < 3, `${hz} statt 200`);
});

test("Tiefe Männerstimme: 95 Hz wird erkannt (nicht die Oktave darüber)", () => {
  const track = voiced(pitchTrack(glide(95, 95), RATE));
  for (const hz of track) assert.ok(Math.abs(hz - 95) < 3, `${hz} statt 95`);
});

test("Steigender Ton: Kurve geht hoch, Ende deutlich über der Mitte", () => {
  const points = normalizeTrack(pitchTrack(glide(120, 180), RATE));
  const ys = points.filter(Boolean).map(p => p.y);
  assert.ok(ys[ys.length - 1] > ys[0] + 5, "Ende höher als Anfang");
  assert.ok(endMovement(points) > 1.5);
});

test("Fallender Ton: Kurve geht runter, Ende deutlich unter der Mitte", () => {
  const points = normalizeTrack(pitchTrack(glide(260, 170), RATE));
  const ys = points.filter(Boolean).map(p => p.y);
  assert.ok(ys[ys.length - 1] < ys[0] - 5, "Ende tiefer als Anfang");
  assert.ok(endMovement(points) < -2);
});

test("Stille wird ausgelassen, Zeit läuft von 0 bis 1 nur über den Ton", () => {
  const track = pitchTrack(glide(200, 200, 0.5, 0.3), RATE);
  assert.equal(track[0], null);
  assert.equal(track[track.length - 1], null);
  const voicedPoints = normalizeTrack(track).filter(Boolean);
  assert.ok(voicedPoints[0].x < 0.05);
  assert.ok(voicedPoints[voicedPoints.length - 1].x > 0.95);
});

test("Stimmloser Teil am Ende (wie s, p, t) behält seinen Platz in der Zeit", () => {
  // 0,3 s Ton, dann 0,3 s Rauschen (wie "sìp" geflüstert)
  const tone = glide(150, 150, 0.3);
  let seed = 7;
  const hiss = Float32Array.from({ length: Math.round(0.3 * RATE) }, () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.8);
  const samples = new Float32Array(tone.length + hiss.length);
  samples.set(tone);
  samples.set(hiss, tone.length);
  const voicedPoints = normalizeTrack(pitchTrack(samples, RATE)).filter(Boolean);
  // Der Ton füllt nur etwa die erste Hälfte, nicht die ganze Breite
  assert.ok(voicedPoints[voicedPoints.length - 1].x < 0.6, `endet bei ${voicedPoints[voicedPoints.length - 1].x}`);
});

test("Männer- und Frauenstimme ergeben dieselbe Kurve (Halbtöne um den eigenen Mittelwert)", () => {
  const low = normalizeTrack(pitchTrack(glide(100, 130), RATE)).filter(Boolean);
  const high = normalizeTrack(pitchTrack(glide(200, 260), RATE)).filter(Boolean);
  const at = (points, x) => points.reduce((best, p) => (Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best)).y;
  for (const x of [0, 0.5, 1]) assert.ok(Math.abs(at(low, x) - at(high, x)) < 0.5);
});

test("Nur Stille: keine Kurve", () => {
  const track = pitchTrack(new Float32Array(RATE), RATE);
  assert.ok(track.every(v => v === null));
  assert.deepEqual(normalizeTrack(track), []);
  assert.equal(endMovement([]), null);
});

test("Handy-Aufnahme mit Rauschen: tiefe Stimme wird trotzdem erkannt", () => {
  const samples = glide(110, 110, 0.6, 0.2);
  let seed = 1;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.3;
  for (let i = 0; i < samples.length; i++) samples[i] += noise();
  const track = voiced(pitchTrack(samples, RATE));
  assert.ok(track.length > 20, `nur ${track.length} Stücke mit Stimme`);
  for (const hz of track) assert.ok(Math.abs(hz - 110) < 5, `${hz} statt 110`);
});

test("Kurze Lücke wird gefüllt, die Linie reißt nicht ab", () => {
  const a = glide(150, 150, 0.3);
  const gap = new Float32Array(Math.round(0.03 * RATE)).map((_, i) => 0.4 * Math.sin(i * 1.7) * Math.cos(i * 0.31));
  const b = glide(150, 150, 0.3);
  const samples = new Float32Array(a.length + gap.length + b.length);
  samples.set(a);
  samples.set(gap, a.length);
  samples.set(b, a.length + gap.length);
  const track = pitchTrack(samples, RATE);
  const first = track.findIndex(v => v !== null);
  const last = track.length - 1 - [...track].reverse().findIndex(v => v !== null);
  assert.ok(track.slice(first, last + 1).every(v => v !== null), "keine Lücke");
});
