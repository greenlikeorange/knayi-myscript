// Growth of src/stages/fonts.js (docs/next/DESIGN.md §6.2 item 4, §6.4). Owner: W6 (engine-fonts).
//
// The check runs, at n, 2n and 4n units (growthExponent of scripts/eval/lib/timing.mjs: n = 8,192 under Node,
// 1,024 under Bun), through fontToUnicode, Zawgyi and Win:
//   - every adversarial shape of SHAPES and every single-character pump of PUMPS (helpers.mjs). SHAPES holds the ten
//     runs of marks of two combining classes that d170cd8 added to the 2.x growth shapes (NFC_RUNS), which the fonts
//     write as they are typed when no base comes before them and NFC then has to reorder. core/nfc.js takes linear
//     time on them (W1 ported the 2.x helper, §7.3), so they have no exemption.
// The growth exponent must be at most 1.3 under Node and Bun. The method is perf's and test/growth.timing.js's:
// every cell gets a quick reading, and a cell that reads above the limit is measured in full three times, failing
// only when all three are above it, since another process or a garbage collection seldom spoils three in a row.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fontToUnicode } from '../../src/stages/fonts.js';
import { growthExponent } from '../../scripts/eval/lib/timing.mjs';
import { SHAPES, PUMPS } from './helpers.mjs';

const LIMIT = 1.3;

// A quick reading, then the lowest of three full ones when the quick one is above the limit.
function screenedGrowth(call, make) {
  const quick = growthExponent(call, make, { samples: 2, sampleMs: 1, warmMs: 1 });
  if (quick.exponent !== null && quick.exponent <= LIMIT) return { growth: quick, full: false };
  const tries = [growthExponent(call, make), growthExponent(call, make), growthExponent(call, make)];
  const value = (g) => (g.exponent === null ? Infinity : g.exponent);
  return { growth: tries.sort((x, y) => value(x) - value(y))[0], full: true };
}

const describeGrowth = (g) => (g.exponent === null ? 'over ' + g.ms.toFixed(0) + ' ms at ' + g.units + ' units'
  : 'exponent ' + g.exponent.toFixed(2) + ' (' + [g.ms, g.ms2, g.ms4].map((ms) => ms.toFixed(2)).join(', ') + ' ms)');

describe('growth of src/stages/fonts.js (DESIGN.md §6.2)', () => {
  for (const font of ['zawgyi', 'win']) {
    it(font + ': linear on every shape, pump and NFC run', (t) => {
      const call = (text) => fontToUnicode(text, font);
      const high = [];
      let measured = 0;
      for (const shape of SHAPES.concat(PUMPS)) {
        const { growth, full } = screenedGrowth(call, shape.make);
        if (full) measured++;
        if (growth.exponent === null || growth.exponent > LIMIT) high.push(shape.id + ': ' + describeGrowth(growth));
      }
      t.diagnostic(SHAPES.length + ' shapes, NFC runs among them, and ' + PUMPS.length + ' pumps; ' +
        measured + ' measured in full after a high first reading');
      assert.deepEqual(high, [], 'growth exponent above ' + LIMIT);
    });
  }
});
