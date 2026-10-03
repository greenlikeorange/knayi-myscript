# Evaluation on public data

`npm test` checks knayi against fixed examples. These scripts check it against public Zawgyi and Unicode text, next to a published knayi release, [myanmar-tools](https://github.com/google/myanmar-tools), and [Rabbit](https://github.com/Rabbit-Converter/Rabbit).

```bash
npm run eval                 # accuracy tables
npm run eval -- --json out.json
npm run eval -- --with-unlicensed   # also the 2018 query log, which has no license (local use only)
npm run bench                # speed on real text and long input
npm run bench -- --sweep     # also every code point and mark pair as a long input
npm run bench:page           # run both and rebuild docs/benchmark.html and docs/benchmark.json
```

They need Node 20.11 or newer and network access the first time. Downloads go to `.eval-cache/` (ignored by git) and are reused after that. Nothing is copied into the repository.

| Variable | Default | Meaning |
| --- | --- | --- |
| `KNAYI_EVAL_BASELINE` | `2.8.3` | Published knayi version to compare with |
| `KNAYI_EVAL_CACHE` | `.eval-cache/` | Where downloads, results, and the comparison packages go |

The comparison packages (`knayi-myscript@<baseline>`, `myanmar-tools@1.1.3`, `rabbit-node@1.0.4`) are installed into the cache, not into this project. myanmar-tools 1.2.0 on npm cannot be loaded, so 1.1.3 is used.

## Data

There is no large public corpus of human-typed Zawgyi with a human-checked Unicode version. The reference pairs are few, and the larger sets are real text with labels from tools, or real text without labels. Every set is measured on its distinct lines: pages repeat headings and boilerplate (Wikipedia's "references" heading alone appears hundreds of times in a sample).

| Data | Used for | Size | License | Notes |
| --- | --- | --- | --- | --- |
| [google/language-resources `zawgyi_unicode_test.tsv`](https://github.com/google/language-resources/blob/master/my/zawgyi_unicode_test.tsv) | conversion | 80 distinct pairs | Apache-2.0 | Real snippets, one per Zawgyi code point. Unicode written by Google. |
| [CLDR `my-t-my-s0-zawgyi.txt`](https://github.com/unicode-org/cldr/blob/main/common/testData/transforms/my-t-my-s0-zawgyi.txt) | conversion | 89 distinct pairs, 11 not in Google's file | Unicode License V3 | Most pairs repeat Google's file and are counted once there. Expected output follows ICU, the converter myanmar-tools ships, including at least one ICU ordering error (asat before tall aa). |
| [sven-oly/Zawgyi-Unicode](https://github.com/sven-oly/Zawgyi-Unicode) 2018 top 10k search queries | detection, **opt-in only** | 8,481 labelled queries | none stated | Read only with `--with-unlicensed` and never published. Real typing. Labels come from myanmar-tools; only rows where its C++ and JS detectors agree are used. Contains adult queries. |
| [WaitZar `words.zawgyi.txt`](https://github.com/yathit/waitzar/blob/master/FontConvertTester/words.zawgyi.txt) | detection | 2,390 distinct words; 2,082 measured | Apache-2.0 | Hand-typed Zawgyi dictionary words. The 308 that read the same in both encodings (neither Rabbit nor myanmar-tools changes them) are left out, since no detector can tell them apart. |
| [FLORES-200](https://github.com/facebookresearch/flores/tree/main/flores200) `mya_Mymr` dev + devtest | Unicode flagged as Zawgyi; speed | 2,009 sentences | CC BY-SA 4.0 | Clean, translated by professionals. |
| [Burmese Wikipedia](https://huggingface.co/datasets/wikimedia/wikipedia) `20231101.my` | Unicode flagged as Zawgyi; round trip; speed | 1,000 of 109,310 articles, 4,812 distinct lines | CC BY-SA 3.0 and GFDL | 25 random blocks of 40 articles, picked with a fixed seed. |
| [John Okell, A Corpus of Modern Burmese](https://zenodo.org/records/1202324) | Unicode flagged as Zawgyi | 16,924 distinct lines | CC BY 4.0 | |
| [GlotCC-V1](https://huggingface.co/datasets/cis-lmu/GlotCC-V1) Shan, Mon, S'gaw Karen, Pa'o | other languages flagged as Zawgyi | every document (24–648 per language) | CC0 1.0 | Unicode that legitimately uses code points Zawgyi also uses. Text from Common Crawl, whose terms of use apply. |
| [mC4](https://huggingface.co/datasets/allenai/c4) `c4-my` validation | web text without labels | 14,304 lines | ODC-BY | About two thirds Zawgyi. Agreement with myanmar-tools only. Text from Common Crawl. |

Every download must match a pinned sha256. GitHub files are also pinned to a commit, mC4 to a revision, and Okell to a Zenodo record; the FLORES URL has no version, so its hash is its only pin. Downloads are written to a temporary file first. A file that doesn't match is downloaded once more, and the run stops if it still doesn't match. The Hugging Face rows come from the current revision of each dataset, and a short or empty sample stops the run.

## What is measured

- **Conversion.** Zawgyi → Unicode against the reference pairs, as an exact match and after Unicode NFC normalization, which treats canonically equivalent spellings (ဦ as U+1025 U+102E or U+1026) as equal. The round trip turns Wikipedia lines into Zawgyi with Rabbit and converts them back. Rabbit is left out of that row because it made the input.
- **Detection.** The share of real Zawgyi recognised "on evidence", with fallback `'unicode'`, so a word only counts when the detector finds Zawgyi evidence.
- **Unicode flagged as Zawgyi.** Two numbers per engine. "default" is a plain `fontDetect(text)`, where a tie between the scores returns `'zawgyi'`. "evidence" passes `'unicode'` as the fallback. Lower is better, but a detector can lower it just by calling Zawgyi less often, so the page doesn't bold a winner; read it next to the detection table.
- **myanmar-tools** is scored with the thresholds of knayi's adapter: Zawgyi above p = 0.95, Unicode below 0.05, and the fallback in between.
- **Web text.** How much each engine calls Zawgyi, and how often knayi agrees with myanmar-tools where myanmar-tools is confident.

Rows whose labels or expected outputs came from Google's tools favour myanmar-tools. The tables say which ones.

## Speed

`bench` reports the machine, then three things:

- **Real text:** FLORES and the Wikipedia sample, with their Zawgyi form made by Rabbit. Mean of 10 runs after 3 warm-ups. Compare the ratio between versions, not absolute times.
- **Long input:** the inputs that took quadratic time before 2.9.1. A stacked consonant (U+1060) or a kinzi (U+1064) in front makes the conversion reach the rule that was slow. One run each.
- **Sweep (`--sweep`):** 1,059 long inputs through 8 call forms: every Myanmar code point repeated 30,000 times, every ordered pair of 29 marks repeated 10,000 times, and three base letters each followed by every mark. It flags any run over 250 ms.

## Published page

`npm run bench:page` runs both scripts and `report.mjs`, which writes `docs/benchmark.html` and the raw `docs/benchmark.json`. GitHub Pages serves `docs/` from `main`, so the page appears at <https://greenlikeorange.github.io/knayi-myscript/benchmark.html> once it is merged.

- **Licensed data only.** Every result row names its sources. `report.mjs` refuses any row whose source isn't openly licensed in `datasets.mjs`, and any run made with `--with-unlicensed`.
- **Aggregate numbers only.** It publishes percentages and timings, never the text itself, and lists every source with its size and license.
- **Rebuild on release.** Run `npm run bench:page` before a release and commit the two files. The page says which machine produced the timings and lists the limits of the evaluation.

## Win glyph table

`library/win.js` maps each code point of the Win fonts to the Unicode characters it stands for. Check the table against the font:

```bash
node scripts/eval/win-glyphs.mjs path/to/WININNWA.TTF          # writes .eval-cache/win-glyphs.html
node scripts/eval/win-glyphs.mjs path/to/WININNWA.TTF --out page.html
```

The page shows every entry twice: the Win glyph in the Win font, and the Unicode text knayi converts it to, in Noto Sans Myanmar or an installed Myanmar font. Each pair should show the same letters. The Win fonts are freeware with all rights reserved, so use your own copy; the page embeds it and must not be published. `research/win-fonts.md` has the background.
