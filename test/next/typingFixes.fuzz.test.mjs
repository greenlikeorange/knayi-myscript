// Differential fuzz of src/engine/typingFixes.js against the 2.x functions it replaces, in the frozen copies of
// scripts/oracle/ (docs/next/DESIGN.md §6.1, §6.2 item 2, §7.4): fixTypos against typos, fixLookAlikes against
// lookAlikes (typingFixes.js), and zeroAsWa against zeroAsWa (storageOrder.js). Every output must be identical.
//
// The strings are short and targeted: drawn mostly from the units the rules read (digits of the three scripts,
// wa and ra, separators and signs, marks and tones, consonants with asat or virama, the typo letters), so most
// of them hold a candidate and its surroundings. The 2.x fuzz alphabets and structured Burmese text are mixed in,
// and the regression strings of test/fuzz.test.js and the shapes below run first.
//
// 200,000 strings on a pull request; a long run takes up to 4,000,000 (PR 2.6 of the refactor plan):
//   KNAYI_FUZZ_SCALE=20 node --test test/next/typingFixes.fuzz.test.mjs

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  fixTypos, readDigitsAsLetters, readLettersAsDigits, fixLookAlikes, zeroAsWa
} from '../../src/engine/typingFixes.js';
import { arb, fuzz, internals, oracle } from './helpers.mjs';

const require = createRequire(import.meta.url);
const fc = require('fast-check');

const zeroAsWa2x = internals('storageOrder.js', ['zeroAsWa']).zeroAsWa;

const PR_COUNT = 200000;
const NIGHTLY_COUNT = 4000000;

const hex = (text) => Array.from(text, (c) => c.charCodeAt(0).toString(16).toUpperCase()).join(' ');
const units = (...codes) => codes.map((code) => String.fromCharCode(code));

// The units the typing fixes read, by role.
const TARGETS = {
  // Burmese digits (zero, four and seven above all), Shan (U+1090-U+1099) and Tai Laing (U+A9F0-U+A9F9) digits.
  digits: units(0x1040, 0x1040, 0x1047, 0x1047, 0x1044, 0x1041, 0x1049, 0x1090, 0x1099, 0xA9F0, 0xA9F9),
  letters: units(0x101D, 0x101D, 0x101B, 0x101B, 0x1000, 0x1004, 0x1018, 0x1029, 0x103F, 0x104C, 0x104E, 0x1050,
    0x105A, 0x1061, 0x1075, 0x107C, 0x1081, 0x108E, 0xA9E0, 0xA9E7, 0xAA60, 0xAA7A),
  // Burmese marks, asat, virama, dot below, visarga, and the marks of the other languages.
  marks: units(0x102B, 0x102C, 0x102D, 0x102E, 0x102F, 0x1030, 0x1031, 0x1036, 0x1037, 0x1038, 0x1039, 0x103A,
    0x103C, 0x103D, 0x1056, 0x105E, 0x1062, 0x1067, 0x1071, 0x1082, 0x1083, 0x1086, 0x109C, 0xA9E5),
  // The tones of the other languages; a tone alone is no mark.
  tones: units(0x1063, 0x1064, 0x1069, 0x1087, 0x1089, 0x108D, 0x108F, 0x109A, 0xAA7B, 0xAA7D),
  // Separators, signs, punctuation and units outside the blocks.
  other: ['.', ',', '+', '-', '*', '/', ' ', 'a', '1', ':'].concat(units(0x104A, 0x104B, 0x200B, 0xA0, 0x109F))
};

const targetUnit = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom(...TARGETS.digits) },
  { weight: 4, arbitrary: fc.constantFrom(...TARGETS.letters) },
  { weight: 4, arbitrary: fc.constantFrom(...TARGETS.marks) },
  { weight: 2, arbitrary: fc.constantFrom(...TARGETS.tones) },
  { weight: 3, arbitrary: fc.constantFrom(...TARGETS.other) }
);

// The typo sequences whole, so the rarer rows (au, lagaung) come up often.
const typoPiece = fc.constantFrom(...['\u1029\u1031\u102C\u103A', '\u1044\u1004\u103A\u1038', '\u102D\u102E',
  '\u102E\u102D', '\u102F\u1030', '\u1030\u102F', '\u1004\u103A\u1038']);

// Numbers typed with look-alikes: Burmese digits, wa, ra and separators.
const numberPiece = fc.array(fc.constantFrom(...units(0x1040, 0x1041, 0x1047, 0x1049, 0x101D, 0x101D, 0x101B), '.', ','),
  { minLength: 2, maxLength: 6 }).map((parts) => parts.join(''));

const targeted = fc.array(fc.oneof(
  { weight: 6, arbitrary: targetUnit },
  { weight: 1, arbitrary: typoPiece },
  { weight: 1, arbitrary: numberPiece }
), { minLength: 1, maxLength: 10 }).map((parts) => parts.join(''));

const strings = fc.oneof(
  { weight: 12, arbitrary: targeted },
  { weight: 2, arbitrary: arb.unicodeText() },
  { weight: 1, arbitrary: arb.zawgyiText() },
  { weight: 1, arbitrary: arb.burmeseText },
  { weight: 1, arbitrary: arb.codeUnits }
);

// The regression strings of test/fuzz.test.js, then shapes around each rule's edges.
const REGRESSIONS = [
  '\u101B\u103A\u1039\u1000\u102C', '\u1000\u102C\u1039\u1000', '\u1000\u200B\u1031\u1001', '\u1047 \u102C',
  '\u101C\u1032\u1025\u103A\u1038', '\u1004\u103A\u1039\u1002\u1031 \u102F', '\u1000' + '\u1031'.repeat(300),
  '\u1000' + '\u103C'.repeat(300), '\u1000' + '\u103A'.repeat(150) + '\u103C'.repeat(150),
  '\u1000' + '\u200B\u102C'.repeat(150), '\u107F\u1019\u102D\u1033 \u1037', '\u104E\u1004\u1039\u1038',
  '\u1044\u1004\u1039\u1038', '\u1031\u101A\u102C\u1000\u1039\u103A\u102C\u1038', '\u1031' + '\u1000'.repeat(200),
  'ajumifh', 'a,musfm;', 'usGefkyf', 'aMomf', 'ZvGefaps;', '7if;', '0if',
  // A number glued to words on both sides, with every separator; wa and ra with tones and closed syllables.
  '\u1000\u101D\u1041.\u101D,\u101B\u1000', '\u101D\u101D\u101D\u1041\u101B\u101B', '\u1041\u101D\u1087\u1087\u102C',
  '\u1041\u101B\u1000\u1037\u1038\u103A', '\u1040\u1087\u1063\u1062', '\u1040\u1000\u1037\u1037\u1039',
  // Zero between signs, separators and other scripts' digits.
  '+\u1040-', '\u1090.\u1040.\uA9F0', '.\u1040,', '\u1044\u1044\u1004\u103A\u1038', '\u102D\u102E\u102D\u102E\u102D'
].map((text) => [text]);

function same(name, actual, expected, input) {
  if (actual !== expected) {
    assert.fail(name + ' on ' + hex(input) + '\n  next ' + hex(actual) + '\n  2.x  ' + hex(expected));
  }
}

describe('src/engine/typingFixes.js against 2.x (targeted fuzz)', () => {
  it('fixTypos, fixLookAlikes and zeroAsWa give the 2.x output', () => {
    fuzz.check(fc.property(strings, (text) => {
      same('fixTypos', fixTypos(text), oracle.typingFixes.typos(text), text);
      same('fixLookAlikes', fixLookAlikes(text), oracle.typingFixes.lookAlikes(text), text);
      same('zeroAsWa', zeroAsWa(text), zeroAsWa2x(text), text);
      // fixLookAlikes skips text with no Burmese digit; the two passes it skips must agree.
      same('the two passes', readLettersAsDigits(readDigitsAsLetters(text)), fixLookAlikes(text), text);
    }), PR_COUNT, REGRESSIONS, NIGHTLY_COUNT);
  });

  // A generator that stopped reaching the rules would let the comparison above pass. Each function must change a
  // fair share of the strings.
  it('feeds every rule', (t) => {
    const sample = fc.sample(strings, { seed: fuzz.SEED, numRuns: 5000 });
    const share = (fn) => sample.filter((text) => fn(text) !== text).length / sample.length;
    const shares = {
      typos: share(fixTypos),
      digitsAsLetters: share(readDigitsAsLetters),
      lettersAsDigits: share(readLettersAsDigits),
      zeroAsWa: share(zeroAsWa)
    };
    if (typeof t.diagnostic === 'function') {
      t.diagnostic('changed: ' + Object.keys(shares).map((k) => k + ' ' + shares[k].toFixed(3)).join(', '));
    }
    for (const [name, value] of Object.entries(shares)) assert.ok(value > 0.03, name + ' changed only ' + value);
  });
});
