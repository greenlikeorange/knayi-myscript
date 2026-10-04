// The two versions that compat and the 3.0 API export (DESIGN.md D8). Layer L0: imports nothing.

// The npm package version. It equals package.json's "version" (test/next/codes.test.mjs checks it); a release
// commit changes both (CONTRIBUTING.md, release checklist).
export const PACKAGE_VERSION = '3.0.0-next.0';

// The version of knayi's output, of both APIs (decision 33), so a cache keyed on it knows when stored results are
// stale. A dataset holds only released output, so changes between two releases share one number: the first change
// after a release raises it (scripts/next/output-version.mjs checks this in CI). A move of compat's 2.x reference to
// other output raises it too, since the number names compat's output as well (CONTRIBUTING.md, "The public API
// stays stable"):
// 1  the output of 2.10.0 at the reference commit e5f6e24, which compat kept until 3;
// 2  3.0's normalize settles: it repeats its pass until it changes nothing (decision 36), and reads u, zero and
//    seven after a virama or under a kinzi as nya, wa and ra (DESIGN.md §11.2). It differs from 1 on no line of the
//    Unicode corpora, and on 199 of 14,304 raw mC4 lines, mostly Zawgyi. The 3.0 API's other changes before 3.0.0,
//    such as white space ending a syllable (DESIGN.md §11.6), are part of 2;
// 3  the port of the 2.x line's 2.11 (DESIGN.md §8): compat gives 2.11.0's output, and the two fixes of 2.11 that
//    lie in the core change both APIs alike: Zawgyi and Win to Unicode make the typos before the look-alikes, as
//    normalize does (decision 15), and Unicode to Zawgyi writes stacked jha as U+1069, as myanmar-tools does (2.x
//    05de555).
export const OUTPUT_VERSION = 3;
