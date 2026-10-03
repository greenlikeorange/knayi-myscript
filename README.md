# knayi-myscript

JavaScript library for Myanmar (Burmese) text stored as Unicode or Zawgyi. Version 2.10.0. MIT license.

It detects the encoding, converts between them, inserts syllable breaks, collapses repeated spelling marks, normalizes some Unicode typing errors, and truncates on those breaks. It does not segment dictionary words, translate, or tokenize for a language model.

Try every function in the browser at <https://greenlikeorange.github.io/knayi-myscript/>.

Install it from npm. npm, Yarn, pnpm, and Bun all read that registry.

```bash
npm install knayi-myscript
yarn add knayi-myscript
pnpm add knayi-myscript
bun add knayi-myscript
```

Browser script, global name `knayi`:

```html
<script src="https://unpkg.com/knayi-myscript@2.10.0/dist/knayi-myscript.min.js"></script>
```

## Runtime

Node.js 16 or newer. CI runs the tests on Node 22, 24, and 26, and a smoke test of the README examples and the builds on Node 16, 18, and 20. Building and testing the package needs Node 22 or newer. Node 24 is the version in `.nvmrc`.

```javascript
const knayi = require('knayi-myscript')
```

```javascript
import knayi from 'knayi-myscript'
```

```typescript
import knayi from 'knayi-myscript'
```

TypeScript types are `index.d.ts`. Named imports such as `import { fontConvert } from 'knayi-myscript'` work in Node and in bundlers, next to the default import. The default import compiles with or without `esModuleInterop`. The option types (`DetectorOptions`, `GlobalOptions`, `TruncateOptions`) are exported.

In Node, `require` and `import` both load `main.js` and share `setGlobalOptions`. A bundler that follows the `module` field loads `dist/knayi-myscript.es.js` instead. That file is a second copy. If one part of an app uses `main.js` and another uses `dist/knayi-myscript.es.js`, silent mode and detector settings do not cross between them.

The script build sets the global `knayi`, both in a `<script>` tag and when a bundler loads it with `import 'knayi-myscript/dist/knayi-myscript.min.js'`.

The `dist/` builds are ES2015. They run in Chrome 49, Edge 14, Firefox 34, Safari 10 (iOS 10), Samsung Internet 5 and Opera 36, or newer. Internet Explorer needs knayi 2.8.3.

These paths load without an `exports` map:

- `knayi-myscript`
- `knayi-myscript/library/converter`
- `knayi-myscript/dist/knayi-myscript.min.js`
- `knayi-myscript/dist/knayi-myscript.es.js`

## Font names

`unicode`, `uni`, `zawgyi`, `zaw`, and `win`. `uni` is Unicode. `zaw` is Zawgyi. `win` is the Win Innwa family of legacy fonts, which `fontConvert` converts to Unicode. Any other string is an unknown font.

## Missing content

`null`, `undefined`, `''`, `0`, `false`, and `NaN` are missing content, as in 2.8.3.

| Function | Missing content |
| --- | --- |
| `fontDetect` | The fallback, or `'en'` when the fallback is omitted. Warns unless silent. |
| `fontConvert`, `syllBreak`, `spellingFix`, `normalize` | `''`. Warns unless silent. |
| `truncate` | `''`. Warns unless silent. An empty string `''` returns the omission instead. |

Text with no Myanmar letters (`U+1000`–`U+109F`) is returned unchanged by convert, break, and spelling fix. `fontDetect` returns the fallback or `'en'`. `truncate` still appends the omission. `normalize` returns it in NFC, so `'e\u0301'` becomes `'é'` (`U+00E9`). A Win source is the exception for convert: Win text is ASCII, so `fontConvert` converts it.

Other values, such as numbers and objects, are returned unchanged the same way, and no function throws on them, with one exception: `truncate` turns them into strings first, like `lodash.truncate`, so it throws a `TypeError` on an object that `String()` cannot convert, such as `Object.create(null)`. `String` objects work like the strings they hold.

`setGlobalOptions({ silent_mode: true })` hides those warnings. The option applies to the copy of the library that received the call.

## fontDetect(content, fallbackFontType?, options?)

Returns `'unicode'`, `'zawgyi'`, or the fallback / `'en'`.

When the rule scores tie, including a single consonant such as `က`, the result is the fallback, or `'zawgyi'` if the fallback is omitted.

```javascript
knayi.fontDetect('မဂၤလာပါ') // 'zawgyi'
knayi.fontDetect('မင်္ဂလာပါ') // 'unicode'
knayi.fontDetect('ကျ') // 'unicode'
knayi.fontDetect('က') // 'zawgyi'
knayi.fontDetect('က', 'unicode') // 'unicode'
knayi.fontDetect(null) // 'en'
```

`options.adapter` chooses the detector for that call. `'rules'` is the built-in scorer and the default. `'myanmartools'` uses the `myanmar-tools` package. Install it only for that adapter, and use 1.1.x: `myanmar-tools` 1.2.0 on npm was published without its built files and cannot be loaded.

```bash
npm install myanmar-tools@1.1.3
```

```javascript
knayi.fontDetect('မဂၤလာပါ', null, { adapter: 'myanmartools' }) // 'zawgyi'
knayi.fontDetect('မင်္ဂလာပါ', null, {
  use_myanmartools: true,
  myanmartools_zg_threshold: [0.05, 0.95]
}) // 'unicode'
```

`use_myanmartools: true` selects the same adapter. A probability below the first threshold returns `'unicode'`. A probability above the second returns `'zawgyi'`. A probability between them returns the fallback. The default pair is `[0.05, 0.95]`. If the package is not installed or cannot be loaded, the call uses the rule scorer and warns once. The warning says which of the two happened.

`setGlobalOptions({ detector: { use_myanmartools: true } })` changes the default. An explicit `adapter` on a later call wins. A later call that only sets `use_myanmartools` keeps a previously stored threshold.

The rule scorer does not count a consonant, `U+1039`, consonant sequence such as `က္က` as Unicode. In Zawgyi, `U+1039` is the visible asat, so `ပ္က` is a common Zawgyi sequence. A lone stack is a tie and returns the fallback. In longer Unicode text such as `ရန်ကုန်တက္ကသိုလ်`, the other signs decide.

## fontConvert(content, targetFontType, originalFontType?)

Returns a string. `targetFontType` is required. When `originalFontType` is omitted, `fontDetect` chooses it.

Name the source font for short text. When the detector's scores tie, it reads the text as Zawgyi (see [fontDetect](#fontdetectcontent-fallbackfonttype-options)), and short Unicode text often ties: a single consonant, or a word such as `ဗုဒ္ဓ` whose only telling sign is a stacked consonant, which Zawgyi reads as an asat. Converting such text from Zawgyi changes it.

The text is trimmed first. Zero-width spaces (`U+200B`) and non-joiners (`U+200C`) are kept, because they mark word breaks. When the two fonts are the same, the trimmed text is returned.

```javascript
knayi.fontConvert('မဂၤလာပါ', 'unicode', 'zawgyi') // 'မင်္ဂလာပါ'
knayi.fontConvert('မဂၤလာပါ', 'unicode') // 'မင်္ဂလာပါ'
knayi.fontConvert('ဗုဒ္ဓ', 'unicode') // 'ဗုဒ်ဓ'  (a tie, read as Zawgyi)
knayi.fontConvert('ဗုဒ္ဓ', 'unicode', 'unicode') // 'ဗုဒ္ဓ'
knayi.fontConvert('မြန်မာ', 'zawgyi', 'unicode') // 'ျမန္မာ'
knayi.fontConvert('ကျ', 'unicode') // 'ကျ'
knayi.fontConvert(' ကာာ ', 'unicode', 'unicode') // 'ကာာ'
knayi.fontConvert('မဂၤလာပါ', 'uni', 'zaw') // 'မင်္ဂလာပါ'
knayi.fontConvert(null, 'unicode') // ''
knayi.fontConvert('က') // 'က'  (no target font; warns)
```

`fontConvert.debugging(content, targetFontType, originalFontType)` returns `{ to, from, matched_patterns, steps }`. `steps` is an array of strings. The last step equals `fontConvert` for the same arguments. From Unicode, `matched_patterns` holds the source of each rule pattern that matched. From Zawgyi or Win, it names each stage that changed the text: `sequences`, `glyphs`, `syllables`, `zero as wa`, `look-alikes`, `typos`, `NFC`.

### Zawgyi to Unicode

Zawgyi stores text in the order the glyphs are drawn: ေ and medial ra before the consonant, kinzi and stacked consonants after it, and the marks in any order. knayi reads each Zawgyi glyph as Unicode characters and writes every syllable in Unicode storage order ([UTN #11](https://www.unicode.org/notes/tn11/)). Win fonts use the same rules.

```javascript
knayi.fontConvert('ေယာက္်ား', 'unicode', 'zawgyi') // 'ယောက်ျား'
knayi.fontConvert('ေစ်း', 'unicode', 'zawgyi') // 'ဈေး'
knayi.fontConvert('ႏို္င္ငံ', 'unicode', 'zawgyi') // 'နိုင်ငံ'
knayi.fontConvert('ၿမိဳ ့', 'unicode', 'zawgyi') // 'မြို့'
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
- **Typing fixes, as in [normalize](#normalizecontent):** ဝ or ရ typed in a number is a digit (`၂ဝ၁၉` is ၂၀၁၉). ၇ starting a closed syllable is ရ (ဆိုရင်). ိ with ီ is ီ (ဦး), and ု with ူ is ူ.
- **Spaces:** a space typed before a mark only moved the mark, so it is dropped: `ၿမိဳ ့` is မြို့ and `တစ္ခ ု` is တစ်ခု. A line break stays.
- **Zero-width characters:** a zero-width space or non-joiner typed inside a syllable moves to the end of the syllable.
- **NFC:** the result is NFC.

Converting from Unicode collapses a mark typed twice in a row, as `spellingFix` does, then applies knayi's pattern rules.

### Win fonts

Win Innwa, Win Researcher, Win Kalaw and the other Win fonts by WinMyanmar Systems (1992–2005) draw Burmese glyphs on the keys that type them. Win text is ASCII and Latin-1: `jrefrm` shows as မြန်မာ in a Win font. Name the source font, because `fontDetect` never returns `win`.

```javascript
knayi.fontConvert('jrefrm', 'unicode', 'win') // 'မြန်မာ'
knayi.fontConvert('ajumifh', 'unicode', 'win') // 'ကြောင့်'
knayi.fontConvert('ZvGefaps;', 'unicode', 'win') // 'ဇလွန်ဈေး'
knayi.fontConvert('jrefrm', 'unicode') // 'jrefrm'  (no source font: plain ASCII)
```

knayi converts Win to Unicode only. Any other target returns the text unchanged, with an error unless silent.

- Win text is stored in drawing order, like Zawgyi, and knayi converts it with the same rules (see [Zawgyi to Unicode](#zawgyi-to-unicode)). So `ajumifh` (asat before the dot below) becomes ကြောင့် with the dot below first, `a,musfm;` is ယောက်ျား and `usGefkyf` is ကျွန်ုပ်.
- `0` is both ဝ and ၀ in Win, and `7` can be ရ, as in Zawgyi. `ps`, `Mo`, `aMomf` and `OD` become ဈ, ဩ, ဪ and ဦ.
- Text read as ISO-8859-1 instead of Windows-1252 converts the same way.
- Fractions become text such as ၁/၂. Dingbats become the Unicode symbols they show. The vendor logo at byte 0xB0 is dropped.
- English typed in another font run is ASCII too. Once the font names are gone, convert only the Win text.
- Wwin_Burmese and other ASCII fonts use different mappings and are not supported.

## syllBreak(content, fontType?, breakPoint?)

Returns one string. The default break character is `U+200B`. This is the current public break, not a split into `မ|င်္ဂ|လာ|ပါ`.

```javascript
knayi.syllBreak('မင်္ဂလာပါ', null, '$$') // 'မင်္ဂလာ$$ပါ'
knayi.syllBreak('မင်္ဂလာပါ') // 'မင်္ဂလာ' + '\u200b' + 'ပါ'
knayi.syllBreak('မြန်မာ', 'unicode', '|') // 'မြန်|မာ'
knayi.syllBreak('ထို့ကြောင့်', 'unicode', '|') // 'ထို့|ကြောင့်'
knayi.syllBreak('က္က', 'unicode', '|') // 'က္က'
knayi.syllBreak('က္က', 'zawgyi', '|') // 'က္|က'
knayi.syllBreak('က္က', 'uni', '|') // 'က္က'
knayi.syllBreak('ကက', 'unicode', '|') // 'ကက'
knayi.syllBreak('ၾကပါ', 'zawgyi', '|') // 'ၾက|ပါ'
```

When `fontType` is omitted, detection runs first. Unknown font names throw.

Zawgyi types ေ and the medial ra before the consonant. A consonant typed after them ends its syllable, as ကြ does in Unicode.

## spellingFix(content, fontType?)

Collapses a mark repeated two or more times into one mark. It does not reorder marks.

```javascript
knayi.spellingFix('မင်္ဂလာာပါါ', 'unicode') // 'မင်္ဂလာပါ'
knayi.spellingFix('ကိီ', 'unicode') // 'ကိီ'
knayi.spellingFix('\u1033\u1033', 'zawgyi') // '\u1033'
knayi.spellingFix('\u1033\u1033', 'zaw') // '\u1033'
```

## normalize(content)

Unicode only, written for Burmese. Puts every syllable in Unicode storage order ([UTN #11](https://www.unicode.org/notes/tn11/)) with the rules of [Zawgyi to Unicode](#zawgyi-to-unicode), makes a few typing fixes, and returns NFC.
- **What stays the same:** text that is already right, and text normalized a second time. The output of `fontConvert` comes back unchanged too, except where the source has an ေ or medial ra with no consonant after it. The converters leave such a mark where it was typed, and `normalize` may attach it to the syllable before: Zawgyi `ကေျ` converts to `ကေြ`, which `normalize` makes `ကြေ`. This changes 31 of the 10,166 mC4 lines that `fontDetect` calls Zawgyi.
- **What it keeps:** surrounding spaces, zero-width spaces and joiners.

It is not the same operation as `spellingFix`.

```javascript
knayi.normalize('မိြုင်မိြုင်\nဆိုင်ဆုိင်') // 'မြိုင်မြိုင်\nဆိုင်ဆိုင်'
knayi.normalize(' မိြုင် ') // ' မြိုင် '
knayi.normalize('ယောကျ်ား') // 'ယောက်ျား'
knayi.normalize('လည်းေကာင်း') // 'လည်းကောင်း'
knayi.normalize('၂ဝ၁၉') // '၂၀၁၉'
knayi.normalize('ကိီ') // 'ကီ'
knayi.normalize('ဝ') // 'ဝ'
knayi.normalize('e\u0301') // '\u00e9'  (no Myanmar letters: NFC only)
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

## truncate(content, options?)

Cuts on the current syllable breaks, then on spaces inside a syllable that does not fit. Defaults are `length: 30` and `omission: '...'`. The omission is appended even when the text is shorter than `length`. `options.fontType` accepts the same font names. When omitted, detection runs.

```javascript
knayi.truncate('အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။', { length: 30, omission: '...' })
// 'အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဈေး...'
knayi.truncate('က') // 'က...'
knayi.truncate('') // '...'
knayi.truncate(null) // ''
```

## Command line

`knayi` runs the 3.0 API over files or standard input, for shell scripts and for data pipelines in any language, Python included. It comes with knayi 3.0 and needs Node.js 22.12 or newer.

```bash
npm install --global knayi-myscript
knayi to-unicode notes.txt > notes.unicode.txt
npx --package knayi-myscript knayi detect notes.txt
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
| `--policy <policy>` | `segment` | How a consonant with no mark is read: `separate` (the default), a syllable of its own; `chains`, joined to the syllable after it; `pairs`, joined two by two, as 2.x `syllBreak` did. |
| `--separator <text>` | `segment` | What goes between syllables. Default `\|`. |
| `--jsonl` | all | Read and write JSON Lines. |
| `--field <name>` | all, with `--jsonl` | The field that holds the text. Default `text`. |
| `--into <name>` | all, with `--jsonl` | The field the result is written to. Default: `--field` for text, else `encoding` (`detect`), `syllables` (`segment`) or `issues` (`check`). |
| `--encoding <name>` | all | The input's encoding: `utf-8` (the default) or `windows-1252`. |
| `--max-line-length <n>` | all | The longest line read, in UTF-16 units. Default 16,777,216. |
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
{"command":"to-unicode","version":"3.0.0","outputVersion":2,"records":3,"changed":1}
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

## Build

`dist/` holds the build of the last release, or of the release being prepared, because jsDelivr serves the `dist/` of the main branch. It changes only in a release commit, which also changes the version. `npm run build` writes:

- `dist/knayi-myscript.mjs`
- `dist/knayi-myscript.es.js` (same bytes as the `.mjs` file)
- `dist/knayi-myscript.js`
- `dist/knayi-myscript.min.js`

`npm test` runs the tests on a build made in a temporary directory. [ARCHITECTURE.md](ARCHITECTURE.md#running-the-checks) lists every test and check script.

`npm run eval` measures conversion and detection on public Zawgyi and Unicode data, next to a published knayi release, myanmar-tools, and Rabbit. `npm run bench` measures speed on real text and long input. Both download their data on first use. See [scripts/eval/README.md](scripts/eval/README.md). The latest results are published at <https://greenlikeorange.github.io/knayi-myscript/benchmark.html>.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) explains how to report a problem and how to send a change, and [ARCHITECTURE.md](ARCHITECTURE.md) how the code is organized. [CHANGELOG.md](CHANGELOG.md) lists what changed in each version, output changes first. Report security problems privately, as [SECURITY.md](SECURITY.md) describes.
