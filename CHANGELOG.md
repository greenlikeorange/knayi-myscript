# Changelog

Changes to knayi-myscript, newest first. Versions follow [semantic versioning](https://semver.org), and 2.x makes no breaking changes.

## How to read it: output changes

knayi's output is used as data: people store it, index it and train on it. So every version starts with **Output changes**, a list of every change in what a public function returns, or in what `fontConvert.debugging` reports, for some input. Each entry names:

- the call forms that change (for example `normalize`, or `fontConvert` from Zawgyi to Unicode);
- how many lines of the eval corpora change, per corpus, and whether those are distinct lines;
- the pull request, and an example.

"None" means the output comparison found no difference and the contract matrix no changed cell. A pull request that changes output on purpose adds its entry here (see [CONTRIBUTING.md](CONTRIBUTING.md)). Everything else goes under **Security**, **Added**, **Changed** or **Fixed**.

Counts below are distinct lines of the corpora that `npm run eval` downloads (see [scripts/eval/README.md](scripts/eval/README.md)). "Wikipedia" is the 4,812-line sample those scripts read today.

## Unreleased

### Output changes

- **Font names follow one policy** (README, "Font names"). No corpus line changes: the output comparison finds 0 differences in 2,771,538 comparisons (every call form on every corpus, mC4 included, and on the generated and fuzz sets), since its call forms name `unicode`, `zawgyi` or `win` as they should, or no font. The changes are in what wrong font names do. In the API contract matrix, 277 of 3,703 cells change: 42 throw a `TypeError` with a code instead of an accidental one, 18 start throwing, 19 stop throwing, 4 return other text, 120 gain a warning, and 74 print the corrected error message.
  - **`syllBreak` and `truncate` throw a `TypeError` with the code `ERR_KNAYI_INVALID_FONT`** for `'win'` and for an unknown name, since their break rules are for Unicode and Zawgyi only. The message of `syllBreak('က', 'win')` is `knayi.syllBreak takes the font 'unicode' or 'zawgyi', not "win".` Before, most such names threw an accidental `TypeError` from inside the rules, whose message differed between runtimes and builds, and the names of `Object.prototype` members returned the text with no breaks: `syllBreak('ကကက', 'toString', '|')` returned `'ကကက'`, and `truncate('ကကက', { fontType: 'toString' })` returned `'ကကက...'`; both now throw. As before, they throw only for text with a Myanmar letter.
  - **A font that is not a string, or `''`, means "detect the font"** in `syllBreak`, `spellingFix` and `truncate`, as `undefined` and `null` already did. `syllBreak('မြန်မာ', 1, '|')`, with a number such as the index `Array#map` passes, threw a `TypeError` and now returns `'မြန်|မာ'`; `spellingFix('ကဳဳ', 1)` returned `'ကဳဳ'` (the Unicode marks) and now returns `'ကဳ'` (detected as Zawgyi). An array or another object is detected too. Before, one whose string form is a font name, such as `['unicode']`, was read as that font; most others threw a `TypeError` in `syllBreak` and `truncate`, and collapsed the Unicode marks in `spellingFix`: `syllBreak('ဗုဒ္ဓ', ['unicode'], '|')` returned `'ဗု|ဒ္ဓ'` and now returns `'ဗုဒ္|ဓ'`, since the detector's scores tie and it reads the text as Zawgyi. `fontConvert` still reads an array by its string form. `lines.map(knayi.syllBreak)` still does not work, and now goes wrong without an error: `Array#map` also passes the array, which `syllBreak` takes as its break point, so each line's syllables are joined with the text of the whole array. `['မြန်မာ', 'ျမန္မာ'].map(knayi.syllBreak)` threw a `TypeError` and now returns `['မြန်မြန်မာ,ျမန္မာမာ', 'ျမန္မြန်မာ,ျမန္မာမာ']`, as an array of one line already did. Pass the line alone: `lines.map((line) => knayi.syllBreak(line))` (README, "syllBreak").
  - **`spellingFix` collapses the Unicode marks for every name but `zawgyi` and `zaw`**, as it already did for `'win'` and most unknown names. Names of `Object.prototype` members broke it: `spellingFix('ကာ', 'constructor')` threw a `TypeError`, and `spellingFix('ကာာ', 'toString')` returned `'ကာာ'`; it now returns `'ကာ'`.
  - **`fontConvert` warns about an unknown source font,** unless silent, and still detects the source: `fontConvert('ျမန္မာ', 'unicode', 'zg')` returns `'မြန်မာ'` and warns `Unknown source font "zg" on knayi.fontConvert; detecting it.` The error for an unknown target font now reads "Convert library doesn't have this fontType." (it said "dosen't").
- **Font names are case-insensitive** (README, "Font names"): `'Unicode'`, `'ZAWGYI'`, `'Zaw'` and `'WIN'` name the same fonts as `'unicode'`, `'zawgyi'`, `'zaw'` and `'win'` wherever knayi reads a font name: the target and source of `fontConvert` and `fontConvert.debugging`, and the font of `syllBreak`, `spellingFix` and `truncate`. `fontDetect` still returns its fallback as given. No corpus line changes: the output comparison finds 0 differences in 2,771,978 comparisons (every call form on every corpus, mC4 included, and on the generated and fuzz sets), since its call forms name fonts in lower case. In the API contract matrix, 66 of 3,703 cells change, all with `'Unicode'` or `'ZAWGYI'`: 18 stop throwing, 24 return other text, and 24 only lose a console message.
  - **`syllBreak` and `truncate` break text for these names**, where they threw the `TypeError` with the code `ERR_KNAYI_INVALID_FONT`: `syllBreak('မြန်မာ', 'Unicode', '|')` returns `'မြန်|မာ'`. `'WIN'` throws, as `'win'` does.
  - **`fontConvert` converts to and from these names**, without the error or the warning it gave. `fontConvert('ျမန္မာ', 'Unicode', 'ZAWGYI')` returned the text unchanged, with the error "Convert library doesn't have this fontType.", and now returns `'မြန်မာ'`. A source such as `'Unicode'` was detected, with a warning, and is now read as named: `fontConvert('ျမန္မာ', 'unicode', 'Unicode')` returned `'မြန်မာ'` (detected as Zawgyi) and now returns the text unchanged. `fontConvert('jrefrm', 'unicode', 'WIN')` returned `'jrefrm'` and now converts it from Win to `'မြန်မာ'`.
  - **`spellingFix` collapses the Zawgyi marks for `'ZAWGYI'` and `'Zaw'`:** `spellingFix('ကဳဳ', 'ZAWGYI')` returned `'ကဳဳ'` and now returns `'ကဳ'`.
- **`fontDetect` ignores a fallback that is not a string** (README, "fontDetect"), as it already ignored `undefined`, `null`, `''`, `0`, `false` and `NaN`. It returned any other value as its result wherever it returns the fallback: for missing content, for text with no Myanmar letters, and on a tie. So `lines.map(knayi.fontDetect)`, which passes each line's index as the fallback, gave numbers: `['မြန်မာ', 'ဗုဒ္ဓ', 'abc'].map(knayi.fontDetect)` returned `['unicode', 1, 2]` and now returns `['unicode', 'zawgyi', 'en']`. A `String` object counts as its string: `fontDetect('abc', new String('unicode'))` returned the object and now returns `'unicode'`. A string fallback is returned as given, as before. No corpus line changes: the output comparison finds 0 differences in 2,771,978 comparisons (every call form on every corpus, mC4 included, and on the generated and fuzz sets), since its call forms pass no fallback or `'unicode'`. In the API contract matrix, 49 of 3,703 cells change, each to `'en'` or `'zawgyi'` where it returned a number or an array: 16 calls `fontDetect(x, 1)`, 16 calls `fontDetect(x, ['unicode'])` and 17 calls `lines.map(fontDetect)`.
- **`fontDetect` and `setGlobalOptions` take `null` options, and check the detector options** (README, "fontDetect"). No corpus line changes: the output comparison finds 0 differences in 2,772,198 comparisons (every call form on every corpus, mC4 included, and on the generated and fuzz sets), since its call forms pass no options. In the API contract matrix, 40 of 3,703 cells change: 7 stop throwing, 12 gain a warning or an error, 14 print the reworded threshold error, and 7 lose it in silent mode.
  - **`null` options are no options**, as `undefined` already was. `fontDetect('ျမန္မာ', null, null)` threw a `TypeError` for text with a Myanmar letter and now returns `'zawgyi'`, with the stored detector settings; `setGlobalOptions(null)` threw a `TypeError` and now changes nothing.
  - **A threshold pair must be two finite numbers in order,** `[low, high]`; the two may be equal. `[NaN, NaN]`, a pair with an infinity, and a pair with the higher number first were accepted, so that, for example, `[NaN, NaN]` made every myanmar-tools call return the fallback. Now they are refused like a value that is not a pair: the call uses the stored pair, and `setGlobalOptions` keeps it.
  - **The threshold error honours silent mode, and starts with a code.** It was the one message that `silent_mode` did not hide. It read `myanmartools_zg_threshold must be [number, number]`, and now reads `[ERR_KNAYI_INVALID_THRESHOLD] myanmartools_zg_threshold must be two finite numbers in order.` The code is API; the words after it may change.
  - **An unknown `adapter` name warns,** unless silent, and the call still uses the adapter `use_myanmartools` picks: `fontDetect('ျမန္မာ', null, { adapter: 'tools' })` returns `'zawgyi'` and warns `Unknown adapter "tools" on knayi.fontDetect.` The adapter is read like a font name, so a value that is not a string, or `''`, names no adapter and does not warn, and a `String` object counts as its string: `{ adapter: new String('myanmartools') }` now selects myanmar-tools, where it was ignored.

### Security

- **NFC takes linear time on long runs of combining marks.** `normalize` starts and ends with NFC, and conversion to Unicode from Zawgyi and Win ends with it. `String.prototype.normalize('NFC')` puts each run of combining marks in canonical order with an insertion sort, in quadratic time in Node and in Bun: `'က'` followed by 32,000 pairs of dot below and virama (U+1037 U+1039) took about 1 s in `normalize`, and 64,000 pairs about 4 s, and so did the same shape in Zawgyi and Win conversion and the marks of any other script. knayi now puts every run of more than 30 marks in canonical order itself, in linear time, before it calls `String.prototype.normalize` (`library/nfc.js`): those inputs take 5 and 8 ms, and a million characters about 70 ms. This fixes the case the 2.10.0 notes below list as known. Output is unchanged: the result is exactly what `String.prototype.normalize('NFC')` returns, and the output comparison found 0 differences in 2,771,318 comparisons (every call form on every corpus, mC4 included, and on the generated and fuzz sets), with no change in the API contract matrix.

### Changed

- **`fontDetect` and Unicode → Zawgyi conversion are faster in Node and other V8 runtimes:** about 35% less time per line, and about half the time on one long string. Calls that detect the font gain part of that: `fontConvert` with no source font 11% per line, and `syllBreak` and `truncate` with no font 16%. V8 searches slowly for a regex that is a plain literal starting with a character from U+1000 to U+1010; the eight such patterns now put that character in a class of one. Output is unchanged, `fontConvert.debugging` included: the output comparison found 0 differences in 2,772,858 comparisons (every call form on every corpus, mC4 included, and on the generated and fuzz sets), with no change in the API contract matrix. Under Bun, `fontDetect` takes up to about 15% longer.
- **`spellingFix` and Unicode → Zawgyi conversion are faster:** under Node, `spellingFix` takes about half the time per line with the Unicode marks and a seventh with the Zawgyi marks (a third and a tenth per word, three quarters and a quarter on one long string), and Unicode → Zawgyi conversion about 8% less per line and 12% less per word; Bun gains about as much. `spellingFix`, and the conversion before its rules, collapsed repeated marks with one regex per mark (17 for Unicode, 67 for Zawgyi), and now use one regex per font. The eight Unicode → Zawgyi rules that were applied again while they matched now take one replace, which never leaves a match. Output is unchanged, `fontConvert.debugging` included: the output comparison found 0 differences in 2,772,858 comparisons (every call form on every corpus, mC4 included, and on the generated and fuzz sets), with no change in the API contract matrix.
- **Zawgyi → Unicode and Win → Unicode conversion are faster:** under Node, about 10% less time from Zawgyi and 13% less from Win per line, and 17% and 22% less for `fontConvert.debugging`; under Bun, about 5% and 7% less per line. The font reader looked up each character's glyph in a `Map`, and now reads it from an array indexed by character code. Output is unchanged, `fontConvert.debugging` included: the output comparison found 0 differences in 2,772,858 comparisons (every call form on every corpus, mC4 included, and on the generated and fuzz sets), with no change in the API contract matrix.
- **`normalize` is much faster on text with no Myanmar character, and `syllBreak` with the default breakpoint is faster:** on English text, `normalize` takes about a twelfth of the time per line under Node and a twenty-fourth under Bun, and a fiftieth on one long string, since such text needs only NFC: its other steps give it back as it is. A character of Myanmar Extended-A or Extended-B (U+AA60–U+AA7F, U+A9E0–U+A9FF) counts as Myanmar here. `syllBreak` with the default breakpoint, U+200B, returns the text its rules mark with U+200B, where it split the text into syllables and joined them again with U+200B: under Node, about 22% less time per line with the Unicode rules, 17% with the Zawgyi rules and 14% when it detects the font, and 11 to 22% less under Bun. Output is unchanged: the output comparison found 0 differences in 2,772,858 comparisons (every call form on every corpus, mC4 included, and on the generated and fuzz sets), with no change in the API contract matrix.
- **`normalize`, and Zawgyi → Unicode and Win → Unicode conversion, are faster:** under Node, `normalize` takes about 23% less time per line and on one long string and 18% less per word, and conversion from Zawgyi and Win about 12% less per line and 8% less per word; under Bun, about 18% and 15% less per line. The syllable sort they share searched a syllable's marks once for each mark it asks about, and now tells which marks the syllable has from one number, with a bit for each. Output is unchanged, `fontConvert.debugging` included: the output comparison found 0 differences in 2,772,858 comparisons (every call form on every corpus, mC4 included, and on the generated and fuzz sets), with no change in the API contract matrix.
- Contributor documentation: `ARCHITECTURE.md`, a rewritten `CONTRIBUTING.md`, `SECURITY.md`, this changelog and a pull request template.
- Development: `npm test` no longer rewrites `dist/`; it tests a build made in a temporary directory. CI also runs the output comparison, the API contract matrix, table, README, fuzz, property and adapter tests, the browser floor checks and a Playwright run, ReDoS, type, size and `dist/` checks, growth exponents, and a smoke run on Node 16, 18 and 20.
- README: `normalize` returns text with no Myanmar letters in NFC, and a Win source is converted even though it has no Myanmar letters; name the source font for short text, because a detection tie reads it as Zawgyi; `normalize` can change converted text where an ေ or medial ra has no consonant after it.

### Fixed

- **In browsers without `globalThis`, `fontDetect` with the myanmar-tools adapter gives the right warning** (Chrome before 71, Firefox before 65, Safari before 12.1 and Edge before 79, all inside the README's browser floor). It used the rule scorer there, as in every browser, but warned `myanmar-tools could not be loaded (globalThis is not defined); fontDetect used the rule scorer. Install myanmar-tools@1.1.3.`, because the browser builds read `globalThis` with no check. It now warns `myanmar-tools is not available in this environment; fontDetect used the rule scorer.`, as newer browsers do, and the builds read `globalThis` only behind a `typeof` check. Return values do not change, and nothing changes in Node, Bun or a browser that has `globalThis`: the output comparison found 0 differences in 2,772,858 comparisons (every call form on every corpus, mC4 included, and on the generated and fuzz sets), with no change in the API contract matrix.

## 2.10.0

Not yet tagged or published to npm. Pull requests #68 to #74.

2.10.0 rewrites Zawgyi → Unicode conversion and `normalize` around Unicode storage order ([UTN #11](https://www.unicode.org/notes/tn11/)), and adds Win → Unicode conversion. `fontDetect`, `syllBreak`, `spellingFix` and `truncate` give the same output as 2.9.1 on every eval corpus (FLORES-200, Wikipedia, Okell, mC4, WaitZar, and GlotCC Shan, Mon, S'gaw Karen and Pa'o).

### Output changes

- **Zawgyi → Unicode is rewritten** (#69). Each Zawgyi glyph becomes Unicode characters with its role in the syllable, and each syllable is written in storage order. Of the 10,166 mC4 lines `fontDetect` calls Zawgyi, 5,263 convert differently from 2.9.1: 4,081 only in NFC order, and 1,182 beyond it. Almost every difference beyond NFC is a 2.9 bug:
  - `ေစ်း` is `ဈေး` (2.9.1: `စျေး`);
  - `ႏို္င္ငံ` is `နိုင်ငံ` (2.9.1: `နို်င်ငံ`);
  - `၄င္း` is `၎င်း` (2.9.1: `၄င်း`);
  - `ပဥၥ` is `ပဉ္စ` (2.9.1: `ပဥ္စ`);
  - an asat with a medial and no vowel follows UTN #11: `ခ်္` is `ခ်ျ` (2.9.1: `ချ်`);
  - the ligature U+106F is `ဍ္ဎ` (2.9.1: `ဎ္ဍ`), in both directions.

  `research/zawgyi-to-unicode.md` has the counts behind each rule.
- **The output of conversion to Unicode, and of `normalize`, is NFC** (#69, #71). 2.9 could store an asat before a dot below.
- **Zero-width spaces and non-joiners are kept** (#69, #71, #72). `fontConvert` keeps them in every direction, same-font calls included, and so does `normalize`; 2.9.1 removed them. One typed inside a syllable moves to the end of the syllable. A zero-width character at the start or end of the text also keeps the space next to it from being trimmed.
- **Conversion applies `normalize`'s typing fixes** (#71): ဝ or ရ typed in a number is a digit, ိ with ီ is ီ, and the other fixes the README lists, so `normalize` leaves converted text unchanged in almost every case. This changed 226 of 9,987 mC4 Zawgyi lines, measured in #71.
- **`fontConvert.debugging` from Zawgyi** names the stages that changed the text in `matched_patterns` (`sequences`, `glyphs`, `syllables`, `zero as wa`, `look-alikes`, `typos`, `NFC`), as it does for Win, instead of regex sources (#69, #71).
- **Unicode → Zawgyi picks the medial ra shape from the ra's own consonant** (#70): `ဆန္ဒပြသူ` is `ဆႏၵျပသူ` (2.9.1: `ဆႏၵႂပသူ`), and `သြဂုတ်` is `ၾသဂုတ္` (2.9.1: `ႂသဂုတ္`). In #70, every changed line converted back to the same Unicode. Against 2.9.1, Unicode → Zawgyi output changes on 62 of 2,009 FLORES-200 lines, 275 of 4,812 Wikipedia lines and 1,720 of 16,924 Okell lines. Of those 2,057, 1,110 only keep zero-width characters, 857 change a medial ra, 89 keep whitespace next to a zero-width character at the start or end of the line, and 1 reads U+106F the new way.
- **`normalize` is rewritten** (#71). It puts Unicode text in storage order with the same rules as conversion, and fixes typing mistakes only in clear cases. A second pass changes no line of the Unicode corpora (FLORES-200, Wikipedia, Okell and the four GlotCC languages); it can change garbled input, such as 104 of the 14,304 mC4 lines, which are mostly Zawgyi. On 23,745 lines of human-typed Unicode (FLORES-200, Wikipedia, Okell), 2.9.1 changed 13,664 (57.5%), mostly wrongly; 2.10.0 changes 2,182 (9.2%).
  - `ဝ` stays `ဝ` (2.9.1: `၀`), and `လုံးဝ` stays `လုံးဝ` (2.9.1: `လုံး၀`).
  - `ယောကျ်ား` is `ယောက်ျား` (2.9.1: `ယောကျာ်း`).
  - ေ typed before its consonant moves after it: `လည်းေကာင်း` is `လည်းကောင်း` (2.9.1: `လညေ်းကာင်း`).

  `research/normalize.md` has the evidence for each rule. If you store normalized text as a key, normalize the stored text again after upgrading.
- **Zero and seven next to Shan, Mon and Karen marks** (#73). `normalize`'s look-alike fixes know the marks and consonants of every language in the Myanmar blocks: `၀ႆ` is `ဝႆ` (2.9.1 and 2.10.0 before #73: `၀ႆ`). A tone mark alone does not count, since S'gaw Karen text types a tone after numbers as a comma. Against 2.10.0 before #73, `normalize` changes 15 of 673 GlotCC S'gaw Karen lines and 10 of the 14,304 mC4 lines (normalize on the raw lines, which are mostly Zawgyi), and no Burmese, Shan, Mon or Pa'o line. Zawgyi → Unicode changes on no corpus line, but on generated input it now reads a ၇ before a Mon, Shan or Karen mark that Zawgyi has no glyph for (such as U+1056) as ရ.

### Security

- **`normalize` is linear again on runs of ေ and medial ra** (#74). Before this fix, 2.10's `normalize` took quadratic time on a consonant followed by a long run of ေ or medial ra: `'က'` followed by 20,000 of either took from a few hundred milliseconds to over a second, against about a millisecond in 2.9.1, and a million characters could take close to a minute. A short input could stall a server that normalizes untrusted text. Output is unchanged: 0 differences in 5,079,191 comparisons, measured in #74, and none on the eval corpora.
- **Known, not fixed yet: a long run of dot below with virama or asat is still quadratic.** `normalize` and conversion to Unicode end with `String.prototype.normalize('NFC')`, and the runtime's NFC reorders a long run of combining marks of different classes in quadratic time. `'က'` followed by 32,000 pairs of dot below and virama (U+1037 U+1039) takes about 1 s in `normalize` on Node 26, and 64,000 pairs about 4 s; Zawgyi and Win conversion to Unicode behave the same. 2.9.1 did not apply NFC and takes a few milliseconds. Until knayi puts such runs in order before NFC, limit the length of untrusted input. `test/growth.timing.js` tracks the case.

### Added

- **Win → Unicode** (#68): `fontConvert(text, 'unicode', 'win')` converts text typed in the Win Innwa family of legacy fonts (Win Innwa, Win Researcher, Win Kalaw and the rest). It converts in one direction only, and the source must be named, since Win text is ASCII and `fontDetect` never returns `'win'`. `research/win-fonts.md` has the background.

### Changed

- **Every `dist/` file is ES2015** (#72). The browser builds run in Chrome 49, Edge 14, Firefox 34, Safari 10 (iOS 10), Samsung Internet 5 and Opera 36, or newer. 2.9.x's `min.js` needed ES2020.
- **The browser build is larger,** for the glyph tables: `dist/knayi-myscript.min.js` is 29,125 bytes (9,879 gzipped at level 9, as `npm run check:size` measures), up from 19,105 (6,126) in 2.9.1.

## Earlier versions

Release notes for earlier versions are on GitHub, where they exist.

- 2.9.1: [release notes](https://github.com/greenlikeorange/knayi-myscript/releases/tag/v2.9.1)
- 2.9.0: no tag. It was deprecated on npm soon after it was published, and 2.9.1 replaces it; see the 2.9.1 release notes.
- 2.8.3: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.8.3)
- 2.8.2: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.8.2)
- 2.8.1: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.8.1)
- 2.8.0: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.8.0)
- 2.7.3: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.7.3)
- 2.7.2: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.7.2)
- 2.7.1: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.7.1)
- 2.7.0: [release notes](https://github.com/greenlikeorange/knayi-myscript/releases/tag/v2.7.0)
- 2.7.0-0: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.7.0-0)
- 2.6.0: [release notes](https://github.com/greenlikeorange/knayi-myscript/releases/tag/v2.6.0)
- 2.5.9: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.5.9)
- 2.5.8: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.5.8)
- 2.5.7: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.5.7)
- 2.5.6: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.5.6)
- 2.5.5: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.5.5)
- 2.5.4: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.5.4)
- 2.5.3: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.5.3)
- 2.5.2: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.5.2)
- 2.5.1: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.5.1)
- 2.5.0: [release notes](https://github.com/greenlikeorange/knayi-myscript/releases/tag/v2.5.0)
- 2.4.2: [release notes](https://github.com/greenlikeorange/knayi-myscript/releases/tag/v2.4.2)
- 2.4.1: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.4.1)
- 2.4.0: [release notes](https://github.com/greenlikeorange/knayi-myscript/releases/tag/v2.4.0)
- 2.3.1: [release notes](https://github.com/greenlikeorange/knayi-myscript/releases/tag/v2.3.1)
- 2.3.0: [release notes](https://github.com/greenlikeorange/knayi-myscript/releases/tag/v2.3.0)
- 2.2.0: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.2.0)
- 2.1.2: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.1.2)
- 2.1.1: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.1.1)
- 2.1.0: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.1.0)
- 2.0.6: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.0.6)
- 2.0.5: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.0.5)
- 2.0.4: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.0.4)
- 2.0.3: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.0.3)
- 2.0.2: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.0.2)
- 2.0.1: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.0.1)
- 2.0.0: [tag](https://github.com/greenlikeorange/knayi-myscript/tree/v2.0.0)
