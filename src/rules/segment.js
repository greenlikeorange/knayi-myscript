// Syllable breaks: the break scanners of both fonts, the lossless segmentation of 3.0, and the repeated-mark
// collapse (DESIGN.md §2.3). Layer L3 rules. Owner: W3 (segment).
//
// 2.x broke text with regex rows, kept in src/spec/breakRules.js as the readable oracle: it put U+200B before
// every letter that may start a syllable (rows U2, Z1 and Z2), deleted each U+200B that a join reason matched,
// and split the text on what was left. The scanners here read the text once, from left to right, and ask at each
// such letter whether a row would delete its break. Each join reason is a named predicate that cites its row.
// Nothing is inserted, split or joined to find the breaks.
//
// forEachBreak, breakParts and breakString keep the precondition of 2.x: the text has no U+200B or U+200C (2.x
// always cleans it first, DESIGN.md C9). segmentSyllables and syllableBoundaries take any text. Every function
// takes the font as 'unicode' or 'zawgyi' and the bare-consonant policy as a value of BARE_CONSONANTS, and throws a
// coded RangeError for any other value, so that both fonts never read an unknown value two different ways.
//
// Linear time: the loop reads each unit once, and a decision looks at most at a run of tone marks after one
// consonant (rows U5 and Z5) or at four e and medial ra glyphs (row Z8). A run of tone marks follows one
// consonant only, so no unit is read more than a few times.

import {
  CP, isBurmeseConsonant, isZawgyiPrebase, isZawgyiMedialRa, isZawgyiKinzi, addBlockUnit
} from '../script/codes.js';
import { deepFreeze } from '../freeze.js';
import { ERR, libraryError } from '../core/errors.js';

// How a bare consonant (one with no mark after it) joins the syllable after it: rows U7 and Z8, decision 34.
//   PAIRS     2.x. It joins, but a consonant that has just been joined to the one before it is not bare any more,
//             so ကကက breaks as ကက|က (legacyBareConsonantPair; DESIGN.md §10 Q11).
//   CHAINS    every bare consonant joins the syllable after it, as the comment of 2.x syllable.js:239 says: ကကက.
//   SEPARATE  none joins: a bare consonant is a syllable of its own, with its inherent vowel (UTN #11): က|က|က.
// forEachBreak, breakParts and breakString default to PAIRS, as 2.x does. Decision 34 picks the default of the
// 3.0 API from corpus counts (DESIGN.md §7.5); until then segmentSyllables and syllableBoundaries default to PAIRS.
export const BARE_CONSONANTS = /* @__PURE__ */ deepFreeze({ PAIRS: 'pairs', CHAINS: 'chains', SEPARATE: 'separate' });

// 2.x joinParts puts U+200B between the parts when no separator is given (syllable.js:272-275).
const ZWSP_TEXT = '\u200B';

// The font every function reads: 'unicode' or 'zawgyi'. compat resolves 2.x's other names first (DESIGN.md C12);
// any other value here is a caller's mistake, and reading it as Unicode would break the text in the wrong font.
function requireBreakFont(font) {
  if (font !== 'unicode' && font !== 'zawgyi') {
    throw libraryError(ERR.INVALID_ARG_VALUE, 'knayi.segment: the font must be \'unicode\' or \'zawgyi\'', RangeError);
  }
}

// The bare-consonant policy: a value of BARE_CONSONANTS. A default parameter covers only undefined, so null and
// other values land here.
function requireBareConsonants(bareConsonants) {
  if (bareConsonants !== BARE_CONSONANTS.PAIRS && bareConsonants !== BARE_CONSONANTS.CHAINS &&
    bareConsonants !== BARE_CONSONANTS.SEPARATE) {
    throw libraryError(ERR.INVALID_ARG_VALUE,
      'knayi.segment: bareConsonants must be \'pairs\', \'chains\' or \'separate\'', RangeError);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Preparing the text (row U1).

// Row U1: Unicode stores a dot below before asat (UTN #11), and 2.x breaks the text with the two swapped where they
// were typed the other way. Zawgyi text is broken as it is. The swap keeps every index, so a break of the prepared
// text is a break of the text.
const ASAT_THEN_DOT_BELOW = /\u103A\u1037/g;

export function prepareBreakText(text, font) {
  requireBreakFont(font);
  if (font === 'zawgyi' || text.indexOf('\u103A\u1037') === -1) return text;
  return text.replace(ASAT_THEN_DOT_BELOW, '\u1037\u103A');
}

// ---------------------------------------------------------------------------------------------------------------
// The breaks.

// Calls onBreak(index) at every break of the prepared text, in increasing order, never at 0, and stops when
// onBreak returns false. A break at i means a piece ends before the unit at i.
export function forEachBreak(prepared, font, onBreak, bareConsonants = BARE_CONSONANTS.PAIRS) {
  requireBreakFont(font);
  requireBareConsonants(bareConsonants);
  if (font === 'zawgyi') forEachZawgyiBreak(prepared, bareConsonants, onBreak);
  else forEachUnicodeBreak(prepared, bareConsonants, onBreak);
}

// 2.x breakParts: the pieces of the prepared text.
export function breakParts(text, font) {
  const prepared = prepareBreakText(text, font);
  const parts = [];
  let start = 0;
  forEachBreak(prepared, font, (index) => {
    parts.push(prepared.slice(start, index));
    start = index;
  });
  parts.push(prepared.slice(start));
  return parts;
}

// 2.x joinParts(breakParts(text, font), separator): the prepared text with the separator at every break. An empty
// separator means U+200B, as in 2.x. compat turns any other value into a string first, as Array#join does (C20).
export function breakString(text, font, separator) {
  const joiner = separator || ZWSP_TEXT;
  const prepared = prepareBreakText(text, font);
  let out = '';
  let start = 0;
  forEachBreak(prepared, font, (index) => {
    out += prepared.slice(start, index) + joiner;
    start = index;
  });
  return start === 0 ? prepared : out + prepared.slice(start);
}

// ---------------------------------------------------------------------------------------------------------------
// Lossless segmentation (3.0, decision 34): the breaks of forEachBreak on the text as given. Nothing is cleaned,
// trimmed or reordered, so segmentSyllables(text, font).join('') === text. Row U1's swap is read only to decide
// the breaks. U+200B and U+200C are ordinary units here. They never start a syllable, so each one stays at the end
// of the syllable before it; and they are not spaces, so a letter after one keeps the break that rows U3, U6, Z4
// and Z7 delete after a space.

// The indexes where a syllable starts, 0 left out: syllable k is text.slice(boundaries[k - 1], boundaries[k]).
export function syllableBoundaries(text, font, bareConsonants = BARE_CONSONANTS.PAIRS) {
  const boundaries = [];
  forEachBreak(prepareBreakText(text, font), font, (index) => {
    boundaries.push(index);
  }, bareConsonants);
  return boundaries;
}

// The syllables of the text, in order; [] for ''. Every piece is non-empty, and they join to the text.
export function segmentSyllables(text, font, bareConsonants = BARE_CONSONANTS.PAIRS) {
  const syllables = [];
  let start = 0;
  forEachBreak(prepareBreakText(text, font), font, (index) => {
    syllables.push(text.slice(start, index));
    start = index;
  }, bareConsonants);
  if (text.length > 0) syllables.push(text.slice(start));
  return syllables;
}

// ---------------------------------------------------------------------------------------------------------------
// Classes both fonts' rows read.

// The spaces and opening marks after which a letter gets no break (rows U3 and Z4): U+0009-U+000D, U+0020,
// U+00A0, U+2000-U+200A, U+2028, U+2029 and U+202F, then > U+201C U+2018 - ( [ { and U+2012-U+2014.
function isOpeningCharacter(code) {
  if (code <= 0x20) return code === 0x20 || (code >= 0x09 && code <= 0x0D);
  if (code < 0x2000) return code === 0x28 || code === 0x2D || code === 0x3E || code === 0x5B || code === 0x7B || code === 0xA0;
  return code <= 0x200A || (code >= 0x2012 && code <= 0x2014) || code === 0x2018 || code === 0x201C ||
    code === 0x2028 || code === 0x2029 || code === 0x202F;
}

// White space as JavaScript's \s reads it, after which a letter gets no break (rows U6 and Z7).
function isWhiteSpace(code) {
  if (code <= 0x20) return code === 0x20 || (code >= 0x09 && code <= 0x0D);
  if (code < 0x1680) return code === 0xA0;
  return code === 0x1680 || (code >= 0x2000 && code <= 0x200A) || code === 0x2028 || code === 0x2029 ||
    code === 0x202F || code === 0x205F || code === 0x3000 || code === 0xFEFF;
}

// ---------------------------------------------------------------------------------------------------------------
// Bare consonants (rows U7 and Z8, decision 34).

// Row U7, and row Z8: 2.x joins a bare consonant to the consonant after it with one global replace, which does not
// look again at the consonant it has just taken. So that consonant takes nothing after it, and ကကက breaks as
// ကက|က, which the comment of 2.x syllable.js:239 does not intend (DESIGN.md §10 Q11). The consonant before i may
// join the one at i unless the last join took it; `pairedAt` is the consonant the last join took.
function legacyBareConsonantPair(i, pairedAt) {
  return pairedAt !== i - 1;
}

// Whether the bare consonant before i joins the syllable that starts at i, under the policy.
function bareConsonantJoins(bareConsonants, i, pairedAt) {
  if (bareConsonants === BARE_CONSONANTS.PAIRS) return legacyBareConsonantPair(i, pairedAt);
  return bareConsonants === BARE_CONSONANTS.CHAINS;
}

// ---------------------------------------------------------------------------------------------------------------
// Unicode (rows U2-U7; row U1 is prepareBreakText).

// Calls onBreak at each break that rows U2-U7 leave in Unicode text.
function forEachUnicodeBreak(text, bareConsonants, onBreak) {
  let pairedAt = -1;
  for (let i = 1; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (!startsUnicodeSyllable(code)) continue;
    const before = text.charCodeAt(i - 1);
    if (unicodeJoinsBefore(text, i, code, before)) continue;
    if (isBurmeseConsonant(code) && isBurmeseConsonant(before) && bareConsonantJoins(bareConsonants, i, pairedAt)) {
      pairedAt = i; // U7
      continue;
    }
    if (onBreak(i) === false) return;
  }
}

// Row U2: the letters 2.x puts a break before: the consonants, the independent vowels but U+1022 and U+1028, great
// sa and the symbols U+104C-U+104F. U+1022 and U+1028 are syllable bases to the readers (isSyllableBase) but not
// here; the two sets stay apart until someone unifies them on purpose (DESIGN.md §3.1).
function startsUnicodeSyllable(code) {
  if (code <= 0x1021) return code >= 0x1000;
  return (code >= 0x1023 && code <= 0x102A && code !== 0x1028) || code === 0x103F || (code >= 0x104C && code <= 0x104F);
}

// Rows U3, U5 and U6: whether a join reason deletes the break before the letter `code` at i, with `before` the
// unit at i - 1. Row U4 is not here: its text starts with nga and asat, so row U5 decides every break it could.
function unicodeJoinsBefore(text, i, code, before) {
  if (isBurmeseConsonant(code)) {
    // U3: a consonant after a virama is stacked under the one before it (UTN #11); after a space or an opening
    // mark it stays with its word.
    if (before === CP.VIRAMA || isOpeningCharacter(before)) return true;
    // U5, first branch: a consonant with asat is the final of the syllable before it (UTN #11), also with a dot
    // below or visarga typed between them (ဖြင့်, ခြမး်; 41e18bf).
    if (isAsatAfterTones(text, i + 1)) return true;
  } else if (code === CP.LETTER_U && isConsonantOrMedial(before) && isAsatAfterTones(text, i + 1)) {
    // U5, second branch: u with asat is typed for nya, as in ညဥ့် (one syllable), but only right after a consonant
    // or medial; after a vowel sign it starts a syllable, as Pa'o writes it (ထွူ|လဲ|ဥ်း; 73214a3).
    return true;
  }
  return isWhiteSpace(before); // U6: the space already separates the pieces
}

// Row U5: whether asat is at j, after any dots below and visargas typed before it.
function isAsatAfterTones(text, j) {
  let code = text.charCodeAt(j);
  while (code === CP.DOT_BELOW || code === CP.VISARGA) code = text.charCodeAt(++j);
  return code === CP.ASAT;
}

// Row U5: the consonants and medials ya, ra, wa and ha (U+103B-U+103E).
function isConsonantOrMedial(code) {
  return isBurmeseConsonant(code) || (code >= CP.MEDIAL_YA && code <= CP.MEDIAL_HA);
}

// ---------------------------------------------------------------------------------------------------------------
// Zawgyi (rows Z1-Z8). Zawgyi stores text in drawing order: e and the medial ra glyphs come before their consonant,
// and kinzi after it (research/zawgyi-to-unicode.md §2).

// Zawgyi writes asat at U+1039, the code point of the Unicode virama.
const ZAWGYI_ASAT = 0x1039;

// What row Z8 lets a bare consonant take of what starts after it.
const TAKES_NOTHING = 0;
const TAKES_LONE_PREBASE = 1; // an e or medial ra with no base after it
const TAKES_SYLLABLE = 2; // a consonant, or a base with e or medial ra typed before it

// Calls onBreak at each break that rows Z1-Z8 leave in Zawgyi text.
function forEachZawgyiBreak(text, bareConsonants, onBreak) {
  const kinziRuleOn = !looksLikeSgawKaren(text);
  let pairedAt = -1;
  for (let i = 1; i < text.length; i++) {
    if (!zawgyiHasBreakAt(text, i, kinziRuleOn)) continue;
    const taken = zawgyiBareConsonantTakes(text, i, kinziRuleOn, bareConsonants, pairedAt);
    if (taken === TAKES_SYLLABLE) pairedAt = i;
    if (taken !== TAKES_NOTHING) continue;
    if (onBreak(i) === false) return;
  }
}

// Row Z6's switch. S'gaw Karen uses U+1064 as a tone mark, and its text is often detected as Zawgyi, so the kinzi
// row is off for text with a Karen vowel and asat (ၢ် or ၣ်), which Zawgyi text practically never has
// (a2d6e49: 308 of 673 GlotCC Karen lines). 2.x tests the pattern on the whole text given to breakParts.
const SGAW_KAREN_VOWEL_WITH_ASAT = /[\u1062\u1063]\u103A/;

export function looksLikeSgawKaren(text) {
  return SGAW_KAREN_VOWEL_WITH_ASAT.test(text);
}

// Rows Z1-Z7: whether a break is left before i (i > 0). Z1 and Z2 put one before every letter and every e or medial
// ra, except a medial ra typed right after e: Zawgyi types the two together before their consonant.
function zawgyiHasBreakAt(text, i, kinziRuleOn) {
  const code = text.charCodeAt(i);
  const before = text.charCodeAt(i - 1);
  if (isZawgyiPrebase(code)) {
    if (before === CP.E && isZawgyiMedialRa(code)) return false; // Z2
  } else if (!startsZawgyiSyllable(code)) {
    return false; // Z1
  }
  return !zawgyiJoinsBefore(text, i, code, before, kinziRuleOn);
}

// Row Z1: the letters 2.x puts a break before: the consonants, the independent vowels but U+1022 and U+1028, the
// symbols U+104C-U+104F, and U+1086 and U+108F-U+1092.
function startsZawgyiSyllable(code) {
  if (code <= 0x1021) return code >= 0x1000;
  return (code >= 0x1023 && code <= 0x102A && code !== 0x1028) || (code >= 0x104C && code <= 0x104F) ||
    code === 0x1086 || (code >= 0x108F && code <= 0x1092);
}

// The bases of rows Z3, Z4, Z5 and Z8: the consonants, U+1025, U+1029, U+106A, U+106B, U+1086, U+108F and U+1090.
// They match neither the letters of row Z1 nor the bases of the Zawgyi glyph table (syllable.js:226 against
// zawgyi.js:29-30); the sets stay apart until someone unifies them on purpose (DESIGN.md §10 Q17).
function isZawgyiBreakBase(code) {
  if (code <= 0x1021) return code >= 0x1000;
  return code === 0x1025 || code === 0x1029 || code === 0x106A || code === 0x106B || code === 0x1086 ||
    code === 0x108F || code === 0x1090;
}

// Rows Z3-Z7: whether a join reason deletes the break before the letter, e or medial ra `code` at i.
function zawgyiJoinsBefore(text, i, code, before, kinziRuleOn) {
  const isBase = isZawgyiBreakBase(code);
  // Z3: an e or medial ra typed before a base belongs to it (research/zawgyi-to-unicode.md §2).
  if (isBase && isZawgyiPrebase(before)) return true;
  // Z4: a base, e or medial ra after a space or an opening mark stays with its word, as row U3.
  if ((isBase || isZawgyiPrebase(code)) && isOpeningCharacter(before)) return true;
  // Z5: a base with asat is the final of the syllable before it (UTN #11), also with dots below or a visarga typed
  // before the asat (ငး္, င့္; b982c98, a2d6e49).
  if (isBase && isZawgyiAsatAfterTones(text, i + 1)) return true;
  // Z6: kinzi is the final nga of the syllable before (UTN #11), but Zawgyi writes it after its consonant.
  if (kinziRuleOn && startsKinziSyllable(text, i)) return true;
  return startsZawgyiSyllable(code) && isWhiteSpace(before); // Z7, as row U6
}

// Row Z5: whether Zawgyi's asat is at j, after any dots below (U+1037, U+1094, U+1095) and visargas.
function isZawgyiAsatAfterTones(text, j) {
  let code = text.charCodeAt(j);
  while (code === CP.DOT_BELOW || code === CP.VISARGA || code === 0x1094 || code === 0x1095) {
    code = text.charCodeAt(++j);
  }
  return code === ZAWGYI_ASAT;
}

// Row Z6: whether a consonant carrying kinzi starts at i, with any e or medial ra typed before it (ျခေသၤ့). Rows
// Z1-Z5 leave a break between any two such glyphs but e and the medial ra after it, so those two are the longest
// run the row can read before the consonant.
function startsKinziSyllable(text, i) {
  let j = i;
  if (text.charCodeAt(j) === CP.E && isZawgyiMedialRa(text.charCodeAt(j + 1))) j += 2;
  else if (isZawgyiPrebase(text.charCodeAt(j))) j += 1;
  return isBurmeseConsonant(text.charCodeAt(j)) && isZawgyiKinzi(text.charCodeAt(j + 1));
}

// Row Z8: what the bare consonant before i takes of what starts at i, where rows Z1-Z7 left a break. A consonant
// typed after e or a medial ra already has its marks, like ကြ in Unicode: the row's first branch takes it whole,
// so it takes nothing (ကၾက|ပါ; b982c98). A lone e or medial ra joins the consonant before it under every policy,
// unless 2.x's pairs have just taken that consonant. A syllable joins as the policy says, read by
// bareConsonantJoins as row U7 reads it.
function zawgyiBareConsonantTakes(text, i, kinziRuleOn, bareConsonants, pairedAt) {
  if (!isBurmeseConsonant(text.charCodeAt(i - 1)) || isZawgyiPrebase(text.charCodeAt(i - 2))) return TAKES_NOTHING;
  if (bareConsonants === BARE_CONSONANTS.PAIRS && !legacyBareConsonantPair(i, pairedAt)) return TAKES_NOTHING;
  const code = text.charCodeAt(i);
  if (isZawgyiPrebase(code)) {
    if (!startsBaseWithPrebase(text, i, kinziRuleOn)) return TAKES_LONE_PREBASE;
  } else if (!isBurmeseConsonant(code)) {
    return TAKES_NOTHING;
  }
  return bareConsonantJoins(bareConsonants, i, pairedAt) ? TAKES_SYLLABLE : TAKES_NOTHING;
}

// Row Z8: whether the e or medial ra at i starts a run of them that reaches a base with no break inside. A base
// never has a break after one of them (row Z3). The run is at most four glyphs: e and a medial ra, twice, when row
// Z6 deleted the break between the pairs.
function startsBaseWithPrebase(text, i, kinziRuleOn) {
  let j = i + 1;
  while (isZawgyiPrebase(text.charCodeAt(j)) && !zawgyiHasBreakAt(text, j, kinziRuleOn)) j++;
  return isZawgyiBreakBase(text.charCodeAt(j));
}

// ---------------------------------------------------------------------------------------------------------------
// Repeated marks: 2.x spellingFix (syllable.js:204-222).

// 2.x collapsed each run of one repeated mark with one regex per mark of the font, in turn. Collapsing a run never
// makes a run of another mark, so one pass that collapses every run gives the same text. The text itself comes
// back when there is nothing to collapse. Given a unit set (script/codes.js), the same pass adds to it every unit
// of U+1000-U+109F the text holds, for rules/unicodeToZawgyi.js; collapsing removes none of them.
export function collapseRepeatedMarks(text, font, units) {
  requireBreakFont(font);
  const isRepeatable = font === 'zawgyi' ? isRepeatableZawgyiMark : isRepeatableUnicodeMark;
  const noting = units !== undefined;
  let out = '';
  let copyFrom = 0;
  let previous = -1;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (noting) addBlockUnit(units, code);
    if (code === previous && isRepeatable(code)) {
      out += text.slice(copyFrom, i);
      while (text.charCodeAt(i + 1) === code) i++;
      copyFrom = i + 1;
    }
    previous = code;
  }
  return copyFrom === 0 ? text : out + text.slice(copyFrom);
}

// The marks 2.x collapses in Unicode text (COLLAPSE.unicode): the vowel signs, e and ai, U+102B-U+1032; anusvara,
// dot below, visarga, virama, asat and the medials, U+1036-U+103E.
function isRepeatableUnicodeMark(code) {
  return (code >= 0x102B && code <= 0x1032) || (code >= 0x1036 && code <= 0x103E);
}

// The marks 2.x collapses in Zawgyi text (COLLAPSE.zawgyi): the Burmese marks U+102B-U+1034 and U+1036-U+103D,
// and the Zawgyi glyphs U+105A, U+1060-U+106D, U+1070-U+1085, U+1087-U+108E and U+1093-U+1096.
function isRepeatableZawgyiMark(code) {
  return (code >= 0x102B && code <= 0x1034) || (code >= 0x1036 && code <= 0x103D) || code === 0x105A ||
    (code >= 0x1060 && code <= 0x106D) || (code >= 0x1070 && code <= 0x1085) ||
    (code >= 0x1087 && code <= 0x108E) || (code >= 0x1093 && code <= 0x1096);
}
