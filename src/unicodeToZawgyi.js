// Unicode to Zawgyi: the 2.x pattern rules as one flat list of rule rows in named sections, and their runner with
// and without a trace (DESIGN.md §2.3, §3.9; PR 3.5 of the refactor plan). Layer L3 rules. Owner: W7.
//
// Unicode stores a syllable in its logical order (UTN #11): kinzi, the consonant, a stacked consonant, the
// medials ya, ra, wa and ha, then e, the vowel signs, anusvara, asat, dot below and visarga. Zawgyi stores glyphs
// in the order they are drawn, and gives the shapes that Unicode leaves to the font code points of their own:
// e and medial ra come before the consonant, kinzi after it, and short, small, cut, stacked and joined forms are
// glyphs at U+1060-U+1097 (research/zawgyi-to-unicode.md §2; src/fonts/zawgyi.js holds the same glyph table,
// read the other way).
//
// unicodeToZawgyi collapses a mark typed twice in a row (segment.js collapseRepeatedMarks), then applies the rows
// in order (core/rules.js applyRuleRows). Each row reads the text the rows before it wrote, so the order is part
// of every rule. The sections, in the order they run:
//   SHAPES_IN_CONTEXT  u, uu, dot below and medial ya in the shapes the marks around them call for
//   KINZI              kinzi to its glyph, after its consonant, joined with i, ii or anusvara
//   VISUAL_ORDER       medial ra and e before their consonant
//   SMALL_LETTERS      the short na and the small nya, for a mark below
//   GLYPHS             lagaung, tall aa with asat, great sa, stacked and joined consonants, the medials and asat
//   NARROW_TA          the narrow stacked ta
//   MEDIAL_RA_SHAPES   the wide and cut medial ra: the eight repeat rows
// That is 57 rows applied once, then 8 repeat rows, exactly 2.x's convertRules.unicode.zawgyi (syllable.js).
//
// A row is { id, re, to, repeat, label? } (core/rules.js). Its why is the comment above it, and its example is
// in test/next/unicodeToZawgyi.test.mjs under its id (D17). Each regex is the 2.x literal byte for byte, because
// its source is 2.x debug output: fontConvert.debugging lists the source of every rule that fired. On V8, a regex
// that is a pure literal starting at U+1000-U+1010 takes a slow search path, 10-50 times slower (decision 29), so
// the six such rows wrap their first unit in a one-character class and keep the 2.x source as their label.

import { deepFreeze } from './freeze.js';
import { applyRuleRows, traceRuleRows, startTrace } from './core/rules.js';
import { collapseRepeatedMarks } from './segment.js';

// ---------------------------------------------------------------------------------------------------------------
// SHAPES_IN_CONTEXT
//
// Shapes that depend on the marks around them. Zawgyi has glyphs of their own for u, uu and dot below drawn lower
// or further right, and for a short medial ya (research/zawgyi-to-unicode.md §2, the glyph table). These rows run
// first, on Unicode text, while the stacked consonants and the medials can still be read.

const SHAPES_IN_CONTEXT = /* @__PURE__ */ deepFreeze([
  // u after a stacked consonant or medial ya, ra or wa is the long u U+1033, drawn below them
  // (research/zawgyi-to-unicode.md §2, glyph table: "u, long"). Upper vowels, e, ai, anusvara, dot below and medial
  // ha may stand between; that set is kept from 2.x.
  {
    id: 'uz.shapes.1',
    re: /([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u102f/g,
    to: '$1\u1033', repeat: false
  },
  // uu in the same place is the long uu U+1034 (research/zawgyi-to-unicode.md §2, glyph table: "uu, long").
  {
    id: 'uz.shapes.2',
    re: /([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u1030/g,
    to: '$1\u1034', repeat: false
  },
  // A dot below in the same place is U+1094, moved right, clear of the stack or medial
  // (research/zawgyi-to-unicode.md §2, glyph table: "dot below, moved right").
  {
    id: 'uz.shapes.3',
    re: /([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u1037/g,
    to: '$1\u1094', repeat: false
  },
  // Medial ya right after its consonant and followed by medial wa (and any medial ha) is the short ya U+107D, so
  // that the wa fits beside it (research/zawgyi-to-unicode.md §2, glyph table: "ya, short").
  { id: 'uz.shapes.4', re: /([\u1000-\u1021])\u103b([\u103d][\u103e]*)/g, to: '$1\u107d$2', repeat: false },
  // A dot below after the long u or uu, in either of its forms, is U+1095, moved further right, clear of the long
  // vowel (research/zawgyi-to-unicode.md §2, glyph table: "dot below, moved further right").
  { id: 'uz.shapes.5', re: /([\u1033\u1034])[\u1037\u1094]/g, to: '$1\u1095', repeat: false }
]);

// ---------------------------------------------------------------------------------------------------------------
// KINZI
//
// Kinzi: nga, asat and virama, stored before the consonant it sits on (UTN #11). Zawgyi has one glyph for it,
// U+1064, stored after that consonant, and three glyphs with i, ii or anusvara drawn in
// (research/zawgyi-to-unicode.md §2, the glyph table: U+1064, U+108B-U+108D).

const KINZI = /* @__PURE__ */ deepFreeze([
  // Kinzi becomes the kinzi glyph (research/zawgyi-to-unicode.md §2, glyph table: U+1064). The 2.x literal starts
  // at U+1004, so its first unit is wrapped (decision 29).
  { id: 'uz.kinzi.1', re: /[\u1004]\u103a\u1039/g, to: '\u1064', repeat: false, label: '\\u1004\\u103a\\u1039' },
  // The kinzi glyph moves after the consonant it sits on. UTN #11 stores kinzi before that consonant; Zawgyi stores
  // kinzi and stacked consonants after it (research/zawgyi-to-unicode.md §2).
  { id: 'uz.kinzi.2', re: /\u1064([\u1000-\u1021])/g, to: '$1\u1064', repeat: false },
  // Kinzi with i is one glyph, U+108B (research/zawgyi-to-unicode.md §2, glyph table: "kinzi with i"). The i is
  // taken from after the medials, dot below, u and uu that may stand between, and those stay after the glyph.
  {
    id: 'uz.kinzi.3',
    re: /\u1064([\u103b\u103c\u103d\u103e\u1037\u102f\u1030]*)\u102d/g,
    to: '\u108b$1', repeat: false
  },
  // Kinzi with ii is U+108C, in the same way (research/zawgyi-to-unicode.md §2, glyph table: "kinzi with ii").
  {
    id: 'uz.kinzi.4',
    re: /\u1064([\u103b\u103c\u103d\u103e\u1037\u102f\u1030]*)\u102e/g,
    to: '\u108c$1', repeat: false
  },
  // Kinzi with anusvara is U+108D, in the same way (research/zawgyi-to-unicode.md §2, glyph table: "kinzi with
  // anusvara").
  {
    id: 'uz.kinzi.5',
    re: /\u1064([\u103b\u103c\u103d\u103e\u1037\u102f\u1030]*)\u1036/g,
    to: '\u108d$1', repeat: false
  }
]);

// ---------------------------------------------------------------------------------------------------------------
// VISUAL_ORDER
//
// Drawing order. Unicode stores medial ra and e after their consonant (UTN #11). Zawgyi stores them where they are
// drawn, before the consonant and before its stacked consonant too (research/zawgyi-to-unicode.md §2: e and medial
// ra are "typed before the base").

const VISUAL_ORDER = /* @__PURE__ */ deepFreeze([
  // Medial ra moves before the nearest consonant before it, past anything between that is not a consonant: UTN #11
  // stores it after the consonant, and Zawgyi before it (research/zawgyi-to-unicode.md §2). U+1082, a Zawgyi medial
  // ra already in the input, moves the same way, as in 2.x.
  { id: 'uz.order.1', re: /([\u1000-\u1021][^\u1000-\u1021]*)([\u103c\u1082])/g, to: '$2$1', repeat: false },
  // Medial ra after a stacked consonant goes before the whole stack, where it is drawn. The row above has left it
  // right after the virama (research/zawgyi-to-unicode.md §2).
  { id: 'uz.order.2', re: /([\u1000-\u1021]\u1039)\u103c([\u1000-\u1021])/g, to: '\u103c$1$2', repeat: false },
  // e moves before the nearest consonant before it, past anything between that is not a consonant: UTN #11 stores
  // it after the consonant and its medials, and Zawgyi before them (research/zawgyi-to-unicode.md §2).
  { id: 'uz.order.3', re: /([\u1000-\u1021][^\u1000-\u1021]*)\u1031/g, to: '\u1031$1', repeat: false },
  // e after a stacked consonant goes before the whole stack, where it is drawn (research/zawgyi-to-unicode.md §2).
  { id: 'uz.order.4', re: /([\u1000-\u1021]\u1039)\u1031([\u1000-\u1021])/g, to: '\u1031$1$2', repeat: false },
  // e goes before medial ra: Zawgyi draws e to the left of the ra that wraps the consonant
  // (research/zawgyi-to-unicode.md §2).
  { id: 'uz.order.5', re: /\u103c\u1031/g, to: '\u1031\u103c', repeat: false }
]);

// ---------------------------------------------------------------------------------------------------------------
// SMALL_LETTERS
//
// na and nya have short forms in Zawgyi that leave room for a mark below (research/zawgyi-to-unicode.md §2, the
// glyph table: U+108F "na, short, for a mark below", U+106A "nya, small, for a mark below").

const SMALL_LETTERS = /* @__PURE__ */ deepFreeze([
  // na before u, uu, a virama, or medial ya, wa or ha is the short na U+108F (research/zawgyi-to-unicode.md §2,
  // glyph table: "na, short, for a mark below").
  { id: 'uz.small.1', re: /\u1014([\u102f\u1030\u1039\u103b\u103d\u103e])/g, to: '\u108f$1', repeat: false },
  // na after medial ra, which the rows above have put first, is the short na too: the ra runs under it
  // (research/zawgyi-to-unicode.md §2, glyph table: U+108F).
  { id: 'uz.small.2', re: /\u103c\u1014/g, to: '\u103c\u108f', repeat: false },
  // nya before the same marks is the small nya U+106A (research/zawgyi-to-unicode.md §2, glyph table: "nya, small,
  // for a mark below").
  { id: 'uz.small.3', re: /\u1009([\u102f\u1030\u1039\u103b\u103d\u103e])/g, to: '\u106a$1', repeat: false }
]);

// ---------------------------------------------------------------------------------------------------------------
// GLYPHS
//
// Glyph for glyph (research/zawgyi-to-unicode.md §2, the glyph table read from Unicode to Zawgyi). The order inside
// this section matters, so it stays sequential: a two-consonant glyph comes before the stacked consonant it holds,
// stacked ca with medial ya before stacked ca, and the medials and asat take their Zawgyi code points last, from
// asat down to medial ha, each after every row that still reads its Unicode meaning.

const GLYPHS = /* @__PURE__ */ deepFreeze([
  // Lagaung followed by nga, asat and visarga is the lagaung glyph alone, which draws all four
  // (research/zawgyi-to-unicode.md §2, glyph table: U+104E; §3 on lagaung).
  { id: 'uz.glyphs.1', re: /\u104e\u1004\u103a\u1038/g, to: '\u104e', repeat: false },
  // Tall aa with asat is one glyph, U+105A (research/zawgyi-to-unicode.md §2, glyph table: "tall aa with asat").
  { id: 'uz.glyphs.2', re: /\u102b\u103a/g, to: '\u105a', repeat: false },
  // Great sa is U+1086 (research/zawgyi-to-unicode.md §2, glyph table: "great sa").
  { id: 'uz.glyphs.3', re: /\u103f/g, to: '\u1086', repeat: false },
  // A virama and a consonant (UTN #11) are the stacked consonant's glyph (research/zawgyi-to-unicode.md §2, glyph
  // table: stacked consonants). Stacked la, U+1085.
  { id: 'uz.glyphs.4', re: /\u1039\u101c/g, to: '\u1085', repeat: false },
  // Stacked ma, U+107C (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.5', re: /\u1039\u1019/g, to: '\u107c', repeat: false },
  // Stacked bha, U+107B (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.6', re: /\u1039\u1018/g, to: '\u107b', repeat: false },
  // Stacked ba, U+107A (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.7', re: /\u1039\u1017/g, to: '\u107a', repeat: false },
  // Stacked pha, U+1079 (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.8', re: /\u1039\u1016/g, to: '\u1079', repeat: false },
  // Stacked pa, U+1078 (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.9', re: /\u1039\u1015/g, to: '\u1078', repeat: false },
  // Stacked na, U+1077 (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.10', re: /\u1039\u1014/g, to: '\u1077', repeat: false },
  // Stacked dha, U+1076 (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.11', re: /\u1039\u1013/g, to: '\u1076', repeat: false },
  // Stacked da, U+1075 (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.12', re: /\u1039\u1012/g, to: '\u1075', repeat: false },
  // Stacked tha, U+1073 (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.13', re: /\u1039\u1011/g, to: '\u1073', repeat: false },
  // Stacked ta, U+1071, the wide form; NARROW_TA picks the narrow one (research/zawgyi-to-unicode.md §2, glyph
  // table: stacked consonants).
  { id: 'uz.glyphs.14', re: /\u1039\u1010/g, to: '\u1071', repeat: false },
  // Stacked nna, U+1070 (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.15', re: /\u1039\u100f/g, to: '\u1070', repeat: false },
  // dda with a stacked ddha is one glyph, U+106F (research/zawgyi-to-unicode.md §2, glyph table: two consonants in
  // one glyph). The 2.x literal starts at U+100D, so its first unit is wrapped (decision 29).
  { id: 'uz.glyphs.16', re: /[\u100d]\u1039\u100e/g, to: '\u106f', repeat: false, label: '\\u100d\\u1039\\u100e' },
  // nna with a stacked dda is U+1091 (research/zawgyi-to-unicode.md §2, glyph table: two consonants in one glyph).
  // Wrapped, as above.
  { id: 'uz.glyphs.17', re: /[\u100f]\u1039\u100d/g, to: '\u1091', repeat: false, label: '\\u100f\\u1039\\u100d' },
  // dda with a stacked dda is U+106E (research/zawgyi-to-unicode.md §2, glyph table: two consonants in one glyph).
  // Wrapped.
  { id: 'uz.glyphs.18', re: /[\u100d]\u1039\u100d/g, to: '\u106e', repeat: false, label: '\\u100d\\u1039\\u100d' },
  // tta with a stacked ttha is U+1092 (research/zawgyi-to-unicode.md §2, glyph table: two consonants in one glyph),
  // before the stacked ttha below can take its virama. Wrapped.
  { id: 'uz.glyphs.19', re: /[\u100b]\u1039\u100c/g, to: '\u1092', repeat: false, label: '\\u100b\\u1039\\u100c' },
  // Stacked ttha, U+106D (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.20', re: /\u1039\u100c/g, to: '\u106d', repeat: false },
  // tta with a stacked tta is U+1097 (research/zawgyi-to-unicode.md §2, glyph table: two consonants in one glyph),
  // before the stacked tta below can take its virama. Wrapped.
  { id: 'uz.glyphs.21', re: /[\u100b]\u1039\u100b/g, to: '\u1097', repeat: false, label: '\\u100b\\u1039\\u100b' },
  // Stacked tta, U+106C (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.22', re: /\u1039\u100b/g, to: '\u106c', repeat: false },
  // Stacked ca with medial ya is the stacked jha U+1069, which Zawgyi draws that way (research/zawgyi-to-unicode.md
  // §3, letters Zawgyi draws alike); it comes before stacked ca.
  { id: 'uz.glyphs.23', re: /\u1039\u1005\u103b/g, to: '\u1069', repeat: false },
  // Stacked ja, U+1068 (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.24', re: /\u1039\u1007/g, to: '\u1068', repeat: false },
  // Stacked cha, U+1066 (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.25', re: /\u1039\u1006/g, to: '\u1066', repeat: false },
  // Stacked ca, U+1065 (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.26', re: /\u1039\u1005/g, to: '\u1065', repeat: false },
  // Stacked gha, U+1063 (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.27', re: /\u1039\u1003/g, to: '\u1063', repeat: false },
  // Stacked ga, U+1062 (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.28', re: /\u1039\u1002/g, to: '\u1062', repeat: false },
  // Stacked kha, U+1061 (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.29', re: /\u1039\u1001/g, to: '\u1061', repeat: false },
  // Medial wa with medial ha is one glyph, U+108A (research/zawgyi-to-unicode.md §2, glyph table: "wa with ha").
  { id: 'uz.glyphs.30', re: /\u103d\u103e/g, to: '\u108a', repeat: false },
  // Medial ha with uu is U+1089 (research/zawgyi-to-unicode.md §2, glyph table: "ha with uu").
  { id: 'uz.glyphs.31', re: /\u103e\u1030/g, to: '\u1089', repeat: false },
  // Stacked ka, U+1060 (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants).
  { id: 'uz.glyphs.32', re: /\u1039\u1000/g, to: '\u1060', repeat: false },
  // Medial ha with u is U+1088 (research/zawgyi-to-unicode.md §2, glyph table: "ha with u").
  { id: 'uz.glyphs.33', re: /\u103e\u102f/g, to: '\u1088', repeat: false },
  // Asat takes Zawgyi's code point for it, U+1039, which is Unicode's virama, now that every row that reads a
  // virama has run (research/zawgyi-to-unicode.md §2, glyph table: U+1039, "asat"). A virama that no row read stays
  // U+1039 and so reads as asat, as in 2.x: stacked jha typed with U+1008, for one, since only stacked ca with
  // medial ya becomes U+1069.
  { id: 'uz.glyphs.34', re: /\u103a/g, to: '\u1039', repeat: false },
  // Medial ya takes U+103A, now free (research/zawgyi-to-unicode.md §2, glyph table: U+103A, "ya").
  { id: 'uz.glyphs.35', re: /\u103b/g, to: '\u103a', repeat: false },
  // Medial ra takes U+103B, the narrow ra; MEDIAL_RA_SHAPES picks its shape (research/zawgyi-to-unicode.md §2,
  // glyph table: "ra, narrow").
  { id: 'uz.glyphs.36', re: /\u103c/g, to: '\u103b', repeat: false },
  // Medial wa takes U+103C (research/zawgyi-to-unicode.md §2, glyph table: U+103C, "wa").
  { id: 'uz.glyphs.37', re: /\u103d/g, to: '\u103c', repeat: false },
  // Medial ha takes U+103D, the full ha, also under medial ra, where real Zawgyi text has both the full and the
  // short ha (research/zawgyi-to-unicode.md §5, open question 2).
  { id: 'uz.glyphs.38', re: /\u103e/g, to: '\u103d', repeat: false }
]);

// ---------------------------------------------------------------------------------------------------------------
// NARROW_TA
//
// The stacked ta under a narrow letter (research/zawgyi-to-unicode.md §2, the glyph table: U+1072 "ta, narrow").

const NARROW_TA = /* @__PURE__ */ deepFreeze([
  // The stacked ta takes its narrow glyph after any unit but the wide consonants ka, gha, cha, nna, ta, tha, bha,
  // a, ya, la, sa and ha, as in 2.x (research/zawgyi-to-unicode.md §2, glyph table: "ta, narrow").
  {
    id: 'uz.narrow-ta.1',
    re: /([^\u1000\u1003\u1006\u100f\u1010\u1011\u1018\u1021\u101a\u101c\u101e\u101f])\u1071/g,
    to: '$1\u1072', repeat: false
  }
]);

// ---------------------------------------------------------------------------------------------------------------
// MEDIAL_RA_SHAPES
//
// Medial ra, by now Zawgyi's narrow ra U+103B before its consonant, takes one of eight glyphs: narrow or wide for
// the width of the consonant it wraps, and cut at the top for i or ii, at the foot for a mark below, or at both
// (research/zawgyi-to-unicode.md §2, the glyph table: U+103B, U+107E-U+1084).
//
// These are the repeat rows (2.x asLongAsMatch): each runs while it matches, at most REPEAT_LIMIT times
// (core/rules.js). Each replacement starts with a different unit from its match, so a row that matches always
// changes the text, which the trace relies on (DESIGN.md §3.9; test/next/unicodeToZawgyi.test.mjs checks it).

const MEDIAL_RA_SHAPES = /* @__PURE__ */ deepFreeze([
  // Before a wide consonant (ka, gha, cha, nna, ta, tha, bha, a, ya, la, sa and ha) the ra is the wide one, U+107E
  // (research/zawgyi-to-unicode.md §2, glyph table: "ra, wide").
  {
    id: 'uz.medial-ra.1',
    re: /\u103b([\u1000\u1003\u1006\u100f\u1010\u1011\u1018\u1021\u101a\u101c\u101e\u101f])/g,
    to: '\u107e$1', repeat: true
  },
  // Narrow ra on a consonant (the small nya and short na included) with wa, or wa and ha, below and i or ii above
  // is U+1083 (research/zawgyi-to-unicode.md §2, glyph table: "ra, narrow, cut at both ends").
  {
    id: 'uz.medial-ra.2',
    re: /\u103b([\u1000-\u1021\u106a\u108f](\u103c\u103d|\u108a|\u103c)[\u102d\u102e])/g,
    to: '\u1083$1', repeat: true
  },
  // Wide ra in the same place is U+1084 (research/zawgyi-to-unicode.md §2, glyph table: "ra, wide, cut at both
  // ends").
  {
    id: 'uz.medial-ra.3',
    re: /\u107e([\u1000-\u1021](\u103c\u103d|\u108a|\u103c)[\u102d\u102e])/g,
    to: '\u1084$1', repeat: true
  },
  // Narrow ra on a consonant (the small nya and short na included) with i or ii is U+107F
  // (research/zawgyi-to-unicode.md §2, glyph table: "ra, narrow, cut for an upper vowel").
  { id: 'uz.medial-ra.4', re: /\u103b([\u1000-\u1021\u106a\u108f][\u102d\u102e])/g, to: '\u107f$1', repeat: true },
  // Wide ra in the same place is U+1080 (research/zawgyi-to-unicode.md §2, glyph table: "ra, wide, cut for an upper
  // vowel").
  { id: 'uz.medial-ra.5', re: /\u107e([\u1000-\u1021][\u102d\u102e])/g, to: '\u1080$1', repeat: true },
  // Narrow ra on a consonant (the small nya and short na included) with wa, or wa with ha, below is U+1081
  // (research/zawgyi-to-unicode.md §2, glyph table: "ra, narrow, cut for a lower mark"). 2.x's set also lists
  // U+103E, Unicode's ha, which the last row of GLYPHS has already made U+103D, so that member never matches; it is
  // kept as 2.x has it.
  {
    id: 'uz.medial-ra.6',
    re: /\u103b([\u1000-\u1021\u106a\u108f][\u103c\u103e\u108a])/g,
    to: '\u1081$1', repeat: true
  },
  // Wide ra in the same place is U+1082 (research/zawgyi-to-unicode.md §2, glyph table: "ra, wide, cut for a lower
  // mark").
  { id: 'uz.medial-ra.7', re: /\u107e([\u1000-\u1021][\u103c\u103e\u108a])/g, to: '\u1082$1', repeat: true },
  // Narrow ra on nya is the ra cut for a lower mark, with the small nya: U+1081 U+106A
  // (research/zawgyi-to-unicode.md §2, glyph table: U+1081, U+106A).
  { id: 'uz.medial-ra.8', re: /\u103b\u1009/g, to: '\u1081\u106a', repeat: true }
]);

// ---------------------------------------------------------------------------------------------------------------
// The rows and their runner.

// 57 once rows, then 8 repeat rows, in 2.x order.
export const UNICODE_TO_ZAWGYI_RULES = /* @__PURE__ */ joinSections(
  SHAPES_IN_CONTEXT, KINZI, VISUAL_ORDER, SMALL_LETTERS, GLYPHS, NARROW_TA, MEDIAL_RA_SHAPES
);

// The sections, in the order given, as one frozen list. The regexes stay unfrozen (D16).
function joinSections(...sections) {
  return deepFreeze([].concat(...sections));
}

// Unicode text in Zawgyi: a mark typed twice in a row counts once, then every row runs in order. The text is a
// string; 2.x's public preamble (trimming, the Myanmar-block check) belongs to the caller (compat/fontConvert.js).
export function unicodeToZawgyi(text) {
  return applyRuleRows(collapseRepeatedMarks(text, 'unicode'), UNICODE_TO_ZAWGYI_RULES);
}

// The same, recording 2.x's debug log in `trace` (DESIGN.md §3.9, D4): trace.start is the collapsed text, and
// each record is a row that changed the text (a repeat row that matched), with the text after it. 2.x's
// matched_patterns are the records' labels, and its steps are [trace.start, ...the records' texts].
export function traceUnicodeToZawgyi(text, trace) {
  const collapsed = collapseRepeatedMarks(text, 'unicode');
  startTrace(trace, collapsed);
  return traceRuleRows(collapsed, UNICODE_TO_ZAWGYI_RULES, trace);
}
