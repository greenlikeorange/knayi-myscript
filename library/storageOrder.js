// Puts text from a visual-order font (Zawgyi, Win) into Unicode storage order.
//
// These fonts store text in the order the glyphs are drawn: e and medial ra before the consonant, kinzi and
// stacked consonants after it, and the marks in any order. Each font module has a table from its code
// points to Unicode text, with the role each glyph plays in a syllable. This module writes each syllable in
// the storage order of Unicode Technical Note #11 (version 4): kinzi, consonant, stacked consonant, asat that
// sits on the consonant, medials, e, vowels, anusvara, dot below, asat, visarga.

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
  '\u102D\u102E\u1032', // upper vowels
  '\u102F\u1030', // lower vowels
  '\u102B\u102C', // aa
  '\u1036', // anusvara
  '\u1037', // dot below
  '\u103A', // asat
  '\u1038' // visarga
];

const LAST_MEDIAL = 3; // MARK_ORDER index of medial ha
const ASAT = '\u103A';
const VISARGA = '\u1038';
const AA = '\u102B\u102C'; // aa, tall aa
const I = '\u102D\u102E'; // i, ii
const DOT_BELOW = '\u1037';
const MEDIALS = '\u103B\u103C\u103D\u103E';
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
const RANK = {};
MARK_ORDER.forEach(function (group, index) {
  for (var i = 0; i < group.length; i++) RANK[group[i]] = index;
});

function rank(mark) {
  var index = RANK[mark];
  return index === undefined ? MARK_ORDER.length : index;
}

// Whether any of the first `end` marks (all of them by default) is in `set`.
function hasAny(marks, set, end) {
  var stop = end === undefined ? marks.length : end;
  for (var i = 0; i < stop; i++) {
    if (set.indexOf(marks[i]) >= 0) return true;
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
  var marks = [];
  for (var m = 0; m < syllable.marks.length; m++) {
    if (marks.indexOf(syllable.marks[m]) < 0) marks.push(syllable.marks[m]); // a mark typed twice counts once
  }

  // Where the asat goes (Unicode Technical Note #11). It is stored last after aa (kyaw) and with a dot
  // below. Otherwise it sits on the consonant and is stored right after it, before the medials and vowels,
  // as in kyun-up (I) and loanword finals like -ch, or after the medials with medial ha. Typed before aa,
  // it still comes last unless a medial makes a contraction, as in yauk-kya (man).
  // Asat never goes with i or ii, or on a stacked consonant: there it is a slip, typed early for the next
  // consonant's asat, and is dropped.
  var early = false;
  var afterMedials = false;
  var asat = marks.indexOf(ASAT);
  var hasAa = hasAny(marks, AA);
  if (asat >= 0) {
    var slip = !hasAa && hasAny(marks, I);
    var last = marks.indexOf(DOT_BELOW) >= 0 || (hasAa && (hasAny(marks, AA, asat) || !hasAny(marks, MEDIALS)));
    if (slip || !last) {
      marks.splice(asat, 1);
      if (!slip && !stack) {
        if (marks.indexOf(MEDIAL_HA) >= 0) afterMedials = true;
        else early = true;
      }
    }
  }

  // Letters the fonts draw alike.
  var ya = marks.indexOf(MEDIAL_YA);
  if (ya >= 0 && stack.slice(-1) === CA) {
    stack = stack.slice(0, -1) + JHA; // stacked ca with medial ya is stacked jha
    marks.splice(ya, 1);
  } else if (ya >= 0 && base === CA && !stack) {
    base = JHA; // ca with medial ya is jha
    marks.splice(ya, 1);
  }
  if (base === U && (stack || early || afterMedials || marks.indexOf(ASAT) >= 0 || hasAa)) {
    base = NYA; // the vowel u never takes a stacked consonant, asat or aa: it is nya
  }
  var marksBesidesVisarga = marks.length - (marks.indexOf(VISARGA) >= 0 ? 1 : 0);
  if (base === SEVEN && (early || afterMedials || marksBesidesVisarga > 0)) {
    base = RA; // a digit takes no vowel sign or medial: seven is ra. After digits, visarga is a colon (7:30).
  }

  var sorted = []; // insertion sort: stable, and syllables have few marks
  for (var n = 0; n < marks.length; n++) {
    var at = sorted.length;
    while (at > 0 && rank(sorted[at - 1]) > rank(marks[n])) at--;
    sorted.splice(at, 0, marks[n]);
  }
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
// sequences. The glyphs are keyed by character code, which is faster to look up than a character.
function font(table, sequences) {
  var glyphs = new Map();
  Object.keys(table).forEach(function (ch) {
    var entry = table[ch];
    glyphs.set(ch.charCodeAt(0), glyph(entry[0], entry[1], entry[2] || ''));
  });
  // Myanmar letters the table does not list, such as letters the sequences make, are bases as they are.
  for (var code = 0x1000; code <= 0x104F; code++) {
    if (!glyphs.has(code) && isMyanmarLetter(code)) glyphs.set(code, glyph(BASE, String.fromCharCode(code), ''));
  }
  return { glyphs: glyphs, sequences: sequences };
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

    var g = glyphs.get(code);
    if (g === undefined) {
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

// Each glyph as Unicode characters, still in the order it was typed. For debugging only.
function glyphsInTypedOrder(content, glyphs) {
  var out = '';
  for (var i = 0; i < content.length; i++) {
    var g = glyphs.get(content.charCodeAt(i));
    out += g === undefined ? content.charAt(i) : g.text + g.extra;
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

// Font text -> Unicode: the font's look-alike sequences, then its glyphs in syllable order, zero as wa and
// NFC. With debug, returns { matched_patterns, steps } like fontConvert.debugging, where each step is the
// text after a stage that changed it.
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
  result = step('NFC', result.normalize('NFC'));
  return debug ? { matched_patterns: patterns, steps: steps } : result;
}

module.exports = {
  ROLES: { BASE: BASE, PRE: PRE, MARK: MARK, STACK: STACK, KINZI: KINZI, TEXT: TEXT },
  font: font,
  toUnicode: toUnicode
};
