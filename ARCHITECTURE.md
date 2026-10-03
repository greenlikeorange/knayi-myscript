# Architecture

How knayi-myscript is built today: version 2.10.0, including the Shan look-alike fix (#73), the fix for `normalize`'s quadratic time on runs of e and medial ra (#74), NFC in linear time (`library/nfc.js`), one policy for font names, in any letter case (`resolveFont`, `breakFont` and `givenName` in `library/contentGate.js`), a `fontDetect` fallback that is a string or none, detector options that may be `null` and are checked (thresholds in order, adapter names), with every message silenced by silent mode, a `fontConvert` that reads no debug flag from `this`, a `fontConvert.debugging` that returns its report on every exit with text, as the types promise, the typing fixes in one order, typos then look-alikes, in conversion and `normalize`, a Unicode to Zawgyi rule for stacked jha, a `truncate` that returns the start of the text and breaks only that start, and builds without the Unicode syllable parser that only the tests use. This is a map of the current code, not a target design. A pull request that changes something described here updates this file in the same PR.

- [Entry points and builds](#entry-points-and-builds)
- [Module map](#module-map)
- [What each call does](#what-each-call-does)
- [The syllable engine](#the-syllable-engine-librarystorageorderjs)
- [NFC in linear time](#nfc-in-linear-time-librarynfcjs)
- [Typing fixes and their order](#typing-fixes-and-their-order)
- [Detection, breaks and the Unicode to Zawgyi rules](#detection-breaks-and-the-unicode-to-zawgyi-rules)
- [Glossary](#glossary)
- [Stable surfaces](#stable-surfaces)
- [Quirks kept on purpose](#quirks-kept-on-purpose)
- [Where the rules are justified](#where-the-rules-are-justified)
- [Running the checks](#running-the-checks)

## Entry points and builds

`main.js` is the package entry. It exports eight names: `version`, `setGlobalOptions`, `fontDetect`, `fontConvert`, `syllBreak`, `spellingFix`, `truncate` and `normalize`. It also sets a non-enumerable `default` that points back at the exports, for TypeScript without `esModuleInterop`. The export object is written with shorthand properties only, because Node finds the named exports for `import { … }` by scanning that object literal.

`index.d.ts` holds the types, with JSDoc on every export; `test/readme.test.js` runs the examples in it. `library/converter.d.ts` types the deep path with `index.d.ts`'s `fontConvert`. A font parameter is `FontName | (string & {})`, so an editor suggests the names and any string still compiles; `syllBreak`, `truncate`'s `fontType` and `fontConvert`'s target leave `'win'` out of the names, since they do not read it. `fontDetect` has a literal result type: `'unicode' | 'zawgyi'` and the type of the fallback, or `'en'` when there is none. `typecheck/` compiles five small consumers against the types, with and without `esModuleInterop`, and `typecheck/packed/` three more against the packed package (`npm run check:types`).

`scripts/build.js` bundles `main.js` with esbuild, `target: 'es2015'`:

| File | Format | Notes |
| --- | --- | --- |
| `dist/knayi-myscript.mjs` | ESM | One named export per key of `require('./main.js')`, plus the default export. |
| `dist/knayi-myscript.es.js` | ESM | A byte copy of the `.mjs` file. `package.json` `module` points here. |
| `dist/knayi-myscript.js` | IIFE | Sets the global `knayi`, also when a bundler imports the file. |
| `dist/knayi-myscript.min.js` | IIFE, minified | The file the README, unpkg and jsDelivr serve. |

The committed `dist/` is the build of the last release, or of the release being prepared: jsDelivr serves `main`'s `dist/` to `@master` links, so it changes only in a release commit (`scripts/check-dist.js`). 2.10.0 is not tagged or published yet, and its `dist/` was rebuilt by #70 to #74 after the commit that set the version (7619008); its tag goes on the commit that holds the final build. Everything else builds into a temporary directory: `builtDist()` in `scripts/build.js` builds once per process and removes the directory on exit, or returns `KNAYI_DIST` when that is set.

`main.js` and `dist/knayi-myscript.es.js` are two copies of the library with their own module state. Silent mode and detector options set on one are not seen by the other (README, "Runtime").

The npm package ships `main.js`, `index.d.ts`, all of `library/` and the four `dist/` files (`package.json` `files`). There is no `exports` map, so every `library/*.js` file can be required by path. The README promises one deep path, `knayi-myscript/library/converter`, and `library/converter.d.ts` types it.

## Module map

All library code is CommonJS in `library/`. Every file there is strict code: it starts with `'use strict'`, so an assignment to an undeclared name throws instead of making a global, and a function called on its own gets `undefined` as `this`, not the global object. `main.js` has no directive: esbuild moves the entry's directive to the top of the script builds, where it would also make strict any code concatenated after the file. Each module keeps its own directive inside its wrapper in the builds (`test/unit/strict.test.js`).

| Module | Exports | What it holds |
| --- | --- | --- |
| `converter.js` | `fontConvert`, `fontConvert.debugging` | Input checks and font routing for conversion. Both exports call `convert`, which takes the debug flag as an argument: `false` from `fontConvert`, `true` from `debugging`. Every exit that returns text before converting goes through `unconverted`, which gives `debugging` its report there. |
| `detector.js` | `fontDetect` | 29 signature patterns (12 Unicode, 17 Zawgyi) compiled to global regexes at load; the rule scorer; the optional myanmar-tools adapter and its lazy loader. |
| `normalization.js` | `normalize` | Input checks, then NFC and, for text with a character of the Myanmar blocks, `arrangeUnicode`, typos, look-alikes, NFC. |
| `syllBreak.js` | `syllBreak` | Input checks, font choice, then `breakText`. |
| `spellingCheck.js` | `spellingFix` | Input checks, font choice, then `collapseMarks`. The file name differs from the export name. |
| `truncate.js` | `truncate` | Input checks, font choice, `breakStart`, then `fitParts`, which keeps the parts that fit. |
| `contentGate.js` | `isMissing`, `toText`, `hasMyanmar`, `resolveFont`, `givenName`, `breakFont`, `libraryError`, `cleanText` | Shared input helpers; `givenName`, which reads a name argument (a font, `fontDetect`'s fallback or an adapter); the font names and their aliases (`uni`, `zaw`), read in any letter case, and the font-name policy; and `libraryError`, which makes every error knayi throws on purpose. |
| `globalOptions.js` | `isSilentMode`, `setOptions`, `detector` | The module-level option store, and the detector-option merge with its threshold check. |
| `storageOrder.js` | `ROLES`, `font`, `toUnicode`, `arrangeUnicode` | The syllable engine: the shared syllable sort `order`, the font reader `arrange`, the Unicode reader `arrangeUnicode`, the font compiler `font` and the font pipeline `toUnicode`. |
| `typingFixes.js` | `lookAlikes`, `typos` | Zero and seven read as wa and ra (and back), and four typo rules. |
| `nfc.js` | `nfc`, and `nfc.reorder` for the tests | `String.prototype.normalize('NFC')` in linear time: long runs of combining marks are put in order first ([below](#nfc-in-linear-time-librarynfcjs)). |
| `zawgyi.js` | `toUnicode` | The Zawgyi glyph table and its two lagaung sequences. |
| `win.js` | `toUnicode`, `tables` | The Win Innwa glyph table, its look-alike sequences and the Windows-1252 to C1 aliases. `tables` is `{ WIN, SEQUENCES, ROLES }`, read by `scripts/eval/win-glyphs.mjs`. |
| `syllableRules.js` | `collapseMarks`, `breakParts`, `breakStart`, `joinParts`, `breakText`, `convertText` | Three jobs in one file: the Unicode to Zawgyi rules, the mark-collapse rules and the syllable-break rules. |
| `unicodeParser.js` | `parseUnicode`, `serializeUnicode` | A Unicode syllable parser that only the tests use. No public function calls it. |
| `syllable.js` | `parseUnicode`, `serializeUnicode`, `collapseMarks`, `breakParts`, `breakStart`, `joinParts`, `breakText`, `convertText` | The 2.x path of the syllable rules: one line that exports what `unicodeParser.js` and `syllableRules.js` export, under the names this file had when it held both. |

`main.js` requires neither `syllable.js` nor `unicodeParser.js`, so the builds leave them out: the parser would add about 430 bytes to `min.js` with gzip. They still ship in `library/`, so `require('knayi-myscript/library/syllable')` gives what it gave in 2.10 (`test/syllable.test.js` checks the names and the builds).

### Dependency graph

```
main.js
├── globalOptions.js
├── detector.js ─────────── globalOptions.js, contentGate.js
├── converter.js ────────── detector.js, globalOptions.js, contentGate.js, syllableRules.js, win.js, zawgyi.js
├── syllBreak.js ────────── detector.js, globalOptions.js, contentGate.js, syllableRules.js
├── spellingCheck.js ────── detector.js, globalOptions.js, contentGate.js, syllableRules.js
├── truncate.js ─────────── detector.js, globalOptions.js, contentGate.js, syllableRules.js
└── normalization.js ────── globalOptions.js, contentGate.js, storageOrder.js, typingFixes.js, nfc.js

zawgyi.js, win.js ───────── storageOrder.js ───── typingFixes.js, nfc.js
leaves: globalOptions.js, contentGate.js, syllableRules.js, typingFixes.js, nfc.js

not bundled: syllable.js ── unicodeParser.js, syllableRules.js
```

Two edges point the unexpected way. The font data modules (`zawgyi.js`, `win.js`) require the engine and call its pipeline, instead of the engine reading the tables. And the engine (`storageOrder.js`) requires `typingFixes.js`, because `toUnicode` runs the whole font pipeline, typing fixes included.

`test/unit/layers.test.js` puts every file in a layer (script, core, fonts, engine, rules, public, entry; `nfc.js` is the one script file) and fails on a new `require` that points up a layer. These edges are its only known exceptions, and the list may only shrink.

### Module state

- `globalOptions.js`: the option store (`silent_mode`, `detector`).
- `detector.js`: the loaded myanmar-tools detector, the load error, and a flag so the "not installed" warning is printed once.
- `storageOrder.js`: a scratch array for the rank sort in `order`, which never runs inside itself.
- `nfc.js`: what it has read from `String.prototype.normalize`: whether each code point below U+20000 it has looked at is a run character, in a 128 KB `Uint8Array` made when it first looks at one at or above U+0300, and the decomposition and combining classes of each run character (about a thousand exist). The memory stays bounded whatever the text; a character above U+1FFFF that is not a run character is probed again each time.
- The rule regexes in `syllableRules.js`, and its `WHITESPACE`, have the `g` flag and are shared between calls, so the code resets `lastIndex` before each use.

Console output: missing content, an unknown source font and an unknown adapter warn (`console.warn`), conversion errors and the threshold error use `console.error`, and `silent_mode` silences all of them. The threshold error (`globalOptions.detector`) starts with its code in brackets, `[ERR_KNAYI_INVALID_THRESHOLD]`; no other message has a code.

Errors: knayi throws on purpose in one place, `breakFont` (below), and builds the error with `libraryError(code, message, Ctor)`, which sets a string `code`. `test/unit/errors.test.js` fails on any other `throw` in the library, and the contract matrix records the code and message of such an error, but only the class of a `TypeError` the engine raises by accident.

## What each call does

Every public function starts the same way, with small differences. `toText` unwraps `String` objects. `isMissing` treats `null`, `undefined`, `''`, `0`, `false` and `NaN` as missing: the function warns (unless silent) and returns `''`, or the fallback or `'en'` for `fontDetect`. `truncate` does not count `''` as missing. Other non-strings are returned unchanged; `fontDetect` returns the fallback or `'en'` for them, and `truncate` turns them into strings. `hasMyanmar` tests for a character in U+1000–U+109F.

### fontConvert(content, to, from)

1. Missing content: `''`. A non-string: returned. No Myanmar character and a source other than `win` (in any case): returned unchanged. No target: an error, and the text is returned.
2. The text is trimmed. `to` and `from` go through `resolveFont`, which lowercases a name (a string, or a `String` object) and resolves the aliases. An unknown target is an error. An unknown or missing source is detected with `fontDetect(content)`, whose tie result is `'zawgyi'`; an unknown name (a string, `givenName`) also warns.
3. Same source and target: the trimmed text.
4. A Win target, or a Win source with a target other than Unicode: an error, and the text is returned.
5. Zawgyi or Win to Unicode: `zawgyi.toUnicode` or `win.toUnicode`, which both call `storageOrder.toUnicode` with their compiled font.
6. Unicode to Zawgyi: `syllable.collapseMarks(content, 'unicode')`, then `syllable.convertText`.

`fontConvert.debugging` takes the same steps. Where steps 1 to 4 return text, it returns that text in a report with no `matched_patterns` and one step (`unconverted`), as for a conversion in which nothing matched; a non-string comes back as it is. The report's `to` and `from` are the fonts the call has read, or `''`: for a missing or unknown name, and for a source the call has not detected yet. The report reads a font only as a name (`givenName`), so on the exits of step 1, before `resolveFont` reads `to` and `from` in step 2, a font that is not a string, such as `['unicode']`, is reported as `''`, and its string form, whose conversion can throw, is not read for the report.

### The font pipeline: storageOrder.toUnicode(content, font, debug)

| Stage name | What it does |
| --- | --- |
| `sequences` | The font's look-alike sequences, as regex replacements. Zawgyi: two lagaung rules. Win: `aMomf`, `Mo`, `ps`, `OD`. |
| `glyphs` | Debug only: each glyph's Unicode text, still in typed order. |
| `syllables` | `arrange`: the font reader. |
| `zero as wa` | `zeroAsWa`: a zero that is not part of a number becomes wa. |
| `typos` | `typingFixes.typos`. |
| `look-alikes` | `typingFixes.lookAlikes`. |
| `NFC` | `nfc.js`: `String.prototype.normalize('NFC')`, with long runs of marks put in order first. |

With `debug`, `toUnicode` returns `{ matched_patterns, steps }`: `matched_patterns` names each stage that changed the text, in order, and `steps` holds the input followed by the text after each of those stages. `converter.js` adds `to` and `from`. The README documents these stage names.

### normalize(content)

After the input checks, every string goes through NFC first. A string that then has a character of the Myanmar blocks (U+1000–U+109F, U+A9E0–U+A9FF, U+AA60–U+AA7F) goes on through the other steps:

```
NFC → arrangeUnicode → typos → lookAlikes → NFC
```

The block test sits after the first NFC, not in front of it, so text with no Myanmar character still comes back in NFC. The first NFC is there because it can move a dot below in front of an asat or virama, which changes what they attach to. Both NFC passes go through `nfc.js`.

Text with no character of those blocks after the first NFC returns there, since the other steps would give it back as it is: `arrangeUnicode` opens a syllable only at a character of U+1000–U+109F and writes every other character as it is, each typing fix matches only at one of those characters, and NFC leaves NFC text as it is. The shortcut counts the extended blocks too, whose letters and marks those steps read. On English text under Node, it takes about a twelfth of the time all the steps took a line at a time, and a fiftieth on one long string.

### fontDetect(content, fallback, options)

1. The fallback is read with `givenName` ([below](#syllbreak-spellingfix-and-truncate)): a string other than `''`, or a `String` object's string, kept as given. Any other value, such as the index `Array#map` passes, is no fallback.
2. Missing content, or no Myanmar character: the fallback, or `'en'`.
3. `cleanText(content, true)`: trim, and remove U+200B and U+200C.
4. The fallback defaults to `'zawgyi'`.
5. `globalOptions.detector(options)` merges the call's options with the stored ones; `null` options, like `undefined`, are none. A threshold must be two finite numbers in order; for any other value the call uses the stored pair, with the threshold error unless silent. `setGlobalOptions` checks the same way and keeps the stored pair, and `setGlobalOptions(null)` does nothing. `chooseAdapter` reads the `adapter` with `givenName`, so a value that is not a string, or `''`, names no adapter. An explicit `'rules'` or `'myanmartools'` wins; otherwise `use_myanmartools` picks myanmar-tools, and any other name also warns, unless silent.
6. **Rules:** each side's score is the total number of matches of its signature patterns (`String#match` with the `g` flag). The higher score wins; a tie returns the fallback.
7. **myanmar-tools:** loaded on first use through `nodeRequire`, which only works in Node: `module.require`, or `process.getBuiltinModule('module').createRequire(...)` from `__filename` or, where that is missing, from the working directory's `package.json`. It finds Node by `process.versions.node`, and reads `process` from `globalThis` behind a `typeof` check, since browsers inside the README floor may have no `globalThis` (Chrome before 71, Firefox before 65, Safari before 12.1, Edge before 79). Anywhere else, such as in any browser, it loads nothing, and the warning says myanmar-tools is not available in this environment. A probability below the first threshold is `'unicode'`, above the second `'zawgyi'`, and in between the fallback. If the package cannot be loaded, the call uses the rules and warns once.

`fontDetect` never returns `'win'`.

### syllBreak, spellingFix and truncate

All three read the font with `givenName`: a name is a string other than `''`, or a `String` object that holds one. Anything else names no font, and the call uses `fontDetect(content)`. A name goes through `resolveFont`, which lowercases it and resolves the aliases, so `'Unicode'`, `'ZAWGYI'` and `'Zaw'` are fonts too. Only a name's ASCII letters fold to it: no other character lowercases to one of its letters (U+0130, capital I with a dot, lowercases to i and a combining dot; the Kelvin sign U+212A lowercases to k, which no name has). syllBreak and truncate pass the name to `breakFont(name, apiName)`, which returns `'unicode'` or `'zawgyi'`, and throws a `TypeError` with the code `ERR_KNAYI_INVALID_FONT` for `'win'` (in any case) and for any other name, quoting the name as given: the break rules exist for Unicode and Zawgyi only. They call it after the input checks, so missing content and text with no Myanmar character never throw. spellingFix passes any name on, resolved where it names a font, and `collapseMarks` uses the Unicode marks for every name but `'zawgyi'`. `fontDetect` reads its fallback with `givenName` too, so a value that is not a string is no fallback; but the fallback is not a font name, and is returned as given, in its own case.

- **syllBreak:** no Myanmar character returns the text unchanged. Otherwise `cleanText(content, true)`, then the font, detected on the cleaned text when none is named, then `breakText(content, font, breakpoint)`. Its `markBreaks` applies `BREAK_RULES[font]` (7 rules for Unicode, 8 for Zawgyi), which insert and remove U+200B (the first Unicode rule instead puts a dot below in front of an asat typed before it), and drops a leading U+200B. The breakpoint is U+200B by default and for any falsy one (`isDefaultBreakpoint`), and then that text is the result. For any other breakpoint, `breakParts` splits the text on U+200B and U+200C, and `joinParts` joins the parts with the breakpoint's string form (`Array#join`), so `lines.map(knayi.syllBreak)`, which passes the array as the third argument, joins each line's syllables with the array's text. The two ways agree for U+200B: `cleanText` removed U+200B and U+200C, and the rules write no U+200C, so splitting the text and joining the parts with U+200B would give it back. Without the split and join, `syllBreak` with the default breakpoint takes 8 to 24% less time under Node, and 11 to 22% less under Bun.
- **spellingFix:** detects the font on the raw text, then cleans it and runs `collapseMarks(content, font)`: one regex, `COLLAPSE[font]`, or `COLLAPSE.unicode` when `COLLAPSE` has no own property of that name (so `'constructor'` finds no `Object.prototype` member), turns each run of one of the font's marks into that mark.
- **truncate:** `length` defaults to 30 and `omission` to `'...'`, and the budget is `length - omission.length`. Text with no Myanmar character is cut with `substr`. Otherwise the font, when none is named, is detected on the text as given, as in spellingFix ([below](#quirks-kept-on-purpose)); then the text goes through `cleanText(content, true)`, `breakStart(content, font, budget)` breaks its start into parts, and `fitParts` adds the parts while they fit; of the first part that does not fit, it adds the start up to the last whitespace within the budget (the words that fit with the whitespace after them), and stops. The result is trimmed and the omission appended. So it is the longest start of the text that fits the budget and ends at a break or after whitespace, where the text is what the break rules give back: cleaned and, in Unicode, with a dot below typed after an asat put before it.
  `breakStart` breaks the text only up to the first whitespace character after the budget, and gets the parts of the whole text there: a break rule reads whitespace only as the first character of a match, so no match runs across the start of a whitespace character, and no rule breaks before one (`test/syllable.test.js` checks the patterns). Its last part, cut short there, runs past the budget, so `fitParts` stops at it or before it and reads only the part's first `budget` code units. A rule's off switch still reads the whole text. Before `truncate` returned the start of the text ([CHANGELOG.md](CHANGELOG.md), Output changes), it broke all of it, went on after a part that did not fit and added later ones that did, and wrote a space for each whitespace between the words it added, so its result could leave text out and keep text that came after it.

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

`order` tells which marks a syllable has from one number with the bit `1 << rank` of each mark typed, instead of searching the marks for each test. Each mark it looks for has a rank of its own, or shares it only with marks it looks for along with it (i and ii, u and uu, aa and tall aa), so a bit answers for exactly the marks a test names. Besides finding the asat, medial ya and aa it moves or compares, `order` still reads the marks for two tests: whether e or aa was typed before the asat (`isEOrAaBefore`), where the order counts, and, for u, whether the asat is still there after step 2. A mark is looked for among those already kept only when one of its rank is there. The ranks behind the bits are written out as numbers, so that the build holds each bit as a constant; `test/unit/mark-ranks.test.js` checks them, and the ranks `order` names, against `MARK_ORDER`. With the bits, `normalize` takes about 23% less time per line under Node than with the searches, and conversion from Zawgyi and Win about 12% less.

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

A code point with no entry ends the syllable and is written as it is. A mark, stack or kinzi with no open syllable is written as its Unicode text, unattached. `font(table, sequences)` compiles a table into an array indexed by char code, up to the highest code with an entry (U+1097 for Zawgyi, U+2039 for Win), with `null` for a code with none, and adds every Myanmar letter in U+1000–U+104F (`isMyanmarLetter`) that the table leaves out as a base of itself. With the array, the font reader takes 12 to 15% less time under Node than with the `Map` it replaced.

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

One more difference follows from the encodings, not from a choice: in the fonts, e and medial ra always belong to the next base, while in Unicode they may also belong to the syllable before (`HERE`). That is why the converters write an e or medial ra with no base after it where it was typed, and `normalize` can move it into the syllable before. On the 10,166 distinct mC4 lines that `fontDetect` calls Zawgyi, `normalize` changes the converted output of 31, each with an e or medial ra where the two first differ. On generated and random strings it changes converted text in other places too: marks with no consonant before them, which the two readers read differently, and typing fixes that find more to fix on a second pass.

## NFC in linear time: library/nfc.js

`normalize` starts and ends with NFC, and the font pipeline ends with it. NFC puts each run of non-starters (characters of a canonical combining class above 0; in the Myanmar block the dot below, virama, asat and U+108D) in canonical order, and `String.prototype.normalize` does that with an insertion sort in Node and in Bun: a long run out of order takes quadratic time. `'က'` followed by 32,000 pairs of dot below and virama took about a second. `nfc(text)` returns exactly what `text.normalize('NFC')` returns, in linear time:

- **Run characters.** A run character is one whose canonical decomposition is all non-starters: the combining marks, and seven characters such as U+0344 and U+0F73 that decompose into them. Anything else ends a run. A letter with marks, such as U+1E09, ends the run before it; `normalize` adds its marks to the run after it, at a cost of a step for each of them per character of the run.
- **Finding long runs.** A run longer than 30 code units covers one code unit in every 31, so `nfc` looks only at those, and measures the run around each one that is a run character. Ordinary text has few run characters and short runs, so most of it is never read. 30 is the limit of UAX #15's stream-safe text format.
- **Putting a run in order.** Each run longer than 30 code units is replaced by the code points of its characters' decompositions, stably sorted by combining class (a bucket sort). That is what NFC does to the run, so the text stays canonically equivalent and keeps its NFC, and `normalize` then finds the run in order, which it handles in linear time. Shorter runs go to `normalize` as they are, at a cost of at most 30 steps per mark.
- **Combining classes.** JavaScript has no table of combining classes, so `nfc.js` reads them from `String.prototype.normalize`: a code point is a non-starter when NFD moves dot below in front of asat across it, and two non-starters are of the same class when NFD keeps both of their orders, or else the one NFD puts first has the lower class. It keeps what it learns per character. Its classes are the runtime's own, whatever Unicode version the runtime has, which is what makes the result exactly the runtime's NFC.

`test/nfc.test.js` checks the helper against a probe, with other marks, of every code point the runtime knows, and every ordered pair of its run characters (971 on Node 26, Unicode 17); `test/growth.timing.js` and `test/performance.test.js` time long runs of Myanmar, Latin, Greek, Hebrew, Arabic, Tibetan and astral marks.

## Typing fixes and their order

`typingFixes.js` has two functions, used by both pipelines:

- **`lookAlikes`:** zero and seven are typed for wa and ra, and the other way round. A zero or seven that carries a mark, or starts a closed syllable, is a letter; a zero inside a word with no digit next to it is a letter too. A bare wa or ra inside a run of digits is a digit. The marks and consonants here cover every language in the Myanmar blocks, so Shan and Karen text gets the same reading (#43).
- **`typos`:** four regexes, applied in order: i with ii is ii; u with uu is uu; o with e, aa and asat is au; the digit four before nga, asat and visarga is lagaung.

Both pipelines make the typos first, then the look-alikes:

| Pipeline | Order |
| --- | --- |
| Zawgyi and Win (`storageOrder.toUnicode`) | `zero as wa` → `typos` → `look-alikes` → `NFC` |
| `normalize` (`normalization.js`) | `NFC` → syllables → `typos` → `look-alikes` → `NFC` |

The order counts where the two read the same characters, as with a ra before the digit four of a lagaung. The typo fix reads a four that follows no digit as lagaung, and then the ra is next to no digit and stays a letter. The other way round, the look-alikes read the ra next to the four as seven, and the four, now after a digit, stays a digit. The font pipeline made the look-alikes first until both pipelines took `normalize`'s order ([CHANGELOG.md](CHANGELOG.md), Output changes), and turned `&4if;` into `၇၄င်း`. Now conversion and `normalize` agree:

```javascript
knayi.fontConvert('&4if;', 'unicode', 'win') // 'ရ၎င်း'
knayi.normalize('ရ၄င်း') // 'ရ၎င်း'
```

On the eval corpora, and on the generated and random Win strings of `npm run compare`, the order changes no converted text. Where both stages change a line, `fontConvert.debugging` names them, and gives the text between them, in the new order: on one mC4 line and one Shan line read as Zawgyi. The debug stage order is part of the 2.x API ([Stable surfaces](#stable-surfaces)), so changing it is a deliberate output change.

The fonts also have a stage `normalize` does not: `zeroAsWa` (in `storageOrder.js`). Its idea of a zero in a number (a Burmese digit or one of `+ - * /` next to it, or a digit across `.` or `,`) differs from `lookAlikes`' (Burmese, Shan or Tai Laing digits, and `.` or `,`, but no arithmetic signs).

## Detection, breaks and the Unicode to Zawgyi rules

These live in regex tables, applied one pass per pattern:

- **Detection** (`detector.js`): 29 signature patterns. Only one has a comment saying why it is there.
- **Breaks** (`syllableRules.js`, `BREAK_RULES`): each rule inserts or removes U+200B, except the first Unicode rule, which puts a dot below typed after asat in front of it. A rule may have a third item, a pattern that turns it off for the whole text; the Zawgyi kinzi rule uses it to skip text with S'gaw Karen vowels. A rule reads whitespace only as the first character of a match, which lets `truncate` break only the start of a text ([above](#syllbreak-spellingfix-and-truncate)).
- **Mark collapse** (`syllableRules.js`, `COLLAPSE_MARKS` and `COLLAPSE`): the marks of each font, and one regex per font, `([marks])\1\1*`, which finds a mark and the same mark after it, so a run of one mark becomes that mark and two different marks stay. It gives what one `[mark]{2,}` regex per mark, applied in turn, gave in 2.10 (`test/syllable.test.js`). `\1\1*` matches what `\1+` matches, but V8 runs it faster on text where marks are rarely repeated.
- **Unicode to Zawgyi** (`syllableRules.js`, `convertRules`): 58 `oneTime` rules, each applied once in order, then 8 `asLongAsMatch` rules, each applied with one replace when it matches. A stacked consonant with a rule of its own becomes Zawgyi's glyph for it; a virama that no rule reads stays U+1039, which Zawgyi reads as an asat. Stacked jha and stacked ca with medial ya both become U+1069, Zawgyi's stacked jha, which `zawgyi.js` reads back as stacked jha. They are rules to apply while they match, as 2.10 did (at most 40 times), but one replace leaves no match: each rule replaces the medial ra its pattern starts with (U+103B or U+107E) by another glyph, and the rest of its pattern matches neither of those two nor the glyphs the rule writes. `test/syllable.test.js` checks that on generated strings. A rule is `[pattern, replacement]`, or `[pattern, replacement, label]`. With `debug`, `matched_patterns` holds the label of each `oneTime` rule that changed the text and each `asLongAsMatch` rule that matched, which is the regex `.source` of a rule without one, and `steps` holds the text before each of those rules followed by the result.

**Literal searches V8 runs slowly.** V8 finds the first character of a regex that is a plain literal (no class, group, alternative, anchor or quantifier), and of an `indexOf`, `includes`, `split` or `replace` needle, by the higher of its two bytes. For U+1000 to U+1010 that byte is 0x10, which every Myanmar character has, so on Myanmar text the search stops at every character and takes 6 to 50 times as long. So no pattern or needle in the library starts there as a plain literal: the first character goes in a class of one, as in `/[\u1004]\u103a\u1039/`, which V8 runs as a regex. Eight patterns are written this way: six Unicode to Zawgyi rules, which keep the source they had before as their label, so debugging output does not change, and the detector signatures for nya and nga with asat. The range is exact: from U+1011 the low byte is the higher one, the literal search is fast, and a class of one is slower. JavaScriptCore (Bun) runs a class of one slower than the literal at every character, so `fontDetect` is slower there: about 10% per line, and up to about 25% on one long string or document. `test/unit/literal-search.test.js` checks both directions, on the source and on the regexes and needles the call forms use.

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
- **Silent mode:** `setGlobalOptions({ silent_mode: true })`, which hides every warning and error knayi writes to the console (see [Module state](#module-state)).

## Stable surfaces

These are the 2.x API. Changing them needs a major version.

| Surface | Where it is defined or relied on |
| --- | --- |
| The exports and their shapes | `main.js`. `scripts/build.js` builds the ESM named exports from its keys, and `test/package.test.js` checks every one. New exports may come in a minor version, with types and tests. |
| The types | `index.d.ts` and `library/converter.d.ts` may only grow. One change so far is an exception: 2.11 narrows `fontDetect`'s result type from `string` to the values it returns, which stops some code compiling (CHANGELOG.md, under Changed); the release notes list it under "Before you upgrade" ([CONTRIBUTING.md](CONTRIBUTING.md#release-checklist)). `typecheck/` (`npm test`) and `typecheck/packed/` (`npm run check:types`) compile code that uses them. |
| The dist file names and the `knayi` global | `scripts/build.js`; `test/compat.test.js`, `test/browser.test.js`. |
| The option keys | `silent_mode`, `detector.use_myanmartools`, `detector.myanmartools_zg_threshold`, the per-call `adapter`, and `truncate`'s `length`, `omission` and `fontType`. |
| The deep path `knayi-myscript/library/converter` | README ("These paths load"); `test/compat.test.js`; its types, `library/converter.d.ts`, in `typecheck/deep-path.ts` and `typecheck/packed/`. |
| The shape of `win.tables` | `{ WIN, SEQUENCES, ROLES }`, with the role strings; read by `scripts/eval/win-glyphs.mjs`. |
| The debug stage names and their order | `sequences`, `glyphs`, `syllables`, `zero as wa`, `typos`, `look-alikes`, `NFC`: README (`fontConvert.debugging`); `test/zawgyi.test.js`, with one input that passes all seven; the stage lists of `test/fixtures/tables.json`; and the comparison with the frozen 2.10 engine, with the deliberate changes made since, in `test/fuzz.test.js`. |
| The regex-source labels in `matched_patterns` | Unicode to Zawgyi debugging logs each rule's label: its third item, the source its pattern had before a rewrite for speed, or else its pattern's `.source` (`syllableRules.js`, `record`). Rewriting a regex literal, even to an equal pattern, changes this output, unless the rule keeps the old source as its label. |
| Error codes | The `code` of each error knayi throws on purpose: `ERR_KNAYI_INVALID_FONT` (`contentGate.js`); README ("Font names"); the contract matrix. The code at the start of the threshold error, `[ERR_KNAYI_INVALID_THRESHOLD]` (`globalOptions.js`); README ("fontDetect"). Messages may change; codes may not. |

Any library file that moves keeps a one-line shim at its old path through 2.x, as `syllable.js` does for the rules that moved to `syllableRules.js`.

## Quirks kept on purpose

The 2.x code keeps these so that refactors stay byte-identical. Each one changes only in its own deliberate pull request, with a CHANGELOG line.

- **Three `isConsonant`s:** `storageOrder.js` means Burmese consonants (U+1000–U+1021), `typingFixes.js` the consonants of every language in the Myanmar blocks, and `unicodeParser.js` the Burmese range again, for the test-only parser.
- **Bases differ between engines:** U+1022 and U+1028 start a syllable in `storageOrder.js` (`isMyanmarLetter`) but not in the Unicode break rules.
- **`fontConvert` reads a font that is not a string by its string form:** `resolveFont` looks the value up as a property name, with no case folding, so `['zawgyi']` is Zawgyi and `['ZAWGYI']` is detected, where `syllBreak`, `spellingFix` and `truncate` detect the font for any value that is not a string. Only an unknown name that is a string warns.
- **`truncate` throws on an object that `String()` cannot convert,** such as `Object.create(null)` or `{ toString: undefined }`: it turns non-strings into strings with `String(content)` (`truncate.js`), where the other functions return them unchanged. `test/properties.test.js` pins the `TypeError`.
- **`syllBreak` detects the font on the cleaned text, and `spellingFix` and `truncate` on the text as given.** `fontDetect` cleans the text it scores as `cleanText(content, true)` does, so for `syllBreak` it scores the text cleaned twice. The two differ where removing a U+200B or U+200C at either end of the text leaves whitespace there, which only the second cleaning trims: on U+200B U+FEFF U+1084 U+1000 U+103F U+1000, `truncate` detects Unicode and `syllBreak` Zawgyi. `test/properties.test.js` checks `truncate` against `syllBreak` with the font `truncate` detects.
- **Only U+1000–U+109F counts as Myanmar** for the input checks (`contentGate.js`). The extended blocks (U+A9E0–U+A9FF, U+AA60–U+AA7F) are read by the typing fixes and by `arrangeUnicode`, and count for `normalize`'s shortcut ([above](#normalizecontent)), but `fontDetect`, `fontConvert`, `syllBreak`, `spellingFix` and `truncate` treat text made only of them as having no Myanmar character. Myanmar Extended-C (U+116D0–U+116E3) is not read anywhere. The ranges are written by hand, not generated from Unicode data. They match Unicode 15.1, apart from the classes `test/unicode.test.js` lists, and that test fails when the runtime knows Myanmar code points they miss.

## Where the rules are justified

The rules in `storageOrder.js`, `typingFixes.js` and the glyph tables have a comment next to them in the code; the regex tables in `detector.js` and `syllableRules.js` mostly do not. The evidence, the counts on real text and the choices between sources are in `research/`:

| Note | Covers |
| --- | --- |
| [`research/zawgyi-to-unicode.md`](research/zawgyi-to-unicode.md) | Why the 2.9 Zawgyi rules were replaced; the glyph table; asat placement; UTN #11 against myanmar-tools and human typing, with counts. |
| [`research/normalize.md`](research/normalize.md) | What 2.9's `normalize` did wrong; each 2.10 rule; the typing fixes; the effect on conversion; other languages; speed. |
| [`research/win-fonts.md`](research/win-fonts.md) | The Win fonts and their encoding; existing converters and their licences; where the table comes from; open questions. |
| [`scripts/eval/README.md`](scripts/eval/README.md) | The eval data, its licences, and what the benchmark measures. |

A change to a rule adds its evidence there. [CONTRIBUTING.md](CONTRIBUTING.md) has the protocol.

## Running the checks

Setup is `npm ci` in each clone or worktree; see [CONTRIBUTING.md](CONTRIBUTING.md), which also says which results a pull request reports. Every npm script, and the check of `.github/workflows/test.yml` that runs it, by the name GitHub shows (the name the rules for `main` require):

| Command | What it runs | CI check |
| --- | --- | --- |
| `npm run build` | Writes the four `dist/` files. Only a release commit runs it. | — |
| `npm test` | `node --test "test/**/*.test.js"`, then the timing test alone (`node --test "test/**/*.timing.js"`), then `tsc` on `typecheck/` with and without `esModuleInterop`, then the size check (`posttest`). The tests read the dist files from a temporary build. Among them: the tests per module; the contract matrix (`test/contract/`); a probe for every table row and one for each branch of a row's pattern (`test/tables.test.js`, probes in `test/fixtures/tables.json`, rewritten by `node scripts/testing/table-cases.js --write`); every example in README.md, this file and the JSDoc of `index.d.ts`, with their number pinned, and README's prose examples (`test/readme.test.js`); differential fuzz against the frozen 2.10 engine in `scripts/oracle/`, with the deliberate output changes made since (`scripts/oracle/index.js`); property tests; the myanmar-tools adapter; the layering test; the literal-search check (`test/unit/literal-search.test.js`, [above](#detection-breaks-and-the-unicode-to-zawgyi-rules)); the ranks and rank bits of `order` (`test/unit/mark-ranks.test.js`, [above](#ordersyllable)); the `'use strict'` directive of every library file, and none at the top of `main.js` and the script builds (`test/unit/strict.test.js`, [above](#module-map)); the browser floor checks (`test/syntax.test.js`, `test/dist-floor.test.js`, `test/regex-floor.test.js`); the Unicode version check; and the NFC helper against every code point and every pair of combining marks (`test/nfc.test.js`). The timing test, `test/growth.timing.js`, checks that time grows linearly on random structured input, on a run of every single character and on runs of marks that NFC reorders; it runs after the others so that they do not compete with it for the CPU. | Node 22, Node 24, Node 26 |
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
