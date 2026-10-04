# Segmentation: research notes

Notes behind the default of knayi 3.0's `segmentSyllables`, `syllableBoundaries` and `truncate`, from October 2026: how a bare consonant is read, the corpus counts, and why the default is `'separate'` (decision 34 of the refactor plan; docs/next/DESIGN.md §11.6).

## Summary

- A **bare consonant** is a consonant with no mark of its own: no vowel sign, medial, asat or stacked consonant. It is read with its inherent vowel, as a syllable of its own: ပထမ is three syllables, ပ, ထ and မ.
- 2.x's `syllBreak` joins bare consonants **in pairs**: ကကက is ကက|က, and ပထမဆုံး is ပထ|မဆုံး. Its own comment says every bare consonant joins the next syllable, which one global replace cannot do, since it never looks again at a consonant it has just joined (DESIGN.md §10 Q11).
- 3.0 offers three readings, `bareConsonants: 'separate'`, `'chains'` and `'pairs'`, and reads `'separate'` by default: it is the only one whose pieces are syllables whatever the consonants around them.
- 2.x also joins a letter after white space to the syllable before it. Under `'separate'` and `'chains'`, white space separates syllables: `ကောင်း မောင်` is `ကောင်း ` and `မောင်`. Only `'pairs'` keeps 2.x's join (§4).
- The price: the pieces of 94–100% of Burmese lines differ from 2.x's. `bareConsonants: 'pairs'` keeps 2.x's breaks, and compat's `syllBreak` is unchanged.

## 1. The three readings

The break scanners of `src/rules/segment.js` find the breaks of 2.x's 15 break rules (`src/spec/breakRules.js`: 7 for Unicode, 8 for Zawgyi) in one pass. One rule of each font, U7 for Unicode and Z8 for Zawgyi, joins a bare consonant to what follows it. The three policies differ only there (`BARE_CONSONANTS`):

| Policy | A bare consonant | ကကက | ပထမဆုံး |
| --- | --- | --- | --- |
| `pairs` (2.x) | joins the next consonant, unless it was itself just joined to the one before (`legacyBareConsonantPair`) | ကက\|က | ပထ\|မဆုံး |
| `chains` | joins the syllable after it, with every bare consonant before it, as 2.x's comment meant | ကကက | ပထမဆုံး |
| `separate` | is a syllable of its own | က\|က\|က | ပ\|ထ\|မ\|ဆုံး |

Under `pairs`, which bare consonants join depends on how many stand in a row: the same word breaks one way at the start of a run and another way after an odd number of bare consonants. Under `chains`, a piece can hold any number of syllables. Neither gives a fixed unit.

Under all three policies, a consonant with asat stays with the syllable before it, as its final; a stacked consonant stays with the consonant above it; and in Zawgyi, a syllable starts at the ေ or medial ra typed before its consonant. White space is where they part (§4): under `pairs`, as in 2.x, no piece starts right after white space, or at a consonant right after an opening bracket, quote or dash; under `chains` and `separate`, a syllable after white space starts a piece, and so do the opening marks typed right before a syllable. Every policy keeps every character: the pieces of `segmentSyllables` join back to the text (`test/next/api/segment.test.mjs`, on fuzz, under every policy and font).

## 2. The counts

Distinct lines of each corpus with a character of U+1000–U+109F, segmented through the 3.0 API. mC4 is raw web text, mostly Zawgyi, and is read with `from: 'zawgyi'`; the others with `from: 'unicode'`. For each corpus: the lines whose pieces under `chains` and under `separate` differ from `pairs`; the pieces of each policy; and the pieces of `pairs` and of `chains` that hold more than one syllable of `separate`.

| Corpus | Lines | `chains` differs | `separate` differs | Pieces: `pairs` / `chains` / `separate` | Pieces of 2+ syllables: `pairs` / `chains` |
| --- | ---: | ---: | ---: | --- | --- |
| FLORES-200 | 2,009 | 2,009 (100%) | 2,009 (100%) | 65,805 / 82,744 / 94,504 | 21,684 (33.0%) / 11,017 (13.3%) |
| Wikipedia sample (v2) | 4,812 | 4,309 (89.5%) | 4,505 (93.6%) | 120,363 / 156,268 / 180,713 | 44,148 (36.7%) / 21,267 (13.6%) |
| Okell's corpus | 16,924 | 15,452 (91.3%) | 15,952 (94.3%) | 588,013 / 807,703 / 926,287 | 248,545 (42.3%) / 109,825 (13.6%) |
| mC4, read as Zawgyi | 14,304 | 13,257 (92.7%) | 13,784 (96.4%) | 618,033 / 774,647 / 923,016 | 230,190 (37.2%) / 136,018 (17.6%) |
| GlotCC Shan | 9,923 | 7,332 (73.9%) | 7,444 (75.0%) | 186,348 / 240,191 / 242,763 | 46,648 (25.0%) / 2,421 (1.0%) |
| GlotCC Mon | 2,270 | 2,110 (93.0%) | 2,200 (96.9%) | 76,094 / 95,473 / 116,896 | 30,472 (40.0%) / 18,602 (19.5%) |

`test/next/api/segment.test.mjs` ("the counts decision 34 chose the default policy from") recounts these on the corpus cache and fails when one moves. It skips without the cache; `npm run eval` or `node scripts/eval/datasets.mjs --fetch` fills it.

In the Burmese corpora, 13–14% of the pieces of `chains` hold two or more syllables, all joined by bare consonants, and so do 18% of mC4's and 20% of Mon's. A third or more of the pieces of `pairs` do, since it also joins across white space. Shan writes few bare consonants, so `chains` and `separate` differ little there.

## 3. The decision: `separate`

- **It is the syllable.** A bare consonant carries its inherent vowel and is pronounced as a syllable of its own, often a reduced one (the သ of သတင်း). `separate` is the only policy whose pieces are syllables in every context.
- **It is a fixed unit.** A syllable count, a syllable-based tokenizer or an n-gram model needs the same word to give the same pieces wherever it stands. Under `pairs` it depends on the parity of the run before it; under `chains` on the length of the run.
- **It changes the most lines against 2.x**, as any policy but `pairs` must: 2.x joins bare consonants, and almost every line has one. The change is in the pieces only: no character is added, dropped or moved.
- **The other readings stay available.** `bareConsonants: 'pairs'` gives 2.x's breaks on the text 2.x breaks (`segment.test.mjs` checks it on fuzz against `syllBreak` of the cleaned text), and `'chains'` the reading 2.x's comment described.

The same default applies to `truncate`, which cuts at a syllable break: the pangram of MIGRATION.md's `truncate` examples, cut at 30, ends at the bare ဇ under `separate` and before it under `pairs`.

## 4. White space

2.x deletes the break before a letter after white space (rows U6 and Z7), and before a consonant, or a Zawgyi ေ or medial ra, after white space or an opening bracket, quote or dash (rows U3 and Z4), kept from 2.x without recorded evidence. 2.x had a reason: `syllBreak` wrote U+200B between the pieces of a text, and a space already separated its words. An array of pieces has none, and as first built 3.0 kept these rows under every policy, so `segmentSyllables('ကောင်း မောင်')` was one piece, `'ကောင်း\nမောင်'` one piece across the line break, and `'မင်္ဂလာပါ မြန်မာ'` gave `'ပါ မြန်'`. Of the `separate` pieces, these held two or more syllables for that reason alone: 16,598 of 77,128 in FLORES (21.5%), 35,597 of 142,962 in Wikipedia (24.9%), 211,675 of 700,205 in Okell (30.2%), 164,532 of 750,691 in mC4 (21.9%), 45,284 of 188,791 in Shan (24.0%) and 20,024 of 95,757 in Mon (20.9%). A piece of two syllables is what §3 holds against `pairs` and `chains`.

So under `separate` and `chains` (`spaceSeparates` in `src/rules/segment.js`):

- **A syllable after white space or a line break starts a piece,** and the white space ends the piece before it, as U+200B does: `ကောင်း မောင်` is `ကောင်း ` and `မောင်`.
- **The opening marks typed right before a syllable start its piece**, whatever is before them: `ကောင်း (မောင်)` is `ကောင်း ` and `(မောင်)`, and `ကောင်း(မောင်)` is `ကောင်း` and `(မောင်)`. The review that found the white space asked this only after white space; but a bracket typed straight after a word would then still join two syllables, and Okell has 4,464 such brackets, Wikipedia 320 hyphens and 101 brackets.
- **Text before the first syllable is a piece of its own**, white space included, as text in other scripts there already was: `' မြန်'` is `' '` and `'မြန်'`. Opening marks that start the text stay with the syllable after them. Elsewhere, digits, punctuation and text in other scripts stay with the syllable before them.
- **A consonant with asat after white space** is still the final of the syllable before it (row U5), as Zawgyi's kinzi still is (row Z6): neither starts a syllable.

`pairs` keeps 2.x's join, so that `bareConsonants: 'pairs'` still gives 2.x's breaks. Over every distinct line of every cached corpus, at lengths 10 to 120, under each policy and font, 3.0's `truncate` gives another text in 72 of 2,333,052 calls, each one that ended in an opening mark before the omission (`(ဥ`, an independent vowel after a bracket, which row U3 does not join). The counts of §2 are with this change.

## 5. What 3.0 segmentation still does as 2.x did

- **The Zawgyi break classes disagree** about U+106A and U+106B (DESIGN.md §10 Q17): both class edits together fix 16 lines, and wait for a deliberate pull request of the 2.x line.
- **No detection:** `from` is `'unicode'` unless the caller says `'zawgyi'`. 2.x's `syllBreak` detected the font when none was named.

## 6. How this was checked, and what was not

- The counts above are machine counts on the cached corpora, recounted by `segment.test.mjs`. No piece of any line was checked by hand for this note.
- That `separate` gives the syllables of UTN #11 rests on the definition of a bare consonant above, not on a hand-segmented reference: knayi has no hand-segmented Burmese set.

## 7. Open questions

- A hand-segmented sample, from a source whose licence allows it (CONTRIBUTING.md), would show how often each policy matches a person's syllables, minor syllables included.
- Whether a policy that joins a bare consonant only to a stacked consonant's syllable (Pali loans such as ကမ္ဘာ) would help any user has not been measured.
- Mon and Shan have their own syllable structures; the break rules were written for Burmese, and their counts here describe what the rules do, not whether the pieces are right.
