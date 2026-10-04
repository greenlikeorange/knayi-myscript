# Detection ties: research notes

Notes behind how knayi 3.0 reads a text whose detection ties, from October 2026: what a tie is, what reading it as Zawgyi did to Unicode text in 2.x, the recount on the cached corpora, and the cost to short Zawgyi text (decision 13 of the refactor plan; docs/next/DESIGN.md §11.5).

## Summary

- knayi detects Zawgyi by counting the matches of 29 signatures, 12 of Unicode and 17 of Zawgyi. A text whose two counts are equal **ties**: a single consonant, a word whose only telling sign is a stacked consonant (U+1039 is Unicode's virama and Zawgyi's visible asat), and every text with none of the signs.
- 2.x's `fontDetect` answers its fallback for a tie, and `fontConvert(text, 'unicode')` with no source names none, so a tie reads as Zawgyi and the text is converted. Every corpus line knayi is checked on is Unicode, so every such conversion that changes a line damages it: 168 of the 4,812 Wikipedia lines, 553 of the 16,924 Okell lines.
- 3.0's `detectEncoding` answers `'unknown'` for a tie, and `toUnicode` with no source leaves a line that ties as it is: 0 Wikipedia lines and 3 Okell lines change. `tie: 'zawgyi'` gives 2.x's reading back.
- The cost falls on short Zawgyi text with no source named: of Google's 80 Zawgyi and Unicode pairs, 2.x converts 79 right and 3.0 49. With `from: 'zawgyi'`, 3.0 converts all 80. So the documentation says: name the source for short text.

## 1. The recount

The plan's figures (504 Wikipedia lines damaged, 2 after) were counted on the first Wikipedia sample, which the eval tooling no longer produces, so decision 13 asked for a recount before settling. The counts below are distinct lines of each cached corpus, all Unicode:

- **Ties:** lines whose evidence ties (`detectEncoding(line).encoding === 'unknown'`);
- **2.x:** lines that `fontConvert(line, 'unicode')` changes (compared with the line trimmed, since 2.x trims);
- **3.0:** lines that `toUnicode(line)` changes.

| Corpus | Distinct lines | Ties | 2.x changes | of which ties | 3.0 changes |
| --- | ---: | ---: | ---: | ---: | ---: |
| FLORES-200 | 2,009 | 0 | 0 | 0 | 0 |
| Wikipedia sample v2 | 4,812 | 242 | 168 | 168 | 0 |
| Wikipedia sample v1 (the plan's figures) | 10,732 | 703 | 504 | 502 | 2 |
| Okell's corpus (the plan's figures) | 16,924 | 1,092 | 553 | 550 | 3 |
| GlotCC Shan | 9,923 | 593 | 540 | 531 | 9 |
| GlotCC Mon | 2,270 | 230 | 215 | 202 | 13 |
| GlotCC S'gaw Karen | 673 | 115 | 606 | 113 | 493 |
| GlotCC Pa'o | 770 | 96 | 85 | 85 | 0 |

`test/next/api/convert.test.mjs` ("the tie damage of decision 13") records the 2.x and 3.0 columns and checks that `toUnicode(line, { tie: 'zawgyi' })` changes as many lines as 2.x on every corpus; it skips without the corpus cache. The plan's v1 figures hold: 504 and 2 on the first Wikipedia sample, 553 and 3 on Okell.

**What 3.0 still changes** reads as Zawgyi, not as a tie: the lines whose Zawgyi evidence outweighs their Unicode evidence. The 493 S'gaw Karen lines are three quarters of that corpus: U+1064 is S'gaw Karen's tone mark and Zawgyi's kinzi, and the detector's row Z11 counts it as Zawgyi, 6,659 times in those lines. That is the detector's to fix, in a deliberate change of its own; until then, a caller who knows the text is Unicode says `from: 'unicode'`, or does not convert it.

**Ties 2.x left unchanged:** of the 242 Wikipedia ties, 74 have nothing that conversion from Zawgyi would change, so 2.x's reading did them no harm.

## 2. The cost: short Zawgyi text

Google's `language-resources` file of Zawgyi and Unicode pairs (80 pairs, 78 of them single words) is the eval data's set of short Zawgyi text with a known Unicode form. Converted with no source named, and compared with the Unicode column (both trimmed):

| | Right |
| --- | ---: |
| 2.x `fontConvert(zawgyi, 'unicode')` | 79 |
| 3.0 `toUnicode(zawgyi)` | 49 |
| 3.0 `toUnicode(zawgyi, { tie: 'zawgyi' })` | 79 |
| 3.0 `toUnicode(zawgyi, { from: 'zawgyi' })` | 80 |

`convert.test.mjs` records these four counts. The 30 pairs that 2.x gets right and 3.0 does not all tie, and 3.0 leaves each as typed: short Zawgyi words often have none of the signs, just as short Unicode words do. A tie carries no information about the encoding, so either reading is a guess, and knayi 3.0 guesses the way that changes nothing.

## 3. The decision

- **A tie is reported, not guessed:** `detectEncoding` answers `'unknown'`, and the evidence counts come with it, so a caller can apply a policy of its own.
- **`toUnicode` with no source leaves a tie as it is** (`tie: 'unicode'`, the default), and `tie: 'zawgyi'` restores 2.x's reading. For a corpus of mixed encodings, which is what detection is for, the damage of the guess falls on correct text; leaving it falls on text that was already wrong.
- **Each line is detected on its own.** 2.x detected the whole text once, so one Zawgyi line could carry its Unicode neighbours into a conversion (`ျမန္မာ\nမြန်မာ` converted its Unicode line too). 3.0 converts a text as its lines convert alone, which is also what lets `createConverter` stream it.
- **Name the source for short text.** README and MIGRATION.md say so at `toUnicode`; with `from`, nothing is guessed.

The same reading applies to `explain`, which reports a line as Zawgyi only when it reads as Zawgyi, and to the command's `to-unicode`, `--tie` included.

## 4. How this was checked, and what was not

- The counts are machine counts of distinct lines, on the corpus cache pinned by sha256 in `scripts/eval/datasets.mjs`, recounted by `convert.test.mjs`. `npm run compare` between compat and the 3.0 API (MIGRATION.md) gives the same differences: 168 Wikipedia lines, 550 Okell lines.
- No changed line was checked by hand for this note: every line of these corpora is Unicode, so a line that conversion changes is damaged whatever the change is.
- The Google pairs are compared as strings; a pair 3.0 gets wrong with no source named is one it leaves as typed.

## 5. Open questions

- myanmar-tools' model (`zawgyiDetector`) decides many short texts the rules tie on; its thresholds then decide what is `'unknown'`. Its effect on these counts has not been measured here.
- The Karen tone mark U+1064 makes the rules call S'gaw Karen text Zawgyi. A signature change is a deliberate output change of the detector, for both APIs, and needs its own counts.
