// Seed and size of the fuzz and property tests. Pull requests run a fixed seed, so a failure always comes back;
// a long run sets both (the fuzz workflow, .github/workflows/fuzz.yml, does this each night at scale 100):
//
//   KNAYI_FUZZ_SEED=$RANDOM KNAYI_FUZZ_SCALE=100 npm run test:fuzz
//
// A failure prints the seed, fast-check's path and the shrunk counterexample. Add the counterexample to the
// regressions list of the property, so every later run checks it first.
//
// A test may also name its nightly count, the most a long run may use: test/next requires one for every property
// (docs/next/DESIGN.md D23), because scale 100 would turn a count of 200k into 20M strings, more than the fuzz
// job's 30 minutes allow. The 2.x tests name none, and scale as before.

const fc = require('fast-check');

const SEED = process.env.KNAYI_FUZZ_SEED ? Number(process.env.KNAYI_FUZZ_SEED) : 20261003;
const SCALE = process.env.KNAYI_FUZZ_SCALE ? Number(process.env.KNAYI_FUZZ_SCALE) : 1;
// A long run (the nightly job, or the acceptance gate by hand) also runs the sets that are not counts, such as
// every string of length 4 or less.
const LONG_RUN = SCALE > 1;

// count times SCALE, and at most nightlyCount when one is given.
function runs(count, nightlyCount) {
  const scaled = Math.max(1, Math.round(count * SCALE));
  return nightlyCount === undefined ? scaled : Math.min(scaled, nightlyCount);
}

// fc.assert with the shared seed, a run count scaled by KNAYI_FUZZ_SCALE (at most nightlyCount, when given), and
// the regressions run first.
function check(property, count, regressions, nightlyCount) {
  const params = { seed: SEED, numRuns: runs(count, nightlyCount) };
  if (regressions && regressions.length) params.examples = regressions;
  try {
    fc.assert(property, params);
  } catch (error) {
    error.message += '\nReplay with KNAYI_FUZZ_SEED=' + SEED + ' KNAYI_FUZZ_SCALE=' + SCALE +
      ', and add the counterexample to the regressions of this property.';
    throw error;
  }
}

module.exports = { SEED: SEED, SCALE: SCALE, LONG_RUN: LONG_RUN, runs: runs, check: check };
