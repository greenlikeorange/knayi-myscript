// Growth of src/unicodeToZawgyi.js (docs/next/DESIGN.md §6.2 item 4). Owner: W7 (unicode-to-zawgyi).
//
// Every adversarial shape of SHAPES and every single-character pump of PUMPS (helpers.mjs) runs through
// unicodeToZawgyi at n, 2n and 4n units: n is 8,192 under Node and 1,024 under Bun (scripts/eval/lib/timing.mjs).
// The growth exponent, log2(t(4n) / t(n)) / 2, must be at most 1.3. As in perf.mjs, which follows
// test/growth.timing.js: each input gets a quick first reading, an input that reads above the limit is measured
// in full three times, and it fails only when all three readings are above the limit. Super-linear code reads
// high every time, while a burst of load on the machine seldom spoils three readings in a row.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { unicodeToZawgyi } from '../../src/unicodeToZawgyi.js';
import { SHAPES, PUMPS } from './helpers.mjs';
import { growthExponent } from '../../scripts/eval/lib/timing.mjs';

const LIMIT = 1.3;

// The lowest of the readings: a quick one, then, when it is above the limit, three full ones.
function screenedGrowth(make) {
  const call = (text) => unicodeToZawgyi(text);
  const quick = growthExponent(call, make, { samples: 2, sampleMs: 1, warmMs: 1 });
  if (quick.exponent !== null && quick.exponent <= LIMIT) return quick;
  const full = [growthExponent(call, make), growthExponent(call, make), growthExponent(call, make)];
  const value = (reading) => (reading.exponent === null ? Infinity : reading.exponent);
  return full.sort((a, b) => value(a) - value(b))[0];
}

function checkGrowth(inputs, t) {
  const over = [];
  let highest = { exponent: -Infinity };
  for (const input of inputs) {
    const reading = screenedGrowth(input.make);
    if (reading.exponent === null || reading.exponent > LIMIT) {
      over.push(input.id + ': ' + (reading.exponent === null ? reading.ms.toFixed(0) + ' ms at ' + reading.units +
        ' units' : reading.exponent.toFixed(2)));
    } else if (reading.exponent > highest.exponent) {
      highest = { id: input.id, exponent: reading.exponent };
    }
  }
  const summary = inputs.length + ' inputs; highest ' + highest.exponent.toFixed(2) + ' on ' + highest.id;
  if (t && t.diagnostic) t.diagnostic(summary);
  assert.deepEqual(over, [], 'growth exponents above ' + LIMIT);
}

describe('growth of src/unicodeToZawgyi.js (DESIGN.md §6.2)', () => {
  it('is linear on every adversarial shape', (t) => checkGrowth(SHAPES, t));
  it('is linear on every single-character run', (t) => checkGrowth(PUMPS, t));
});
