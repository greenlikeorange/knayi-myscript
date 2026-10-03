// The Win Innwa glyph table, look-alike sequences and C1 aliases: data only (DESIGN.md §2.3, §3.8), and the 2.x
// shape of that data for compat. Layer L2. Owner: W6 (engine-fonts).
//
// Moved from library/win.js at the reference (e5f6e24), rows and comments unchanged except for the role names
// (ROLE in script/codes.js: 2.x PRE is BEFORE_BASE, and TEXT is PLAIN). The 2.x loop that copied each Windows-1252
// row to its C1 control (win.js:222-224) is the declared field WIN_FONT.aliases. This is the project's own MIT
// table, made from the font's glyphs and copied from no other converter (research/win-fonts.md §5). Never copy
// LGPL, GPL or unlicensed tables, and never commit the Win fonts (CONTRIBUTING.md).
//
// Win Innwa family (WinMyanmar Systems, 1992-2005): Win fonts draw Burmese glyphs on the ASCII and Windows-1252
// code points of the keys that type them ("jrefrm" shows as Myanmar). Text is stored in the order the glyphs are
// drawn: e and medial ra before the consonant, kinzi and stacked consonants after it, and the marks in any order
// (research/win-fonts.md §2). The table covers every code point Win Innwa 4 (2004) maps. Win Researcher, Win Kalaw
// and the other Win fonts share this encoding. Wwin_Burmese and other ASCII fonts use different mappings and are
// not covered.
//
// Conversion to Unicode runs the stages of engine/fontStages.js FONT_STAGES:
// 1. sequences: letters Win has no glyph for are typed as look-alike sequences (aMomf, Mo, ps, OD;
//    LOOK_ALIKE_SEQUENCES).
// 2. syllables: each Win glyph becomes Unicode characters with its role in the syllable (WIN_GLYPHS), and each
//    syllable is written in the storage order of UTN #11 (engine/fontReader.js readFont). A trace first shows the
//    glyphs still in typed order (the trace-only stage 'glyphs').
// 3. zero as wa: a zero that is not part of a number becomes wa, since Win has no glyph for wa.
// 4. look-alikes, then typos: the typing fixes that normalize makes too, in this pipeline's order (normalize runs
//    typos first; ARCHITECTURE.md, "Typing fixes and their two orders").
// 5. NFC.

import { deepFreeze } from '../freeze.js';
import { ROLE, KINZI_TEXT } from '../script/codes.js';

// Win code point -> [role, Unicode text, marks that come with it] (research/win-fonts.md §5, "The glyph table":
// each entry checked against the font's own glyph).
export const WIN_GLYPHS = /* @__PURE__ */ winGlyphTable();

function winGlyphTable() {
  return deepFreeze({
    // Consonants and independent letters
    'u': [ROLE.BASE, '\u1000'], // ka
    'c': [ROLE.BASE, '\u1001'], // kha
    '*': [ROLE.BASE, '\u1002'], // ga
    'C': [ROLE.BASE, '\u1003'], // gha
    'i': [ROLE.BASE, '\u1004'], // nga
    'p': [ROLE.BASE, '\u1005'], // ca
    'q': [ROLE.BASE, '\u1006'], // cha
    'Z': [ROLE.BASE, '\u1007'], // ja
    'n': [ROLE.BASE, '\u100A'], // nya
    '\u00F1': [ROLE.BASE, '\u100A'], // n tilde: nya, short
    '#': [ROLE.BASE, '\u100B'], // tta
    'X': [ROLE.BASE, '\u100C'], // ttha
    '!': [ROLE.BASE, '\u100D'], // dda
    '\u00A1': [ROLE.BASE, '\u100E'], // inverted exclamation: ddha
    'P': [ROLE.BASE, '\u100F'], // nna
    'w': [ROLE.BASE, '\u1010'], // ta
    'x': [ROLE.BASE, '\u1011'], // tha
    "'": [ROLE.BASE, '\u1012'], // da
    '"': [ROLE.BASE, '\u1013'], // dha
    'e': [ROLE.BASE, '\u1014'], // na
    'E': [ROLE.BASE, '\u1014'], // na, short
    'y': [ROLE.BASE, '\u1015'], // pa
    'z': [ROLE.BASE, '\u1016'], // pha
    'A': [ROLE.BASE, '\u1017'], // ba
    'b': [ROLE.BASE, '\u1018'], // bha
    'r': [ROLE.BASE, '\u1019'], // ma
    ',': [ROLE.BASE, '\u101A'], // ya
    '&': [ROLE.BASE, '\u101B'], // ra
    '\u00BD': [ROLE.BASE, '\u101B'], // one half: ra, short
    'v': [ROLE.BASE, '\u101C'], // la
    'o': [ROLE.BASE, '\u101E'], // sa
    '[': [ROLE.BASE, '\u101F'], // ha
    'V': [ROLE.BASE, '\u1020'], // lla
    't': [ROLE.BASE, '\u1021'], // a
    '\u00A3': [ROLE.BASE, '\u1023'], // pound: i
    '\u00FE': [ROLE.BASE, '\u1024'], // thorn: ii
    'O': [ROLE.BASE, '\u1025'], // u
    '{': [ROLE.BASE, '\u1027'], // e
    '\u00CD': [ROLE.BASE, '\u1009'], // I acute: nnya, narrow
    '\u00DA': [ROLE.BASE, '\u1009'], // U acute: nnya, wide
    '\u00F3': [ROLE.BASE, '\u103F'], // o acute: great sa
    '\u00D3': [ROLE.BASE, '\u1009\u102C'], // O acute: nnya with aa

    // Two consonants in one glyph
    '@': [ROLE.BASE, '\u100F\u1039\u100D'], // nna + dda
    '|': [ROLE.BASE, '\u100B\u1039\u100C'], // tta + ttha
    '\u00A5': [ROLE.BASE, '\u100B\u1039\u100B'], // yen: tta + tta
    '\u00D7': [ROLE.BASE, '\u100D\u1039\u100D'], // multiplication: dda + dda
    '\u00B9': [ROLE.BASE, '\u100D\u1039\u100E'], // superscript one: dda + ddha
    '$': [ROLE.BASE, '\u1000\u103B\u1015\u103A'], // kyat

    // Vowel signs, tones and asat
    'm': [ROLE.MARK, '\u102C'], // aa
    'g': [ROLE.MARK, '\u102B'], // tall aa
    ':': [ROLE.MARK, '\u102B\u103A'], // tall aa with asat
    'd': [ROLE.MARK, '\u102D'], // i
    'D': [ROLE.MARK, '\u102E'], // ii
    'k': [ROLE.MARK, '\u102F'], // u
    'K': [ROLE.MARK, '\u102F'], // u, long
    'l': [ROLE.MARK, '\u1030'], // uu
    'L': [ROLE.MARK, '\u1030'], // uu, long
    'J': [ROLE.MARK, '\u1032'], // ai
    'H': [ROLE.MARK, '\u1036'], // anusvara
    '\u00F0': [ROLE.MARK, '\u102D\u1036'], // eth: i with anusvara
    'h': [ROLE.MARK, '\u1037'], // dot below
    'U': [ROLE.MARK, '\u1037'], // dot below, right
    'Y': [ROLE.MARK, '\u1037'], // dot below, further right
    ';': [ROLE.MARK, '\u1038'], // visarga
    'f': [ROLE.MARK, '\u103A'], // asat
    'a': [ROLE.BEFORE_BASE, '\u1031'], // e

    // Kinzi
    'F': [ROLE.KINZI, KINZI_TEXT],
    '\u00D8': [ROLE.KINZI, KINZI_TEXT, '\u102D'], // O stroke: kinzi with i
    '\u00D0': [ROLE.KINZI, KINZI_TEXT, '\u102E'], // eth: kinzi with ii
    '\u00F8': [ROLE.KINZI, KINZI_TEXT, '\u1036'], // o stroke: kinzi with anusvara

    // Medials
    's': [ROLE.MARK, '\u103B'], // ya
    '\u00DF': [ROLE.MARK, '\u103B'], // sharp s: ya, long
    'G': [ROLE.MARK, '\u103D'], // wa
    'S': [ROLE.MARK, '\u103E'], // ha
    '\u00A7': [ROLE.MARK, '\u103E'], // section: ha, short
    'T': [ROLE.MARK, '\u103D\u103E'], // wa with ha
    'I': [ROLE.MARK, '\u103E\u102F'], // ha with u
    '\u00AA': [ROLE.MARK, '\u103E\u1030'], // feminine ordinal: ha with uu
    'Q': [ROLE.MARK, '\u103B\u103E'], // ya with ha
    'R': [ROLE.MARK, '\u103B\u103D'], // ya with wa
    'W': [ROLE.MARK, '\u103B\u103D\u103E'], // ya with wa and ha
    'j': [ROLE.BEFORE_BASE, '\u103C'], // ra, narrow
    'M': [ROLE.BEFORE_BASE, '\u103C'], // ra, wide
    'N': [ROLE.BEFORE_BASE, '\u103C'], // ra, narrow, cut for an upper vowel
    'B': [ROLE.BEFORE_BASE, '\u103C'], // ra, wide, cut for an upper vowel
    '`': [ROLE.BEFORE_BASE, '\u103C'], // ra, narrow, cut for a lower mark
    '~': [ROLE.BEFORE_BASE, '\u103C'], // ra, wide, cut for a lower mark
    '>': [ROLE.BEFORE_BASE, '\u103C\u103D'], // ra, narrow, with wa
    '<': [ROLE.BEFORE_BASE, '\u103C\u103D'], // ra, wide, with wa
    '\u00FB': [ROLE.BEFORE_BASE, '\u103C\u102F'], // u circumflex: ra, narrow, with u
    '\u00EA': [ROLE.BEFORE_BASE, '\u103C\u102F'], // e circumflex: ra, wide, with u

    // Stacked consonants
    '\u00FA': [ROLE.STACK, '\u1039\u1000'], // u acute: ka
    '\u00A9': [ROLE.STACK, '\u1039\u1001'], // copyright: kha
    '\u00BE': [ROLE.STACK, '\u1039\u1002'], // three quarters: ga
    '\u00A2': [ROLE.STACK, '\u1039\u1003'], // cent: gha
    '\u00F6': [ROLE.STACK, '\u1039\u1005'], // o umlaut: ca
    '\u00E4': [ROLE.STACK, '\u1039\u1006'], // a umlaut: cha
    '\u00C6': [ROLE.STACK, '\u1039\u1007'], // AE: ja
    '\u00D1': [ROLE.STACK, '\u1039\u1008'], // N tilde: jha
    '\u00B3': [ROLE.STACK, '\u1039\u100B'], // superscript three: tta
    '\u00B2': [ROLE.STACK, '\u1039\u100C'], // superscript two: ttha
    '\u00D6': [ROLE.STACK, '\u1039\u100F'], // O umlaut: nna
    '\u00E5': [ROLE.STACK, '\u1039\u1010'], // a ring: ta, wide
    '\u00C5': [ROLE.STACK, '\u1039\u1010'], // A ring: ta, narrow
    '\u00AC': [ROLE.STACK, '\u1039\u1011'], // not: tha, wide
    '\u00A6': [ROLE.STACK, '\u1039\u1011'], // broken bar: tha, narrow
    '\u00B4': [ROLE.STACK, '\u1039\u1012'], // acute: da
    '\u00A8': [ROLE.STACK, '\u1039\u1013'], // diaeresis: dha
    '\u00E9': [ROLE.STACK, '\u1039\u1014'], // e acute: na
    '\u00DC': [ROLE.STACK, '\u1039\u1015'], // U umlaut: pa
    '\u00E6': [ROLE.STACK, '\u1039\u1016'], // ae: pha
    '\u00C1': [ROLE.STACK, '\u1039\u1017'], // A acute: ba
    '\u00C7': [ROLE.STACK, '\u1039\u1018'], // C cedilla: bha
    '\u00AE': [ROLE.STACK, '\u1039\u1019'], // registered: ma
    '\u2019': [ROLE.STACK, '\u1039\u101C'], // right quote (0x92): la
    '\u00C9': [ROLE.STACK, '\u1039\u1010', '\u103D'], // E acute: ta, with wa

    // Digits and Burmese punctuation. Win has no glyph for wa and types it as zero.
    '0': [ROLE.BASE, '\u1040'],
    '1': [ROLE.BASE, '\u1041'],
    '2': [ROLE.BASE, '\u1042'],
    '3': [ROLE.BASE, '\u1043'],
    '4': [ROLE.BASE, '\u1044'],
    '5': [ROLE.BASE, '\u1045'],
    '6': [ROLE.BASE, '\u1046'],
    '7': [ROLE.BASE, '\u1047'],
    '8': [ROLE.BASE, '\u1048'],
    '9': [ROLE.BASE, '\u1049'],
    '?': [ROLE.PLAIN, '\u104A'], // little section
    '/': [ROLE.PLAIN, '\u104B'], // section
    '\u00FC': [ROLE.BASE, '\u104C'], // u umlaut: locative
    '\u00ED': [ROLE.BASE, '\u104D'], // i acute: completed
    '\u00A4': [ROLE.BASE, '\u104E'], // currency sign: aforementioned
    '\\': [ROLE.BASE, '\u104F'], // genitive

    // Fractions. Unicode has no Burmese fraction characters.
    '\u0192': [ROLE.PLAIN, '\u1041/\u1042'], // 0x83
    '\u201E': [ROLE.PLAIN, '\u1041/\u1043'], // 0x84
    '\u2026': [ROLE.PLAIN, '\u1042/\u1043'], // 0x85
    '\u2020': [ROLE.PLAIN, '\u1041/\u1044'], // 0x86
    '\u2021': [ROLE.PLAIN, '\u1043/\u1044'], // 0x87
    '\u02C6': [ROLE.PLAIN, '\u1041/\u1045'], // 0x88
    '\u2030': [ROLE.PLAIN, '\u1042/\u1045'], // 0x89
    '\u0160': [ROLE.PLAIN, '\u1043/\u1045'], // 0x8A
    '\u2039': [ROLE.PLAIN, '\u1044/\u1045'], // 0x8B

    // Latin punctuation the font moves to other keys
    ']': [ROLE.PLAIN, '\u2018'],
    '}': [ROLE.PLAIN, '\u2019'],
    '^': [ROLE.PLAIN, '/'],
    '_': [ROLE.PLAIN, '\u00D7'],
    '\u00AB': [ROLE.PLAIN, '['],
    '\u00BB': [ROLE.PLAIN, ']'],
    '\u00B5': [ROLE.PLAIN, '!'],
    '\u03BC': [ROLE.PLAIN, '!'],
    '\u00BF': [ROLE.PLAIN, '?'],
    '\u00E7': [ROLE.PLAIN, ','],
    '\u00BC': [ROLE.PLAIN, '-'],
    '\u2010': [ROLE.PLAIN, '-'],
    '\u00E8': [ROLE.PLAIN, '_'],
    '\u00CA': [ROLE.PLAIN, ' '], // E circumflex: a blank glyph

    // Dingbats. The vendor logo at 0xB0 has no text and is dropped.
    '\u201A': [ROLE.PLAIN, '\u260E'], // 0x82 telephone
    '\u00C0': [ROLE.PLAIN, '\u2666'],
    '\u00C2': [ROLE.PLAIN, '\u2714'],
    '\u00C3': [ROLE.PLAIN, '\u2663'],
    '\u00C4': [ROLE.PLAIN, '\u2731'],
    '\u00E0': [ROLE.PLAIN, '\u2665'],
    '\u00E1': [ROLE.PLAIN, '\u27A4'],
    '\u00E2': [ROLE.PLAIN, '\u2718'],
    '\u00E3': [ROLE.PLAIN, '\u2660'],
    '\u00B6': [ROLE.PLAIN, '\u25C4'],
    '\u00B0': [ROLE.PLAIN, '']
  });
}

// Letters Win has no glyph for, typed as look-alike sequences, applied before the glyphs, in order, each once (the
// stage 'sequences'; research/win-fonts.md §2, "No glyph of their own", and §5, "Sequences first").
export const LOOK_ALIKE_SEQUENCES = /* @__PURE__ */ lookAlikeSequences();

// The rows, with new RegExps at each call: legacyWinTables takes its own from here.
function lookAlikeSequences() {
  return deepFreeze([
    // aMomf: au (e + medial ra around sa + aa + asat).
    { id: 'win.look-alike.1', re: /a[Mj]omf/g, to: '\u102A', repeat: false },
    // Mo: o (medial ra around sa).
    { id: 'win.look-alike.2', re: /[Mj]o/g, to: '\u1029', repeat: false },
    // ps: jha (ca + medial ya).
    { id: 'win.look-alike.3', re: /p[s\u00DF]/g, to: '\u1008', repeat: false },
    // OD: uu (u + ii).
    { id: 'win.look-alike.4', re: /OD/g, to: '\u1026', repeat: false }
  ]);
}

// Text read as ISO-8859-1 instead of Windows-1252 has C1 controls where Windows-1252 has these characters
// (research/win-fonts.md §2, "Decoding"). Each C1 control reads as the glyph of its Windows-1252 key, in the order
// 2.x added them (win.js:217-221).
export const C1_ALIASES = /* @__PURE__ */ deepFreeze({
  '\u0082': '\u201A', '\u0083': '\u0192', '\u0084': '\u201E', '\u0085': '\u2026', '\u0086': '\u2020',
  '\u0087': '\u2021', '\u0088': '\u02C6', '\u0089': '\u2030', '\u008A': '\u0160', '\u008B': '\u2039',
  '\u0092': '\u2019'
});

// The font, for engine/fontReader.js compileFont (DESIGN.md §3.8).
export const WIN_FONT = /* @__PURE__ */ deepFreeze({
  name: 'win',
  glyphs: WIN_GLYPHS,
  sequences: LOOK_ALIKE_SEQUENCES,
  selfBases: [],
  aliases: C1_ALIASES,
  // Kyat, and nnya with aa: bases whose inner marks are written as they are, not sorted (DESIGN.md §3.8; §7 #19
  // of the plan, kept on purpose).
  wholeBases: ['\u1000\u103B\u1015\u103A', '\u1009\u102C']
});

// The 2.x shape of this data, as library/win.js exports it as `tables`: { WIN, SEQUENCES, ROLES }, with the role
// strings, the C1 controls as keys that share their Windows-1252 key's row, the keys in 2.x's order, and
// [pattern, replacement] pairs. That shape is 2.x API (scripts/eval/win-glyphs.mjs reads it; §1 of the plan), so
// compat and the shim that replaces library/win.js in Phase 6 build it from here. Each call returns new objects
// and new RegExps, as open to change as 2.x's, so no caller can reach this module's own data.
export function legacyWinTables() {
  const names = legacyRoleNames();
  const win = {};
  const keys = Object.keys(WIN_GLYPHS);
  for (let i = 0; i < keys.length; i++) win[keys[i]] = legacyRow(WIN_GLYPHS[keys[i]], names);
  const controls = Object.keys(C1_ALIASES);
  for (let i = 0; i < controls.length; i++) win[controls[i]] = win[C1_ALIASES[controls[i]]];
  const rows = lookAlikeSequences();
  const sequences = [];
  for (let i = 0; i < rows.length; i++) sequences.push([rows[i].re, rows[i].to]);
  return { WIN: win, SEQUENCES: sequences, ROLES: legacyRoles(names) };
}

// The 2.x role string of each ROLE (storageOrder.js:10-16).
function legacyRoleNames() {
  const names = [];
  names[ROLE.BASE] = 'base';
  names[ROLE.BEFORE_BASE] = 'pre';
  names[ROLE.MARK] = 'mark';
  names[ROLE.STACK] = 'stack';
  names[ROLE.KINZI] = 'kinzi';
  names[ROLE.PLAIN] = 'text';
  return names;
}

// storageOrder.ROLES: { BASE, PRE, MARK, STACK, KINZI, TEXT }, in that order.
function legacyRoles(names) {
  return {
    BASE: names[ROLE.BASE], PRE: names[ROLE.BEFORE_BASE], MARK: names[ROLE.MARK], STACK: names[ROLE.STACK],
    KINZI: names[ROLE.KINZI], TEXT: names[ROLE.PLAIN]
  };
}

// A row in the 2.x shape: [role string, text], with the attached marks as a third item only where the row has them.
function legacyRow(row, names) {
  const out = [names[row[0]], row[1]];
  if (row.length > 2) out.push(row[2]);
  return out;
}
