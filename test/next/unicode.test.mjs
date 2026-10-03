// Which Unicode version the tables of src/script/codes.js match (docs/next/DESIGN.md §2.3, decision 20c). The
// method is test/unicode.test.js's at the reference, KNOWN table included, pointed at the codes.js functions
// that replace the 2.x classes. It reads the runtime's Unicode data with \p{...} property escapes.
//
// codes.js states "The tables match Unicode 15.1, as library/ does." They cover every Myanmar-script code point
// of 15.1 (U+1000-U+109F, U+A9E0-U+A9FE, U+AA60-U+AA7F), apart from the narrower classes listed in KNOWN.
// Unicode 16.0 added Myanmar Extended-C, U+116D0-U+116E3 (Pa'o and Eastern Pwo Karen digits); 17.0 added no
// Myanmar code points. The tables classify only UTF-16 units, so Extended-C stays KNOWN until 3.0 reads code
// points (decision 20b). CI's Node 24 has Unicode 16.0 and its Node 26 has 17.0, so both see it; a runtime with
// Unicode 15.1 simply has fewer code points.
//
// Each check compares one set from the runtime's Unicode data with the tables that should classify it. It fails
// when the runtime has a code point that those tables leave out and KNOWN does not list: a new Unicode version
// the tables have not caught up with. A KNOWN code point that the tables now classify fails too, so the list
// shrinks as the gaps close.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLS, CP, classOf, isMyanmarBlock, isMyanmarScript, isSyllableBase, isScriptConsonant, isBurmeseMark,
  isScriptMark, isScriptTone, isBurmeseDigit, isScriptDigit
} from '../../src/script/codes.js';
import { ranges, srcText } from './helpers.mjs';

// A table function on a code point: false above U+FFFF, which the tables never classify.
function unit(test) {
  return (cp) => cp <= 0xFFFF && test(cp);
}

const TABLES = {
  // The Burmese reader's classes: every unit of the three blocks has one besides OTHER.
  classes: unit((code) => classOf(code) !== CLS.OTHER),
  // The 2.x text gate, which every compat function checks first: is there any Myanmar text?
  block: unit(isMyanmarBlock),
  // The no-Myanmar fast path of normalize.
  script: unit(isMyanmarScript),
  letters: unit((code) => isSyllableBase(code) || isScriptConsonant(code)),
  marks: unit((code) => isBurmeseMark(code) || code === CP.VIRAMA || isScriptMark(code) || isScriptTone(code)),
  digits: unit((code) => isBurmeseDigit(code) || isScriptDigit(code))
};

// Code points a table leaves out today, as [first, last] ranges: exactly those left out on Node 26.5 (Unicode
// 17.0), checked against the 2.x definitions that codes.test.mjs maps to these functions.
const EXTENDED_C = [0x116D0, 0x116E3]; // Unicode 16.0: Pa'o digits U+116D0-U+116D9, Eastern Pwo Karen U+116DA-U+116E3
const KNOWN = {
  classes: [EXTENDED_C],
  // contentGate.js's MYANMAR is U+1000-U+109F only, so text in Myanmar Extended-B (Shan, Tai Laing) or Extended-A
  // (Khamti Shan, Aiton and Phake) alone is not Myanmar text to the 2.x API (DESIGN.md C8).
  block: [[0xA9E0, 0xA9FE], [0xAA60, 0xAA7F], EXTENDED_C],
  script: [EXTENDED_C],
  // The Pali vocalic letters r, rr, l and ll (U+1052-U+1055) are independent vowels that the letter classes
  // leave out, so the reader reads them as another language's letters. U+A9E6, the Shan reduplication sign, is a
  // modifier letter rather than a consonant, and the script consonants skip it. All five are script word
  // characters (isScriptWordChar).
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

const matches = (re) => (cp) => re.test(String.fromCodePoint(cp));
const RUNTIME = {
  script: MYANMAR.filter(matches(SCRIPT)),
  letters: MYANMAR.filter(matches(/^\p{L}$/u)),
  marks: MYANMAR.filter(matches(/^\p{M}$/u)),
  digits: MYANMAR.filter(matches(/^\p{Nd}$/u))
};

const RUNTIME_NAME = (typeof Bun !== 'undefined' ? 'Bun ' + Bun.version : 'Node ' + process.version) +
  ' (Unicode ' + (process.versions.unicode || 'unknown') + ')';

function expand(rangeList) {
  const list = [];
  for (const [first, last] of rangeList) for (let cp = first; cp <= last; cp++) list.push(cp);
  return list;
}

function compare(runtimeName, runtimeSet, tableName) {
  const classified = TABLES[tableName];
  const known = new Set(expand(KNOWN[tableName]));
  const missing = runtimeSet.filter((cp) => !classified(cp) && !known.has(cp));
  assert.equal(ranges(missing), '',
    RUNTIME_NAME + ' has ' + missing.length + ' ' + runtimeName + ' code points that the ' + tableName +
    ' tables do not classify: ' + ranges(missing) + '. Add them to src/script/codes.js, or list them in KNOWN ' +
    'with why.');
  const closed = [...known].filter(classified);
  assert.equal(ranges(closed), '', 'The ' + tableName + ' tables classify ' + ranges(closed) +
    ' now: remove them from KNOWN.' + tableName);
}

describe('Unicode version of src/script/codes.js', () => {
  it('states the version it matches', () => {
    assert.match(srcText('script/codes.js'), /^\/\/ The tables match Unicode 15\.1, as library\/ does\./m);
  });

  it('finds Script=Myanmar code points', () => {
    assert.ok(RUNTIME.script.length >= 223, RUNTIME_NAME + ' has only ' + RUNTIME.script.length);
  });

  it('every Script=Myanmar code point has a class besides OTHER', () => {
    compare('Script=Myanmar', RUNTIME.script, 'classes');
  });

  it('every Script=Myanmar code point of the Myanmar block passes the 2.x text gate', () => {
    compare('Script=Myanmar', RUNTIME.script, 'block');
  });

  it('every Script=Myanmar code point takes normalize off its no-Myanmar fast path', () => {
    compare('Script=Myanmar', RUNTIME.script, 'script');
  });

  it('every letter (\\p{L}) of the Myanmar blocks is a syllable base or a script consonant', () => {
    compare('letter', RUNTIME.letters, 'letters');
  });

  it('every mark (\\p{M}) of the Myanmar blocks is a Burmese mark, virama, script mark or script tone', () => {
    compare('mark', RUNTIME.marks, 'marks');
  });

  it('every digit (\\p{Nd}) of the Myanmar blocks is a Burmese or script digit', () => {
    compare('digit', RUNTIME.digits, 'digits');
  });
});
