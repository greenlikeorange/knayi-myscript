// Growth of src/core/nfc.js (docs/next/DESIGN.md §6.2 item 4, §8). Owner: W1 (core).
//
// toNfc exists to take linear time where String#normalize('NFC') takes quadratic time: on a long run of
// non-starters out of canonical order. The check runs, at n, 2n and 4n units, through toNfc:
//   - the ten runs of marks of two combining classes that d170cd8 added to the 2.x growth shapes (Myanmar, Zawgyi,
//     Win, Latin, Greek, Hebrew, Arabic, Tibetan and astral marks);
//   - every adversarial shape of SHAPES and every single-character pump of PUMPS (helpers.mjs).
// The growth exponent must be at most 1.3 under Node and Bun. Each cell gets a quick reading, and a full one only
// when the quick one is high; a cell fails only when three full readings are all above the limit, as perf.mjs
// screens its cells (scripts/eval/perf.mjs screenedGrowth), since another process seldom spoils three in a row.
// String#normalize itself is measured on the first run too, and reported: it shows what the check would catch.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toNfc } from '../../src/core/nfc.js';
import { SHAPES, PUMPS } from './helpers.mjs';
import { growthExponent } from '../../scripts/eval/lib/timing.mjs';

const LIMIT = 1.3;
const cp = (...codes) => String.fromCodePoint(...codes);
const rep = (unit, n) => unit.repeat(Math.max(1, Math.round(n / unit.length)));
const KA = cp(0x1000);

// d170cd8's NFC shapes (scripts/eval/lib/inputs.mjs on the 2.x line). make(n) returns about n UTF-16 units.
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
    assert.deepEqual(highCells(NFC_SHAPES), []);
    const base = growthExponent((text) => text.normalize('NFC'), NFC_SHAPES[0].make, { samples: 2, sampleMs: 1 });
    t.diagnostic('String#normalize on ' + NFC_SHAPES[0].id + ': ' +
      (base.exponent === null ? 'over ' + base.ms.toFixed(0) + ' ms at n' : 'exponent ' + base.exponent.toFixed(2)));
  });

  it('toNfc is linear on every shape and pump', () => {
    assert.deepEqual(highCells(SHAPES.concat(PUMPS)), []);
  });
});
