// Font detection: the evidence of the 29 detector signatures in one pass, and the decision (DESIGN.md §2.3).
// Layer L3 rules. Owner: W4 (detect).
//
// 2.x matched 29 regexes against the text, one String#match each, and compared the number of matches per side
// (detector.js:60-100); that was 80% of fontDetect's time. countEvidence reads the text once, by char code, and
// gives the same two numbers. The signatures are rows of spec/detectorSignatures.js, U01-U12 for Unicode and
// Z01-Z17 for Zawgyi, each with why it is evidence; the code below cites their ids. The rows are the oracle:
// test/next/detect.fuzz.test.mjs compares countEvidence with them on every string of up to 3 units (4 in a long
// run) over the units they name, on fuzz and on the corpora.
//
// Every function here takes text the caller has cleaned: trimmed, with no U+200B or U+200C (2.x contentGate.js
// cleanText). The anchored rows U11, Z04 and Z17 read the start and the end of that cleaned text.
//
// Why one pass gives String#match's counts. With the g flag, String#match counts matches that do not overlap.
// Two matches of one row can overlap only if a unit a match ends with can start another match of it, and in 28
// rows none can: a two-unit literal of two different units, or a pattern whose later units are outside its first
// class (for Z03, a space then Myanmar units; for Z14, e is left out of its first class). So those rows count
// every position where they match. Z15, e e, is the exception: three e in a row are one match, so countEvidence
// counts a match of it only from where its last one ended, as the regex does.

import { isBurmeseConsonant, isZawgyiPrebase, isZawgyiMedialRa } from '../script/codes.js';
import { DEFAULTS, optionsObject } from '../core/options.js';
import { hasMyanmarBlockChar } from '../core/input.js';

// ---------------------------------------------------------------------------------------------------------------
// The classes the signatures name, as bits of SIGNATURE_UNIT. Each is a regex class of the rows it serves.

const CONSONANT = 1; // [\u1000-\u1021]: U11, U12, Z03, Z04, Z05, Z08, Z10, Z14
const ZAWGYI_PREBASE = 2; // (\u103b|\u1031|[\u107e-\u1084]), e or a medial ra glyph: Z03, Z04
const ZAWGYI_MEDIAL_RA = 4; // (\u103b|[\u107e-\u1084]): Z08
const FIRST_OF_Z08 = 8; // [\u102b-\u1030\u1031\u103a\u1038]: a vowel sign, e, U+103A or visarga
const FIRST_OF_Z14 = 16; // [\u102b-\u1030\u103a\u1038]: the same less e

// The bits of each unit of U+1000-U+109F, indexed by code - 0x1000. Every unit the classes hold lies there.
const SIGNATURE_UNIT = /* @__PURE__ */ buildSignatureUnits();

function buildSignatureUnits() {
  const table = new Uint8Array(0xA0);
  for (let code = 0x1000; code <= 0x109F; code++) table[code - 0x1000] = signatureBits(code);
  return table;
}

function signatureBits(code) {
  let bits = 0;
  if (isBurmeseConsonant(code)) bits |= CONSONANT;
  if (isZawgyiPrebase(code)) bits |= ZAWGYI_PREBASE;
  if (isZawgyiMedialRa(code)) bits |= ZAWGYI_MEDIAL_RA;
  // A vowel sign from tall aa to uu (U+102B-U+1030), U+103A (Unicode's asat, Zawgyi's medial ya) or visarga.
  const endsSyllable = (code >= 0x102B && code <= 0x1030) || code === 0x103A || code === 0x1038;
  if (endsSyllable || code === 0x1031) bits |= FIRST_OF_Z08;
  if (endsSyllable) bits |= FIRST_OF_Z14;
  return bits;
}

// SIGNATURE_UNIT for any char code, 0 outside the Myanmar block and for END.
function bitsOf(code) {
  return code >= 0x1000 && code <= 0x109F ? SIGNATURE_UNIT[code - 0x1000] : 0;
}

// The whitespace class of Z03 and Z12, [\x20\t\r\n\f] (detector.js:2): space, tab, line feed, carriage return
// and form feed. Not the line tabulation U+000B, nor U+00A0.
function isDetectorSpace(code) {
  return code === 0x20 || code === 0x09 || code === 0x0A || code === 0x0D || code === 0x0C;
}

// ---------------------------------------------------------------------------------------------------------------
// countEvidence.

// The matches that start at one position, both sides in one number, so that one step can return them:
// ONE_UNICODE for each Unicode match, ONE_ZAWGYI for each Zawgyi match. A position starts at most one Unicode
// match and two Zawgyi ones, so the two never mix.
const ONE_UNICODE = 1;
const ONE_ZAWGYI = 0x100;

// The window's unit past the end of the text: a small integer in no class, where charCodeAt's NaN would make the
// window's variables doubles and the loop slower.
const END = -1;

// { unicode, zawgyi }: the String#match counts of the rows of spec/detectorSignatures.js over text, summed per
// side, in one pass. The window is the unit at i and the two after it, with their SIGNATURE_UNIT bits. Every row
// that is not anchored starts at a unit of the Myanmar block, or (Z03) at a space; one step per kind of unit
// counts the matches that start there.
export function countEvidence(text) {
  const length = text.length;
  let unicode = startsWithConsonantThenRaOrE(text) ? 1 : 0; // U11
  let zawgyi = (startsWithZawgyiPrebase(text) ? 1 : 0) + (endsWithZawgyiAsat(text) ? 1 : 0); // Z04, Z17
  let ePairEnd = 0; // Z15: where its last match ended
  let code = length > 0 ? text.charCodeAt(0) : END;
  let next = length > 1 ? text.charCodeAt(1) : END;
  let codeBits = bitsOf(code);
  let nextBits = bitsOf(next);
  for (let i = 0; i < length; i++) {
    const afterNext = i + 2 < length ? text.charCodeAt(i + 2) : END;
    const afterNextBits = bitsOf(afterNext);
    let found = 0;
    if ((codeBits & CONSONANT) !== 0) {
      found = matchesAtConsonant(code, next, afterNext, afterNextBits);
    } else if (code >= 0x1000 && code <= 0x109F) {
      found = matchesAtOtherUnit(code, next);
      if ((afterNextBits & CONSONANT) !== 0) found += matchesBeforeConsonant(codeBits, next, nextBits);
      // Z15: e, e. A match counts only from where the last one ended, so three e in a row count once.
      if (code === 0x1031 && next === 0x1031 && i >= ePairEnd) {
        found += ONE_ZAWGYI;
        ePairEnd = i + 2;
      }
    } else if (isDetectorSpace(code) && (nextBits & ZAWGYI_PREBASE) !== 0 && (afterNextBits & CONSONANT) !== 0) {
      found = ONE_ZAWGYI; // Z03: a space, e or a medial ra glyph, a consonant
    }
    unicode += found & 0xFF;
    zawgyi += found >> 8;
    code = next;
    codeBits = nextBits;
    next = afterNext;
    nextBits = afterNextBits;
  }
  return { unicode: unicode, zawgyi: zawgyi };
}

// U11: the text starts with a consonant, then medial ra or e.
function startsWithConsonantThenRaOrE(text) {
  const second = text.charCodeAt(1);
  return isBurmeseConsonant(text.charCodeAt(0)) && (second === 0x103C || second === 0x1031);
}

// Z04: the text starts with e or a medial ra glyph, then a consonant.
function startsWithZawgyiPrebase(text) {
  return isZawgyiPrebase(text.charCodeAt(0)) && isBurmeseConsonant(text.charCodeAt(1));
}

// Z17: the text ends with U+1039, Zawgyi's asat.
function endsWithZawgyiAsat(text) {
  return text.charCodeAt(text.length - 1) === 0x1039;
}

// The rows that start at a consonant.
function matchesAtConsonant(code, next, afterNext, afterNextBits) {
  // U03-U05: nya, na or nga with asat.
  if (next === 0x103A) return code === 0x100A || code === 0x1014 || code === 0x1004 ? ONE_UNICODE : 0;
  // U12: medial ya, and no consonant after it; the lookahead holds at the end of the text too.
  if (next === 0x103B) return (afterNextBits & CONSONANT) === 0 ? ONE_UNICODE : 0;
  if (next !== 0x1039) return 0;
  // Z05: U+1039 (Zawgyi's asat), then a unit that is not a consonant. The class needs a unit, so not at the end.
  const z05 = afterNext !== END && (afterNextBits & CONSONANT) === 0 ? ONE_ZAWGYI : 0;
  // Z10: U+1039, then e. Such text matches Z05 too.
  return afterNext === 0x1031 ? z05 + ONE_ZAWGYI : z05;
}

// The rows of one or two units, U10's class included, that start at a unit of the Myanmar block other than a
// consonant. No two of them start with the same two units, so a position matches at most one.
function matchesAtOtherUnit(code, next) {
  switch (code) {
    case 0x103E: // U01 medial ha
    case 0x103F: // U02 great sa
    case 0x1035: // U09 e above
      return ONE_UNICODE;
    case 0x1031: // U06 e, visarga; U07 e, aa
      return next === 0x1038 || next === 0x102C ? ONE_UNICODE : 0;
    case 0x103A: // U08 asat, visarga; Z02 Zawgyi's medial ya, aa
      return next === 0x1038 ? ONE_UNICODE : next === 0x102C ? ONE_ZAWGYI : 0;
    case 0x102C: // Z01 aa, Zawgyi's asat; Z13 aa, e
      return next === 0x1039 || next === 0x1031 ? ONE_ZAWGYI : 0;
    case 0x1025: // Z06 u typed for nya, asat
      return next === 0x1039 ? ONE_ZAWGYI : 0;
    case 0x1039: // Z07 asat, visarga; Z12 asat, a space
      return next === 0x1038 || isDetectorSpace(next) ? ONE_ZAWGYI : 0;
    case 0x1036: // Z09 anusvara, u
      return next === 0x102F ? ONE_ZAWGYI : 0;
    case 0x1064: // Z11 Zawgyi's kinzi
      return ONE_ZAWGYI;
    case 0x102F: // Z16 u, i
      return next === 0x102D ? ONE_ZAWGYI : 0;
    default: // U10 the Pali and Sanskrit letters and vowel signs
      return code >= 0x1050 && code <= 0x1059 ? ONE_UNICODE : 0;
  }
}

// Z08 and Z14 at a position whose third unit is a consonant: medial ra or e typed before that consonant, as
// Zawgyi does. They need different second units, so a position matches at most one.
function matchesBeforeConsonant(codeBits, next, nextBits) {
  // Z08: a vowel sign, e, U+103A or visarga, then a medial ra glyph.
  if ((codeBits & FIRST_OF_Z08) !== 0 && (nextBits & ZAWGYI_MEDIAL_RA) !== 0) return ONE_ZAWGYI;
  // Z14: a vowel sign, U+103A or visarga, then e.
  if ((codeBits & FIRST_OF_Z14) !== 0 && next === 0x1031) return ONE_ZAWGYI;
  return 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Decisions.

// 'unicode' when unicode > zawgyi, 'zawgyi' when less, else fallback, whatever it is (2.x scoreWithRules).
export function decide(evidence, fallback) {
  if (evidence.unicode > evidence.zawgyi) return 'unicode';
  if (evidence.unicode < evidence.zawgyi) return 'zawgyi';
  return fallback;
}

// With an injected myanmar-tools ZawgyiDetector, or anything with its getZawgyiProbability(text):
// probability < thresholds[0] is 'unicode', > thresholds[1] is 'zawgyi', and anything else, NaN included, is
// fallback (2.x scoreWithMyanmarTools). The core never loads the model (DESIGN.md §4 rule 5).
export function scoreByZawgyiModel(text, model, thresholds, fallback) {
  const probability = model.getZawgyiProbability(text);
  if (probability < thresholds[0]) return 'unicode';
  if (probability > thresholds[1]) return 'zawgyi';
  return fallback;
}

// options: { fallback = 'zawgyi', zawgyiModel = null, thresholds = DEFAULTS.detector.thresholds }. With no model,
// the rule evidence decides. The fallback 'zawgyi' is 2.x's (detector.js:137, decision 13). Options are read per
// call and never kept, and options that are not an object (lines.map passes an index) are none.
export function detectFont(text, options) {
  const settings = optionsObject(options);
  const fallback = settings.fallback === undefined ? 'zawgyi' : settings.fallback;
  const model = settings.zawgyiModel;
  if (!model) return decide(countEvidence(text), fallback);
  const thresholds = settings.thresholds === undefined ? DEFAULTS.detector.thresholds : settings.thresholds;
  return scoreByZawgyiModel(text, model, thresholds, fallback);
}

// { encoding, unicode, zawgyi }: the rule evidence and what it says. encoding is 'none' when the text has no
// unit of U+1000-U+109F, where 2.x fontDetect returns its fallback or 'en' before it counts anything (and every
// row needs such a unit, so both counts are 0); 'unknown' when the evidence ties; else the side with more. 3.0's
// public detectEncoding (plan Phase 5 #1) is this, after its text check and cleaning; 2.x fontDetect is its
// encoding, with the fallback in place of 'none' and 'unknown'.
export function detectEncoding(text) {
  if (!hasMyanmarBlockChar(text)) return { encoding: 'none', unicode: 0, zawgyi: 0 };
  const evidence = countEvidence(text);
  return { encoding: decide(evidence, 'unknown'), unicode: evidence.unicode, zawgyi: evidence.zawgyi };
}
