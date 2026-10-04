// Growth of src/rules/detect.js (docs/next/DESIGN.md §6.2 item 4). Owner: W4 (detect).
//
// Every adversarial shape of SHAPES and every single-character pump of PUMPS (helpers.mjs) runs through
// countEvidence at n, 2n and 4n units (scripts/eval/lib/timing.mjs growthExponent: n is 8,192 under Node and
// 1,024 under Bun). The growth exponent per doubling must be at most 1.3, under Node and Bun. The method is the
// screening and confirming of test/growth.timing.js, as perf.mjs runs it: a quick first reading, and when that
// is above the limit, three full measurements, of which the lowest counts. Super-linear code reads high every
// time, while another process or a garbage collection seldom spoils three measurements in a row.
//
// The file runs after the other test files (package.json `test`), so nothing competes with it for the CPU.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countEvidence } from '../../src/rules/detect.js';
import { SHAPES, PUMPS } from './helpers.mjs';
import { growthExponent } from '../../scripts/eval/lib/timing.mjs';

const LIMIT = 1.3;

// The lowest exponent of up to three full measurements, after a quick reading above LIMIT.
function screenedGrowth(call, make) {
  const quick = growthExponent(call, make, { samples: 2, sampleMs: 1, warmMs: 1 });
  if (quick.exponent !== null && quick.exponent <= LIMIT) return quick;
  let lowest = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const full = growthExponent(call, make);
    if (full.exponent !== null && (lowest === null || full.exponent < lowest.exponent)) lowest = full;
    if (lowest !== null && lowest.exponent <= LIMIT) break;
  }
  return lowest || quick;
}

function describeGrowth(id, growth) {
  const exponent = growth.exponent === null ? 'none (too slow at n)' : growth.exponent.toFixed(2);
  return id + ': exponent ' + exponent + ' from ' + growth.units + ' units, ' + (growth.ms * 1000).toFixed(0) +
    ' µs at n';
}

describe('growth of src/rules/detect.js (DESIGN.md §6.2)', () => {
  let sink = 0;
  const call = (text) => {
    const evidence = countEvidence(text);
    sink += evidence.unicode + evidence.zawgyi;
  };

  for (const [name, inputs] of [['shape', SHAPES], ['pump', PUMPS]]) {
    it('countEvidence is linear on every ' + name + ' (' + inputs.length + ')', (t) => {
      const over = [];
      let highest = null;
      for (const input of inputs) {
        const growth = screenedGrowth(call, input.make);
        if (growth.exponent === null || growth.exponent > LIMIT) over.push(describeGrowth(input.id, growth));
        else if (highest === null || growth.exponent > highest.growth.exponent) highest = { id: input.id, growth };
      }
      if (highest) t.diagnostic('highest: ' + describeGrowth(highest.id, highest.growth));
      assert.deepEqual(over, [], 'grows faster than linear');
      assert.ok(sink >= 0);
    });
  }
});
