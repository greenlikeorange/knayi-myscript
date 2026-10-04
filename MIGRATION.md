# Upgrading from knayi 2.x to 3.0

knayi 3.0 has two APIs on one new core:

- **`knayi-myscript/compat`** is the 2.x API, with 2.x's output on every input. Change the import, check your runtime, and nothing else changes: [Keep 2.x's output](#keep-2xs-output-knayi-myscriptcompat).
- **`knayi-myscript`** is the 3.0 API: new names, options per call, errors with codes, and output that differs from 2.x's where 2.x was wrong or lossy. [Move to the 3.0 API](#move-to-the-30-api) says what changes everywhere, maps each 2.x call to its 3.0 call, and counts the output changes on the eval corpora.

[The 2.x API, call by call](#the-2x-api-call-by-call) documents each 2.x function, as `knayi-myscript/compat` keeps it, next to its 3.0 equivalent. The examples call `compat.` for the 2.x API and `knayi.` for the 3.0 API; the tests run each one and check the value in its comment.

**Contents:** [Keep 2.x's output](#keep-2xs-output-knayi-myscriptcompat) · [Move to the 3.0 API](#move-to-the-30-api) · [What changes in every call](#what-changes-in-every-call) · [Call by call](#call-by-call) · [Output changes, counted](#output-changes-counted) · [The 2.x API, call by call](#the-2x-api-call-by-call)

## Keep 2.x's output: knayi-myscript/compat

`knayi-myscript/compat` gives 2.10.0's output on every call form and input: `npm run compare` finds 0 differences from the 2.x reference (commit `e5f6e24`, 2.10.0's code) on every eval corpus and on generated and fuzzed input, and the contract matrix matches in all 3,523 cells, under Node and Bun. It keeps 2.x's exports, options, console messages, debug output and the accidental `TypeError`s 2.x threw.

### What to change

| 2.x | 3.0 |
| --- | --- |
| `import knayi from 'knayi-myscript'` | `import knayi from 'knayi-myscript/compat'` |
| `import { fontConvert } from 'knayi-myscript'` | `import { fontConvert } from 'knayi-myscript/compat'` |
| `const knayi = require('knayi-myscript')` | `const knayi = require('knayi-myscript/compat').default` |
| `require('knayi-myscript/library/converter')`, which was `fontConvert` | `require('knayi-myscript/compat').fontConvert` |
| The script build's global `knayi` | `knayi.compat`, or `knayi = knayi.compat` after the `<script>` tag |
| `dist/knayi-myscript.min.js` | the same file name, whose global is now the 3.0 API, with the 2.x API as `knayi.compat` |
| `dist/knayi-myscript.mjs`, `dist/knayi-myscript.es.js` | `dist/knayi-myscript-compat.min.mjs`, with the same named exports and default export |
| `dist/knayi-myscript.js` | `dist/knayi-myscript.min.js`, as above |
| `import 'knayi-myscript/dist/knayi-myscript.min.js'` in a bundler | load the file from a CDN or a copy: the exports map serves no `dist/` path |
| TypeScript: `index.d.ts` at the package root | `src/compat/index.d.ts`, the same declarations, found through `knayi-myscript/compat` under `moduleResolution` `node16`, `nodenext` or `bundler` |

`import knayi from 'knayi-myscript'` no longer works: the 3.0 API has no default export.

### What else changes

- **Node.js 22.12 or newer**, or Bun. From Node 22.12 on, `require` loads ES modules, so CommonJS code keeps `require`. Node 16 to 22.11 stay on knayi 2.x.
- **Browsers:** the `dist/` files run in Chrome 51, Edge 15, Firefox 54, Safari 10.1 (iOS 10.3), Samsung Internet 5 and Opera 38, or newer, the first versions with all of ES2015. 2.10's ran in Chrome 49, Edge 14, Firefox 34 and Safari 10. Older browsers stay on 2.x, and Internet Explorer on 2.8.3.
- **`version`** is the version of the package, a 3.0 version.
- **Two differences from 2.x's `main.js`,** which 2.x's own ES module build had too:
  - a detached `fontConvert` call, such as `const f = compat.fontConvert; f(...)`, never reads a global `debug`;
  - myanmar-tools, for the `myanmartools` adapter, is looked up from the `package.json` of the working directory, not from where knayi is installed. Ask for that adapter only where the working directory is trusted ([SECURITY.md](SECURITY.md)).
- **Removed:** the deep paths such as `knayi-myscript/library/converter`, the `dist/` paths, the `module` field, and `parseUnicode` and `serializeUnicode`, which only 2.x's tests used through `library/syllable.js`.
- Each `dist/` file holds a copy of the library of its own, so the 2.x `setGlobalOptions` called on one does not reach another, nor `knayi-myscript/compat` loaded from npm. Imports of `knayi-myscript/compat` in one Node or Bun process share one module, and so one option store.

## Move to the 3.0 API

```javascript
import { normalize, toUnicode } from 'knayi-myscript'
```

[README.md](README.md#the-30-api) documents the 3.0 API. This part lists what changes for code that called 2.x.

### What changes in every call

| 2.x | 3.0 |
| --- | --- |
| Missing content (`null`, `undefined`, `''`, `0`, `false`, `NaN`) prints a warning and returns `''`, or the fallback or `'en'` for `fontDetect` | `''` is a text like any other, and gives its result; every value that is not a string throws a `TypeError` with the code `ERR_KNAYI_INVALID_ARG_TYPE` |
| Other non-strings come back unchanged; `String` objects work like their strings | They throw the same `TypeError` |
| Font names `unicode`, `uni`, `zawgyi`, `zaw`, `win`; an unknown name is detected, passed on or thrown on, by function | One name each, exactly as written: `'unicode'`, `'zawgyi'`, `'win'`; any other is a `RangeError` with the code `ERR_KNAYI_INVALID_ARG_VALUE` |
| `setGlobalOptions` stores `silent_mode` and the detector options for later calls | Every option is an argument of the call that uses it; nothing is kept, and nothing is written to the console |
| `use_myanmartools`, `adapter: 'myanmartools'`: knayi loads myanmar-tools | `zawgyiDetector`: you pass the detector object; knayi loads no code |
| `myanmartools_zg_threshold` | `thresholds` |
| An option a function does not know is ignored | A key the function does not take is a `RangeError` with the code `ERR_KNAYI_INVALID_ARG_VALUE`; for 2.x's names (`fontType`, `use_myanmartools`, `adapter`, `myanmartools_zg_threshold`, `silent_mode`) its message names what replaced them |
| Converting trims the text; breaking and collapsing trim it and remove U+200B and U+200C first | Nothing is trimmed, and zero-width characters stay |
| `syllBreak`, `spellingFix` and `truncate` detect the font when none is given | Only `toUnicode` detects; the others take `from`, `'unicode'` by default |
| A tie in detection reads as Zawgyi | `detectEncoding` says `'unknown'`, and `toUnicode` leaves the line as it is unless `tie: 'zawgyi'` |
| Detection reads the whole text once | `toUnicode` detects each line on its own |
| Errors and warnings go to the console | Bad arguments throw errors with a `code` ([README.md](README.md#errors)) |
| `fontConvert.debugging` returns `{ to, from, matched_patterns, steps }`, or a string on an early exit | The `trace` option of `normalize`, `toUnicode` and `toZawgyi`, with stable ids ([README.md](README.md#traces-createtrace)) |

### Call by call

The 3.0 call, then the 3.0 call that keeps 2.x's output where one exists. `clean(text)` stands for what 2.x read breaks and marks from:

```javascript
const clean = (text) => text.trim().replace(/[\u200B\u200C]/g, '')
```

and 2.x returns a text with no character of U+1000–U+109F as it is, untrimmed, from every function but `normalize`, `truncate`, `fontDetect` (which returns its fallback) and `fontConvert` from Win (whose text is ASCII).

| 2.x | 3.0 | Keeps 2.x's output | Still differs |
| --- | --- | --- | --- |
| `fontDetect(text)` | `detectEncoding(text).encoding`: `'unknown'` for a tie, `'none'` for no Myanmar | `'none'` as `'en'`, `'unknown'` as `'zawgyi'` | nothing |
| `fontDetect(text, fallback)` | the same | `'none'` and `'unknown'` as the fallback | nothing |
| `fontDetect(text, fallback, { adapter: 'myanmartools' })` | `detectEncoding(text, { zawgyiDetector: new ZawgyiDetector() })`, which answers `'unknown'` for a probability between the thresholds | `'none'` and `'unknown'` as the fallback | not compared |
| `fontConvert(text, 'unicode', 'zawgyi')` | `toUnicode(text, { from: 'zawgyi' })` | `toUnicode(text.trim(), { from: 'zawgyi' })` | nothing |
| `fontConvert(text, 'unicode', 'win')` | `toUnicode(text, { from: 'win' })` | `toUnicode(text.trim(), { from: 'win' })` | nothing |
| `fontConvert(text, 'unicode')` | `toUnicode(text)` | `toUnicode(text.trim(), { tie: 'zawgyi' })` | a text of several lines that 2.x read as one encoding and 3.0 reads line by line |
| `fontConvert(text, 'zawgyi', 'unicode')` | `toZawgyi(text)` | `toZawgyi(text.trim())` | nothing |
| `fontConvert(text, 'zawgyi')` | `toZawgyi(text)` when `detectEncoding` says the text is Unicode | | not compared |
| `fontConvert.debugging(...)` | the `trace` option | | not compared: a trace has another shape |
| `syllBreak(text, font, separator)` | `segmentSyllables(text, { from: font }).join(separator)` | `segmentSyllables(clean(text), { from: font, bareConsonants: 'pairs' }).join(separator)` | an asat typed before a dot below, which 2.x writes after it |
| `syllBreak(text)` | `segmentSyllables(text, { from })`, with `from` `'zawgyi'` when `detectEncoding` says Zawgyi | `segmentSyllables(clean(text), { from, bareConsonants: 'pairs' })`, with a tie read as Zawgyi | as for a named font |
| `spellingFix(text, font)` | `collapseRepeatedMarks(text, { from: font })` | `collapseRepeatedMarks(clean(text), { from: font })` | nothing |
| `truncate(text, { length, omission, fontType })` | `truncate(text, { length, omission, from })` | none: 2.x's is not always a prefix, and appends the omission to text that fits | |
| `normalize(text)` | `normalize(text)` | none: 2.x's could change its own output again | |
| `setGlobalOptions({ silent_mode: true })` | nothing to silence | | |
| `setGlobalOptions({ detector })` | the detector options of each call | | |
| `version` | `VERSION`, and `OUTPUT_VERSION` for the output | | |

"Still differs" is what `npm run compare` finds between compat and the call that keeps 2.x's output, on every eval corpus and on generated and fuzzed input ([below](#output-changes-counted)).

### Output changes, counted

What a 2.x user sees who replaces each 2.x call with its plain 3.0 call. The counts are distinct lines of the corpora that `npm run eval` downloads ([scripts/eval/README.md](scripts/eval/README.md)), and of the fuzz sets of `npm run compare` (seed 20261003, 20,000 strings per generator, made distinct); "Wikipedia" is the 4,812-line sample.

| 2.x call → 3.0 call | FLORES 2,009 | Wikipedia 4,812 | Okell 16,924 | mC4 14,304 | WaitZar 2,390 | Shan 9,923 | Mon 2,270 | S'gaw Karen 673 | Pa'o 770 | Fuzz |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `normalize` → `normalize` | 0 | 0 | 0 | 199 | 0 | 0 | 0 | 0 | 0 | 266 of 35,452 |
| `fontConvert(t, 'unicode', 'zawgyi')` → `toUnicode(t, { from: 'zawgyi' })` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1,113 of 35,452 |
| `fontConvert(t, 'unicode', 'win')` → `toUnicode(t, { from: 'win' })` | | | | | | | | | | 1,477 of 53,921 |
| `fontConvert(t, 'unicode')` → `toUnicode(t)` | 0 | 168 | 550 | 247 | 365 | 531 | 202 | 113 | 85 | 18,540 of 35,452 |
| `fontConvert(t, 'zawgyi', 'unicode')` → `toZawgyi(t)` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1,113 of 35,452 |
| `fontDetect(t)` → `detectEncoding(t).encoding` | 0 | 242 | 1,092 | 355 | 672 | 593 | 230 | 115 | 96 | 19,774 of 35,452 |
| `syllBreak(t, 'unicode')` → `segmentSyllables(t)` | 2,009 | 4,510 | 16,005 | 13,872 | 473 | 7,450 | 2,200 | 648 | 680 | 10,401 of 35,452 |
| `syllBreak(t, 'zawgyi')` → `segmentSyllables(t, { from: 'zawgyi' })` | 2,009 | 4,667 | 16,330 | 13,784 | 57 | 7,894 | 2,207 | 645 | 723 | 10,525 of 35,452 |
| `syllBreak(t)` → `segmentSyllables(t, { from })`, `from` detected | 2,009 | 4,520 | 16,049 | 13,748 | 178 | 7,782 | 2,209 | 645 | 703 | 14,965 of 35,452 |
| `spellingFix(t, font)` → `collapseRepeatedMarks(t, { from: font })` | 6 | 188 | 1,068 | 159 | 0 | 48 | 0 | 1 | 3 | 6,306 of 35,452 |
| `truncate(t, { length: 30 })` → `truncate(t, { length: 30 })` | 1,117 | 3,102 | 10,576 | 10,419 | 2,390 | 6,876 | 1,501 | 386 | 531 | 35,452 of 35,452 |

Why each changes:

- **`normalize`** settles: it is idempotent, and reads ဥ, ၀ and ၇ right after a virama or under a kinzi as ဉ, ဝ and ရ. No line of a Unicode corpus changes. The 199 mC4 lines are raw web text, mostly Zawgyi, which `normalize` is not for: 104 that 2.x's `normalize` changes again on a second pass, now settled, and 95 with ဥ, ၀ or ၇ after U+1039, Zawgyi's asat. This is the one change that raises `OUTPUT_VERSION`, from 1 to 2 ([research/normalize-idempotence.md](research/normalize-idempotence.md)).
- **`toUnicode` with `from`** and **`toZawgyi`** convert as 2.x did; they only stop trimming. No corpus line has white space at either end, so only generated and fuzzed input changes. `toUnicode` from Zawgyi also decides line by line whether a line has a Myanmar character, so a line with none, next to one with some, is no longer put in NFC; no corpus line is such a text.
- **`toUnicode` with no `from`** leaves a line whose evidence ties as it is, where 2.x read it as Zawgyi and damaged it. Every changed line of the Unicode corpora is such a tie, now left intact; mC4 and WaitZar are mostly Zawgyi, and their ties include short Zawgyi text that 3.0 no longer converts. Name the source for short text, or pass `tie: 'zawgyi'` ([research/tie-policy.md](research/tie-policy.md)).
- **`detectEncoding`** names two answers that 2.x folded into its fallback: every changed corpus line is a tie, `'unknown'` where 2.x said `'zawgyi'` (or the fallback). No corpus line has no Myanmar character, which 3.0 calls `'none'` and 2.x `'en'`.
- **`segmentSyllables`** reads a bare consonant as a syllable of its own by default, starts a piece at a syllable after white space, keeps every character (2.x trimmed the text and removed U+200B and U+200C), returns the pieces instead of a joined string, does not swap an asat typed before a dot below, and detects nothing ([research/segmentation.md](research/segmentation.md)).
- **`collapseRepeatedMarks`** keeps zero-width spaces and non-joiners, and white space at the ends: every changed corpus line holds U+200B or U+200C.
- **`truncate`** returns a text that fits as it is, where 2.x appended the omission (every WaitZar word, and 1,184 of the 3,102 changed Wikipedia lines, are at most 30 units long); cuts a text that does not fit to a prefix, where 2.x could keep a later word after a skipped one; and cuts at the syllable breaks of `bareConsonants: 'separate'`. compare counts lengths 10, 60 and 120 too: on Wikipedia, they change 2,609, 4,035 and 4,120 lines.

With the options that keep 2.x's output, every row above but `normalize` and `truncate` drops to 0 on every corpus and fuzz set, except these (WaitZar, Mon and Pa'o: 0):

| 2.x call → the 3.0 call that keeps its output | FLORES | Wikipedia | Okell | mC4 | Shan | S'gaw Karen | Fuzz | Why |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `syllBreak(t, 'unicode')` → `segmentSyllables(clean(t), { bareConsonants: 'pairs' })` | 112 | 0 | 1 | 566 | 59 | 6 | 165 | an asat typed before a dot below, which 2.x's break rule U1 writes after it and `segmentSyllables` keeps as typed |
| `syllBreak(t)` → the same, with the font detected | 112 | 0 | 1 | 566 | 59 | 1 | 47 | the same |
| `fontConvert(t, 'unicode')` → `toUnicode(t.trim(), { tie: 'zawgyi' })` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | only generated texts of several lines, whose lines 2.x read as the encoding of the whole text, and 3.0 each as its own |

To count them yourself, with the corpus cache filled by `npm run eval` or `node scripts/eval/datasets.mjs --fetch`:

```bash
npm run compare -- --base mjs:src/compat/index.js --head mjs:scripts/next/migration/plain.mjs \
  --forms 'normalize,fontConvert.*,fontDetect*,syllBreak.*,spellingFix.*,truncate.*'
npm run compare -- --base mjs:src/compat/index.js --head mjs:scripts/next/migration/as-2x.mjs \
  --forms 'fontConvert.*,fontDetect*,syllBreak.*,spellingFix.*'
```

`scripts/next/migration/plain.mjs` makes each 2.x call form with the plain 3.0 call of the first table, and `as-2x.mjs` with the call that keeps 2.x's output. compare also reads its generated inputs, which include the strings of these documents' examples, and, where the cache still holds it, Wikipedia's older sample of 10,732 lines. The debugging forms are left out: a trace is not the shape of 2.x's debug object.

## The 2.x API, call by call

This part documents the 2.x API as `knayi-myscript/compat` keeps it, function by function, each with its 3.0 equivalent. Its types are `src/compat/index.d.ts`, 2.x's `index.d.ts`: named imports such as `import { fontConvert } from 'knayi-myscript/compat'` work next to the default import, the default import compiles with or without `esModuleInterop`, and the option types (`DetectorOptions`, `GlobalOptions`, `TruncateOptions`) are exported.

### Font names

`unicode`, `uni`, `zawgyi`, `zaw`, and `win`. `uni` is Unicode. `zaw` is Zawgyi. `win` is the Win Innwa family of legacy fonts, which `fontConvert` converts to Unicode. Any other string is an unknown font.

**3.0:** one name each, `'unicode'`, `'zawgyi'` and `'win'`, given as `from` wherever an option names the text's encoding. Any other name, `'uni'` and `'zaw'` included, is a `RangeError`.

### Missing content

`null`, `undefined`, `''`, `0`, `false`, and `NaN` are missing content, as in 2.8.3.

| Function | Missing content |
| --- | --- |
| `fontDetect` | The fallback, or `'en'` when the fallback is omitted. Warns unless silent. |
| `fontConvert`, `syllBreak`, `spellingFix`, `normalize` | `''`. Warns unless silent. |
| `truncate` | `''`. Warns unless silent. An empty string `''` returns the omission instead. |

Text with no Myanmar letters (`U+1000`–`U+109F`) is returned unchanged by convert, break, and spelling fix. `fontDetect` returns the fallback or `'en'`. `truncate` still appends the omission. `normalize` returns it in NFC, so `'e\u0301'` becomes `'é'` (`U+00E9`). A Win source is the exception for convert: Win text is ASCII, so `fontConvert` converts it.

Other values, such as numbers and objects, are returned unchanged the same way, and no function throws on them, with one exception: `truncate` turns them into strings first, like `lodash.truncate`, so it throws a `TypeError` on an object that `String()` cannot convert, such as `Object.create(null)`. `String` objects work like the strings they hold.

**3.0:** `''` is a text: each function gives its result for it, such as `''`, `[]` or `{ encoding: 'none', unicode: 0, zawgyi: 0 }`, and `truncate('')` is `''`. Every other value that is not a string, `String` objects included, throws a `TypeError` with the code `ERR_KNAYI_INVALID_ARG_TYPE`. Nothing warns.

### setGlobalOptions(options)

`setGlobalOptions({ silent_mode: true })` hides the warnings, and the errors but one (a bad threshold). `setGlobalOptions({ detector: { use_myanmartools, myanmartools_zg_threshold } })` changes the default detector options of later `fontDetect` calls, and of the detection the other functions run. The options apply to the copy of the library that received the call.

**3.0:** nothing is stored and nothing is printed. Pass the detector options, `zawgyiDetector` and `thresholds`, to each call that detects: `detectEncoding`, `toUnicode` and `explain`.

### fontDetect(content, fallbackFontType?, options?)

Returns `'unicode'`, `'zawgyi'`, or the fallback / `'en'`.

When the rule scores tie, including a single consonant such as `က`, the result is the fallback, or `'zawgyi'` if the fallback is omitted.

```javascript
compat.fontDetect('မဂၤလာပါ') // 'zawgyi'
compat.fontDetect('မင်္ဂလာပါ') // 'unicode'
compat.fontDetect('ကျ') // 'unicode'
compat.fontDetect('က') // 'zawgyi'
compat.fontDetect('က', 'unicode') // 'unicode'
compat.fontDetect(null) // 'en'
```

`options.adapter` chooses the detector for that call. `'rules'` is the built-in scorer and the default. `'myanmartools'` uses the `myanmar-tools` package. Install it only for that adapter, and use 1.1.x: `myanmar-tools` 1.2.0 on npm was published without its built files and cannot be loaded.

```bash
npm install myanmar-tools@1.1.3
```

```javascript
compat.fontDetect('မဂၤလာပါ', null, { adapter: 'myanmartools' }) // 'zawgyi'
compat.fontDetect('မင်္ဂလာပါ', null, {
  use_myanmartools: true,
  myanmartools_zg_threshold: [0.05, 0.95]
}) // 'unicode'
```

`use_myanmartools: true` selects the same adapter. A probability below the first threshold returns `'unicode'`. A probability above the second returns `'zawgyi'`. A probability between them returns the fallback. The default pair is `[0.05, 0.95]`. If the package is not installed or cannot be loaded, the call uses the rule scorer and warns once. The warning says which of the two happened.

`setGlobalOptions({ detector: { use_myanmartools: true } })` changes the default. An explicit `adapter` on a later call wins. A later call that only sets `use_myanmartools` keeps a previously stored threshold.

The rule scorer does not count a consonant, `U+1039`, consonant sequence such as `က္က` as Unicode. In Zawgyi, `U+1039` is the visible asat, so `ပ္က` is a common Zawgyi sequence. A lone stack is a tie and returns the fallback. In longer Unicode text such as `ရန်ကုန်တက္ကသိုလ်`, the other signs decide.

**3.0: `detectEncoding(text, options)`** returns the evidence with the answer, and names the two answers 2.x folded into its fallback: `'unknown'` for a tie and `'none'` for text with no Myanmar character. The rule evidence is the same: `fontDetect(text, fallback)` gives `detectEncoding(text).encoding`, with the fallback for `'none'` and `'unknown'`, on every line of the eval corpora and on fuzzed text.

```javascript
knayi.detectEncoding('မဂၤလာပါ') // { encoding: 'zawgyi', unicode: 0, zawgyi: 1 }
knayi.detectEncoding('က') // { encoding: 'unknown', unicode: 0, zawgyi: 0 }
knayi.detectEncoding('') // { encoding: 'none', unicode: 0, zawgyi: 0 }
```

For myanmar-tools, create its detector yourself and pass it as `zawgyiDetector`; `myanmartools_zg_threshold` is `thresholds`. A probability between the thresholds is `'unknown'`.

```javascript
import { ZawgyiDetector } from 'myanmar-tools'
import { detectEncoding } from 'knayi-myscript'

const zawgyiDetector = new ZawgyiDetector()
detectEncoding('မဂၤလာပါ', { zawgyiDetector, thresholds: [0.05, 0.95] })
```

### fontConvert(content, targetFontType, originalFontType?)

Returns a string. `targetFontType` is required. When `originalFontType` is omitted, `fontDetect` chooses it.

Name the source font for short text. When the detector's scores tie, it reads the text as Zawgyi (see [fontDetect](#fontdetectcontent-fallbackfonttype-options)), and short Unicode text often ties: a single consonant, or a word such as `ဗုဒ္ဓ` whose only telling sign is a stacked consonant, which Zawgyi reads as an asat. Converting such text from Zawgyi changes it.

The text is trimmed first. Zero-width spaces (`U+200B`) and non-joiners (`U+200C`) are kept, because they mark word breaks. When the two fonts are the same, the trimmed text is returned.

```javascript
compat.fontConvert('မဂၤလာပါ', 'unicode', 'zawgyi') // 'မင်္ဂလာပါ'
compat.fontConvert('မဂၤလာပါ', 'unicode') // 'မင်္ဂလာပါ'
compat.fontConvert('ဗုဒ္ဓ', 'unicode') // 'ဗုဒ်ဓ'  (a tie, read as Zawgyi)
compat.fontConvert('ဗုဒ္ဓ', 'unicode', 'unicode') // 'ဗုဒ္ဓ'
compat.fontConvert('မြန်မာ', 'zawgyi', 'unicode') // 'ျမန္မာ'
compat.fontConvert('ကျ', 'unicode') // 'ကျ'
compat.fontConvert(' ကာာ ', 'unicode', 'unicode') // 'ကာာ'
compat.fontConvert('မဂၤလာပါ', 'uni', 'zaw') // 'မင်္ဂလာပါ'
compat.fontConvert(null, 'unicode') // ''
compat.fontConvert('က') // 'က'  (no target font; warns)
```

The conversion itself is 3.0's: [Zawgyi to Unicode](README.md#zawgyi-to-unicode) and [Win fonts](README.md#win-fonts) in the README describe both.

```javascript
compat.fontConvert('ေယာက္်ား', 'unicode', 'zawgyi') // 'ယောက်ျား'
compat.fontConvert('ေစ်း', 'unicode', 'zawgyi') // 'ဈေး'
compat.fontConvert('ႏို္င္ငံ', 'unicode', 'zawgyi') // 'နိုင်ငံ'
compat.fontConvert('ၿမိဳ ့', 'unicode', 'zawgyi') // 'မြို့'
compat.fontConvert('jrefrm', 'unicode', 'win') // 'မြန်မာ'
compat.fontConvert('ajumifh', 'unicode', 'win') // 'ကြောင့်'
compat.fontConvert('ZvGefaps;', 'unicode', 'win') // 'ဇလွန်ဈေး'
compat.fontConvert('jrefrm', 'unicode') // 'jrefrm'  (no source font: plain ASCII)
```

Win is converted to Unicode only. Any other target returns the text unchanged, with an error unless silent.

**3.0: `toUnicode(text, { from })` and `toZawgyi(text)`.** They never trim, and `toUnicode` with no `from` detects each line on its own and leaves a line whose evidence ties as it is. `tie: 'zawgyi'` and a trim give 2.x's result on every text of one line.

```javascript
knayi.toUnicode('မဂၤလာပါ', { from: 'zawgyi' }) // 'မင်္ဂလာပါ'
knayi.toUnicode('ဗုဒ္ဓ') // 'ဗုဒ္ဓ'  (a tie: left as it is)
knayi.toUnicode(' ဗုဒ္ဓ ', { tie: 'zawgyi' }) // ' ဗုဒ်ဓ '
knayi.toUnicode(' ကာာ ', { from: 'unicode' }) // ' ကာာ '
knayi.toZawgyi('မြန်မာ') // 'ျမန္မာ'
knayi.toUnicode('jrefrm', { from: 'win' }) // 'မြန်မာ'
```

There is no conversion from Unicode to Win, and no `toUnicode(text, 'uni')`: 3.0 names a font once, as `from`.

### fontConvert.debugging(content, targetFontType, originalFontType)

Returns `{ to, from, matched_patterns, steps }`. `steps` is an array of strings. The last step equals `fontConvert` for the same arguments. From Unicode, `matched_patterns` holds the source of each rule pattern that matched. From Zawgyi or Win, it names each stage that changed the text: `sequences`, `glyphs`, `syllables`, `zero as wa`, `look-alikes`, `typos`, `NFC`. On every early exit, such as missing content, a missing target, the same source and target, or no Myanmar text, it returns what `fontConvert` returns, not an object.

**3.0: the `trace` option** of `toUnicode`, `toZawgyi` and `normalize`, with a trace from `createTrace()`. Its `start` is the input, and its `records` hold `{ id, label, text }` for each step that changed the text: `label` is the stage name or regex source 2.x put in `matched_patterns`, and `text` the step 2.x put in `steps`. One difference: from Unicode, 2.x's steps start at the text after the collapse of repeated marks, and 3.0's trace starts at the input, with the collapse as a record `uz.collapse` when it changed something. [README.md](README.md#traces-createtrace) lists the ids.

### syllBreak(content, fontType?, breakPoint?)

Returns one string. The default break character is `U+200B`. This is the current public break, not a split into `မ|င်္ဂ|လာ|ပါ`.

```javascript
compat.syllBreak('မင်္ဂလာပါ', null, '$$') // 'မင်္ဂလာ$$ပါ'
compat.syllBreak('မင်္ဂလာပါ') // 'မင်္ဂလာ' + '\u200b' + 'ပါ'
compat.syllBreak('မြန်မာ', 'unicode', '|') // 'မြန်|မာ'
compat.syllBreak('ထို့ကြောင့်', 'unicode', '|') // 'ထို့|ကြောင့်'
compat.syllBreak('က္က', 'unicode', '|') // 'က္က'
compat.syllBreak('က္က', 'zawgyi', '|') // 'က္|က'
compat.syllBreak('က္က', 'uni', '|') // 'က္က'
compat.syllBreak('ကက', 'unicode', '|') // 'ကက'
compat.syllBreak('ၾကပါ', 'zawgyi', '|') // 'ၾက|ပါ'
```

When `fontType` is omitted, detection runs first. Unknown font names throw.

Zawgyi types ေ and the medial ra before the consonant. A consonant typed after them ends its syllable, as ကြ does in Unicode.

**3.0: `segmentSyllables(text, { bareConsonants, from })`** returns the syllables as an array that joins back to the text, and `syllableBoundaries` where each starts. It reads a bare consonant as a syllable of its own unless `bareConsonants: 'pairs'` asks for 2.x's pairs; a syllable after white space starts a piece, where 2.x joined it to the syllable before (`bareConsonants: 'pairs'` still does); it keeps white space and zero-width characters; and it does not detect: `from` is `'unicode'` unless you say `'zawgyi'`.

```javascript
knayi.segmentSyllables('မင်္ဂလာပါ') // ['မင်္ဂ', 'လာ', 'ပါ']
knayi.segmentSyllables('မင်္ဂလာပါ', { bareConsonants: 'pairs' }) // ['မင်္ဂလာ', 'ပါ']
knayi.segmentSyllables('ကက') // ['က', 'က']
knayi.segmentSyllables('ကက', { bareConsonants: 'pairs' }) // ['ကက']
knayi.segmentSyllables('ၾကပါ') // ['ၾ', 'က', 'ပါ']  (Zawgyi read as Unicode)
knayi.segmentSyllables('ၾကပါ', { from: 'zawgyi' }) // ['ၾက', 'ပါ']
knayi.segmentSyllables(' မြန်\u200bမာ ') // [' ', 'မြန်\u200b', 'မာ ']
knayi.segmentSyllables('ကောင်း မောင်') // ['ကောင်း ', 'မောင်']
knayi.segmentSyllables('ကောင်း မောင်', { bareConsonants: 'pairs' }) // ['ကောင်း မောင်']
```

### spellingFix(content, fontType?)

Collapses a mark repeated two or more times into one mark. It does not reorder marks.

```javascript
compat.spellingFix('မင်္ဂလာာပါါ', 'unicode') // 'မင်္ဂလာပါ'
compat.spellingFix('ကိီ', 'unicode') // 'ကိီ'
compat.spellingFix('\u1033\u1033', 'zawgyi') // '\u1033'
compat.spellingFix('\u1033\u1033', 'zaw') // '\u1033'
```

**3.0: `collapseRepeatedMarks(text, { from })`**, with no trim, no removal of zero-width characters, and no detection.

```javascript
knayi.collapseRepeatedMarks('မင်္ဂလာာပါါ') // 'မင်္ဂလာပါ'
knayi.collapseRepeatedMarks(' ကာာ\u200b ') // ' ကာ\u200b '
```

### normalize(content)

Unicode only, written for Burmese. Puts every syllable in Unicode storage order ([UTN #11](https://www.unicode.org/notes/tn11/)) with the rules of [Zawgyi to Unicode](README.md#zawgyi-to-unicode), makes a few typing fixes, and returns NFC. It keeps surrounding spaces, zero-width spaces and joiners. It is not the same operation as `spellingFix`. [README.md](README.md#normalizetext-options) lists its rules, which 3.0's `normalize` shares.

```javascript
compat.normalize('မိြုင်မိြုင်\nဆိုင်ဆုိင်') // 'မြိုင်မြိုင်\nဆိုင်ဆိုင်'
compat.normalize(' မိြုင် ') // ' မြိုင် '
compat.normalize('ယောကျ်ား') // 'ယောက်ျား'
compat.normalize('လည်းေကာင်း') // 'လည်းကောင်း'
compat.normalize('၂ဝ၁၉') // '၂၀၁၉'
compat.normalize('ကိီ') // 'ကီ'
compat.normalize('ဝ') // 'ဝ'
compat.normalize('e\u0301') // '\u00e9'  (no Myanmar letters: NFC only)
```

On garbled text, a second call can change the result again:

```javascript
compat.normalize('၀ွ ှ') // 'ဝွ ှ'
compat.normalize('ဝွ ှ') // 'ဝွှ'
```

**3.0: `normalize(text, { report, trace })`** is idempotent: wherever no ဥ, ၀ or ၇ stands after a virama or under a kinzi, it gives at once the text that repeated calls of 2.x's `normalize` settle on. So it differs from 2.x's only on text that 2.x would change again, or that has such a ဥ, ၀ or ၇: on no line of a Unicode corpus.

```javascript
knayi.normalize('၀ွ ှ') // 'ဝွှ'
knayi.normalize('ယောကျ်ား') // 'ယောက်ျား'
```

### truncate(content, options?)

Cuts on the current syllable breaks, then on spaces inside a syllable that does not fit. Defaults are `length: 30` and `omission: '...'`. The omission is appended even when the text is shorter than `length`. `options.fontType` accepts the same font names. When omitted, detection runs.

```javascript
compat.truncate('အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။', { length: 30, omission: '...' })
// 'အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဈေး...'
compat.truncate('က') // 'က...'
compat.truncate('') // '...'
compat.truncate(null) // ''
```

The result is not always a prefix of the text: a part that does not fit adds those of its words that do, so a later word can follow a skipped one, as ဈေး follows the skipped ဇလွန် above. A `length` or `omission` that is falsy, `0` or `''`, takes its default.

**3.0: `truncate(text, { length, omission, bareConsonants, from })`** returns a text that fits as it is, and otherwise a prefix cut at a syllable break, then the omission, in at most `length` units. `0` is a length and `''` an omission; `undefined` and `null` take the defaults. The text's encoding is `from`, not `fontType`, and is not detected.

```javascript
knayi.truncate('အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။', { length: 30 })
// 'အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇ...'
knayi.truncate('က') // 'က'
knayi.truncate('') // ''
compat.truncate('abcdef', { length: 3, omission: '' }) // '...'
knayi.truncate('abcdef', { length: 3, omission: '' }) // 'abc'
```

The 3.0 cut above ends at the bare consonant ဇ, a syllable of its own under the default policy; `bareConsonants: 'pairs'` cuts before it.
