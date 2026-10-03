// Growth of the 3.0 API (docs/next/DESIGN.md §6.2 item 4, §11): every function in linear time, on the adversarial
// shapes of SHAPES, the runs of NFC_RUNS (helpers.mjs), and the chains normalize settles in more than one pass. The
// method is that of test/next/normalize.timing.mjs: a quick reading at n, 2n and 4n units, and a reading above 1.3
// is measured three more times, the lowest kept. PUMPS, the single characters repeated, run through normalize,
// which settles regions; the core's own timing files run them through the rest.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { growthExponent } from '../../../scripts/eval/lib/timing.mjs';
import { SHAPES, PUMPS, NFC_RUNS } from '../helpers.mjs';
import { normalize, isNormalized } from '../../../src/index.js';

const LIMIT = 1.3;

function screenedGrowth(call, make) {
  const quick = growthExponent(call, make, { samples: 2, sampleMs: 1, warmMs: 1 });
  if (quick.exponent !== null && quick.exponent <= LIMIT) return quick;
  const tries = [growthExponent(call, make), growthExponent(call, make), growthExponent(call, make)];
  const value = (g) => (g.exponent === null ? Infinity : g.exponent);
  return tries.sort((a, b) => value(a) - value(b))[0];
}

function superLinear(call, cases) {
  const bad = [];
  for (const shape of cases) {
    const growth = screenedGrowth(call, shape.make);
    if (growth.exponent === null || growth.exponent > LIMIT) {
      bad.push(shape.id + ': ' + (growth.exponent === null ? 'too slow, ' + growth.ms.toFixed(0) + ' ms at ' +
        growth.units + ' units' : 'exponent ' + growth.exponent.toFixed(2)));
    }
  }
  return bad;
}

// The chains 2.x normalize settled one link per pass (DESIGN.md §11.2), each link repeated to about n units.
const repeatTo = (link, n) => link.repeat(Math.max(1, Math.round(n / link.length)));
const CHAINS = [
  ['u, virama and seven, then anusvara', (n) => repeatTo('\u1025\u1039\u1047', n) + '\u1036'],
  ['ka, medial ha, then virama and u', (n) => '\u1000\u103E' + repeatTo('\u1039\u1025', n) + '\u102B'],
  ['a run of i, then ii', (n) => repeatTo('\u102D', n) + '\u102E'],
  ['ta, a run of zero, then ii', (n) => '\u1010' + repeatTo('\u1040', n) + '\u102E'],
  ['zero, anusvara and a space, repeated', (n) => repeatTo('\u1040\u1036 ', n) + '\u1032'],
  ['e and u, repeated, then aa', (n) => repeatTo('\u1031\u1025', n) + '\u102C']
].map(([id, make]) => ({ id, make }));

const ALL = SHAPES.concat(NFC_RUNS, CHAINS);

const FUNCTIONS = {
  normalize: (text) => normalize(text),
  'normalize with a report': (text) => normalize(text, { report: true }),
  isNormalized: (text) => isNormalized(text)
};

describe('growth of the 3.0 API (DESIGN.md §6.2)', () => {
  for (const [name, call] of Object.entries(FUNCTIONS)) {
    it(name + ' is linear on every shape, NFC run and settling chain', () => {
      assert.deepEqual(superLinear(call, ALL), []);
    });
  }

  it('normalize is linear on every pump', () => {
    assert.deepEqual(superLinear(FUNCTIONS.normalize, PUMPS), []);
  });
});
