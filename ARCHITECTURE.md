# Architecture

How knayi-myscript 3.0 is built, on the `next` branch: one core of ES modules under `src/`, and two APIs on it, the 3.0 API and compat, the 2.x API. This is a map of the current code. [docs/next/DESIGN.md](docs/next/DESIGN.md) is the spec it was built from, with the reasons and the measurements; a pull request that changes something described here updates this file in the same PR.

- [Entry points and builds](#entry-points-and-builds)
- [Module map](#module-map)
- [What each 2.x call does](#what-each-2x-call-does)
- [The syllable engine](#the-syllable-engine)
- [Typing fixes and their two orders](#typing-fixes-and-their-two-orders)
- [Detection, breaks and the Unicode to Zawgyi rules](#detection-breaks-and-the-unicode-to-zawgyi-rules)
- [Glossary](#glossary)
- [Stable surfaces](#stable-surfaces)
- [Quirks kept on purpose](#quirks-kept-on-purpose)
- [Where the rules are justified](#where-the-rules-are-justified)
- [Running the checks](#running-the-checks)

## Entry points and builds

The package is ES modules only (`"type": "module"`), for Node 22.12 and later, where `require` loads them too, Bun and browsers. `package.json` maps one entry to each API, each with its hand-written types first:

| Entry | Module | Types |
| --- | --- | --- |
| `knayi-myscript` | `src/index.js`: the 3.0 API | `src/index.d.ts` |
| `knayi-myscript/compat` | `src/compat/index.js`: the 2.x API, its eight exports and a non-enumerable `default` that points back at them | `src/compat/index.d.ts`, 2.x's `index.d.ts` |
| `knayi-myscript/stream` | `src/stream.js`: streaming lands here (DESIGN.md §9); it exports nothing yet | `src/stream.d.ts` |
| `knayi-myscript/package.json` | `package.json` | |

No other path of the package can be imported. `main` and `types` name the 3.0 API for tools that read no exports map. The package ships `src/` but `src/spec/`, and the three `dist/` files.

`scripts/build.js` bundles the sources with esbuild at `target: 'es2015'`, minified, for browsers:

| File | Format | Holds |
| --- | --- | --- |
| `dist/knayi-myscript.min.mjs` | ES module | the 3.0 API |
| `dist/knayi-myscript-compat.min.mjs` | ES module | the 2.x API: the named exports and the default of 2.x's `knayi-myscript.mjs` |
| `dist/knayi-myscript.min.js` | script (IIFE), `"use strict"` | sets the global `knayi`: the 3.0 API, with the 2.x API as `knayi.compat`; also sets the global when a bundler wraps the file in a module scope |

The committed `dist/` is the build of the last release, or of the release being prepared: jsDelivr serves `main`'s `dist/` to `@master` links, so it changes only in a release commit (`scripts/check-dist.js`). Everything else builds into a temporary directory: `builtDist()` in `scripts/build.js` builds once per process and removes the directory on exit, or returns `KNAYI_DIST` when that is set.

Each `dist/` file holds a copy of the code of its own. Imports of `knayi-myscript/compat` in one Node or Bun process share one module, and so one 2.x option store.

## Module map

`src/` is in layers that import only downwards (DESIGN.md §2.1, §2.2). A path names its layer, and `test/next/guards/layers.test.mjs` places every file and checks every import.

| Layer | Files | What they hold |
| --- | --- | --- |
| L0 script | `version.js`, `freeze.js`, `script/codes.js` | the package and output versions; `deepFreeze`; code points, character classes, the mark order (`MARK_GROUPS`), glyph roles and the NFC-safe set. The tables match Unicode 15.1. |
| L1 core | `core/errors.js`, `options.js`, `input.js`, `rules.js`, `nfc.js`, `edits.js` | coded errors (`libraryError`, `ERR`); option defaults; the font registry and text predicates; rule rows, their runner, traces and the stage runner; NFC in linear time; edit logs |
| L2 fonts | `fonts/zawgyi.js`, `fonts/win.js` | the Zawgyi and Win Innwa glyph tables and their sequences, data only |
| L3 engine | `engine/syllable.js`, `unicodeReader.js`, `fontReader.js` | the syllable buffer and sort, and the two one-pass readers |
| L3 rules | `rules/typingFixes.js`, `detect.js`, `segment.js`, `unicodeToZawgyi.js` | the typing fixes, the detection and break scanners, the mark collapse, and the Unicode to Zawgyi rows |
| L3 stages | `stages/normalize.js`, `stages/fonts.js` | the normalize and font pipelines as stage lists, the only files that import both the engine and the rules |
| L4 public | `index.js` and `api/`, `stream.js`; `compat/` | the 3.0 API; the 2.x API |
| spec | `spec/` | the detector signatures, break rules and typo rows as readable tables: the oracle the scanners are tested against; nothing in `src/` imports them |

The 3.0 API and compat import neither each other nor each other's files. compat reproduces 2.x's public layer in `compat/`: its input checks and font names (`input.js`), the rule-table lookups and accidental TypeErrors of 2.x (`legacy.js`), the option store and the console (`globalOptions.js`), myanmar-tools loading (`zawgyiModel.js`), and one file per group of functions (`fontDetect.js`, `fontConvert.js`, `text.js`).

`scripts/oracle/` holds the 2.x library at the reference, commit `e5f6e24` (the `main.js` of 2.10.0): the 13 files of `library/`, byte for byte, and its `main.js` with its requires pointed at them. It is not shipped. The tests compare the core's modules and compat with it, the contract matrix records its cells from it, and a port of the 2.x line moves it to the new reference (DESIGN.md §8).

### Module state

The core holds no options and writes nothing to the console (DESIGN.md §4): every option is an argument, myanmar-tools' detector is passed in as an object, and `test/next/guards/stateless.test.mjs` checks every top-level value. What the modules keep:

- `core/nfc.js`: `NFC_MEMO`, facts about the runtime's Unicode data (which code points start or continue a run of non-starters, their decompositions and combining classes), never a result of a call.
- The readers' scratch buffers (`engine/unicodeReader.js`, `engine/fontReader.js`), which a call resets and gives back when they grow past 65,536 units.
- Three regexes of `rules/typingFixes.js` driven by `exec` loops, each left with `lastIndex` 0.
- compat only: the 2.x option store (`compat/globalOptions.js`: `silent_mode` and the detector options) and the myanmar-tools loader (`compat/zawgyiModel.js`: the loaded model, the load error, and whether the "not installed" warning was printed).

compat's console output: missing content warns (`console.warn`), conversion errors use `console.error`, and both are silenced by `silent_mode`. One message ignores silent mode: the threshold error of the detector options. Nothing else in `src/` writes to the console.

## What each 2.x call does

compat gives 2.x's output on every input. The core does the work; compat adds 2.x's preamble. Every function starts the same way, with small differences (`compat/input.js`): `unboxString` unwraps `String` objects, and `enter` treats `null`, `undefined`, `''`, `0`, `false` and `NaN` as missing: the function warns (unless silent) and returns `''`, or the fallback or `'en'` for `fontDetect`. `truncate` does not count `''` as missing. Other non-strings are returned unchanged; `fontDetect` returns the fallback or `'en'` for them, and `truncate` turns them into strings. `hasMyanmarBlockChar` tests for a character in U+1000–U+109F.

### fontConvert(content, to, from)

1. Missing content: `''`. A non-string: returned. No Myanmar character and a source other than `win`: returned unchanged. No target: an error, and the text is returned.
2. The text is trimmed. `to` and `from` go through the aliases (`resolveFont`). An unknown target is an error. An unknown or missing source is detected as `fontDetect(text)` would, whose tie result is `'zawgyi'`.
3. Same source and target: the trimmed text.
4. A Win target, or a Win source with a target other than Unicode: an error, and the text is returned.
5. Zawgyi or Win to Unicode: the font pipeline, `fontToUnicode(text, font)` (`stages/fonts.js`).
6. Unicode to Zawgyi: `unicodeToZawgyi(text)` (`rules/unicodeToZawgyi.js`): the collapse of repeated Unicode marks, then the rule rows.

`fontConvert.debugging` calls `fontConvert` with `this` set to `{ debug: true }`, and the debug flag is read from `this`. The traced pipelines (`traceFontToUnicode`, `traceUnicodeToZawgyi`) record what 2.x's debug output lists.

### The font pipeline: stages/fonts.js

| Stage name | What it does |
| --- | --- |
| `sequences` | The font's look-alike sequences, as regex replacements. Zawgyi: two lagaung rules. Win: `aMomf`, `Mo`, `ps`, `OD`. |
| `glyphs` | Traced only: each glyph's Unicode text, still in typed order. |
| `syllables` | `readFont`: the font reader. |
| `zero as wa` | `zeroAsWa`: a zero that is not part of a number becomes wa. |
| `look-alikes` | `fixLookAlikes`. |
| `typos` | `fixTypos`. |
| `NFC` | `toNfc`, which runs only when the reader wrote a unit NFC may change. |

With `debug`, `fontConvert` returns `{ to, from, matched_patterns, steps }`: `matched_patterns` names each stage that changed the text, in order, and `steps` holds the input followed by the text after each of those stages. The README documents these stage names.

### normalize(content)

After the input checks there is no Myanmar test. Every string goes through `NORMALIZE_STAGES` (`stages/normalize.js`):

```
NFC → reorderUnicode → fixTypos → fixLookAlikes → NFC
```

So text with no Myanmar characters still comes back in NFC. The first NFC is there because it can move a dot below in front of an asat or virama, which changes what they attach to. The 3.0 `normalize` runs `STABLE_NORMALIZE_STAGES` instead, again on each region the first pass changed, until nothing changes (DESIGN.md §11.2).

### fontDetect(content, fallback, options)

1. Missing content, or no Myanmar character: the fallback, or `'en'`.
2. `cleanText`: trim, and remove U+200B and U+200C.
3. The fallback defaults to `'zawgyi'`.
4. `mergeDetectorOptions(options)` merges the call's options with the stored ones. An explicit `adapter` (`'rules'` or `'myanmartools'`) wins; otherwise `use_myanmartools` picks myanmar-tools.
5. **Rules:** `countEvidence` (`rules/detect.js`) counts the matches of the 29 signatures (12 Unicode, 17 Zawgyi) in one pass, as 2.x's `String#match` of each signature counted them; `decide` gives the side with more, and a tie gives the fallback.
6. **myanmar-tools:** loaded on first use, from the working directory (`process.getBuiltinModule('module').createRequire(process.cwd() + '/package.json')`), in Node and Bun only. A probability below the first threshold is `'unicode'`, above the second `'zawgyi'`, and in between the fallback. If the package cannot be loaded, the call uses the rules and warns once.

`fontDetect` never returns `'win'`.

### syllBreak, spellingFix and truncate

All three resolve the font the same way (`chooseFontLegacy`): no font name means detection; otherwise `resolveFont(name) || name`, so an unknown name is passed on as it is, and looked up in 2.x's rule tables as 2.x did (`compat/legacy.js`).

- **syllBreak:** no Myanmar character returns the text unchanged. Otherwise `cleanText`, then `breakString(text, font, separator)` (`rules/segment.js`): one pass of the font's break scanner, which gives the breaks of 2.x's `BREAK_RULES` (7 rows for Unicode, 8 for Zawgyi), with bare consonants joined in pairs and no break at the start. The separator is U+200B by default.
- **spellingFix:** detects the font on the raw text, then cleans it and runs `collapseRepeatedMarks(text, font)`: each run of one repeated mark of the font's set becomes one mark.
- **truncate:** `length` defaults to 30 and `omission` to `'...'`, and the budget is `length - omission.length`. Text with no Myanmar character is cut with `substr`. Otherwise the text is broken into parts (`breakParts`) and parts are added while they fit; a part that does not fit is split on whitespace and the words that fit are added. The result is trimmed and the omission appended.

## The syllable engine

Zawgyi and Win store text in drawing order, and Unicode in storage order (see the [glossary](#glossary)). The engine reads text one syllable at a time and writes each syllable in the storage order of Unicode Technical Note #11. It has three parts: a sort for one syllable (`orderSyllable`, `engine/syllable.js`), and two readers that cut text into syllables and call it, `readFont` for the fonts (`engine/fontReader.js`) and `reorderUnicode` for `normalize` (`engine/unicodeReader.js`). Both read the text once, by UTF-16 code unit, keep their state in a reused `SyllableBuffer`, and copy through what they do not change.

### orderSyllable

A syllable is a `SyllableBuffer`: its kinzi, base, stack, marks in typed order (starting with any e or medial ra that waited for this base), a bit mask of the marks it has, and the characters held after it. `orderSyllable` writes `kinzi + base + stack + (asat on the consonant) + sorted marks`:

1. **Duplicates:** a mark typed twice counts once.
2. **Asat** (`placeAsat`):
   - **Dropped as a slip** with i or ii, or on a stacked consonant without a dot below, unless the syllable has aa.
   - **Stored last** when typed after e or aa, with a dot below, or with aa and no medial.
   - **Otherwise it sits on the consonant:** right after the base and stack, or after the medials when there is a medial ha.
3. **Letters the fonts draw alike** (`fixLookAlikeLetters`):
   - stacked ca with medial ya is stacked jha, and ca with medial ya is jha;
   - u (U+1025) with a stacked consonant, asat or aa is nya (U+1009), unless `keepU`;
   - seven (U+1047) with any mark but visarga is ra.
4. **Ranks** (`rankMarks`) come from `MARK_GROUPS` (`script/codes.js`): medial ya, ra, wa, ha; e; i and ii; u and uu; aa and tall aa; ai and anusvara; dot below; asat; visarga. A mark outside the table sorts last. Ai or anusvara typed before aa, with no lower vowel, keeps its place before the aa, except anusvara before tall aa.
5. **Sort** (`sortByRank`): stable, so marks of the same rank keep their typed order.

A syllable that the sort would write as it was typed (`writesAsTyped`) is copied through without being written again.

### The two readers

Both readers share these rules:

- A base starts a syllable. Marks join the open syllable.
- e and medial ra that belong to the next base wait as pending marks and become the first marks of that base's syllable.
- **Held characters.** A space (U+0020, U+00A0) or zero-width character after an open syllable is held. If a mark of the syllable follows, the syllable goes on: the spaces are dropped, since they only moved the mark, and the zero-width characters end up after the syllable. Otherwise everything held is written as typed.
- Text that ends a syllable closes it, writes any pending e or medial ra unattached, then the text.

**`readFont(text, font)`, the font reader**, is driven by the glyph table, compiled once at load by `compileFont`. Each code unit has a role (`ROLE` in `script/codes.js`):

| Role | Meaning | Reader action |
| --- | --- | --- |
| `BASE` | consonant, independent vowel, digit or symbol | closes the open syllable and starts a new one |
| `BEFORE_BASE` | e or medial ra, drawn before the consonant | closes the open syllable; its marks wait for the next base |
| `MARK` | medial, vowel sign, tone or asat | joins the open syllable |
| `STACK` | stacked consonant, drawn under the base | joins the open syllable as its stack |
| `KINZI` | kinzi, drawn over the base | joins the open syllable and is written before the base |
| `PLAIN` | anything else | ends the syllable; its Unicode text is written |

A code unit with no entry ends the syllable and is written as it is. A mark, stack or kinzi with no open syllable is written as its Unicode text, unattached. `compileFont` checks the table when it loads, and adds every syllable base in U+1000–U+104F that the table leaves out as a base of itself.

**`reorderUnicode(text)`, the Unicode reader**, reads Unicode's logical order. Kinzi (nga or ra, asat, virama) before a consonant starts that consonant's syllable. A letter or digit starts a syllable. Virama plus consonant is a stacked consonant. The Burmese marks join the open syllable. Two Zawgyi typing habits are undone:

- **e or medial ra typed before its consonant.** `placePrebaseMark` decides where each one goes: to the open syllable (`TO_OPEN_SYLLABLE`), to the consonant after it (`TO_NEXT_BASE`), or nowhere (`STAYS`). It goes to the open syllable unless that syllable is finished (it has a vowel or a final) and no mark of it follows. Right after a letter or mark of another Myanmar-script language it stays where it is.
- **A space typed before a mark** is dropped, as in the font reader.

Letters and marks of Mon, Shan, Karen and the other languages are not read here: they end the syllable and stay where they are.

### The four deliberate differences between the readers

The readers share `orderSyllable` and the held-character logic, but differ on purpose in four places. Each is a named field of the reader's frozen options, `FONT_READING` and `UNICODE_READING`, read at the one place that decides it (DESIGN.md §3.5).

| | Font reader (`readFont`) | Unicode reader (`reorderUnicode`) |
| --- | --- | --- |
| **Which zero-width characters are held** (`heldZeroWidth`) | All five: U+200B, U+200C, U+200D, U+2060 and U+FEFF. | U+200B, U+2060 and U+FEFF. ZWNJ (U+200C) and ZWJ (U+200D) stay exactly where they were typed, since in Unicode they can shape the syllable on purpose. |
| **A digit and a mark across a space** (`digitTakesMarksAcrossSpace`) | A mark after a held space joins any base, digits included. | A digit takes no mark from across a space. A letter still does. |
| **e or medial ra before a zero-width character** (`prebaseCrossesZeroWidth`) | With no open syllable, a zero-width character is written at once and the pending e or medial ra go on to the next base, crossing it. | An e or medial ra never crosses a zero-width character to reach the next base: `placePrebaseMark` only looks at the character right after the run of e and medial ra. |
| **u after a vowel sign** (`keepUAfterVowelSign`) | Never kept: u with asat, aa or a stacked consonant is always nya. Zawgyi and Win text is Burmese. | Kept for u right after a vowel sign (U+102B–U+1032, U+1036), where Pa'o writes u with asat and visarga as a syllable of its own. |

```javascript
compat.fontConvert('က\u200Cာ', 'unicode', 'zawgyi') // 'ကာ\u200C'
compat.normalize('က\u200Cာ') // 'က\u200Cာ'
compat.fontConvert('၁ ာ', 'unicode', 'zawgyi') // '၁ာ'
compat.normalize('၁ ာ') // '၁ ာ'
compat.normalize('က ာ') // 'ကာ'
compat.fontConvert('ေ\u200Bက', 'unicode', 'zawgyi') // '\u200Bကေ'
compat.normalize('ေ\u200Bက') // 'ေ\u200Bက'
compat.fontConvert('လဲဥ္း', 'unicode', 'zawgyi') // 'လဲဉ်း'
compat.normalize('လဲဥ်း') // 'လဲဥ်း'
```

One more difference follows from the encodings, not from a choice: in the fonts, e and medial ra always belong to the next base, while in Unicode they may also belong to the syllable before (`TO_OPEN_SYLLABLE`). That is why the converters write an e or medial ra with no base after it where it was typed, and `normalize` can move it into the syllable before. On the 10,166 distinct mC4 lines that `fontDetect` calls Zawgyi, `normalize` changes the converted output of 31, each with an e or medial ra where the two first differ.

## Typing fixes and their two orders

`rules/typingFixes.js` holds the fixes both pipelines use:

- **`fixLookAlikes`:** zero and seven are typed for wa and ra, and the other way round. A zero or seven that carries a mark, or starts a closed syllable, is a letter; a zero inside a word with no digit next to it is a letter too. A bare wa or ra inside a run of digits is a digit. The marks and consonants here cover every language in the Myanmar blocks, so Shan and Karen text gets the same reading (#43).
- **`fixTypos`:** four rules, in order: i with ii is ii; u with uu is uu; o with e, aa and asat is au; the digit four before nga, asat and visarga is lagaung. `spec/typoRows.js` documents them.

The two pipelines run them in opposite orders, as 2.x did (DESIGN.md §10 Q8):

| Pipeline | Order |
| --- | --- |
| Zawgyi and Win (`FONT_STAGES`, `stages/fonts.js`) | `zero as wa` → `look-alikes` → `typos` → `NFC` |
| `normalize` (`NORMALIZE_STAGES`, `stages/normalize.js`) | `NFC` → syllables → `typos` → `look-alikes` → `NFC` |

On the eval corpora the order makes no difference: the two orders give the same result on every Unicode line read by the Unicode reader (FLORES-200, the Wikipedia sample, Okell, mC4, and the GlotCC Shan, Mon, S'gaw Karen and Pa'o sets) and on every mC4 line converted from Zawgyi. Synthetic input shows the difference, for example a ra before the digit four of a lagaung:

```javascript
compat.fontConvert('&4if;', 'unicode', 'win') // '၇၄င်း'
compat.normalize('ရ၄င်း') // 'ရ၎င်း'
```

The font pipeline reads the ra next to a digit as seven first, so the four no longer follows a non-digit and stays a digit. `normalize` fixes the lagaung first. The debug stage order is part of the 2.x API (see [Stable surfaces](#stable-surfaces)), so changing either order is a deliberate output change.

The fonts also have a stage `normalize` does not: `zeroAsWa`. Its idea of a zero in a number (a Burmese digit or one of `+ - * /` next to it, or a digit across `.` or `,`) differs from `fixLookAlikes`' (Burmese, Shan or Tai Laing digits, and `.` or `,`, but no arithmetic signs), as 2.x's did (DESIGN.md §10 Q20).

## Detection, breaks and the Unicode to Zawgyi rules

2.x applied these as regex tables, one pass per pattern. The core reads each in one pass of char codes where it can, and keeps 2.x's tables as readable oracles in `spec/`:

- **Detection** (`rules/detect.js`): `countEvidence` scans the text once for the 29 signatures of `spec/detectorSignatures.js` (12 Unicode, 17 Zawgyi) and counts them as 2.x's patterns counted; `decide` compares the counts; `scoreByZawgyiModel` and `decideByProbability` read an injected myanmar-tools model.
- **Breaks** (`rules/segment.js`): one scanner per font finds the breaks that the rows of `spec/breakRules.js` (2.x's `BREAK_RULES`, 7 for Unicode and 8 for Zawgyi) made. Bare consonants follow a policy (`BARE_CONSONANTS`): `pairs` as 2.x, `chains`, or `separate`, the 3.0 API's default. `segmentSyllables` and `syllableBoundaries` keep every character.
- **Mark collapse** (`rules/segment.js`, `collapseRepeatedMarks`): one pass, with a set of repeated marks per font.
- **Unicode to Zawgyi** (`rules/unicodeToZawgyi.js`): 2.x's 57 rules applied once in order, then its 8 rules repeated while they match (at most 40 times), as rule rows with stable ids. 38 of the rows that replace one fixed text with one glyph are read from the Zawgyi glyph table backwards; the glyph rows run as one pass where that equals running them in order. A row whose units the text lacks is skipped. Traced, the rows run one by one, and the trace holds 2.x's labels: the regex `.source` of each rule that changed the text, or that matched for a repeated rule.

## Glossary

- **Storage order (logical order):** the order Unicode stores a syllable in, from UTN #11: kinzi, consonant, stacked consonant, an asat that sits on the consonant, medials, e, vowels, anusvara, dot below, asat, visarga. `orderSyllable` writes this order.
- **Drawing order (visual order):** the order a font draws glyphs from left to right, which Zawgyi and Win store. e and medial ra come before the consonant, kinzi and stacked consonants after it, and the other marks in any order.
- **Prebase:** a mark drawn before its consonant: e (U+1031) and medial ra (U+103C; in Zawgyi U+103B and U+107E–U+1084). The font tables give them the role `BEFORE_BASE`; the Unicode reader places them with `placePrebaseMark`.
- **Base:** what starts a syllable: a consonant, independent vowel, digit or symbol.
- **Stacked consonant:** a consonant written under another, stored as virama (U+1039) plus consonant. Zawgyi draws them as separate glyphs after the base (role `STACK`), and has a few two-consonant ligatures that are bases.
- **Kinzi:** nga, asat and virama (U+1004 U+103A U+1039), stored before the consonant it is drawn over. Zawgyi draws it with U+1064, or U+108B–U+108D together with i, ii or anusvara, typed after that consonant. The Unicode reader also reads ra, asat and virama as kinzi.
- **Held space:** a space or zero-width character after an open syllable, held until the next character shows whether the syllable goes on.
- **Pending:** e or medial ra waiting for the base that comes after it.
- **Slip:** an asat that `orderSyllable` drops, because it was typed early for the next consonant's asat.
- **Look-alikes:** zero (U+1040) and wa (U+101D), and seven (U+1047) and ra (U+101B), typed for each other.
- **Tie:** equal evidence for Unicode and Zawgyi. 2.x's `fontDetect` returns the fallback, `'zawgyi'` when none is given; the 3.0 `detectEncoding` says `'unknown'`, and `toUnicode` leaves the line as it is. Short Unicode text, such as one consonant or a word whose only sign is a stacked consonant, ties often.
- **Silent mode:** compat's `setGlobalOptions({ silent_mode: true })`, which hides the warnings and errors (all but one, see [Module state](#module-state)).
- **Output version:** `OUTPUT_VERSION`, which goes up with every deliberate change to what any function returns: 1 for 2.10.0's output, which compat keeps, and 2 since the 3.0 `normalize` settles.

## Stable surfaces

These are the public surfaces of 3.0. Changing them needs a major version, or for an output a deliberate pull request that raises `OUTPUT_VERSION`.

| Surface | Where it is defined or relied on |
| --- | --- |
| The entries of the exports map and what each exports | `package.json`, `src/index.js`, `src/compat/index.js`, `src/stream.js`; `test/package.test.js`, which checks that each entry's types declare exactly what it exports |
| The types | `src/index.d.ts`, `src/compat/index.d.ts`, `src/stream.d.ts`; `typecheck/` and `scripts/check-types.mjs` compile code against them, the last from the packed tarball |
| The error codes | `ERR_KNAYI_INVALID_ARG_TYPE` and `ERR_KNAYI_INVALID_ARG_VALUE` (`src/core/errors.js`) |
| The output, and `OUTPUT_VERSION` | `src/version.js`; compare (`npm run compare`) and the tests of each module |
| The stage and rule ids of traces | the stage lists of `stages/`, the rule rows of `rules/unicodeToZawgyi.js` |
| The dist file names and the `knayi` global | `scripts/build.js`; `test/browser.test.js`, `test/compat.test.js` |
| The minimum Node, 22.12, and the browser floor | `package.json` `engines`; README, read by `scripts/browser/floor.js` |
| The 2.x API in `knayi-myscript/compat`: its exports and their shapes, the option keys, the debug stage names and their order, and the regex-source labels in `matched_patterns` | `src/compat/`; the contract matrix (`test/contract/`), compare against the reference, and `test/next/compat-*.test.mjs` |

## Quirks kept on purpose

compat keeps 2.x's output on every input, so the core keeps 2.x's quirks where compat's output depends on them. DESIGN.md §10 lists each, with its size, where the code keeps it and the fix planned for it, and the code cites them as `DESIGN.md §10 Q11`. compat also keeps these behaviours of 2.x's public layer:

- **`fontConvert.debugging`** returns what `fontConvert` returns, not an object, on every early exit: missing or non-string content, no Myanmar text, a missing or unknown target, the same source and target, or a Win direction knayi does not convert.
- **The debug flag is read from `this`.** compat and its builds are strict code, so a detached call such as `const f = compat.fontConvert; f(...)` never reads a global `debug`, as 2.x's ES module build did not (2.x's `main.js` and script builds did).
- **Font names in `syllBreak`, `truncate` and `spellingFix`:** an unknown name, or `'win'`, reaches 2.x's rule tables as it is. `syllBreak` and `truncate` throw a `TypeError` for most of them; a few names of `Object.prototype` properties, such as `'toString'`, return the text with no breaks instead. `spellingFix` uses the Unicode marks for an unknown name, but throws on some `Object.prototype` names such as `'constructor'`. `fontConvert` detects the source instead of an unknown source name.
- **`truncate` throws on an object that `String()` cannot convert,** such as `Object.create(null)` or `{ toString: undefined }`: it turns non-strings into strings with `String(content)`, where the other functions return them unchanged. `test/properties.test.js` pins the `TypeError`.
- **Only U+1000–U+109F counts as Myanmar** for compat's input checks. The extended blocks (U+A9E0–U+A9FF, U+AA60–U+AA7F) are read by the typing fixes and by the Unicode reader, but `fontDetect`, `fontConvert`, `syllBreak`, `spellingFix` and `truncate` treat text made only of them as having no Myanmar character. Myanmar Extended-C (U+116D0–U+116E3) is not read anywhere yet (decision 20b). The tables match Unicode 15.1, apart from the classes `test/next/unicode.test.mjs` lists, and that test fails when the runtime knows Myanmar code points they miss.

## Where the rules are justified

The rules in the engine, the typing fixes and the glyph tables have a comment next to them in the code, citing UTN #11 or a research note; the readable tables of `src/spec/` say why each detector signature and break rule is there. The evidence, the counts on real text and the choices between sources are in `research/`:

| Note | Covers |
| --- | --- |
| [`research/zawgyi-to-unicode.md`](research/zawgyi-to-unicode.md) | Why the 2.9 Zawgyi rules were replaced; the glyph table; asat placement; UTN #11 against myanmar-tools and human typing, with counts. |
| [`research/normalize.md`](research/normalize.md) | What 2.9's `normalize` did wrong; each 2.10 rule; the typing fixes; the effect on conversion; other languages; speed. |
| [`research/win-fonts.md`](research/win-fonts.md) | The Win fonts and their encoding; existing converters and their licences; where the table comes from; open questions. |
| [`scripts/eval/README.md`](scripts/eval/README.md) | The eval data, its licences, and what the benchmark measures. |
| [`docs/next/DESIGN.md`](docs/next/DESIGN.md) | The 3.0 core and API: the data structures, the readers, the gates, the 3.0 API's choices and the measurements behind them. |

A change to a rule adds its evidence there. [CONTRIBUTING.md](CONTRIBUTING.md) has the protocol.

## Running the checks

Setup is `npm ci` in each clone or worktree; see [CONTRIBUTING.md](CONTRIBUTING.md), which also says which results a pull request reports. Every npm script, and the check of `.github/workflows/test.yml` that runs it, by the name GitHub shows (the name the rules for the default branch require):

| Command | What it runs | CI check |
| --- | --- | --- |
| `npm run build` | Writes the three `dist/` files. Only a release commit runs it. | — |
| `npm test` | `node --test` on `test/**/*.test.js` and `test/**/*.test.mjs`, then the timing tests alone (`*.timing.js`, `*.timing.mjs`), then `tsc` on `typecheck/` (the 2.x types with and without `esModuleInterop`, and the 3.0 API's), then the dist size budgets (`posttest`). The tests read the dist files from a temporary build. Among them: the 2.x tests against compat; the tests of each module of the core and of the 3.0 API, and the guards of `test/next/guards/` (layers, the stateless core, tree-shaking, the ES2015 floor of `src/`, function sizes, error codes, citations and the frozen oracle); the package and its exports map; the contract matrix (`test/contract/`); a probe for every table row (`test/tables.test.js`); every example in README.md and this file, with their number pinned, and README's prose examples (`test/readme.test.js`); differential fuzz against the frozen 2.10 engine in `scripts/oracle/`; property tests; the browser floor checks of the builds (`test/syntax.test.js`, `test/dist-floor.test.js`, `test/regex-floor.test.js`); and the Unicode version check. The timing tests check that time grows linearly on adversarial and random structured input; they run after the others so that they do not compete with them for the CPU. | Node 22.12, Node 24, Node 26 |
| `npm run test:bun` | `scripts/bun-contract.js`, `scripts/bun-esm.mjs` and `scripts/bun-matrix.js` (the contract matrix in a process of its own), then `bun test ./test` and the timing tests. | Bun |
| `npm run test:pack` | Packs the package with a fresh build (`scripts/pack-fresh.mjs`), installs it with Bun in a temporary app, and loads each entry of the exports map through `require` and `import`. | Bun |
| `npm run test:fuzz` | The fuzz and property tests alone. `KNAYI_FUZZ_SEED` and `KNAYI_FUZZ_SCALE` set the seed and size; `KNAYI_GROWTH_SEED` and `KNAYI_GROWTH_RUNS` do the same for `test/growth.timing.js`. `npm run test:fuzz:next` runs those of `test/next/` only. | fuzz, nightly (`fuzz.yml`) |
| `npm run test:browser` | Playwright: the script and module builds in Chromium, Firefox and WebKit against the sources in Node, and axe on the demo and benchmark pages. Install the browsers once with `npx playwright install chromium firefox webkit`. | Browsers |
| `npm run check:size` | The gzip size of each `dist/` file (Node's zlib, level 9) against its budget, with each module's share. `npm test` runs it without the breakdown. `node scripts/next/size.mjs` measures an import of each entry of the exports map and of `normalize` alone against theirs, and checks that a normalize-only import leaves the other modules out. | ReDoS, types and size |
| `npm run check:dist -- --base <rev>` | Fails when `dist/` differs from `<rev>` without a version change; with a version change, or with `--fresh`, checks that `dist/` equals a fresh build; otherwise checks that `dist/` equals the `dist/` of the last release (the tag `v<version>`, or the commit that set the version while there is no tag; `--release <rev>` names another). The CI job also checks that the hashes in `.git-blame-ignore-revs` are in the history. | dist only in releases |
| `npm run check:redos` | Every regex `src/` ships, as literals, built at run time or exported, through recheck. The allowlist is `scripts/redos-allowlist.json`. | ReDoS, types and size |
| `npm run check:types` | Packs the package, then compiles `typecheck/packed/` against it under node16, node20, nodenext and bundler resolution, runs the output, and runs @arethetypeswrong/cli on every entry of the exports map. | ReDoS, types and size |
| `npm run matrix:update` | Rewrites `test/contract/api-matrix.json` from `scripts/oracle/main.js`, after a port moves the 2.x reference, and refuses build differences that `scripts/contract/matrix.js` does not explain. | — |
| `npm run compare -- --base <ref>` | Two copies of knayi's 2.x API on every call form, including `fontConvert.debugging`, over every cached corpus, generated input and seeded fuzz; lists the differences. A 3.0 copy is its compat. `--expect form:set=n` declares the differences a deliberate change expects, `--offline` uses no corpus, and `--head min:.` or `mjs:.` compares compat with the builds that hold it. `--base e5f6e24fa756f8f9c8d790f9a15ede85b135e8ae --head mjs:src/compat/index.js` compares compat with the 2.x reference. | Compare, Compat (Node and Bun) |
| `npm run perf -- --base <ref>` | Two copies timed interleaved in one process, under Node and Bun: ratios per line, per word, on one string and on one document, and growth exponents on adversarial inputs (`--offline`: growth only). | Perf |
| `npm run eval` | Accuracy on public data, next to a published knayi release, myanmar-tools and Rabbit. | — |
| `npm run bench` | Speed on real text and long input; `-- --sweep` adds 1,059 long inputs. | — |
| `npm run bench:page` | Both, then rebuilds `docs/benchmark.html` and `docs/benchmark.json`. Run it for a release. | — |

Other commands: `node scripts/eval/datasets.mjs --check`, `--fetch` or `--refresh-samples` checks, fills or redraws the corpus cache; `node scripts/browser/floor.js` prints the floor rules and what each build uses; `node scripts/eval/win-glyphs.mjs <font>` draws every Win table entry next to its Unicode text, with your own copy of the font. [scripts/eval/README.md](scripts/eval/README.md) covers the corpora, compare and perf in detail.
