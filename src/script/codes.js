// Code points and character classes of the Myanmar script: one definition of each concept that more than one
// module of src/ uses (DESIGN.md §2.3, §3.1, §3.2). Layer L0: imports only freeze.js.
//
// The tables match Unicode 15.1, as library/ does. test/next/unicode.test.mjs checks them against the runtime's
// Unicode data (decision 20c). Myanmar Extended-C (U+116D0-U+116E3, Unicode 16.0) lies above U+FFFF and stays
// unclassified until 3.0 reads code points (decision 20b).
//
// Every function takes a char code (String#charCodeAt): one UTF-16 unit, never a one-character string. Names say
// their scope (DESIGN.md Appendix A):
//   Burmese  the Burmese letters, marks and digits of the Myanmar block, U+1000-U+109F;
//   Script   every language written in the three Myanmar blocks: U+1000-U+109F, Extended-B (U+A9E0-U+A9FF)
//            and Extended-A (U+AA60-U+AA7F);
//   Zawgyi   the code points as the Zawgyi font uses them.
// test/next/codes.test.mjs checks every predicate, class and rank against its 2.x definition on all 65,536 units.

import { deepFreeze } from '../freeze.js';

// ---------------------------------------------------------------------------------------------------------------
// Code points. Numbers only.

export const CP = /* @__PURE__ */ deepFreeze({
  // Letters.
  KA: 0x1000, NGA: 0x1004, CA: 0x1005, JHA: 0x1008, NYA: 0x1009, RA: 0x101B, WA: 0x101D,
  LETTER_U: 0x1025, LETTER_UU: 0x1026, LETTER_O: 0x1029, LETTER_AU: 0x102A, GREAT_SA: 0x103F,
  // Vowel signs.
  TALL_AA: 0x102B, AA: 0x102C, I: 0x102D, II: 0x102E, U: 0x102F, UU: 0x1030, E: 0x1031, AI: 0x1032,
  // Tones, virama, asat and medials.
  ANUSVARA: 0x1036, DOT_BELOW: 0x1037, VISARGA: 0x1038, VIRAMA: 0x1039, ASAT: 0x103A,
  MEDIAL_YA: 0x103B, MEDIAL_RA: 0x103C, MEDIAL_WA: 0x103D, MEDIAL_HA: 0x103E,
  // Digits, punctuation and lagaung.
  DIGIT_ZERO: 0x1040, DIGIT_FOUR: 0x1044, DIGIT_SEVEN: 0x1047, LITTLE_SECTION: 0x104A, SECTION: 0x104B,
  LAGAUNG: 0x104E,
  // Spaces and zero-width characters.
  SPACE: 0x20, NBSP: 0xA0, ZWSP: 0x200B, ZWNJ: 0x200C, ZWJ: 0x200D, WORD_JOINER: 0x2060, BOM: 0xFEFF
});

// Kinzi: nga, asat and virama, written before the consonant it sits on (UTN #11). One copy for src/; 2.x had
// three (zawgyi.js:23, win.js:25, syllable.js:114).
export const KINZI_TEXT = '\u1004\u103A\u1039';

// ---------------------------------------------------------------------------------------------------------------
// Burmese predicates. Each restates a 2.x definition exactly; the comment names it.

// Consonants ka to a (storageOrder.js isConsonant).
export function isBurmeseConsonant(code) {
  return code >= 0x1000 && code <= 0x1021;
}

// Units that start a syllable and take marks: the consonants, the independent vowels U+1022-U+102A, great sa
// and the symbols U+104C-U+104F (storageOrder.js isMyanmarLetter).
export function isSyllableBase(code) {
  return (code >= 0x1000 && code <= 0x102A) || code === 0x103F || (code >= 0x104C && code <= 0x104F);
}

// The digits zero to nine (storageOrder.js isDigit).
export function isBurmeseDigit(code) {
  return code >= 0x1040 && code <= 0x1049;
}

// The Burmese marks that follow a base in Unicode text: vowel signs, e, anusvara, dot below, visarga, asat and
// medials. Not virama, and not the Mon vowel signs U+1033-U+1035 (storageOrder.js isUnicodeMark).
export function isBurmeseMark(code) {
  return (code >= 0x102B && code <= 0x1032) || (code >= 0x1036 && code <= 0x1038) || (code >= 0x103A && code <= 0x103E);
}

// e and medial ra: drawn before the consonant, so people used to Zawgyi type them before it (research/normalize.md
// §3; storageOrder.js isTypedFirst).
export function isPrebaseMark(code) {
  return code === 0x1031 || code === 0x103C;
}

// A letter or mark of the Myanmar blocks that the Burmese rules do not read, such as the Mon, Shan and Karen
// letters, medials and tones (storageOrder.js isOtherMyanmar). They end a syllable and stay where they are
// (research/normalize.md §5).
export function isOtherScriptLetter(code) {
  return classOf(code) === CLS.OTHER_SCRIPT;
}

// The vowel signs tall aa to ai, and anusvara. A letter u right after one stays u, as Pa'o writes it
// (research/normalize.md §3, on the letters u and nya; the afterVowel test of storageOrder.js arrangeUnicode).
export function isVowelSign(code) {
  return (code >= 0x102B && code <= 0x1032) || code === 0x1036;
}

// Space and no-break space: typed between a syllable and its next mark, they only moved the mark
// (research/zawgyi-to-unicode.md §3; storageOrder.js isSpace).
export function isSpaceBeforeMark(code) {
  return code === 0x20 || code === 0xA0;
}

// The Myanmar block, U+1000-U+109F: what every 2.x function checks first for Myanmar text (contentGate.js
// MYANMAR). It leaves out Extended-A and -B on purpose (DESIGN.md C8).
export function isMyanmarBlock(code) {
  return code >= 0x1000 && code <= 0x109F;
}

// The three Myanmar blocks: the no-Myanmar fast path of normalize (DESIGN.md §3.10).
export function isMyanmarScript(code) {
  return isMyanmarBlock(code) || isMyanmarExtendedAOrB(code);
}

// Myanmar Extended-B (U+A9E0-U+A9FF: Shan and Tai Laing) and Extended-A (U+AA60-U+AA7F: Khamti Shan, Aiton and
// Phake). Every unit of them is another language's to the Burmese rules.
function isMyanmarExtendedAOrB(code) {
  return (code >= 0xA9E0 && code <= 0xA9FF) || (code >= 0xAA60 && code <= 0xAA7F);
}

// ---------------------------------------------------------------------------------------------------------------
// The Burmese reader's classes: disjoint, one per unit (DESIGN.md §3.1). CLASS drives the Unicode reader's
// dispatch; it is built from the predicates above, so each set has one definition.

export const CLS = /* @__PURE__ */ deepFreeze({
  OTHER: 0, // outside the three Myanmar blocks
  CONSONANT: 1, // isBurmeseConsonant
  LETTER: 2, // the other syllable bases: U+1022-U+102A, U+103F, U+104C-U+104F
  DIGIT: 3, // isBurmeseDigit
  MARK: 4, // isBurmeseMark, less e and medial ra
  PREBASE: 5, // isPrebaseMark
  VIRAMA: 6, // U+1039
  PUNCTUATION: 7, // little section and section, U+104A and U+104B
  OTHER_SCRIPT: 8 // the rest of the blocks: U+1033-U+1035, U+1050-U+109F, and all of Extended-A and -B
});

// CLS of each unit of U+1000-U+109F, indexed by code - 0x1000.
export const CLASS = /* @__PURE__ */ buildClassTable();

function buildClassTable() {
  const table = new Uint8Array(0xA0);
  for (let code = 0x1000; code <= 0x109F; code++) table[code - 0x1000] = burmeseBlockClass(code);
  return table;
}

// The class of a unit of the Myanmar block. The order of the tests makes the classes disjoint.
function burmeseBlockClass(code) {
  if (isBurmeseConsonant(code)) return CLS.CONSONANT;
  if (isSyllableBase(code)) return CLS.LETTER;
  if (isBurmeseDigit(code)) return CLS.DIGIT;
  if (isPrebaseMark(code)) return CLS.PREBASE;
  if (isBurmeseMark(code)) return CLS.MARK;
  if (code === CP.VIRAMA) return CLS.VIRAMA;
  if (code === CP.LITTLE_SECTION || code === CP.SECTION) return CLS.PUNCTUATION;
  return CLS.OTHER_SCRIPT;
}

// CLASS in U+1000-U+109F; OTHER_SCRIPT in Extended-A and -B; OTHER elsewhere.
export function classOf(code) {
  if (isMyanmarBlock(code)) return CLASS[code - 0x1000];
  return isMyanmarExtendedAOrB(code) ? CLS.OTHER_SCRIPT : CLS.OTHER;
}

// ---------------------------------------------------------------------------------------------------------------
// Zero-width characters, as bits, so a reader's options can name the ones it holds (DESIGN.md §3.5).

export const ZW = /* @__PURE__ */ deepFreeze({
  ZWSP: 1, // U+200B zero-width space
  ZWNJ: 2, // U+200C zero-width non-joiner
  ZWJ: 4, // U+200D zero-width joiner
  WORD_JOINER: 8, // U+2060
  BOM: 16, // U+FEFF, the zero-width no-break space
  ALL: 31 // ZWSP | ZWNJ | ZWJ | WORD_JOINER | BOM
});

// The ZW bit of a zero-width character, else 0 (storageOrder.js isZeroWidth: the five units).
export function zeroWidthBit(code) {
  if (code < 0x200B) return 0; // every Myanmar-block unit, space and ASCII
  switch (code) {
    case 0x200B: return ZW.ZWSP;
    case 0x200C: return ZW.ZWNJ;
    case 0x200D: return ZW.ZWJ;
    case 0x2060: return ZW.WORD_JOINER;
    case 0xFEFF: return ZW.BOM;
    default: return 0;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Script-wide classes for the typing fixes: every language of the three blocks, not only Burmese (issue #43;
// research/normalize.md §3, "Shan, Mon and Karen marks"). A unit can have several flags.

export const SCRIPT = /* @__PURE__ */ deepFreeze({
  MARK: 1, // medials, vowel signs, asat and virama of every language, and the Burmese tones
  TONE: 2, // the tone marks of the other languages
  CONSONANT: 4, // the consonants of every language
  WORD: 8, // a letter or mark of a word: anything in the blocks but digits and the section marks
  DIGIT: 16, // Burmese, Shan and Tai Laing digits
  BURMESE_DIGIT: 32 // U+1040-U+1049
});

// SCRIPT flags of each unit of the three blocks, indexed by scriptIndex(code).
const SCRIPT_CLASS = /* @__PURE__ */ buildScriptTable();

// The ranges restate typingFixes.js:18-37 exactly, as [first, last] pairs.
function buildScriptTable() {
  const table = new Uint8Array(0xE0);
  // MARKS (typingFixes.js:20-24): combining marks of Burmese, Mon, Shan, Karen and the rest, and the Burmese tones.
  flagRanges(table, SCRIPT.MARK, [[0x102B, 0x103E], [0x1056, 0x1059], [0x105E, 0x1060], [0x1062, 0x1062],
    [0x1067, 0x1068], [0x1071, 0x1074], [0x1082, 0x1086], [0x109C, 0x109D], [0xA9E5, 0xA9E5]]);
  // TONES (typingFixes.js:25-27): a tone alone makes no zero or seven a letter (research/normalize.md §3).
  flagRanges(table, SCRIPT.TONE, [[0x1063, 0x1064], [0x1069, 0x106D], [0x1087, 0x108D], [0x108F, 0x108F],
    [0x109A, 0x109B], [0xAA7B, 0xAA7D]]);
  // CONSONANTS (typingFixes.js:28-30). Shan ka to ha is U+1075-U+1081.
  flagRanges(table, SCRIPT.CONSONANT, [[0x1000, 0x1021], [0x103F, 0x103F], [0x1050, 0x1051], [0x105A, 0x105D],
    [0x1061, 0x1061], [0x1065, 0x1066], [0x106E, 0x1070], [0x1075, 0x1081], [0x108E, 0x108E], [0xA9E0, 0xA9E4],
    [0xA9E7, 0xA9EF], [0xA9FA, 0xA9FE], [0xAA60, 0xAA76], [0xAA7A, 0xAA7A], [0xAA7E, 0xAA7F]]);
  // WORD_CHAR (typingFixes.js:34-35).
  flagRanges(table, SCRIPT.WORD, [[0x1000, 0x103F], [0x104C, 0x108F], [0x109A, 0x109F], [0xA9E0, 0xA9EF],
    [0xA9FA, 0xA9FE], [0xAA60, 0xAA7F]]);
  // ANY_DIGIT (typingFixes.js:36-37): Burmese, Shan (U+1090-U+1099) and Tai Laing (U+A9F0-U+A9F9).
  flagRanges(table, SCRIPT.DIGIT, [[0x1040, 0x1049], [0x1090, 0x1099], [0xA9F0, 0xA9F9]]);
  // isDigit (typingFixes.js:39-41).
  flagRanges(table, SCRIPT.BURMESE_DIGIT, [[0x1040, 0x1049]]);
  return table;
}

function flagRanges(table, flag, ranges) {
  for (let r = 0; r < ranges.length; r++) {
    for (let code = ranges[r][0]; code <= ranges[r][1]; code++) table[scriptIndex(code)] |= flag;
  }
}

// The index of a unit in SCRIPT_CLASS: the Myanmar block, then Extended-B, then Extended-A. -1 elsewhere.
function scriptIndex(code) {
  if (code >= 0x1000 && code <= 0x109F) return code - 0x1000;
  if (code >= 0xA9E0 && code <= 0xA9FF) return code - 0xA9E0 + 0xA0;
  if (code >= 0xAA60 && code <= 0xAA7F) return code - 0xAA60 + 0xC0;
  return -1;
}

// SCRIPT flags over the three blocks; 0 elsewhere.
export function scriptClassOf(code) {
  const index = scriptIndex(code);
  return index < 0 ? 0 : SCRIPT_CLASS[index];
}

export function isScriptMark(code) {
  return (scriptClassOf(code) & SCRIPT.MARK) !== 0;
}

export function isScriptTone(code) {
  return (scriptClassOf(code) & SCRIPT.TONE) !== 0;
}

export function isScriptConsonant(code) {
  return (scriptClassOf(code) & SCRIPT.CONSONANT) !== 0;
}

export function isScriptWordChar(code) {
  return (scriptClassOf(code) & SCRIPT.WORD) !== 0;
}

// Burmese, Shan (U+1090-U+1099) and Tai Laing (U+A9F0-U+A9F9) digits.
export function isScriptDigit(code) {
  return (scriptClassOf(code) & SCRIPT.DIGIT) !== 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Zawgyi classes, shared by rules/detect.js and rules/segment.js. Zawgyi stores text in drawing order, so e and the
// medial ra glyphs come before the consonant, and kinzi after it (research/zawgyi-to-unicode.md §2).

// e (U+1031), and the medial ra glyphs: U+103B and its variants U+107E-U+1084 (the class
// [\u1031\u103b\u107e-\u1084] of syllable.js:228-242 and of the detector's Zawgyi signatures).
export function isZawgyiPrebase(code) {
  return code === 0x1031 || isZawgyiMedialRa(code);
}

// The medial ra glyphs: U+103B and U+107E-U+1084 (syllable.js:227; the Zawgyi signatures of
// scripts/oracle/signatures.js).
export function isZawgyiMedialRa(code) {
  return code === 0x103B || (code >= 0x107E && code <= 0x1084);
}

// The kinzi glyphs: U+1064, and U+108B-U+108D, kinzi drawn with i, ii or anusvara (syllable.js:237).
export function isZawgyiKinzi(code) {
  return code === 0x1064 || (code >= 0x108B && code <= 0x108D);
}

// ---------------------------------------------------------------------------------------------------------------
// Mark order (DESIGN.md §3.2). The storage order of the marks after the base, from UTN #11 (version 4), as
// storageOrder.js:19-32 has it. Marks in one group keep the order they were typed in.

export const MARK_GROUPS = /* @__PURE__ */ deepFreeze([
  [0x103B], // 0 medial ya
  [0x103C], // 1 medial ra
  [0x103D], // 2 medial wa
  [0x103E], // 3 medial ha
  [0x1031], // 4 e
  [0x102D, 0x102E], // 5 i, ii
  [0x102F, 0x1030], // 6 u, uu: the lower vowels
  [0x102B, 0x102C], // 7 tall aa, aa
  [0x1032, 0x1036], // 8 ai and anusvara: after a lower vowel or aa, as Mon and Pa'o write them (UTN #11)
  [0x1037], // 9 dot below
  [0x103A], // 10 asat
  [0x1038] // 11 visarga
]);

// The rank of a mark in no group: after every group, so U+1033-U+1035 and U+1039 sort last, as 2.x rank() does.
export const RANK_UNRANKED = /* @__PURE__ */ rankAfterGroups(MARK_GROUPS);

function rankAfterGroups(groups) {
  return groups.length;
}

// The MARK_GROUPS index of each unit of U+102B-U+103E, indexed by code - 0x102B; RANK_UNRANKED for the rest.
export const MARK_RANK = /* @__PURE__ */ buildMarkRank(MARK_GROUPS);

function buildMarkRank(groups) {
  const ranks = new Int8Array(20).fill(groups.length);
  for (let rank = 0; rank < groups.length; rank++) {
    for (let m = 0; m < groups[rank].length; m++) ranks[groups[rank][m] - 0x102B] = rank;
  }
  return ranks;
}

// MARK_RANK in U+102B-U+103E, else RANK_UNRANKED (storageOrder.js rank).
export function markRank(code) {
  return code >= 0x102B && code <= 0x103E ? MARK_RANK[code - 0x102B] : RANK_UNRANKED;
}

// The ranks the rules name, read from the table by code point (storageOrder.js:34-37 copied them by hand).
export const RANK_LAST_MEDIAL = /* @__PURE__ */ markRank(0x103E); // 3, medial ha: an asat after it is Mon's final h
export const RANK_E = /* @__PURE__ */ markRank(0x1031); // 4
export const RANK_FIRST_VOWEL = /* @__PURE__ */ markRank(0x102D); // 5, i and ii: vowels and finals from here on
export const RANK_LOWER_VOWEL = /* @__PURE__ */ markRank(0x102F); // 6
export const RANK_AI_ANUSVARA = /* @__PURE__ */ markRank(0x1032); // 8

// The bit of a mark in a 20-bit set of the marks U+102B-U+103E. Every mark a reader pushes lies in that range
// (DESIGN.md §3.3); the result for any other code is meaningless.
export function markBit(code) {
  return 1 << (code - 0x102B);
}

// Sets of marks, as unions of markBit. Each is a number literal (DESIGN.md §2.4 rule 6), and
// test/next/codes.test.mjs checks it against the marks its comment names.
export const MASK_ANY_AA = 0x3; // tall aa U+102B, aa U+102C
export const MASK_UPPER_VOWELS = 0xC; // i U+102D, ii U+102E
export const MASK_LOWER_VOWELS = 0x30; // u U+102F, uu U+1030
export const MASK_E_OR_AA = 0x43; // e U+1031, tall aa U+102B, aa U+102C
export const MASK_MEDIALS = 0xF0000; // medial ya, ra, wa and ha, U+103B-U+103E
// Every mark ranked RANK_FIRST_VOWEL or later, asat aside: U+102B-U+1030 and U+1032-U+1039. A syllable with one
// already has its vowel or final (2.x hasVowel, storageOrder.js:376-383).
export const MASK_VOWEL_OR_FINAL = 0x7FBF;
export const MASK_ASAT = 0x8000; // U+103A
export const MASK_DOT_BELOW = 0x1000; // U+1037
export const MASK_VISARGA = 0x2000; // U+1038
export const MASK_MEDIAL_YA = 0x10000; // U+103B
export const MASK_MEDIAL_HA = 0x80000; // U+103E
// The marks ranked from RANK_E to dot below: e, i, ii, u, uu, tall aa, aa, ai, anusvara and dot below,
// U+102B-U+1032, U+1036 and U+1037 (MARK_GROUPS 4-9).
export const MASK_E_TO_DOT_BELOW = 0x18FF;

// ---------------------------------------------------------------------------------------------------------------
// Glyph roles: what a font's glyph does in a syllable (DESIGN.md D7, §3.6). The fonts (L2) need them and may not
// import the engine (L3), so they live here. 2.x named them with strings (storageOrder.js:10-16), where
// BEFORE_BASE was PRE and PLAIN was TEXT.

export const ROLE = /* @__PURE__ */ deepFreeze({
  BASE: 1, // consonant, independent vowel, digit or symbol: starts a syllable
  BEFORE_BASE: 2, // drawn before the consonant (e, medial ra): belongs to the next base
  MARK: 3, // medial, vowel sign or tone
  STACK: 4, // stacked consonant under the base
  KINZI: 5, // kinzi, drawn over the base and stored before it
  PLAIN: 6 // anything else: ends the syllable
});

// ---------------------------------------------------------------------------------------------------------------
// NFC (DESIGN.md §3.10).

// Units that NFC never moves or composes next to the text the engine writes: they have combining class 0, are
// NFC-stable alone, and compose with no unit of U+1000-U+109F on either side. So the final-NFC gate may stay
// closed when the only units outside the Myanmar block are these. The set (943 code points) was checked on
// Node 26's ICU, and test/next/codes.test.mjs checks it again on every runtime the tests run on.
export function isNfcSafe(code) {
  return code < 0x300 || (code >= 0x2002 && code <= 0x206F) || code === 0xFEFF || isMyanmarExtendedAOrB(code);
}

// Whether NFC may move or compose the unit, wherever it stands in text the engine writes. In U+1000-U+109F: dot
// below, virama and asat (combining classes 7, 9 and 9), U+108D (220), and U+1025, which composes with a U+102E
// after it into U+1026. Elsewhere: a unit at or above U+0300 for which isNfcSafe does not hold. The font reader
// notes these for the final-NFC gate of the font pipeline (DESIGN.md §3.10, gate 4); test/next/codes.test.mjs
// checks the block's part on every runtime the tests run on.
export function mayChangeUnderNfc(code) {
  if (code < 0x300) return false;
  if (!isMyanmarBlock(code)) return !isNfcSafe(code);
  return code === CP.LETTER_U || code === CP.DOT_BELOW || code === CP.VIRAMA || code === CP.ASAT || code === 0x108D;
}

// ---------------------------------------------------------------------------------------------------------------
// Unit sets (DESIGN.md §3.10): the units of U+1000-U+109F a text may hold, as 160 bits in an Int32Array of
// UNIT_SET_WORDS words, bit k of word w for the unit 0x1000 + 32w + k. rules/segment.js fills one while it
// collapses repeated marks, and rules/unicodeToZawgyi.js skips each row that needs a unit the set does not hold.

export const UNIT_SET_WORDS = 5;

// Adds the unit to the set when it lies in U+1000-U+109F; any other unit is left out.
export function addBlockUnit(units, code) {
  const k = code - 0x1000;
  if (k >= 0 && k < 0xA0) units[k >> 5] |= 1 << (k & 31);
}

// ---------------------------------------------------------------------------------------------------------------
// Patterns with no g flag, for test() only, so they keep no lastIndex. Each matches one unit for which its
// predicate holds.

export const MYANMAR_BLOCK_PATTERN = /[\u1000-\u109F]/; // isMyanmarBlock
export const MYANMAR_SCRIPT_PATTERN = /[\u1000-\u109F\uA9E0-\uA9FF\uAA60-\uAA7F]/; // isMyanmarScript
