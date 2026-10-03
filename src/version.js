// The two versions that compat and the 3.0 API export (DESIGN.md D8). Layer L0: imports nothing.

// The npm package version. It equals package.json's "version" (test/next/codes.test.mjs checks it), and stays
// at the 2.x release while the 3.0 core is built on next.
export const PACKAGE_VERSION = '2.10.0';

// The version of knayi's output (decision 33). Each deliberate output change adds 1, so a cache keyed on it knows
// when stored results are stale:
// 1  the output of 2.10.0 at the reference commit e5f6e24, which compat keeps (DESIGN.md §1.1);
// 2  3.0's normalize settles: it repeats its pass until it changes nothing (decision 36), and reads u, zero and
//    seven after a virama or under a kinzi as nya, wa and ra (DESIGN.md §11.2). It differs from 1 on no line of the
//    Unicode corpora, and on 199 of 14,304 raw mC4 lines, mostly Zawgyi.
export const OUTPUT_VERSION = 2;
