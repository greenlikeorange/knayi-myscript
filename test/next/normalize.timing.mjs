// Growth of src/engine/normalizeStages.js and src/engine/unicodeReader.js (docs/next/DESIGN.md §6.2 item 4, §6.4,
// §7.7). Owner: W5 (engine-unicode).
//
// Every adversarial shape of SHAPES and every single-character pump of PUMPS (helpers.mjs) runs at n, 2n and 4n
// units through reorderUnicode and through normalizeText, and the growth exponent must be at most 1.3, under Node
// and Bun. The method is perf's (scripts/eval/lib/timing.mjs growthExponent, as scripts/eval/perf.mjs screens and
// confirms it): a quick first reading, and a reading above the limit is measured three more times, the lowest
// kept, so a case fails only when super-linear time shows every time.
//
// Known (until the port of the 2.x linear NFC helper, DESIGN.md §8): String#normalize itself takes quadratic time
// on a long run of combining marks it must reorder, such as dot below with virama, and normalize ends with NFC. That
// probe is a TODO test here, as in test/growth.timing.js; the reader alone must be linear on it. None of SHAPES and
// PUMPS is such a run. This file runs after the other tests (package.json `test`), like test/growth.timing.js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText } from '../../src/engine/normalizeStages.js';
import { reorderUnicode } from '../../src/engine/unicodeReader.js';
import { growthExponent, timeOnce } from '../../scripts/eval/lib/timing.mjs';
import { SHAPES, PUMPS, skipUntilBuilt } from './helpers.mjs';

const LIMIT = 1.3;
const skip = skipUntilBuilt(() => normalizeText('\u1000'));

// A quick reading, then, above the limit, the lowest of three full readings (perf.mjs screenedGrowth).
function screenedGrowth(call, make) {
  const quick = growthExponent(call, make, { samples: 2, sampleMs: 1, warmMs: 1 });
  if (quick.exponent !== null && quick.exponent <= LIMIT) return quick;
  const tries = [growthExponent(call, make), growthExponent(call, make), growthExponent(call, make)];
  const value = (g) => (g.exponent === null ? Infinity : g.exponent);
  return tries.sort((a, b) => value(a) - value(b))[0];
}

// The cases whose exponent is above the limit, as messages.
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

const readText = (text) => reorderUnicode(text).text;
const KA = '\u1000';
// ka, then dot below and virama repeated: the run NFC reorders in quadratic time (test/growth.timing.js).
const DOT_BELOW_VIRAMA = { id: 'ka + (dot below, virama) run', make: (n) => KA + '\u1037\u1039'.repeat(n >> 1) };
// The 2.10.0 quadratic normalize: ka, then zero-width space and aa, a million times (refactor plan PR 0.0).
const ZWSP_AA_MILLION = KA + '\u200B\u102C'.repeat(1000000);

// The fastest of three calls, in ms.
const fastest = (fn) => Math.min(timeOnce(fn), timeOnce(fn), timeOnce(fn));

describe('growth of reorderUnicode (DESIGN.md §6.2)', () => {
  it('is linear on every shape', () => {
    assert.deepEqual(superLinear(readText, SHAPES), []);
  });

  it('is linear on every pump', () => {
    assert.deepEqual(superLinear(readText, PUMPS), []);
  });

  it('is linear on the run NFC reorders in quadratic time', () => {
    assert.deepEqual(superLinear(readText, [DOT_BELOW_VIRAMA]), []);
  });
});

describe('growth of normalizeText (DESIGN.md §6.2)', () => {
  it('is linear on every shape', { skip }, () => {
    assert.deepEqual(superLinear((text) => normalizeText(text), SHAPES), []);
  });

  it('is linear on every pump', { skip }, () => {
    assert.deepEqual(superLinear((text) => normalizeText(text), PUMPS), []);
  });

  it('takes under 100 ms on ka, then zero-width space and aa a million times (the 2.10.0 quadratic path)', { skip },
    (t) => {
      const ms = fastest(() => normalizeText(ZWSP_AA_MILLION));
      t.diagnostic(ms.toFixed(1) + ' ms');
      assert.ok(ms < 100, ms.toFixed(1) + ' ms');
    });
});

describe('known super-linear time', () => {
  it('normalizeText on ka, then dot below and virama repeated', {
    skip, todo: 'String#normalize reorders a long run of combining marks in quadratic time; the port of the 2.x ' +
      'linear NFC helper (DESIGN.md §8) makes this linear'
  }, (t) => {
    // One quick reading: the probe only reports, and a full one takes seconds on quadratic time.
    const growth = growthExponent((text) => normalizeText(text), DOT_BELOW_VIRAMA.make,
      { samples: 2, sampleMs: 1, warmMs: 1 });
    if (growth.exponent !== null && growth.exponent <= LIMIT) t.diagnostic('now linear: drop this probe');
    assert.ok(growth.exponent !== null && growth.exponent <= LIMIT, 'exponent ' + growth.exponent);
  });
});
