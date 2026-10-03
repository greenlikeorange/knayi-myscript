// src/engine/typingFixes.js and src/spec/typoRows.js (docs/next/DESIGN.md §2.3, §3.9, §7.4).
//
// The unit tests: the spec rows against the 2.x TYPOS table, each row's example, the table probes of
// test/fixtures/tables.json, hand-written cases for each rule of the look-alikes and zero as wa (issue #43's Shan
// and Karen cases among them), and isInNumber in both of its contexts. Each case is also run through the 2.x
// function in scripts/oracle/ (D19), so a case that pins a wrong expectation fails there too.
// test/next/typingFixes.fuzz.test.mjs compares the functions with 2.x on targeted fuzz.
//
// The ES2015 floor of every regex in the module is checked by test/next/guards/floor.test.mjs.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fixTypos, readDigitsAsLetters, readLettersAsDigits, fixLookAlikes, zeroAsWa, NUMBER_CONTEXT, isInNumber
} from '../../src/engine/typingFixes.js';
import { TYPO_ROWS } from '../../src/spec/typoRows.js';
import { internals, oracle, srcText, tableProbes } from './helpers.mjs';

const typingFixes2x = internals('typingFixes.js', ['TYPOS']);
const zeroAsWa2x = internals('storageOrder.js', ['zeroAsWa']).zeroAsWa;
const typos2x = oracle.typingFixes.typos;
const lookAlikes2x = oracle.typingFixes.lookAlikes;

const hex = (text) => Array.from(text, (c) => c.charCodeAt(0).toString(16).toUpperCase()).join(' ');

// fn(input) is expected, and so is the 2.x function's output.
function assertFix(fn, fn2x, input, expected) {
  assert.equal(hex(fn(input)), hex(expected), 'input ' + hex(input));
  assert.equal(hex(fn2x(input)), hex(expected), '2.x on input ' + hex(input));
}

// The input comes back unchanged, from the new function and from 2.x.
function assertKept(fn, fn2x, input) {
  assertFix(fn, fn2x, input, input);
}

describe('spec/typoRows.js', () => {
  it('has the 2.x TYPOS rows, in order: sources, flags and replacements (typingFixes.js:12-17)', () => {
    assert.equal(TYPO_ROWS.length, typingFixes2x.TYPOS.length);
    TYPO_ROWS.forEach((row, k) => {
      const [pattern, replacement] = typingFixes2x.TYPOS[k];
      assert.equal(row.pattern.source, pattern.source, row.id);
      assert.equal(row.pattern.flags, pattern.flags, row.id);
      assert.equal(row.replacement, replacement, row.id);
    });
  });

  it('gives every row a unique id, a why, a source and an example', () => {
    const ids = TYPO_ROWS.map((row) => row.id);
    assert.deepEqual(ids, ['typo.ii', 'typo.uu', 'typo.au', 'typo.lagaung']);
    for (const row of TYPO_ROWS) {
      for (const field of ['why', 'source', 'example']) {
        assert.ok(typeof row[field] === 'string' && row[field].length > 0, row.id + ' has no ' + field);
      }
    }
  });

  it('each example is changed by its own row, and fixTypos gives what the 2.x passes give', () => {
    for (const row of TYPO_ROWS) {
      const byRow = row.example.replace(row.pattern, row.replacement);
      assert.notEqual(byRow, row.example, row.id + ': the example does not exercise the row');
      assert.equal(hex(fixTypos(row.example)), hex(typos2x(row.example)), row.id);
      assert.equal(hex(fixTypos(row.example)), hex(byRow), row.id + ': no other row applies to the example');
    }
  });

  it('fixTypos cites every row id in its comments', () => {
    const source = srcText('engine/typingFixes.js');
    for (const row of TYPO_ROWS) assert.ok(source.includes(row.id + ':'), row.id + ' is not cited');
  });
});

describe('fixTypos', () => {
  it('reads i with ii, and u with uu, in either order, as ii and uu (typo.ii, typo.uu)', () => {
    assertFix(fixTypos, typos2x, '\u1000\u102D\u102E', '\u1000\u102E');
    assertFix(fixTypos, typos2x, '\u1000\u102E\u102D', '\u1000\u102E');
    assertFix(fixTypos, typos2x, '\u1000\u102F\u1030', '\u1000\u1030');
    assertFix(fixTypos, typos2x, '\u1000\u1030\u102F', '\u1000\u1030');
  });

  it('scans once from left to right: a pair the fix itself makes stays, as in the 2.x pass', () => {
    // i, ii, i: the first pair is fixed, and the ii it leaves next to the last i is not read again.
    assertFix(fixTypos, typos2x, '\u102D\u102E\u102D', '\u102E\u102D');
    assertFix(fixTypos, typos2x, '\u102F\u1030\u102F\u1030', '\u1030\u1030');
  });

  it('reads o, e, aa and asat as au (typo.au)', () => {
    assertFix(fixTypos, typos2x, '\u1029\u1031\u102C\u103A', '\u102A');
    assertKept(fixTypos, typos2x, '\u1029\u1031\u102C');
  });

  it('reads four before nga, asat and visarga as lagaung, unless a digit comes before it (typo.lagaung)', () => {
    assertFix(fixTypos, typos2x, '\u1044\u1004\u103A\u1038', '\u104E\u1004\u103A\u1038');
    assertFix(fixTypos, typos2x, '\u103F\u1044\u1004\u103A\u1038', '\u103F\u104E\u1004\u103A\u1038');
    assertFix(fixTypos, typos2x, 'a \u1044\u1004\u103A\u1038', 'a \u104E\u1004\u103A\u1038');
    assertKept(fixTypos, typos2x, '\u1040\u1044\u1004\u103A\u1038');
    assertKept(fixTypos, typos2x, '\u1049\u1044\u1004\u103A\u1038');
    assertKept(fixTypos, typos2x, '\u1044\u1004\u103A');
    // Two in a row: the second four follows a visarga, not a digit.
    assertFix(fixTypos, typos2x, '\u1044\u1004\u103A\u1038\u1044\u1004\u103A\u1038',
      '\u104E\u1004\u103A\u1038\u104E\u1004\u103A\u1038');
    // A four after a four is after a digit.
    assertFix(fixTypos, typos2x, '\u1044\u1044\u1004\u103A\u1038', '\u1044\u1044\u1004\u103A\u1038');
  });

  it('reads the unit before the four in the text as typed, which no other row changes', () => {
    assertFix(fixTypos, typos2x, '\u102D\u102E\u1044\u1004\u103A\u1038', '\u102E\u104E\u1004\u103A\u1038');
    assertFix(fixTypos, typos2x, '\u1029\u1031\u102C\u103A\u1044\u1004\u103A\u1038', '\u102A\u104E\u1004\u103A\u1038');
  });

  it('leaves text with no typo as it is', () => {
    for (const text of ['', 'abc', '\u1000\u102D', '\u1000\u102E\u1038', '\u1044\u1004']) {
      assertKept(fixTypos, typos2x, text);
    }
  });

  it('agrees with 2.x on the table probes of every typo row and branch (test/fixtures/tables.json)', () => {
    const probes = tableProbes();
    const rows = Object.keys(probes).filter((name) => name.startsWith('typo '));
    assert.equal(rows.length, TYPO_ROWS.length);
    for (const name of rows) {
      const inputs = [probes[name].probe].concat((probes[name].edges || []).map((edge) => edge.probe));
      for (const input of inputs) assert.equal(hex(fixTypos(input)), hex(typos2x(input)), name + ': ' + hex(input));
    }
  });
});

describe('readDigitsAsLetters (look-alikes, first pass)', () => {
  const pass = readDigitsAsLetters;
  // 2.x has no first pass on its own; on these inputs its second pass changes nothing.
  const pass2x = lookAlikes2x;

  it('reads zero and seven with a mark as wa and ra', () => {
    assertFix(pass, pass2x, '\u1040\u102B', '\u101D\u102B');
    assertFix(pass, pass2x, '\u1047\u1031\u1038', '\u101B\u1031\u1038');
  });

  it('reads zero and seven that start a closed syllable as wa and ra', () => {
    assertFix(pass, pass2x, '\u1040\u1004\u103A', '\u101D\u1004\u103A');
    assertFix(pass, pass2x, '\u1006\u102D\u102F\u1047\u1004\u103A', '\u1006\u102D\u102F\u101B\u1004\u103A');
    // Dot below and visarga may come between the consonant and its asat or virama.
    assertFix(pass, pass2x, '\u1040\u1000\u1037\u1038\u103A', '\u101D\u1000\u1037\u1038\u103A');
    assertFix(pass, pass2x, '\u1040\u1000\u1039\u1000', '\u101D\u1000\u1039\u1000');
  });

  it('reads a zero inside a word, with no digit next to it, as wa', () => {
    assertFix(pass, pass2x, '\u1018\u1040', '\u1018\u101D');
    assertKept(pass, pass2x, '\u1018\u1040\u1041');
    assertKept(pass, pass2x, '\u1018\u1040.\u1041');
    // Only a zero: a seven needs a mark or a closed syllable.
    assertKept(pass, pass2x, '\u1018\u1047');
  });

  it('keeps a digit with visarga, which after digits is a colon', () => {
    assertKept(pass, pass2x, '\u1041\u1047\u1038\u1042\u1041');
    assertKept(pass, pass2x, '\u1040\u1038');
  });

  it('skips the tones of the other languages, which alone are no mark (a comma in S\'gaw Karen)', () => {
    assertKept(pass, pass2x, '\u1042\u1040\u1087');
    assertFix(pass, pass2x, '\u1040\u1087\u102C', '\u101D\u1087\u102C');
    assertFix(pass, pass2x, '\u1040\u1087\u1087\u1062', '\u101D\u1087\u1087\u1062');
  });

  it('reads zero with a Shan or Karen mark as wa, and seven as ra (issue #43)', () => {
    // Zero before a Shan vowel, medial wa or asat, or before a Shan consonant with asat.
    for (const rest of ['\u1086', '\u1062', '\u1083', '\u103A', '\u1082', '\u1082\u103A', '\u107C\u103A\u1038']) {
      assertFix(pass, pass2x, '\u1040' + rest, '\u101D' + rest);
    }
    assertFix(pass, pass2x, '\u101E\u1047\u1063\u103A', '\u101E\u101B\u1063\u103A');
    assertFix(pass, pass2x, '\u1000\u1047\u1062', '\u1000\u101B\u1062');
  });

  it('changes every zero and seven that reads as a letter, and copies the rest', () => {
    assertFix(pass, pass2x, '\u1040\u102C \u1041\u1040 \u1047\u102D', '\u101D\u102C \u1041\u1040 \u101B\u102D');
    // A zero next to a zero is next to a digit.
    assertKept(pass, pass2x, '\u1018\u1040\u1040');
  });
});

describe('readLettersAsDigits (look-alikes, second pass)', () => {
  const pass = readLettersAsDigits;
  // On these inputs the 2.x first pass changes nothing.
  const pass2x = lookAlikes2x;

  it('reads bare wa and ra in a number as zero and seven', () => {
    assertFix(pass, pass2x, '\u1044\u101D\u101D', '\u1044\u1040\u1040');
    assertFix(pass, pass2x, '\u1049,\u101D\u101D\u101D', '\u1049,\u1040\u1040\u1040');
    assertFix(pass, pass2x, '\u1042\u1040\u1041\u101B', '\u1042\u1040\u1041\u1047');
    assertFix(pass, pass2x, '\u101D.\u1041', '\u1040.\u1041');
  });

  it('allows one separator between two parts, and no more', () => {
    assertKept(pass, pass2x, '\u1041..\u101D');
    assertKept(pass, pass2x, '\u1041.,\u101D');
    assertFix(pass, pass2x, '\u1041.\u101D,\u101D', '\u1041.\u1040,\u1040');
  });

  it('keeps a wa or ra that carries a mark, tones skipped, or starts a closed syllable', () => {
    assertKept(pass, pass2x, '\u1041\u101D\u102B');
    assertKept(pass, pass2x, '\u1041\u101D\u1087\u102C');
    assertKept(pass, pass2x, '\u1041\u101D\u1004\u103A');
    assertKept(pass, pass2x, '\u1041\u101B\u1000\u1037\u103A');
  });

  it('keeps wa and ra glued to the word before the number, up to its first digit', () => {
    assertKept(pass, pass2x, '\u1000\u101D\u1041');
    assertFix(pass, pass2x, '\u1000\u101D\u1041\u101D', '\u1000\u101D\u1041\u1040');
    assertFix(pass, pass2x, '\u101D\u1041', '\u1040\u1041');
  });

  it('keeps a ra glued to the word after the number, but not a wa', () => {
    assertKept(pass, pass2x, '\u1042\u101B\u1010\u101A\u103A');
    assertFix(pass, pass2x, '\u1042\u101B \u1010', '\u1042\u1047 \u1010');
    assertFix(pass, pass2x, '\u1042\u101D\u1010', '\u1042\u1040\u1010');
    assertFix(pass, pass2x, '\u1042\u101B\u101B\u1010', '\u1042\u1047\u101B\u1010');
  });

  it('needs a Burmese digit in the number', () => {
    for (const text of ['\u101D', '\u101D\u101D', '\u101D.\u101B', '\u1090\u101D', '\uA9F0\u101D']) {
      assertKept(pass, pass2x, text);
    }
  });

  it('keeps a number followed by a tone typed as a comma (issue #43)', () => {
    assertKept(pass, pass2x, '\u1041\u1044\u1038\u1041\u1045\u1087 \u1041\u1046');
    assertFix(pass, pass2x, '\u1042\u101D\u1087', '\u1042\u1040\u1087');
  });
});

describe('fixLookAlikes', () => {
  it('runs the first pass, then the second', () => {
    // The first pass makes the zero wa; the second reads that bare wa, in a number, as zero again.
    assertFix(fixLookAlikes, lookAlikes2x, '\u101D\u1040\u101D\u1041', '\u1040\u1040\u1040\u1041');
    assertFix(fixLookAlikes, lookAlikes2x, '\u1018\u1040 \u1042\u101D', '\u1018\u101D \u1042\u1040');
    for (const text of ['\u101D\u1040\u101D\u1041', '\u1040\u102C \u1041\u101B', '\u1047\u1004\u103A\u1041']) {
      assert.equal(fixLookAlikes(text), readLettersAsDigits(readDigitsAsLetters(text)), hex(text));
    }
  });

  it('reads a number whose digits are neither zero nor seven', () => {
    assertFix(fixLookAlikes, lookAlikes2x, '\u1041\u101D', '\u1041\u1040');
    assertFix(fixLookAlikes, lookAlikes2x, '\u101B,\u1049', '\u1047,\u1049');
  });

  it('returns text with no Burmese digit as it is', () => {
    for (const text of ['', 'abc', '\u101D\u101B', '\u1090\u101D', '\uA9F0\u101D\u102C']) {
      assertKept(fixLookAlikes, lookAlikes2x, text);
    }
  });
});

describe('zeroAsWa', () => {
  it('reads a zero that is not in a number as wa', () => {
    assertFix(zeroAsWa, zeroAsWa2x, '\u1040', '\u101D');
    assertFix(zeroAsWa, zeroAsWa2x, '\u1018\u1040', '\u1018\u101D');
    assertFix(zeroAsWa, zeroAsWa2x, '\u1040\u1004\u103A \u1040', '\u101D\u1004\u103A \u101D');
  });

  it('keeps a zero next to a Burmese digit or a sign, or across a separator from a digit', () => {
    assertKept(zeroAsWa, zeroAsWa2x, '\u1041\u1040');
    assertKept(zeroAsWa, zeroAsWa2x, '\u1040\u1040');
    for (const sign of '+-*/') {
      assertKept(zeroAsWa, zeroAsWa2x, sign + '\u1040');
      assertKept(zeroAsWa, zeroAsWa2x, '\u1040' + sign);
    }
    // research/zawgyi-to-unicode.md §1, bug K: a zero after a decimal point.
    assertKept(zeroAsWa, zeroAsWa2x, '\u1045.\u1040');
    assertKept(zeroAsWa, zeroAsWa2x, '\u1040,\u1041');
    assertFix(zeroAsWa, zeroAsWa2x, '.\u1040', '.\u101D');
  });

  it('counts only Burmese digits, unlike the look-alikes (refactor plan §7 #20)', () => {
    assertFix(zeroAsWa, zeroAsWa2x, '\u1090\u1040', '\u1090\u101D');
    assertFix(zeroAsWa, zeroAsWa2x, '\u1040\uA9F0', '\u101D\uA9F0');
  });

  it('changes every zero that is not in a number, and copies the rest', () => {
    assertFix(zeroAsWa, zeroAsWa2x, '\u1040 \u1041\u1040 \u1040\u102C', '\u101D \u1041\u1040 \u101D\u102C');
    // Each zero is next to the other, a digit.
    assertKept(zeroAsWa, zeroAsWa2x, '\u1000\u1040\u1040\u1000');
  });
});

describe('isInNumber', () => {
  const { ZERO_AS_WA, LOOK_ALIKES } = NUMBER_CONTEXT;
  // [text, index, in a number for ZERO_AS_WA, for LOOK_ALIKES]
  const CASES = [
    ['\u1041\u1040', 1, true, true], // a Burmese digit before
    ['\u1040\u1049', 0, true, true], // and after
    ['\u1090\u1040', 1, false, true], // a Shan digit
    ['\u1040\uA9F9', 0, false, true], // a Tai Laing digit
    ['+\u1040', 1, true, false], // a sign before
    ['\u1040/', 0, true, false], // and after
    ['*\u1040-', 1, true, false],
    ['\u1041.\u1040', 2, true, true], // a separator with a digit beyond
    ['\u1040,\u1041', 0, true, true],
    ['\u1090.\u1040', 2, false, true],
    ['+.\u1040', 2, false, false], // a sign beyond a separator does not count
    ['.\u1040', 1, false, false], // a separator at the edge
    ['\u1040.', 0, false, false],
    ['\u1040', 0, false, false],
    ['\u1000\u1040\u1000', 1, false, false],
    ['\u1041 \u1040', 2, false, false], // a space is no separator
    ['\u1041..\u1040', 3, false, false] // nor are two
  ];

  it('gives each context its own digits and signs', () => {
    for (const [text, i, zeroAsWaRule, lookAlikesRule] of CASES) {
      assert.equal(isInNumber(text, i, ZERO_AS_WA), zeroAsWaRule, 'ZERO_AS_WA on ' + hex(text) + ' at ' + i);
      assert.equal(isInNumber(text, i, LOOK_ALIKES), lookAlikesRule, 'LOOK_ALIKES on ' + hex(text) + ' at ' + i);
    }
  });

  it('agrees with 2.x zeroAsWa, and with the zero-in-a-word rule of 2.x lookAlikes', () => {
    for (const [text, i, zeroAsWaRule, lookAlikesRule] of CASES) {
      if (text.charCodeAt(i) !== 0x1040) continue;
      // zeroAsWa keeps a zero exactly when it is in a number.
      assert.equal(zeroAsWa2x(text).charCodeAt(i) === 0x1040, zeroAsWaRule, '2.x zeroAsWa on ' + hex(text));
      // With a letter before it and no mark after it, the look-alikes keep a zero exactly when it is in a number.
      // Only for a zero at the start: the letter takes the place of nothing.
      if (i > 0) continue;
      const word = '\u1000' + text;
      assert.equal(lookAlikes2x(word).charCodeAt(1) === 0x1040, lookAlikesRule, '2.x lookAlikes on ' + hex(word));
    }
  });

  it('has the two frozen contexts of the spec', () => {
    assert.deepEqual(Object.keys(NUMBER_CONTEXT), ['ZERO_AS_WA', 'LOOK_ALIKES']);
    assert.ok(Object.isFrozen(NUMBER_CONTEXT) && Object.isFrozen(ZERO_AS_WA) && Object.isFrozen(LOOK_ALIKES));
    for (const context of [ZERO_AS_WA, LOOK_ALIKES]) {
      assert.deepEqual(Object.keys(context), ['isDigit', 'isSign']);
    }
  });
});

describe('the module keeps no state between calls (DESIGN.md §4)', () => {
  it('gives each text what it gives alone, in any order of calls', () => {
    const texts = ['\u1041\u101D\u101D \u101D\u1041', '\u1018\u1040', '\u1044\u1004\u103A\u1038 \u102D\u102E',
      '\u1045.\u1040 \u1040', '', '\u1041'];
    const fns = [fixTypos, readDigitsAsLetters, readLettersAsDigits, fixLookAlikes, zeroAsWa];
    const alone = fns.map((fn) => texts.map((text) => fn(text)));
    for (let round = 0; round < 3; round++) {
      texts.slice().reverse().forEach((text) => {
        fns.forEach((fn, f) => assert.equal(fn(text), alone[f][texts.indexOf(text)]));
      });
    }
  });
});
