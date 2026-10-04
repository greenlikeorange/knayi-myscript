# knayi-myscript

knayi reads Burmese and the other languages written in the Myanmar script. It tells Zawgyi from Unicode, converts Zawgyi and Win Innwa text to Unicode and Unicode to Zawgyi, puts Unicode text in the storage order of [UTN #11](https://www.unicode.org/notes/tn11/) with its common typing slips fixed, splits text into syllables, and lists what is wrong with a text and where. It does not segment dictionary words, translate, or tokenize for a language model.

This is knayi 3.0, version 3.0.0-next.0, a prerelease built on the `next` branch. MIT license.

- **For data pipelines:** every function keeps nothing between calls, takes its options per call and throws errors with a `code`. [Streams](#streams-knayi-myscriptstream) and the [`knayi` command](#command-line) take input of any size a line at a time, from JavaScript, the shell or Python, and [`OUTPUT_VERSION`](#version-and-output_version) changes with every deliberate change to any output, so a dataset can record which output it holds.
- **For 2.x users:** the 2.x API is still here, with 2.x's output, as `knayi-myscript/compat`. [MIGRATION.md](MIGRATION.md) says what to change, call by call, and counts what changes in the output when you move to the 3.0 API.

The [demo](https://greenlikeorange.github.io/knayi-myscript/) runs the 2.x API of knayi 2.9.1 in the browser.

**Contents:** [Install](#install) · [Quick start](#quick-start) · [The 3.0 API](#the-30-api) · [Errors](#errors) · [Streams](#streams-knayi-myscriptstream) · [Command line](#command-line) · [Runtimes and browsers](#runtimes-and-browsers) · [The 2.x API](#the-2x-api-knayi-myscriptcompat) · [Build](#build) · [Contributing](#contributing)

## Install

npm, Yarn, pnpm and Bun all install from the npm registry. The prereleases of 3.0 are on its `next` tag; without the tag you get 2.x.

```bash
npm install knayi-myscript@next
yarn add knayi-myscript@next
pnpm add knayi-myscript@next
bun add knayi-myscript@next
```

3.0 needs Node.js 22.12 or newer, or Bun; browsers load a file of `dist/` ([Runtimes and browsers](#runtimes-and-browsers)). knayi has no runtime dependencies.

## Quick start

### Clean a corpus in Node

A file of any size, a line at a time: each line that reads as Zawgyi is converted to Unicode, and every line is then normalized. The output equals `normalize(toUnicode(text))` on the whole file.

```javascript
import fs from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { createConverter, createNormalizer } from 'knayi-myscript/stream'

await pipeline(
  fs.createReadStream('corpus.txt'),
  createConverter(),
  createNormalizer(),
  fs.createWriteStream('corpus.clean.txt')
)
```

Records you already hold in memory go through the same two functions. Store `OUTPUT_VERSION` with them, so you know when a later knayi would write something else:

```javascript
import { normalize, toUnicode, OUTPUT_VERSION } from 'knayi-myscript'

const cleaned = records.map((record) => ({
  ...record,
  text: normalize(toUnicode(record.text)),
  knayiOutputVersion: OUTPUT_VERSION
}))
```

With no source named, `toUnicode` detects each line, and leaves a line whose evidence ties as it is. When you know the source, name it, as you should for short text: `toUnicode(text, { from: 'zawgyi' })`. To see what `normalize` would change before you change it, use [`explain`](#explaintext-options).

### From the shell and Python

The package installs the command `knayi`, the same functions over files and standard input, as plain text or [JSON Lines](#json-lines):

```bash
npm install --global knayi-myscript@next
knayi to-unicode --jsonl corpus.jsonl | knayi normalize --jsonl > corpus.clean.jsonl
```

From Python, run it as a process. Every other field of a record passes through byte for byte.

```python
import json
import subprocess

records = [{"id": 1, "text": "ေကာင္း ေမာင္"}, {"id": 2, "text": "ယောကျ်ား"}]
lines = "".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records)
unicode = subprocess.run(["knayi", "to-unicode", "--jsonl"], input=lines, capture_output=True, encoding="utf-8", check=True)
cleaned = subprocess.run(["knayi", "normalize", "--jsonl"], input=unicode.stdout, capture_output=True, encoding="utf-8", check=True)
print([json.loads(line) for line in cleaned.stdout.splitlines()])
# [{'id': 1, 'text': 'ကောင်း မောင်'}, {'id': 2, 'text': 'ယောက်ျား'}]
```

### In the browser

The script build sets the global `knayi`:

```html
<script src="https://unpkg.com/knayi-myscript@3.0.0-next.0/dist/knayi-myscript.min.js"></script>
<script>
  document.body.textContent = knayi.toUnicode('မဂၤလာပါ', { from: 'zawgyi' })
</script>
```

The module build has the same functions as named exports:

```html
<script type="module">
  import { detectEncoding, toUnicode } from 'https://unpkg.com/knayi-myscript@3.0.0-next.0/dist/knayi-myscript.min.mjs'
</script>
```

With a bundler, import from `knayi-myscript` as in Node: an import of `normalize` alone adds about 9 KB gzipped, and the whole API about 21 KB ([Runtimes and browsers](#runtimes-and-browsers)).

## The 3.0 API

```javascript
import * as knayi from 'knayi-myscript'
import { normalize, toUnicode } from 'knayi-myscript'
```

```javascript
const knayi = require('knayi-myscript')
```

Every function takes the text first and its options second, as an object of camelCase keys.

- **Strings only.** A text that is not a string, a `String` object included, throws a `TypeError` with the code `ERR_KNAYI_INVALID_ARG_TYPE`: `normalize(null)` throws, where 2.x returned `''` and printed a warning. [Errors](#errors) lists the codes.
- **Options.** `undefined`, `null` or a number in place of the options means none, so `lines.map(normalize)` works: `Array#map` passes the index there. An option that is `undefined` or `null` takes its default. A key the function does not take throws a `RangeError` with the code `ERR_KNAYI_INVALID_ARG_VALUE`, whose message names the option meant when it can: `segmentSyllables(text, { font: 'zawgyi' })` says `did you mean options.from?`, and 2.x's names (`fontType`, `use_myanmartools`, `adapter`, `myanmartools_zg_threshold`, `silent_mode`) say what replaced them. Otherwise a misspelt or borrowed option would be ignored and the text read another way than asked. A name has one spelling, exactly as written: `{ from: 'Zawgyi' }` throws the same `RangeError`. `src/index.d.ts` describes each option.
- **Nothing is kept** between calls, and nothing is written to the console. knayi loads no code: myanmar-tools' detector is passed in as an option.
- **Nothing is trimmed.** Spaces and line breaks around the text stay (only `truncate` drops the white space before its omission), and so do zero-width characters, except where a function moves one typed inside a syllable to the end of that syllable, as [normalize](#normalizetext-options) and [toUnicode](#zawgyi-to-unicode) do.
- **Offsets count UTF-16 units**, as JavaScript strings do.

The examples below call `knayi.`, as `import * as knayi from 'knayi-myscript'` names the API. The tests run each one and check the value in its comment.

### normalize(text, options)

Puts Unicode text in the storage order of [UTN #11](https://www.unicode.org/notes/tn11/), fixes common typing slips and look-alike digits, and returns NFC. It is written for Burmese, and keeps Mon, Shan, Karen and Pa'o letters as they are. It is for Unicode text: convert Zawgyi with [toUnicode](#tounicodetext-options) first.

```javascript
knayi.normalize('ယောကျ်ား') // 'ယောက်ျား'
knayi.normalize('မိြုင်မိြုင်\nဆိုင်ဆုိင်') // 'မြိုင်မြိုင်\nဆိုင်ဆိုင်'
knayi.normalize(' မိြုင် ') // ' မြိုင် '
knayi.normalize('လည်းေကာင်း') // 'လည်းကောင်း'
knayi.normalize('ဘ၀ ၄ဝဝ ၁၉၇၇') // 'ဘဝ ၄၀၀ ၁၉၇၇'
knayi.normalize('ကိီ') // 'ကီ'
knayi.normalize('ဝ') // 'ဝ'
knayi.normalize('e\u0301') // '\u00e9'  (no Myanmar letter: NFC only)
```

- **Order:** marks typed in any order are sorted, and a mark typed twice counts once. Asat goes where UTN #11 puts it (ကျွန်ုပ်, ခ်ျ, ရှ်), and the dot below comes before asat, as NFC requires.
- **Zawgyi typing habits:**
  - ေ or medial ra typed before its consonant moves after it: `လည်းေကာင်း` is လည်းကောင်း.
  - A space typed before a mark is dropped (`သုံ း` is သုံး). A line break stays.
- **Look-alikes:** only clear cases change.
  - ဝ and ရ inside a number are digits: `၄ဝဝ` is ၄၀၀.
  - ၀ and ၇ that carry a vowel sign or start a closed syllable are letters, as is ၀ inside a word: `ဘ၀` is ဘဝ, `ဆို၇င်` is ဆိုရင်. Shan and Karen marks count too (`၀ႆ` is ဝႆ, `သ၇ၣ်` is သရၣ်), but a tone mark alone does not, since Karen text types one after a number as a comma.
  - Words such as လုံးဝ, ဘဝ and ထာဝရ, and numbers such as ၁၉၇၇, stay as they are.
- **Spelling:**
  - စ with medial ya is ဈ.
  - ဥ with asat, aa or a stacked consonant is ဉ (ညဉ့်, ဉာဏ်), except right after a vowel sign, where Pa'o writes ဥ်း.
  - ၄င်း is ၎င်း, ိ with ီ is ီ, ု with ူ is ူ, and ဩော် is ဪ.
- **Other languages:** Mon, Karen, Pa'o and Shan letters stay as they are, and so do spellings that differ from Burmese (တုဲ, ခရံာ်).
- **What it keeps:** spaces around the text, line breaks, and zero-width characters. A zero-width space, word joiner or U+FEFF typed inside a syllable moves to the end of the syllable; a zero-width non-joiner or joiner stays where it was typed, since in Unicode it can shape the syllable on purpose.
- **NFC:** the result is NFC, also for text with no Myanmar letter.

**Idempotent.** A second call changes nothing: `normalize(normalize(text)) === normalize(text)` for every string. 2.x's `normalize` could change its own output again on garbled text. 3.0 reads a run of ိ and ီ (or ု and ူ) whole, reads ဥ, ၀ or ၇ right after a virama or under a kinzi as the consonant it stands for there (ဉ, ဝ, ရ), and repeats its pass on the parts of the text the first pass changed until nothing changes. Its output differs from 2.x's on no line of the Unicode corpora knayi is checked on, and on 199 of 14,304 lines of raw mC4 web text, most of which is Zawgyi. [research/normalize-idempotence.md](research/normalize-idempotence.md) has the design and the evidence.

```javascript
knayi.normalize('၀ွ ှ') // 'ဝွှ'  (2.x gives 'ဝွ ှ', then 'ဝွှ' on a second call)
```

**Options:**

- `report: true` returns `{ text, changes }`: each change with its span in the input (`start`, `end`, `before`) and in the output (`outputStart`, `outputEnd`, `after`), and the ids of the stages that made it (`rules`).
- `trace`: a trace from [createTrace()](#traces-createtrace), filled with the text after each stage of each pass that changed it.

```javascript
knayi.normalize('ယောကျ်ား ဘ၀', { report: true })
// { text: 'ယောက်ျား ဘဝ', changes: [{ start: 3, end: 9, before: 'ကျ်ား ', after: 'က်ျား ', outputStart: 3, outputEnd: 9, rules: ['syllables'] }, { start: 10, end: 11, before: '၀', after: 'ဝ', outputStart: 10, outputEnd: 11, rules: ['look-alikes'] }] }
```

Text converted from Zawgyi is in storage order already, but `normalize` may still change it where the source has an ေ or medial ra with no consonant after it: the converters leave such a mark where it was typed, and `normalize` may attach it to the syllable before. Zawgyi `ကေျ` converts to `ကေြ`, which `normalize` makes `ကြေ`. Of the 9,811 distinct mC4 lines that `detectEncoding` calls Zawgyi, `normalize` changes the converted text of 24.

### isNormalized(text)

Whether `normalize` would return the text unchanged: `normalize(text) === text`.

```javascript
knayi.isNormalized('ယောက်ျား') // true
knayi.isNormalized('ယောကျ်ား') // false
knayi.isNormalized('မဂၤလာပါ') // true  (Zawgyi text: isNormalized does not tell)
```

It does not tell Zawgyi from Unicode; [explain](#explaintext-options) and [detectEncoding](#detectencodingtext-options) do.

### explain(text, options)

Lists what is wrong with a text, for checking the output of a language model or auditing a corpus. It reads the text line by line. A line that reads as Zawgyi, as `detectEncoding` reads it, is one issue, whose fix is the line in Unicode. In every other line, each thing `normalize` would change is an issue. Issues come in order of `start`, each as `{ kind, rule, start, end, text, fix }`: `text.slice(start, end)` is `text`, and `fix` is what belongs there.

```javascript
knayi.explain('ယောကျ်ား') // [{ kind: 'order', rule: 'order.marks', start: 3, end: 8, text: 'ကျ်ား', fix: 'က်ျား' }]
knayi.explain('ယောကျ်ား\nေကာင္း ေမာင္')
// [{ kind: 'order', rule: 'order.marks', start: 3, end: 8, text: 'ကျ်ား', fix: 'က်ျား' }, { kind: 'zawgyi', rule: 'encoding.zawgyi', start: 9, end: 21, text: 'ေကာင္း ေမာင္', fix: 'ကောင်း မောင်' }]
knayi.explain('ဘ၀ ၄ဝဝ')
// [{ kind: 'look-alike', rule: 'look-alike.zero-as-wa', start: 1, end: 2, text: '၀', fix: 'ဝ' }, { kind: 'look-alike', rule: 'look-alike.wa-as-zero', start: 4, end: 5, text: 'ဝ', fix: '၀' }, { kind: 'look-alike', rule: 'look-alike.wa-as-zero', start: 5, end: 6, text: 'ဝ', fix: '၀' }]
knayi.explain('မြန်မာ') // []
```

| Rule | Kind | What it names |
| --- | --- | --- |
| `encoding.zawgyi` | `zawgyi` | a line in Zawgyi, from its first character to its last that is not white space |
| `order.prebase` | `order` | ေ or medial ra typed before its consonant |
| `order.marks` | `order` | marks, an asat or a stacked consonant in another order than UTN #11 stores them |
| `mark.space` | `mark` | a space typed before a mark |
| `mark.repeated` | `mark` | a mark typed twice |
| `asat.dropped` | `mark` | an asat that slipped onto the wrong syllable |
| `look-alike.u-as-nya`, `look-alike.seven-as-ra`, `look-alike.zero-as-wa`, `look-alike.ca-as-jha` | `look-alike` | a letter or digit typed for the letter it looks like |
| `look-alike.wa-as-zero`, `look-alike.ra-as-seven` | `look-alike` | a letter typed in a number for the digit |
| `typo.ii`, `typo.uu`, `typo.au`, `typo.lagaung` | `typo` | ိ with ီ, ု with ူ, ဩ with ော် for ဪ, and ၄ before င်း for ၎ |
| `nfc.order` | `nfc` | what NFC puts in canonical order or composes |

Outside the Zawgyi lines, the fixes written over their spans give `normalize`'s result, so explain names exactly what normalize changes; the tests check this on fuzzed text and on every line of FLORES, Wikipedia and Okell that does not read as Zawgyi. `options.zawgyiDetector` and `options.thresholds` are those of [detectEncoding](#detectencodingtext-options).

### detectEncoding(text, options)

Whether a text is Unicode or Zawgyi, with the evidence: `{ encoding, unicode, zawgyi }`. `unicode` and `zawgyi` count the matches of knayi's 29 signatures of each encoding (12 Unicode, 17 Zawgyi), read on the text trimmed and without U+200B and U+200C. `encoding` is:

- `'none'` when the text has no character of U+1000–U+109F;
- `'unknown'` when the evidence ties, as it does for a single consonant;
- otherwise the side with more evidence, `'unicode'` or `'zawgyi'`.

```javascript
knayi.detectEncoding('မဂၤလာပါ') // { encoding: 'zawgyi', unicode: 0, zawgyi: 1 }
knayi.detectEncoding('မင်္ဂလာပါ') // { encoding: 'unicode', unicode: 1, zawgyi: 0 }
knayi.detectEncoding('က') // { encoding: 'unknown', unicode: 0, zawgyi: 0 }
knayi.detectEncoding('abc') // { encoding: 'none', unicode: 0, zawgyi: 0 }
```

A consonant, virama, consonant sequence such as `ပ္က` is no evidence for Unicode: in Zawgyi, U+1039 is the visible asat, so such a sequence is common Zawgyi too. A word whose only telling sign is a stacked consonant, such as `ဗုဒ္ဓ`, ties. In longer Unicode text such as `ရန်ကုန်တက္ကသိုလ်`, the other signs decide. Win text is never detected: it is ASCII.

**myanmar-tools.** Pass Google's detector from the [myanmar-tools](https://www.npmjs.com/package/myanmar-tools) package, or any object with a `getZawgyiProbability(text)` method, as `zawgyiDetector`. Its probability then decides, by `thresholds` (default `[0.05, 0.95]`): below the first is `'unicode'`, above the second `'zawgyi'`, and between them `'unknown'`. The result also holds `zawgyiProbability`, and the detector is never asked about text with no Myanmar character. knayi never loads the package itself. Use myanmar-tools 1.1.x: 1.2.0 on npm was published without its built files and cannot be loaded.

```javascript
import { ZawgyiDetector } from 'myanmar-tools'
import { detectEncoding } from 'knayi-myscript'

const zawgyiDetector = new ZawgyiDetector()
detectEncoding('မဂၤလာပါ', { zawgyiDetector })
// { encoding: 'zawgyi', unicode: 0, zawgyi: 1, zawgyiProbability: 0.99997... }
```

```javascript
knayi.detectEncoding('မဂၤလာပါ', { zawgyiDetector: { getZawgyiProbability: () => 0.99 } }) // { encoding: 'zawgyi', unicode: 0, zawgyi: 1, zawgyiProbability: 0.99 }
```

### toUnicode(text, options)

Converts Zawgyi or Win text to Unicode. It never trims.

```javascript
knayi.toUnicode('မဂၤလာပါ', { from: 'zawgyi' }) // 'မင်္ဂလာပါ'
knayi.toUnicode(' မဂၤလာပါ ', { from: 'zawgyi' }) // ' မင်္ဂလာပါ '
knayi.toUnicode('jrefrm', { from: 'win' }) // 'မြန်မာ'
knayi.toUnicode('ျမန္မာ\nမြန်မာ') // 'မြန်မာ\nမြန်မာ'
knayi.toUnicode('ဗုဒ္ဓ') // 'ဗုဒ္ဓ'  (a tie: left as it is)
knayi.toUnicode('ဗုဒ္ဓ', { tie: 'zawgyi' }) // 'ဗုဒ်ဓ'
```

- **`from`** is `'zawgyi'`, `'win'` or `'unicode'`:
  - `'zawgyi'` converts each line (split at `\n`) that has a character of U+1000–U+109F; a line with none stays as it is.
  - `'win'` converts the whole text: Win text is ASCII and Latin-1.
  - `'unicode'` returns the text as it is.
- **With no `from`**, each line is detected on its own, as [detectEncoding](#detectencodingtext-options) reads it (with the same `zawgyiDetector` and `thresholds` options), and converts when it reads as Zawgyi. Win text is never detected, and needs `from: 'win'`.
- **`tie`** says what a line whose evidence ties is read as: `'unicode'`, the default, leaves it as it is; `'zawgyi'` converts it, as 2.x did.
- **`offsets: true`** returns `{ text, offsets }`: `offsets[i]` is the index of the input unit that output unit `i` came from, and `offsets[text.length]` is the input's length. The numbers never decrease, so an output span maps to an input span, for carrying annotations across the conversion.
- **`trace`**: a trace from [createTrace()](#traces-createtrace), filled with the text after each stage that changed it: `sequences`, `glyphs`, `syllables`, `zero as wa`, `look-alikes`, `typos`, `NFC`.

```javascript
knayi.toUnicode('ေကာင္း', { from: 'zawgyi', offsets: true }) // { text: 'ကောင်း', offsets: [0, 0, 2, 3, 4, 5, 6] }
```

So a text converts as its lines do, each alone, with or without `from`, and that is what lets [createConverter](#streams-knayi-myscriptstream) stream it.

**Name the source for short text.** Short Unicode text often ties: a single consonant, or a word such as `ဗုဒ္ဓ` whose only telling sign is a stacked consonant, which Zawgyi reads as an asat. 2.x read every tie as Zawgyi, and so changed hundreds of lines of the Unicode corpora; 3.0 leaves a tie as it is. On the distinct lines of the eval corpora, all Unicode, converting with no source named changes 168 of 4,812 Wikipedia lines and 553 of 16,924 Okell lines in 2.x, and 0 and 3 in 3.0. The cost falls on short Zawgyi text: of Google's 80 pairs of Zawgyi and Unicode words, converted with no source named, 2.x gets 79 right and 3.0 49; with `from: 'zawgyi'`, 3.0 gets all 80. [research/tie-policy.md](research/tie-policy.md) has every count.

#### Zawgyi to Unicode

Zawgyi stores text in the order the glyphs are drawn: ေ and medial ra before the consonant, kinzi and stacked consonants after it, and the marks in any order. knayi reads each Zawgyi glyph as Unicode characters and writes every syllable in Unicode storage order ([UTN #11](https://www.unicode.org/notes/tn11/)). Win fonts use the same rules.

```javascript
knayi.toUnicode('ေယာက္်ား', { from: 'zawgyi' }) // 'ယောက်ျား'
knayi.toUnicode('ေစ်း', { from: 'zawgyi' }) // 'ဈေး'
knayi.toUnicode('ႏို္င္ငံ', { from: 'zawgyi' }) // 'နိုင်ငံ'
knayi.toUnicode('ၿမိဳ ့', { from: 'zawgyi' }) // 'မြို့'
```

- **Marks:** a mark typed twice counts once.
- **Asat on a consonant:** stored right after the consonant, before the medials and vowels: ယောက်ျား, ကျွန်ုပ်, ခ်ျ.
- **Asat stored last:**
  - after ာ, as in ကျော်, even when typed before the ာ of a word with no medial (ကော်ဖီ);
  - with a dot below (ကြောင့်);
  - after medial ha (ရှ်).
- **Asat dropped:** typed with ိ or ီ, or on a stacked consonant, an asat is a slip (နိုင်ငံ, ကုလသမဂ္ဂ).
- **Letters Zawgyi draws alike:**
  - စ with medial ya is ဈ (ဈေး);
  - ဥ with a stacked consonant, asat or ာ is ဉ (ပဉ္စ, ဉာဏ်);
  - ၄ before င်း is ၎ (၎င်း);
  - ၇ with a vowel sign or medial is ရ (ရေး).
- **Zero:** `၀` is also ဝ. A zero stays a digit next to a digit or an arithmetic sign, or across a decimal point from a digit (၁၀၀, ၅.၀).
- **Typing fixes, as in [normalize](#normalizetext-options):** ဝ or ရ typed in a number is a digit (`၂ဝ၁၉` is ၂၀၁၉). ၇ starting a closed syllable is ရ (ဆိုရင်). ိ with ီ is ီ (ဦး), and ု with ူ is ူ.
- **Spaces:** a space typed before a mark only moved the mark, so it is dropped: `ၿမိဳ ့` is မြို့ and `တစ္ခ ု` is တစ်ခု. A line break stays.
- **Zero-width characters:** one typed inside a syllable (U+200B, U+200C, U+200D, U+2060 or U+FEFF) moves to the end of the syllable.
- **NFC:** the result is NFC.

#### Win fonts

Win Innwa, Win Researcher, Win Kalaw and the other Win fonts by WinMyanmar Systems (1992–2005) draw Burmese glyphs on the keys that type them. Win text is ASCII and Latin-1: `jrefrm` shows as မြန်မာ in a Win font. Name the source, because Win text is never detected.

```javascript
knayi.toUnicode('ajumifh', { from: 'win' }) // 'ကြောင့်'
knayi.toUnicode('ZvGefaps;', { from: 'win' }) // 'ဇလွန်ဈေး'
knayi.toUnicode('jrefrm') // 'jrefrm'  (no source named: plain ASCII)
```

- Win text is stored in drawing order, like Zawgyi, and knayi converts it with the same rules (see [Zawgyi to Unicode](#zawgyi-to-unicode)). So `ajumifh` (asat before the dot below) becomes ကြောင့် with the dot below first, `a,musfm;` is ယောက်ျား and `usGefkyf` is ကျွန်ုပ်.
- `0` is both ဝ and ၀ in Win, and `7` can be ရ, as in Zawgyi. `ps`, `Mo`, `aMomf` and `OD` become ဈ, ဩ, ဪ and ဦ.
- Text read as ISO-8859-1 instead of Windows-1252 converts the same way.
- Fractions become text such as ၁/၂. Dingbats become the Unicode symbols they show. The vendor logo at byte 0xB0 is dropped.
- English typed in another font run is ASCII too. Once the font names are gone, convert only the Win text.
- Wwin_Burmese and other ASCII fonts use different mappings and are not supported.
- knayi converts Win to Unicode only.

### toZawgyi(text, options)

Converts Unicode text to Zawgyi. It never trims. It collapses a mark typed twice in a row, as [collapseRepeatedMarks](#collapserepeatedmarkstext-options) does, then applies knayi's pattern rules.

```javascript
knayi.toZawgyi('မြန်မာ') // 'ျမန္မာ'
knayi.toZawgyi('မင်္ဂလာပါ') // 'မဂၤလာပါ'
knayi.toZawgyi('က\nေ') // 'ေက\n'  (the ေ moves across the line break)
```

The rules move ေ or medial ra before the nearest consonant before it, past a space or a line break if they must, so a line does not always convert as it would alone. That is why there is no stream to Zawgyi. To convert lines apart, call `toZawgyi` on each, as the command's `to-zawgyi` does. `trace` takes a trace from [createTrace()](#traces-createtrace), which gets a record `uz.collapse` when the collapse changed the text, then one for each rule that changed it, `uz.<section>.<n>`, labelled with the rule's regex source.

### segmentSyllables(text, options) and syllableBoundaries(text, options)

`segmentSyllables` returns the syllables of a text, which join back to it: `segmentSyllables(text).join('') === text`, every character kept in its place. `syllableBoundaries` returns where each syllable after the first starts.

```javascript
knayi.segmentSyllables('မင်္ဂလာပါ') // ['မင်္ဂ', 'လာ', 'ပါ']
knayi.syllableBoundaries('မင်္ဂလာပါ') // [5, 7]
knayi.segmentSyllables('ပထမဆုံး') // ['ပ', 'ထ', 'မ', 'ဆုံး']
knayi.segmentSyllables('ပထမဆုံး', { bareConsonants: 'chains' }) // ['ပထမဆုံး']
knayi.segmentSyllables('ပထမဆုံး', { bareConsonants: 'pairs' }) // ['ပထ', 'မဆုံး']
knayi.segmentSyllables('ၾကပါ', { from: 'zawgyi' }) // ['ၾက', 'ပါ']
knayi.segmentSyllables('မင်္ဂလာပါ မြန်မာ') // ['မင်္ဂ', 'လာ', 'ပါ ', 'မြန်', 'မာ']
knayi.segmentSyllables('မင်္ဂလာပါ မြန်မာ', { bareConsonants: 'pairs' }) // ['မင်္ဂလာ', 'ပါ မြန်', 'မာ']
knayi.segmentSyllables('ကောင်း (မောင်)') // ['ကောင်း ', '(မောင်)']
knayi.segmentSyllables('') // []
```

- **Where a piece starts:** at the start of the text, and before a consonant, an independent vowel, ဿ or one of ၌ ၍ ၎ ၏ that starts a syllable. A consonant under a virama, or with an asat, belongs to the syllable before it. White space ends a piece, so a syllable after a space or a line break starts one, and the opening brackets, quotes or dashes typed right before a syllable start its piece with it. Digits, punctuation and text in other scripts stay with the syllable before them; text before the first syllable, white space included, is a piece of its own. Under `bareConsonants: 'pairs'`, as in 2.x's `syllBreak`, no piece starts right after white space, or at a consonant right after an opening mark.
- **`bareConsonants`** says how a consonant with no mark, a bare consonant, is read:
  - `'separate'`, the default: a syllable of its own, with its inherent vowel (ပ|ထ|မ|ဆုံး).
  - `'chains'`: joined, with every bare consonant before it, to the syllable after it (ပထမဆုံး).
  - `'pairs'`: joined two by two, as 2.x `syllBreak` does (ပထ|မဆုံး, and ကကက is ကက|က).

  `'separate'` is the only policy whose pieces are the syllables, whatever the consonants around them: under `'chains'`, 13–14% of the pieces of the Burmese corpora hold more than one, and under `'pairs'`, which also joins across white space, a third or more. It changes the pieces of 94–100% of Burmese lines against 2.x's breaks. [research/segmentation.md](research/segmentation.md) has the counts.
- **`from`**, the text's encoding, is `'unicode'`, the default, or `'zawgyi'`, as for [toUnicode](#tounicodetext-options). The text is not detected: Zawgyi text read as Unicode splits a medial ra or ေ from its consonant, as `ၾကပါ` read as Unicode gives `ၾ`, `က` and `ပါ`.

### truncate(text, options)

Returns the text when it is at most `length` UTF-16 units long. Otherwise it returns the longest prefix of the text that ends at a syllable break and leaves room for the omission, without the white space at its end, then the omission. The result is never longer than `length`, and the text in it is always a prefix of the input: a later word never follows a skipped one, as it can in 2.x.

```javascript
knayi.truncate('မင်္ဂလာပါ မြန်မာ', { length: 10 }) // 'မင်္ဂလာ...'
knayi.truncate('မင်္ဂလာပါ မြန်မာ', { length: 10, omission: '…' }) // 'မင်္ဂလာပါ…'
knayi.truncate('မင်္ဂလာပါ', { length: 4 }) // '...'  (no break fits: the omission alone)
knayi.truncate('Hello world, again', { length: 10 }) // 'Hello w...'
knayi.truncate('abc') // 'abc'
```

- **`length`**, the most units of the result with the omission included, is a whole number; `omission` is any string, `''` included. They default to 30 and `'...'` when they are `undefined` or `null`. An omission longer than `length` throws a `RangeError` with the code `ERR_KNAYI_INVALID_ARG_VALUE`.
- **Where it cuts:** at a syllable break of the encoding's scanner, read with `bareConsonants` and `from` as in [segmentSyllables](#segmentsyllablestext-options-and-syllableboundariestext-options), or before any character outside the Myanmar blocks, but never inside a surrogate pair, or before a combining mark of the common blocks (U+0300–U+036F, U+1AB0–U+1AFF, U+1DC0–U+1DFF, U+20D0–U+20FF, U+FE20–U+FE2F), a zero-width non-joiner or joiner, or a variation selector. Outside the Myanmar blocks it does not look for a word break. It reads the text only as far as the cut.

### collapseRepeatedMarks(text, options)

Makes a mark typed two or more times in a row one mark. It does not reorder marks, trim, or remove zero-width characters. `from`, the text's encoding, is `'unicode'`, the default, or `'zawgyi'`: the marks of that encoding are collapsed.

```javascript
knayi.collapseRepeatedMarks('မင်္ဂလာာပါါ') // 'မင်္ဂလာပါ'
knayi.collapseRepeatedMarks(' ကာာ\u200B ') // ' ကာ\u200B '
knayi.collapseRepeatedMarks('ကိီ') // 'ကိီ'
knayi.collapseRepeatedMarks('\u1033\u1033', { from: 'zawgyi' }) // '\u1033'
```

### Traces: createTrace()

`createTrace()` returns an empty trace, `{ start: null, records: [] }`, for the `trace` option of `normalize`, `toUnicode` and `toZawgyi`. The call sets `start` to its input and adds `{ id, label, text }` for each step that changed the text: the step's stable id, its name in 2.x's debug output, and the whole text after it.

```javascript
import { createTrace, toUnicode } from 'knayi-myscript'

const trace = createTrace()
toUnicode('ေကာင္း', { from: 'zawgyi', trace })
// trace is { start: 'ေကာင္း', records: [
//   { id: 'glyphs', label: 'glyphs', text: 'ေကာင်း' },
//   { id: 'syllables', label: 'syllables', text: 'ကောင်း' }] }
```

| Function | Ids, in the order the steps run |
| --- | --- |
| `normalize` | `nfc.input`, `syllables`, `typos`, `look-alikes`, `nfc.final`, for each pass over the text |
| `toUnicode` | `sequences`, `glyphs`, `syllables`, `zero as wa`, `look-alikes`, `typos`, `NFC` |
| `toZawgyi` | `uz.collapse`, then the rules, `uz.<section>.<n>` |

The ids are part of the API: they change only in a major version.

### VERSION and OUTPUT_VERSION

`VERSION` is the package version, as in `package.json`. `OUTPUT_VERSION` is the version of knayi's output. It goes up with every deliberate change to what any function returns, so a dataset that records it knows when its text needs processing again.

```javascript
knayi.OUTPUT_VERSION // 2
```

| `OUTPUT_VERSION` | Output |
| --- | --- |
| 1 | 2.10.0's, which `knayi-myscript/compat` keeps |
| 2 | 3.0's `normalize` settles: it is idempotent, and reads ဥ, ၀ and ၇ after a virama or under a kinzi as ဉ, ဝ and ရ |

[CHANGELOG.md](CHANGELOG.md) lists every output change under "Output changes", with the lines of each corpus it changes.

## Errors

Every error the 3.0 API and its streams throw on purpose has a `code`, which is the part to test: the messages say more, and may change.

| `code` | Class | When |
| --- | --- | --- |
| `ERR_KNAYI_INVALID_ARG_TYPE` | `TypeError` | A text that is not a string; options that are not an object, `undefined`, `null` or a number (an array included); an option of the wrong type; a stream chunk that is neither a string nor bytes, or of the other kind than the first chunk; a line function that does not return a string. |
| `ERR_KNAYI_INVALID_ARG_VALUE` | `RangeError` | A key in the options that the function does not take, such as `{ font: 'zawgyi' }` for `segmentSyllables` or 2.x's `{ fontType: 'zawgyi' }` for `truncate`; an option of the right type that knayi does not take: an unknown name, such as `{ from: 'Zawgyi' }` or `{ bareConsonants: 'Pairs' }`; a `length` that is not a whole number; an omission longer than `length`; `thresholds` out of order; `createConverter({ to: 'zawgyi' })`. |
| `ERR_KNAYI_LINE_TOO_LONG` | `RangeError` | A line of a stream passes its `maxLineLength` before it ends. |
| `ERR_KNAYI_UNSUPPORTED_RUNTIME` | `Error` | A stream on a runtime with no `TransformStream`, or bytes on one with no `TextDecoder`. |

A message names the function and what is wrong: `knayi.toUnicode: options.from must be 'unicode', 'zawgyi' or 'win', not "Zawgyi"`. In TypeScript, the codes are the type `KnayiErrorCode`, and `KnayiError` is an `Error` with one.

```javascript
import { normalize } from 'knayi-myscript'

try {
  normalize(null)
} catch (error) {
  if (error.code !== 'ERR_KNAYI_INVALID_ARG_TYPE') throw error
  // error is a TypeError; its message says the text must be a string
}
```

`knayi-myscript/compat` throws nothing on purpose, as 2.x did ([MIGRATION.md](MIGRATION.md#keep-2xs-output-knayi-myscriptcompat)).

## Streams: knayi-myscript/stream

For text too large to hold at once, `knayi-myscript/stream` cuts the text into lines at `\n` and runs a function on each line, so a text of any size passes through with one line held at a time. The chunks are strings or UTF-8 bytes, cut anywhere, even inside a character; a stream takes one kind or the other.

- **`createNormalizer()`** and **`createConverter({ from, tie, zawgyiDetector, thresholds })`** are TransformStreams of `normalize` and `toUnicode`. Each gives what its function gives for the whole text, since both treat each line as they would alone. Without `from`, each line is detected, as `toUnicode` does. There is no stream to Zawgyi: its rules move ေ and medial ra across line breaks, so use `toZawgyi` on the whole text, and `createConverter({ to: 'zawgyi' })` throws.
- **`lineTransform(fn)`** is the same TransformStream for any function of a line.
- **`mapLines(fn)`** is the line cutter itself, with no stream class, for a loop, a Node `Transform` of your own, or a browser with no `TransformStream` (Safari before 14.1, Firefox before 102): `transform(chunk)` returns the lines that chunk completes, and `flush()` the last one.

**Lines.** A `\r` right before the `\n` belongs to the line ending: the function sees the line without it, and the ending goes out after the result as it came, `\r\n` or `\n`. The text after the last `\n` is the last line; a text that ends with `\n` has no empty line after it. Bytes are decoded as UTF-8: a byte order mark stays as U+FEFF, and bytes that are not UTF-8 become U+FFFD, as `TextDecoder` and Node's `Buffer#toString` read them.

Each takes `maxLineLength`: a line longer than that many UTF-16 units, 1,048,576 by default, is an error with the code `ERR_KNAYI_LINE_TOO_LONG`, and is never cut. Pass a larger limit, or `Infinity`, for longer lines. In TypeScript, the types of this entry need the `TransformStream` type, from the DOM library or from `@types/node`.

```javascript
import { pipeline } from 'node:stream/promises'
import fs from 'node:fs'
import { createConverter, createNormalizer, mapLines } from 'knayi-myscript/stream'
import { normalize } from 'knayi-myscript'

// Node streams: a file in Zawgyi to a file in Unicode.
await pipeline(fs.createReadStream('notes.txt'), createConverter({ from: 'zawgyi' }), fs.createWriteStream('notes.unicode.txt'))

// WHATWG streams: the body of a fetch() response, normalized, as a ReadableStream of strings.
const normalized = response.body.pipeThrough(createNormalizer())

// No stream class: the line cutter in a loop.
const lines = mapLines(normalize)
let out = ''
for (const chunk of chunks) out += lines.transform(chunk)
out += lines.flush()
```

[docs/next/DESIGN.md](docs/next/DESIGN.md) §12 gives the details, with the evidence that each stream gives what its function gives for the whole text.

## Command line

`knayi` runs the 3.0 API over files or standard input, for shell scripts and for data pipelines in any language, Python included. It comes with knayi 3.0, whose prereleases are on npm's `next` tag, and needs Node.js 22.12 or newer.

```bash
npm install --global knayi-myscript@next
knayi to-unicode notes.txt > notes.unicode.txt
npx --package knayi-myscript@next knayi detect notes.txt
```

### Synopsis

```
knayi <command> [options] [file ...]
knayi --help
knayi --version
```

### Description

`knayi` reads each file in turn, or standard input when no file is given or a file is `-`, and writes to standard output. It reads plain text one line at a time, or with `--jsonl`, JSON Lines: one JSON object per line. Each line or record goes through the 3.0 API on its own, so an input of any size streams through: `knayi` holds one line at a time, cut as the 3.0 streams cut lines (`mapLines` of `src/stream.js`), and stops with an error at a line longer than `--max-line-length`.

- **Line breaks:** each line of output ends as its line of input did, `\n` or `\r\n`, and a last line with no line break gets none.
- **Encodings:** the input is UTF-8, or Windows-1252 with `--encoding windows-1252`, in which Win font text is often saved. Bytes that are not valid in that encoding stop the run, with the line they are on, rather than turn into U+FFFD. A byte order mark at the start of an input is dropped. The output is UTF-8.
- **Offsets:** `check` counts columns and offsets in characters (code points), as a Python `str` does. The JavaScript API counts UTF-16 units; the two differ after a character above U+FFFF, such as an emoji.

### Commands

| Command | For each line or record | API |
| --- | --- | --- |
| `normalize` | The text in Unicode storage order, with typing slips and look-alike digits fixed, in NFC. | `normalize` |
| `to-unicode` | The text in Unicode. Without `--from`, each line is detected: a line that reads as Zawgyi is converted, and a line whose evidence ties stays as it is, unless `--tie zawgyi`. Win text cannot be detected and needs `--from win`. | `toUnicode` |
| `to-zawgyi` | Unicode text in Zawgyi. Each line converts on its own, so an ေ or medial ra at the start of a line never moves to the line before. `--from zawgyi` copies the text as it is. | `toZawgyi` |
| `convert --to <encoding>` | `to-unicode` or `to-zawgyi`, by `--to`. | |
| `detect` | `unicode`, `zawgyi`, `unknown` (the evidence ties) or `none` (no Myanmar letter). | `detectEncoding` |
| `segment` | The syllables, with `--separator` between them; with `--jsonl`, an array. | `segmentSyllables` |
| `check` | Each thing `normalize` would change, and each line in Zawgyi, as `<file>:<line>:<column>: <rule>: <text> -> <fix>`. A clean line writes nothing. | `explain` |

### Options

| Option | Commands | Meaning |
| --- | --- | --- |
| `--from <encoding>` | `to-unicode`: `unicode`, `zawgyi` or `win`. `to-zawgyi`, `segment`: `unicode` or `zawgyi`. | The encoding of the input text. Default: detect each line (`to-unicode`), `unicode` (the others). |
| `--to <encoding>` | `convert` | `unicode` or `zawgyi`. |
| `--tie <reading>` | `to-unicode` | How a line whose evidence ties is read: `unicode` (left as it is, the default) or `zawgyi`, as 2.x did. |
| `--detector <name>` | `to-unicode`, `detect`, `check` | `rules` (the default) or `myanmar-tools`, Google's detector, which must be installed next to knayi-myscript (`npm install myanmar-tools@1.1.3`). |
| `--bare-consonants <policy>` | `segment` | How a consonant with no mark is read, as `segmentSyllables`' `bareConsonants`: `separate` (the default), a syllable of its own; `chains`, joined to the syllable after it; `pairs`, joined two by two, and across white space, as 2.x `syllBreak` did. |
| `--separator <text>` | `segment` | What goes between syllables. Default `\|`. |
| `--jsonl` | all | Read and write JSON Lines. |
| `--field <name>` | all, with `--jsonl` | The field that holds the text. Default `text`. |
| `--into <name>` | all, with `--jsonl` | The field the result is written to. Default: `--field` for text, else `encoding` (`detect`), `syllables` (`segment`) or `issues` (`check`). |
| `--encoding <name>` | all | The input's encoding: `utf-8` (the default) or `windows-1252`. |
| `--max-line-length <n>` | all | The longest line read, in UTF-16 units: from 1 to 268,435,456. Default 16,777,216. |
| `--report` | all | When the input is read, write a summary to standard error as one JSON line. |
| `-h`, `--help` | | Print the usage. |
| `-v`, `--version` | | Print the version and the output version. |

Names are exact: `--from Zawgyi` is a usage error, as in the 3.0 API. An option a command does not take is a usage error too.

### JSON Lines

With `--jsonl`, every line is a JSON object, and a blank line is passed through. `knayi` reads the text from `--field`, which must hold a string, and writes the result to `--into`. Every other byte of the line stays as it was: the order of the fields, their spacing and escapes, and numbers JavaScript cannot hold exactly, such as an id of 20 digits. A record whose text the command leaves as it is comes out byte for byte.

```console
$ echo '{"id":12345678901234567890,"text":"ေကာင္း"}' | knayi to-unicode --jsonl
{"id":12345678901234567890,"text":"ကောင်း"}
$ echo '{"id":7,"text":"မြန်မာ"}' | knayi segment --jsonl
{"id":7,"text":"မြန်မာ","syllables":["မြန်","မာ"]}
```

`check` adds `issues` to every record, `[]` for a clean one; each issue is `{kind, rule, start, end, text, fix}`, as `explain` gives it, with `start` and `end` in characters.

### Report

`--report` writes one JSON line to standard error when the run has read all of its input: the command, `version`, `outputVersion`, the number of `records` (lines, or JSON Lines records), and what the command counts: `changed` (`normalize`, `to-unicode`, `to-zawgyi`), `encodings` (`detect`), `syllables` (`segment`), or `issues`, `recordsWithIssues` and `rules` (`check`). `outputVersion` changes with every deliberate change to knayi's output, so a dataset that records it knows when to run `knayi` again.

For the three lines of the `detect` example below, `knayi to-unicode --report` writes:

```json
{"command":"to-unicode","version":"3.0.0-next.0","outputVersion":2,"records":3,"changed":1}
```

### Exit status

| Status | Meaning |
| --- | --- |
| 0 | Done, and `check` found no issue. |
| 1 | `check` found an issue. |
| 2 | A usage error: an unknown command or option, a value the command does not take, or a detector that is not installed. Nothing is read. |
| 3 | An input error: a file that cannot be read, bytes not valid in `--encoding`, a line longer than `--max-line-length`, or a JSON Lines line that is not an object with a string `--field`. The message names the file and the line. Nothing of that line or after it is written, and lines just before it may be missing too, since the input is read a chunk at a time. |
| 4 | Any other failure, such as an output that cannot be written. |

An error writes one line to standard error, `knayi: <what is wrong>`. When the reader of the output goes away, as `head` does, `knayi` stops with status 0.

### Examples

```console
$ echo 'ေကာင္း ေမာင္' | knayi to-unicode
ကောင်း မောင်
$ printf 'ကောင်း\nေကာင္း\nabc\n' | knayi detect
unicode
zawgyi
none
$ echo 'မြန်မာစာ' | knayi segment
မြန်|မာ|စာ
$ echo 'ကျွန်တော် ကုိ' | knayi check
<stdin>:1:11: order.marks: "ကုိ" -> "ကို"
$ echo 'aMomf' | knayi to-unicode --from win
ဪ
```

### Code it loads

`knayi` loads no code from the working directory, so it is safe to run inside a folder of data nobody has checked. The one package it loads, myanmar-tools, it loads only for `--detector myanmar-tools`, and only from where knayi-myscript is installed, never from the working directory's `node_modules` or from `NODE_PATH`.

## Runtimes and browsers

### Node.js and Bun

The package is ES modules only, for Node.js 22.12 or newer and Bun. From Node 22.12 on, `require` loads ES modules too, so CommonJS code keeps `require`. CI runs the tests on Node 22.12, 24 and 26, and on Bun 1.4.2. Building and testing the package needs Node 22.12 or newer; Node 24 is the version in `.nvmrc`. Other runtimes, such as Deno, edge workers and React Native, are not tested.

The package has one entry per API, each with its own types:

| Import | What it is | Types |
| --- | --- | --- |
| `knayi-myscript` | the 3.0 API, [above](#the-30-api) | `src/index.d.ts` |
| `knayi-myscript/stream` | the 3.0 API's streams, [above](#streams-knayi-myscriptstream) | `src/stream.d.ts` |
| `knayi-myscript/compat` | the 2.x API, with 2.x's output ([MIGRATION.md](MIGRATION.md)) | `src/compat/index.d.ts` |

No other path loads: 2.x's `knayi-myscript/library/converter` and its `dist/` imports are gone. The package also installs the command `knayi` ([Command line](#command-line)). TypeScript finds the subpaths under `moduleResolution` `node16`, `nodenext` or `bundler`, and CommonJS code in TypeScript can `require` them under `module` `node20` or `nodenext` (TypeScript 5.9 has both). The types of `knayi-myscript` and `knayi-myscript/compat` need neither the DOM library nor `@types/node`.

### Browsers

Browsers load one of three files in `dist/`, from a CDN such as unpkg or jsDelivr, or from a copy:

| File | Holds | Gzipped |
| --- | --- | --- |
| `knayi-myscript.min.js` | a script that sets the global `knayi`: the 3.0 API, with the 2.x API as `knayi.compat` | 23,951 B |
| `knayi-myscript.min.mjs` | the 3.0 API as one ES module | 21,072 B |
| `knayi-myscript-compat.min.mjs` | the 2.x API as one ES module, with the named exports and the default export of 2.x's `knayi-myscript.mjs` | 17,455 B |

They are ES2015. They run in Chrome 51, Edge 15, Firefox 54, Safari 10.1 (iOS 10.3), Samsung Internet 5 and Opera 38, or newer: the first versions with all of ES2015. Older browsers need knayi 2.x, and Internet Explorer knayi 2.8.3. The tests run the three files in Chromium, Firefox and WebKit, and run the script build with every built-in newer than those browsers removed.

The builds hold no streams: a TransformStream needs Safari 14.1 or Firefox 102. A page that wants them bundles `knayi-myscript/stream`, and on an older browser uses `mapLines`. Each `dist/` file is a copy of the library of its own, so the 2.x `setGlobalOptions` called on one does not reach another, nor `knayi-myscript/compat` loaded from npm.

With a bundler, an import takes only what it uses. Measured with esbuild at ES2015, minified and gzipped at level 9 (`node scripts/next/size.mjs`): `import { normalize } from 'knayi-myscript'` adds 9,200 B, the whole 3.0 API 21,291 B, `createNormalizer` alone 10,315 B and the whole of `knayi-myscript/stream` 16,082 B.

## The 2.x API: knayi-myscript/compat

`knayi-myscript/compat` is the 2.x API on the 3.0 core: the same exports, options, console messages and debug output as knayi 2.10.0, and its output on every input. `npm run compare` finds 0 differences from 2.10.0's code on every eval corpus and on generated and fuzzed input, and CI runs it on every pull request.

```javascript
import compat from 'knayi-myscript/compat'
compat.fontConvert('ေကာင္း', 'unicode', 'zawgyi') // 'ကောင်း'
```

```javascript
const compat = require('knayi-myscript/compat').default
```

In the script build it is `knayi.compat`: a page written for 2.x's global sets `knayi = knayi.compat` after the tag. [MIGRATION.md](MIGRATION.md) documents every 2.x function, how to keep 2.x's behaviour, and how to move each call to the 3.0 API, with the output changes counted.

## Build

`dist/` holds the build of the last release, or of the release being prepared, because jsDelivr serves the `dist/` of the main branch. It changes only in a release commit, which also changes the version. `npm run build` writes the three minified files of [Browsers](#browsers).

`npm test` runs the tests on a build made in a temporary directory. [ARCHITECTURE.md](ARCHITECTURE.md#running-the-checks) lists every test and check script.

`npm run eval` measures conversion and detection on public Zawgyi and Unicode data, next to a published knayi release, myanmar-tools, and Rabbit. `npm run bench` measures speed on real text and long input. Both download their data on first use. See [scripts/eval/README.md](scripts/eval/README.md). The latest results are published at <https://greenlikeorange.github.io/knayi-myscript/benchmark.html>.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) explains how to report a problem and how to send a change, and [ARCHITECTURE.md](ARCHITECTURE.md) how the code is organized. [CHANGELOG.md](CHANGELOG.md) lists what changed in each version, output changes first, and [MIGRATION.md](MIGRATION.md) what changes from 2.x to 3.0. Report security problems privately, as [SECURITY.md](SECURITY.md) describes.
