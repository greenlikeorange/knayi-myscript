# Evaluation on public data

`npm test` checks knayi against fixed examples. These scripts check it against public Zawgyi and Unicode text, next to a published knayi release, [myanmar-tools](https://github.com/google/myanmar-tools), and [Rabbit](https://github.com/Rabbit-Converter/Rabbit).

```bash
npm run eval                 # accuracy tables
npm run eval -- --json out.json
npm run bench                # speed on real text and long input
npm run bench -- --sweep     # also every code point and mark pair as a long input
```

They need Node 22 or newer and network access the first time. Downloads go to `.eval-cache/` (ignored by git) and are reused after that. Nothing is copied into the repository: some sources have no license or a non-commercial one.

| Variable | Default | Meaning |
| --- | --- | --- |
| `KNAYI_EVAL_BASELINE` | `2.8.3` | Published knayi version to compare with |
| `KNAYI_EVAL_CACHE` | `.eval-cache/` | Where downloads and the comparison packages go |

The comparison packages (`knayi-myscript@<baseline>`, `myanmar-tools@1.1.3`, `rabbit-node@1.0.4`) are installed into the cache, not into this project. myanmar-tools 1.2.0 on npm cannot be loaded, so 1.1.3 is used.

## Data

There is no large public corpus of human-typed Zawgyi with a human-checked Unicode version. The gold sets are small. The larger sets are real text with labels from tools, or real text without labels.

| Data | Used for | Size | License | Notes |
| --- | --- | --- | --- | --- |
| [google/language-resources `zawgyi_unicode_test.tsv`](https://github.com/google/language-resources/blob/master/my/zawgyi_unicode_test.tsv) | conversion, gold | 82 pairs | Apache-2.0 | Real snippets, one per Zawgyi code point. Unicode written by Google. |
| [CLDR `my-t-my-s0-zawgyi.txt`](https://github.com/unicode-org/cldr/blob/main/common/testData/transforms/my-t-my-s0-zawgyi.txt) | conversion, gold | 93 pairs | Unicode License | Expected output follows ICU, the converter myanmar-tools ships. |
| [sven-oly/Zawgyi-Unicode](https://github.com/sven-oly/Zawgyi-Unicode) 2018 top 10k search queries | detection | 8,481 labelled queries | none stated | Real typing. Labels come from myanmar-tools; only rows where its C++ and JS detectors agree are used. Contains adult queries. |
| [WaitZar `words.zawgyi.txt`](https://github.com/yathit/waitzar/blob/master/FontConvertTester/words.zawgyi.txt) | detection | 2,404 words | Apache-2.0 | Hand-typed Zawgyi dictionary words. |
| [FLORES-200](https://github.com/facebookresearch/flores/tree/main/flores200) `mya_Mymr` dev + devtest | Unicode flagged as Zawgyi | 2,009 sentences | CC BY-SA 4.0 | Clean, translated by professionals. |
| [Burmese Wikipedia](https://huggingface.co/datasets/wikimedia/wikipedia) `20231101.my` | Unicode flagged as Zawgyi; round trip; speed | 1,000 articles, sampled | CC BY-SA | Rows 0–99, 10,000–10,099, … through the datasets-server. |
| [John Okell, A Corpus of Modern Burmese](https://zenodo.org/records/1202324) | Unicode flagged as Zawgyi | whole file | CC BY 4.0 | |
| [GlotCC-V1](https://huggingface.co/datasets/cis-lmu/GlotCC-V1) Shan, Mon, S'gaw Karen, Pa'o | other languages flagged as Zawgyi | all documents (24–648 per language) | CC0 | Unicode that legitimately uses code points Zawgyi also uses. |
| [mC4](https://huggingface.co/datasets/allenai/c4) `c4-my` validation | web text without labels | 1 file | ODC-BY | About two thirds Zawgyi. Agreement with myanmar-tools only. |

GitHub files are pinned to a commit, mC4 to a revision, and every downloaded file to a sha256. A changed file prints a warning. The Hugging Face samples always come from the current revision.

## What is measured

- **Conversion, exact match.** Zawgyi → Unicode against the gold pairs. The round trip turns Wikipedia lines into Zawgyi with Rabbit and converts them back. Rabbit is left out of that row because it made the input.
- **Detection.** The share of real Zawgyi or Unicode text detected correctly.
- **Unicode flagged as Zawgyi.** Two numbers per engine. "default" is a plain `fontDetect(text)`, where a tie between the scores returns `'zawgyi'`. "evidence" passes `'unicode'` as the fallback, so only real Zawgyi evidence counts.
- **Web text.** How much each engine calls Zawgyi, and how often knayi agrees with myanmar-tools where myanmar-tools is confident.

Rows whose labels or expected outputs came from Google's tools favour myanmar-tools. The tables say which ones.

## Speed

`bench` reports the machine, then three things:

- **Real text:** FLORES and the Wikipedia sample, with their Zawgyi form made by Rabbit. Mean of 10 runs after 3 warm-ups.
- **Long input:** the inputs that took quadratic time before 2.9.1, with a stacked consonant in front so the conversion reaches the rule that was slow. One run each.
- **Sweep (`--sweep`):** every Myanmar code point repeated 30,000 times and every pair of marks repeated 10,000 times, through every call form. It flags any run over 250 ms.
