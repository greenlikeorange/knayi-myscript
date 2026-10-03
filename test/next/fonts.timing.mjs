// Growth of src/engine/fontStages.js (docs/next/DESIGN.md §6.2 item 4, §6.4). Owner: W6 (engine-fonts).
//
// The check runs, at n, 2n and 4n units (growthExponent of scripts/eval/lib/timing.mjs: n = 8,192 under Node,
// 1,024 under Bun), through fontToUnicode, Zawgyi and Win:
//   - every adversarial shape of SHAPES and every single-character pump of PUMPS (helpers.mjs);
//   - the ten runs of marks of two combining classes that d170cd8 added to the 2.x growth shapes, which the fonts
//     write as they are typed when no base comes before them and NFC then has to reorder. core/nfc.js takes
//     linear time on them (W1 ported the 2.x helper, §7.3), so they have no exemption; this file adds them until
//     the merge of main brings them into SHAPES (§6.2 item 4, §8).
// The growth exponent must be at most 1.3 under Node and Bun. The method is perf's and test/growth.timing.js's:
// every cell gets a quick reading, and a cell that reads above the limit is measured in full three times, failing
// only when all three are above it, since another process or a garbage collection seldom spoils three in a row.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fontToUnicode } from '../../src/engine/fontStages.js';
import { growthExponent } from '../../scripts/eval/lib/timing.mjs';
import { SHAPES, PUMPS } from './helpers.mjs';

const LIMIT = 1.3;
const cp = (...codes) => String.fromCodePoint(...codes);
const rep = (unit, n) => unit.repeat(Math.max(1, Math.round(n / unit.length)));
const KA = cp(0x1000);

// d170cd8's NFC shapes (scripts/eval/lib/inputs.mjs on the 2.x line), as test/next/core-nfc.timing.mjs has them.
// make(n) returns about n UTF-16 units.
const NFC_SHAPES = [
  ['ka + (dot below + virama) run', (n) => KA + rep(cp(0x1037, 0x1039), n)],
  ['(dot below + virama) run', (n) => rep(cp(0x1037, 0x1039), n)],
  ['Win (virama + h) run', (n) => rep(cp(0x1039) + 'h', n)],
  ['ka + (asat + dot below) run', (n) => KA + rep(cp(0x103A, 0x1037), n)],
  ['Latin a + (acute + dot below) run', (n) => 'a' + rep(cp(0x301, 0x323), n)],
  ['Greek alpha + (ypogegrammeni + U+0344) run', (n) => cp(0x3B1) + rep(cp(0x345, 0x344), n)],
  ['Hebrew bet + (dagesh + qamats) run', (n) => cp(0x5D1) + rep(cp(0x5BC, 0x5B8), n)],
  ['Arabic beh + (shadda + fatha) run', (n) => cp(0x628) + rep(cp(0x651, 0x64E), n)],
  ['Tibetan ka + (U+0F73 + U+0F39) run', (n) => cp(0xF40) + rep(cp(0xF73, 0xF39), n)],
  ['x + (U+1D16D + U+1D165) run', (n) => 'x' + rep(cp(0x1D16D, 0x1D165), n)]
].map(([id, make]) => ({ id, make }));

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

describe('growth of src/engine/fontStages.js (DESIGN.md §6.2)', () => {
  for (const font of ['zawgyi', 'win']) {
    it(font + ': linear on every shape, pump and NFC run', (t) => {
      const call = (text) => fontToUnicode(text, font);
      const high = [];
      let measured = 0;
      for (const shape of SHAPES.concat(PUMPS, NFC_SHAPES)) {
        const { growth, full } = screenedGrowth(call, shape.make);
        if (full) measured++;
        if (growth.exponent === null || growth.exponent > LIMIT) high.push(shape.id + ': ' + describeGrowth(growth));
      }
      t.diagnostic(SHAPES.length + ' shapes, ' + PUMPS.length + ' pumps and ' + NFC_SHAPES.length + ' NFC runs; ' +
        measured + ' measured in full after a high first reading');
      assert.deepEqual(high, [], 'growth exponent above ' + LIMIT);
    });
  }
});
