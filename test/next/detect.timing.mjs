// Growth of src/detect.js (docs/next/DESIGN.md §6.2 item 4). Owner: W4 (detect).
//
// The check runs every adversarial shape of SHAPES and every single-character pump of PUMPS (helpers.mjs), at n,
// 2n and 4n units, through:
//   countEvidence.
// The growth exponent must be at most 1.3 under Node and Bun, by the screening and confirming method of
// test/growth.timing.js.
//
// Stub (W0): it skips while the module is a skeleton stub. Once the module is built, it fails until its owner
// writes the check (§7.6), so a built module cannot land without one.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countEvidence } from '../../src/detect.js';
import { skipUntilBuilt } from './helpers.mjs';

const skip = skipUntilBuilt(() => countEvidence('\u1000'));

describe('growth of src/detect.js (DESIGN.md §6.2)', () => {
  it('is linear on every shape and pump', { skip }, () => {
    assert.fail('src/detect.js is built: write its growth check (DESIGN.md §6.2 item 4, §7.6)');
  });
});
