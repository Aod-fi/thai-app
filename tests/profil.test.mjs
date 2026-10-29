// Tests für Mein Profil: Mann → Frau, Name und Alter einsetzen, erster Start.
// Aufruf: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  feminizeUmschrift, feminizeThai, matchingParticles, profileCard, profileCards, profileLine,
  cleanProfile, parseAge, isFirstStart, ageExample, MANN,
} from "../js/profil.js";
import { dialogLines, womanAudioFiles } from "../js/dialoge.js";
import { profileDialog } from "../js/profil.js";
import { cardAudio, exampleAudio, womanCardAudioFiles } from "../js/audio-files.js";
import { numberToThai } from "../js/numbers.js";

const cards = JSON.parse(readFileSync(new URL("../inhalte/vokabeln.json", import.meta.url), "utf8"));
const dialogs = JSON.parse(readFileSync(new URL("../inhalte/dialoge.json", import.meta.url), "utf8"));
const card = id => cards.find(c => c.id === id);
const FRAU = { ...MANN, geschlecht: "frau" };

test("Aussage: khráp → khâ, phǒm → chán", () => {
  assert.equal(feminizeUmschrift("sà-wàt-dii khráp"), "sà-wàt-dii khâ");
  assert.equal(feminizeUmschrift("phǒm maa jàak yəə-rá-man khráp"), "chán maa jàak yəə-rá-man khâ");
  assert.equal(feminizeThai("ผมมาจากเยอรมันครับ", "phǒm maa jàak yəə-rá-man khráp"), "ฉันมาจากเยอรมันค่ะ");
});

test("Frage (Fragezeichen oder Fragewort), ná und Anrede: khá", () => {
  assert.equal(feminizeUmschrift("an níi thâo-rài khráp?"), "an níi thâo-rài khá?");
  assert.equal(feminizeUmschrift("khun chʉ̂ʉ à-rai khráp"), "khun chʉ̂ʉ à-rai khá");
  assert.equal(feminizeUmschrift("mii lûuk mǎi khráp"), "mii lûuk mǎi khá");
  assert.equal(feminizeUmschrift("pai kɔ̀ɔn ná khráp"), "pai kɔ̀ɔn ná khá");
  assert.equal(feminizeUmschrift("nɔ́ɔng khráp! gèp tang khráp"), "nɔ́ɔng khá! gèp tang khâ");
  assert.equal(feminizeThai("น้องครับ เก็บตังค์ครับ", "nɔ́ɔng khráp! gèp tang khráp"), "น้องคะ เก็บตังค์ค่ะ");
});

test("Mehrere Satzteile: jeder bekommt sein eigenes khâ oder khá", () => {
  const umschrift = "jàai dûai bàt dâi mǎi khráp? – dâi khráp";
  assert.equal(feminizeUmschrift(umschrift), "jàai dûai bàt dâi mǎi khá? – dâi khâ");
  assert.equal(feminizeThai("จ่ายด้วยบัตรได้ไหมครับ ได้ครับ", umschrift), "จ่ายด้วยบัตรได้ไหมคะ ได้ค่ะ");
  // Antwort nach einer Frage ohne khráp bleibt eine Aussage
  assert.equal(feminizeUmschrift("khun maa jàak yəə-rá-man châi mǎi? – châi khráp"), "khun maa jàak yəə-rá-man châi mǎi? – châi khâ");
  // mài (neu) und mâi (nicht) sind keine Fragewörter
  assert.equal(feminizeUmschrift("phóp kan mài phrûng-níi khráp"), "phóp kan mài phrûng-níi khâ");
  assert.equal(feminizeUmschrift("mâi khâo-jai khráp"), "mâi khâo-jai khâ");
});

test("Andere Wörter bleiben: khâa, khâao, phɔ̌ɔm, khá der anderen Person", () => {
  assert.equal(feminizeUmschrift("khâa rót"), "khâa rót");
  assert.equal(feminizeUmschrift("phɔ̌ɔm"), "phɔ̌ɔm");
  assert.equal(feminizeUmschrift("pai nǎi khá?"), "pai nǎi khá?");
  assert.equal(feminizeThai("ไปไหนคะ", "pai nǎi khá?"), "ไปไหนคะ");
});

test("phǒm/ผม heißt auch Haar: solche Karten bleiben", () => {
  const hair = { id: "haar", umschrift: "phǒm yaao", thai: "ผมยาว", deutsch: "lange Haare", englisch: "long hair" };
  assert.deepEqual(profileCard(hair, FRAU), hair);
});

test("Alle Karten und Dialog-Sätze lassen sich umstellen (gleich viele khráp/ครับ, phǒm/ผม)", () => {
  for (const c of cards) assert.ok(matchingParticles(c.umschrift, c.thai) || c.frau?.thai, c.id);
  for (const d of dialogs) for (const line of d.saetze) assert.ok(matchingParticles(line.umschrift, line.thai), d.id);
  // Nach dem Umstellen steht für Frauen nirgends mehr khráp, ครับ, phǒm oder ผม
  for (const c of profileCards(cards, FRAU)) {
    for (const field of ["umschrift", "thai", "beispiel", "beispiel_en", "beispiel_thai", "beispiel_thai_en", "merkhilfe", "merkhilfe_en"]) {
      if (c[field]) assert.doesNotMatch(c[field].normalize("NFC"), /khráp|ครับ|phǒm|ผม/, `${c.id} ${field}`);
    }
  }
});

test("Mann: Karten bleiben wie in der Datei, Tondateien wie bisher", () => {
  const male = profileCards(cards, MANN);
  male.forEach((c, i) => {
    assert.equal(c.umschrift, cards[i].umschrift);
    assert.equal(c.thai, cards[i].thai);
    assert.equal(cardAudio(c), `audio/${c.id}.m4a`);
  });
});

test("Frau: geänderte Karten mit Tondatei in audio/frau/, Merkhilfe aus dem Feld frau", () => {
  const hallo = profileCard(card("gruss-hallo"), FRAU);
  assert.equal(hallo.umschrift, "sà-wàt-dii khâ");
  assert.equal(hallo.merkhilfe, card("gruss-hallo").frau.merkhilfe);
  assert.equal(cardAudio(hallo), "audio/frau/gruss-hallo.m4a");
  const zahl = profileCard(card("zahl-7"), FRAU);
  assert.equal(cardAudio(zahl), "audio/zahl-7.m4a");
  const teuer = profileCard(card("markt-teuer"), FRAU);
  assert.equal(teuer.beispiel_thai, "แพงมากค่ะ");
  assert.equal(exampleAudio(teuer), "audio/frau/beispiele/markt-teuer.m4a");
  assert.ok(womanCardAudioFiles(profileCards(cards, FRAU)).every(f => f.file.startsWith("audio/frau/")));
});

test("Name: im Beispiel von „Ich heiße …“, ohne Namen wie bisher", () => {
  const male = profileCard(card("small-ich-heisse"), MANN);
  assert.equal(male.beispiel, "phǒm chʉ̂ʉ Aod khráp");
  assert.equal(male.beispiel_geraet, undefined);
  const named = profileCard(card("small-ich-heisse"), { ...MANN, name: "Uwe" });
  assert.equal(named.beispiel, "phǒm chʉ̂ʉ Uwe khráp");
  assert.equal(named.beispiel_en, "phǒm chʉ̂ʉ Uwe khráp = My name is Uwe");
  assert.equal(named.beispiel_thai, "ผมชื่อ Uwe ครับ");
  assert.equal(named.beispiel_geraet, true);
  const woman = profileCard(card("small-ich-heisse"), { ...FRAU, name: "Mia" });
  assert.equal(woman.beispiel, "chán chʉ̂ʉ Mia khâ");
  assert.equal(woman.beispiel_thai, "ฉันชื่อ Mia ค่ะ");
  // Frau ohne Namen: Anna statt Aod, Kanya spricht es (Tondatei)
  const anna = profileCard(card("small-ich-heisse"), FRAU);
  assert.equal(anna.beispiel, "chán chʉ̂ʉ Anna khâ");
  assert.equal(anna.beispiel_geraet, undefined);
});

test("Alter: Karte „Ich bin … Jahre alt“ mit eingesetzter Zahl", () => {
  const plain = profileCard(card("small-alter"), MANN);
  assert.equal(plain.umschrift, "phǒm aa-yú … pii khráp");
  assert.equal(plain.beispiel_thai, ageExample(35).beispiel_thai);
  const aged = profileCard(card("small-alter"), { ...MANN, alter: 61 });
  assert.equal(aged.beispiel, "phǒm aa-yú hòk-sìp-èt pii khráp = Ich bin 61 Jahre alt");
  assert.equal(aged.beispiel_thai, "ผมอายุหกสิบเอ็ดปีครับ");
  assert.equal(aged.beispiel_geraet, true);
  const woman = profileCard(card("small-alter"), { ...FRAU, alter: 20 });
  assert.equal(woman.beispiel, "chán aa-yú yîi-sìp pii khâ = Ich bin 20 Jahre alt");
  assert.equal(woman.beispiel_thai, "ฉันอายุยี่สิบปีค่ะ");
});

test("Zahlen 1 bis 120 in Umschrift und Thai", () => {
  const expected = {
    1: ["nʉ̀ng", "หนึ่ง"], 10: ["sìp", "สิบ"], 11: ["sìp-èt", "สิบเอ็ด"], 20: ["yîi-sìp", "ยี่สิบ"],
    21: ["yîi-sìp-èt", "ยี่สิบเอ็ด"], 35: ["sǎam-sìp hâa", "สามสิบห้า"], 99: ["kâo-sìp kâo", "เก้าสิบเก้า"],
    100: ["nʉ̀ng rɔ́ɔi", "หนึ่งร้อย"], 101: ["nʉ̀ng rɔ́ɔi èt", "หนึ่งร้อยเอ็ด"], 111: ["nʉ̀ng rɔ́ɔi sìp-èt", "หนึ่งร้อยสิบเอ็ด"],
    120: ["nʉ̀ng rɔ́ɔi yîi-sìp", "หนึ่งร้อยยี่สิบ"],
  };
  for (const [n, [umschrift, thai]] of Object.entries(expected)) {
    assert.deepEqual(numberToThai(Number(n)), { umschrift, thai }, n);
  }
  for (let n = 1; n <= 120; n++) assert.doesNotMatch(numberToThai(n).umschrift, /undefined/);
});

test("Dialoge: Frau spricht ihre Rolle mit khâ/khá, beim Rollenwechsel bleibt khâ", () => {
  const taxi = dialogs.find(d => d.id === "taxi-einsteigen");
  const lines = dialogLines(taxi, false, FRAU);
  assert.equal(lines[1].umschrift, "sà-wàt-dii khâ. pai Central khâ.");
  assert.equal(lines[1].thai, "สวัสดีค่ะ ไปเซ็นทรัลค่ะ");
  assert.equal(lines[1].audio, "audio/frau/dialoge/taxi-einsteigen-2.m4a");
  assert.equal(lines[2].umschrift, "pə̀ət mí-tə̂ə dâi mǎi khá?");
  // Die andere Person bleibt unverändert
  assert.equal(lines[0].audio, "audio/dialoge/taxi-einsteigen-1.m4a");
  const swapped = dialogLines(taxi, true, FRAU);
  assert.equal(swapped[0].mine, true);
  assert.equal(swapped[0].umschrift, taxi.saetze[0].umschrift);
  assert.equal(swapped[0].audio, "audio/dialoge/taxi-einsteigen-1.m4a");
  // Mann wie bisher: khráp-Fassung beim Rollenwechsel
  assert.equal(dialogLines(taxi, true, MANN)[0].audio, "audio/dialoge/taxi-einsteigen-1-khrap.m4a");
});

test("Dialog „Sich vorstellen“: eigener Name, Stimme des Geräts", () => {
  const intro = dialogs.find(d => d.id === "small-kennenlernen");
  const plain = dialogLines(intro, false, MANN)[1];
  assert.equal(plain.umschrift, intro.saetze[1].umschrift);
  assert.equal(plain.audio, "audio/dialoge/small-kennenlernen-2.m4a");
  const named = dialogLines(intro, false, { ...FRAU, name: "Mia" })[1];
  assert.equal(named.umschrift, "chán chʉ̂ʉ Mia khâ. yin-dii thîi dâi rúu-jàk khâ.");
  assert.equal(named.deutsch, "Ich heiße Mia. Freut mich.");
  assert.equal(named.audio, "");
  assert.equal(profileLine(intro, { ...intro.saetze[1], deutsch: intro.saetze[1].englisch }, { ...MANN, name: "Ben" }).deutsch, "My name is Ben. Nice to meet you.");
  assert.ok(womanAudioFiles(dialogs).every(f => f.file.startsWith("audio/frau/dialoge/") && !/ครับ|ผม/.test(f.thai)));
});

test("Profil prüfen: Name gekürzt, Alter 1 bis 120", () => {
  assert.deepEqual(cleanProfile({ name: "  Uwe   B. ", geschlecht: "frau", alter: 61 }), { name: "Uwe B.", geschlecht: "frau", alter: 61 });
  assert.deepEqual(cleanProfile({ geschlecht: "x", alter: 500 }), MANN);
  assert.deepEqual(parseAge(""), { alter: null });
  assert.deepEqual(parseAge(" 42 "), { alter: 42 });
  assert.deepEqual(parseAge("0"), { fehler: true });
  assert.deepEqual(parseAge("121"), { fehler: true });
  assert.deepEqual(parseAge("4a"), { fehler: true });
});

test("Erster Start nur ohne Profil und ohne jeden gespeicherten Wert", () => {
  const empty = { progress: {}, meta: {} };
  assert.equal(isFirstStart(null, empty), true);
  assert.equal(isFirstStart(MANN, empty), false);
  assert.equal(isFirstStart(null, { progress: { "zahl-1": { box: 1, due: "2026-10-28" } }, meta: {} }), false);
  assert.equal(isFirstStart(null, { progress: {}, meta: { focus: "" } }), false);
});

test("Dating für Frauen: eigene Texte, im Dialog ist die andere Person ein Mann (khráp)", () => {
  const schoen = profileCard(card("dating-schoen"), FRAU);
  assert.equal(schoen.umschrift, "khun lɔ̀ɔ mâak khâ");
  assert.equal(schoen.thai, "คุณหล่อมากค่ะ");
  assert.equal(cardAudio(schoen), "audio/frau/dating-schoen.m4a");
  assert.equal(profileCard(card("dating-freund"), FRAU).deutsch, "Hast du schon eine Freundin?");

  const raw = dialogs.find(d => d.id === "dating-einladen");
  const date = profileDialog(raw, FRAU);
  assert.equal(date.rollen.gegenueber, "Er");
  const lines = dialogLines(date, false, FRAU);
  assert.equal(lines[0].umschrift, "khun lɔ̀ɔ mâak khâ.");
  assert.equal(lines[0].audio, "audio/frau/dialoge/dating-einladen-1.m4a");
  assert.equal(lines[1].umschrift, "pàak wǎan ná khráp!");
  assert.equal(lines[1].audio, "audio/dialoge/dating-einladen-2-khrap.m4a");
  assert.equal(lines[2].deutsch, "Hast du schon eine Freundin?");
  // Rollenwechsel: sie spricht den Mann mit khâ, die Rolle "ich" bleibt eine Frau
  const swapped = dialogLines(date, true, FRAU);
  assert.equal(swapped[1].umschrift, raw.saetze[1].umschrift);
  assert.equal(swapped[0].audio, "audio/frau/dialoge/dating-einladen-1.m4a");
  // Mann: alles wie bisher
  assert.equal(profileDialog(raw, MANN), raw);
  assert.ok(womanAudioFiles(dialogs).some(f => f.file === "audio/frau/dialoge/dating-einladen-1.m4a" && f.thai === "คุณหล่อมากค่ะ"));
});
