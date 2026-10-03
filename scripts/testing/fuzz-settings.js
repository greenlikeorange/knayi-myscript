// Seed and size of the fuzz and property tests. Pull requests run a fixed seed, so a failure always comes back;
// a long run sets both:
//
//   KNAYI_FUZZ_SEED=$RANDOM KNAYI_FUZZ_SCALE=40 node --test test/fuzz.test.js test/properties.test.js
//
// A failure prints the seed, fast-check's path and the shrunk counterexample. Add the counterexample to the
// regressions list of the property, so every later run checks it first.

const fc = require('fast-check');

const SEED = process.env.KNAYI_FUZZ_SEED ? Number(process.env.KNAYI_FUZZ_SEED) : 20261003;
const SCALE = process.env.KNAYI_FUZZ_SCALE ? Number(process.env.KNAYI_FUZZ_SCALE) : 1;

function runs(count) {
  return Math.max(1, Math.round(count * SCALE));
}

// fc.assert with the shared seed, a run count scaled by KNAYI_FUZZ_SCALE, and the regressions run first.
function check(property, count, regressions) {
  const params = { seed: SEED, numRuns: runs(count) };
  if (regressions && regressions.length) params.examples = regressions;
  try {
    fc.assert(property, params);
  } catch (error) {
    error.message += '\nReplay with KNAYI_FUZZ_SEED=' + SEED + ' KNAYI_FUZZ_SCALE=' + SCALE +
      ', and add the counterexample to the regressions of this property.';
    throw error;
  }
}

module.exports = { SEED: SEED, SCALE: SCALE, runs: runs, check: check };
