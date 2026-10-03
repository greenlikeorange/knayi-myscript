# Architecture

How knayi-myscript is built today: version 2.10.0, including the Shan look-alike fix (#73) and the fix for `normalize`'s quadratic time on runs of e and medial ra (#74). This is a map of the current code, not a target design. A pull request that changes something described here updates this file in the same PR.

- [Entry points and builds](#entry-points-and-builds)
- [Module map](#module-map)
- [What each call does](#what-each-call-does)
- [The syllable engine](#the-syllable-engine-librarystorageorderjs)
- [Typing fixes and their two orders](#typing-fixes-and-their-two-orders)
- [Detection, breaks and the Unicode to Zawgyi rules](#detection-breaks-and-the-unicode-to-zawgyi-rules)
- [Glossary](#glossary)
- [Stable surfaces](#stable-surfaces)
- [Quirks kept on purpose](#quirks-kept-on-purpose)
- [Where the rules are justified](#where-the-rules-are-justified)
- [The 3.0 core on next](#the-30-core-on-next)
- [Running the checks](#running-the-checks)

## Entry points and builds

`main.js` is the package entry. It exports eight names: `version`, `setGlobalOptions`, `fontDetect`, `fontConvert`, `syllBreak`, `spellingFix`, `truncate` and `normalize`. It also sets a non-enumerable `default` that points back at the exports, for TypeScript without `esModuleInterop`. The export object is written with shorthand properties only, because Node finds the named exports for `import { … }` by scanning that object literal.

`index.d.ts` holds the types. `typecheck/` compiles three small consumers against it, with and without `esModuleInterop`.

`scripts/build.js` bundles `main.js` with esbuild, `target: 'es2015'`:

| File | Format | Notes |
| --- | --- | --- |
| `dist/knayi-myscript.mjs` | ESM | One named export per key of `require('./main.js')`, plus the default export. |
| `dist/knayi-myscript.es.js` | ESM | A byte copy of the `.mjs` file. `package.json` `module` points here. |
| `dist/knayi-myscript.js` | IIFE | Sets the global `knayi`, also when a bundler imports the file. |
| `dist/knayi-myscript.min.js` | IIFE, minified | The file the README, unpkg and jsDelivr serve. |

The committed `dist/` is the build of the last release, or of the release being prepared: jsDelivr serves `main`'s `dist/` to `@master` links, so it changes only in a release commit (`scripts/check-dist.js`). 2.10.0 is not tagged or published yet, and its `dist/` was rebuilt by #70 to #74 after the commit that set the version (7619008); its tag goes on the commit that holds the final build. Everything else builds into a temporary directory: `builtDist()` in `scripts/build.js` builds once per process and removes the directory on exit, or returns `KNAYI_DIST` when that is set.

`main.js` and `dist/knayi-myscript.es.js` are two copies of the library with their own module state. Silent mode and detector options set on one are not seen by the other (README, "Runtime").

The npm package ships `main.js`, `index.d.ts`, all of `library/` and the four `dist/` files (`package.json` `files`). There is no `exports` map, so every `library/*.js` file can be required by path. The README promises one deep path: `knayi-myscript/library/converter`.

## Module map

All library code is CommonJS in `library/`.

| Module | Exports | What it holds |
| --- | --- | --- |
| `converter.js` | `fontConvert`, `fontConvert.debugging` | Input checks and font routing for conversion. Reads the debug flag from `this`; `debugging` calls `fontConvert.apply({debug: true}, …)`. |
| `detector.js` | `fontDetect` | 29 signature patterns (12 Unicode, 17 Zawgyi) compiled to global regexes at load; the rule scorer; the optional myanmar-tools adapter and its lazy loader. |
| `normalization.js` | `normalize` | Input checks, then NFC, `arrangeUnicode`, typos, look-alikes, NFC. |
| `syllBreak.js` | `syllBreak` | Input checks, font choice, then `breakParts` and `joinParts`. |
| `spellingCheck.js` | `spellingFix` | Input checks, font choice, then `collapseMarks`. The file name differs from the export name. |
| `truncate.js` | `truncate` | Input checks, font choice, `breakParts`, then a fit loop over the parts. |
| `contentGate.js` | `isMissing`, `toText`, `hasMyanmar`, `resolveFont`, `cleanText` | Shared input helpers and the font-name aliases (`uni`, `zaw`). |
| `globalOptions.js` | `isSilentMode`, `setOptions`, `detector` | The module-level option store and the detector-option merge. |
| `storageOrder.js` | `ROLES`, `font`, `toUnicode`, `arrangeUnicode` | The syllable engine: the shared syllable sort `order`, the font reader `arrange`, the Unicode reader `arrangeUnicode`, the font compiler `font` and the font pipeline `toUnicode`. |
| `typingFixes.js` | `lookAlikes`, `typos` | Zero and seven read as wa and ra (and back), and four typo rules. |
| `zawgyi.js` | `toUnicode` | The Zawgyi glyph table and its two lagaung sequences. |
| `win.js` | `toUnicode`, `tables` | The Win Innwa glyph table, its look-alike sequences and the Windows-1252 to C1 aliases. `tables` is `{ WIN, SEQUENCES, ROLES }`, read by `scripts/eval/win-glyphs.mjs`. |
| `syllable.js` | `parseUnicode`, `serializeUnicode`, `collapseMarks`, `breakParts`, `joinParts`, `convertText` | Four jobs in one file: the Unicode to Zawgyi rules, the mark-collapse rules, the syllable-break rules, and a Unicode syllable parser that only the tests use (`parseUnicode`, `serializeUnicode`). |

### Dependency graph

```
main.js
├── globalOptions.js
├── detector.js ─────────── globalOptions.js, contentGate.js
├── converter.js ────────── detector.js, globalOptions.js, contentGate.js, syllable.js, win.js, zawgyi.js
├── syllBreak.js ────────── detector.js, globalOptions.js, contentGate.js, syllable.js
├── spellingCheck.js ────── detector.js, globalOptions.js, contentGate.js, syllable.js
├── truncate.js ─────────── detector.js, globalOptions.js, contentGate.js, syllable.js
└── normalization.js ────── globalOptions.js, contentGate.js, storageOrder.js, typingFixes.js

zawgyi.js, win.js ───────── storageOrder.js ───── typingFixes.js
leaves: globalOptions.js, contentGate.js, syllable.js, typingFixes.js
```

Two edges point the unexpected way. The font data modules (`zawgyi.js`, `win.js`) require the engine and call its pipeline, instead of the engine reading the tables. And the engine (`storageOrder.js`) requires `typingFixes.js`, because `toUnicode` runs the whole font pipeline, typing fixes included.

`test/unit/layers.test.js` puts every file in a layer (core, fonts, engine, rules, public, entry) and fails on a new `require` that points up a layer. These edges are its only known exceptions, and the list may only shrink.

### Module state

- `globalOptions.js`: the option store (`silent_mode`, `detector`).
- `detector.js`: the loaded myanmar-tools detector, the load error, and a flag so the "not installed" warning is printed once.
- `storageOrder.js`: a scratch array for the rank sort in `order`, which never runs inside itself.
- The rule regexes in `syllable.js` have the `g` flag and are shared between calls, so the code resets `lastIndex` before each use.

Console output: missing content warns (`console.warn`), conversion errors use `console.error`, and both are silenced by `silent_mode`. One message ignores silent mode: the threshold error in `globalOptions.detector`.

## What each call does

Every public function starts the same way, with small differences. `toText` unwraps `String` objects. `isMissing` treats `null`, `undefined`, `''`, `0`, `false` and `NaN` as missing: the function warns (unless silent) and returns `''`, or the fallback or `'en'` for `fontDetect`. `truncate` does not count `''` as missing. Other non-strings are returned unchanged; `fontDetect` returns the fallback or `'en'` for them, and `truncate` turns them into strings. `hasMyanmar` tests for a character in U+1000–U+109F.

### fontConvert(content, to, from)

1. Missing content: `''`. A non-string: returned. No Myanmar character and a source other than `win`: returned unchanged. No target: an error, and the text is returned.
2. The text is trimmed. `to` and `from` go through the aliases. An unknown target is an error. An unknown or missing source is detected with `fontDetect(content)`, whose tie result is `'zawgyi'`.
3. Same source and target: the trimmed text.
4. A Win target, or a Win source with a target other than Unicode: an error, and the text is returned.
5. Zawgyi or Win to Unicode: `zawgyi.toUnicode` or `win.toUnicode`, which both call `storageOrder.toUnicode` with their compiled font.
6. Unicode to Zawgyi: `syllable.collapseMarks(content, 'unicode')`, then `syllable.convertText`.

### The font pipeline: storageOrder.toUnicode(content, font, debug)

| Stage name | What it does |
| --- | --- |
| `sequences` | The font's look-alike sequences, as regex replacements. Zawgyi: two lagaung rules. Win: `aMomf`, `Mo`, `ps`, `OD`. |
| `glyphs` | Debug only: each glyph's Unicode text, still in typed order. |
| `syllables` | `arrange`: the font reader. |
| `zero as wa` | `zeroAsWa`: a zero that is not part of a number becomes wa. |
| `look-alikes` | `typingFixes.lookAlikes`. |
| `typos` | `typingFixes.typos`. |
| `NFC` | `String.prototype.normalize('NFC')`. |

With `debug`, `toUnicode` returns `{ matched_patterns, steps }`: `matched_patterns` names each stage that changed the text, in order, and `steps` holds the input followed by the text after each of those stages. `converter.js` adds `to` and `from`. The README documents these stage names.

### normalize(content)

After the input checks there is no Myanmar test. Every string goes through:

```
NFC → arrangeUnicode → typos → lookAlikes → NFC
```

So text with no Myanmar characters still comes back in NFC. The first NFC is there because it can move a dot below in front of an asat or virama, which changes what they attach to.

### fontDetect(content, fallback, options)

1. Missing content, or no Myanmar character: the fallback, or `'en'`.
2. `cleanText(content, true)`: trim, and remove U+200B and U+200C.
3. The fallback defaults to `'zawgyi'`.
4. `globalOptions.detector(options)` merges the call's options with the stored ones. An explicit `adapter` (`'rules'` or `'myanmartools'`) wins; otherwise `use_myanmartools` picks myanmar-tools.
5. **Rules:** each side's score is the total number of matches of its signature patterns (`String#match` with the `g` flag). The higher score wins; a tie returns the fallback.
6. **myanmar-tools:** loaded on first use through `nodeRequire`, which only works in Node: `module.require`, or `process.getBuiltinModule('module').createRequire(...)` from `__filename` or, where that is missing, from the working directory's `package.json`. A probability below the first threshold is `'unicode'`, above the second `'zawgyi'`, and in between the fallback. If the package cannot be loaded, the call uses the rules and warns once.

`fontDetect` never returns `'win'`.

### syllBreak, spellingFix and truncate

All three resolve the font the same way: no font name means `fontDetect(content)`; otherwise `resolveFont(name) || name`, so an unknown name is passed on as it is.

- **syllBreak:** no Myanmar character returns the text unchanged. Otherwise `cleanText(content, true)`, then `breakParts(content, font)` and `joinParts(parts, breakpoint)`. `breakParts` applies `BREAK_RULES[font]` (7 rules for Unicode, 8 for Zawgyi), which insert and remove U+200B (the first Unicode rule instead puts a dot below in front of an asat typed before it), drops a leading U+200B, and splits on U+200B and U+200C. `joinParts` joins with the breakpoint, U+200B by default.
- **spellingFix:** detects the font on the raw text, then cleans it and runs `collapseMarks(content, font)`: one `[mark]{2,}` regex per mark of `COLLAPSE[font]`, or of `COLLAPSE.unicode` when the font has no entry.
- **truncate:** `length` defaults to 30 and `omission` to `'...'`, and the budget is `length - omission.length`. Text with no Myanmar character is cut with `substr`. Otherwise the text is broken with `breakParts` and parts are added while they fit; a part that does not fit is split on whitespace and the words that fit are added. The result is trimmed and the omission appended.

## The syllable engine: library/storageOrder.js

Zawgyi and Win store text in drawing order, and Unicode in storage order (see the [glossary](#glossary)). The engine reads text one syllable at a time and writes each syllable in the storage order of Unicode Technical Note #11. It has three parts: a sort for one syllable (`order`), and two readers that cut text into syllables and call it, `arrange` for the fonts and `arrangeUnicode` for `normalize`.

### order(syllable)

A syllable is a record `{ kinzi, base, stack, marks, after, kept, keepU }`. `marks` holds the marks in typed order, starting with any e or medial ra that waited for this base. `order` returns `kinzi + base + stack + (asat on the consonant) + sorted marks`:

1. **Duplicates:** a mark typed twice counts once.
2. **Asat:**
   - **Dropped as a slip** with i or ii, or on a stacked consonant without a dot below, unless the syllable has aa.
   - **Stored last** when typed after e or aa, with a dot below, or with aa and no medial.
   - **Otherwise it sits on the consonant:** right after the base and stack, or after the medials when there is a medial ha.
3. **Letters the fonts draw alike:**
   - stacked ca with medial ya is stacked jha, and ca with medial ya is jha;
   - u (U+1025) with a stacked consonant, asat or aa is nya (U+1009), unless `keepU`;
   - seven (U+1047) with any mark but visarga is ra.
4. **Ranks** come from `MARK_ORDER`: medial ya, ra, wa, ha; e; i and ii; u and uu; aa and tall aa; ai and anusvara; dot below; asat; visarga. A mark outside the table sorts last. Ai or anusvara typed before aa, with no lower vowel, keeps its place before the aa, except anusvara before tall aa.
5. **Sort:** a stable insertion sort by rank, so marks of the same rank keep their typed order.

### The two readers

Both readers walk the text once, by UTF-16 code unit, and share these rules:

- A base starts a syllable. Marks join the open syllable.
- e and medial ra that belong to the next base wait in `pending` and become the first marks of that base's syllable.
- **Held characters.** A space (U+0020, U+00A0) or zero-width character after an open syllable is held in `after`; zero-width characters are also copied to `kept`. If a mark of the syllable follows, the syllable goes on: the spaces are dropped, since they only moved the mark, and `after` becomes `kept`, so the zero-width characters end up after the syllable. Otherwise everything held is written as typed.
- Text that ends a syllable goes through `write`, which closes the syllable, writes any pending e or medial ra unattached, then the text.

**`arrange(content, glyphs)`, the font reader**, is driven by the glyph table. Each code point has a role:

| Role | Meaning | Reader action |
| --- | --- | --- |
| `base` | consonant, independent vowel, digit or symbol | closes the open syllable and starts a new one |
| `pre` | e or medial ra, drawn before the consonant | closes the open syllable; its marks wait for the next base |
| `mark` | medial, vowel sign, tone or asat | joins the open syllable |
| `stack` | stacked consonant, drawn under the base | joins the open syllable as its stack |
| `kinzi` | kinzi, drawn over the base | joins the open syllable and is written before the base |
| `text` | anything else | ends the syllable; its Unicode text is written |

A code point with no entry ends the syllable and is written as it is. A mark, stack or kinzi with no open syllable is written as its Unicode text, unattached. `font(table, sequences)` compiles a table into a `Map` keyed by char code, and adds every Myanmar letter in U+1000–U+104F (`isMyanmarLetter`) that the table leaves out as a base of itself.

**`arrangeUnicode(content)`, the Unicode reader**, reads Unicode's logical order. Kinzi (nga or ra, asat, virama) before a consonant starts that consonant's syllable. A letter or digit starts a syllable. Virama plus consonant is a stacked consonant. The Burmese marks join the open syllable. Two Zawgyi typing habits are undone:

- **e or medial ra typed before its consonant.** `placeTypedFirst` decides where each one goes: to the open syllable (`HERE`), to the consonant after it (`NEXT`), or nowhere (`ALONE`). It goes to the open syllable unless that syllable is finished (it has a vowel or a final) and no mark of it follows. Right after a letter or mark of another Myanmar-script language it stays where it is.
- **A space typed before a mark** is dropped, as in the font reader.

Letters and marks of Mon, Shan, Karen and the other languages are not read here: they end the syllable and stay where they are.

### The four deliberate differences between the readers

The readers share `order` and the held-character logic, but differ on purpose in four places. The code marks each with a comment, not with a named option.

| | Font reader (`arrange`) | Unicode reader (`arrangeUnicode`) |
| --- | --- | --- |
| **Which zero-width characters are held** | All five: U+200B, U+200C, U+200D, U+2060 and U+FEFF (`isZeroWidth`). | U+200B, U+2060 and U+FEFF. ZWNJ (U+200C) and ZWJ (U+200D) stay exactly where they were typed, since in Unicode they can shape the syllable on purpose. |
| **A digit and a mark across a space** | A mark after a held space joins any base, digits included. | A digit takes no mark from across a space (`goesOn`). A letter still does. |
| **e or medial ra before a zero-width character** | With no open syllable, a zero-width character is written at once and the pending e or medial ra go on to the next base, crossing it. | An e or medial ra never crosses a zero-width character to reach the next base: `placeTypedFirst` only looks at the character right after the run of e and medial ra. |
| **`keepU`** | Never set: u with asat, aa or a stacked consonant is always nya. Zawgyi and Win text is Burmese. | Set for u right after a vowel sign (U+102B–U+1032, U+1036), where Pa'o writes u with asat and visarga as a syllable of its own. |

```javascript
knayi.fontConvert('က\u200Cာ', 'unicode', 'zawgyi') // 'ကာ\u200C'
knayi.normalize('က\u200Cာ') // 'က\u200Cာ'
knayi.fontConvert('၁ ာ', 'unicode', 'zawgyi') // '၁ာ'
knayi.normalize('၁ ာ') // '၁ ာ'
knayi.normalize('က ာ') // 'ကာ'
knayi.fontConvert('ေ\u200Bက', 'unicode', 'zawgyi') // '\u200Bကေ'
knayi.normalize('ေ\u200Bက') // 'ေ\u200Bက'
knayi.fontConvert('လဲဥ္း', 'unicode', 'zawgyi') // 'လဲဉ်း'
knayi.normalize('လဲဥ်း') // 'လဲဥ်း'
```

One more difference follows from the encodings, not from a choice: in the fonts, e and medial ra always belong to the next base, while in Unicode they may also belong to the syllable before (`HERE`). That is why the converters write an e or medial ra with no base after it where it was typed, and `normalize` can move it into the syllable before. On the 10,166 distinct mC4 lines that `fontDetect` calls Zawgyi, `normalize` changes the converted output of 31, each with an e or medial ra where the two first differ.

## Typing fixes and their two orders

`typingFixes.js` has two functions, used by both pipelines:

- **`lookAlikes`:** zero and seven are typed for wa and ra, and the other way round. A zero or seven that carries a mark, or starts a closed syllable, is a letter; a zero inside a word with no digit next to it is a letter too. A bare wa or ra inside a run of digits is a digit. The marks and consonants here cover every language in the Myanmar blocks, so Shan and Karen text gets the same reading (#43).
- **`typos`:** four regexes, applied in order: i with ii is ii; u with uu is uu; o with e, aa and asat is au; the digit four before nga, asat and visarga is lagaung.

The two pipelines run them in opposite orders:

| Pipeline | Order |
| --- | --- |
| Zawgyi and Win (`storageOrder.toUnicode`) | `zero as wa` → `look-alikes` → `typos` → `NFC` |
| `normalize` (`normalization.js`) | `NFC` → syllables → `typos` → `look-alikes` → `NFC` |

The comment at the top of `typingFixes.js` says the two pipelines agree. On the eval corpora the order makes no difference: the two orders give the same result on every Unicode line read by `arrangeUnicode` (FLORES-200, the Wikipedia sample, Okell, mC4, and the GlotCC Shan, Mon, S'gaw Karen and Pa'o sets) and on every mC4 line converted from Zawgyi. Synthetic input shows the difference, for example a ra before the digit four of a lagaung:

```javascript
knayi.fontConvert('&4if;', 'unicode', 'win') // '၇၄င်း'
knayi.normalize('ရ၄င်း') // 'ရ၎င်း'
```

The font pipeline reads the ra next to a digit as seven first, so the four no longer follows a non-digit and stays a digit. `normalize` fixes the lagaung first. The debug stage order is part of the 2.x API (see [Stable surfaces](#stable-surfaces)), so changing either order is a deliberate output change.

The fonts also have a stage `normalize` does not: `zeroAsWa` (in `storageOrder.js`). Its idea of a zero in a number (a Burmese digit or one of `+ - * /` next to it, or a digit across `.` or `,`) differs from `lookAlikes`' (Burmese, Shan or Tai Laing digits, and `.` or `,`, but no arithmetic signs).

## Detection, breaks and the Unicode to Zawgyi rules

These live in regex tables, applied one pass per pattern:

- **Detection** (`detector.js`): 29 signature patterns. Only one has a comment saying why it is there.
- **Breaks** (`syllable.js`, `BREAK_RULES`): each rule inserts or removes U+200B, except the first Unicode rule, which puts a dot below typed after asat in front of it. A rule may have a third item, a pattern that turns it off for the whole text; the Zawgyi kinzi rule uses it to skip text with S'gaw Karen vowels.
- **Mark collapse** (`syllable.js`, `COLLAPSE`): one regex per mark, per font.
- **Unicode to Zawgyi** (`syllable.js`, `convertRules`): 57 `oneTime` rules, each applied once in order, then 8 `asLongAsMatch` rules, each repeated while it matches (at most 40 times). With `debug`, `matched_patterns` holds the regex `.source` of each `oneTime` rule that changed the text and each `asLongAsMatch` rule that matched, and `steps` holds the text before each of those rules followed by the result.

## Glossary

- **Storage order (logical order):** the order Unicode stores a syllable in, from UTN #11: kinzi, consonant, stacked consonant, an asat that sits on the consonant, medials, e, vowels, anusvara, dot below, asat, visarga. `order` writes this order.
- **Drawing order (visual order):** the order a font draws glyphs from left to right, which Zawgyi and Win store. e and medial ra come before the consonant, kinzi and stacked consonants after it, and the other marks in any order.
- **Prebase:** a mark drawn before its consonant: e (U+1031) and medial ra (U+103C; in Zawgyi U+103B and U+107E–U+1084). The font tables give them the role `pre`; `arrangeUnicode` calls them "typed first" (`isTypedFirst`).
- **Base:** what starts a syllable: a consonant, independent vowel, digit or symbol.
- **Stacked consonant:** a consonant written under another, stored as virama (U+1039) plus consonant. Zawgyi draws them as separate glyphs after the base (role `stack`), and has a few two-consonant ligatures that are bases.
- **Kinzi:** nga, asat and virama (U+1004 U+103A U+1039), stored before the consonant it is drawn over. Zawgyi draws it with U+1064, or U+108B–U+108D together with i, ii or anusvara, typed after that consonant. `arrangeUnicode` also reads ra, asat and virama as kinzi.
- **Held space:** a space or zero-width character after an open syllable, held in `after` (zero-width ones also in `kept`) until the next character shows whether the syllable goes on.
- **Pending:** e or medial ra waiting for the base that comes after it.
- **Slip:** an asat that `order` drops, because it was typed early for the next consonant's asat.
- **Look-alikes:** zero (U+1040) and wa (U+101D), and seven (U+1047) and ra (U+101B), typed for each other.
- **Tie:** equal rule scores in `fontDetect`. The result is the fallback, `'zawgyi'` when none is given. Short Unicode text, such as one consonant or a word whose only sign is a stacked consonant, ties often.
- **Silent mode:** `setGlobalOptions({ silent_mode: true })`, which hides the warnings and errors (all but one, see [Module state](#module-state)).

## Stable surfaces

These are the 2.x API. Changing them needs a major version.

| Surface | Where it is defined or relied on |
| --- | --- |
| The exports and their shapes | `main.js`. `scripts/build.js` builds the ESM named exports from its keys, and `test/package.test.js` checks every one. New exports may come in a minor version, with types and tests. |
| The types | `index.d.ts` may only grow. |
| The dist file names and the `knayi` global | `scripts/build.js`; `test/compat.test.js`, `test/browser.test.js`. |
| The option keys | `silent_mode`, `detector.use_myanmartools`, `detector.myanmartools_zg_threshold`, the per-call `adapter`, and `truncate`'s `length`, `omission` and `fontType`. |
| The deep path `knayi-myscript/library/converter` | README ("These paths load"); `test/compat.test.js`. |
| The shape of `win.tables` | `{ WIN, SEQUENCES, ROLES }`, with the role strings; read by `scripts/eval/win-glyphs.mjs`. |
| The debug stage names and their order | `sequences`, `glyphs`, `syllables`, `zero as wa`, `look-alikes`, `typos`, `NFC`: README (`fontConvert.debugging`); `test/zawgyi.test.js`, with one input that passes all seven; the stage lists of `test/fixtures/tables.json`; and the comparison with the frozen 2.10 engine in `test/fuzz.test.js`. |
| The regex-source labels in `matched_patterns` | Unicode to Zawgyi debugging logs each rule's `.source` (`syllable.js`, `record`). Rewriting a regex literal, even to an equal pattern, changes this output. |

Any library file that moves keeps a one-line shim at its old path through 2.x.

## Quirks kept on purpose

The 2.x code keeps these so that refactors stay byte-identical. Each one changes only in its own deliberate pull request, with a CHANGELOG line.

- **Three `isConsonant`s:** `storageOrder.js` means Burmese consonants (U+1000–U+1021), `typingFixes.js` the consonants of every language in the Myanmar blocks, and `syllable.js` the Burmese range again, for the test-only parser.
- **Bases differ between engines:** U+1022 and U+1028 start a syllable in `storageOrder.js` (`isMyanmarLetter`) but not in the Unicode break rules.
- **The typing-fix order** differs between the pipelines (above).
- **`fontConvert.debugging`** returns what `fontConvert` returns, not an object, on every early exit: missing or non-string content, no Myanmar text, a missing or unknown target, the same source and target, or a Win direction knayi does not convert.
- **The debug flag is read from `this`.** A detached call such as `const f = knayi.fontConvert; f(...)` reads `debug` from the global object in `main.js` and the script builds, which are sloppy-mode code, so a global `debug` variable makes it return the debug object. The ESM builds are strict and do not.
- **Font names in `syllBreak`, `truncate` and `spellingFix`:** an unknown name, or `'win'`, reaches the rule tables as it is. `syllBreak` and `truncate` throw a `TypeError` from inside `breakParts` for most of them; a few names of `Object.prototype` properties, such as `'toString'`, return the text with no breaks instead. `spellingFix` uses the Unicode marks for an unknown name, but throws on some `Object.prototype` names such as `'constructor'`. `fontConvert` detects the source instead of an unknown source name.
- **`truncate` throws on an object that `String()` cannot convert,** such as `Object.create(null)` or `{ toString: undefined }`: it turns non-strings into strings with `String(content)` (`truncate.js`), where the other functions return them unchanged. `test/properties.test.js` pins the `TypeError`.
- **NFC can take quadratic time (known, not kept on purpose).** `normalize` and the conversions to Unicode end with `String.prototype.normalize('NFC')`, which reorders a long run of combining marks of different classes, such as dot below with virama or asat (U+1037 with U+1039 or U+103A), in quadratic time: `'က'` followed by 32,000 such pairs takes about 1 s on Node 26. Putting each run of marks in canonical order before NFC would keep the output and make it linear; until that lands, `test/growth.timing.js` lists the case as known (CHANGELOG.md, 2.10.0, Security).
- **Only U+1000–U+109F counts as Myanmar** for the input checks (`contentGate.js`). The extended blocks (U+A9E0–U+A9FF, U+AA60–U+AA7F) are read by the typing fixes and by `arrangeUnicode`, but `fontDetect`, `fontConvert`, `syllBreak`, `spellingFix` and `truncate` treat text made only of them as having no Myanmar character. Myanmar Extended-C (U+116D0–U+116E3) is not read anywhere. The ranges are written by hand, not generated from Unicode data. They match Unicode 15.1, apart from the classes `test/unicode.test.js` lists, and that test fails when the runtime knows Myanmar code points they miss.

## Where the rules are justified

The rules in `storageOrder.js`, `typingFixes.js` and the glyph tables have a comment next to them in the code; the regex tables in `detector.js` and `syllable.js` mostly do not. The evidence, the counts on real text and the choices between sources are in `research/`:

| Note | Covers |
| --- | --- |
| [`research/zawgyi-to-unicode.md`](research/zawgyi-to-unicode.md) | Why the 2.9 Zawgyi rules were replaced; the glyph table; asat placement; UTN #11 against myanmar-tools and human typing, with counts. |
| [`research/normalize.md`](research/normalize.md) | What 2.9's `normalize` did wrong; each 2.10 rule; the typing fixes; the effect on conversion; other languages; speed. |
| [`research/win-fonts.md`](research/win-fonts.md) | The Win fonts and their encoding; existing converters and their licences; where the table comes from; open questions. |
| [`scripts/eval/README.md`](scripts/eval/README.md) | The eval data, its licences, and what the benchmark measures. |

A change to a rule adds its evidence there. [CONTRIBUTING.md](CONTRIBUTING.md) has the protocol.

## The 3.0 core on next

The branch `next` builds the 3.0 core once, beside the 2.x library, which it does not change ([docs/next/DESIGN.md](docs/next/DESIGN.md) is its spec). Everything above describes `library/`, which stays the 2.x reference while the core is built.

- **`src/`** holds ES modules (`src/package.json` sets `"type": "module"`), in layers that import only downwards: code points and classes (`script/codes.js`), the core (`core/`: errors, option defaults, the font registry, rule rows and the stage runner, a linear-time NFC), the glyph tables (`fonts/`), and three directories for the parts of layer 3, each named for what it may import: the engine (`engine/`: one syllable sort and two one-pass readers), the rules (`rules/`: the typing fixes, the one-pass scanners `detect.js` and `segment.js`, and the Unicode to Zawgyi rows), which never import the engine, and the stage lists (`stages/`: the normalize and font pipelines), the only files that import both. The core holds no options and writes nothing to the console; every option is an argument, and myanmar-tools is passed in as an object. `test/next/guards/` checks the layers, the stateless core, top-level code free of side effects (so a normalize-only import leaves out the glyph tables), the ES2015 floor, function sizes and the error codes.
- **`src/compat/`** is the 2.x API on that core: the same eight exports, the non-enumerable `default`, `fontConvert.debugging`, the option store, the console messages, the 2.x input checks and font names, and the TypeErrors 2.x throws by accident. It holds the 2.x global options itself, and loads myanmar-tools the way the 2.x ES module build does. Its output equals the 2.x reference (commit `e5f6e24`, the `main.js` of 2.10.0) on every input, with the two differences the 2.x ES module build has too: a detached `fontConvert` call never reads a global `debug`, and myanmar-tools is looked up from the working directory, not from `library/` (DESIGN.md §5.4).
- **`src/index.js`** is the 3.0 API on the same core (DESIGN.md §11), with its modules in `src/api/` and hand-written types in `src/index.d.ts`: `normalize`, idempotent and with an optional change report; `isNormalized` and `explain`, which name each issue with its offsets and a rule id; `detectEncoding`, with an injected ZawgyiDetector; `toUnicode`, which detects each line, leaves a tie alone unless asked, never trims, and maps output offsets back to the input; `toZawgyi`; lossless `segmentSyllables` and `syllableBoundaries`; a `truncate` that always returns a prefix; `collapseRepeatedMarks`; `createTrace`, `VERSION` and `OUTPUT_VERSION`. Arguments are checked, and a bad one throws an error with a `code`. The 3.0 API and compat import nothing of each other. Two parts of the core serve the 3.0 API only: a stable reading of the Unicode reader and a pass repeated on the regions it changed, which make normalize idempotent (DESIGN.md §11.2), and edit logs, which the copy-through writers fill only when given one (`core/edits.js`, §11.3), so the 2.x paths are as fast as before.
- **Citations of 2.x code.** A line number in a comment of `src/` (`storageOrder.js:101-185`) names that file of `library/` at the reference, commit `e5f6e24`, whose frozen copy is in `scripts/oracle/` (`contentGate.js`, `storageOrder.js`, `syllable.js`, `typingFixes.js`, `win.js` and `zawgyi.js`): `library/` itself changes when `main` is merged into `next`. A 2.x file with no frozen copy is cited by its function name (2.x `converter.js` `fontConvert`). The 2.x bugs the core keeps on purpose are cited by their row of DESIGN.md §10.
- **The checks.** `npm run compare -- --base e5f6e24fa756f8f9c8d790f9a15ede85b135e8ae --head mjs:src/compat/index.js` compares compat with the reference on every call form and input set; the contract matrix runs compat as one more build, which shares the recorded cells of the 2.x ES module build; `test/next/compat-*.test.mjs` test each 2.x behaviour against the live `main.js`; and the Compat job of CI runs compare, the matrix and the growth check on every pull request into `next`.

## Running the checks

Setup is `npm ci` in each clone or worktree; see [CONTRIBUTING.md](CONTRIBUTING.md), which also says which results a pull request reports. Every npm script, and the check of `.github/workflows/test.yml` that runs it, by the name GitHub shows (the name the rules for `main` require):

| Command | What it runs | CI check |
| --- | --- | --- |
| `npm run build` | Writes the four `dist/` files. Only a release commit runs it. | — |
| `npm test` | `node --test "test/**/*.test.js"`, then the timing test alone (`node --test "test/**/*.timing.js"`), then `tsc` on `typecheck/` with and without `esModuleInterop`, then the size check (`posttest`). The tests read the dist files from a temporary build. Among them: the tests per module; the contract matrix (`test/contract/`); a probe for every table row and one for each branch of a row's pattern (`test/tables.test.js`, probes in `test/fixtures/tables.json`, rewritten by `node scripts/testing/table-cases.js --write`); every example in README.md and this file, with their number pinned, and README's prose examples (`test/readme.test.js`); differential fuzz against the frozen 2.10 engine in `scripts/oracle/`; property tests; the myanmar-tools adapter; the layering test; the browser floor checks (`test/syntax.test.js`, `test/dist-floor.test.js`, `test/regex-floor.test.js`); and the Unicode version check. The timing test, `test/growth.timing.js`, checks that time grows linearly on random structured input and on a run of every single character; it runs after the others so that they do not compete with it for the CPU. | Node 22, Node 24, Node 26 |
| `npm run test:bun` | `scripts/bun-contract.js`, `scripts/bun-esm.mjs` and `scripts/bun-matrix.js` (the contract matrix in a process of its own), then `bun test ./test` and the timing test. | Bun |
| `npm run test:pack` | Packs the package with a fresh build (`scripts/pack-fresh.mjs`), installs it with Bun in a temporary app, and converts the Zawgyi greeting through `require` and `import`. | Bun |
| `npm run test:smoke -- [dir]` | README examples on plain Node through `main.js`, `library/converter` and, given a build directory, the script and module builds. It runs on Node 16 and later. | Smoke on Node 16, 18 and 20 |
| `npm run test:fuzz` | The fuzz and property tests alone. `KNAYI_FUZZ_SEED` and `KNAYI_FUZZ_SCALE` set the seed and size; `KNAYI_GROWTH_SEED` and `KNAYI_GROWTH_RUNS` do the same for `test/growth.timing.js`. | fuzz, nightly (`fuzz.yml`) |
| `npm run test:browser` | Playwright: the script and module builds in Chromium, Firefox and WebKit against `main.js`, and axe on the demo and benchmark pages. Install the browsers once with `npx playwright install chromium firefox webkit`. | Browsers |
| `npm run check:size` | The gzip size of `min.js` (Node's zlib, level 9) against the 2.10 baseline of 9,830 B and the limit of 10,854 B, with each module's share. `npm test` runs it without the breakdown. | ReDoS, types and size |
| `npm run check:dist -- --base <rev>` | Fails when `dist/` differs from `<rev>` without a version change; with a version change, or with `--fresh`, checks that `dist/` equals a fresh build; otherwise checks that `dist/` equals the `dist/` of the last release (the tag `v<version>`, or the commit that set the version while there is no tag; `--release <rev>` names another). The CI job also checks that the hashes in `.git-blame-ignore-revs` are in the history. | dist only in releases |
| `npm run check:redos` | Every regex the library ships, as literals, built at run time or exported, through recheck. The allowlist is `scripts/redos-allowlist.json`. | ReDoS, types and size |
| `npm run check:types` | Packs the package, then compiles `typecheck/packed/` against it under node16, nodenext and bundler resolution, runs the output, and runs @arethetypeswrong/cli on it. | ReDoS, types and size |
| `npm run matrix:update` | Rewrites `test/contract/api-matrix.json` after a deliberate change, and refuses build differences that `scripts/contract/matrix.js` does not explain. | — |
| `npm run compare -- --base <ref>` | Two copies of knayi on every call form, including `fontConvert.debugging`, over every cached corpus, generated input and seeded fuzz; lists the differences. `--expect form:set=n` declares the differences a deliberate change expects, `--offline` uses no corpus, and `--head min:.` or `mjs:.` compares `main.js` with its builds. | Compare (Node and Bun) |
| `npm run perf -- --base <ref>` | Two copies timed interleaved in one process, under Node and Bun: ratios per line, per word, on one string and on one document, and growth exponents on adversarial inputs (`--offline`: growth only). | Perf |
| `npm run eval` | Accuracy on public data, next to a published knayi release, myanmar-tools and Rabbit. | — |
| `npm run bench` | Speed on real text and long input; `-- --sweep` adds 1,059 long inputs. | — |
| `npm run bench:page` | Both, then rebuilds `docs/benchmark.html` and `docs/benchmark.json`. Run it for a release. | — |

Other commands: `node scripts/eval/datasets.mjs --check`, `--fetch` or `--refresh-samples` checks, fills or redraws the corpus cache; `node scripts/browser/floor.js` prints the floor rules and what each build uses; `node scripts/eval/win-glyphs.mjs <font>` draws every Win table entry next to its Unicode text, with your own copy of the font. [scripts/eval/README.md](scripts/eval/README.md) covers the corpora, compare and perf in detail.
