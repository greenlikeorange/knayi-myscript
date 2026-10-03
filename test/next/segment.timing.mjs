// Growth of src/segment.js (docs/next/DESIGN.md §6.2 item 4). Owner: W3 (segment).
//
// Every adversarial shape of SHAPES and every single-character pump of PUMPS (helpers.mjs) runs at n and 4n units
// through breakParts, breakString and collapseRepeatedMarks, both fonts, and segmentSyllables. The growth exponent,
// log2(t(4n) / t(n)) / 2 (1 is linear, 2 quadratic), must be at most 1.3 under Node and Bun. As in
// test/growth.timing.js, a quick reading screens every case, and a case that reads high is measured again in full,
// at n, 2n and 4n (growthExponent, scripts/eval/lib/timing.mjs), up to twice: a burst of load spoils one reading,
// seldom three, while a super-linear path reads high every time. A case fails only when every reading is high.
//
// The break functions' precondition (no U+200B or U+200C) does not hold for every shape and pump; they still run in
// linear time on such text, and segmentSyllables takes it by design.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { breakParts, breakString, segmentSyllables, collapseRepeatedMarks } from '../../src/segment.js';
import { SHAPES, PUMPS } from './helpers.mjs';
import { GROWTH_N, growthExponent, perCall } from '../../scripts/eval/lib/timing.mjs';

const LIMIT = 1.3;
const QUICK_MS = 0.5; // each quick reading: the faster of two runs of calls lasting at least this long
const FULL_ATTEMPTS = 2; // full measurements of a case whose quick reading is high

const FORMS = [
  ['breakParts unicode', (x) => breakParts(x, 'unicode')],
  ['breakParts zawgyi', (x) => breakParts(x, 'zawgyi')],
  ['breakString unicode', (x) => breakString(x, 'unicode', '|')],
  ['breakString zawgyi', (x) => breakString(x, 'zawgyi', '|')],
  ['segmentSyllables unicode', (x) => segmentSyllables(x, 'unicode')],
  ['collapseRepeatedMarks unicode', (x) => collapseRepeatedMarks(x, 'unicode')],
  ['collapseRepeatedMarks zawgyi', (x) => collapseRepeatedMarks(x, 'zawgyi')]
];

// The quick reading: the exponent from n to 4n units.
function quickExponent(call, small, big) {
  call(small);
  call(big);
  const time = (x) => Math.min(perCall(() => call(x), QUICK_MS), perCall(() => call(x), QUICK_MS));
  return Math.log2(time(big) / time(small)) / 2;
}

// The full measurement, taken again while it reads high: the last one, or null once one reads linear.
function highFullReading(call, make) {
  let full = null;
  for (let attempt = 0; attempt < FULL_ATTEMPTS; attempt++) {
    full = growthExponent(call, make);
    if (full.exponent !== null && full.exponent <= LIMIT) return null;
    if (full.exponent === null) break; // one call at n took longer than the cap
  }
  return full;
}

describe('growth of src/segment.js (DESIGN.md §6.2)', () => {
  for (const [name, call] of FORMS) {
    it(name + ' is linear on every shape and pump', (t) => {
      let measured = 0;
      const failed = [];
      for (const { id, make } of SHAPES.concat(PUMPS)) {
        if (quickExponent(call, make(GROWTH_N), make(4 * GROWTH_N)) <= LIMIT) continue;
        measured++;
        const full = highFullReading(call, make);
        if (full) {
          failed.push(id + ': exponent ' + (full.exponent === null ? 'none, ' + full.ms.toFixed(0) + ' ms at n' :
            full.exponent.toFixed(2)) + ' at n = ' + full.units + ' units');
        }
      }
      t.diagnostic(SHAPES.length + ' shapes and ' + PUMPS.length + ' pumps, ' + measured +
        ' measured in full after a high quick reading');
      assert.deepEqual(failed, [], 'super-linear time (limit ' + LIMIT + ')');
    });
  }
});
