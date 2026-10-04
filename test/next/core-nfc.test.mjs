// core/nfc.js (docs/next/DESIGN.md §2.3, D20, §7.3): toNfc(text) must return exactly what text.normalize('NFC')
// returns, in linear time, with the combining classes it reads from normalize itself.
//
// These tests read the classes again, with other probe marks, for every code point the runtime knows, and check the
// helper against them: which characters it puts in runs, the order it gives every ordered pair of run characters
// (942,841 on Node 26), and its output next to every letter with marks, on long runs in several scripts, at the
// run length limit and around lone surrogates. Each test starts from a cold memo (createNfcMemo), so it meets the
// classes in an order of its own. This is the method of the 2.x helper's test (test/nfc.test.js at d170cd8).
// Random text is in core-nfc.fuzz.test.mjs, and the growth check in core-nfc.timing.mjs.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toNfc, toNfcWith, createNfcMemo, orderLongRuns } from '../../src/core/nfc.js';
import { parsedSources, walk, memberName, where } from './guards/ast.mjs';

const LONGEST = 30; // the longest run, in code units, that toNfc leaves to normalize as it is (UAX #15)

const cp = (...codes) => String.fromCodePoint(...codes);
const nfd = (text) => text.normalize('NFD');
const hex = (text) => Array.from(text, (ch) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'))
  .join(' ');

// The test's own probe marks, not the helper's (asat and dot below): U+0334, of class 1, the lowest, and U+0345,
// of class 240, the highest. A code point that does not decompose is a non-starter when canonical ordering moves
// the low one in front of the high one across it.
const LOWEST = cp(0x334);
const HIGHEST = cp(0x345);
const isNonStarter = (y) => nfd(HIGHEST + y + LOWEST) !== HIGHEST + y + LOWEST;

// Every code point the runtime knows, but the surrogates, by its canonical decomposition: all non-starters (a run
// character), or a starter with non-starters (a mixed character, such as a letter with marks).
const RUN = [];
const MIXED = [];
for (let code = 0; code <= 0x10FFFF; code++) {
  if (code === 0xD800) code = 0xE000;
  const parts = Array.from(nfd(cp(code)));
  const marks = parts.filter(isNonStarter).length;
  if (marks === parts.length) RUN.push(cp(code));
  else if (marks) MIXED.push(cp(code));
}

describe('core/nfc.js finds the combining classes of the runtime', () => {
  it('with probe marks that work', (t) => {
    assert.equal(hex(nfd(HIGHEST + LOWEST)), hex(LOWEST + HIGHEST));
    for (const code of [0x301, 0x334, 0x345, 0x1037, 0x1039, 0x103A, 0x108D, 0x344, 0xF73, 0x1D165]) {
      assert.ok(RUN.includes(cp(code)), hex(cp(code)) + ' is a run character');
    }
    for (const code of [0x41, 0x1000, 0x102C, 0x1038, 0x103B, 0x1E09, 0xAC00]) {
      assert.ok(!RUN.includes(cp(code)), hex(cp(code)) + ' is not a run character');
    }
    t.diagnostic(RUN.length + ' run characters, ' + MIXED.length + ' mixed characters');
  });

  // orderLongRuns(text, 1) puts every run longer than one code unit in canonical order. A probe mark next to a run
  // character makes such a run; next to anything else it stands alone. The code points go from the top, so the
  // classes are found in another order than in the next test.
  it('for every code point', () => {
    const memo = createNfcMemo();
    const isRun = new Set(RUN);
    const wrong = [];
    for (let code = 0x10FFFF; code >= 0; code--) {
      if (code === 0xDFFF) code = 0xD7FF;
      const x = cp(code);
      const after = x + LOWEST;
      const before = HIGHEST + x;
      if (orderLongRuns(after, 1, memo) !== (isRun.has(x) ? nfd(after) : after) ||
        orderLongRuns(before, 1, memo) !== (isRun.has(x) ? nfd(before) : before)) {
        wrong.push(hex(x));
      }
    }
    assert.deepEqual(wrong.slice(0, 20), [], wrong.length + ' code points classified differently');
  });

  // Every ordered pair of run characters, by their place in canonical order: before, after or (same class) as
  // typed. This proves the order the helper derives, whatever order it met the classes in.
  it('and orders every pair of run characters as canonical ordering does', () => {
    const memo = createNfcMemo();
    const wrong = [];
    for (const a of RUN) {
      for (const b of RUN) {
        if (orderLongRuns(a + b, 1, memo) !== nfd(a + b)) wrong.push(hex(a) + ', ' + hex(b));
      }
    }
    assert.deepEqual(wrong.slice(0, 20), [], wrong.length + ' of ' + RUN.length * RUN.length + ' pairs out of order');
  });

  it('and keeps its memo bounded by the runtime\'s Unicode data, not by the text', () => {
    const memo = createNfcMemo();
    for (let round = 0; round < 3; round++) {
      for (const x of RUN) toNfcWith(x.repeat(LONGEST + 1) + 'a', memo);
    }
    assert.equal(memo.kinds.length, 0x20000);
    assert.ok(memo.decompositions.size <= RUN.length, memo.decompositions.size + ' decompositions');
    assert.ok(memo.classes.length <= 255, memo.classes.length + ' classes');
    assert.deepEqual(memo.classes.map((entry) => entry.rank), memo.classes.map((entry, i) => i));
  });
});

describe('toNfc returns what normalize returns', () => {
  // Acute (230) and grave below (220): a run of 40 code units, out of order.
  const LONG_RUN = cp(0x301, 0x316).repeat(20);

  it('next to every character made of a starter and non-starters', () => {
    const memo = createNfcMemo();
    const wrong = [];
    for (const x of MIXED) {
      for (const text of [x + LONG_RUN, LONG_RUN + x, LONG_RUN + x + LONG_RUN, x + x + LONG_RUN + x]) {
        if (toNfcWith(text, memo) !== text.normalize('NFC') ||
          nfd(orderLongRuns(text, LONGEST, memo)) !== nfd(text)) wrong.push(hex(x));
      }
    }
    assert.deepEqual(wrong.slice(0, 20), []);
  });

  it('on long runs of marks in Myanmar and other scripts', () => {
    const SHAPES = [
      ['ka, then dot below and virama', cp(0x1000), cp(0x1037, 0x1039)],
      ['ka, then asat and dot below', cp(0x1000), cp(0x103A, 0x1037)],
      ['ka, then U+108D and dot below', cp(0x1000), cp(0x108D, 0x1037)],
      ['dot below and virama, no consonant', '', cp(0x1037, 0x1039)],
      ['Latin: a, then acute and dot below', 'a', cp(0x301, 0x323)],
      ['Greek: alpha, then ypogegrammeni and dialytika tonos (U+0344)', cp(0x3B1), cp(0x345, 0x344)],
      ['Hebrew: bet, then dagesh and qamats', cp(0x5D1), cp(0x5BC, 0x5B8)],
      ['Arabic: beh, then shadda and fatha', cp(0x628), cp(0x651, 0x64E)],
      ['Tibetan: ka, then U+0F73 and U+0F39', cp(0xF40), cp(0xF73, 0xF39)],
      ['astral: musical augmentation dot and stem', 'x', cp(0x1D16D, 0x1D165)]
    ];
    for (const [name, base, unit] of SHAPES) {
      const text = base + unit.repeat(1000) + 'z';
      assert.equal(hex(toNfc(text)), hex(text.normalize('NFC')), name);
    }
  });

  it('putting a run in order only when it is longer than ' + LONGEST + ' code units', () => {
    const memo = createNfcMemo();
    const run30 = cp(0x301, 0x316).repeat(15);
    const astral30 = cp(0x1D16D, 0x1D165).repeat(7) + cp(0x1D16D); // 15 code points, 30 code units
    for (const run of [run30, astral30]) {
      for (const text of ['a' + run, run, run + 'a', 'a' + run + 'b' + run]) {
        assert.equal(orderLongRuns(text, LONGEST, memo), text, hex(text));
      }
    }
    for (const run of [run30 + cp(0x316), astral30 + cp(0x1D165)]) {
      for (const text of ['a' + run, run, run + 'a', 'a' + run + 'b' + run]) {
        assert.equal(hex(orderLongRuns(text, LONGEST, memo)), hex(nfd(text)), hex(text));
      }
    }
  });

  it('with lone surrogates, which end a run', () => {
    const memo = createNfcMemo();
    const run = cp(0x301, 0x316).repeat(20);
    for (const lone of [String.fromCharCode(0xD800), String.fromCharCode(0xDC00), String.fromCharCode(0xDBFF)]) {
      for (const text of [run + lone + run, lone + run, run + lone, lone + lone + run + lone]) {
        assert.equal(hex(orderLongRuns(text, LONGEST, memo)), hex(text.split(lone).map(nfd).join(lone)), hex(text));
        assert.equal(hex(toNfcWith(text, memo)), hex(text.normalize('NFC')), hex(text));
      }
    }
  });

  it('on short and ordinary text, as the same string when it is already NFC', () => {
    const texts = ['', 'a', 'e\u0301', '\u1000\u103C\u1031\u102C\u1004\u103A\u1038', '\u1000\u103A\u1037',
      '\u1025\u102E', 'A\u030A', '\uAC00', '\uD800', '\u1000'.repeat(100)];
    for (const text of texts) assert.equal(hex(toNfc(text)), hex(text.normalize('NFC')), hex(text));
    const nfcText = '\u1000\u103C\u102C\u1004\u103A\u1038 abc'.repeat(20);
    assert.equal(toNfc(nfcText), nfcText);
  });

  it('with a warm memo as with a cold one', () => {
    const texts = ['\u1000' + '\u1037\u1039'.repeat(40), 'a' + cp(0x301, 0x323).repeat(40), cp(0x1E09) + LONG_RUN];
    for (const text of texts) {
      const warm = toNfc(text);
      assert.equal(warm, toNfcWith(text, createNfcMemo()));
      assert.equal(warm, toNfc(text));
    }
  });
});

describe('the only calls of String#normalize in src/ (DESIGN.md §2.3)', () => {
  it('are in core/nfc.js', () => {
    const bad = [];
    for (const { file, ast } of parsedSources()) {
      if (file === 'core/nfc.js') continue;
      walk(ast, (node) => {
        if (node.type === 'CallExpression' && memberName(node.callee) === 'normalize') bad.push(where(file, node));
      });
    }
    assert.deepEqual(bad, [], 'call toNfc from core/nfc.js instead');
  });
});
