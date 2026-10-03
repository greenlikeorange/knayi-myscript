const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Which Unicode version the character tables match. The tables are hand-written code point ranges in
// library/storageOrder.js, typingFixes.js, syllable.js and contentGate.js (which fontDetect in detector.js and
// every other public function use to find Myanmar text). This test reads the runtime's Unicode data with
// \p{...} property escapes, so it runs in Node only.
//
// Unicode version: the tables match Unicode 15.1. They cover every Myanmar-script code point of 15.1
// (U+1000-U+109F, U+A9E0-U+A9FE, U+AA60-U+AA7F), apart from the narrower classes listed in KNOWN. Unicode 16.0
// added Myanmar Extended-C, U+116D0-U+116E3 (Pa'o and Eastern Pwo Karen digits), which no table has; 17.0
// added no Myanmar code points. Checked on Node 18.20 (Unicode 15.1), 24.12 (16.0) and 26.5 (17.0).
//
// Each check compares one set from the runtime's Unicode data with the tables that should classify it, and
// fails when the runtime has a code point that those tables leave out and KNOWN does not list: a new Unicode
// version the tables have not caught up with. A KNOWN code point that the tables now classify fails too, so
// the list shrinks as the gaps close. A runtime with an older Unicode version simply has fewer code points.

const LIBRARY = path.join(__dirname, '..', 'library');

// The named top-level bindings of a library file, which it does not export. The file runs again in a
// separate module scope with an export line appended; the library itself is not changed.
function internals(file, names) {
  const filename = path.join(LIBRARY, file);
  const exported = names.map((name) => name + ': typeof ' + name + " === 'undefined' ? undefined : " + name);
  const source = fs.readFileSync(filename, 'utf8') + '\nmodule.exports = { ' + exported.join(', ') + ' };\n';
  const wrapper = vm.runInThisContext('(function (exports, require, module, __filename, __dirname) {' + source +
    '\n})', { filename });
  const module = { exports: {} };
  wrapper.call(module.exports, module.exports, createRequire(filename), module, filename, path.dirname(filename));
  for (const name of names) {
    assert.notEqual(module.exports[name], undefined,
      'library/' + file + ' no longer defines ' + name + ': point test/unicode.test.js at the class that replaced it');
  }
  return module.exports;
}

const storageOrder = internals('storageOrder.js', ['isMyanmarLetter', 'isUnicodeMark', 'isDigit', 'isOtherMyanmar']);
const typingFixes = internals('typingFixes.js', ['MARK', 'TONE', 'CONSONANT', 'ANY_DIGIT']);
const syllable = internals('syllable.js', ['C', 'M', 'V', 'S', 'A', 'F']);
const gate = require('../library/contentGate');

const VIRAMA = 0x1039;
const SECTION_MARKS = [0x104A, 0x104B];

function inString(list) {
  return (cp) => cp <= 0xFFFF && list.indexOf(String.fromCharCode(cp)) >= 0;
}

function bmp(test) {
  return (cp) => cp <= 0xFFFF && test(cp);
}

function matches(re) {
  return (cp) => re.test(String.fromCodePoint(cp));
}

// The ranges syllable.js writes as 'X-Y' inside its bracket classes.
function inClass(body) {
  const test = new RegExp('^[' + body + ']$');
  return (cp) => test.test(String.fromCodePoint(cp));
}

const TABLES = {
  // storageOrder.js reads the three Myanmar blocks it knows as Burmese letters, digits and marks, or as the
  // letters and marks of another language (isOtherMyanmar).
  blocks: (cp) => bmp((c) => storageOrder.isOtherMyanmar(c) || storageOrder.isMyanmarLetter(c) ||
    storageOrder.isDigit(c) || storageOrder.isUnicodeMark(c) || c === VIRAMA || SECTION_MARKS.includes(c))(cp),
  // What every public function checks first: is there any Myanmar text?
  text: (cp) => gate.hasMyanmar(String.fromCodePoint(cp)),
  letters: (cp) => bmp(storageOrder.isMyanmarLetter)(cp) || matches(typingFixes.CONSONANT)(cp) ||
    inClass(syllable.C)(cp),
  marks: (cp) => bmp(storageOrder.isUnicodeMark)(cp) || cp === VIRAMA || matches(typingFixes.MARK)(cp) ||
    matches(typingFixes.TONE)(cp) || inString(syllable.M + syllable.V + syllable.S + syllable.A + syllable.F)(cp),
  digits: (cp) => bmp(storageOrder.isDigit)(cp) || matches(typingFixes.ANY_DIGIT)(cp)
};

// Code points a table leaves out today, as [first, last] ranges.
const EXTENDED_C = [0x116D0, 0x116E3]; // Unicode 16.0: Pa'o digits U+116D0-U+116D9, Eastern Pwo Karen U+116DA-U+116E3
const KNOWN = {
  blocks: [EXTENDED_C],
  // contentGate.js's MYANMAR is U+1000-U+109F only, so text in Myanmar Extended-A or -B alone (Khamti Shan,
  // Aiton and Phake, Tai Laing, Shwe Palaung) is not Myanmar text: fontDetect returns 'en' or the fallback,
  // and fontConvert, syllBreak, spellingFix and truncate treat it as other text.
  text: [[0xA9E0, 0xA9FE], [0xAA60, 0xAA7F], EXTENDED_C],
  // The Pali vocalic letters r, rr, l and ll (U+1052-U+1055) are independent vowels that the letter classes
  // leave out, so arrangeUnicode reads them as another language's letters. U+A9E6, the Shan reduplication
  // sign, is a modifier letter rather than a consonant, and CONSONANTS skips it. All five are word characters
  // (typingFixes.js WORD_CHAR).
  letters: [[0x1052, 0x1055], [0xA9E6, 0xA9E6]],
  marks: [],
  digits: [EXTENDED_C]
};

// The Myanmar blocks (Blocks.txt), and any other code point the runtime gives Script=Myanmar.
const BLOCKS = [[0x1000, 0x109F], [0xA9E0, 0xA9FF], [0xAA60, 0xAA7F], [0x116D0, 0x116FF]];
const SCRIPT = /^\p{Script=Myanmar}$/u;
const MYANMAR = [];
for (let cp = 0; cp <= 0x10FFFF; cp++) {
  if (cp >= 0xD800 && cp <= 0xDFFF) continue;
  if (BLOCKS.some(([first, last]) => cp >= first && cp <= last) || SCRIPT.test(String.fromCodePoint(cp))) {
    MYANMAR.push(cp);
  }
}

const RUNTIME = {
  script: MYANMAR.filter(matches(SCRIPT)),
  letters: MYANMAR.filter(matches(/^\p{L}$/u)),
  marks: MYANMAR.filter(matches(/^\p{M}$/u)),
  digits: MYANMAR.filter(matches(/^\p{Nd}$/u))
};

function hex(cp) {
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
}

function ranges(list) {
  const out = [];
  for (const cp of list) {
    const last = out[out.length - 1];
    if (last && last[1] === cp - 1) last[1] = cp;
    else out.push([cp, cp]);
  }
  return out.map(([first, last]) => first === last ? hex(first) : hex(first) + '-' + hex(last)).join(', ');
}

function expand(rangeList) {
  const list = [];
  for (const [first, last] of rangeList) for (let cp = first; cp <= last; cp++) list.push(cp);
  return list;
}

const RUNTIME_NAME = 'Node ' + process.version + ' (Unicode ' + process.versions.unicode + ', ICU ' +
  process.versions.icu + ')';

function compare(runtimeName, runtimeSet, tableName) {
  const classified = TABLES[tableName];
  const known = new Set(expand(KNOWN[tableName]));
  const missing = runtimeSet.filter((cp) => !classified(cp) && !known.has(cp));
  assert.deepEqual(ranges(missing), '',
    RUNTIME_NAME + ' has ' + missing.length + ' ' + runtimeName + ' code points that the ' + tableName +
    ' tables do not classify: ' + ranges(missing) + '. Add them to the tables, or list them in KNOWN with why.');
  const closed = [...known].filter(classified);
  assert.deepEqual(ranges(closed), '',
    'The ' + tableName + ' tables classify ' + ranges(closed) + ' now: remove them from KNOWN.' + tableName);
}

describe('Unicode version of the character tables', () => {
  it('finds Script=Myanmar code points', () => {
    assert.ok(RUNTIME.script.length >= 223, RUNTIME_NAME + ' has only ' + RUNTIME.script.length);
  });

  it('every Script=Myanmar code point is in the Myanmar blocks the tables read', () => {
    compare('Script=Myanmar', RUNTIME.script, 'blocks');
  });

  it('every Script=Myanmar code point counts as Myanmar text', () => {
    compare('Script=Myanmar', RUNTIME.script, 'text');
  });

  it('every letter (\\p{L}) of the Myanmar blocks is a letter in the tables', () => {
    compare('letter', RUNTIME.letters, 'letters');
  });

  it('every mark (\\p{M}) of the Myanmar blocks is a mark in the tables', () => {
    compare('mark', RUNTIME.marks, 'marks');
  });

  it('every digit (\\p{Nd}) of the Myanmar blocks is a digit in the tables', () => {
    compare('digit', RUNTIME.digits, 'digits');
  });
});
