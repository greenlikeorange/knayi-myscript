# Architecture

How knayi-myscript 3.0 is built, on the `next` branch: one core of ES modules under `src/`, and two APIs on it, the 3.0 API and compat, the 2.x API. This is a map of the current code. [docs/next/DESIGN.md](docs/next/DESIGN.md) is the spec it was built from, with the reasons and the measurements; a pull request that changes something described here updates this file in the same PR.

- [Entry points and builds](#entry-points-and-builds)
- [Module map](#module-map)
- [What each 3.0 call does](#what-each-30-call-does)
- [What each 2.x call does](#what-each-2x-call-does)
- [The syllable engine](#the-syllable-engine)
- [Typing fixes and their order](#typing-fixes-and-their-order)
- [Detection, breaks and the Unicode to Zawgyi rules](#detection-breaks-and-the-unicode-to-zawgyi-rules)
- [Edit logs](#edit-logs)
- [Streams and the command line](#streams-and-the-command-line)
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
| `knayi-myscript/stream` | `src/stream.js`: the streams of the 3.0 API, `createNormalizer`, `createConverter`, `lineTransform` and `mapLines` (see [Streams and the command line](#streams-and-the-command-line)) | `src/stream.d.ts` |
| `knayi-myscript/compat` | `src/compat/index.js`: the 2.x API, its nine exports and a non-enumerable `default` that points back at them | `src/compat/index.d.ts`, 2.x's `index.d.ts` |
| `knayi-myscript/package.json` | `package.json` | |

No other path of the package can be imported. `main` and `types` name the 3.0 API for tools that read no exports map. `bin` maps the `knayi` command to `bin/knayi.js`. The package ships `bin/`, `src/` but `src/spec/`, and the four `dist/` files.

`scripts/build.js` bundles the sources with esbuild at `target: 'es2015'`, minified, for browsers; `unpkg` and `jsdelivr` in `package.json` serve `knayi.min.js` to a CDN link that names no file:

| File | Format | Holds |
| --- | --- | --- |
| `dist/knayi-myscript.min.mjs` | ES module | the 3.0 API |
| `dist/knayi-myscript-compat.min.mjs` | ES module | the 2.x API: the named exports and the default of 2.x's `knayi-myscript.mjs` |
| `dist/knayi.min.js` | script (IIFE in a strict function) | sets the global `knayi`: the 3.0 API, with the 2.x API as `knayi.compat`; also sets the global when a bundler wraps the file in a module scope |
| `dist/knayi-myscript.min.js` | script (IIFE in a strict function) | sets the global `knayi` to the 2.x API, as 2.x's file of that name did, for pages that load it from `@master` or an unversioned CDN link |

The builds hold no streams. The committed `dist/` is the build of the last release, or of the release being prepared: jsDelivr serves `main`'s `dist/` to `@master` links, so it changes only in a release commit (`scripts/check-dist.js`). Everything else builds into a temporary directory: `builtDist()` in `scripts/build.js` builds once per process and removes the directory on exit, or returns `KNAYI_DIST` when that is set.

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
| L4 public | `index.js` and `api/`, `stream.js`; `compat/` | the 3.0 API and its streams; the 2.x API |
| spec | `spec/` | the detector signatures, break rules and typo rows as readable tables: the oracle the scanners are tested against; nothing in `src/` imports them |

The 3.0 API and compat import neither each other nor each other's files. compat reproduces 2.x's public layer in `compat/`: its input checks and font names (`input.js`), the `syllBreak` separator and the 2.x shape of the Win tables (`legacy.js`), the option store and the console (`globalOptions.js`), myanmar-tools loading (`zawgyiModel.js`), and one file per group of functions (`fontDetect.js`, `fontConvert.js`, `text.js`).

Two copies of 2.x's library sit in `scripts/`, and neither is shipped:

- `scripts/oracle/` is the frozen 2.10 engine: the 13 files of `library/` at commit `e5f6e24` (the `main.js` of 2.10.0), byte for byte, and its `main.js` with its requires pointed at them. The core's module tests compare with it, and the 2.x line's deliberate output changes are made to its results in `scripts/oracle/index.js`, so the copies never change.
- `scripts/reference/` is the 2.x reference: `main.js` and `library/` of the 2.x line at commit `8923365`, which v2.11.0 will be, byte for byte. compat's tests compare with it, and the contract matrix records its cells from it; `npm run compare` reads the same commit from git. A port of the 2.x line moves it to the new reference (DESIGN.md §8), and `test/next/guards/reference.test.mjs` checks every file against the blob ids of the commit.

### Module state

The core holds no options and writes nothing to the console (DESIGN.md §4): every option is an argument, myanmar-tools' detector is passed in as an object, and `test/next/guards/stateless.test.mjs` checks every top-level value of every file outside `compat/` and `spec/`. What the modules keep:

- `core/nfc.js`: `NFC_MEMO`, facts about the runtime's Unicode data (which code points start or continue a run of non-starters, their decompositions and combining classes), never a result of a call.
- The readers' scratch buffers (`engine/unicodeReader.js`, `engine/fontReader.js`), which a call resets and gives back when they grow past 65,536 units.
- Three regexes of `rules/typingFixes.js` driven by `exec` loops, each left with `lastIndex` 0.
- compat only: the 2.x option store (`compat/globalOptions.js`: `silent_mode` and the detector options, a `zawgyiDetector` among them) and whether the warning for a myanmar-tools adapter with no detector has printed (`compat/zawgyiModel.js`).

A stream's state lives in its own `LineMapper` object, made per call (`api/lines.js`), and no stream keeps anything at module level.

compat's console output: missing content warns (`console.warn`), conversion errors use `console.error`, and both are silenced by `silent_mode`. Since 2.11 silent mode silences every message, the threshold and detector errors of the detector options included, which start with a code (`[ERR_KNAYI_INVALID_THRESHOLD]`, `[ERR_KNAYI_INVALID_DETECTOR]`). Nothing else in `src/` writes to the console.

## What each 3.0 call does

`src/index.js` re-exports the functions of `src/api/`, one file per group, with `VERSION`, `OUTPUT_VERSION` (`src/version.js`) and `createTrace` (`core/rules.js`). Every function starts the same way, in `api/args.js`: `requireString` refuses a text that is not a string; `readOptions` takes an object, or `NO_OPTIONS` for `undefined`, `null` or a number (the index `Array#map` passes), and refuses an own key that is not one of the function's options, naming the option meant; and one reader per option (`readChoice`, `readFlag`, `readCount`, `readLimit`, `readText`, `readTrace`, `readZawgyiDetector`, `readThresholds`) gives its value, its default for `undefined` or `null`, or a coded error. Each error is `libraryError(code, 'knayi.<function>: ...', TypeError or RangeError)`. The options are read once, and nothing is kept.

| File | Exports | What it runs in the core |
| --- | --- | --- |
| `api/normalize.js` | `normalize`, `isNormalized` | `normalizeTextStable`, `traceNormalizeTextStable` and `normalizeTextStableLogged` (`stages/normalize.js`) |
| `api/explain.js` | `explain` | `STABLE_NORMALIZE_STAGES` and their logged runs, `composeEdits`; `fontToUnicode` for a Zawgyi line |
| `api/encoding.js` | `detectEncoding`, and `readDetector` and `encodingOf` for the others | `detectEncoding` and `decideByProbability` (`rules/detect.js`) |
| `api/convert.js` | `toUnicode`, `toZawgyi`, and `readUnicodeReading` and `convertToUnicode` for `createConverter` | `fontToUnicode`, `fontToUnicodeLogged` and `traceFontToUnicode` (`stages/fonts.js`); `unicodeToZawgyi` and `traceUnicodeToZawgyi` (`rules/unicodeToZawgyi.js`) |
| `api/segment.js` | `segmentSyllables`, `syllableBoundaries`, `truncate`, `collapseRepeatedMarks` | `segmentSyllables`, `syllableBoundaries`, `forEachBreak` and `collapseRepeatedMarks` (`rules/segment.js`) |
| `api/lines.js`, `api/stream.js` | `mapLines`; `lineTransform`, `createNormalizer`, `createConverter` (through `src/stream.js`) | `normalize` and `convertToUnicode` of the files above |

### normalize: the stable pipeline

`normalizeTextStable(text)` gives 3.0's idempotent `normalize` (decision 36; DESIGN.md §11.2):

1. **Gate 1:** a text with no character of the three Myanmar blocks is only put in NFC.
2. **The first pass** runs `STABLE_NORMALIZE_STAGES`: the stages and ids of 2.x's `NORMALIZE_STAGES` (`nfc.input`, `syllables`, `typos`, `look-alikes`, `nfc.final`), with two changes that make every chain of repeated passes short. The reader runs with `STABLE_UNICODE_READING`, whose `stackedLookAlikesAreLetters` reads u, zero and seven right after a virama or under a kinzi as nya, wa and ra; and `settleTypos` reads each run of i and ii, or u and uu, whole. Each stage after the first NFC records its edits in an `EditLog`.
3. **No edit:** the text is settled already.
4. **Regions:** otherwise the pass is repeated on each region that holds an edit, until it changes nothing, at most `MOST_NORMALIZE_PASSES` (16) times. A region starts at 0, or at a syllable base or Burmese digit whose unit before is below U+0300 and is neither `.` nor `,` (`isRegionStart`): no stage reads or writes across that point, so a region the first pass left as it was is a fixpoint already.

`normalize(text, { report: true })` runs `normalizeTextStableLogged`, which records each pass and composes the passes into one edit list, then describes each edit as a change. `trace` runs `traceNormalizeTextStable`, the whole pipeline once per pass through `runStages` with the trace. `isNormalized(text)` is `normalizeTextStable(text) === text`. compat's `normalize` runs `NORMALIZE_STAGES` once, as 2.x did.

### toUnicode and toZawgyi

`toUnicode` reads `from`, `tie` and, with no `from`, the detector options (`readUnicodeReading`), then decides which parts of the text convert, as pieces `{ start, end, font }` (`piecesToConvert`):

- `from: 'unicode'`: none;
- `from: 'win'`: the whole text;
- `from: 'zawgyi'`: each line (split at `\n`) with a character of U+1000–U+109F (`linesWithMyanmar`);
- no `from`: each line that `encodingOf` reads as Zawgyi, or as a tie when `tie` is `'zawgyi'` (`zawgyiLines`).

Neighbouring lines join one piece, line break included, since the font pipeline converts each line as it would alone. Each piece goes through `fontToUnicode`, and the text between pieces is copied as it is, with no trim. With `offsets: true`, each piece runs through `fontToUnicodeLogged`, its edits are moved to where the piece lies (`shiftEdits`), and `outputToInputOffsets` turns them into the input index of each output unit. With `trace`, each piece is traced alone and the records are the whole text after each stage of `FONT_STAGES` (`traceInPieces`).

`toZawgyi` is `unicodeToZawgyi(text)`. Its trace starts at the input: when the collapse of repeated marks changed the text, a record `uz.collapse` comes first, then the records of `traceUnicodeToZawgyi`.

### detectEncoding and explain

`encodingOf(text, detector)` trims the text and removes U+200B and U+200C, as 2.x cleaned it, and asks `detectEncoding` of `rules/detect.js`: `none` with no unit of U+1000–U+109F, `unknown` on a tie, else the side with more evidence. With a `zawgyiDetector`, and a text that is not `none`, the detector's probability decides through `decideByProbability(probability, thresholds, 'unknown')`, and the result also holds it.

`explain` reads the text line by line. A line that `encodingOf` reads as Zawgyi, or every line with a Myanmar-block character when `from` is `'zawgyi'` and none when it is `'unicode'` (`isZawgyiLine`), is one issue, `encoding.zawgyi`, whose fix is `fontToUnicode(line, 'zawgyi')` over the line without the white space at its ends. Any other line runs the passes of `STABLE_NORMALIZE_STAGES` with a log per stage; each edit is named by what its stage changed (`nameEdit`: the reader's edits by a census of their units, the typing fixes by the rule, NFC as `nfc.order`), carried back to the line through the passes, and takes the span and fix of the change of `normalize`'s report that holds it.

### segmentSyllables, syllableBoundaries, truncate and collapseRepeatedMarks

`segmentSyllables` and `syllableBoundaries` call the core's functions with `from`, the text's encoding (`'unicode'` by default), and `bareConsonants` (`'separate'` by default, `DEFAULT_POLICY` in `api/segment.js`; the core's own default is `'pairs'`, 2.x's). `collapseRepeatedMarks` is the core's, with the encoding's set of marks. None trims or removes a zero-width character.

`truncate` returns a text that fits as it is. Otherwise `lastCutAtOrBefore` marks the syllable breaks up to `length - omission.length`, with `forEachBreak` stopping at the first break past it, and takes the last place at or before that budget that is a break, or lies before a unit outside the Myanmar blocks that does not join the unit before it (`joinsUnitBefore`: a low surrogate, a combining mark of the common blocks, ZWNJ, ZWJ or a variation selector). The prefix loses its trailing white space and gets the omission.

## What each 2.x call does

compat gives 2.x's output on every input. The core does the work; compat adds 2.x's preamble.

What follows is compat's code today, which gives 2.10.0's output but for the 2.11 changes ported so far: one policy for font names, in any letter case, with a coded `TypeError` ([below](#syllbreak-spellingfix-and-truncate)); a `fontDetect` fallback that is a string or none, `null` options, checked detector options, the `zawgyiDetector` option and no package loaded by name ([below](#fontdetectcontent-fallback-options)); `detectEncoding` ([below](#detectencodingcontent)); and the typing fixes in `normalize`'s order in the font pipeline, and the Unicode to Zawgyi rule for stacked jha, two changes to the core ([below](#typing-fixes-and-their-order), [and below](#detection-breaks-and-the-unicode-to-zawgyi-rules)). The 2.x reference has moved on to 2.11 (commit `8923365`), and its other changes wait for their ports: no debug flag read from `this`; a report from `fontConvert.debugging` on every exit with text; and a `truncate` that returns the start of the text. Each is ported into `src/` on its own, and until then the 2.x tests of it wait for it (`scripts/testing/pending-port.js`). compat's types, `src/compat/index.d.ts`, are 2.11's already. Every function starts the same way, with small differences (`compat/input.js`): `unboxString` unwraps `String` objects, and `enter` treats `null`, `undefined`, `''`, `0`, `false` and `NaN` as missing: the function warns (unless silent) and returns `''`, or the fallback or `'en'` for `fontDetect`. `truncate` does not count `''` as missing. Other non-strings are returned unchanged; `fontDetect` returns the fallback or `'en'` for them, and `truncate` turns them into strings. `hasMyanmarBlockChar` tests for a character in U+1000–U+109F.

### fontConvert(content, to, from)

1. Missing content: `''`. A non-string: returned. No Myanmar character and a source other than `win`: returned unchanged. No target: an error, and the text is returned.
2. The text is trimmed. `to` and `from` go through the aliases, in any letter case (`resolveFont`). An unknown target is an error. A missing source, or one that is not a string, is detected as `fontDetect(text)` would, whose tie result is `'zawgyi'`; so is an unknown source name, after a warning.
3. Same source and target: the trimmed text.
4. A Win target, or a Win source with a target other than Unicode: an error, and the text is returned.
5. Zawgyi or Win to Unicode: the font pipeline, `fontToUnicode(text, font)` (`stages/fonts.js`).
6. Unicode to Zawgyi: `unicodeToZawgyi(text)` (`rules/unicodeToZawgyi.js`): the collapse of repeated Unicode marks, then the rule rows.

`fontConvert.debugging` calls `fontConvert` with `this` set to `{ debug: true }`, and the debug flag is read from `this`. The traced pipelines (`traceFontToUnicode`, `traceUnicodeToZawgyi`) record what 2.x's debug output lists.

### The font pipeline: stages/fonts.js

Both APIs convert to Unicode through `FONT_STAGES`; the ids are the stage names.

| Stage name | What it does |
| --- | --- |
| `sequences` | The font's look-alike sequences, as regex replacements. Zawgyi: two lagaung rules. Win: `aMomf`, `Mo`, `ps`, `OD`. |
| `glyphs` | Traced only: each glyph's Unicode text, still in typed order. |
| `syllables` | `readFont`: the font reader. |
| `zero as wa` | `zeroAsWa`: a zero that is not part of a number becomes wa. |
| `typos` | `fixTypos`. |
| `look-alikes` | `fixLookAlikes`. |
| `NFC` | `toNfc`, which runs only when the reader wrote a unit NFC may change. |

With `debug`, `fontConvert` returns `{ to, from, matched_patterns, steps }`: `matched_patterns` names each stage that changed the text, in order, and `steps` holds the input followed by the text after each of those stages. MIGRATION.md documents these stage names.

### normalize(content)

After the input checks there is no Myanmar test: every string goes through `NORMALIZE_STAGES` (`stages/normalize.js`) once, by `normalizeText`:

```
NFC → reorderUnicode → fixTypos → fixLookAlikes → NFC
```

So text with no Myanmar characters still comes back in NFC; `normalizeText` takes it straight to NFC (gate 1), which gives the same result. The first NFC is there because it can move a dot below in front of an asat or virama, which changes what they attach to. The 3.0 `normalize` runs `STABLE_NORMALIZE_STAGES` instead, again on each region the first pass changed, until nothing changes ([above](#normalize-the-stable-pipeline)).

### fontDetect(content, fallback, options)

1. The fallback is a string other than `''`, or a `String` object's string (`givenName`); any other value, such as the index `Array#map` passes, is none. Missing content, or no Myanmar character: the fallback, or `'en'`.
2. `cleanText`: trim, and remove U+200B and U+200C.
3. The fallback defaults to `'zawgyi'`.
4. `mergeDetectorOptions(options)` merges the call's options with the stored ones; `undefined` and `null` are none. A threshold that is not two finite numbers in order, or a `zawgyiDetector` with no `getZawgyiProbability` method, keeps the stored one, with an error unless silent. An explicit `adapter` (`'rules'` or `'myanmartools'`) wins; another name warns, unless silent, and `use_myanmartools` picks myanmar-tools.
5. **Rules:** `countEvidence` (`rules/detect.js`) counts the matches of the 29 signatures (12 Unicode, 17 Zawgyi) in one pass, as 2.x's `String#match` of each signature counted them; `decide` gives the side with more, and a tie gives the fallback.
6. **myanmar-tools:** the detector passed as `zawgyiDetector`, for the call or stored, scores the text (`scoreByZawgyiModel`): a probability below the first threshold is `'unicode'`, above the second `'zawgyi'`, and in between the fallback. compat loads no package, as 2.11's builds in `dist/` do: with no detector the call uses the rules and warns once, unless silent, that myanmar-tools is not available.

`fontDetect` never returns `'win'`.

### detectEncoding(content)

2.11's: the rule scorer's evidence, `{ encoding, unicode, zawgyi }`, a new object each call. Missing content (which warns, unless silent), a value that is not a string and text with no Myanmar character give `'none'` and two zeros; otherwise the cleaned text goes to the core's `detectEncoding` (`rules/detect.js`), which counts as `fontDetect` does and names a tie `'unknown'`. It reads one argument and the rules alone, whatever the detector options say, so `fontDetect` with the rules is its `encoding` with the fallback in place of `'none'` and `'unknown'`.

### syllBreak, spellingFix and truncate

All three read the font name as 2.11 does (`compat/input.js`): a font that is not a string, or `''`, means detection (`givenName`), and a name is read in any letter case (`resolveFont`). `syllBreak` and `truncate` break Unicode and Zawgyi only, so `breakFont` throws a `TypeError` with the code `ERR_KNAYI_INVALID_FONT` for `'win'` and any other name, `Object.prototype`'s included; `spellingFix` collapses the Zawgyi marks for a name of Zawgyi, and the Unicode marks for any other name.

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

**`reorderUnicode(text, reading)`, the Unicode reader**, reads Unicode's logical order. Kinzi (nga or ra, asat, virama) before a consonant starts that consonant's syllable. A letter or digit starts a syllable. Virama plus consonant is a stacked consonant. The Burmese marks join the open syllable. Two Zawgyi typing habits are undone:

- **e or medial ra typed before its consonant.** `placePrebaseMark` decides where each one goes: to the open syllable (`TO_OPEN_SYLLABLE`), to the consonant after it (`TO_NEXT_BASE`), or nowhere (`STAYS`). It goes to the open syllable unless that syllable is finished (it has a vowel or a final) and no mark of it follows. Right after a letter or mark of another Myanmar-script language it stays where it is.
- **A space typed before a mark** is dropped, as in the font reader.

Letters and marks of Mon, Shan, Karen and the other languages are not read here: they end the syllable and stay where they are. `reading` is `UNICODE_READING` for compat's `normalize` and `STABLE_UNICODE_READING` for the 3.0 `normalize`; they differ in one field, `stackedLookAlikesAreLetters`.

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

The 3.0 API's `toUnicode` and `normalize` give the same results on these: they run the same readers.

One more difference follows from the encodings, not from a choice: in the fonts, e and medial ra always belong to the next base, while in Unicode they may also belong to the syllable before (`TO_OPEN_SYLLABLE`). That is why the converters write an e or medial ra with no base after it where it was typed, and `normalize` can move it into the syllable before. On the 10,166 distinct mC4 lines that `fontDetect` calls Zawgyi, compat's `normalize` changes the converted output of 31, each with an e or medial ra where the two first differ; on the 9,811 that `detectEncoding` calls Zawgyi, the 3.0 `normalize` changes that of 24.

## Typing fixes and their order

`rules/typingFixes.js` holds the fixes both pipelines use:

- **`fixLookAlikes`:** zero and seven are typed for wa and ra, and the other way round. A zero or seven that carries a mark, or starts a closed syllable, is a letter; a zero inside a word with no digit next to it is a letter too. A bare wa or ra inside a run of digits is a digit. The marks and consonants here cover every language in the Myanmar blocks, so Shan and Karen text gets the same reading (#43).
- **`fixTypos`:** four rules, in order: i with ii is ii; u with uu is uu; o with e, aa and asat is au; the digit four before nga, asat and visarga is lagaung. `spec/typoRows.js` documents them. `settleTypos`, which the 3.0 `normalize` runs instead, reads a whole run of i and ii, or u and uu, as repeating the first two rules would end.

Both pipelines run them in one order, the typos first (decision 15), as the 2.x line does since 2.11:

| Pipeline | Order |
| --- | --- |
| Zawgyi and Win (`FONT_STAGES`, `stages/fonts.js`) | `zero as wa` → `typos` → `look-alikes` → `NFC` |
| `normalize` (`NORMALIZE_STAGES` and `STABLE_NORMALIZE_STAGES`, `stages/normalize.js`) | `NFC` → syllables → `typos` → `look-alikes` → `NFC` |

The order counts only where a typo fix and a look-alike read the same characters, as with a ra before the digit four of a lagaung. Made first, the typo fix reads the four, which follows no digit, as lagaung, and the ra, next to no digit, stays ra:

```javascript
compat.fontConvert('&4if;', 'unicode', 'win') // 'ရ၎င်း'
compat.normalize('ရ၄င်း') // 'ရ၎င်း'
```

Until the port of 2.11 the font pipeline made the look-alikes first: it read the ra next to the four as seven, and the four, then after a digit, stayed a digit, so the Win text gave `'၇၄င်း'`. On the eval corpora the order makes no difference: the two orders give the same result on every Unicode line read by the Unicode reader (FLORES-200, the Wikipedia sample, Okell, mC4, and the GlotCC Shan, Mon, S'gaw Karen and Pa'o sets) and on every mC4 line converted from Zawgyi. The debug stage order is part of the 2.x API (see [Stable surfaces](#stable-surfaces)), so a change to it is deliberate: 2.11 made this one, and `fontConvert.debugging` names `typos` before `look-alikes`.

The fonts also have a stage `normalize` does not: `zeroAsWa`. Its idea of a zero in a number (a Burmese digit or one of `+ - * /` next to it, or a digit across `.` or `,`) differs from `fixLookAlikes`' (Burmese, Shan or Tai Laing digits, and `.` or `,`, but no arithmetic signs), as 2.x's did (DESIGN.md §10 Q20).

## Detection, breaks and the Unicode to Zawgyi rules

2.x applied these as regex tables, one pass per pattern. The core reads each in one pass of char codes where it can, and keeps 2.x's tables as readable oracles in `spec/`:

- **Detection** (`rules/detect.js`): `countEvidence` scans the text once for the 29 signatures of `spec/detectorSignatures.js` (12 Unicode, 17 Zawgyi) and counts them as 2.x's patterns counted; `decide` compares the counts, with the fallback a caller names for a tie (compat `'zawgyi'`); `detectEncoding` gives the evidence with `'none'` and `'unknown'` named, for the 3.0 API; `scoreByZawgyiModel` and `decideByProbability` read an injected myanmar-tools model.
- **Breaks** (`rules/segment.js`): one scanner per font finds the breaks that the rows of `spec/breakRules.js` (2.x's `BREAK_RULES`, 7 for Unicode and 8 for Zawgyi) made. Bare consonants follow a policy (`BARE_CONSONANTS`): `pairs` as 2.x, `chains`, or `separate`, the 3.0 API's default. Under `pairs` a letter after white space joins the syllable before it, as in 2.x; under the other two white space separates syllables, and the opening marks typed before a syllable start its piece (`spaceSeparates`). `segmentSyllables` and `syllableBoundaries` keep every character.
- **Mark collapse** (`rules/segment.js`, `collapseRepeatedMarks`): one pass, with a set of repeated marks per font.
- **Unicode to Zawgyi** (`rules/unicodeToZawgyi.js`): 2.11's 58 rules applied once in order, 2.10's 57 and its rule for stacked jha, then its 8 rules repeated while they match (at most 40 times), as rule rows with stable ids. 39 of the rows that replace one fixed text with one glyph are read from the Zawgyi glyph table backwards; the glyph rows run as one pass where that equals running them in order. A row whose units the text lacks is skipped. Traced, the rows run one by one, and the trace holds 2.x's labels: the regex `.source` of each rule that changed the text, or that matched for a repeated rule.

## Edit logs

`core/edits.js` holds the edit lists behind `normalize`'s report, `toUnicode`'s offsets, `explain` and the regions `normalize` settles (DESIGN.md §11.3). An edit is `{ start, end, outStart, outEnd, rules }`: `input[start, end)` became `output[outStart, outEnd)`, the units between edits are copied, and `rules` holds the ids of the stages that made it.

- `EditLog` collects the edits of one pass, each tagged with the stage id in its `rule`. `addChange` cuts a replacement down to the units that differ, but leaves at least one unit on each side (`sharedEnds`), so a unit a replacement wrote still maps to a unit of its input, and never cuts a surrogate pair, so every change of well-formed text is well-formed.
- `composeEdits(first, second)` gives the edits of two passes run one after the other; `shiftEdits` moves a piece's edits to where it lies in the whole text; `outputToInputOffsets` gives the input index of each output unit.

The writers record only when they are handed a log, so the fast paths, and compat, which never logs, pay nothing. The logging lives in twins of the 2.x stage functions: `fixTyposLogged`, `settleTyposLogged`, `fixLookAlikesLogged` and `zeroAsWaLogged` (`rules/typingFixes.js`), `readFontLogged` (`engine/fontReader.js`), `applyRuleRowsLogged` (`core/rules.js`) and `logNfcEdits` (`core/nfc.js`); the Unicode reader and `readDigitsAsLetters` and `readLettersAsDigits` take the log as an optional argument. `runStagesLogged` runs a pipeline with a log per stage, from a table of logged runs apart from the stage list: `STABLE_NORMALIZE_LOGGED_RUNS`, and a private one in `stages/fonts.js`.

## Streams and the command line

**`src/stream.js`**, the entry `knayi-myscript/stream` (DESIGN.md §12), holds the 3.0 streams, apart from `src/index.js` so that an import of `normalize` alone carries no stream code: `createNormalizer` and `createConverter` (`api/stream.js`), TransformStreams of `normalize` and `toUnicode` that take strings or UTF-8 bytes in chunks and give what the function gives for the whole text, since both convert a text as they convert each of its lines; `lineTransform`, the same for any function of a line; and `mapLines` (`api/lines.js`), the line cutter under them, with no stream class. A `LineMapper` holds the waiting pieces of the current line and, for bytes, one `TextDecoder`; each unit is read once, and a line is joined once, at its end. Node's `stream.pipeline` takes the TransformStreams between Node streams. A line is never cut: one longer than `maxLineLength` is an error with the code `ERR_KNAYI_LINE_TOO_LONG`. Unicode to Zawgyi does not stream, since its rules move e and medial ra across line breaks (DESIGN.md §10 Q10).

**`bin/knayi.js`** is the command line (README.md, "Command line", DESIGN.md §13): `normalize`, `to-unicode`, `to-zawgyi`, `convert`, `detect`, `segment` and `check` over files or standard input, as plain text or JSON Lines. It is Node-only and lies outside `src/`, so the browser floor does not apply to it; its modules, in `bin/cli/`, import only Node's built-ins, each other, `src/index.js` and `src/stream.js`. A run reads a chunk at a time, cuts it into lines with `mapLines`, and calls the 3.0 API once per line or record, so it holds one line however large the input; it decodes strictly, writes a JSON Lines record's result into the line's own text so every other byte passes through, stops at a record it cannot read unless `--invalid keep` or `skip` passes it on, writes every line before an input error, and loads myanmar-tools only for `--detector myanmar-tools`, from where knayi-myscript is installed, never from the working directory (`test/next/cli/loading.test.mjs`). `test/next/cli/` runs it as a process on hand-written fixtures.

## Glossary

- **Storage order (logical order):** the order Unicode stores a syllable in, from UTN #11: kinzi, consonant, stacked consonant, an asat that sits on the consonant, medials, e, vowels, anusvara, dot below, asat, visarga. `orderSyllable` writes this order.
- **Drawing order (visual order):** the order a font draws glyphs from left to right, which Zawgyi and Win store. e and medial ra come before the consonant, kinzi and stacked consonants after it, and the other marks in any order.
- **Prebase:** a mark drawn before its consonant: e (U+1031) and medial ra (U+103C; in Zawgyi U+103B and U+107E–U+1084). The font tables give them the role `BEFORE_BASE`; the Unicode reader places them with `placePrebaseMark`.
- **Base:** what starts a syllable: a consonant, independent vowel, digit or symbol.
- **Bare consonant:** a consonant with no mark of its own, read with its inherent vowel. The break policies of `segmentSyllables` differ in how they read one.
- **Stacked consonant:** a consonant written under another, stored as virama (U+1039) plus consonant. Zawgyi draws them as separate glyphs after the base (role `STACK`), and has a few two-consonant ligatures that are bases.
- **Kinzi:** nga, asat and virama (U+1004 U+103A U+1039), stored before the consonant it is drawn over. Zawgyi draws it with U+1064, or U+108B–U+108D together with i, ii or anusvara, typed after that consonant. The Unicode reader also reads ra, asat and virama as kinzi.
- **Held space:** a space or zero-width character after an open syllable, held until the next character shows whether the syllable goes on.
- **Pending:** e or medial ra waiting for the base that comes after it.
- **Slip:** an asat that `orderSyllable` drops, because it was typed early for the next consonant's asat.
- **Look-alikes:** zero (U+1040) and wa (U+101D), and seven (U+1047) and ra (U+101B), typed for each other.
- **Tie:** equal evidence for Unicode and Zawgyi. 2.x's `fontDetect` returns the fallback, `'zawgyi'` when none is given; the 3.0 `detectEncoding` says `'unknown'`, and `toUnicode` leaves the line as it is. Short Unicode text, such as one consonant or a word whose only sign is a stacked consonant, ties often.
- **Region:** a part of a text that one pass of the stable normalize reads and writes on its own (see [above](#normalize-the-stable-pipeline)).
- **Silent mode:** compat's `setGlobalOptions({ silent_mode: true })`, which hides every warning and error it writes ([Module state](#module-state)).
- **Output version:** `OUTPUT_VERSION`, which goes up with every deliberate change to what any function returns: 1 for 2.10.0's output, 2 since the 3.0 `normalize` settles, and 3 since the port of 2.11's output fixes, in both APIs.

## Stable surfaces

These are the public surfaces of 3.0. Changing them needs a major version, or for an output a deliberate pull request that raises `OUTPUT_VERSION`.

| Surface | Where it is defined or relied on |
| --- | --- |
| The entries of the exports map and what each exports | `package.json`, `src/index.js`, `src/compat/index.js`, `src/stream.js`; `test/package.test.js`, which checks that each entry's types declare exactly what it exports |
| The types | `src/index.d.ts`, `src/compat/index.d.ts`, `src/stream.d.ts`; `typecheck/` and `scripts/check-types.mjs` compile code against them, the last from the packed tarball |
| The error codes | `ERR_KNAYI_INVALID_ARG_TYPE` and `ERR_KNAYI_INVALID_ARG_VALUE`, the streams' `ERR_KNAYI_LINE_TOO_LONG` and `ERR_KNAYI_UNSUPPORTED_RUNTIME`, and compat's `ERR_KNAYI_INVALID_FONT` (`src/core/errors.js`) |
| The `knayi` command: its commands, options, output formats and exit status | `bin/cli/`, README's "Command line"; `test/next/cli/` |
| The output, and `OUTPUT_VERSION` | `src/version.js`; compare (`npm run compare`) and the tests of each module |
| The stage and rule ids of traces, and the rule ids of `explain` | the stage lists of `stages/`, the rule rows of `rules/unicodeToZawgyi.js`, `api/explain.js` |
| The dist file names and the `knayi` global | `scripts/build.js`; `test/browser.test.js`, `test/compat.test.js` |
| The minimum Node, 22.12, and the browser floor | `package.json` `engines`; README, read by `scripts/browser/floor.js` |
| The 2.x API in `knayi-myscript/compat`: its exports and their shapes, the option keys, the debug stage names and their order, and the regex-source labels in `matched_patterns` | `src/compat/`; the contract matrix (`test/contract/`), compare against the reference, and `test/next/compat-*.test.mjs` |

## Quirks kept on purpose

compat keeps 2.x's output on every input, so the core keeps 2.x's quirks where compat's output depends on them. DESIGN.md §10 lists each, with its size, where the code keeps it and the fix planned for it, and the code cites them as `DESIGN.md §10 Q11`. The 3.0 API answers three of them itself: its `truncate` is always a prefix (Q5), `segmentSyllables` reads bare consonants as `separate` by default (Q11), and its `normalize` is idempotent (Q12). Q3 and Q15 belong to compat's public layer alone; the others, among them the Unicode to Zawgyi rules that move e and medial ra across a line break (Q10), hold in both APIs. compat also keeps these behaviours of 2.x's public layer, the first three of which 2.11 changes and leave compat with the port of the 2.x line ([above](#what-each-2x-call-does)):

- **`fontConvert.debugging`** returns what `fontConvert` returns, not an object, on every early exit: missing or non-string content, no Myanmar text, a missing or unknown target, the same source and target, or a Win direction knayi does not convert.
- **The debug flag is read from `this`.** compat and its builds are strict code, so a detached call such as `const f = compat.fontConvert; f(...)` never reads a global `debug`, as 2.x's ES module build did not (2.x's `main.js` and script builds did).
- **`truncate` throws on an object that `String()` cannot convert,** such as `Object.create(null)` or `{ toString: undefined }`: it turns non-strings into strings with `String(content)`, where the other functions return them unchanged. `test/properties.test.js` pins the `TypeError`.
- **Only U+1000–U+109F counts as Myanmar** for compat's input checks, and for `detectEncoding`'s `'none'` and `toUnicode`'s lines from Zawgyi. The extended blocks (U+A9E0–U+A9FF, U+AA60–U+AA7F) are read by the typing fixes and by the Unicode reader, but `fontDetect`, `fontConvert`, `syllBreak`, `spellingFix` and `truncate` treat text made only of them as having no Myanmar character. Myanmar Extended-C (U+116D0–U+116E3) is not read anywhere yet (decision 20b). The tables match Unicode 15.1, apart from the classes `test/next/unicode.test.mjs` lists, and that test fails when the runtime knows Myanmar code points they miss.

## Where the rules are justified

The rules in the engine, the typing fixes and the glyph tables have a comment next to them in the code, citing UTN #11 or a research note; the readable tables of `src/spec/` say why each detector signature and break rule is there. The evidence, the counts on real text and the choices between sources are in `research/`:

| Note | Covers |
| --- | --- |
| [`research/zawgyi-to-unicode.md`](research/zawgyi-to-unicode.md) | Why the 2.9 Zawgyi rules were replaced; the glyph table; asat placement; UTN #11 against myanmar-tools and human typing, with counts. |
| [`research/normalize.md`](research/normalize.md) | What 2.9's `normalize` did wrong; each 2.10 rule; the typing fixes; the effect on conversion; other languages; speed. |
| [`research/normalize-idempotence.md`](research/normalize-idempotence.md) | Why 2.x's `normalize` could change its own output; how the 3.0 `normalize` settles; the region argument; the evidence and the cost. |
| [`research/tie-policy.md`](research/tie-policy.md) | What a tie in detection is; the damage of reading it as Zawgyi, recounted per corpus; the cost to short Zawgyi text; the `tie` option. |
| [`research/segmentation.md`](research/segmentation.md) | The three readings of a bare consonant, the corpus counts, and why `separate` is the 3.0 default. |
| [`research/win-fonts.md`](research/win-fonts.md) | The Win fonts and their encoding; existing converters and their licences; where the table comes from; open questions. |
| [`scripts/eval/README.md`](scripts/eval/README.md) | The eval data, its licences, and what the benchmark measures. |
| [`docs/next/DESIGN.md`](docs/next/DESIGN.md) | The 3.0 core and API: the data structures, the readers, the gates, the 3.0 API's choices and the measurements behind them. |

A change to a rule adds its evidence there. [CONTRIBUTING.md](CONTRIBUTING.md) has the protocol.

## Running the checks

Setup is `npm ci` in each clone or worktree; see [CONTRIBUTING.md](CONTRIBUTING.md), which also says which results a pull request reports. Every npm script, and the check of `.github/workflows/test.yml` that runs it, by the name GitHub shows (the name the rules for the default branch require):

| Command | What it runs | CI check |
| --- | --- | --- |
| `npm run build` | Writes the four `dist/` files. Only a release commit runs it. | — |
| `npm test` | `node --test` on `test/**/*.test.js` and `test/**/*.test.mjs`, then the timing tests alone (`*.timing.js`, `*.timing.mjs`), then `tsc` on `typecheck/` (the 2.x types with and without `esModuleInterop`, and the 3.0 API's), then the dist size budgets (`posttest`). The tests read the dist files from a temporary build. Among them: the 2.x tests against compat; the tests of each module of the core, of the 3.0 API and of its streams, and the guards of `test/next/guards/` (layers, the stateless core, tree-shaking, the ES2015 floor of `src/`, function sizes, error codes, citations and the frozen oracle); the package and its exports map; the `knayi` command, run as a process (`test/next/cli/`); the contract matrix (`test/contract/`); a probe for every table row (`test/tables.test.js`); every example in README.md, MIGRATION.md and this file, with their number pinned, and README's prose examples (`test/readme.test.js`); differential fuzz against the frozen 2.10 engine in `scripts/oracle/`, with the deliberate output changes the 2.x line made since (`scripts/oracle/index.js`); property tests; the browser floor checks of the builds (`test/syntax.test.js`, `test/dist-floor.test.js`, `test/regex-floor.test.js`); and the Unicode version check. The timing tests check that time grows linearly on adversarial and random structured input; they run after the others so that they do not compete with them for the CPU. A test of a 2.x change compat does not have yet is written with `pendingPort` (`scripts/testing/pending-port.js`): it passes while the change is missing and fails once it is there; `KNAYI_PENDING_PORT=run` runs those tests as plain tests. | Node 22.12, Node 24, Node 26 |
| `npm run test:bun` | `scripts/bun-contract.js`, `scripts/bun-esm.mjs` and `scripts/bun-matrix.js` (the contract matrix in a process of its own), then `bun test ./test` and the timing tests. | Bun |
| `npm run test:pack` | Packs the package with a fresh build (`scripts/pack-fresh.mjs`), installs it with Bun in a temporary app, and loads each entry of the exports map through `require` and `import`. | Bun |
| `npm run test:fuzz` | The fuzz and property tests alone. `KNAYI_FUZZ_SEED` and `KNAYI_FUZZ_SCALE` set the seed and size; `KNAYI_GROWTH_SEED` and `KNAYI_GROWTH_RUNS` do the same for `test/growth.timing.js`. `npm run test:fuzz:next` runs those of `test/next/` only. | fuzz, nightly (`fuzz.yml`) |
| `npm run test:browser` | Playwright: the script and module builds in Chromium, Firefox and WebKit against the sources in Node, and axe on the demo and benchmark pages. Install the browsers once with `npx playwright install chromium firefox webkit`. | Browsers |
| `npm run check:size` | The gzip size of each `dist/` file (Node's zlib, level 9) against its budget, with each module's share. `npm test` runs it without the breakdown. `node scripts/next/size.mjs` measures an import of each entry of the exports map and of `normalize` alone against theirs, and checks that a normalize-only import leaves the other modules out. | ReDoS, types and size |
| `npm run check:dist -- --base <rev>` | Fails when `dist/` differs from `<rev>` without a version change; with a version change, or with `--fresh`, checks that `dist/` equals a fresh build; otherwise checks that `dist/` equals the `dist/` of the last release (the tag `v<version>`, or the commit that set the version while there is no tag; `--release <rev>` names another). The CI job also checks that the hashes in `.git-blame-ignore-revs` are in the history. | dist only in releases |
| `npm run check:redos` | Every regex `src/` ships, as literals, built at run time or exported, and every regex literal of the `knayi` command in `bin/`, through recheck. The allowlist is `scripts/redos-allowlist.json`. | ReDoS, types and size |
| `npm run check:types` | Packs the package, then compiles `typecheck/packed/` against it under node10 (`module: commonjs`), node16, node20, nodenext and bundler resolution, runs the output, and runs @arethetypeswrong/cli on every entry of the exports map. | ReDoS, types and size |
| `npm run matrix:update` | Rewrites `test/contract/api-matrix.json` from `scripts/reference/main.js`, after a port moves the 2.x reference, and refuses build differences that `scripts/contract/matrix.js` does not explain. | — |
| `npm run compare -- --base <ref>` | Two copies of knayi's 2.x API on every call form, including `fontConvert.debugging`, over every cached corpus, generated input and seeded fuzz; lists the differences. A 3.0 copy is its compat. `--expect form:set=n` declares the differences a deliberate change expects, `--offline` uses no corpus, and `--head min:.` or `mjs:.` compares compat with the builds that hold it. `--base 8923365919943a84826e31649d094e1aa5ff285a --head mjs:src/compat/index.js` compares compat with the 2.x reference; `--base mjs:src/compat/index.js --head mjs:scripts/next/migration/plain.mjs` (or `as-2x.mjs`) compares compat with the 3.0 API, for MIGRATION.md's counts; `--base api:origin/next --head api:.` compares the 3.0 API of two copies, each through its own `plain.mjs`, and CI then runs `scripts/next/output-version.mjs`, which asks a change for an `OUTPUT_VERSION` above the last release's. | Compare, Compat (Node and Bun) |
| `npm run perf -- --base <ref>` | Two copies timed interleaved in one process, under Node and Bun: ratios per line, per word, on one string and on one document, and growth exponents on adversarial inputs (`--offline`: growth only). | Perf |
| `npm run eval` | Accuracy on public data, next to a published knayi release, myanmar-tools and Rabbit. | — |
| `npm run bench` | Speed on real text and long input; `-- --sweep` adds 1,059 long inputs. | — |
| `npm run bench:page` | Both, then rebuilds `docs/benchmark.html` and `docs/benchmark.json`. Run it for a release. | — |

Other commands: `node scripts/eval/datasets.mjs --check`, `--fetch` or `--refresh-samples` checks, fills or redraws the corpus cache; `node scripts/browser/floor.js` prints the floor rules and what each build uses; `node scripts/eval/win-glyphs.mjs <font>` draws every Win table entry next to its Unicode text, with your own copy of the font. [scripts/eval/README.md](scripts/eval/README.md) covers the corpora, compare and perf in detail.
