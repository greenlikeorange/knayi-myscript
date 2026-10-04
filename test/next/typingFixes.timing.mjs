// Growth of src/rules/typingFixes.js (docs/next/DESIGN.md §6.2 item 4). Owner: W2 (typing-fixes).
//
// Every adversarial shape of SHAPES, the typing-fix shapes below, and every single-character pump of PUMPS
// (helpers.mjs), at n, 2n and 4n units, through fixTypos, fixLookAlikes and zeroAsWa. fixLookAlikes runs both of
// its passes whenever the text holds a Burmese digit, and neither pass has anything to read without one. The growth
// exponent must be at most 1.3 under Node and Bun.
//
// The method is perf's (scripts/eval/perf.mjs), the screening and confirming of test/growth.timing.js: every cell
// gets a quick first reading, and a cell that reads above the limit is measured in full three times and fails only
// when all three readings are above it. Super-linear code reads high every time; another process or a garbage
// collection seldom spoils three readings in a row.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fixTypos, fixLookAlikes, zeroAsWa } from '../../src/rules/typingFixes.js';
import { growthExponent } from '../../scripts/eval/lib/timing.mjs';
import { SHAPES, PUMPS } from './helpers.mjs';

const LIMIT = 1.3;

const rep = (unit, n) => unit.repeat(Math.max(1, Math.round(n / unit.length)));
const s = (...codes) => String.fromCharCode(...codes);

// The runs around each candidate that the fixes read: tones and marks after a zero, seven, wa or ra; consonants
// with dots below, visargas and asat (closed syllables); long numbers with separators, glued to words; signs; and
// the typo sequences, whole and broken.
const TYPING_SHAPES = [
  ['zero, then tones', (n) => s(0x1040) + rep(s(0x1087), n)],
  ['(zero, tone) repeated', (n) => rep(s(0x1040, 0x1087), n)],
  ['(seven, tone, tone, aa) repeated', (n) => rep(s(0x1047, 0x1087, 0x1087, 0x102C), n)],
  ['zero, consonant, then dots below', (n) => s(0x1040, 0x1000) + rep(s(0x1037), n)],
  ['(ra, consonant, dot below, visarga, asat) repeated', (n) => rep(s(0x101B, 0x1000, 0x1037, 0x1038, 0x103A), n)],
  ['digit, then wa', (n) => s(0x1041) + rep(s(0x101D), n)],
  ['wa, then a digit', (n) => rep(s(0x101D), n) + s(0x1041)],
  ['(wa, decimal point), then a digit', (n) => rep(s(0x101D, 0x2E), n) + s(0x1041)],
  ['(digit, point, wa, comma) repeated', (n) => rep(s(0x1041, 0x2E, 0x101D, 0x2C), n)],
  ['(wa, tone, tone, digit) repeated', (n) => rep(s(0x101D, 0x1087, 0x1087, 0x1041), n)],
  ['(digit, wa, tone, tone, aa) repeated', (n) => rep(s(0x1041, 0x101D, 0x1087, 0x1087, 0x102C), n)],
  ['(digit, ra, consonant, dot below) repeated', (n) => rep(s(0x1041, 0x101B, 0x1000, 0x1037), n)],
  ['(digit, two points) repeated', (n) => rep(s(0x1041, 0x2E, 0x2E), n)],
  ['(letter, wa, digit, ra, letter) repeated', (n) => rep(s(0x1000, 0x101D, 0x1041, 0x101B, 0x1000), n)],
  ['(zero, plus) repeated', (n) => rep(s(0x1040, 0x2B), n)],
  ['(letter, zero, space) repeated', (n) => rep(s(0x1000, 0x1040, 0x20), n)],
  ['(Shan digit, zero) repeated', (n) => rep(s(0x1090, 0x1040), n)],
  ['(i, ii) repeated', (n) => rep(s(0x102D, 0x102E), n)],
  ['(u, uu, u) repeated', (n) => rep(s(0x102F, 0x1030, 0x102F), n)],
  ['(four, nga, asat, visarga) repeated', (n) => rep(s(0x1044, 0x1004, 0x103A, 0x1038), n)],
  ['fours, then nga, asat, visarga', (n) => rep(s(0x1044), n) + s(0x1004, 0x103A, 0x1038)],
  ['(o, e, aa, asat) repeated', (n) => rep(s(0x1029, 0x1031, 0x102C, 0x103A), n)],
  ['(o, e, aa) repeated', (n) => rep(s(0x1029, 0x1031, 0x102C), n)]
].map(([id, make]) => ({ id, make }));

const CELLS = SHAPES.map((shape) => ({ kind: 'shape', ...shape }))
  .concat(TYPING_SHAPES.map((shape) => ({ kind: 'typing shape', ...shape })))
  .concat(PUMPS.map((pump) => ({ kind: 'pump', ...pump })));

const FUNCTIONS = { fixTypos, fixLookAlikes, zeroAsWa };

// A quick reading first; above the limit, the lowest of three full readings (scripts/eval/perf.mjs).
function screenedExponent(call, make) {
  const quick = growthExponent(call, make, { samples: 2, sampleMs: 1, warmMs: 1 });
  if (quick.exponent !== null && quick.exponent <= LIMIT) return quick.exponent;
  let lowest = Infinity;
  for (let attempt = 0; attempt < 3 && lowest > LIMIT; attempt++) {
    const full = growthExponent(call, make);
    lowest = Math.min(lowest, full.exponent === null ? Infinity : full.exponent);
  }
  return lowest;
}

describe('growth of src/rules/typingFixes.js (DESIGN.md §6.2)', () => {
  for (const [name, fn] of Object.entries(FUNCTIONS)) {
    it(name + ' is linear on every shape and pump', (t) => {
      let last = '';
      const call = (text) => { last = fn(text); };
      const over = [];
      let highest = { exponent: -Infinity, id: '' };
      for (const cell of CELLS) {
        const exponent = screenedExponent(call, cell.make);
        if (exponent > highest.exponent) highest = { exponent, id: cell.kind + ' ' + cell.id };
        if (exponent > LIMIT) over.push(cell.kind + ' ' + cell.id + ': ' + exponent.toFixed(2));
      }
      if (typeof t.diagnostic === 'function') {
        t.diagnostic(CELLS.length + ' cells; highest exponent ' + highest.exponent.toFixed(2) + ' (' + highest.id +
          '); the last output had ' + last.length + ' units');
      }
      assert.deepEqual(over, [], name + ' grows faster than n^' + LIMIT);
    });
  }
});
