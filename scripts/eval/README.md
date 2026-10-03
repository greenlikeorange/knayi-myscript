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

## Comparing two copies

`npm run compare` runs two copies of knayi side by side and reports every call whose output differs. A refactor must show 0 differences; a change made on purpose states its exact counts.

```bash
npm run compare                                   # this working tree against origin/main
npm run compare -- --base origin/main --head .    # the same, spelled out
npm run compare -- --base . --head min:.          # main.js against the min.js built from it, run in a vm
npm run compare -- --offline                      # generated and fuzz inputs only: no corpus cache, no network
npm run compare -- --without mc4                  # every corpus but mC4, as CI runs it
npm run compare -- --expect normalize:ksw=15 --expect normalize:all=66
```

A copy is named by a spec: a path (`.` is this working tree), a git ref (`origin/main`, `v2.9.1`, `git:HEAD~1`) unpacked read-only with `git archive` into a temporary directory, `npm:<version>` for a release that is already installed (in `node_modules/` or the eval cache; nothing is downloaded), or `min:` and `mjs:` followed by a dist file or by any of these, which builds that copy's dist files with its own `scripts/build.js` in a temporary directory. Both copies run in one process, each as its own module instance, so `--base . --head .` is a valid A/A check. In CI, fetch the base first, since a shallow checkout has no `origin/main`; `.github/workflows/test.yml` checks out with full history.

CI keeps a corpus cache without mC4 and without the query log (CONTRIBUTING.md, licence policy), so it runs with `--without mc4`. Only a push to the default branch fills that cache, with `node scripts/eval/datasets.mjs --fetch --without mc4`. Every run restores it, pull requests from forks included (they may read the base branch's cache), and a run with a cold cache uses `--offline`. A pull request labelled DELIBERATE writes its counts in its description as `--expect form:set=n`, and CI passes them with `--skip-missing-sets`, which lists and skips the counts for sets the run does not have (mC4, the legacy `wikipedia-v1` sample, and every corpus when it runs offline); CI also drops `all` totals, which add up sets it does not read.

Every public call form is compared (`scripts/eval/lib/callForms.mjs`): normalize; fontConvert from Zawgyi, Win and a detected font to Unicode, and from Unicode to Zawgyi; the four `fontConvert.debugging` forms; fontDetect with the default and the `unicode` fallback; syllBreak with `unicode`, `zawgyi` and a detected font; spellingFix with both fonts; and truncate at 10, 30, 60 and 120 characters. A string result is compared as it is, any other value as its JSON, and a throw by its error class only. A form an old base release lacks is skipped; a form the base has and the head lacks fails the run, in compare and in perf.

The inputs (`scripts/eval/lib/inputs.mjs`) are the distinct lines of every cached corpus (see [Data](#data)), the reference pairs with both columns, and the first Wikipedia sample when an older cache still holds it; every Myanmar code point alone, doubled and in every ordered pair after က (25,920 strings); Myanmar Extended-A, -B and -C and the spaces and joiners around Myanmar text; `generated.rows`, every probe the tests hold (the main and edge probes of `test/fixtures/tables.json`, the strings of the README and ARCHITECTURE.md examples and the contract matrix's content probes), alone and next to ka, a digit, a space, `u` and `1`, which reaches rules of four or more characters that the pairs do not; Win text, every printable Latin-1 character alone and before every printable ASCII character (18,145) and the Windows-1252 and C1 characters next to ASCII; and three seeded fuzz sets (`--fuzz`, `--seed`). The Win forms read the Win sets and the generated and fuzz Myanmar sets; every other form reads all Myanmar sets.

A differing cell prints its count and first examples with code points. `--expect form:set=n` lists a deliberate difference (`all` as the set counts the form's total), and every cell not listed must be 0; the exit status is 1 otherwise. The work is split over one worker thread per CPU: about 2.5 million comparisons take 4 s on a 16-core laptop and use about 50 s of CPU time in all. Run it under Bun with `bun scripts/eval/compare.mjs`.

## Speed of a change

`npm run perf` times two copies against each other, named as for `compare`, and reports only their ratio: absolute times on the same machine drift by 10-25% between runs, while two identical copies timed this way stay within a few percent.

```bash
npm run perf                              # this working tree against origin/main, under Node and Bun
npm run perf -- --base HEAD               # an A/A run: how much the ratios move when nothing changed
npm run perf -- --runtimes node --forms normalize,fontConvert.zawgyi-unicode
npm run perf -- --offline                 # growth exponents only; no corpus cache needed
```

- **Rows.** Every call form except three of the truncate lengths, on the same text in four shapes: a call per line (400 FLORES lines), a call per word, one call on the lines joined by spaces, and one on the lines joined by line breaks. `--long-units <n>` repeats the lines in the last two until they are n units long, for goals set on long text (the 3.0 core reads its one-string goals at 2,000,000). Zawgyi forms read that text converted by the base copy, and Win forms a synthetic Win version of it (speed only). Both copies run in one process, interleaved: 3 rounds over all rows, each with 7 runs per copy that alternate which copy goes first, and each run repeats the workload until it takes 10 ms. A row's ratio is the median over the rounds; the round range is printed beside it. Under Bun a full garbage collection runs before each timed run, and a row of one call (string, document) reads each copy's fastest round instead of the median: JavaScriptCore compiles a one-pass scanner that has run on lines and words in one of two ways, round to round, so such a row can read 0.6 in one round and 1.2 in the next (the 3.0 core's countEvidence took about 290 or about 590 µs per call on one string, and every round of the fontDetect forms alone read 0.38-0.45).
- **Growth exponents.** Every adversarial shape (`SHAPES` in `lib/inputs.mjs`: the plan's 26 long-input shapes, the shapes of `test/performance.test.js` and the 2.10 quadratic ones) through 10 call forms, and every character the growth test draws from repeated alone and after ka (`PUMPS`, 272 runs) through normalize, conversion to Unicode from Zawgyi, Win and a detected font, Unicode to Zawgyi, syllBreak and spellingFix, at n, 2n and 4n units: log2(t(4n)/t(n))/2, so 1 is linear and 2 quadratic. Each t is the fastest of three timings, since interference only adds time. Under Node n is 8,192: at 1,024 a quadratic term with a small constant still reads close to linear (a normalize that rescanned its prefix at every eighth character read at most 1.25 there, and up to 1.65 at 8,192). Larger sizes mislead: once strings pass 64k units, V8 stores them as large objects and linear code costs about three times as much per unit, which reads as 1.3-2.2 across that step. Under Bun n stays 1,024, because the cost per unit of linear code climbs from about 4k units. Each of the 2,264 cells first gets a quick reading (two samples of 1 ms per size); one above the limit is measured in full three times, and the cell fails only when all three readings are above it. The growth part takes about 25 s per runtime on a laptop.
- **Limits.** The run fails (exit status 1) when a growth exponent of the head is above 1.3 (`--max-exponent`) or a Node row is more than 20% slower than the base (`--max-slowdown`). Bun rows are reported, and those more than 10% slower are listed for a written reason. A full run takes about 2 minutes on a laptop: about 40 s of rows and 20 s of growth per runtime.

On an M3 Max shared with other jobs, an A/A run (`--base HEAD`) gave Node rows between 0.97 and 1.02 (single rounds 0.96 to 1.03) and Bun rows between 0.96 and 1.06 (single rounds 0.91 to 1.09); the highest growth exponent was 1.05 under Node and 1.11 under Bun. With `--growth both` against origin/main, which does not have the 2.10 normalize fix yet, its six quadratic shapes read 1.4-2.0 for the base.

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

Every download must match a pinned sha256. GitHub files are also pinned to a commit, mC4 to a revision, and Okell to a Zenodo record; the FLORES URL has no version, so its hash is its only pin, and the two files taken out of its archive are pinned too. Downloads are written to a temporary file first. A file that doesn't match is downloaded once more, and the run stops if it still doesn't match.

The Hugging Face rows come from the current revision of each dataset, so a new download can hold other rows than the published results used. Each sample file in the cache is pinned by its sha256 in `HF_SAMPLES`, and a sample that doesn't match stops the run, as does a short or empty one. To adopt a new sample on purpose:

```bash
node scripts/eval/datasets.mjs --check                        # compare the cache with the pins; downloads nothing
node scripts/eval/datasets.mjs --fetch --without mc4          # download what the cache lacks, except mC4, then check it
node scripts/eval/datasets.mjs --refresh-samples wikipedia    # download a sample again and print its sha256
```

Then review the change and update the sha256 in `HF_SAMPLES`. Caches made before the Wikipedia sample was redrawn also hold the first sample, `hf-wikipedia.json` (10,732 distinct lines, no article in common with the current one). Nothing downloads it any more; `loadAll({ withLegacy: true })` returns it when it is there and matches its pin.

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
- **Named code and data.** `run.mjs` and `bench.mjs` record the code they measured as `code`: the commit, `dirty` when `main.js`, `library/`, `scripts/` or `package.json` have uncommitted changes, and `libraryHash`, the sha256 of `main.js` and every file under `library/`. `report.mjs` refuses results from two different code states, shows the commit on the page and writes `code` at the top of `benchmark.json`. Each data set in the eval results carries the sha256 it is pinned to.

## Win glyph table

`library/win.js` maps each code point of the Win fonts to the Unicode characters it stands for. Check the table against the font:

```bash
node scripts/eval/win-glyphs.mjs path/to/WININNWA.TTF          # writes .eval-cache/win-glyphs.html
node scripts/eval/win-glyphs.mjs path/to/WININNWA.TTF --out page.html
```

The page shows every entry twice: the Win glyph in the Win font, and the Unicode text knayi converts it to, in Noto Sans Myanmar or an installed Myanmar font. Each pair should show the same letters. The Win fonts are freeware with all rights reserved, so use your own copy; the page embeds it and must not be published. `research/win-fonts.md` has the background.
