// Growth of src/core/nfc.js (docs/next/DESIGN.md §6.2 item 4, §8). Owner: W1 (core).
//
// toNfc exists to take linear time where String#normalize('NFC') takes quadratic time: on a long run of
// non-starters out of canonical order. The check runs, at n, 2n and 4n units, through toNfc:
//   - NFC_RUNS (helpers.mjs), the ten runs of marks of two combining classes that d170cd8 added to the 2.x growth
//     shapes (Myanmar, Zawgyi, Win, Latin, Greek, Hebrew, Arabic, Tibetan and astral marks);
//   - every adversarial shape of SHAPES and every single-character pump of PUMPS (helpers.mjs).
// The growth exponent must be at most 1.3 under Node and Bun. Each cell gets a quick reading, and a full one only
// when the quick one is high; a cell fails only when three full readings are all above the limit, as perf.mjs
// screens its cells (scripts/eval/perf.mjs screenedGrowth), since another process seldom spoils three in a row.
// String#normalize itself is measured on the first run too, and reported: it shows what the check would catch.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toNfc } from '../../src/core/nfc.js';
import { SHAPES, PUMPS, NFC_RUNS } from './helpers.mjs';
import { growthExponent } from '../../scripts/eval/lib/timing.mjs';

const LIMIT = 1.3;

// The lowest of three full readings, after a quick one above the limit.
function screenedExponent(call, make) {
  const quick = growthExponent(call, make, { samples: 2, sampleMs: 1, warmMs: 1 });
  if (quick.exponent !== null && quick.exponent <= LIMIT) return quick.exponent;
  let lowest = Infinity;
  for (let attempt = 0; attempt < 3 && lowest > LIMIT; attempt++) {
    const full = growthExponent(call, make);
    if (full.exponent !== null) lowest = Math.min(lowest, full.exponent);
  }
  return lowest;
}

function highCells(shapes) {
  const high = [];
  for (const shape of shapes) {
    const exponent = screenedExponent((text) => toNfc(text), shape.make);
    if (exponent > LIMIT) high.push(shape.id + ': ' + exponent.toFixed(2));
  }
  return high;
}

describe('growth of src/core/nfc.js (DESIGN.md §6.2)', () => {
  it('toNfc is linear on runs of marks of two classes', (t) => {
    assert.deepEqual(highCells(NFC_RUNS), []);
    const base = growthExponent((text) => text.normalize('NFC'), NFC_RUNS[0].make, { samples: 2, sampleMs: 1 });
    t.diagnostic('String#normalize on ' + NFC_RUNS[0].id + ': ' +
      (base.exponent === null ? 'over ' + base.ms.toFixed(0) + ' ms at n' : 'exponent ' + base.exponent.toFixed(2)));
  });

  it('toNfc is linear on every shape and pump', () => {
    assert.deepEqual(highCells(SHAPES.concat(PUMPS)), []);
  });
});
