// Win Innwa family (WinMyanmar Systems, 1992-2005) -> Unicode.
//
// Win fonts draw Burmese glyphs on the ASCII and Windows-1252 code points of the keys that type them
// ("jrefrm" shows as Myanmar). Text is stored in the order the glyphs are drawn: e and medial ra before
// the consonant, kinzi and stacked consonants after it, and the marks in any order.
//
// Conversion:
// 1. Letters Win has no glyph for are typed as look-alike sequences (ps, Mo, aMomf, OD).
// 2. Each Win glyph becomes Unicode characters, with its role in the syllable.
// 3. Each syllable is written in Unicode storage order (Unicode Technical Note #11): kinzi, consonant,
//    stacked consonant, then medials, vowels and tones in their fixed order.
// 4. A zero that is not part of a number becomes wa, and the result is NFC.
//
// The table covers every code point Win Innwa 4 (2004) maps. Win Researcher, Win Kalaw and the other Win
// fonts share this encoding. Wwin_Burmese and other ASCII fonts use different mappings and are not covered.

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

// Roles of a glyph in a syllable.
const BASE = 'base'; // consonant, independent vowel, digit or symbol: starts a syllable
const PRE = 'pre'; // drawn before the consonant (e, medial ra): belongs to the next base
const MARK = 'mark'; // medial, vowel sign or tone
const STACK = 'stack'; // stacked consonant under the base
const KINZI = 'kinzi'; // kinzi, drawn over the base and stored before it
const TEXT = 'text'; // anything else: ends the syllable

const KINZI_TEXT = '\u1004\u103A\u1039';

// Win code point -> [role, Unicode text, marks that come with it].
const WIN = {
  // Consonants and independent letters
  'u': [BASE, '\u1000'], // ka
  'c': [BASE, '\u1001'], // kha
  '*': [BASE, '\u1002'], // ga
  'C': [BASE, '\u1003'], // gha
  'i': [BASE, '\u1004'], // nga
  'p': [BASE, '\u1005'], // ca
  'q': [BASE, '\u1006'], // cha
  'Z': [BASE, '\u1007'], // ja
  'n': [BASE, '\u100A'], // nya
  '\u00F1': [BASE, '\u100A'], // n tilde: nya, short
  '#': [BASE, '\u100B'], // tta
  'X': [BASE, '\u100C'], // ttha
  '!': [BASE, '\u100D'], // dda
  '\u00A1': [BASE, '\u100E'], // inverted exclamation: ddha
  'P': [BASE, '\u100F'], // nna
  'w': [BASE, '\u1010'], // ta
  'x': [BASE, '\u1011'], // tha
  "'": [BASE, '\u1012'], // da
  '"': [BASE, '\u1013'], // dha
  'e': [BASE, '\u1014'], // na
  'E': [BASE, '\u1014'], // na, short
  'y': [BASE, '\u1015'], // pa
  'z': [BASE, '\u1016'], // pha
  'A': [BASE, '\u1017'], // ba
  'b': [BASE, '\u1018'], // bha
  'r': [BASE, '\u1019'], // ma
  ',': [BASE, '\u101A'], // ya
  '&': [BASE, '\u101B'], // ra
  '\u00BD': [BASE, '\u101B'], // one half: ra, short
  'v': [BASE, '\u101C'], // la
  'o': [BASE, '\u101E'], // sa
  '[': [BASE, '\u101F'], // ha
  'V': [BASE, '\u1020'], // lla
  't': [BASE, '\u1021'], // a
  '\u00A3': [BASE, '\u1023'], // pound: i
  '\u00FE': [BASE, '\u1024'], // thorn: ii
  'O': [BASE, '\u1025'], // u
  '{': [BASE, '\u1027'], // e
  '\u00CD': [BASE, '\u1009'], // I acute: nnya, narrow
  '\u00DA': [BASE, '\u1009'], // U acute: nnya, wide
  '\u00F3': [BASE, '\u103F'], // o acute: great sa
  '\u00D3': [BASE, '\u1009\u102C'], // O acute: nnya with aa

  // Two consonants in one glyph
  '@': [BASE, '\u100F\u1039\u100D'], // nna + dda
  '|': [BASE, '\u100B\u1039\u100C'], // tta + ttha
  '\u00A5': [BASE, '\u100B\u1039\u100B'], // yen: tta + tta
  '\u00D7': [BASE, '\u100D\u1039\u100D'], // multiplication: dda + dda
  '\u00B9': [BASE, '\u100D\u1039\u100E'], // superscript one: dda + ddha
  '$': [BASE, '\u1000\u103B\u1015\u103A'], // kyat

  // Vowel signs, tones and asat
  'm': [MARK, '\u102C'], // aa
  'g': [MARK, '\u102B'], // tall aa
  ':': [MARK, '\u102B\u103A'], // tall aa with asat
  'd': [MARK, '\u102D'], // i
  'D': [MARK, '\u102E'], // ii
  'k': [MARK, '\u102F'], // u
  'K': [MARK, '\u102F'], // u, long
  'l': [MARK, '\u1030'], // uu
  'L': [MARK, '\u1030'], // uu, long
  'J': [MARK, '\u1032'], // ai
  'H': [MARK, '\u1036'], // anusvara
  '\u00F0': [MARK, '\u102D\u1036'], // eth: i with anusvara
  'h': [MARK, '\u1037'], // dot below
  'U': [MARK, '\u1037'], // dot below, right
  'Y': [MARK, '\u1037'], // dot below, further right
  ';': [MARK, '\u1038'], // visarga
  'f': [MARK, '\u103A'], // asat
  'a': [PRE, '\u1031'], // e

  // Kinzi
  'F': [KINZI, KINZI_TEXT],
  '\u00D8': [KINZI, KINZI_TEXT, '\u102D'], // O stroke: kinzi with i
  '\u00D0': [KINZI, KINZI_TEXT, '\u102E'], // eth: kinzi with ii
  '\u00F8': [KINZI, KINZI_TEXT, '\u1036'], // o stroke: kinzi with anusvara

  // Medials
  's': [MARK, '\u103B'], // ya
  '\u00DF': [MARK, '\u103B'], // sharp s: ya, long
  'G': [MARK, '\u103D'], // wa
  'S': [MARK, '\u103E'], // ha
  '\u00A7': [MARK, '\u103E'], // section: ha, short
  'T': [MARK, '\u103D\u103E'], // wa with ha
  'I': [MARK, '\u103E\u102F'], // ha with u
  '\u00AA': [MARK, '\u103E\u1030'], // feminine ordinal: ha with uu
  'Q': [MARK, '\u103B\u103E'], // ya with ha
  'R': [MARK, '\u103B\u103D'], // ya with wa
  'W': [MARK, '\u103B\u103D\u103E'], // ya with wa and ha
  'j': [PRE, '\u103C'], // ra, narrow
  'M': [PRE, '\u103C'], // ra, wide
  'N': [PRE, '\u103C'], // ra, narrow, cut for an upper vowel
  'B': [PRE, '\u103C'], // ra, wide, cut for an upper vowel
  '`': [PRE, '\u103C'], // ra, narrow, cut for a lower mark
  '~': [PRE, '\u103C'], // ra, wide, cut for a lower mark
  '>': [PRE, '\u103C\u103D'], // ra, narrow, with wa
  '<': [PRE, '\u103C\u103D'], // ra, wide, with wa
  '\u00FB': [PRE, '\u103C\u102F'], // u circumflex: ra, narrow, with u
  '\u00EA': [PRE, '\u103C\u102F'], // e circumflex: ra, wide, with u

  // Stacked consonants
  '\u00FA': [STACK, '\u1039\u1000'], // u acute: ka
  '\u00A9': [STACK, '\u1039\u1001'], // copyright: kha
  '\u00BE': [STACK, '\u1039\u1002'], // three quarters: ga
  '\u00A2': [STACK, '\u1039\u1003'], // cent: gha
  '\u00F6': [STACK, '\u1039\u1005'], // o umlaut: ca
  '\u00E4': [STACK, '\u1039\u1006'], // a umlaut: cha
  '\u00C6': [STACK, '\u1039\u1007'], // AE: ja
  '\u00D1': [STACK, '\u1039\u1008'], // N tilde: jha
  '\u00B3': [STACK, '\u1039\u100B'], // superscript three: tta
  '\u00B2': [STACK, '\u1039\u100C'], // superscript two: ttha
  '\u00D6': [STACK, '\u1039\u100F'], // O umlaut: nna
  '\u00E5': [STACK, '\u1039\u1010'], // a ring: ta, wide
  '\u00C5': [STACK, '\u1039\u1010'], // A ring: ta, narrow
  '\u00AC': [STACK, '\u1039\u1011'], // not: tha, wide
  '\u00A6': [STACK, '\u1039\u1011'], // broken bar: tha, narrow
  '\u00B4': [STACK, '\u1039\u1012'], // acute: da
  '\u00A8': [STACK, '\u1039\u1013'], // diaeresis: dha
  '\u00E9': [STACK, '\u1039\u1014'], // e acute: na
  '\u00DC': [STACK, '\u1039\u1015'], // U umlaut: pa
  '\u00E6': [STACK, '\u1039\u1016'], // ae: pha
  '\u00C1': [STACK, '\u1039\u1017'], // A acute: ba
  '\u00C7': [STACK, '\u1039\u1018'], // C cedilla: bha
  '\u00AE': [STACK, '\u1039\u1019'], // registered: ma
  '\u2019': [STACK, '\u1039\u101C'], // right quote (0x92): la
  '\u00C9': [STACK, '\u1039\u1010', '\u103D'], // E acute: ta, with wa

  // Digits and Burmese punctuation. Win has no glyph for wa and types it as zero.
  '0': [BASE, '\u1040'],
  '1': [BASE, '\u1041'],
  '2': [BASE, '\u1042'],
  '3': [BASE, '\u1043'],
  '4': [BASE, '\u1044'],
  '5': [BASE, '\u1045'],
  '6': [BASE, '\u1046'],
  '7': [BASE, '\u1047'],
  '8': [BASE, '\u1048'],
  '9': [BASE, '\u1049'],
  '?': [TEXT, '\u104A'], // little section
  '/': [TEXT, '\u104B'], // section
  '\u00FC': [BASE, '\u104C'], // u umlaut: locative
  '\u00ED': [BASE, '\u104D'], // i acute: completed
  '\u00A4': [BASE, '\u104E'], // currency sign: aforementioned
  '\\': [BASE, '\u104F'], // genitive

  // Fractions. Unicode has no Burmese fraction characters.
  '\u0192': [TEXT, '\u1041/\u1042'], // 0x83
  '\u201E': [TEXT, '\u1041/\u1043'], // 0x84
  '\u2026': [TEXT, '\u1042/\u1043'], // 0x85
  '\u2020': [TEXT, '\u1041/\u1044'], // 0x86
  '\u2021': [TEXT, '\u1043/\u1044'], // 0x87
  '\u02C6': [TEXT, '\u1041/\u1045'], // 0x88
  '\u2030': [TEXT, '\u1042/\u1045'], // 0x89
  '\u0160': [TEXT, '\u1043/\u1045'], // 0x8A
  '\u2039': [TEXT, '\u1044/\u1045'], // 0x8B

  // Latin punctuation the font moves to other keys
  ']': [TEXT, '\u2018'],
  '}': [TEXT, '\u2019'],
  '^': [TEXT, '/'],
  '_': [TEXT, '\u00D7'],
  '\u00AB': [TEXT, '['],
  '\u00BB': [TEXT, ']'],
  '\u00B5': [TEXT, '!'],
  '\u03BC': [TEXT, '!'],
  '\u00BF': [TEXT, '?'],
  '\u00E7': [TEXT, ','],
  '\u00BC': [TEXT, '-'],
  '\u2010': [TEXT, '-'],
  '\u00E8': [TEXT, '_'],
  '\u00CA': [TEXT, ' '], // E circumflex: a blank glyph

  // Dingbats. The vendor logo at 0xB0 has no text and is dropped.
  '\u201A': [TEXT, '\u260E'], // 0x82 telephone
  '\u00C0': [TEXT, '\u2666'],
  '\u00C2': [TEXT, '\u2714'],
  '\u00C3': [TEXT, '\u2663'],
  '\u00C4': [TEXT, '\u2731'],
  '\u00E0': [TEXT, '\u2665'],
  '\u00E1': [TEXT, '\u27A4'],
  '\u00E2': [TEXT, '\u2718'],
  '\u00E3': [TEXT, '\u2660'],
  '\u00B6': [TEXT, '\u25C4'],
  '\u00B0': [TEXT, '']
};

// Text read as ISO-8859-1 instead of Windows-1252 has C1 controls where Windows-1252 has these characters.
const CP1252 = {
  '\u201A': '\u0082', '\u0192': '\u0083', '\u201E': '\u0084', '\u2026': '\u0085', '\u2020': '\u0086',
  '\u2021': '\u0087', '\u02C6': '\u0088', '\u2030': '\u0089', '\u0160': '\u008A', '\u2039': '\u008B',
  '\u2019': '\u0092'
};
Object.keys(CP1252).forEach(function (ch) {
  WIN[CP1252[ch]] = WIN[ch];
});

// Letters Win has no glyph for, typed as look-alike sequences. Applied before the table.
const SEQUENCES = [
  [/a[Mj]omf/g, '\u102A'], // aMomf: au (e + medial ra around sa + aa + asat)
  [/[Mj]o/g, '\u1029'], // Mo: o (medial ra around sa)
  [/p[s\u00DF]/g, '\u1008'], // ps: jha (ca + medial ya)
  [/OD/g, '\u1026'] // OD: uu (u + ii)
];

// Unicode storage order of what follows the base (Unicode Technical Note #11). Marks in the same group
// keep the order they were typed in.
const MARK_ORDER = [
  '\u103B', // medial ya
  '\u103C', // medial ra
  '\u103D', // medial wa
  '\u103E', // medial ha
  '\u1031', // e
  '\u102D\u102E\u1032', // upper vowels
  '\u102F\u1030', // lower vowels
  '\u102B\u102C', // aa
  '\u1036', // anusvara
  '\u1037', // dot below
  '\u103A', // asat
  '\u1038' // visarga
];

const ASAT = '\u103A';
// An asat typed before one of these vowel signs belongs to the consonant (see arrange).
const VOWELS_AFTER_EARLY_ASAT = '\u102B\u102C\u102F\u1030'; // aa, tall aa, u, uu

// A zero that is not next to a digit or an arithmetic sign is wa.
const ZERO_AS_WA = /(^|[^\u1040-\u1049+\-*\/])\u1040(?![\u1040-\u1049+\-*\/])/g;

const MYANMAR_LETTER = /^[\u1000-\u102A\u103F\u104C-\u104F]$/;

function rank(mark) {
  for (var i = 0; i < MARK_ORDER.length; i++) {
    if (MARK_ORDER[i].indexOf(mark) >= 0) return i;
  }
  return MARK_ORDER.length;
}

function glyphOf(ch) {
  if (has(WIN, ch)) return WIN[ch];
  // Letters made by the sequences above, and anything the table does not know.
  return [MYANMAR_LETTER.test(ch) ? BASE : TEXT, ch];
}

// Each glyph as Unicode characters, still in the order it was typed. For debugging only.
function glyphs(content) {
  var out = '';
  for (var i = 0; i < content.length; i++) {
    var glyph = glyphOf(content[i]);
    out += glyph[1] + (glyph[2] || '');
  }
  return out;
}

// Writes each syllable in Unicode order: kinzi, base, stacked consonants, then the marks by MARK_ORDER.
function arrange(content) {
  var out = '';
  var syllable = null;
  var pending = ''; // e and medial ra waiting for the base they are drawn around

  function close() {
    if (!syllable) return;
    var marks = [];
    syllable.marks.forEach(function (mark) {
      if (marks.indexOf(mark) < 0) marks.push(mark); // a mark typed twice counts once
    });
    // Asat typed before a vowel sign kills the consonant itself, as in yauk-kya (man) and kyun-up (I), and
    // is stored right after it. Otherwise it follows the vowel, as in kyaw.
    var asat = marks.indexOf(ASAT);
    var early = asat >= 0 && marks.slice(asat + 1).some(function (mark) { return VOWELS_AFTER_EARLY_ASAT.indexOf(mark) >= 0; });
    if (early) marks.splice(asat, 1);
    marks.sort(function (a, b) { return rank(a) - rank(b); });
    out += syllable.kinzi + syllable.base + (early ? ASAT : '') + syllable.stack + marks.join('');
    syllable = null;
  }

  for (var i = 0; i < content.length; i++) {
    var glyph = glyphOf(content[i]);
    var role = glyph[0];
    var text = glyph[1];
    var extra = glyph[2] || '';
    if (role === BASE) {
      close();
      syllable = { kinzi: '', base: text, stack: '', marks: pending.split('') };
      pending = '';
    } else if (role === PRE) {
      close();
      pending += text;
    } else if (syllable && role !== TEXT) {
      if (role === STACK) syllable.stack += text;
      if (role === KINZI) syllable.kinzi = text;
      var marks = (role === MARK ? text : '') + extra;
      for (var m = 0; m < marks.length; m++) syllable.marks.push(marks[m]);
    } else {
      // Text, or a mark with no base before it: written as it is.
      close();
      out += pending + text + extra;
      pending = '';
    }
  }
  close();
  return out + pending;
}

// Win -> Unicode. With debug, returns { matched_patterns, steps } like fontConvert.debugging.
function toUnicode(content, debug) {
  var steps = [content];
  var patterns = [];
  function step(name, text) {
    if (text !== steps[steps.length - 1]) {
      patterns.push(name);
      steps.push(text);
    }
    return text;
  }

  var text = content;
  for (var s = 0; s < SEQUENCES.length; s++) {
    text = text.replace(SEQUENCES[s][0], SEQUENCES[s][1]);
  }
  text = step('sequences', text);
  if (debug) step('glyphs', glyphs(text));
  var result = step('syllables', arrange(text));
  result = step('zero as wa', result.replace(ZERO_AS_WA, '$1\u101D'));
  result = step('NFC', result.normalize('NFC'));
  return debug ? { matched_patterns: patterns, steps: steps } : result;
}

module.exports = {
  toUnicode: toUnicode,
  // For scripts/eval/win-glyphs.mjs, which draws the table for review.
  tables: { WIN: WIN, SEQUENCES: SEQUENCES, ROLES: { BASE: BASE, PRE: PRE, MARK: MARK, STACK: STACK, KINZI: KINZI, TEXT: TEXT } }
};
