'use strict';
// A Unicode syllable parser that only the tests use: parseUnicode cuts Unicode text into syllables (kinzi, onset,
// medials, vowel, coda and tones), and serializeUnicode writes them back. No public function calls it, so main.js
// never requires this file and the builds leave it out. library/syllable.js, the 2.x path of the syllable rules,
// still exports both functions through 2.x.

const C = "က-အ";
const M = "ျြွှ";
const V = "ါာိီုူေဲ";
const S = "္";
const A = "်";
const F = "ံ့း";
const MEDIALS = M;
const VOWELS = V;
const TONES = F;
const ASAT = A;
const VIRAMA = S;
const KINZI = "\u1004" + ASAT + VIRAMA;
const CONSONANT = new RegExp("[" + C + "]");

function isConsonant(ch) {
  return !!ch && CONSONANT.test(ch);
}

function parseUnicode(content) {
  var syllables = [];
  var i = 0;
  while (i < content.length) {
    var start = i;
    var kinzi = false;
    if (content.slice(i, i + KINZI.length) === KINZI && isConsonant(content[i + KINZI.length])) {
      kinzi = true;
      i += KINZI.length;
    }
    if (!isConsonant(content[i])) {
      syllables.push({ raw: content[start] });
      i = start + 1;
      continue;
    }
    var onset = "";
    while (isConsonant(content[i])) {
      onset += content[i];
      i += 1;
      if (content[i] === VIRAMA && isConsonant(content[i + 1])) {
        onset += VIRAMA + content[i + 1];
        i += 2;
      } else {
        break;
      }
    }
    var medials = "";
    var vowel = "";
    var marks = "";
    var coda = "";
    var tones = "";
    while (i < content.length) {
      var ch = content[i];
      if (MEDIALS.indexOf(ch) !== -1) {
        medials += ch;
        marks += ch;
        i += 1;
        continue;
      }
      if (VOWELS.indexOf(ch) !== -1) {
        vowel += ch;
        marks += ch;
        i += 1;
        continue;
      }
      if (TONES.indexOf(ch) !== -1) {
        tones += ch;
        marks += ch;
        i += 1;
        continue;
      }
      if (ch === ASAT) {
        marks += ch;
        i += 1;
        continue;
      }
      if (isConsonant(ch) && content[i + 1] === ASAT) {
        coda += ch + ASAT;
        i += 2;
        continue;
      }
      break;
    }
    syllables.push({
      kinzi: kinzi,
      onset: onset,
      medials: medials,
      vowel: vowel,
      coda: coda,
      tones: tones,
      marks: marks
    });
  }
  return syllables;
}

function serializeUnicode(syllables) {
  return syllables.map(function (syllable) {
    if (syllable.raw != null) return syllable.raw;
    return (syllable.kinzi ? KINZI : "") + syllable.onset + syllable.medials + syllable.vowel + syllable.coda + syllable.tones;
  }).join("");
}

module.exports = {
  parseUnicode: parseUnicode,
  serializeUnicode: serializeUnicode
};
