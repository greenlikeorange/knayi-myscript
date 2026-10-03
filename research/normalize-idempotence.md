# normalize, idempotent: research notes

Notes behind knayi 3.0's `normalize`, from October 2026: why 2.x's `normalize` could change its own output, how the 3.0 one settles in one call, and on what evidence (decision 36 of the refactor plan; docs/next/DESIGN.md §11.2). [research/normalize.md](normalize.md) covers the rules themselves, which 3.0 keeps.

## Summary

- 2.x's `normalize` is one pass of five stages: NFC, the Unicode reader, the typos, the look-alikes, NFC. A stage can leave text that an earlier stage would read differently, so a second call can change the result again (DESIGN.md §10 Q12). It happens on garbled text only: no line of the Unicode corpora, and 104 of the 14,304 raw mC4 lines.
- A dataset normalized twice should not change the second time, and a check such as `isNormalized` needs a fixed point to check against. So 3.0 makes `normalize(normalize(x)) === normalize(x)` hold for every string, by construction.
- The construction: two targeted changes make every chain of passes short, then the pass is repeated, only on the parts of the text the first pass changed, until it changes nothing.
- 3.0's `normalize` gives 2.x's result on every line of the Unicode corpora, costs 1–6% more time, and raises `OUTPUT_VERSION` from 1 to 2.

## 1. How a second pass changes 2.x's output

The pass reads the text once, stage by stage, and never looks back. Fuzzing it finds two kinds of chain.

**Short chains**, where one stage gives another work that the next pass does:

| Input | 2.x, first call | 2.x, second call | What happens |
| --- | --- | --- | --- |
| U+1040 U+103D U+0020 U+103E | U+101D U+103D U+0020 U+103E | U+101D U+103D U+103E | A digit takes no mark across a space; once the look-alikes have made the zero a wa, the reader drops the space before the medial ha. |
| U+1010 U+102B U+1039 U+1040 | U+1010 U+102B U+1039 U+101D | U+1010 U+1039 U+101D U+102B | The look-alikes make the zero a wa after the reader has kept it out of the stack. |
| U+101D U+1038 U+102D U+1025 U+102C | U+101D U+102D U+1038 U+1025 U+102C | U+101D U+102D U+1038 U+1009 U+102C | The reader decides whether u stays u on the unit typed before it, an i, after which Pa'o keeps u; it writes a visarga there, and the next pass reads the u as nya. |
| U+102D U+102E U+102D | U+102E U+102D | U+102E | With no consonant, the marks are not sorted, and the typo rule joins one i and ii per pass. |

3.0's `normalize` gives the text of the last column in one call, for each row.

**Unbounded chains**, which settle one link per pass:

- a run of i (U+102D) ending in ii (U+102E) with no consonant before it: the typo rule joins one pair per pass. 60 i and one ii take 2.x 60 calls that change the text;
- u, zero or seven after a virama, which the reader leaves out of the stack, and which the next pass stacks once the look-alikes have made it nya, wa or ra: 60 links of U+1025 U+1039 U+1047, then an anusvara, take 2.x 61 calls.

`test/next/api/normalize.test.mjs` holds the known classes as regressions, each with the text 2.x settles on, and `test/next/api/normalize.fuzz.test.mjs` the pumped chains.

## 2. The options

- **Repeat the whole pass until nothing changes.** Correct, but the unbounded chains make it quadratic: a chain of n links needs n passes over the whole text. knayi treats super-linear time as a security bug (SECURITY.md).
- **Change the stages so that one pass is enough.** Each chain above would need its own lookahead in another stage, coupling the stages and their gates; the short chains are not all known.
- **Bound the chains, then repeat the pass where it changed the text.** This is what 3.0 does.

## 3. The construction

`normalizeTextStable` (`src/stages/normalize.js`):

1. **Two targeted changes make every chain bounded.** `STABLE_NORMALIZE_STAGES` has the stages and ids of 2.x's `NORMALIZE_STAGES`, with two runs replaced:
   - `settleTypos` (`src/rules/typingFixes.js`) reads each run of i and ii, or u and uu, whole: a run that holds both signs becomes its count of ii (or uu), which is what repeating the typo rule ends with, since joining an i to an ii keeps the ii and two ii never join.
   - `STABLE_UNICODE_READING` (`src/engine/unicodeReader.js`, `stackedLookAlikesAreLetters`) reads u, zero and seven right after a virama, or under a kinzi, as nya, wa and ra: only a consonant stands there (UTN #11), and these are the units typed for the consonant they look like ([research/normalize.md](normalize.md) §3).
2. **The first pass records where it wrote.** Each stage after the first NFC records its edits in an edit log (`src/core/edits.js`). A pass that records nothing is the result: the text was settled. A change of the first NFC alone needs no second pass, since the stages after it found nothing to change in its output.
3. **The pass is repeated on each region that holds an edit**, until it changes nothing, at most `MOST_NORMALIZE_PASSES` (16) times. A region starts at the start of the text, or at a syllable base or Burmese digit whose unit before is below U+0300 and is neither `.` nor `,`.

**Why a region can be settled on its own.** No stage reads or writes across a region start:

- NFC: the base is a starter that no canonical composition takes as its second half, so NFC composes nothing across it and moves no mark across it;
- the reader: the base closes the open syllable; a pending ေ or medial ra waits only for a base right after it, which the unit before is not; u decides on the unit before it, which is no vowel sign;
- the typos read only Myanmar units, and the lagaung rule reads the unit before a four, which is no Burmese digit;
- the look-alikes read at most two units around a zero, seven, wa or ra, the second only across `.` or `,`, and a unit below U+0300 that is neither is no digit, sign, letter or mark of a word;
- the final NFC is as the first, and where its gate stays closed it changes nothing.

So a pass over a text is a pass over each of its regions, and a region the first pass left as it was is a fixed point already. On ordinary text the regions the first pass changed are a few words.

## 4. Evidence

All on Node 26.5.

| Check | Result | Where |
| --- | --- | --- |
| Idempotent on fuzzed strings: the alphabet of the fuzz tests, structured Burmese with typing slips, and any UTF-16 units | 0 failures in 1,000,000 strings of each kind (`KNAYI_FUZZ_SCALE=20 KNAYI_FUZZ_SEED=31337`, about 18 s); `npm test` runs 50,000 of each, seeded | `normalize.fuzz.test.mjs` |
| Settles in few passes | at most 3 passes over the whole text, on fuzz and on every pumped chain at 3, 10 and 40 links | `normalize.fuzz.test.mjs` |
| A pass is local to regions | a pass over `a + c + b`, with a region start at `b`, is the pass over `a + c` and over `b`, on 30,000 strings (600,000 nightly) | `normalize.fuzz.test.mjs` |
| The text 2.x settles on | where no u, zero or seven stands after a virama or under a kinzi, `normalize` equals 2.x's `normalize` repeated until it changes nothing, on 50,000 strings (1,000,000 at scale 20); 3.0 gives each 60-link chain of §1 in one call | `normalize.fuzz.test.mjs` |
| Corpora | no line of FLORES-200, the Wikipedia samples v1 and v2, Okell's corpus, WaitZar, or GlotCC Shan, Mon, S'gaw Karen and Pa'o differs from 2.x's `normalize`; every line of every corpus is idempotent | `normalize.test.mjs`; `npm run compare` against compat (MIGRATION.md) |
| Raw mC4, mostly Zawgyi | 199 of 14,304 lines differ from 2.x: the 104 that 2.x changes again on a second call, now settled, and 95 with u, zero or seven after U+1039, which is Zawgyi's asat and Unicode's virama | `normalize.test.mjs` |
| Fuzz sets of `npm run compare` (seed 20261003) | 266 of 35,452 strings differ from 2.x | MIGRATION.md |

The counts are distinct lines. No changed line was checked by hand for this note: every change is either 2.x's own second pass or the stacked reading of §3.

## 5. Cost

**Time.** The 3.0 `normalize` against compat's, which runs 2.x's single pass on the same core, timed interleaved, median of 9 rounds of 7 runs (Node 26.5, October 2026): per line, FLORES 1.01, Wikipedia v2 1.01, Okell 1.03; one document of each corpus, 1.00, 1.02 and 1.03. When the API was built, against the core's 2.x `normalizeText` directly, per line, word, string and document: FLORES 1.02, 1.05, 1.02, 1.01; Wikipedia v2 1.02, 1.05, 1.02, 1.01; Okell 1.04, 1.06, 1.04, 1.03 (DESIGN.md §11.2). The work order allowed 10%. `test/next/api/api.timing.mjs` holds `normalize` linear on the adversarial shapes and the settling chains: a first version looked for the end of a long region once per edit, and read a growth exponent of 1.98.

**Size.** The stable reading in the shared reader, `settleTypos` and the edit log cost compat 343 B gzip and the core's normalize-only bundle 276 B (DESIGN.md §11.3); an import of the 3.0 `normalize` alone is 9,200 B (`node scripts/next/size.mjs`).

**Output.** `OUTPUT_VERSION` is 2 for this change (decision 33). compat keeps 2.x's single pass, and with it `OUTPUT_VERSION` 1's output.

## 6. Open questions

- The stacked reading of u, zero and seven is the one change that is not 2.x's own second pass. It follows the rule that only a consonant stands after a virama; mC4's 95 lines with it are Zawgyi text, where U+1039 is the asat, and `normalize` is not for Zawgyi.
- `MOST_NORMALIZE_PASSES` (16) is a guard, not a measured need: no input found so far takes more than 3 passes. A region still changing after 16 keeps the last pass's text, and would break idempotence; the fuzz tests would find such an input.
