# Segmentation: research notes

Notes behind the default of knayi 3.0's `segmentSyllables`, `syllableBoundaries` and `truncate`, from October 2026: how a bare consonant is read, the corpus counts, and why the default is `'separate'` (decision 34 of the refactor plan; docs/next/DESIGN.md §11.6).

## Summary

- A **bare consonant** is a consonant with no mark of its own: no vowel sign, medial, asat or stacked consonant. It is read with its inherent vowel, as a syllable of its own: ပထမ is three syllables, ပ, ထ and မ.
- 2.x's `syllBreak` joins bare consonants **in pairs**: ကကက is ကက|က, and ပထမဆုံး is ပထ|မဆုံး. Its own comment says every bare consonant joins the next syllable, which one global replace cannot do, since it never looks again at a consonant it has just joined (DESIGN.md §10 Q11).
- 3.0 offers three readings, `policy: 'separate'`, `'chains'` and `'pairs'`, and reads `'separate'` by default: it is the only one whose pieces are syllables whatever the consonants around them.
- The price: the pieces of 79–99% of Burmese lines differ from 2.x's. `policy: 'pairs'` keeps 2.x's breaks, and compat's `syllBreak` is unchanged.

## 1. The three readings

The break scanners of `src/rules/segment.js` find the breaks of 2.x's 15 break rules (`src/spec/breakRules.js`: 7 for Unicode, 8 for Zawgyi) in one pass. One rule of each font, U7 for Unicode and Z8 for Zawgyi, joins a bare consonant to what follows it. The three policies differ only there (`BARE_CONSONANTS`):

| Policy | A bare consonant | ကကက | ပထမဆုံး |
| --- | --- | --- | --- |
| `pairs` (2.x) | joins the next consonant, unless it was itself just joined to the one before (`legacyBareConsonantPair`) | ကက\|က | ပထ\|မဆုံး |
| `chains` | joins the syllable after it, with every bare consonant before it, as 2.x's comment meant | ကကက | ပထမဆုံး |
| `separate` | is a syllable of its own | က\|က\|က | ပ\|ထ\|မ\|ဆုံး |

Under `pairs`, which bare consonants join depends on how many stand in a row: the same word breaks one way at the start of a run and another way after an odd number of bare consonants. Under `chains`, a piece can hold any number of syllables. Neither gives a fixed unit.

Everything else is the same under the three policies: a consonant with asat stays with the syllable before it, as its final; a stacked consonant stays with the consonant above it; in Zawgyi, a syllable starts at the ေ or medial ra typed before its consonant; and no piece starts right after white space, or at a consonant right after an opening bracket, quote or dash. Every policy keeps every character: the pieces of `segmentSyllables` join back to the text (`test/next/api/segment.test.mjs`, on fuzz, under every policy and font).

## 2. The counts

Distinct lines of each corpus with a character of U+1000–U+109F, segmented through the 3.0 API. mC4 is raw web text, mostly Zawgyi, and is read with `font: 'zawgyi'`; the others with `font: 'unicode'`. For each corpus: the lines whose pieces under `chains` and under `separate` differ from `pairs`; the pieces of each policy; and the pieces of `pairs` that hold more than one syllable of `separate`.

| Corpus | Lines | `chains` differs | `separate` differs | Pieces: `pairs` / `chains` / `separate` | `pairs` pieces of 2+ syllables |
| --- | ---: | ---: | ---: | --- | ---: |
| FLORES-200 | 2,009 | 377 (18.8%) | 1,985 (98.8%) | 65,805 / 65,368 / 77,128 | 10,597 (16.1%) |
| Wikipedia sample (v2) | 4,812 | 1,013 (21.1%) | 3,801 (79.0%) | 120,363 / 118,517 / 142,962 | 20,393 (16.9%) |
| Okell's corpus | 16,924 | 3,885 (23.0%) | 14,156 (83.6%) | 588,013 / 581,621 / 700,205 | 104,143 (17.7%) |
| mC4, read as Zawgyi | 14,304 | 4,963 (34.7%) | 12,779 (89.3%) | 618,033 / 602,322 / 750,691 | 129,206 (20.9%) |
| GlotCC Shan | 9,923 | 94 (0.9%) | 1,426 (14.4%) | 186,348 / 186,219 / 188,791 | 2,401 (1.3%) |
| GlotCC Mon | 2,270 | 834 (36.7%) | 2,024 (89.2%) | 76,094 / 74,334 / 95,757 | 17,918 (23.5%) |

`test/next/api/segment.test.mjs` ("the counts decision 34 chose the default policy from") recounts these on the corpus cache and fails when one moves. It skips without the cache; `npm run eval` or `node scripts/eval/datasets.mjs --fetch` fills it.

In the Burmese corpora, 16–18% of the pieces of `pairs` hold two or more syllables, and so do 21% of mC4's and 24% of Mon's. Shan writes few bare consonants, so the policy changes little there.

## 3. The decision: `separate`

- **It is the syllable.** A bare consonant carries its inherent vowel and is pronounced as a syllable of its own, often a reduced one (the သ of သတင်း). `separate` is the only policy whose pieces are syllables in every context.
- **It is a fixed unit.** A syllable count, a syllable-based tokenizer or an n-gram model needs the same word to give the same pieces wherever it stands. Under `pairs` it depends on the parity of the run before it; under `chains` on the length of the run.
- **It changes the most lines against 2.x**, as any policy but `pairs` must: 2.x joins bare consonants, and almost every line has one. The change is in the pieces only: no character is added, dropped or moved.
- **The other readings stay available.** `policy: 'pairs'` gives 2.x's breaks on the text 2.x breaks (`segment.test.mjs` checks it on fuzz against `syllBreak` of the cleaned text), and `'chains'` the reading 2.x's comment described.

The same default applies to `truncate`, which cuts at a syllable break: the pangram of MIGRATION.md's `truncate` examples, cut at 30, ends at the bare ဇ under `separate` and before it under `pairs`.

## 4. What 3.0 segmentation still does as 2.x did

- **No break after white space** before a letter, or after an opening bracket, quote or dash before a consonant (rows U3 and U6, kept from 2.x without recorded evidence). So `segmentSyllables('ကောင်း မောင်')` is one piece, and text in other scripts, digits and punctuation stay with the syllable before them. A caller who counts syllables splits on white space first.
- **The Zawgyi break classes disagree** about U+106A and U+106B (DESIGN.md §10 Q17): both class edits together fix 16 lines, and wait for a deliberate pull request of the 2.x line.
- **No detection:** `font` is `'unicode'` unless the caller says `'zawgyi'`. 2.x's `syllBreak` detected the font when none was named.

## 5. How this was checked, and what was not

- The counts above are machine counts on the cached corpora, recounted by `segment.test.mjs`. No piece of any line was checked by hand for this note.
- That `separate` gives the syllables of UTN #11 rests on the definition of a bare consonant above, not on a hand-segmented reference: knayi has no hand-segmented Burmese set.

## 6. Open questions

- A hand-segmented sample, from a source whose licence allows it (CONTRIBUTING.md), would show how often each policy matches a person's syllables, minor syllables included.
- Whether a policy that joins a bare consonant only to a stacked consonant's syllable (Pali loans such as ကမ္ဘာ) would help any user has not been measured.
- Mon and Shan have their own syllable structures; the break rules were written for Burmese, and their counts here describe what the rules do, not whether the pieces are right.
