// Unicode to Zawgyi: the 2.x pattern rules as one flat list of rule rows in named sections, and their runner with
// and without a trace (DESIGN.md §2.3, §3.9). Layer L3 rules. Owner: W7.
//
// Unicode stores a syllable in its logical order (UTN #11): kinzi, the consonant, a stacked consonant, the
// medials ya, ra, wa and ha, then e, the vowel signs, anusvara, asat, dot below and visarga. Zawgyi stores glyphs
// in the order they are drawn, and gives the shapes that Unicode leaves to the font code points of their own:
// e and medial ra come before the consonant, kinzi after it, and short, small, cut, stacked and joined forms are
// glyphs at U+1060-U+1097 (research/zawgyi-to-unicode.md §2; src/fonts/zawgyi.js holds the same glyph table,
// read the other way).
//
// unicodeToZawgyi collapses a mark typed twice in a row (segment.js collapseRepeatedMarks), then applies the rows
// in order. Each row reads the text the rows before it wrote, so the order is part of every rule. The sections, in
// the order they run:
//   SHAPES_IN_CONTEXT  u, uu, dot below and medial ya in the shapes the marks around them call for
//   KINZI              kinzi to its glyph, after its consonant, joined with i, ii or anusvara
//   VISUAL_ORDER       medial ra and e before their consonant
//   SMALL_LETTERS      the short na and the small nya, for a mark below
//   GLYPHS             lagaung, tall aa with asat, great sa, stacked and joined consonants, the medials and asat
//   NARROW_TA          the narrow stacked ta
//   MEDIAL_RA_SHAPES   the wide and cut medial ra: the eight repeat rows
// That is 58 rows applied once, then 8 repeat rows, exactly 2.11's convertRules.unicode.zawgyi: 2.10's (syllable.js)
// with the row for stacked jha that 2.x 05de555 added (uz.glyphs.24).
//
// A row is { id, re, to, repeat, needs, label? } (core/rules.js). Its why is the comment above it, and its example is
// in test/next/unicodeToZawgyi.test.mjs under its id (D17). `needs` names units of which every match of `re` holds at
// least one, a literal of the pattern that no match can leave out (the rarest, where it has several): a text with none
// of them cannot match, so the row is skipped (applyRowsThatCanMatch below; DESIGN.md §3.10). Each regex has the
// source of the 2.x literal byte for byte, because that source is 2.x debug output: fontConvert.debugging lists the
// source of every rule that fired. On V8, a regex that is a pure literal starting at U+1000-U+1010 takes a slow search
// path, 10-50 times slower (decision 29), so the six such rows wrap their first unit in a one-character class and keep
// the 2.x source as their label.
//
// The glyph table is the one source of the glyph that a fixed Unicode text becomes. A section names such a row by
// that text alone, and tableRows makes the row: the text's \u escapes are its regex, as 2.x wrote them, and the
// glyph the table draws the text with, read backwards (tableGlyph), is its replacement. That gives the kinzi row and
// 38 of the 39 rows of GLYPHS. A row with one fixed text and one fixed replacement is written by hand only where the
// table read backwards does not give it, with the reason above it: uz.order.5, uz.small.2, uz.glyphs.23 and
// uz.medial-ra.8. test/next/unicodeToZawgyi.test.mjs checks both ways.
//
// unicodeToZawgyi writes GLYPHS in one pass from left to right (writeGlyphs), which gives what its rows give one by
// one. traceUnicodeToZawgyi runs them one by one, since 2.x's debug log names each row that changed the text.

import { deepFreeze } from '../freeze.js';
import { CP, KINZI_TEXT, UNIT_SET_WORDS, addBlockUnit } from '../script/codes.js';
import { ERR, libraryError } from '../core/errors.js';
import { ruleMatches, ruleLabel, startTrace, recordStep } from '../core/rules.js';
import { ZAWGYI_GLYPHS } from '../fonts/zawgyi.js';
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
    to: '$1\u1033', repeat: false, needs: '\u102f'
  },
  // uu in the same place is the long uu U+1034 (research/zawgyi-to-unicode.md §2, glyph table: "uu, long").
  {
    id: 'uz.shapes.2',
    re: /([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u1030/g,
    to: '$1\u1034', repeat: false, needs: '\u1030'
  },
  // A dot below in the same place is U+1094, moved right, clear of the stack or medial
  // (research/zawgyi-to-unicode.md §2, glyph table: "dot below, moved right").
  {
    id: 'uz.shapes.3',
    re: /([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u1037/g,
    to: '$1\u1094', repeat: false, needs: '\u1037'
  },
  // Medial ya right after its consonant and followed by medial wa (and any medial ha) is the short ya U+107D, so
  // that the wa fits beside it (research/zawgyi-to-unicode.md §2, glyph table: "ya, short").
  {
    id: 'uz.shapes.4', re: /([\u1000-\u1021])\u103b([\u103d][\u103e]*)/g,
    to: '$1\u107d$2', repeat: false, needs: '\u103d'
  },
  // A dot below after the long u or uu, in either of its forms, is U+1095, moved further right, clear of the long
  // vowel (research/zawgyi-to-unicode.md §2, glyph table: "dot below, moved further right").
  { id: 'uz.shapes.5', re: /([\u1033\u1034])[\u1037\u1094]/g, to: '$1\u1095', repeat: false, needs: '\u1033\u1034' }
]);

// ---------------------------------------------------------------------------------------------------------------
// KINZI
//
// Kinzi: nga, asat and virama, stored before the consonant it sits on (UTN #11). Zawgyi has one glyph for it,
// U+1064, stored after that consonant, and three glyphs with i, ii or anusvara drawn in
// (research/zawgyi-to-unicode.md §2, the glyph table: U+1064, U+108B-U+108D).

const KINZI = /* @__PURE__ */ tableRows('kinzi', [
  // Kinzi becomes the kinzi glyph, U+1064, read from the table (research/zawgyi-to-unicode.md §2, glyph table:
  // U+1064). The text starts at U+1004, so its regex wraps its first unit (decision 29).
  KINZI_TEXT,
  // The kinzi glyph moves after the consonant it sits on. UTN #11 stores kinzi before that consonant; Zawgyi stores
  // kinzi and stacked consonants after it (research/zawgyi-to-unicode.md §2).
  { id: 'uz.kinzi.2', re: /\u1064([\u1000-\u1021])/g, to: '$1\u1064', repeat: false, needs: '\u1064' },
  // Kinzi with i is one glyph, U+108B (research/zawgyi-to-unicode.md §2, glyph table: "kinzi with i"). The i is
  // taken from after the medials, dot below, u and uu that may stand between, and those stay after the glyph.
  {
    id: 'uz.kinzi.3',
    re: /\u1064([\u103b\u103c\u103d\u103e\u1037\u102f\u1030]*)\u102d/g,
    to: '\u108b$1', repeat: false, needs: '\u1064'
  },
  // Kinzi with ii is U+108C, in the same way (research/zawgyi-to-unicode.md §2, glyph table: "kinzi with ii").
  {
    id: 'uz.kinzi.4',
    re: /\u1064([\u103b\u103c\u103d\u103e\u1037\u102f\u1030]*)\u102e/g,
    to: '\u108c$1', repeat: false, needs: '\u1064'
  },
  // Kinzi with anusvara is U+108D, in the same way (research/zawgyi-to-unicode.md §2, glyph table: "kinzi with
  // anusvara").
  {
    id: 'uz.kinzi.5',
    re: /\u1064([\u103b\u103c\u103d\u103e\u1037\u102f\u1030]*)\u1036/g,
    to: '\u108d$1', repeat: false, needs: '\u1064'
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
  {
    id: 'uz.order.1', re: /([\u1000-\u1021][^\u1000-\u1021]*)([\u103c\u1082])/g,
    to: '$2$1', repeat: false, needs: '\u103c\u1082'
  },
  // Medial ra after a stacked consonant goes before the whole stack, where it is drawn. The row above has left it
  // right after the virama (research/zawgyi-to-unicode.md §2).
  {
    id: 'uz.order.2', re: /([\u1000-\u1021]\u1039)\u103c([\u1000-\u1021])/g,
    to: '\u103c$1$2', repeat: false, needs: '\u1039'
  },
  // e moves before the nearest consonant before it, past anything between that is not a consonant: UTN #11 stores
  // it after the consonant and its medials, and Zawgyi before them (research/zawgyi-to-unicode.md §2).
  { id: 'uz.order.3', re: /([\u1000-\u1021][^\u1000-\u1021]*)\u1031/g, to: '\u1031$1', repeat: false, needs: '\u1031' },
  // e after a stacked consonant goes before the whole stack, where it is drawn (research/zawgyi-to-unicode.md §2).
  {
    id: 'uz.order.4', re: /([\u1000-\u1021]\u1039)\u1031([\u1000-\u1021])/g,
    to: '\u1031$1$2', repeat: false, needs: '\u1039'
  },
  // e goes before medial ra: Zawgyi draws e to the left of the ra that wraps the consonant
  // (research/zawgyi-to-unicode.md §2). Written by hand: it moves e and writes no glyph, so the glyph table has
  // nothing to give it.
  { id: 'uz.order.5', re: /\u103c\u1031/g, to: '\u1031\u103c', repeat: false, needs: '\u103c' }
]);

// ---------------------------------------------------------------------------------------------------------------
// SMALL_LETTERS
//
// na and nya have short forms in Zawgyi that leave room for a mark below (research/zawgyi-to-unicode.md §2, the
// glyph table: U+108F "na, short, for a mark below", U+106A "nya, small, for a mark below").

const SMALL_LETTERS = /* @__PURE__ */ deepFreeze([
  // na before u, uu, a virama, or medial ya, wa or ha is the short na U+108F (research/zawgyi-to-unicode.md §2,
  // glyph table: "na, short, for a mark below").
  {
    id: 'uz.small.1', re: /\u1014([\u102f\u1030\u1039\u103b\u103d\u103e])/g,
    to: '\u108f$1', repeat: false, needs: '\u1014'
  },
  // na after medial ra, which the rows above have put first, is the short na too: the ra runs under it
  // (research/zawgyi-to-unicode.md §2, glyph table: U+108F). Written by hand: read backwards, the table gives U+108F
  // for every na, since a plain na is a base with no row of its own, so only the ra before it says when it is meant.
  { id: 'uz.small.2', re: /\u103c\u1014/g, to: '\u103c\u108f', repeat: false, needs: '\u1014' },
  // nya before the same marks is the small nya U+106A (research/zawgyi-to-unicode.md §2, glyph table: "nya, small,
  // for a mark below").
  {
    id: 'uz.small.3', re: /\u1009([\u102f\u1030\u1039\u103b\u103d\u103e])/g,
    to: '\u106a$1', repeat: false, needs: '\u1009'
  }
]);

// ---------------------------------------------------------------------------------------------------------------
// GLYPHS
//
// Glyph for glyph: each Unicode text below becomes the glyph the table draws it with (research/zawgyi-to-unicode.md
// §2, the glyph table, read backwards by tableGlyph). The order is 2.x's, and it counts twice:
// - in the output, where two rows can match the same units. A glyph that joins two consonants comes before the
//   stacked consonant it holds, which would take its virama; stacked ca with medial ya comes before stacked ca; and
//   the medials and asat take their Zawgyi code points last, from asat down to medial ha, each after every row that
//   still reads its Unicode meaning.
// - in fontConvert.debugging, which lists the rows that changed the text in this order. So rows that never meet,
//   such as stacked la and medial ha with u, keep their 2.x places too.
// unicodeToZawgyi writes the section in one pass, with the same result (GLYPHS in one pass, below).

const GLYPHS = /* @__PURE__ */ tableRows('glyphs', [
  // Lagaung followed by nga, asat and visarga is the lagaung glyph alone, which draws all four
  // (research/zawgyi-to-unicode.md §2, glyph table: U+104E; §3 on lagaung).
  '\u104E\u1004\u103A\u1038',
  // Tall aa with asat is one glyph, U+105A (research/zawgyi-to-unicode.md §2, glyph table: "tall aa with asat").
  '\u102B\u103A',
  // Great sa is U+1086 (research/zawgyi-to-unicode.md §2, glyph table: "great sa").
  '\u103F',
  // A virama and a consonant (UTN #11) are the stacked consonant's glyph (research/zawgyi-to-unicode.md §2, glyph
  // table: stacked consonants): la, ma, bha, ba, pha, pa, na, dha, da, tha, ta and nna. The table draws stacked ta
  // with its wide form, U+1071, first; NARROW_TA picks the narrow one.
  '\u1039\u101C', '\u1039\u1019', '\u1039\u1018', '\u1039\u1017', '\u1039\u1016', '\u1039\u1015', '\u1039\u1014',
  '\u1039\u1013', '\u1039\u1012', '\u1039\u1011', '\u1039\u1010', '\u1039\u100F',
  // Two consonants in one glyph (research/zawgyi-to-unicode.md §2, glyph table: two consonants in one glyph): dda
  // with ddha, nna with dda, dda with dda, tta with ttha before stacked ttha, and tta with tta before stacked tta.
  // Their texts start at U+100B-U+100F, so their regexes wrap the first unit (decision 29).
  '\u100D\u1039\u100E', '\u100F\u1039\u100D', '\u100D\u1039\u100D', '\u100B\u1039\u100C', '\u1039\u100C',
  '\u100B\u1039\u100B', '\u1039\u100B',
  // Stacked ca with medial ya is the stacked jha U+1069, which Zawgyi draws that way (research/zawgyi-to-unicode.md
  // §3, letters Zawgyi draws alike); it comes before stacked ca. Written by hand: the table reads U+1069 as stacked
  // jha, U+1039 U+1008, so read backwards it gives U+1069 for stacked jha, the next row.
  { id: 'uz.glyphs.23', re: /\u1039\u1005\u103b/g, to: '\u1069', repeat: false, needs: '\u1039' },
  // Stacked jha is U+1069 too (research/zawgyi-to-unicode.md §2, glyph table: stacked consonants). 2.10 had no row
  // for it, so its virama stayed U+1039, which Zawgyi reads as an asat; 2.11 added this one (2.x 05de555), before the
  // row that writes asat as U+1039, as the other stacked consonants come.
  '\u1039\u1008',
  // The stacked consonants ja, cha, ca, gha, ga and kha (research/zawgyi-to-unicode.md §2, glyph table: stacked
  // consonants).
  '\u1039\u1007', '\u1039\u1006', '\u1039\u1005', '\u1039\u1003', '\u1039\u1002', '\u1039\u1001',
  // Medial wa with medial ha is one glyph, U+108A, and medial ha with uu is U+1089; then stacked ka, U+1060, and
  // medial ha with u, U+1088 (research/zawgyi-to-unicode.md §2, glyph table: "wa with ha", "ha with uu", stacked
  // consonants, "ha with u").
  '\u103D\u103E', '\u103E\u1030', '\u1039\u1000', '\u103E\u102F',
  // Asat takes Zawgyi's code point for it, U+1039, which is Unicode's virama, now that every row that reads a
  // virama has run (research/zawgyi-to-unicode.md §2, glyph table: U+1039, "asat"). A virama that no row read stays
  // U+1039 and so reads as asat, as in 2.x: stacked sa, U+1039 U+101E, for one, which the table has no glyph for.
  '\u103A',
  // Medial ya takes U+103A, now free (research/zawgyi-to-unicode.md §2, glyph table: U+103A, "ya").
  '\u103B',
  // Medial ra takes U+103B, the narrow ra; MEDIAL_RA_SHAPES picks its shape (research/zawgyi-to-unicode.md §2,
  // glyph table: "ra, narrow").
  '\u103C',
  // Medial wa takes U+103C (research/zawgyi-to-unicode.md §2, glyph table: U+103C, "wa").
  '\u103D',
  // Medial ha takes U+103D, the full ha, also under medial ra, where real Zawgyi text has both the full and the
  // short ha (research/zawgyi-to-unicode.md §5, open question 2).
  '\u103E'
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
    to: '$1\u1072', repeat: false, needs: '\u1071'
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
// (core/rules.js), which for these rows is one replace (applyRowsThatCanMatch below). Each replacement starts with
// a different unit from its match, so a row that matches always changes the text, which the trace relies on
// (DESIGN.md §3.9; test/next/unicodeToZawgyi.test.mjs checks it).

const MEDIAL_RA_SHAPES = /* @__PURE__ */ deepFreeze([
  // Before a wide consonant (ka, gha, cha, nna, ta, tha, bha, a, ya, la, sa and ha) the ra is the wide one, U+107E
  // (research/zawgyi-to-unicode.md §2, glyph table: "ra, wide").
  {
    id: 'uz.medial-ra.1',
    re: /\u103b([\u1000\u1003\u1006\u100f\u1010\u1011\u1018\u1021\u101a\u101c\u101e\u101f])/g,
    to: '\u107e$1', repeat: true, needs: '\u103b'
  },
  // Narrow ra on a consonant (the small nya and short na included) with wa, or wa and ha, below and i or ii above
  // is U+1083 (research/zawgyi-to-unicode.md §2, glyph table: "ra, narrow, cut at both ends").
  {
    id: 'uz.medial-ra.2',
    re: /\u103b([\u1000-\u1021\u106a\u108f](\u103c\u103d|\u108a|\u103c)[\u102d\u102e])/g,
    to: '\u1083$1', repeat: true, needs: '\u103b'
  },
  // Wide ra in the same place is U+1084 (research/zawgyi-to-unicode.md §2, glyph table: "ra, wide, cut at both
  // ends").
  {
    id: 'uz.medial-ra.3',
    re: /\u107e([\u1000-\u1021](\u103c\u103d|\u108a|\u103c)[\u102d\u102e])/g,
    to: '\u1084$1', repeat: true, needs: '\u107e'
  },
  // Narrow ra on a consonant (the small nya and short na included) with i or ii is U+107F
  // (research/zawgyi-to-unicode.md §2, glyph table: "ra, narrow, cut for an upper vowel").
  {
    id: 'uz.medial-ra.4', re: /\u103b([\u1000-\u1021\u106a\u108f][\u102d\u102e])/g,
    to: '\u107f$1', repeat: true, needs: '\u103b'
  },
  // Wide ra in the same place is U+1080 (research/zawgyi-to-unicode.md §2, glyph table: "ra, wide, cut for an upper
  // vowel").
  { id: 'uz.medial-ra.5', re: /\u107e([\u1000-\u1021][\u102d\u102e])/g, to: '\u1080$1', repeat: true, needs: '\u107e' },
  // Narrow ra on a consonant (the small nya and short na included) with wa, or wa with ha, below is U+1081
  // (research/zawgyi-to-unicode.md §2, glyph table: "ra, narrow, cut for a lower mark"). 2.x's set also lists
  // U+103E, Unicode's ha, which the last row of GLYPHS has already made U+103D, so that member never matches; it is
  // kept as 2.x has it.
  {
    id: 'uz.medial-ra.6',
    re: /\u103b([\u1000-\u1021\u106a\u108f][\u103c\u103e\u108a])/g,
    to: '\u1081$1', repeat: true, needs: '\u103b'
  },
  // Wide ra in the same place is U+1082 (research/zawgyi-to-unicode.md §2, glyph table: "ra, wide, cut for a lower
  // mark").
  {
    id: 'uz.medial-ra.7', re: /\u107e([\u1000-\u1021][\u103c\u103e\u108a])/g,
    to: '\u1082$1', repeat: true, needs: '\u107e'
  },
  // Narrow ra on nya is the ra cut for a lower mark, with the small nya: U+1081 U+106A
  // (research/zawgyi-to-unicode.md §2, glyph table: U+1081, U+106A). Written by hand: it writes two glyphs, each
  // chosen by the other, where the table gives one glyph for one text.
  { id: 'uz.medial-ra.8', re: /\u103b\u1009/g, to: '\u1081\u106a', repeat: true, needs: '\u1009' }
]);

// ---------------------------------------------------------------------------------------------------------------
// Rows read from the glyph table.

// The rows of a section, from its entries in order: a row written by hand stays as it is, and a Unicode text
// becomes the row that writes the table's glyph for it (tableRow), with the id 'uz.<section>.<n>' of the n-th entry.
function tableRows(section, entries) {
  const rows = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    rows.push(typeof entry === 'string' ? tableRow('uz.' + section + '.' + (i + 1), entry) : entry);
  }
  return deepFreeze(rows);
}

// The row `id` that writes the table's glyph for each `text`. Its regex is the text's \u escapes, lowercase, as 2.x
// wrote its literals, and so its label is too; where the text starts at U+1000-U+1010, the regex wraps that first
// unit in a one-character class, and the row keeps the plain escapes as its label (decision 29). Every match is the
// text, so it holds the text's virama where it has one, else its first unit (needs).
function tableRow(id, text) {
  const escapes = escapedUnits(text);
  const first = text.charCodeAt(0);
  const wrapped = first >= 0x1000 && first <= 0x1010;
  const pattern = wrapped ? '[' + escapes.slice(0, 6) + ']' + escapes.slice(6) : escapes;
  const needs = text.indexOf('\u1039') === -1 ? text.charAt(0) : '\u1039';
  const row = { id: id, re: new RegExp(pattern, 'g'), to: tableGlyph(text), repeat: false, needs: needs };
  if (wrapped) row.label = escapes;
  return row;
}

// The units of text as lowercase \u escapes, the way 2.x wrote its regex literals: \u1039\u101c for stacked la. The
// table's units all lie in U+1000-U+109F, so each has four hex digits.
function escapedUnits(text) {
  let escapes = '';
  for (let i = 0; i < text.length; i++) escapes += '\\u' + text.charCodeAt(i).toString(16);
  return escapes;
}

// The glyph the Zawgyi table draws text with: the table read backwards (research/zawgyi-to-unicode.md §2), the
// first glyph whose row is exactly text, its attached marks included. Where several glyphs draw one text, the table
// lists the plain shape first; the others are the shapes the context rows choose (the narrow stacked ta, the short
// ya), or shapes no row writes (the other widths of stacked cha, tha and bha, the short ha).
function tableGlyph(text) {
  const glyphs = Object.keys(ZAWGYI_GLYPHS);
  for (let i = 0; i < glyphs.length; i++) {
    const row = ZAWGYI_GLYPHS[glyphs[i]];
    if (row[1] + (row.length > 2 ? row[2] : '') === text) return glyphs[i];
  }
  throw libraryError(ERR.INVALID_FONT_TABLE, 'knayi fonts/zawgyi.js: no glyph draws ' + escapedUnits(text));
}

// ---------------------------------------------------------------------------------------------------------------
// The rows and their runner.

// 58 once rows, then 8 repeat rows, in 2.11's order.
export const UNICODE_TO_ZAWGYI_RULES = /* @__PURE__ */ joinSections(
  SHAPES_IN_CONTEXT, KINZI, VISUAL_ORDER, SMALL_LETTERS, GLYPHS, NARROW_TA, MEDIAL_RA_SHAPES
);

// The sections, in the order given, as one frozen list. The regexes stay unfrozen (D16).
function joinSections(...sections) {
  return deepFreeze([].concat(...sections));
}

// For each row, in order, as unit sets (script/codes.js) laid end to end, row r's at r * UNIT_SET_WORDS: the units
// it needs, and the units its replacement writes. The $-references of a replacement copy units the text holds
// already, and their '$' and digits lie outside U+1000-U+109F, so the whole replacement can be read as its writes.
// Built once, at load.
const ROW_NEEDS = /* @__PURE__ */ unitSetsOf(UNICODE_TO_ZAWGYI_RULES, 'needs');
const ROW_WRITES = /* @__PURE__ */ unitSetsOf(UNICODE_TO_ZAWGYI_RULES, 'to');

function unitSetsOf(rows, field) {
  const sets = new Int32Array(rows.length * UNIT_SET_WORDS);
  for (let r = 0; r < rows.length; r++) {
    const units = sets.subarray(r * UNIT_SET_WORDS, (r + 1) * UNIT_SET_WORDS);
    const text = rows[r][field];
    for (let i = 0; i < text.length; i++) addBlockUnit(units, text.charCodeAt(i));
  }
  return sets;
}

// Unicode text in Zawgyi: a mark typed twice in a row counts once, then every row runs in order, GLYPHS in one pass
// (writeGlyphs). The text is a string; 2.x's public preamble (trimming, the Myanmar-block check) belongs to the
// caller (compat/fontConvert.js).
export function unicodeToZawgyi(text) {
  const units = new Int32Array(UNIT_SET_WORDS);
  const collapsed = collapseRepeatedMarks(text, 'unicode', units);
  const beforeGlyphs = applyRowsThatCanMatch(collapsed, units, 0, GLYPHS_PLACE.start, null);
  const glyphs = writeGlyphs(beforeGlyphs, units);
  return applyRowsThatCanMatch(glyphs, units, GLYPHS_PLACE.end, UNICODE_TO_ZAWGYI_RULES.length, null);
}

// The same, recording 2.x's debug log in `trace` (DESIGN.md §3.9, D4): trace.start is the collapsed text, and
// each record is a row that changed the text (a repeat row that matched), with the text after it. 2.x's
// matched_patterns are the records' labels, and its steps are [trace.start, ...the records' texts]. Every row runs
// on its own here, GLYPHS included, since the log names each.
export function traceUnicodeToZawgyi(text, trace) {
  const units = new Int32Array(UNIT_SET_WORDS);
  const collapsed = collapseRepeatedMarks(text, 'unicode', units);
  startTrace(trace, collapsed);
  return applyRowsThatCanMatch(collapsed, units, 0, UNICODE_TO_ZAWGYI_RULES.length, trace);
}

// Rows `from` to `to` (not included), in order, as core/rules.js applyRuleRows and traceRuleRows run them, with two
// differences that change no result. First, a row that cannot match is skipped by the unit set rather than by a
// search of the text per row: `units` holds every unit of U+1000-U+109F the text may hold (the collapse noted the
// text's; a row that changes the text adds what its replacement writes), and a row with none of its `needs` there is
// skipped. Every call paid a String#replace per row, which was most of the time on short text, and most rows need a
// unit that most words lack (DESIGN.md §3.10).
//
// Second, a repeat row (2.x asLongAsMatch) is tested, then replaced once: its replacement turns the medial ra its
// pattern starts with into another glyph, and the rest of its pattern matches neither, so one replace finds every match
// and makes no new one (2.x 1584410; test/next/unicodeToZawgyi.test.mjs checks it on fuzz). And a repeat row that
// matches always changes the text, so a row changed the text exactly when 2.x logs it: that is when it is recorded.
function applyRowsThatCanMatch(text, units, from, to, trace) {
  const rows = UNICODE_TO_ZAWGYI_RULES;
  for (let r = from; r < to; r++) {
    const at = r * UNIT_SET_WORDS;
    if (!sharesUnit(units, ROW_NEEDS, at)) continue;
    const row = rows[r];
    const next = row.repeat && !ruleMatches(row, text) ? text : text.replace(row.re, row.to);
    if (next === text) continue;
    for (let w = 0; w < UNIT_SET_WORDS; w++) units[w] |= ROW_WRITES[at + w];
    if (trace !== null) recordStep(trace, row.id, ruleLabel(row), next);
    text = next;
  }
  return text;
}

// Whether the unit set shares a unit with the set of `sets` that starts at `at`.
function sharesUnit(units, sets, at) {
  return ((units[0] & sets[at]) | (units[1] & sets[at + 1]) | (units[2] & sets[at + 2]) | (units[3] & sets[at + 3]) |
    (units[4] & sets[at + 4])) !== 0;
}

// ---------------------------------------------------------------------------------------------------------------
// GLYPHS in one pass (DESIGN.md §3.9).
//
// writeGlyphs reads the text once, from left to right. At each unit it writes the glyph of the first GLYPHS row, in
// row order, whose text starts there, and goes on after that text. That is what the rows give one by one, because:
// - no row reads a unit that a row before it writes, so every match of a row is units of the text GLYPHS is given,
//   left as they were by the rows before it;
// - where the matches of two rows can overlap, the one that starts first in the text belongs to the row that comes
//   first, except in a stack on a stack, a virama two units after a virama. There a row can take the units of a row
//   before it whose match starts earlier: tta with ttha comes before stacked tta, so the rows give U+1039 U+1092 for
//   U+1039 U+100B U+1039 U+100C, where one pass would give U+106C U+106D.
// So a text with a stack on a stack, rare in real text, runs the rows one by one. test/next/unicodeToZawgyi.test.mjs
// checks both conditions on every pair of rows, and the result on every short string of the units the rows read and
// on long texts made of them.

// Where GLYPHS sits in UNICODE_TO_ZAWGYI_RULES: its first row, and the row after its last.
const GLYPHS_PLACE = /* @__PURE__ */ placeOf(GLYPHS, UNICODE_TO_ZAWGYI_RULES);

function placeOf(section, rows) {
  const start = rows.indexOf(section[0]);
  return deepFreeze({ start: start, end: start + section.length });
}

// The GLYPHS rows as the pass reads them, in typed arrays built once, at load: the pass reads them at every unit,
// and a read from a frozen array, such as the rows, costs about 10 times a typed array's under V8 and 16 times under
// JavaScriptCore (Bun) (DESIGN.md §7.12). Row r matches the units of PASS_TEXT_UNITS from PASS_TEXT_STARTS[r] to
// PASS_TEXT_STARTS[r + 1], and writes the one unit PASS_GLYPHS[r]. PASS_FIRST_ROW[unit - 0x1000] is the first row
// whose text starts with that unit of U+1000-U+109F, and PASS_NEXT_ROW[r] the next row after r whose text starts with
// the same unit; -1 is none. GLYPH_TEXTS, the text of each row as a string, is read at load only.
const GLYPH_TEXTS = /* @__PURE__ */ literalTexts(GLYPHS);
const PASS_TEXT_UNITS = /* @__PURE__ */ unitsEndToEnd(GLYPH_TEXTS);
const PASS_TEXT_STARTS = /* @__PURE__ */ startsEndToEnd(GLYPH_TEXTS);
const PASS_GLYPHS = /* @__PURE__ */ glyphUnitsOf(GLYPHS);
const PASS_FIRST_ROW = /* @__PURE__ */ firstRowByUnit(GLYPH_TEXTS);
const PASS_NEXT_ROW = /* @__PURE__ */ nextRowBySameUnit(GLYPH_TEXTS);

// The text each row matches: the 2.x source of a GLYPHS row is a pure literal of \u escapes (the test checks it),
// whose units are the text.
function literalTexts(rows) {
  const texts = [];
  for (let r = 0; r < rows.length; r++) texts.push(unitsOfEscapes(ruleLabel(rows[r])));
  return deepFreeze(texts);
}

// The units that a source of \u escapes names, escapedUnits read back.
function unitsOfEscapes(escapes) {
  return escapes.replace(/\\u([0-9a-f]{4})/g, (escape, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// The units of texts, end to end.
function unitsEndToEnd(texts) {
  const joined = texts.join('');
  const units = new Uint16Array(joined.length);
  for (let i = 0; i < joined.length; i++) units[i] = joined.charCodeAt(i);
  return units;
}

// Where each of texts starts among their units end to end, then where the last one ends.
function startsEndToEnd(texts) {
  const starts = new Int16Array(texts.length + 1);
  for (let r = 0; r < texts.length; r++) starts[r + 1] = starts[r] + texts[r].length;
  return starts;
}

// The glyph each row writes: its replacement, which for every GLYPHS row is one unit (the test checks it).
function glyphUnitsOf(rows) {
  const glyphs = new Uint16Array(rows.length);
  for (let r = 0; r < rows.length; r++) glyphs[r] = rows[r].to.charCodeAt(0);
  return glyphs;
}

function firstRowByUnit(texts) {
  const first = new Int8Array(0xA0).fill(-1);
  for (let row = texts.length - 1; row >= 0; row--) first[texts[row].charCodeAt(0) - 0x1000] = row;
  return first;
}

function nextRowBySameUnit(texts) {
  const next = new Int8Array(texts.length).fill(-1);
  for (let row = 0; row < texts.length; row++) {
    for (let later = row + 1; later < texts.length && next[row] === -1; later++) {
      if (texts[later].charCodeAt(0) === texts[row].charCodeAt(0)) next[row] = later;
    }
  }
  return next;
}

// Two ways to write the pass's output. A text of up to LONG_TEXT_UNITS units, a word or two, is copied as slices
// joined to the glyphs; a longer one into a buffer of units. A buffer costs more than the slices on a word, where its
// allocation is most of the work, and under JavaScriptCore the slices of a long text cost more than the rows did,
// 5-7% of the call on one string (DESIGN.md §7.12).
const LONG_TEXT_UNITS = 64;
const DECODE_CHUNK_UNITS = 8192; // String.fromCharCode.apply takes at most this many units at a time

// The GLYPHS rows on text, as one pass, noting in `units` every unit it writes; a text with a stack on a stack runs
// the rows one by one (see above).
function writeGlyphs(text, units) {
  if (hasStackOnStack(text)) return applyRowsThatCanMatch(text, units, GLYPHS_PLACE.start, GLYPHS_PLACE.end, null);
  return text.length > LONG_TEXT_UNITS ? writeGlyphsAsUnits(text, units) : writeGlyphsAsSlices(text, units);
}

// The pass, joining slices of text to the glyphs.
function writeGlyphsAsSlices(text, units) {
  let out = '';
  let copyFrom = 0;
  for (let i = 0; i < text.length; i++) {
    const row = glyphRowAt(text, i);
    if (row === -1) continue;
    const glyph = PASS_GLYPHS[row];
    addBlockUnit(units, glyph);
    out += text.slice(copyFrom, i) + String.fromCharCode(glyph);
    copyFrom = i + PASS_TEXT_STARTS[row + 1] - PASS_TEXT_STARTS[row];
    i = copyFrom - 1;
  }
  return copyFrom === 0 ? text : out + text.slice(copyFrom);
}

// The pass, writing units into a buffer as long as the text: each glyph is one unit for a match of at least one, so
// the output is never longer than the text.
function writeGlyphsAsUnits(text, units) {
  const buffer = new Uint16Array(text.length);
  let written = 0;
  let copyFrom = 0;
  for (let i = 0; i < text.length; i++) {
    const row = glyphRowAt(text, i);
    if (row === -1) continue;
    for (let j = copyFrom; j < i; j++) buffer[written++] = text.charCodeAt(j);
    const glyph = PASS_GLYPHS[row];
    addBlockUnit(units, glyph);
    buffer[written++] = glyph;
    copyFrom = i + PASS_TEXT_STARTS[row + 1] - PASS_TEXT_STARTS[row];
    i = copyFrom - 1;
  }
  if (copyFrom === 0) return text;
  for (let j = copyFrom; j < text.length; j++) buffer[written++] = text.charCodeAt(j);
  return decodeUnits(buffer, written);
}

// The first `length` units of buffer as a string, in chunks for String.fromCharCode.apply. Never TextDecoder, which
// would replace a lone surrogate (DESIGN.md §3.7).
function decodeUnits(buffer, length) {
  let text = '';
  for (let start = 0; start < length; start += DECODE_CHUNK_UNITS) {
    text += String.fromCharCode.apply(null, buffer.subarray(start, Math.min(length, start + DECODE_CHUNK_UNITS)));
  }
  return text;
}

// The first GLYPHS row, in row order, whose text starts at index i of text, or -1.
function glyphRowAt(text, i) {
  const unit = text.charCodeAt(i) - 0x1000;
  if (unit < 0 || unit >= 0xA0) return -1;
  for (let row = PASS_FIRST_ROW[unit]; row !== -1; row = PASS_NEXT_ROW[row]) {
    if (restOfTextAt(text, i, row)) return row;
  }
  return -1;
}

// Whether the units of row's text after its first stand after index i of text.
function restOfTextAt(text, i, row) {
  const start = PASS_TEXT_STARTS[row];
  const length = PASS_TEXT_STARTS[row + 1] - start;
  for (let k = 1; k < length; k++) {
    if (text.charCodeAt(i + k) !== PASS_TEXT_UNITS[start + k]) return false;
  }
  return true;
}

// Whether a virama stands two units after another: a stack on a stack, such as U+1039 U+100B U+1039 U+100C.
function hasStackOnStack(text) {
  for (let at = text.indexOf('\u1039'); at !== -1; at = text.indexOf('\u1039', at + 1)) {
    if (text.charCodeAt(at + 2) === CP.VIRAMA) return true;
  }
  return false;
}
