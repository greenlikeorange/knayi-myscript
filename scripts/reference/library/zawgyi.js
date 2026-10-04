'use strict';
// Zawgyi -> Unicode.
//
// Zawgyi puts Burmese glyphs on the Unicode 5.0 Myanmar code points, and on U+1060-U+1097 for the shapes
// Unicode leaves to the font: stacked consonants, kinzi, and short, small or cut forms of letters and marks.
// Like Win, it stores text in the order the glyphs are drawn: e and medial ra before the consonant, kinzi
// and stacked consonants after it, and the marks in any order.
//
// Conversion:
// 1. Lagaung typed with the digit four, or with the nga, asat and visarga its glyph already draws, becomes
//    the lagaung glyph.
// 2. Each Zawgyi glyph becomes Unicode characters, with its role in the syllable.
// 3. Each syllable is written in Unicode storage order (storageOrder.js), a zero that is not part of a
//    number becomes wa, and the result is NFC.

const storageOrder = require('./storageOrder');

const BASE = storageOrder.ROLES.BASE;
const PRE = storageOrder.ROLES.PRE;
const MARK = storageOrder.ROLES.MARK;
const STACK = storageOrder.ROLES.STACK;
const KINZI = storageOrder.ROLES.KINZI;

const KINZI_TEXT = '\u1004\u103A\u1039';

// Zawgyi code point -> [role, Unicode text, marks that come with it]. Consonants and independent vowels
// keep their code points and are bases without an entry.
const ZAWGYI = {
  // Letters in another shape
  '\u106A': [BASE, '\u1009'], // nya, small, for a mark below
  '\u106B': [BASE, '\u100A'], // nnya, short
  '\u108F': [BASE, '\u1014'], // na, short, for a mark below
  '\u1090': [BASE, '\u101B'], // ra, short, for a mark below
  '\u1086': [BASE, '\u103F'], // great sa
  '\u104E': [BASE, '\u104E\u1004\u103A\u1038'], // lagaung, drawn with its nga, asat and visarga

  // Two consonants in one glyph
  '\u106E': [BASE, '\u100D\u1039\u100D'], // dda + dda
  '\u106F': [BASE, '\u100D\u1039\u100E'], // dda + ddha
  '\u1091': [BASE, '\u100F\u1039\u100D'], // nna + dda
  '\u1092': [BASE, '\u100B\u1039\u100C'], // tta + ttha
  '\u1097': [BASE, '\u100B\u1039\u100B'], // tta + tta

  // Vowel signs, tones and asat
  '\u102B': [MARK, '\u102B'], // tall aa
  '\u102C': [MARK, '\u102C'], // aa
  '\u105A': [MARK, '\u102B\u103A'], // tall aa with asat
  '\u102D': [MARK, '\u102D'], // i
  '\u102E': [MARK, '\u102E'], // ii
  '\u108E': [MARK, '\u102D\u1036'], // i with anusvara
  '\u102F': [MARK, '\u102F'], // u
  '\u1033': [MARK, '\u102F'], // u, long
  '\u1030': [MARK, '\u1030'], // uu
  '\u1034': [MARK, '\u1030'], // uu, long
  '\u1031': [PRE, '\u1031'], // e
  '\u1032': [MARK, '\u1032'], // ai
  '\u1036': [MARK, '\u1036'], // anusvara
  '\u1037': [MARK, '\u1037'], // dot below
  '\u1094': [MARK, '\u1037'], // dot below, moved right
  '\u1095': [MARK, '\u1037'], // dot below, moved further right
  '\u1038': [MARK, '\u1038'], // visarga
  '\u1039': [MARK, '\u103A'], // asat

  // Kinzi
  '\u1064': [KINZI, KINZI_TEXT],
  '\u108B': [KINZI, KINZI_TEXT, '\u102D'], // kinzi with i
  '\u108C': [KINZI, KINZI_TEXT, '\u102E'], // kinzi with ii
  '\u108D': [KINZI, KINZI_TEXT, '\u1036'], // kinzi with anusvara

  // Medials
  '\u103A': [MARK, '\u103B'], // ya
  '\u107D': [MARK, '\u103B'], // ya, short
  '\u103C': [MARK, '\u103D'], // wa
  '\u103D': [MARK, '\u103E'], // ha
  '\u1087': [MARK, '\u103E'], // ha, short
  '\u103E': [MARK, '\u103E'], // Unicode's ha, which Zawgyi does not use, in mixed text
  '\u108A': [MARK, '\u103D\u103E'], // wa with ha
  '\u1088': [MARK, '\u103E\u102F'], // ha with u
  '\u1089': [MARK, '\u103E\u1030'], // ha with uu
  '\u103B': [PRE, '\u103C'], // ra, narrow
  '\u107E': [PRE, '\u103C'], // ra, wide
  '\u107F': [PRE, '\u103C'], // ra, narrow, cut for an upper vowel
  '\u1080': [PRE, '\u103C'], // ra, wide, cut for an upper vowel
  '\u1081': [PRE, '\u103C'], // ra, narrow, cut for a lower mark
  '\u1082': [PRE, '\u103C'], // ra, wide, cut for a lower mark
  '\u1083': [PRE, '\u103C'], // ra, narrow, cut at both ends
  '\u1084': [PRE, '\u103C'], // ra, wide, cut at both ends

  // Stacked consonants
  '\u1060': [STACK, '\u1039\u1000'], // ka
  '\u1061': [STACK, '\u1039\u1001'], // kha
  '\u1062': [STACK, '\u1039\u1002'], // ga
  '\u1063': [STACK, '\u1039\u1003'], // gha
  '\u1065': [STACK, '\u1039\u1005'], // ca
  '\u1066': [STACK, '\u1039\u1006'], // cha
  '\u1067': [STACK, '\u1039\u1006'], // cha, other width
  '\u1068': [STACK, '\u1039\u1007'], // ja
  '\u1069': [STACK, '\u1039\u1008'], // jha
  '\u106C': [STACK, '\u1039\u100B'], // tta
  '\u106D': [STACK, '\u1039\u100C'], // ttha
  '\u1070': [STACK, '\u1039\u100F'], // nna
  '\u1071': [STACK, '\u1039\u1010'], // ta
  '\u1072': [STACK, '\u1039\u1010'], // ta, narrow
  '\u1073': [STACK, '\u1039\u1011'], // tha
  '\u1074': [STACK, '\u1039\u1011'], // tha, other width
  '\u1075': [STACK, '\u1039\u1012'], // da
  '\u1076': [STACK, '\u1039\u1013'], // dha
  '\u1077': [STACK, '\u1039\u1014'], // na
  '\u1078': [STACK, '\u1039\u1015'], // pa
  '\u1079': [STACK, '\u1039\u1016'], // pha
  '\u107A': [STACK, '\u1039\u1017'], // ba
  '\u107B': [STACK, '\u1039\u1018'], // bha
  '\u1093': [STACK, '\u1039\u1018'], // bha, other shape
  '\u107C': [STACK, '\u1039\u1019'], // ma
  '\u1085': [STACK, '\u1039\u101C'], // la
  '\u1096': [STACK, '\u1039\u1010', '\u103D'] // ta, with wa
};

// Digits are bases too: Zawgyi has no glyph for wa and types it as zero.
for (var digit = 0x1040; digit <= 0x1049; digit++) {
  ZAWGYI[String.fromCharCode(digit)] = [BASE, String.fromCharCode(digit)];
}

// Applied before the table.
const SEQUENCES = [
  [/(^|[^\u1040-\u1049])\u1044\u1004\u1039\u1038/g, '$1\u104E'], // the digit four typed for lagaung
  [/\u104E\u1004\u1039\u1038/g, '\u104E'] // lagaung typed with the nga, asat and visarga it draws
];

const FONT = storageOrder.font(ZAWGYI, SEQUENCES);

// Zawgyi -> Unicode. With debug, returns { matched_patterns, steps } like fontConvert.debugging.
function toUnicode(content, debug) {
  return storageOrder.toUnicode(content, FONT, debug);
}

module.exports = {
  toUnicode: toUnicode
};
