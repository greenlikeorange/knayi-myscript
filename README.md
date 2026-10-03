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

TypeScript types are `index.d.ts`, with documentation for every export that editors show. Named imports such as `import { fontConvert } from 'knayi-myscript'` work in Node and in bundlers, next to the default import. The default import compiles with or without `esModuleInterop`. The option types (`DetectorOptions`, `GlobalDetectorOptions`, `GlobalOptions`, `TruncateOptions`), `ConvertDebug` and `FontName` are exported. A font parameter takes any string, and editors suggest the names in `FontName`. `fontDetect`'s result type is `'unicode' | 'zawgyi' | 'en'`, with the fallback's type in place of `'en'` when you pass a fallback.

In Node, `require` and `import` both load `main.js` and share `setGlobalOptions`. A bundler that follows the `module` field loads `dist/knayi-myscript.es.js` instead. That file is a second copy. If one part of an app uses `main.js` and another uses `dist/knayi-myscript.es.js`, silent mode and detector settings do not cross between them.

The script build sets the global `knayi`, both in a `<script>` tag and when a bundler loads it with `import 'knayi-myscript/dist/knayi-myscript.min.js'`.

The `dist/` builds are ES2015. They run in Chrome 49, Edge 14, Firefox 34, Safari 10 (iOS 10), Samsung Internet 5 and Opera 36, or newer. Internet Explorer needs knayi 2.8.3.

These paths load without an `exports` map:

- `knayi-myscript`
- `knayi-myscript/library/converter`
- `knayi-myscript/dist/knayi-myscript.min.js`
- `knayi-myscript/dist/knayi-myscript.es.js`

`knayi-myscript/library/converter` is `fontConvert`, typed by `library/converter.d.ts`. Load it with `require`, or with a default import where `esModuleInterop` is on. An ES module in Node names the file with its extension: `knayi-myscript/library/converter.js`.

## Font names

`unicode`, `uni`, `zawgyi`, `zaw`, and `win`. `uni` is Unicode. `zaw` is Zawgyi. `win` is the Win Innwa family of legacy fonts, which `fontConvert` converts to Unicode. Names are case-insensitive, so `Unicode`, `ZAWGYI` and `Win` name the same fonts. Any other string is an unknown font. `fontDetect` does not read its fallback as a font name: it returns a string fallback as given, and ignores a fallback that is not a string ([fontDetect](#fontdetectcontent-fallbackfonttype-options)). In `syllBreak`, `spellingFix` and `truncate`, a font that is not a string, such as `null`, an array, or the index `Array#map` passes, and `''` name no font, and `fontDetect` chooses it. `Array#map` also passes the array itself, which `syllBreak` takes as its break point, so `lines.map(knayi.syllBreak)` joins each line's syllables with the text of the whole array ([syllBreak](#syllbreakcontent-fonttype-breakpoint)).

| Function | `win` | An unknown font |
| --- | --- | --- |
| `fontConvert`, source font | Converts Win text to Unicode | Detects the font. Warns unless silent. |
| `fontConvert`, target font | Returns the text. An error unless silent. | Returns the text. An error unless silent. |
| `syllBreak`, `truncate` | Throws a `TypeError` | Throws a `TypeError` |
| `spellingFix` | Collapses the Unicode marks | Collapses the Unicode marks |

`syllBreak` and `truncate` break Unicode and Zawgyi text only. The `TypeError` they throw has the code `'ERR_KNAYI_INVALID_FONT'`: test `error.code`, not the message, which may change. They throw only for text they would break: missing content, and text with no Myanmar letters, come back as [Missing content](#missing-content) says. Convert Win text to Unicode first:

```javascript
knayi.syllBreak(knayi.fontConvert('jrefrm', 'unicode', 'win'), 'unicode', '|') // 'မြန်|မာ'
knayi.fontConvert('ျမန္မာ', 'unicode', 'zg') // 'မြန်မာ'  (unknown source font, detected; warns)
knayi.fontConvert('ျမန္မာ', 'Unicode', 'ZAWGYI') // 'မြန်မာ'
```

## Missing content

`null`, `undefined`, `''`, `0`, `false`, and `NaN` are missing content, as in 2.8.3.

| Function | Missing content |
| --- | --- |
| `fontDetect` | The fallback, or `'en'` when there is no fallback. Warns unless silent. |
| `fontConvert`, `syllBreak`, `spellingFix`, `normalize` | `''`. Warns unless silent. |
| `truncate` | `''`. Warns unless silent. An empty string `''` returns the omission instead. |

Text with no Myanmar letters (`U+1000`–`U+109F`) is returned unchanged by convert, break, and spelling fix. `fontDetect` returns the fallback or `'en'`. `truncate` still appends the omission. `normalize` returns it in NFC, so `'e\u0301'` becomes `'é'` (`U+00E9`). A Win source is the exception for convert: Win text is ASCII, so `fontConvert` converts it.

Other values, such as numbers and objects, are returned unchanged the same way, and no function throws on them, with one exception: `truncate` turns them into strings first, like `lodash.truncate`, so it throws a `TypeError` on an object that `String()` cannot convert, such as `Object.create(null)`. `String` objects work like the strings they hold.

`setGlobalOptions({ silent_mode: true })` hides those warnings. The option applies to the copy of the library that received the call.

## fontDetect(content, fallbackFontType?, options?)

Returns `'unicode'`, `'zawgyi'`, or the fallback / `'en'`.

The fallback is a string, returned as given; a `String` object counts as its string. Any other value is no fallback, and neither is `''`. So `lines.map(knayi.fontDetect)`, which passes each line's index as the fallback, gives `'unicode'`, `'zawgyi'` or `'en'` for every line.

When the rule scores tie, including a single consonant such as `က`, the result is the fallback, or `'zawgyi'` if there is no fallback.

```javascript
knayi.fontDetect('မဂၤလာပါ') // 'zawgyi'
knayi.fontDetect('မင်္ဂလာပါ') // 'unicode'
knayi.fontDetect('ကျ') // 'unicode'
knayi.fontDetect('က') // 'zawgyi'
knayi.fontDetect('က', 'unicode') // 'unicode'
knayi.fontDetect('က', 1) // 'zawgyi'  (a number is no fallback)
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

`setGlobalOptions({ detector: { use_myanmartools: true } })` changes the default. An explicit `adapter` on a later call wins. A later call that only sets `use_myanmartools` keeps a previously stored threshold. `null` options, like omitted ones, use the stored settings, and `setGlobalOptions(null)` changes nothing.

The threshold pair must be two finite numbers in order, `[low, high]`; the two may be equal. For any other value, the call uses the stored pair (`setGlobalOptions` keeps it) and writes an error unless silent. The error starts with its code, `[ERR_KNAYI_INVALID_THRESHOLD]`: match the code, not the words after it, which may change. An `adapter` name other than `'rules'` and `'myanmartools'` warns unless silent, and the call uses the adapter `use_myanmartools` picks, as it does when the `adapter` is not a string or is `''`. `fontDetect` reads its options only for text with a Myanmar letter, so only those calls check them.

```javascript
knayi.fontDetect('ကျ', null, null) // 'unicode'
knayi.fontDetect('ကျ', null, { adapter: 'rule' }) // 'unicode'  (unknown adapter; warns)
knayi.fontDetect('ကျ', null, { myanmartools_zg_threshold: [0.95, 0.05] }) // 'unicode'  (thresholds out of order; an error unless silent)
```

The rule scorer does not count a consonant, `U+1039`, consonant sequence such as `က္က` as Unicode. In Zawgyi, `U+1039` is the visible asat, so `ပ္က` is a common Zawgyi sequence. A lone stack is a tie and returns the fallback. In longer Unicode text such as `ရန်ကုန်တက္ကသိုလ်`, the other signs decide.

## fontConvert(content, targetFontType, originalFontType?)

Returns a string. `targetFontType` is required. When `originalFontType` is omitted, `fontDetect` chooses it. An unknown `originalFontType` is detected the same way, with a warning unless silent.

Name the source font for short text. When the detector's scores tie, it reads the text as Zawgyi (see [fontDetect](#fontdetectcontent-fallbackfonttype-options)), and short Unicode text often ties: a single consonant, or a word such as `ဗုဒ္ဓ` whose only telling sign is a stacked consonant, which Zawgyi reads as an asat. Converting such text from Zawgyi changes it.

The text is trimmed first. Zero-width characters in it are kept, zero-width spaces (`U+200B`) and non-joiners (`U+200C`) included; trimming removes only a zero-width no-break space (`U+FEFF`) at either end, which JavaScript counts as whitespace. When the two fonts are the same, the trimmed text is returned.

```javascript
knayi.fontConvert('မဂၤလာပါ', 'unicode', 'zawgyi') // 'မင်္ဂလာပါ'
knayi.fontConvert('မဂၤလာပါ', 'unicode') // 'မင်္ဂလာပါ'
knayi.fontConvert('ဗုဒ္ဓ', 'unicode') // 'ဗုဒ်ဓ'  (a tie, read as Zawgyi)
knayi.fontConvert('ဗုဒ္ဓ', 'unicode', 'unicode') // 'ဗုဒ္ဓ'
knayi.fontConvert('မြန်မာ', 'zawgyi', 'unicode') // 'ျမန္မာ'
knayi.fontConvert('မဇ္ဈိမ', 'zawgyi', 'unicode') // 'မဇၩိမ'
knayi.fontConvert('ကျ', 'unicode') // 'ကျ'
knayi.fontConvert(' ကာာ ', 'unicode', 'unicode') // 'ကာာ'
knayi.fontConvert('မဂၤလာပါ', 'uni', 'zaw') // 'မင်္ဂလာပါ'
knayi.fontConvert(null, 'unicode') // ''
knayi.fontConvert('က') // 'က'  (no target font; warns)
```

`fontConvert.debugging(content, targetFontType, originalFontType)` returns `{ to, from, matched_patterns, steps }`. `steps` is an array of strings. The last step equals `fontConvert` for the same arguments. From Unicode, `matched_patterns` holds the regex source of each rule that matched (for a rule rewritten for speed, the source it had before). From Zawgyi or Win, it names each stage that changed the text: `sequences`, `glyphs`, `syllables`, `zero as wa`, `typos`, `look-alikes`, `NFC`. Where `fontConvert` returns before converting (missing content, no Myanmar letters, a missing or unknown target, the same font, or a Win direction it does not convert), the object has no `matched_patterns` and one step, what `fontConvert` returns. There, `to` or `from` is `''` where the call names no font knayi knows, and `from` is `''` too when the call returns before it detects the source. Content that is not a string, such as a number, comes back unchanged.

```javascript
knayi.fontConvert.debugging(' ကျ ', 'unicode', 'unicode') // { to: 'unicode', from: 'unicode', matched_patterns: [], steps: ['ကျ'] }
knayi.fontConvert.debugging('abc', 'unicode') // { to: 'unicode', from: '', matched_patterns: [], steps: ['abc'] }
```

Only `fontConvert.debugging` returns this object. `fontConvert` never does, however it is called: also as a plain function (`const convert = knayi.fontConvert`) in a page or app with a global variable named `debug`.

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
- **Zero-width characters:** a zero-width space, non-joiner, joiner, word joiner or zero-width no-break space (`U+200B`, `U+200C`, `U+200D`, `U+2060`, `U+FEFF`) typed inside a syllable moves to the end of the syllable, and one typed between ေ or medial ra and its consonant moves before the syllable.
- **NFC:** the result is NFC.

Converting from Unicode collapses a mark typed twice in a row, as `spellingFix` does, then applies knayi's pattern rules. Stacked ဈ, as in မဇ္ဈိမ, and stacked စ with medial ya both become U+1069, Zawgyi's stacked ဈ, which converts back to stacked ဈ.

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

When `fontType` is omitted, detection runs first. `win` and unknown font names throw a `TypeError` with the code `'ERR_KNAYI_INVALID_FONT'` (see [Font names](#font-names)).

`Array#map` calls its function with three arguments: the line, its index and the array. So `lines.map(knayi.syllBreak)` passes the index as the font, which names no font, and the whole array as the break point: each line's syllables are joined with the text of the array, and no error tells you. Pass the line alone, as in `lines.map((line) => knayi.syllBreak(line))`:

```javascript
['မြန်မာ', 'ျမန္မာ'].map((line) => knayi.syllBreak(line, null, '|')) // ['မြန်|မာ', 'ျမန္|မာ']
['မြန်မာ', 'ျမန္မာ'].map(knayi.syllBreak) // ['မြန်မြန်မာ,ျမန္မာမာ', 'ျမန္မြန်မာ,ျမန္မာမာ']  (the array is the break point)
```

Zawgyi types ေ and the medial ra before the consonant. A consonant typed after them ends its syllable, as ကြ does in Unicode.

## spellingFix(content, fontType?)

Collapses a mark repeated two or more times into one mark. It does not reorder marks. `win` and unknown font names collapse the Unicode marks.

```javascript
knayi.spellingFix('မင်္ဂလာာပါါ', 'unicode') // 'မင်္ဂလာပါ'
knayi.spellingFix('ကိီ', 'unicode') // 'ကိီ'
knayi.spellingFix('\u1033\u1033', 'zawgyi') // '\u1033'
knayi.spellingFix('\u1033\u1033', 'zaw') // '\u1033'
```

## normalize(content)

Unicode only, written for Burmese. Puts every syllable in Unicode storage order ([UTN #11](https://www.unicode.org/notes/tn11/)) with the rules of [Zawgyi to Unicode](#zawgyi-to-unicode), makes a few typing fixes, and returns NFC.
- **What stays the same:** text that is already right, and text normalized a second time, unless it is garbled (below). The output of `fontConvert` comes back unchanged too, except where the source has an ေ or medial ra with no consonant after it. The converters leave such a mark where it was typed, and `normalize` may attach it to the syllable before: Zawgyi `ကေျ` converts to `ကေြ`, which `normalize` makes `ကြေ`. This changes 31 of the 10,166 mC4 lines that `fontDetect` calls Zawgyi.
- **What can change again:** garbled text, such as marks with no consonant before them. A second pass changes 104 of the 14,304 mC4 lines, which are mostly Zawgyi, and no line of the Burmese, Shan, Mon, S'gaw Karen and Pa'o Unicode text knayi is tested on. `normalize` can also change garbled text from `fontConvert` in other places than an ေ or medial ra.
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

Returns the start of the text, with the omission appended. The start is the longest one that fits in `length`, omission included, and ends at a syllable break or after whitespace: the syllables that fit, then the words of the next syllable that fit with the whitespace after them. It is trimmed. Defaults are `length: 30` and `omission: '...'`; `length` counts UTF-16 code units. The omission is appended even when the text is shorter than `length`. `options.fontType` takes the same font names as `syllBreak`: when omitted, detection runs, and `win` or an unknown name throws a `TypeError` with the code `'ERR_KNAYI_INVALID_FONT'`.

The text is read as `syllBreak` reads it: trimmed, without zero-width spaces and non-joiners (`U+200B`, `U+200C`), and in Unicode with a dot below typed after an asat put before it. When no font is named, `truncate` detects it on the text as given, before that cleaning, and `syllBreak` on the cleaned text, so the two can choose different fonts for a text where removing a zero-width space or non-joiner at either end leaves whitespace there. Only the start of the text is broken into syllables, up to the first whitespace at an index above `length` minus the omission's length, so a long text takes little more time than a short one when you name the font; detection reads the whole text.

```javascript
knayi.truncate('အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။', { length: 30, omission: '...' })
// 'အာယုဝဍ်ဎနဆေးညွှန်းစာကို...'
knayi.truncate('အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။', { length: 35 })
// 'အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေး...'
knayi.truncate('က') // 'က...'
knayi.truncate('') // '...'
knayi.truncate(null) // ''
```

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
