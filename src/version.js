// The two versions that compat and the 3.0 API export (DESIGN.md D8). Layer L0: imports nothing.

// The npm package version. It equals package.json's "version" (test/next/codes.test.mjs checks it), and stays
// at the 2.x release while the 3.0 core is built on next.
export const PACKAGE_VERSION = '2.10.0';

// The version of knayi's output (decision 33): 1 is the output of 2.10.0 at the reference commit e5f6e24. Each
// deliberate output change adds 1, so a cache keyed on it knows when stored results are stale.
export const OUTPUT_VERSION = 1;
