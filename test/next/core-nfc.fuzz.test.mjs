// Differential fuzz of core/nfc.js (docs/next/DESIGN.md §6.1, §6.2 item 2): toNfc against the runtime's own
// String#normalize('NFC'), which it replaces, on random text. Every output must be identical.
//
// - Random text over starters, marks of many classes (Myanmar, Latin, Greek, Hebrew, Arabic, Tibetan and astral),
//   characters that decompose into marks or into a letter and marks, and both halves of a surrogate pair alone,
//   at every run length the helper may use: orderLongRuns must keep the text's NFD and NFC (the 2.x helper's
//   method, test/nfc.test.js at d170cd8).
// - The Myanmar text of the 2.x fuzz tests (scripts/testing/arbitraries.js) and any UTF-16 units.
// The exhaustive checks are in core-nfc.test.mjs.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { toNfc, toNfcWith, createNfcMemo, orderLongRuns } from '../../src/core/nfc.js';
import { arb, fuzz } from './helpers.mjs';

const cp = (...codes) => String.fromCodePoint(...codes);
const nfd = (text) => text.normalize('NFD');
const hex = (text) => Array.from(text, (ch) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'))
  .join(' ');

const STARTERS = [0x61, 0x20, 0x1000, 0x102C, 0x1038, 0x103B, 0x3B1, 0x5D1, 0x628, 0xF40, 0x200B].map((c) => cp(c));
const RUN_CHARACTERS = [
  0x300, 0x301, 0x316, 0x323, 0x327, 0x334, 0x345, 0x1037, 0x1039, 0x103A, 0x108D, 0x5B8, 0x5BC, 0x64E, 0x651,
  0xF39, 0xF71, 0xF72, 0x1D165, 0x1D16D, 0x101FD, // non-starters
  0x340, 0x341, 0x343, 0x344, 0xF73, 0xF75, 0xF81 // characters that decompose into non-starters
].map((code) => cp(code));
const LETTERS_WITH_MARKS = [0xE9, 0x1E09, 0x1FB3, 0x1D15E, 0xF77].map((code) => cp(code));
const LONE_SURROGATES = [String.fromCharCode(0xD800), String.fromCharCode(0xDC00)];
const ALPHABET = STARTERS.concat(RUN_CHARACTERS, LETTERS_WITH_MARKS, LONE_SURROGATES);

// Uniform text seldom holds a run longer than 30 units, so half the cases put one in: 25 to 70 run characters
// after any character, then more text.
const anyText = fc.array(fc.constantFrom(...ALPHABET), { maxLength: 80 }).map((chars) => chars.join(''));
const longRun = fc.array(fc.constantFrom(...RUN_CHARACTERS), { minLength: 25, maxLength: 70 });
const textWithLongRun = fc.tuple(fc.constantFrom(...ALPHABET), longRun, anyText)
  .map(([first, run, rest]) => first + run.join('') + rest);
const mixedText = fc.oneof(anyText, textWithLongRun);

const REGRESSIONS = [
  ['\u1000' + '\u1037\u1039'.repeat(40)],
  [cp(0x1D16D) + String.fromCharCode(0xDC00) + cp(0x301)],
  [cp(0x1E09) + cp(0x301, 0x316).repeat(20)],
  [String.fromCharCode(0xD800) + cp(0x301, 0x316).repeat(20) + String.fromCharCode(0xDC00)]
];

describe('toNfc against String#normalize(\'NFC\')', () => {
  it('on random text with runs of marks, at every run length', () => {
    fuzz.check(fc.property(mixedText, (input) => {
      const want = input.normalize('NFC');
      assert.equal(hex(toNfc(input)), hex(want));
      const memo = createNfcMemo();
      for (const longest of [0, 1, 2, 3, 7]) {
        const ordered = orderLongRuns(input, longest, memo);
        assert.equal(hex(nfd(ordered)), hex(nfd(input)), 'orderLongRuns at ' + longest);
        assert.equal(hex(ordered.normalize('NFC')), hex(want), 'orderLongRuns at ' + longest);
      }
    }), 20000, REGRESSIONS, 400000);
  });

  it('on Myanmar text and any UTF-16 units, with the warm memo and a cold one', () => {
    const text = fc.oneof(arb.unicodeText(48), arb.zawgyiText(48), arb.burmeseText, arb.codeUnits);
    fuzz.check(fc.property(text, (input) => {
      const want = input.normalize('NFC');
      assert.equal(hex(toNfc(input)), hex(want));
      assert.equal(hex(toNfcWith(input, createNfcMemo())), hex(want));
    }), 20000, REGRESSIONS, 1000000);
  });
});
