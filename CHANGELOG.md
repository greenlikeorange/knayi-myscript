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

None.

## 3.0.0-next.0

2026-10-04. The first prerelease of 3.0, for npm's `next` tag; not yet published.

3.0, built on the `next` branch: ES modules with an exports map, one stateless API with options per call and coded errors, and the 2.x API as `knayi-myscript/compat`. README's "Upgrading from 2.x" says what to change.

### Breaking changes

- **ES modules only, for Node.js 22.12 or newer** (`engines`), Bun and browsers. From Node 22.12 on, `require` loads ES modules, so CommonJS code keeps `require`. Node 16 to 22.11 stay on 2.x.
- **An exports map with one entry per API.** `knayi-myscript` is the 3.0 API, `knayi-myscript/compat` the 2.x API and `knayi-myscript/stream` the streams. No other path loads: `knayi-myscript/library/converter`, `main.js` and the `dist/` paths are gone, and so is the `module` field.
- **The 2.x API moved to `knayi-myscript/compat`**, with 2.x's output on every input. `import knayi from 'knayi-myscript'` no longer compiles or loads, since the 3.0 API has no default export: import from `knayi-myscript/compat`, or `require('knayi-myscript/compat').default`.
- **Types:** the package's types are the 3.0 API's (`src/index.d.ts`); 2.x's `index.d.ts` is `src/compat/index.d.ts`, the types of `knayi-myscript/compat`. TypeScript finds the subpaths under `moduleResolution` `node16`, `nodenext` or `bundler`, not `node` (node10), and CommonJS code in TypeScript can `require` the package under `module` `node20` or `nodenext` only.
- **Browser builds:** `dist/knayi-myscript.min.js` sets `knayi` to the 3.0 API, with the 2.x API as `knayi.compat`; a page written for 2.x sets `knayi = knayi.compat` after the tag. The module builds are `dist/knayi-myscript.min.mjs` (the 3.0 API) and `dist/knayi-myscript-compat.min.mjs` (the 2.x API); `knayi-myscript.js`, `knayi-myscript.mjs` and `knayi-myscript.es.js` are gone. All three are minified and strict.
- **The browser floor rises** to the first versions with all of ES2015 (decision 18): Chrome 51, Edge 15, Firefox 54, Safari 10.1 (iOS 10.3), Samsung Internet 5 and Opera 38, where 2.x ran in Chrome 49, Edge 14, Firefox 34 and Safari 10.
- `parseUnicode` and `serializeUnicode`, which only 2.x's tests used through `library/syllable.js`, are gone.

### Output changes

- **`knayi-myscript/compat`: none.** It gives 2.10.0's output (commit e5f6e24) on every call form and input: 0 differences in `npm run compare`, and every cell of the contract matrix, under Node and Bun. It differs from 2.x's `main.js` where 2.x's own ES module build did: a detached `fontConvert` call never reads a global `debug`, and myanmar-tools is looked up from the working directory.
- **The 3.0 `normalize` settles** (`OUTPUT_VERSION` 2): it is idempotent, and reads u, zero and seven right after a virama or under a kinzi as nya, wa and ra. It gives 2.x's `normalize` output on every line of the Unicode corpora; on raw mC4, mostly Zawgyi, 199 of 14,304 lines differ. docs/next/DESIGN.md §11.2 has the evidence.

### Added

- **The 3.0 API** (`knayi-myscript`): `normalize` with a change report, `isNormalized`, `explain`, `detectEncoding` with an injected myanmar-tools detector, `toUnicode` that converts and detects each line on its own and maps output offsets back to the input, `toZawgyi`, lossless `segmentSyllables` and `syllableBoundaries`, a `truncate` that always returns a prefix, `collapseRepeatedMarks`, `createTrace`, `VERSION` and `OUTPUT_VERSION`. Options are per call and in camelCase, and a wrong argument throws a `TypeError` or `RangeError` with a `code`.
- **Streams** (`knayi-myscript/stream`): `createNormalizer` and `createConverter`, TransformStreams of `normalize` and `toUnicode` that take strings or UTF-8 bytes in chunks and give what the function gives for the whole text; `lineTransform` for any function of a line; and `mapLines`, the line cutter under them, for a loop or a Node `Transform`. A line longer than `maxLineLength` is an error with the code `ERR_KNAYI_LINE_TOO_LONG`; a runtime with no `TransformStream`, or bytes with no `TextDecoder`, throws `ERR_KNAYI_UNSUPPORTED_RUNTIME`.
- **The `knayi` command** (`bin/knayi.js`): `normalize`, `to-unicode`, `to-zawgyi`, `convert`, `detect`, `segment` and `check` over files or standard input, as plain text or JSON Lines, holding one line at a time. It loads myanmar-tools only for `--detector myanmar-tools`, and only from where knayi-myscript is installed. README's "Command line" is its manual.

### Security

- The 3.0 `explain` found the end of a line that reads as Zawgyi with a regex that took quadratic time on a long run of white space inside the line (40,000 tabs: 1 s); it takes linear time before any release ships it.

### Changed

- Size budgets for 3.0, proposed for the maintainer to confirm (docs/next/DESIGN.md §6.4): `dist/knayi-myscript.min.js` 25,000 B gzip (23,951 B today), the 3.0 module build 22,000 B, the compat module build 18,300 B, and an import of the whole 3.0 API 22,200 B, of compat 18,600 B, of `normalize` alone 9,700 B, of the streams 16,900 B and of `createNormalizer` alone 10,900 B. 2.10's `min.js` was 9,830 B.

- Contributor documentation: `ARCHITECTURE.md`, a rewritten `CONTRIBUTING.md`, `SECURITY.md`, this changelog and a pull request template.
- Development: `npm test` no longer rewrites `dist/`; it tests a build made in a temporary directory. CI also runs the output comparison, the API contract matrix, table, README, fuzz, property and adapter tests, the browser floor checks and a Playwright run, ReDoS, type, size and `dist/` checks, growth exponents, and a smoke run on Node 16, 18 and 20.
- README: `normalize` returns text with no Myanmar letters in NFC, and a Win source is converted even though it has no Myanmar letters; name the source font for short text, because a detection tie reads it as Zawgyi; `normalize` can change converted text where an ေ or medial ra has no consonant after it.

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
