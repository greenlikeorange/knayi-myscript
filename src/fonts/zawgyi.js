// The Zawgyi glyph table and lagaung sequences: data only (DESIGN.md §2.3, §3.8). Layer L2. Owner: W6
// (engine-fonts).
//
// Moved from library/zawgyi.js at the reference (e5f6e24), rows and comments unchanged except for the role names
// (ROLE in script/codes.js: 2.x PRE is BEFORE_BASE, and TEXT is PLAIN). The 2.x loop that added the digits to the
// table (zawgyi.js:118-121) is the declared field ZAWGYI_FONT.selfBases.
//
// Zawgyi puts Burmese glyphs on the Unicode 5.0 Myanmar code points, and on U+1060-U+1097 for the shapes Unicode
// leaves to the font: stacked consonants, kinzi, and short, small or cut forms of letters and marks. Like Win, it
// stores text in the order the glyphs are drawn: e and medial ra before the consonant, kinzi and stacked
// consonants after it, and the marks in any order (research/zawgyi-to-unicode.md §2).
//
// Conversion to Unicode runs the stages of stages/fonts.js FONT_STAGES:
// 1. sequences: lagaung typed with the digit four, or with the nga, asat and visarga its glyph already draws,
//    becomes the lagaung glyph (LAGAUNG_SEQUENCES).
// 2. syllables: each glyph becomes Unicode characters with its role in the syllable (ZAWGYI_GLYPHS), and each
//    syllable is written in the storage order of UTN #11 (engine/fontReader.js readFont). A trace first shows the
//    glyphs still in typed order (the trace-only stage 'glyphs').
// 3. zero as wa: a zero that is not part of a number becomes wa, since Zawgyi has no glyph for wa.
// 4. look-alikes, then typos: the typing fixes that normalize makes too, in this pipeline's order (normalize runs
//    typos first; ARCHITECTURE.md, "Typing fixes and their two orders").
// 5. NFC.

import { deepFreeze } from '../freeze.js';
import { ROLE, KINZI_TEXT } from '../script/codes.js';

// Zawgyi code point -> [role, Unicode text, marks that come with it]. The rows follow knayi's 2.9 rules, corrected
// where those were wrong, and were checked against the glyphs of the Zawgyi font the demo site ships
// (research/zawgyi-to-unicode.md §2; §3, "Letters Zawgyi draws alike", for U+1069 as stacked jha). Consonants and
// independent vowels keep their code points and are bases without an entry (compileFont's built-in rule), and the
// digits are declared in ZAWGYI_FONT.selfBases.
export const ZAWGYI_GLYPHS = /* @__PURE__ */ zawgyiGlyphTable();

function zawgyiGlyphTable() {
  return deepFreeze({
    // Letters in another shape
    '\u106A': [ROLE.BASE, '\u1009'], // nya, small, for a mark below
    '\u106B': [ROLE.BASE, '\u100A'], // nnya, short
    '\u108F': [ROLE.BASE, '\u1014'], // na, short, for a mark below
    '\u1090': [ROLE.BASE, '\u101B'], // ra, short, for a mark below
    '\u1086': [ROLE.BASE, '\u103F'], // great sa
    '\u104E': [ROLE.BASE, '\u104E\u1004\u103A\u1038'], // lagaung, drawn with its nga, asat and visarga

    // Two consonants in one glyph
    '\u106E': [ROLE.BASE, '\u100D\u1039\u100D'], // dda + dda
    '\u106F': [ROLE.BASE, '\u100D\u1039\u100E'], // dda + ddha
    '\u1091': [ROLE.BASE, '\u100F\u1039\u100D'], // nna + dda
    '\u1092': [ROLE.BASE, '\u100B\u1039\u100C'], // tta + ttha
    '\u1097': [ROLE.BASE, '\u100B\u1039\u100B'], // tta + tta

    // Vowel signs, tones and asat
    '\u102B': [ROLE.MARK, '\u102B'], // tall aa
    '\u102C': [ROLE.MARK, '\u102C'], // aa
    '\u105A': [ROLE.MARK, '\u102B\u103A'], // tall aa with asat
    '\u102D': [ROLE.MARK, '\u102D'], // i
    '\u102E': [ROLE.MARK, '\u102E'], // ii
    '\u108E': [ROLE.MARK, '\u102D\u1036'], // i with anusvara
    '\u102F': [ROLE.MARK, '\u102F'], // u
    '\u1033': [ROLE.MARK, '\u102F'], // u, long
    '\u1030': [ROLE.MARK, '\u1030'], // uu
    '\u1034': [ROLE.MARK, '\u1030'], // uu, long
    '\u1031': [ROLE.BEFORE_BASE, '\u1031'], // e
    '\u1032': [ROLE.MARK, '\u1032'], // ai
    '\u1036': [ROLE.MARK, '\u1036'], // anusvara
    '\u1037': [ROLE.MARK, '\u1037'], // dot below
    '\u1094': [ROLE.MARK, '\u1037'], // dot below, moved right
    '\u1095': [ROLE.MARK, '\u1037'], // dot below, moved further right
    '\u1038': [ROLE.MARK, '\u1038'], // visarga
    '\u1039': [ROLE.MARK, '\u103A'], // asat

    // Kinzi
    '\u1064': [ROLE.KINZI, KINZI_TEXT],
    '\u108B': [ROLE.KINZI, KINZI_TEXT, '\u102D'], // kinzi with i
    '\u108C': [ROLE.KINZI, KINZI_TEXT, '\u102E'], // kinzi with ii
    '\u108D': [ROLE.KINZI, KINZI_TEXT, '\u1036'], // kinzi with anusvara

    // Medials
    '\u103A': [ROLE.MARK, '\u103B'], // ya
    '\u107D': [ROLE.MARK, '\u103B'], // ya, short
    '\u103C': [ROLE.MARK, '\u103D'], // wa
    '\u103D': [ROLE.MARK, '\u103E'], // ha
    '\u1087': [ROLE.MARK, '\u103E'], // ha, short
    '\u103E': [ROLE.MARK, '\u103E'], // Unicode's ha, which Zawgyi does not use, in mixed text
    '\u108A': [ROLE.MARK, '\u103D\u103E'], // wa with ha
    '\u1088': [ROLE.MARK, '\u103E\u102F'], // ha with u
    '\u1089': [ROLE.MARK, '\u103E\u1030'], // ha with uu
    '\u103B': [ROLE.BEFORE_BASE, '\u103C'], // ra, narrow
    '\u107E': [ROLE.BEFORE_BASE, '\u103C'], // ra, wide
    '\u107F': [ROLE.BEFORE_BASE, '\u103C'], // ra, narrow, cut for an upper vowel
    '\u1080': [ROLE.BEFORE_BASE, '\u103C'], // ra, wide, cut for an upper vowel
    '\u1081': [ROLE.BEFORE_BASE, '\u103C'], // ra, narrow, cut for a lower mark
    '\u1082': [ROLE.BEFORE_BASE, '\u103C'], // ra, wide, cut for a lower mark
    '\u1083': [ROLE.BEFORE_BASE, '\u103C'], // ra, narrow, cut at both ends
    '\u1084': [ROLE.BEFORE_BASE, '\u103C'], // ra, wide, cut at both ends

    // Stacked consonants
    '\u1060': [ROLE.STACK, '\u1039\u1000'], // ka
    '\u1061': [ROLE.STACK, '\u1039\u1001'], // kha
    '\u1062': [ROLE.STACK, '\u1039\u1002'], // ga
    '\u1063': [ROLE.STACK, '\u1039\u1003'], // gha
    '\u1065': [ROLE.STACK, '\u1039\u1005'], // ca
    '\u1066': [ROLE.STACK, '\u1039\u1006'], // cha
    '\u1067': [ROLE.STACK, '\u1039\u1006'], // cha, other width
    '\u1068': [ROLE.STACK, '\u1039\u1007'], // ja
    '\u1069': [ROLE.STACK, '\u1039\u1008'], // jha
    '\u106C': [ROLE.STACK, '\u1039\u100B'], // tta
    '\u106D': [ROLE.STACK, '\u1039\u100C'], // ttha
    '\u1070': [ROLE.STACK, '\u1039\u100F'], // nna
    '\u1071': [ROLE.STACK, '\u1039\u1010'], // ta
    '\u1072': [ROLE.STACK, '\u1039\u1010'], // ta, narrow
    '\u1073': [ROLE.STACK, '\u1039\u1011'], // tha
    '\u1074': [ROLE.STACK, '\u1039\u1011'], // tha, other width
    '\u1075': [ROLE.STACK, '\u1039\u1012'], // da
    '\u1076': [ROLE.STACK, '\u1039\u1013'], // dha
    '\u1077': [ROLE.STACK, '\u1039\u1014'], // na
    '\u1078': [ROLE.STACK, '\u1039\u1015'], // pa
    '\u1079': [ROLE.STACK, '\u1039\u1016'], // pha
    '\u107A': [ROLE.STACK, '\u1039\u1017'], // ba
    '\u107B': [ROLE.STACK, '\u1039\u1018'], // bha
    '\u1093': [ROLE.STACK, '\u1039\u1018'], // bha, other shape
    '\u107C': [ROLE.STACK, '\u1039\u1019'], // ma
    '\u1085': [ROLE.STACK, '\u1039\u101C'], // la
    '\u1096': [ROLE.STACK, '\u1039\u1010', '\u103D'] // ta, with wa
  });
}

// Applied before the glyphs, in order, each once (the stage 'sequences'). research/zawgyi-to-unicode.md §3,
// "Letters Zawgyi draws alike": the digit four before nga, asat and visarga is lagaung unless a digit comes before
// it, and the lagaung glyph followed by the nga, asat and visarga it already draws is one lagaung, which
// myanmar-tools and 2.9 doubled.
export const LAGAUNG_SEQUENCES = /* @__PURE__ */ deepFreeze([
  // The digit four typed for lagaung.
  { id: 'zg.lagaung.1', re: /(^|[^\u1040-\u1049])\u1044\u1004\u1039\u1038/g, to: '$1\u104E', repeat: false },
  // Lagaung typed with the nga, asat and visarga it draws.
  { id: 'zg.lagaung.2', re: /\u104E\u1004\u1039\u1038/g, to: '\u104E', repeat: false }
]);

// The font, for engine/fontReader.js compileFont (DESIGN.md §3.8).
export const ZAWGYI_FONT = /* @__PURE__ */ deepFreeze({
  name: 'zawgyi',
  glyphs: ZAWGYI_GLYPHS,
  sequences: LAGAUNG_SEQUENCES,
  // Digits are bases too: Zawgyi has no glyph for wa and types it as zero, which the stage 'zero as wa' reads
  // (research/zawgyi-to-unicode.md §2).
  selfBases: [[0x1040, 0x1049]],
  aliases: {},
  // Lagaung, drawn with its nga, asat and visarga: a base whose inner marks are written as they are, not sorted
  // (DESIGN.md §3.8; §10 Q19, kept on purpose).
  wholeBases: ['\u104E\u1004\u103A\u1038']
});
