'use strict';
// Puts text from a visual-order font (Zawgyi, Win) into Unicode storage order.
//
// These fonts store text in the order the glyphs are drawn: e and medial ra before the consonant, kinzi and
// stacked consonants after it, and the marks in any order. Each font module has a table from its code
// points to Unicode text, with the role each glyph plays in a syllable. This module writes each syllable in
// the storage order of Unicode Technical Note #11 (version 4): kinzi, consonant, stacked consonant, asat that
// sits on the consonant, medials, e, vowels, anusvara, dot below, asat, visarga.

const typingFixes = require('./typingFixes');
const nfc = require('./nfc');
// Roles of a glyph in a syllable.
const BASE = 'base'; // consonant, independent vowel, digit or symbol: starts a syllable
const PRE = 'pre'; // drawn before the consonant (e, medial ra): belongs to the next base
const MARK = 'mark'; // medial, vowel sign or tone
const STACK = 'stack'; // stacked consonant under the base
const KINZI = 'kinzi'; // kinzi, drawn over the base and stored before it
const TEXT = 'text'; // anything else: ends the syllable

// Order of the marks after the base. Marks in the same group keep the order they were typed in.
const MARK_ORDER = [
  '\u103B', // medial ya
  '\u103C', // medial ra
  '\u103D', // medial wa
  '\u103E', // medial ha
  '\u1031', // e
  '\u102D\u102E', // i, ii
  '\u102F\u1030', // lower vowels
  '\u102B\u102C', // aa
  '\u1032\u1036', // ai and anusvara: after a lower vowel or aa, as Mon and Pa'o write them (UTN #11)
  '\u1037', // dot below
  '\u103A', // asat
  '\u1038' // visarga
];

const LAST_MEDIAL = 3; // MARK_ORDER index of medial ha
const LOWER_RANK = 6; // MARK_ORDER index of the lower vowels
const AI_ANUSVARA = 8; // MARK_ORDER index of ai and anusvara
const FIRST_VOWEL = 5; // MARK_ORDER index of i and ii: vowels and finals from here on
const ASAT = '\u103A';
const VIRAMA = '\u1039';
const AA_TALL = '\u102B';
const AA_SHORT = '\u102C';
const ANUSVARA = '\u1036';
const MEDIAL_YA = '\u103B';
const MEDIAL_HA = '\u103E';
const CA = '\u1005';
const JHA = '\u1008';
const U = '\u1025';
const NYA = '\u1009';
const SEVEN = '\u1047';
const RA = '\u101B';

const DIGIT = /[\u1040-\u1049]/;
const NEXT_TO_ZERO_IN_NUMBER = /[\u1040-\u1049+\-*\/]/;
const DECIMAL_POINT = /[.,]/;

// MARK_ORDER index of each mark. Read with a plain lookup: its keys are single characters, which never name
// an Object.prototype property.
const RANKS = []; // scratch for order's sort
const RANK = {};
MARK_ORDER.forEach(function (group, index) {
  for (var i = 0; i < group.length; i++) RANK[group[i]] = index;
});

function rank(mark) {
  var index = RANK[mark];
  return index === undefined ? MARK_ORDER.length : index;
}

// order keeps the ranks of a syllable's marks in one number, with the bit 1 << rank for each, and tests that
// number instead of searching the marks. Each mark it looks for has a rank of its own, or shares it only with
// marks it looks for along with it (i and ii, the lower vowels, aa and tall aa). The ranks are written out as
// numbers, so that the build holds each bit as a constant; test/unit/mark-ranks.test.js checks them against
// MARK_ORDER.
const MEDIAL_YA_BIT = 1 << 0;
const MEDIAL_BITS = 1 << 0 | 1 << 1 | 1 << 2 | 1 << 3; // medial ya, ra, wa and ha
const MEDIAL_HA_BIT = 1 << 3;
const E_AA_BITS = 1 << 4 | 1 << 7; // e, aa, tall aa
const I_BIT = 1 << 5; // i, ii
const LOWER_VOWEL_BIT = 1 << 6;
const AA_BIT = 1 << 7; // aa, tall aa
const DOT_BELOW_BIT = 1 << 9;
const ASAT_BIT = 1 << 10;
const VISARGA_BIT = 1 << 11;

// Whether e or aa was typed before the mark at `end`. The order the marks were typed in counts here, so this
// reads them one by one.
function isEOrAaBefore(marks, end) {
  for (var i = 0; i < end; i++) {
    if ((1 << rank(marks[i])) & E_AA_BITS) return true;
  }
  return false;
}

// Consonants, independent vowels and the symbols that take marks like letters.
function isMyanmarLetter(code) {
  return (code >= 0x1000 && code <= 0x102A) || code === 0x103F || (code >= 0x104C && code <= 0x104F);
}

// A space typed between a syllable and its next mark only moved the mark. Zero-width spaces and joiners
// mark word breaks, so they stay, but after the syllable they were typed in.
function isSpace(code) {
  return code === 0x20 || code === 0xA0;
}

function isZeroWidth(code) {
  return code === 0x200B || code === 0x200C || code === 0x200D || code === 0x2060 || code === 0xFEFF;
}

// A syllable in Unicode order, from its parts in the order they were typed.
function order(syllable) {
  var base = syllable.base;
  var stack = syllable.stack;
  if (!syllable.marks.length && !stack) return syllable.kinzi + base;
  var stacked = stack !== '' || base.indexOf(VIRAMA) > 0; // a ligature base such as tta + ttha has one too
  var marks = [];
  // The bit 1 << rank of each mark typed. Taking asat or medial ya out of marks below leaves it as it is, so
  // the one later test for either, asat for u, reads marks. The flags read from it below (hasAa, dotBelow,
  // slip, lower) may hold a bit rather than true; each is only tested for truth.
  var rankBits = 0;
  for (var m = 0; m < syllable.marks.length; m++) {
    var typed = syllable.marks[m];
    var bit = 1 << rank(typed);
    // A mark typed twice counts once. It can be there already only if a mark of its rank is.
    if (!(rankBits & bit) || marks.indexOf(typed) < 0) {
      marks.push(typed);
      rankBits |= bit;
    }
  }

  // Where the asat goes (Unicode Technical Note #11). It is stored last when typed after e or aa (kyaw), and
  // with a dot below. Otherwise it sits on the consonant and is stored right after it, before the medials and
  // vowels, as in kyun-up (I) and loanword finals like -ch, or after the medials with medial ha. Typed before
  // aa, it still comes last unless a medial makes a contraction, as in yauk-kya (man).
  // Asat never goes with i or ii, or on a stacked consonant: there it is a slip, typed early for the next
  // consonant's asat, and is dropped.
  var early = false;
  var afterMedials = false;
  var hasAa = rankBits & AA_BIT;
  if (rankBits & ASAT_BIT) {
    var asat = marks.indexOf(ASAT);
    var dotBelow = rankBits & DOT_BELOW_BIT;
    var slip = !hasAa && ((rankBits & I_BIT) || (stacked && !dotBelow));
    var last = dotBelow || isEOrAaBefore(marks, asat) || (hasAa && !(rankBits & MEDIAL_BITS));
    if (slip) {
      marks.splice(asat, 1);
    } else if (!last) {
      marks.splice(asat, 1);
      if (rankBits & MEDIAL_HA_BIT) afterMedials = true;
      else early = true;
    }
  }

  // Letters the fonts draw alike.
  var ya = (rankBits & MEDIAL_YA_BIT) ? marks.indexOf(MEDIAL_YA) : -1;
  if (ya >= 0 && stack.slice(-1) === CA) {
    stack = stack.slice(0, -1) + JHA; // stacked ca with medial ya is stacked jha
    marks.splice(ya, 1);
  } else if (ya >= 0 && base === CA && !stack) {
    base = JHA; // ca with medial ya is jha
    marks.splice(ya, 1);
  }
  if (base === U && !syllable.keepU && (stacked || early || afterMedials || marks.indexOf(ASAT) >= 0 || hasAa)) {
    base = NYA; // the vowel u never takes a stacked consonant, asat or aa: it is nya
  }
  var marksBesidesVisarga = marks.length - ((rankBits & VISARGA_BIT) ? 1 : 0);
  if (base === SEVEN && (early || afterMedials || marksBesidesVisarga > 0)) {
    base = RA; // a digit takes no vowel sign or medial: seven is ra. After digits, visarga is a colon (7:30).
  }

  // ai and anusvara come after a lower vowel and aa. With no lower vowel, either can also be typed before aa
  // to sit on the consonant, as Mon and Karen write it (khr-anusvara-aa, Christ): it stays there, except
  // anusvara before tall aa, which UTN #11 does not allow.
  var lower = rankBits & LOWER_VOWEL_BIT;
  var ranks = RANKS; // reused: order never runs inside itself
  for (var r = 0; r < marks.length; r++) {
    var markRank = rank(marks[r]);
    if (markRank === AI_ANUSVARA && !lower) {
      var aa = marks.indexOf(AA_SHORT) >= 0 ? marks.indexOf(AA_SHORT) : marks.indexOf(AA_TALL);
      var beforeAa = aa > r && !(marks[r] === ANUSVARA && marks[aa] === AA_TALL);
      if (beforeAa) markRank = LOWER_RANK;
    }
    ranks[r] = markRank;
  }
  // Insertion sort in place: stable, and syllables have few marks.
  for (var n = 1; n < marks.length; n++) {
    var mark = marks[n];
    var markRankN = ranks[n];
    var at = n - 1;
    while (at >= 0 && ranks[at] > markRankN) {
      marks[at + 1] = marks[at];
      ranks[at + 1] = ranks[at];
      at--;
    }
    marks[at + 1] = mark;
    ranks[at + 1] = markRankN;
  }
  var sorted = marks;
  if (afterMedials) {
    var medials = 0;
    while (medials < sorted.length && rank(sorted[medials]) <= LAST_MEDIAL) medials++;
    sorted.splice(medials, 0, ASAT);
  }
  return syllable.kinzi + base + stack + (early ? ASAT : '') + sorted.join('');
}

function glyph(role, text, extra) {
  return {
    role: role,
    text: text,
    extra: extra,
    // The characters that join the syllable's marks (for e and medial ra, the next syllable's).
    marks: ((role === MARK || role === PRE ? text : '') + extra).split('')
  };
}

// A font for toUnicode. `table` maps the font's characters to [role, Unicode text, marks that come with it];
// `sequences` are [pattern, replacement] pairs applied first, for letters the font types as look-alike
// sequences. The glyphs are an array indexed by character code, with null where there is no glyph: reading it
// is faster than a Map's get. It ends at the highest code with a glyph (U+1097 for Zawgyi, U+2039 for Win).
function font(table, sequences) {
  var chars = Object.keys(table);
  var length = 0x1050; // the Myanmar letters added below
  chars.forEach(function (ch) {
    length = Math.max(length, ch.charCodeAt(0) + 1);
  });
  var glyphs = new Array(length).fill(null);
  chars.forEach(function (ch) {
    var entry = table[ch];
    glyphs[ch.charCodeAt(0)] = glyph(entry[0], entry[1], entry[2] || '');
  });
  // Myanmar letters the table does not list, such as letters the sequences make, are bases as they are.
  for (var code = 0x1000; code <= 0x104F; code++) {
    if (glyphs[code] === null && isMyanmarLetter(code)) glyphs[code] = glyph(BASE, String.fromCharCode(code), '');
  }
  return { glyphs: glyphs, sequences: sequences };
}

// The glyph for a character code, or null.
function glyphAt(glyphs, code) {
  return code < glyphs.length ? glyphs[code] : null;
}

// Writes each syllable of `content` in Unicode order.
function arrange(content, glyphs) {
  var out = '';
  var syllable = null;
  var pending = []; // e and medial ra waiting for the base they are drawn around

  function close() {
    if (!syllable) return;
    out += order(syllable) + syllable.after;
    syllable = null;
  }

  // Text that ends the syllable, after any e or medial ra that found no base.
  function write(text) {
    close();
    out += pending.join('') + text;
    pending = [];
  }

  for (var i = 0; i < content.length; i++) {
    var code = content.charCodeAt(i);
    var zeroWidth = isZeroWidth(code);
    if (syllable && (zeroWidth || isSpace(code))) {
      // Held until the next glyph shows whether the syllable goes on.
      syllable.after += content.charAt(i);
      if (zeroWidth) syllable.kept += content.charAt(i);
      continue;
    }
    if (zeroWidth) {
      out += content.charAt(i); // before the syllable that any pending e or medial ra belong to
      continue;
    }

    var g = glyphAt(glyphs, code);
    if (g === null) {
      write(content.charAt(i));
    } else if (g.role === BASE) {
      close();
      syllable = { kinzi: '', base: g.text, stack: '', marks: pending, after: '', kept: '' };
      pending = [];
    } else if (g.role === PRE) {
      close();
      for (var p = 0; p < g.marks.length; p++) pending.push(g.marks[p]);
    } else if (syllable && g.role !== TEXT) {
      syllable.after = syllable.kept; // the syllable goes on: drop the spaces, keep the zero-width characters
      if (g.role === STACK) syllable.stack += g.text;
      if (g.role === KINZI) syllable.kinzi = g.text;
      for (var m = 0; m < g.marks.length; m++) syllable.marks.push(g.marks[m]);
    } else {
      write(g.text + g.extra); // text, or a mark with no base before it: written as it is
    }
  }
  close();
  return out + pending.join('');
}

// One-character strings for U+1000-U+109F, made once: marks read from text with charAt are new strings each
// time, and are slower to look up in RANK.
const MYANMAR_CHARS = [];
for (var c = 0x1000; c <= 0x109F; c++) MYANMAR_CHARS.push(String.fromCharCode(c));

function isConsonant(code) {
  return code >= 0x1000 && code <= 0x1021;
}

// The Burmese marks that follow a consonant in Unicode text: vowel signs, e, anusvara, dot below, visarga,
// asat and medials. Mon vowel signs (U+1033-U+1035) are left where they are.
function isUnicodeMark(code) {
  return (code >= 0x102B && code <= 0x1032) || (code >= 0x1036 && code <= 0x1038) || (code >= 0x103A && code <= 0x103E);
}

// Kinzi at i: nga (or ra, as Sanskrit repha), asat and virama, before the consonant it sits on.
function isKinziAt(content, i) {
  var code = content.charCodeAt(i);
  return (code === 0x1004 || code === 0x101B) && content.charCodeAt(i + 1) === 0x103A &&
    content.charCodeAt(i + 2) === 0x1039 && isConsonant(content.charCodeAt(i + 3));
}

function isDigit(code) {
  return code >= 0x1040 && code <= 0x1049;
}

// A letter or mark of the Myanmar blocks that arrangeUnicode does not read as Burmese, such as the Mon, Shan
// and Karen letters, medials and tones. Burmese letters, marks, digits and punctuation are not.
function isOtherMyanmar(code) {
  var inBlocks = (code >= 0x1000 && code <= 0x109F) || (code >= 0xA9E0 && code <= 0xA9FF) || (code >= 0xAA60 && code <= 0xAA7F);
  return inBlocks && !isMyanmarLetter(code) && !isDigit(code) && !isUnicodeMark(code) && code !== 0x1039 &&
    code !== 0x104A && code !== 0x104B;
}

// e and medial ra, which people used to Zawgyi type before the consonant.
function isTypedFirst(code) {
  return code === 0x1031 || code === 0x103C;
}

const HERE = 'here';
const NEXT = 'next';
const ALONE = 'alone';

// Writes each syllable of Unicode text in Unicode order, with the same rules as arrange. Unicode text is
// already in logical order: kinzi comes before the consonant it sits on, a stacked consonant (virama and
// consonant) after it, and e and medial ra after it with the other marks. So mostly only the marks need
// sorting. Two habits from Zawgyi typing are undone:
// - e or medial ra typed before the consonant that follows it. That is how it reads after a space or at the
//   start, or after a syllable that already has its vowel or final: the e in "lae: e-kaung:" (also) belongs
//   to "kaung:". With no consonant after it, such an e or medial ra belongs to neither and stays as typed.
// - a space typed before a mark of the syllable, which is dropped as in arrange. e and medial ra never go
//   back across a space, and digits take no marks from across one.
function arrangeUnicode(content) {
  var out = '';
  var syllable = null;
  var pending = []; // e and medial ra typed before their consonant
  var runEnd = 0; // end of the last run of e and medial ra placeTypedFirst looked past, so it reads each once
  // What placeTypedFirst has learned about the open syllable's marks. Marks are only ever added, so it reads
  // each one once (marks[0..seen)), and a long run of marks on one consonant stays linear.
  var seen = 0, hasMedialHa = false, hasAsat = false, hasVowel = false;

  function close() {
    if (!syllable) return;
    out += order(syllable) + syllable.after;
    syllable = null;
  }

  // keepU: u right after a vowel sign starts a syllable of its own, as in Pa'o lae-u-asat-visarga, and stays
  // u. Right after a consonant or medial it is typed for nya (nya-u-dot-asat, night), and order makes it nya.
  function start(kinzi, base, keepU) {
    close();
    syllable = { kinzi: kinzi, base: base, stack: '', marks: pending, after: '', kept: '', keepU: keepU };
    seen = 0;
    hasMedialHa = hasAsat = hasVowel = false;
    pending = [];
  }

  // Text that ends the syllable, after any e or medial ra that found no consonant.
  function write(text) {
    close();
    out += pending.join('') + text;
    pending = [];
  }

  // Whether the mark (or virama) at i belongs to the open syllable, past any spaces held after it.
  function goesOn(code) {
    // Nothing but zero-width characters held. kept is always a subsequence of after, so equal lengths mean
    // equal strings, and comparing lengths keeps this constant-time.
    if (syllable.after.length === syllable.kept.length) return true;
    return !isTypedFirst(code) && !isDigit(syllable.base.charCodeAt(0));
  }

  // Where the e or medial ra at i goes: to the open syllable (HERE), the consonant after it (NEXT), or
  // nowhere (ALONE). It goes to the open syllable unless that syllable is finished (it has a vowel or final;
  // an asat alone still takes a medial ra, as in kh-asat-ya, and an asat after medial ha, Mon's final h,
  // still takes e) and no mark of it follows. Right after a letter or mark of another Myanmar-script
  // language, it stays where it is: those syllables are not read here.
  function placeTypedFirst(i) {
    var code = content.charCodeAt(i);
    if (i >= runEnd) {
      runEnd = i + 1;
      while (isTypedFirst(content.charCodeAt(runEnd))) runEnd++;
    }
    var after = content.charCodeAt(runEnd);
    if (!syllable && isOtherMyanmar(content.charCodeAt(i - 1))) return ALONE;
    var finished = !syllable || syllable.after.length !== syllable.kept.length;
    if (!finished) {
      for (var marks = syllable.marks; seen < marks.length; seen++) {
        var mark = marks[seen];
        if (mark === MEDIAL_HA) hasMedialHa = true;
        if (rank(mark) < FIRST_VOWEL) continue;
        if (mark === ASAT) hasAsat = true;
        else hasVowel = true;
      }
      finished = hasVowel || (hasAsat && code !== 0x103C && !hasMedialHa);
    }
    if (!finished || (syllable && (isUnicodeMark(after) || after === 0x1039))) return HERE;
    return isMyanmarLetter(after) || isDigit(after) ? NEXT : ALONE;
  }

  // The stacked consonant at the virama at i, past any e or medial ra typed before it, or -1.
  function stackedAt(i) {
    var next = i + 1;
    while (isTypedFirst(content.charCodeAt(next))) next++;
    return isConsonant(content.charCodeAt(next)) ? next : -1;
  }

  for (var i = 0; i < content.length; i++) {
    var code = content.charCodeAt(i);
    // Zero-width spaces move out of a syllable as in arrange, but joiners and non-joiners stay where they
    // are: in Unicode text they can be there on purpose, to shape the syllable.
    var zeroWidth = isZeroWidth(code) && code !== 0x200C && code !== 0x200D;
    var place = isTypedFirst(code) ? placeTypedFirst(i) : HERE;
    if (syllable && (zeroWidth || isSpace(code))) {
      // Held until the next character shows whether the syllable goes on.
      syllable.after += content.charAt(i);
      if (zeroWidth) syllable.kept += content.charAt(i);
    } else if (isKinziAt(content, i)) {
      start(content.slice(i, i + 3), content.charAt(i + 3));
      i += 3;
    } else if (isMyanmarLetter(code) || isDigit(code)) {
      // Digits too: zero and seven are typed for wa and ra.
      var previous = content.charCodeAt(i - 1);
      var afterVowel = (previous >= 0x102B && previous <= 0x1032) || previous === 0x1036;
      start('', content.charAt(i), code === 0x1025 && afterVowel);
    } else if (place === NEXT) {
      close();
      pending.push(MYANMAR_CHARS[code - 0x1000]);
    } else if (place === ALONE) {
      write(content.charAt(i));
    } else if (syllable && code === 0x1039 && stackedAt(i) >= 0 && goesOn(code)) {
      var stacked = stackedAt(i);
      syllable.after = syllable.kept;
      for (var t = i + 1; t < stacked; t++) syllable.marks.push(MYANMAR_CHARS[content.charCodeAt(t) - 0x1000]);
      syllable.stack += '\u1039' + content.charAt(stacked);
      i = stacked;
    } else if (syllable && isUnicodeMark(code) && goesOn(code)) {
      syllable.after = syllable.kept; // the syllable goes on: drop the spaces, keep the zero-width characters
      syllable.marks.push(MYANMAR_CHARS[code - 0x1000]);
    } else {
      write(content.charAt(i));
    }
  }
  close();
  return out + pending.join('');
}

// Each glyph as Unicode characters, still in the order it was typed. For debugging only.
function glyphsInTypedOrder(content, glyphs) {
  var out = '';
  for (var i = 0; i < content.length; i++) {
    var g = glyphAt(glyphs, content.charCodeAt(i));
    out += g === null ? content.charAt(i) : g.text + g.extra;
  }
  return out;
}

// The fonts type wa as zero. A zero next to a digit or an arithmetic sign, or across a decimal point or
// thousands separator from a digit, is a digit; any other zero is wa.
function zeroAsWa(text) {
  return text.replace(/\u1040/g, function (zero, at) {
    var before = text.charAt(at - 1);
    var after = text.charAt(at + 1);
    if (NEXT_TO_ZERO_IN_NUMBER.test(before) || NEXT_TO_ZERO_IN_NUMBER.test(after)) return zero;
    if (DECIMAL_POINT.test(before) && DIGIT.test(text.charAt(at - 2))) return zero;
    if (DECIMAL_POINT.test(after) && DIGIT.test(text.charAt(at + 2))) return zero;
    return '\u101D';
  });
}

// Font text -> Unicode: the font's look-alike sequences, then its glyphs in syllable order, zero as wa, the
// typing fixes normalize makes (typingFixes.js) and NFC. With debug, returns { matched_patterns, steps } like
// fontConvert.debugging, where each step is the text after a stage that changed it.
function toUnicode(content, font, debug) {
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
  for (var s = 0; s < font.sequences.length; s++) {
    text = text.replace(font.sequences[s][0], font.sequences[s][1]);
  }
  text = step('sequences', text);
  if (debug) step('glyphs', glyphsInTypedOrder(text, font.glyphs));
  var result = step('syllables', arrange(text, font.glyphs));
  result = step('zero as wa', zeroAsWa(result));
  result = step('look-alikes', typingFixes.lookAlikes(result));
  result = step('typos', typingFixes.typos(result));
  result = step('NFC', nfc(result));
  return debug ? { matched_patterns: patterns, steps: steps } : result;
}

module.exports = {
  ROLES: { BASE: BASE, PRE: PRE, MARK: MARK, STACK: STACK, KINZI: KINZI, TEXT: TEXT },
  font: font,
  toUnicode: toUnicode,
  arrangeUnicode: arrangeUnicode
};
