# knayi 3.0 core: design

This is the spec that the module builders on the `next` branch follow. It turns Phases 1.5, 2 and 3 of the refactor plan into one 3.0 core, built once (decision 6b):

- ES modules under `src/`;
- a stateless core;
- `src/compat/`, the 2.x API built on that core.

compat is checked against the 2.x library at `safety-net` with the Phase 0 tools: `npm run compare`, the contract matrix and `npm run perf`. The spec is meant to be precise enough that several people can build modules at the same time and have them fit together. Section 7 says who builds what, and in which order.

**Sources.**
- The refactor plan, `knayi-refactor-plan.md` of 2026-10-03, which is kept outside the repository. "§" numbers in this spec refer to its sections.
- ARCHITECTURE.md and CONTRIBUTING.md at `safety-net`.
- The prototypes the plan cites as `SCR/...`. SCR is the plan's evidence folder, also outside the repository. On the maintainer's machine it is `scratchpad/refactor/` next to the plan.

Where this spec departs from the plan, §1.4 says so and gives the reason.

**Contents**
1. [Scope](#1-scope)
2. [Layout](#2-layout)
3. [Data structures](#3-data-structures)
4. [The stateless core contract](#4-the-stateless-core-contract)
5. [compat: the 2.x API on the core](#5-compat-the-2x-api-on-the-core)
6. [Verification](#6-verification)
7. [Work split](#7-work-split)
8. [Porting the 2.x line into next](#8-porting-the-2x-line-into-next)
9. [Not in this build](#9-not-in-this-build)
- [Appendix A: names, 2.x to next](#appendix-a-names-2x-to-next)

---

## 1. Scope

### 1.1 What this branch builds

- **The 3.0 core.** This is the char-code engine of Phase 2, the one-pass scanners of Phase 3, and the input, option, rule and trace pieces of Phase 1.5. It is written once, as ESM, in `src/`.
- **compat** (`src/compat/`). This is the 2.x API on top of the core:
  - `version`, `setGlobalOptions`, `fontDetect`, `fontConvert` with `.debugging`, `syllBreak`, `spellingFix`, `truncate` and `normalize`;
  - the default export.

  Its output is byte-identical to `safety-net`'s `main.js` on every input.
- **Not here:**
  - the 3.0 public API: `toUnicode`, `toZawgyi`, `detectEncoding`, streaming, lossless segmentation, change reports and the CLI;
  - the package `exports` map and the 3.0 builds;
  - any output change.

  §9 lists these and says how the core leaves room for them.

`library/` and `main.js` stay as they are on `next` while the core is built. They are the 2.x reference the tests compare against, and the 2.x test suite keeps running. Nothing in `src/` imports them.

**The reference for byte identity is the library at `safety-net`**, that is, its `main.js`. A parallel effort is changing the 2.x line: a linear NFC helper, the Phase 1c contract fixes, speed wins and deliberate output fixes. Those changes are ported into `next` later, each as a PR of its own (§8). The module builders do not port them.

### 1.2 Ground rules for every module

1. **Byte-identical.** compat's output equals safety-net's on every input, and no module changes behaviour on purpose. A module that finds a 2.x bug reproduces it, and the builder writes the bug down in the PR.
2. **One concern per PR.**
   - Commits follow CONTRIBUTING.md: conventional commits, and a body that says why, with evidence.
   - No co-author lines, and no mention of tools or assistants.
   - PRs target `next`, never `main`. Stacked PRs merge with a merge commit (CONTRIBUTING.md).
3. **Readable code is a goal as much as speed.**
   - Steps have names.
   - Functions are about 40 lines or fewer. The two reader dispatch loops may run to about 70 lines, and they call named helpers. A test checks both limits (§6.2).
   - Names say their scope (Appendix A).
   - Every rule has a comment citing UTN #11 or a research note. Cite the note and its section, for example `// research/zawgyi-to-unicode.md §3: …`. The notes are research/zawgyi-to-unicode.md for asat placement, the look-alike letters and the glyph table; research/normalize.md for the Unicode reader's habits and the typing fixes; and research/win-fonts.md for the Win table.
4. **Licences** (CONTRIBUTING.md).
   - Never copy LGPL, GPL or unlicensed code or tables.
   - `src/fonts/` moves this project's own MIT tables out of `library/`, unchanged except for the role names.
   - Never commit or ship the Win fonts.
   - Test inputs are synthetic or hand-written (decision 22).
5. **Regex sources are 2.x debug output.**
   - The Unicode to Zawgyi labels must equal 2.x's `RegExp#source` strings byte for byte, with the same `\u` escapes and the same letter case.
   - Write regex literals with `\u` escapes. Never paste the characters themselves.
6. **Linear time on every input.** Super-linear time is a security bug (SECURITY.md). No loop may rescan text it has already read.

### 1.3 Plan decisions applied here

The recommended option of each decision below is adopted.

| # | Decision | What it means on `next` |
|---|---|---|
| 6 | (b) Build Phases 1.5, 2 and 3 once, as the 3.0 core | This branch. compat is checked by the 2.x compare and the contract matrix. |
| 8 | Stage names, their order and the regex-source labels are 2.x API | compat reproduces them exactly (§5.2, C17-C18). Core rows also carry stable `id`s for 3.0. |
| 9 | (b) Accidental TypeErrors count by class only | compat throws a `TypeError` wherever 2.x threw one by accident. The message is free (§5.2, C12). The Phase 1c fixes come later, with the 2.x port (§8). |
| 10 | Shims for every moved 2.x path | `library/` stays untouched on `next`, so no shim is needed yet. Phase 6 packaging deletes `library/` behind an exports map. |
| 11 | Font-name policy (a coded TypeError for `'win'` and unknown names; case-insensitive names) | A Phase 1c change, ported later. Until then compat reproduces safety-net, and core `FONTS` is ready for it. |
| 12 | `debugging` always returns ConvertDebug in 2.11 | Ported later. compat still returns strings on early exits (C19). |
| 13 | Keep the `'zawgyi'` tie fallback in 2.x | compat passes `ON_TIE_ASSUME_ZAWGYI` explicitly. Core `decide(evidence, fallback)` takes the fallback as an argument, so 3.0's `tie` option needs no core change. |
| 16 | normalize keeps NFC on text with no Myanmar | The no-Myanmar fast path returns `toNfc(text)`. |
| 18 | (b) Raise the floor to engines with full ES2015 | `src/` uses ES2015 syntax and built-ins only (`TypedArray#fill` is allowed). Checked by a test (§6.2). The 3.0 release notes state the new floor. |
| 20 | (c) now, (b) in 3.0 | `codes.js` states the Unicode version it matches, and a test checks it against the runtime. Extended-C digits and code-point iteration are a deliberate 3.0 output change, made later. The readers keep reading UTF-16 units and never split a surrogate pair. |
| 28 | Only the two simple gates | The no-Myanmar fast path and the final-NFC gate (§3.10). No typo or look-alike gates (PR 2.7 is not built). No Zawgyi or Win gates. |
| 29 | Accept the V8 atom wrap, exactly U+1000-U+1010 | It applies to the Unicode to Zawgyi rows, whose `re` may wrap its first unit while the `label` keeps the 2.x source. A lint test enforces the exact range. The detector no longer uses regexes. |
| 30 | No single-pass GLYPH_MAP alternation for Unicode to Zawgyi | Not built. It is revisited with the 3.0 generated writer. |
| 31 | ESM-only sources; minimum Node 22.12 for `require(esm)` | `src/package.json` has `"type": "module"`, and `library/` stays CommonJS for the transition. The `engines` field and the exports map come in Phase 6 packaging. |
| 32 | (b) A CLI | Later. The core never reads the working directory or loads code (§4), so a CLI on it is safe (§10.2 of the plan). |
| 33 | (b) `OUTPUT_VERSION` | `src/version.js`. It is 1 for the output of 2.10.0 at safety-net. |
| 34 | Lossless segmentation tokens | Later. `forEachBreak` reports positions. The 2.x pairwise rule is one named predicate (`legacyBareConsonantPair`), so a 3.0 policy option can replace it. |
| 35 | Delete parseUnicode and serializeUnicode | Not ported. |
| 36 | normalize idempotent by construction in 3.0 | Later, as a 3.0 option and invariant. compat stays non-idempotent, exactly like 2.x. |

Decisions 5 and 17 are not adopted. §1.4 says what this spec does instead (D6 and D3).

### 1.4 Decisions this spec makes where the plan leaves it open

| ID | Decision | Why |
|---|---|---|
| D1 | **The 2.x public-layer pieces live in compat, not in the core.** These are: the input policy rows and `enter()` with its warnings; the global option store and `setGlobalOptions`; the 2.x merge of detector options; the 2.x font-name and rule-table lookups. `core/options.js` and `core/input.js` keep only what 3.0 shares: defaults, the font registry, text predicates and `requireText`. | The core is stateless and silent (Phase 6 #1, §4). The plan designed these pieces for the 2.x layout, where the public layer and the engine sat in one package. The 3.0 API validates strictly and throws, which 2.x never does. |
| D2 | **compat is a strict ES module.** A detached `fontConvert` call never reads `debug` from the global object. In those 10 matrix cells compat matches the 2.x ES module build, and the matrix records them as a known build difference, as it already does for `knayi-myscript.mjs` (§5.4). | Reproducing the sloppy-mode read would mean reading `globalThis.debug` on purpose. That brings back global state and §7 bug #2, which PR 4.1 removes from 2.x. The 2.x ES module build already behaves like this. |
| D3 | **compat loads myanmar-tools the way the 2.x ES module build does:** by name, from the working directory, in Node and Bun only. This happens in one file, `compat/zawgyiModel.js`. The core takes the detector as an injected object. | Decision 17 is not adopted, so compat keeps the 2.x behaviour (§7 #15). The core never loads code (§4). Injection for compat (Phase 5 #2) arrives with the 2.x port. |
| D4 | **One trace shape for both kinds of 2.x debug log.** A trace is `{start, records}`. compat builds `steps` as `[start, ...records.map(r => r.text)]`. | 2.x logs font stages as "input, then the text after each stage that changed it", and Unicode to Zawgyi rules as "the text before each logged rule, then the result". The second is the same list as the first, with the collapsed text as `start` (§3.9). One recorder serves both. |
| D5 | **`fontToUnicode(text, fontName)` takes the font's name.** The compiled fonts stay private to `engine/stages.js`. | Callers (compat now, the 3.0 API later) name a font. Only the stages need the compiled form. |
| D6 | **No internal switch back to the 2.10 engine** (decision 5's rollback switch). | Under decision 6(b) the new engine ships with 3.0. A user who needs the old engine stays on the 2.x line, and a 2.x branch is cut when 3.0 reaches main (decision 7). `scripts/oracle/` stays as the test oracle. |
| D7 | **Glyph roles (`ROLE`) live in `script/codes.js`.** | The fonts (L2) need them, and L2 may not import the engine (L3). |
| D8 | **`src/version.js` (L0)** holds `PACKAGE_VERSION` and `OUTPUT_VERSION`. | They are constants that both compat and the 3.0 API export. They are not options. |
| D9 | **`CodeBuffer` is built with `engine/syllable.js`, by engine-unicode.** The split this spec was asked to cover put it with engine-fonts. | `orderSyllable` writes into a CodeBuffer for both readers, and the CopyThroughWriter's syllable scratch is one. With the font reader, engine-unicode would have to wait for engine-fonts. |
| D10 | **One stage list per pipeline, one runner.** The fast path and the trace run the same list (`core/rules.js` `runStages`). Gates are stage fields, and the runner ignores them when tracing. | The order and the names are written once. The fast and trace paths cannot drift apart. Looping over 5-7 stages per call costs nothing measurable next to the work. |
| D11 | **New tests are ES modules: `test/next/**/*.test.mjs` and `*.timing.mjs`.** They reach the CommonJS oracle through `createRequire`. | The root package stays CommonJS for the 2.x suite. `.mjs` tests avoid `require(esm)` warnings on Node 22. |
| D12 | **Skeleton first.** The first PR (W0) lands every `src/` file as a stub with its final exports. Builders then work in parallel against stable imports. Merges follow a fixed order (§7.1). | ESM imports fail at link time when an export is missing. With stubs, each module's own tests run before its dependencies are finished. |
| D13 | **compat throws the 2.x accidental TypeErrors through one helper, `legacyTypeError()`, which sets no `code`.** `test/next/guards/errors.test.mjs` allows it in `compat/legacy.js` only. | The matrix records a thrown error with a `code` by code and message, and one without a `code` by class only. 2.x's cells are class-only. |
| D14 | **The ES2015 floor for `src/`.** Syntax is checked by acorn with `ecmaVersion: 2015, sourceType: 'module'`. Built-ins are checked against a denylist of ES2016+ names. `import.meta` and `globalThis` are not used anywhere in `src/`. | Decision 18(b). compat's loader detects Node with `typeof process`, which every engine accepts. |
| D15 | **The plan's cap of 2-3 files for `engine/` does not apply to `src/`.** This spec keeps the plan's file list anyway. | The cap protected bundle bytes from CommonJS module wrappers: the clarity split cost +16%. esbuild bundles ES modules into one scope without wrappers. The size report (§6.4) checks this guess. |

---

## 2. Layout

### 2.1 Tree

```
src/
  package.json               {"type": "module", "sideEffects": false}
  version.js                 L0          PACKAGE_VERSION, OUTPUT_VERSION
  script/codes.js            L0          code points, character classes, mark order, glyph roles, the NFC-safe set
  core/errors.js             L1          error codes, libraryError()
  core/options.js            L1          frozen DEFAULTS, map-safe option reading
  core/input.js              L1          FONTS registry, text predicates, requireText()
  core/rules.js              L1          rule rows and their runner, traces, the stage runner
  core/nfc.js                L1          toNfc(), the only call of String#normalize in src/
  fonts/zawgyi.js            L2          Zawgyi glyph table and lagaung sequences (data only)
  fonts/win.js               L2          Win Innwa glyph table, look-alike sequences, C1 aliases (data only)
  engine/syllable.js         L3 engine   SyllableBuffer, orderSyllable and its steps, CodeBuffer, CopyThroughWriter
  engine/readers.js          L3 engine   reader options, reorderUnicode, compileFont, readFont, glyphsInTypedOrder
  engine/typingFixes.js      L3 rules    typos, look-alikes, zero as wa, isInNumber
  detect.js                  L3 rules    countEvidence, decide, scoreByZawgyiModel, detectFont
  segment.js                 L3 rules    break scanners, forEachBreak, breakParts, breakString, collapseRepeatedMarks
  unicodeToZawgyi.js         L3 rules    Unicode to Zawgyi rule rows, unicodeToZawgyi, traceUnicodeToZawgyi
  engine/stages.js           L3 stages   FONT_STAGES, NORMALIZE_STAGES, fontToUnicode, normalizeText and their traces
  compat/index.js            L4          the 2.x export object (named and default exports)
  compat/globalOptions.js    L4          the option store, setGlobalOptions, the silent-aware console writer
  compat/input.js            L4          INPUT_POLICY, enter(), cleanText(), 2.x font-name resolution
  compat/legacy.js           L4          2.x rule-table lookups, legacyTypeError()
  compat/zawgyiModel.js      L4          the myanmar-tools loader (the only loader site in src/)
  compat/fontDetect.js       L4          fontDetect, fontDetectCore
  compat/fontConvert.js      L4          fontConvert, fontConvert.debugging
  compat/text.js             L4          normalize, syllBreak, spellingFix, truncate
  spec/detectorSignatures.js  (spec)     the 29 detector signature rows: the scanner's readable oracle
  spec/breakRules.js          (spec)     the 15 break rule rows: the scanners' readable oracle
test/next/                   module tests (*.test.mjs), timing (*.timing.mjs), guards/, helpers.mjs
scripts/next/size.mjs        bundle size report for compat and a normalize-only import
```

### 2.2 Layers and import rules

| Layer | Files | May import |
|---|---|---|
| L0 script | `version.js`, `script/codes.js` | nothing |
| L1 core | `core/*.js` | L0, L1 |
| L2 fonts | `fonts/*.js` | L0, L1 |
| L3 engine | `engine/syllable.js`, `engine/readers.js` | L0-L2, L3 engine |
| L3 rules | `engine/typingFixes.js`, `detect.js`, `segment.js`, `unicodeToZawgyi.js` | L0-L2, L3 rules |
| L3 stages | `engine/stages.js` | L0-L3 |
| L4 public | `compat/*.js` (and, later, the 3.0 API) | L0-L4 |
| spec | `spec/*.js` | nothing; nothing in `src/` imports `spec/` (tests do) |

The import rules:

- An import uses a literal relative path that ends in `.js`, and it stays inside `src/`. Nothing imports `library/`, `main.js` or a package.
- Imports within one layer are allowed, but cycles are not. The L3 parts are ordered as the data flows: rules never import the engine, the engine never imports rules, and only stages imports both.
- No file loads code at run time, except `compat/zawgyiModel.js` (D3). That means no `require`, no `createRequire`, no `getBuiltinModule`, no dynamic `import()` and no `import.meta`.
- `test/next/guards/layers.test.mjs` parses every file with acorn (`sourceType: 'module'`) and enforces these rules. There are no known exceptions, and none may be added. Every file in `src/` must have a layer. A planned file that does not exist yet is allowed until the acceptance gate.

### 2.3 Modules, exports and signatures

The signatures below are written in TypeScript notation for precision. The sources are JavaScript, with the same types in JSDoc. "Frozen" means `Object.freeze`, applied deeply for data. Typed arrays cannot be frozen. They are exported read-only by contract, and nothing outside their module writes them.

#### `src/version.js` (L0)

```ts
export const PACKAGE_VERSION: string  // equals package.json "version" (tested); '2.10.0' until a 3.0 prerelease
export const OUTPUT_VERSION: number   // 1 = the output of 2.10.0 at safety-net; +1 with each deliberate output change (decision 33)
```

#### `src/script/codes.js` (L0)

This file holds one definition of every concept that more than one module uses (goal 3). A class used by one row of one table may stay local to that scanner, named after the row. The header states: "The tables match Unicode 15.1, as library/ does." `test/next/unicode.test.mjs` fails when the runtime's Script=Myanmar set, or its `\p{M}`/`\p{L}` sets over the blocks, gains a code point these tables do not classify (decision 20c).

```ts
// Code points. Numbers only.
export const CP: Readonly<{
  KA: 0x1000, NGA: 0x1004, CA: 0x1005, JHA: 0x1008, NYA: 0x1009, RA: 0x101B, WA: 0x101D,
  LETTER_U: 0x1025, LETTER_UU: 0x1026, LETTER_O: 0x1029, LETTER_AU: 0x102A,
  TALL_AA: 0x102B, AA: 0x102C, I: 0x102D, II: 0x102E, U: 0x102F, UU: 0x1030, E: 0x1031, AI: 0x1032,
  ANUSVARA: 0x1036, DOT_BELOW: 0x1037, VISARGA: 0x1038, VIRAMA: 0x1039, ASAT: 0x103A,
  MEDIAL_YA: 0x103B, MEDIAL_RA: 0x103C, MEDIAL_WA: 0x103D, MEDIAL_HA: 0x103E, GREAT_SA: 0x103F,
  DIGIT_ZERO: 0x1040, DIGIT_FOUR: 0x1044, DIGIT_SEVEN: 0x1047, LITTLE_SECTION: 0x104A, SECTION: 0x104B,
  LAGAUNG: 0x104E, SPACE: 0x20, NBSP: 0xA0, ZWSP: 0x200B, ZWNJ: 0x200C, ZWJ: 0x200D, WORD_JOINER: 0x2060, BOM: 0xFEFF
}>
export const KINZI_TEXT: string        // U+1004 U+103A U+1039. The plan's CP.KINZI_TEXT; CP holds numbers only

// The Burmese reader's classes: disjoint, one per code unit (§3.1).
export const CLS: Readonly<{ OTHER: 0, CONSONANT: 1, LETTER: 2, DIGIT: 3, MARK: 4, PREBASE: 5,
  VIRAMA: 6, PUNCTUATION: 7, OTHER_SCRIPT: 8 }>
export const CLASS: Uint8Array         // 160 entries, index code - 0x1000
export function classOf(code: number): number   // CLASS in U+1000-U+109F; OTHER_SCRIPT in Extended-A/B; OTHER elsewhere

// Predicates on char codes. Each name states its scope (Appendix A).
export function isBurmeseConsonant(code: number): boolean  // U+1000-U+1021
export function isSyllableBase(code: number): boolean      // CONSONANT or LETTER (2.x isMyanmarLetter)
export function isBurmeseDigit(code: number): boolean      // U+1040-U+1049
export function isBurmeseMark(code: number): boolean       // MARK or PREBASE (2.x isUnicodeMark)
export function isPrebaseMark(code: number): boolean       // e, medial ra (2.x isTypedFirst)
export function isOtherScriptLetter(code: number): boolean // OTHER_SCRIPT (2.x isOtherMyanmar)
export function isVowelSign(code: number): boolean         // U+102B-U+1032, U+1036 (the keepU test)
export function isSpaceBeforeMark(code: number): boolean   // U+0020, U+00A0 (2.x isSpace)
export function isMyanmarBlock(code: number): boolean      // U+1000-U+109F (the 2.x input gate)
export function isMyanmarScript(code: number): boolean     // U+1000-U+109F, U+A9E0-U+A9FF, U+AA60-U+AA7F
export const ZW: Readonly<{ ZWSP: 1, ZWNJ: 2, ZWJ: 4, WORD_JOINER: 8, BOM: 16, ALL: 31 }>
export function zeroWidthBit(code: number): number          // the ZW bit of a zero-width character, else 0

// Script-wide classes for the typing fixes (every language of the blocks; issue #43).
export const SCRIPT: Readonly<{ MARK: 1, TONE: 2, CONSONANT: 4, WORD: 8, DIGIT: 16, BURMESE_DIGIT: 32 }>
export function scriptClassOf(code: number): number         // SCRIPT flags over the three blocks; 0 elsewhere
export function isScriptMark(code: number): boolean
export function isScriptTone(code: number): boolean
export function isScriptConsonant(code: number): boolean
export function isScriptWordChar(code: number): boolean
export function isScriptDigit(code: number): boolean       // Burmese, Shan (U+1090-U+1099), Tai Laing (U+A9F0-U+A9F9)

// Zawgyi classes, shared by detect.js and segment.js.
export function isZawgyiPrebase(code: number): boolean     // U+1031, U+103B, U+107E-U+1084
export function isZawgyiMedialRa(code: number): boolean    // U+103B, U+107E-U+1084
export function isZawgyiKinzi(code: number): boolean       // U+1064, U+108B-U+108D

// Mark order (UTN #11 storage order; §3.2).
export const MARK_GROUPS: ReadonlyArray<ReadonlyArray<number>>  // 12 groups
export const MARK_RANK: Int8Array                               // 20 entries, index code - 0x102B
export function markRank(code: number): number                 // MARK_RANK in U+102B-U+103E, else RANK_UNRANKED
export const RANK_LAST_MEDIAL: number   // 3, derived from MARK_GROUPS (medial ha)
export const RANK_E: number             // 4
export const RANK_FIRST_VOWEL: number   // 5 (i, ii: vowels and finals from here on)
export const RANK_LOWER_VOWEL: number   // 6
export const RANK_AI_ANUSVARA: number   // 8
export const RANK_UNRANKED: number      // 12 = MARK_GROUPS.length: U+1033-U+1035, U+1039 sort last
export function markBit(code: number): number   // 1 << (code - 0x102B), for U+102B-U+103E
export const MASK_ANY_AA: number, MASK_UPPER_VOWELS: number, MASK_LOWER_VOWELS: number, MASK_E_OR_AA: number,
  MASK_MEDIALS: number, MASK_VOWEL_OR_FINAL: number, MASK_ASAT: number, MASK_DOT_BELOW: number,
  MASK_VISARGA: number, MASK_MEDIAL_YA: number, MASK_MEDIAL_HA: number

// Glyph roles (D7). 3.0 names (§5 of the plan): PRE is BEFORE_BASE, TEXT is PLAIN.
export const ROLE: Readonly<{ BASE: 1, BEFORE_BASE: 2, MARK: 3, STACK: 4, KINZI: 5, PLAIN: 6 }>

// NFC (§3.10).
export function isNfcSafe(code: number): boolean  // below U+0300, U+2002-U+206F, U+FEFF, Extended-A/B

// Patterns with no g flag, for test() only.
export const MYANMAR_BLOCK_PATTERN: RegExp    // one code unit in U+1000-U+109F
export const MYANMAR_SCRIPT_PATTERN: RegExp   // one code unit in the three blocks
```

#### `src/core/errors.js` (L1)

```ts
export const ERR: Readonly<{
  INVALID_ARG_TYPE: 'ERR_KNAYI_INVALID_ARG_TYPE',      // TypeError: an argument has the wrong type
  INVALID_ARG_VALUE: 'ERR_KNAYI_INVALID_ARG_VALUE',    // RangeError: a value knayi does not accept
  INVALID_FONT_TABLE: 'ERR_KNAYI_INVALID_FONT_TABLE',  // Error: a font table fails compileFont's checks, at module load
  NOT_BUILT: 'ERR_KNAYI_NOT_BUILT'                     // Error: a skeleton stub; none may remain at the gate
}>
// new Ctor(message), with an own enumerable string property `code`.
export function libraryError(code: string, message: string, Ctor?: ErrorConstructor): Error
```

Messages say where the error comes from and what is wrong, in this form: `knayi.<function>: <what is wrong>`, or `knayi fonts/win.js: glyph U+00D3: <what is wrong>`.

#### `src/core/options.js` (L1)

```ts
export const DEFAULTS: DeepReadonly<{
  detector: { useZawgyiModel: false, thresholds: [0.05, 0.95] },  // 2.x use_myanmartools, myanmartools_zg_threshold
  truncate: { length: 30, omission: '...' },
  breakSeparator: string                                           // U+200B
}>
export const NO_OPTIONS: Readonly<{}>
// value when it is a non-null object that is not an array, else NO_OPTIONS. This makes a call map-safe:
// lines.map(f) passes an index and an array, which are not options.
export function optionsObject(value: unknown): object
```

#### `src/core/input.js` (L1)

```ts
type FontInfo = Readonly<{ name: 'unicode' | 'zawgyi' | 'win', aliases: readonly string[],
  visualOrder: boolean,   // stored in drawing order (zawgyi, win)
  sourceOnly: boolean,    // converted from, never to (win)
  ascii: boolean }>       // its text has no Myanmar-block character (win)
export const FONTS: Readonly<{ unicode: FontInfo, zawgyi: FontInfo, win: FontInfo }>
export const FONT_ALIASES: Readonly<object>   // null prototype: unicode, uni -> 'unicode'; zawgyi, zaw -> 'zawgyi'; win -> 'win'
export function hasMyanmarBlockChar(text: string): boolean    // a unit in U+1000-U+109F
export function hasMyanmarScriptChar(text: string): boolean   // a unit in the three blocks
export function stripZeroWidthBreaks(text: string): string    // removes U+200B and U+200C
// value when it is a string; else throws libraryError(ERR.INVALID_ARG_TYPE, 'knayi.<api>: text must be a string', TypeError)
export function requireText(apiName: string, value: unknown): string
```

#### `src/core/rules.js` (L1)

```ts
type RuleRow = Readonly<{
  id: string,        // stable, unique within its table, for example 'uz.kinzi.2' (3.0 traces use it)
  section: string,   // the table section, for example 'KINZI'
  re: RegExp,        // g flag, ES2015 syntax
  to: string,        // the replacement, with $1-style references
  label: string,     // the 2.x debug label (the 2.x RegExp#source); for rows 2.x never logged, the id
  repeat: boolean,   // 2.x asLongAsMatch: apply while it matches, at most REPEAT_LIMIT times
  why: string,       // one line, citing UTN #11 or a research note
  example?: string   // a synthetic input the row changes
}>
type TraceRecord = { id: string, label: string, text: string }
type Trace = { start: string | null, records: TraceRecord[] }
type Stage<C> = Readonly<{ id: string, label: string, run(text: string, ctx: C): string,
  traceOnly?: true, gate?(ctx: C): boolean }>

export const REPEAT_LIMIT: 40
export function ruleMatches(row: RuleRow, text: string): boolean   // text.search(row.re) !== -1
export function applyRuleRows(text: string, rows: readonly RuleRow[]): string
export function traceRuleRows(text: string, rows: readonly RuleRow[], trace: Trace): string
export function createTrace(): Trace                                // { start: null, records: [] }
export function startTrace(trace: Trace, text: string): void        // start = text; records emptied
export function lastTracedText(trace: Trace): string                // the last record's text, or start
export function recordStep(trace: Trace, id: string, label: string, text: string): void  // appends
export function runStages<C>(text: string, stages: readonly Stage<C>[], ctx: C, trace: Trace | null): string
```

Semantics, which every caller relies on:

- **`applyRuleRows`** works through the rows in order.
  - A row with `repeat: false` runs `text = text.replace(row.re, row.to)` once.
  - A row with `repeat: true` repeats 2.x `replaceRepeated`. Up to `REPEAT_LIMIT` times:
    - stop if `!ruleMatches(row, text)`;
    - otherwise compute `next = text.replace(row.re, row.to)`;
    - stop if `next === text`, otherwise set `text = next`.

  `String#search` and a global `String#replace` both start at index 0 and leave `lastIndex` at 0. So a row's regex carries no state from one call to the next.
- **`traceRuleRows`** gives the same result as `applyRuleRows`, and records 2.x's logged rules:
  - a once row that changed the text is recorded, with the text after it;
  - a repeat row that matched before its first pass is recorded once, with the text after its last pass.
- **`runStages`** works through the stages in order:
  - A stage marked `traceOnly` runs only when `trace` is given. Its output is recorded but is not passed on to the next stage.
  - A stage with a `gate` is skipped only when no trace is given, `ctx.openAllGates` is false and `gate(ctx)` returns false. **The trace runner never gates.**
  - With a trace, a stage's output is recorded when it differs from `lastTracedText(trace)`. That is the comparison 2.x's `step()` makes in `storageOrder.toUnicode`. The caller calls `startTrace(trace, input)` first.

#### `src/core/nfc.js` (L1)

```ts
export function toNfc(text: string): string   // today text.normalize('NFC')
```

This file holds the only call of `String#normalize` in `src/`, and a guard test checks that. The 2.x line's linear helper is ported here (§8). That helper puts long runs of combining marks in canonical order before NFC, as UAX #15 stream-safe text does. It must not change any output.

#### `src/fonts/zawgyi.js` and `src/fonts/win.js` (L2, data only)

```ts
type GlyphRow = readonly [role: number /* ROLE */, text: string, attachedMarks?: string]   // the 2.x row shape
type FontDefinition = Readonly<{
  name: 'zawgyi' | 'win',
  glyphs: Readonly<Record<string, GlyphRow>>,   // one-UTF-16-unit keys
  sequences: readonly RuleRow[],                // applied first, in order (stage 'sequences')
  selfBases: readonly (readonly [number, number])[],  // code ranges that are bases of themselves (zawgyi.js:118-121)
  aliases: Readonly<Record<string, string>>,    // key reads as the glyph of value (win.js:222-224)
  wholeBases: readonly string[]                 // multi-unit BASE texts allowed besides ligatures (§3.8)
}>
// zawgyi.js
export const ZAWGYI_GLYPHS: Readonly<Record<string, GlyphRow>>
export const LAGAUNG_SEQUENCES: readonly RuleRow[]   // 2 rows
export const ZAWGYI_FONT: FontDefinition             // selfBases [[0x1040, 0x1049]]: Zawgyi types wa as zero
// win.js
export const WIN_GLYPHS: Readonly<Record<string, GlyphRow>>
export const LOOK_ALIKE_SEQUENCES: readonly RuleRow[] // 4 rows: aMomf, Mo, ps, OD
export const C1_ALIASES: Readonly<Record<string, string>>  // 11 C1 controls -> the Windows-1252 key (win.js:217-221)
export const WIN_FONT: FontDefinition
```

The rows are copied from `library/zawgyi.js` and `library/win.js`, with their comments. Only the role names change. The file headers state the full pipeline, including the typing-fix stages that the 2.x headers leave out (§7 #23).

#### `src/engine/syllable.js` (L3 engine)

```ts
export const ASAT_PLACE: Readonly<{ NONE: 0, DROPPED: 1, IN_ORDER: 2, ON_CONSONANT: 3, AFTER_MEDIALS: 4 }>
export class CodeBuffer { /* §3.7 */ }
export class SyllableBuffer { /* §3.3 */ }
export class CopyThroughWriter { /* §3.7 */ }
// The steps of §3.4. Each is a module function taking the buffer: no closures, no allocation.
export function closeSyllable(buf: SyllableBuffer, sink: CodeBuffer): void     // orderSyllable, writeHeld, then closed
export function orderSyllable(buf: SyllableBuffer, sink: CodeBuffer): void
export function placeAsat(buf: SyllableBuffer, stacked: boolean): number          // ASAT_PLACE
export function fixLookAlikeLetters(buf: SyllableBuffer, place: number, stacked: boolean, hadAa: boolean): void
export function rankMarks(buf: SyllableBuffer): void                               // fills buf.ranks
export function sortByRank(buf: SyllableBuffer): void
export function writeOrdered(buf: SyllableBuffer, place: number, sink: CodeBuffer): void
export function writeHeld(buf: SyllableBuffer, sink: CodeBuffer): void
// The shared reader decisions that take the reader's options (§3.5).
export function isHeld(buf: SyllableBuffer, code: number, reading: ReaderOptions): boolean
export function marksGoOn(buf: SyllableBuffer, reading: ReaderOptions): boolean
```

#### `src/engine/readers.js` (L3 engine)

```ts
type ReaderOptions = Readonly<{ heldZeroWidth: number /* ZW bits */, digitTakesMarksAcrossSpace: boolean,
  prebaseCrossesZeroWidth: boolean, keepUAfterVowelSign: boolean }>
export const FONT_READING: ReaderOptions     // { ZW.ALL, true, true, false }
export const UNICODE_READING: ReaderOptions  // { ZW.ZWSP | ZW.WORD_JOINER | ZW.BOM, false, false, true }
export const SEEN: Readonly<{ LETTER_U: 1, NFC_UNSAFE: 2 }>
export function reorderUnicode(text: string): { text: string, seen: number }   // §3.6
export function compileFont(definition: FontDefinition): CompiledFont           // §3.8; throws ERR.INVALID_FONT_TABLE
export function readFont(text: string, font: CompiledFont): string             // §3.6
export function glyphsInTypedOrder(text: string, font: CompiledFont): string   // trace stage 'glyphs' only
export function scratchUnitsForTests(): number   // total capacity of this module's scratch buffers (§3.11)
```

#### `src/engine/typingFixes.js` (L3 rules)

```ts
type NumberContext = Readonly<{ isDigit(code: number): boolean, isSign(code: number): boolean }>
export const TYPO_ROWS: readonly Readonly<{ id: string, why: string, example: string }>[]  // the 4 rules, documented
export function fixTypos(text: string): string              // the 4 rules in one scan (§3.9)
export function readDigitsAsLetters(text: string): string   // 2.x lookAlikes, first pass: zero and seven as wa and ra
export function readLettersAsDigits(text: string): string   // 2.x lookAlikes, second pass: bare wa and ra in a number
export function fixLookAlikes(text: string): string         // readLettersAsDigits(readDigitsAsLetters(text))
export function zeroAsWa(text: string): string              // the font pipeline's 'zero as wa' stage
export const NUMBER_CONTEXT: Readonly<{ ZERO_AS_WA: NumberContext, LOOK_ALIKES: NumberContext }>
export function isInNumber(text: string, i: number, context: NumberContext): boolean
```

`isInNumber(text, i, c)` is true when either of these holds:
- the unit before or after `i` is a digit or sign of `c`;
- a `.` or `,` sits next to `i` with a digit of `c` beyond it.

The two contexts restate a 2.x difference on purpose (§7 #20), and each is kept as it is:
- `ZERO_AS_WA` counts Burmese digits, and `+ - * /` as signs (storageOrder.js:59-61).
- `LOOK_ALIKES` counts Burmese, Shan and Tai Laing digits, and has no signs (typingFixes.js:37, :70-74).

Every function returns its input string when nothing changes (copy-through).

#### `src/detect.js` (L3 rules)

```ts
type Evidence = { unicode: number, zawgyi: number }
type ZawgyiModel = { getZawgyiProbability(text: string): number }   // myanmar-tools' ZawgyiDetector shape
// Exactly the String#match counts of spec/detectorSignatures.js over `text`, summed per side, in one pass.
export function countEvidence(text: string): Evidence
export function decide<T>(evidence: Evidence, fallback: T): 'unicode' | 'zawgyi' | T   // unicode > zawgyi, <, else fallback
// probability < thresholds[0]: 'unicode'; > thresholds[1]: 'zawgyi'; else fallback
export function scoreByZawgyiModel<T>(text: string, model: ZawgyiModel, thresholds: readonly [number, number], fallback: T): 'unicode' | 'zawgyi' | T
// options: { fallback = 'zawgyi', zawgyiModel = null, thresholds = DEFAULTS.detector.thresholds }
export function detectFont<T>(text: string, options?: object): 'unicode' | 'zawgyi' | T
```

The precondition is that `text` has been cleaned: trimmed, with no U+200B or U+200C. The anchored signatures (`^`, `$`) apply to the start and end of that cleaned text.

#### `src/segment.js` (L3 rules)

```ts
type BreakFont = 'unicode' | 'zawgyi'
export function prepareBreakText(text: string, font: BreakFont): string   // unicode: U+103A U+1037 -> U+1037 U+103A (row U1)
// Calls onBreak(index) at every break, in increasing order, never at 0; stops when onBreak returns false.
export function forEachBreak(prepared: string, font: BreakFont, onBreak: (index: number) => boolean | void): void
export function breakParts(text: string, font: BreakFont): string[]                // 2.x breakParts
export function breakString(text: string, font: BreakFont, separator: string): string   // 2.x joinParts(breakParts(...))
export function looksLikeSgawKaren(text: string): boolean   // row Z6's switch: /[U+1062 U+1063]U+103A/ tested on the input
export function collapseRepeatedMarks(text: string, font: BreakFont): string   // 2.x collapseMarks for a known font
```

The precondition for the break functions is that `text` has no U+200B or U+200C. 2.x always cleans the text first. `font` is one of the two names. compat resolves every other value (§5.2, C12).

#### `src/unicodeToZawgyi.js` (L3 rules)

```ts
export const UNICODE_TO_ZAWGYI_RULES: readonly RuleRow[]   // 57 once rows, then 8 repeat rows, in 2.x order
export function unicodeToZawgyi(text: string): string     // collapseRepeatedMarks(text, 'unicode'), then the rows
export function traceUnicodeToZawgyi(text: string, trace: Trace): string   // trace.start = the collapsed text
```

#### `src/engine/stages.js` (L3 stages)

```ts
type StageContext = { font: CompiledFont | null, seen: number, openAllGates: boolean }
export const FONT_STAGES: readonly Stage<StageContext>[]
//   'sequences', 'glyphs' (traceOnly), 'syllables', 'zero as wa', 'look-alikes', 'typos', 'NFC'
export const NORMALIZE_STAGES: readonly Stage<StageContext>[]
//   'NFC', 'syllables', 'typos', 'look-alikes', 'NFC' (gated, §3.10)
export function fontToUnicode(text: string, fontName: 'zawgyi' | 'win'): string
export function traceFontToUnicode(text: string, fontName: 'zawgyi' | 'win', trace: Trace): string
// engineOptions.openAllGates: tests only. compat never passes it, and no public API exposes it.
export function normalizeText(text: string, engineOptions?: { openAllGates?: boolean }): string
export function traceNormalizeText(text: string, trace: Trace): string
```

The font stage `id`s and `label`s are exactly the 2.x names, in this order (README.md, `fontConvert.debugging`; test/zawgyi.test.js). The compiled Zawgyi and Win fonts are module constants here, built once at load from `fonts/*.js`.

#### `src/spec/` (readable oracle, not imported by `src/`)

```ts
// detectorSignatures.js: 12 Unicode rows U01-U12, then 17 Zawgyi rows Z01-Z17, in 2.x order.
export const DETECTOR_SIGNATURES: readonly Readonly<{ id: string, side: 'unicode' | 'zawgyi',
  pattern: string,   // the 2.x source string, whitespace class expanded; compiled with new RegExp(pattern, 'g')
  why: string, source: string, example: string }>[]
// breakRules.js: Unicode U1-U7, Zawgyi Z1-Z8, in 2.x order.
export const BREAK_RULES: Readonly<{ unicode: readonly BreakRow[], zawgyi: readonly BreakRow[] }>
type BreakRow = Readonly<{ id: string, pattern: RegExp /* the 2.x literal */, replacement: string,
  offWhen: RegExp | null /* 2.x third item */, why: string, source: string, example: string }>
```

A row's `why` says what the row detects or joins and why. `source` names the evidence: UTN #11, a research note section, an issue, or "kept from 2.x; evidence not recorded" when none is known. The scanner code cites the row `id`s in its comments.

#### `src/compat/*` (L4)

compat's files, exports and behaviour are in §5.

---

## 3. Data structures

### 3.1 Character classes

**`CLASS`** gives one disjoint class per code unit of U+1000-U+109F. It drives the Unicode reader's dispatch.

| CLS | Code points | 2.x source |
|---|---|---|
| CONSONANT | U+1000-U+1021 | storageOrder.js:274 `isConsonant` |
| LETTER | U+1022-U+102A, U+103F, U+104C-U+104F | the rest of `isMyanmarLetter` (:86) |
| DIGIT | U+1040-U+1049 | `isDigit` (:291) |
| MARK | U+102B-U+1030, U+1032, U+1036-U+1038, U+103A, U+103B, U+103D, U+103E | `isUnicodeMark` (:280) less PREBASE |
| PREBASE | U+1031, U+103C | `isTypedFirst` (:304) |
| VIRAMA | U+1039 | |
| PUNCTUATION | U+104A, U+104B | |
| OTHER_SCRIPT | U+1033-U+1035, U+1050-U+109F; all of U+A9E0-U+A9FF and U+AA60-U+AA7F (by `classOf`) | `isOtherMyanmar` (:297) |
| OTHER | everything else | |

**`SCRIPT` flags** cover the three blocks. They restate typingFixes.js:23-37 exactly:

| Flag | Code points |
|---|---|
| MARK | U+102B-U+103E, U+1056-U+1059, U+105E-U+1060, U+1062, U+1067, U+1068, U+1071-U+1074, U+1082-U+1086, U+109C, U+109D, U+A9E5 |
| TONE | U+1063, U+1064, U+1069-U+106D, U+1087-U+108D, U+108F, U+109A, U+109B, U+AA7B-U+AA7D |
| CONSONANT | U+1000-U+1021, U+103F, U+1050, U+1051, U+105A-U+105D, U+1061, U+1065, U+1066, U+106E-U+1070, U+1075-U+1081, U+108E, U+A9E0-U+A9E4, U+A9E7-U+A9EF, U+A9FA-U+A9FE, U+AA60-U+AA76, U+AA7A, U+AA7E, U+AA7F |
| WORD | U+1000-U+103F, U+104C-U+108F, U+109A-U+109F, U+A9E0-U+A9EF, U+A9FA-U+A9FE, U+AA60-U+AA7F |
| DIGIT | U+1040-U+1049, U+1090-U+1099, U+A9F0-U+A9F9 |
| BURMESE_DIGIT | U+1040-U+1049 |

**Classes that disagree stay separate**, with a comment, until someone unifies them on purpose (§3.4 of the plan):
- U+1022 and U+1028 are syllable bases for the readers, but not in the Unicode break letters (`segment.js`, row U2).
- The Zawgyi break bases do not match the glyph table (syllable.js:226 against zawgyi.js:29-30).
- The script-wide CONSONANT set is not `isBurmeseConsonant`.

`segment.js` keeps its break-letter and opener sets locally, named after the rows they serve (U2/U6, Z1/Z7, U3/Z4), because no other module uses them.

### 3.2 Mark order: MARK_GROUPS, MARK_RANK and the mark bits

`MARK_GROUPS` is the UTN #11 storage order of the marks after the base, taken from storageOrder.js:19-32. Marks in one group keep the order they were typed in.

```
0 medial ya   1 medial ra   2 medial wa   3 medial ha   4 e   5 i, ii   6 u, uu   7 tall aa, aa
8 ai, anusvara (after a lower vowel or aa, as Mon and Pa'o write them)   9 dot below   10 asat   11 visarga
```

- **`MARK_RANK`** is an `Int8Array(20)` over U+102B-U+103E, built from `MARK_GROUPS` at load. U+1033-U+1035 and U+1039 get `RANK_UNRANKED` (12), so they sort last as in 2.x's `rank()`.
- **The named ranks** (`RANK_LAST_MEDIAL` and the others) are read from the table by code point, never written as numbers. A test asserts the values 3, 4, 5, 6, 8 and 12. This replaces the hand-copied indexes of storageOrder.js:34-37.
- **The mark bits.** Every mark a reader pushes lies in U+102B-U+103E (§3.3), so `markBit(code)` fits in 20 bits. The masks are unions of `markBit`:

| Mask | Marks |
|---|---|
| ANY_AA | U+102B, U+102C |
| UPPER_VOWELS | U+102D, U+102E |
| LOWER_VOWELS | U+102F, U+1030 |
| E_OR_AA | U+1031, U+102B, U+102C |
| MEDIALS | U+103B-U+103E |
| VOWEL_OR_FINAL | every mark whose rank is `RANK_FIRST_VOWEL` or more, except asat (2.x `hasVowel`, storageOrder.js:376-383) |
| ASAT, DOT_BELOW, VISARGA, MEDIAL_YA, MEDIAL_HA | one mark each |

### 3.3 SyllableBuffer

There is one buffer per reader, a module-level scratch object (§3.11). It holds the open syllable in typed order and the text held after it. It never allocates per syllable.

| Field | Type | Meaning |
|---|---|---|
| `isOpen` | boolean | a syllable is open |
| `kinziLead` | number | 0, or the kinzi's first unit: U+1004, or U+101B in Unicode text (repha). The kinzi is written as `kinziLead`, U+103A, U+1039. |
| `base` | number | the base's first unit |
| `baseCodes`, `baseLength` | Uint16Array(8), number | the base text: 1 unit, or a font's ligature or whole base (≤ 8 units, checked by compileFont) |
| `baseHasVirama` | boolean | the base text has U+1039 after its first unit. A ligature base counts as stacked (2.x `base.indexOf(VIRAMA) > 0`). |
| `keepU` | boolean | U+1025 stays u (§3.5) |
| `marks`, `markCount` | Int32Array(20), number | unique marks, in the order first typed |
| `markMask` | number | the 20-bit set of `marks`. Pushing a mark that is already in the set does nothing. |
| `ranks` | Int32Array(20) | scratch for `rankMarks` and `sortByRank` |
| `stack`, `stackLength` | growable Uint16Array, number | stacked consonants as (virama, consonant) units, in typed order |
| `held`, `heldLength` | growable Uint16Array, number | spaces and zero-width characters held after the syllable |
| `keptUpTo` | number | `held[0, keptUpTo)` were held before the syllable last went on. Of those, only the zero-width ones are written. |
| `spaceHeld` | boolean | a space has been held since the syllable last went on (2.x `after.length !== kept.length`) |
| `pending`, `pendingLength` | growable Uint16Array, number | e and medial ra waiting for the next base, in typed order, duplicates kept |

Methods (each a few lines):

- `reset()` empties everything; a reader calls it at the start of each call.
- `open(kinziLead, keepU)` empties the syllable fields, opens a syllable, and moves `pending` into `marks` through `pushMark` (dedupe), leaving `pending` empty.
- `setBase(code)`.
- `setBaseText(codes, start, end)`.
- `pushMark(code)`.
- `pushStack(code)`.
- `hold(code, zeroWidth)` appends to `held`, and sets `spaceHeld` when the code is not zero-width.
- `goOn()` sets `keptUpTo = heldLength` and `spaceHeld = false`. In 2.x this is `after = kept`: the held spaces are dropped and the held zero-width characters stay.
- `addPending(code)`.
- `writePending(sink)` writes `pending` and empties it.
- `releaseIfLarge()` (§3.11).

This record replaces the two shapes of 2.x's syllable record (with and without `keepU`, storageOrder.js:251 and :340). It also replaces the strings `after` and `kept`, whose rope building was the hottest line of the profile (storageOrder.js:329).

### 3.4 orderSyllable, step by step

`orderSyllable(buf, sink)` writes one syllable in storage order. The rules are those of 2.x `order()` (storageOrder.js:101-185). The behaviour must be identical; the structure is new.

```
orderSyllable(buf, sink)
  if buf.markCount === 0 and buf.stackLength === 0:
    write the kinzi (if any) and the base text; return
  stacked = buf.stackLength > 0 or buf.baseHasVirama
  hadAa   = buf.markMask has ANY_AA                      // read before any mark is removed
  place   = placeAsat(buf, stacked)
  fixLookAlikeLetters(buf, place, stacked, hadAa)
  rankMarks(buf)
  sortByRank(buf)
  writeOrdered(buf, place, sink)
```

- **`placeAsat`** (UTN #11; research/zawgyi-to-unicode.md §3). It returns:
  - `NONE` when there is no asat.
  - `DROPPED` when the asat is a slip, typed early for the next consonant's asat: there is no aa, and there is i or ii, or the syllable is stacked and has no dot below. The asat is removed.
  - `IN_ORDER` when the asat is stored last. That is the case:
    - with a dot below;
    - when e, aa or tall aa comes before the asat in typed order (kyaw);
    - with aa and no medial.

    The asat stays in `marks` and is sorted with them.
  - Otherwise the asat is removed, and placeAsat returns `AFTER_MEDIALS` when medial ha remains (Mon final h) or `ON_CONSONANT` when it does not (kyun-up, loanword finals).
- **`fixLookAlikeLetters`** applies the letters the fonts draw alike, in this order:
  1. Medial ya with ca (research/zawgyi-to-unicode.md §3):
     - if the last stacked consonant is ca, it becomes jha and the medial ya is removed;
     - otherwise, if the base is the single unit ca and there is no stack, the base becomes jha and the medial ya is removed.
  2. The base U+1025 becomes nya (U+1009) unless `keepU` is set. This happens when the syllable is stacked, or `place` is `ON_CONSONANT` or `AFTER_MEDIALS`, or the asat is still among the marks (`IN_ORDER`), or `hadAa` is true. The reason (UTN #11): the vowel u never takes a stacked consonant, an asat or aa.
  3. The base U+1047 becomes ra (U+101B) when `place` is `ON_CONSONANT` or `AFTER_MEDIALS`, or when any mark other than visarga remains. A digit takes no vowel sign or medial; after digits, visarga is a colon (7:30).
- **`rankMarks`** fills `ranks` from `markRank`, with one exception (UTN #11; research/normalize.md §3). A mark of rank `RANK_AI_ANUSVARA` gets `RANK_LOWER_VOWEL` when all of these hold:
  - there is no lower vowel among the marks;
  - aa comes after it (U+102C if present, else U+102B);
  - it is not anusvara before tall aa.
- **`sortByRank`** is a stable insertion sort of `marks` by `ranks`.
- **`writeOrdered`** writes, in this order:
  1. the kinzi;
  2. the base text, with any replacement;
  3. the stack, with its last consonant replaced by jha by rule 1;
  4. the asat, if `ON_CONSONANT`;
  5. the marks. For `AFTER_MEDIALS`, the asat goes after the leading marks whose base `markRank` is `RANK_LAST_MEDIAL` or less.
- **`closeSyllable`** = `orderSyllable`, then `writeHeld`, then `isOpen = false`. **`writeHeld`** writes the zero-width units of `held[0, keptUpTo)`, then all of `held[keptUpTo, heldLength)`.

A builder must not reorder the steps: the conditions read state that the earlier steps change.

### 3.5 Reader options: the four deliberate differences

The two readers share `SyllableBuffer`, `orderSyllable` and the held-character logic. They differ on purpose in four places (ARCHITECTURE.md, "The four deliberate differences between the readers"). Each difference is a named field of the reader's frozen options, and the reader reads it at the one place where it decides. No other branch may encode a difference. The options name the readers' behaviour; they are not switches. Only the shipped values are supported and tested.

| Option | FONT_READING | UNICODE_READING | Read at |
|---|---|---|---|
| `heldZeroWidth` | `ZW.ALL`: U+200B, U+200C, U+200D, U+2060, U+FEFF | `ZW.ZWSP \| ZW.WORD_JOINER \| ZW.BOM`. ZWNJ and ZWJ stay where they were typed: in Unicode they can shape the syllable. | `isHeld(buf, code, reading)` |
| `digitTakesMarksAcrossSpace` | `true`: after a held space, a mark joins any base | `false`: a Burmese digit base takes no mark from across a space | `marksGoOn(buf, reading)`, which is `!buf.spaceHeld \|\| reading.digitTakesMarksAcrossSpace \|\| !isBurmeseDigit(buf.base)` |
| `prebaseCrossesZeroWidth` | `true`: with no open syllable, a zero-width character is written at once, and pending e or medial ra go on waiting for the next base | `false`: an e or medial ra looks only at the unit right after its run, so a zero-width unit there makes it stay | font reader, step 2; Unicode reader, `placePrebaseMark` (§3.6) |
| `keepUAfterVowelSign` | `false`: Zawgyi and Win text is Burmese | `true`: U+1025 right after a vowel sign (U+102B-U+1032, U+1036) stays u, as Pa'o writes it | Unicode reader, step 3 |

`test/next/readers.test.mjs` pins each difference with the examples in the ARCHITECTURE.md section. The Unicode reader adds one rule of its own that is not one of the four: e and medial ra never go back across a space (research/normalize.md §3). It reads that rule from `buf.spaceHeld` in its step 6.

### 3.6 The readers

Both readers read UTF-16 units once, from left to right, and dispatch in the order below. **The order is part of the behaviour.** The authoritative behaviour is the oracle (`scripts/oracle/storageOrder.js`, identical to `library/storageOrder.js` at safety-net). The plan's verified prototypes are the starting point for the code:
- `SCR/performance/fused-arrange.js` for the Unicode reader;
- `SCR/engine/pc/fast-arrange.js` for the font reader.

They keep their hot state in the scratch `SyllableBuffer` and in one per-reader state object, and call module-level helpers. They create no closures per call (§6 of the plan, the remaining frontier).

**`reorderUnicode(text)`** (normalize; research/normalize.md §2-3)

The reader keeps per-call state in its scratch state object:
- `runEnd`: the end of the last run of e and medial ra that `placePrebaseMark` looked past;
- `pendingStart`: where the pending run started in `text`;
- `syllableStart`: where the open syllable's source begins in `text` (`pendingStart` when it took pending marks, else its kinzi or base), for `CopyThroughWriter.endSyllable`;
- `seen`: the presence flags.

The output goes through a `CopyThroughWriter` (§3.7). For each unit `code` at `i`, after updating `seen`:

1. **Held.** If `isHeld(buf, code, UNICODE_READING)`: `buf.hold(code, zeroWidth)`.
2. **Kinzi.** If the units at `i` are U+1004 or U+101B, then U+103A, U+1039 and a Burmese consonant: close the open syllable, open one with that kinzi lead, take the consonant as its base, and set `i += 3`.
3. **Base.** For a syllable base or Burmese digit, close and open a syllable. Digits count because zero and seven are typed for wa and ra. Set `keepU` when the code is U+1025, `UNICODE_READING.keepUAfterVowelSign` is true and the previous unit is a vowel sign.
4. **e or medial ra.** Call `placePrebaseMark(i)`:
   - `TO_NEXT_BASE`: close, set `pendingStart` if the pending list is empty, and `addPending`.
   - `STAYS`: close. The unit stays where it is.
   - `TO_OPEN_SYLLABLE`: go on to step 6.
5. **Virama.** If a syllable is open, the code is a virama, a Burmese consonant follows it (past any e or medial ra), and `marksGoOn` holds: `goOn`, push the skipped e or medial ra as marks, push the virama and the consonant to the stack, and move `i` to the consonant.
6. **Mark.** If a syllable is open and the code is a Burmese mark, `marksGoOn` holds, and not (`buf.spaceHeld` and the code is e or medial ra): `goOn`, then `pushMark`.
7. **Anything else** closes the open syllable. The unit stays in place and is copied through.

At the end: close.

`placePrebaseMark(i)` is the 2.x `placeTypedFirst`, minus the rescan. It decides in O(1) from the mask, and it reads each run of e and medial ra once:

1. If `i ≥ runEnd`, move `runEnd` past the run that starts at `i`. Let `after` be the unit at `runEnd`.
2. With no open syllable, if the unit before `i` is an other-script letter, return `STAYS`.
3. The open syllable is *finished* when any of these holds:
   - there is no open syllable;
   - `spaceHeld`;
   - the mask has `VOWEL_OR_FINAL`;
   - it has an asat, and the code is not medial ra, and it has no medial ha.
4. If it is not finished, or a syllable is open and `after` is a Burmese mark or virama, return `TO_OPEN_SYLLABLE`.
5. If `after` is a syllable base or Burmese digit, return `TO_NEXT_BASE`. Otherwise return `STAYS`.

Invariant: the pending list is empty whenever a unit is written in place, and at the end. A pending run is always followed by the base it waits for. The reader asserts this in tests, not at run time.

The reader returns `{ text, seen }`:
- `seen` has `SEEN.LETTER_U` for U+1025.
- `seen` has `SEEN.NFC_UNSAFE` for a unit at or above U+0300 that is neither in U+1000-U+109F nor `isNfcSafe`.

**`readFont(text, font)`** (Zawgyi and Win; research/zawgyi-to-unicode.md §2, research/win-fonts.md §5)

The output goes into the module's scratch `CodeBuffer`. For each unit `code`:

1. **Held.** If `isHeld(buf, code, FONT_READING)`: `buf.hold(code, zeroWidth)`.
2. **Zero-width with no open syllable.** Write it now. Pending e and medial ra keep waiting (`FONT_READING.prebaseCrossesZeroWidth`).
3. **No glyph.** Close, `writePending`, write the unit.
4. **BASE.** Close, open a syllable, and `setBaseText` from the glyph. Pending marks become its first marks.
5. **BEFORE_BASE.** Close, then `addPending` the glyph's marks.
6. **MARK, STACK or KINZI with an open syllable.** `goOn`; `marksGoOn` is always true for fonts.
   - STACK: push its text to the stack.
   - KINZI: set `kinziLead = U+1004`.
   - Push the glyph's marks.
7. **Anything else** (PLAIN, or a MARK, STACK or KINZI with no open syllable): close, `writePending`, write the glyph's text and its attached marks.

At the end: close, then `writePending`. Decode the buffer, release it if it is large (§3.11), and return the string.

### 3.7 CodeBuffer and CopyThroughWriter

**`CodeBuffer`** is a growable `Uint16Array`.

```ts
class CodeBuffer {
  constructor(capacity?: number)                 // default 256
  length: number
  push(code: number): void                        // doubles the capacity when full
  pushText(text: string, start: number, end: number): void
  pushCodes(codes: Uint16Array, start: number, end: number): void
  codeAt(i: number): number
  clear(): void                                   // length = 0; keeps the capacity
  equalsText(text: string, start: number, end: number): boolean   // same units as text[start, end)
  decode(): string                                // String.fromCharCode.apply on chunks of at most 8,192 units
  releaseIfLarge(): void                          // capacity above 65,536 units: back to the initial capacity
}
```

`decode` never uses `TextDecoder`, because it replaces lone surrogates (§3.4 of the plan).

**`CopyThroughWriter`** is the Unicode reader's output. It appends slices of the input and returns the input string itself when nothing changed (§3.4 of the plan). 99.92% of syllables and 93.6% of lines come out of `normalize` unchanged (`SCR/profile/floor.js`).

```ts
class CopyThroughWriter {
  begin(source: string): void          // copyFrom = 0; out = ''
  readonly syllable: CodeBuffer        // closeSyllable writes here; cleared by beginSyllable()
  beginSyllable(): void
  // Compares the syllable's codes with source[start, end): if they differ, appends source[copyFrom, start)
  // and the decoded codes, and sets copyFrom = end. `start` is where the syllable's source begins (its pending
  // e or medial ra, its kinzi or its base); `end` is where the unit that closed it begins.
  endSyllable(start: number, end: number): void
  finish(): string                     // source when nothing was appended; else out + source.slice(copyFrom)
  releaseIfLarge(): void
}
```

Every change the Unicode reader makes passes through `endSyllable`. Phase 6's change report (`normalize(text, {report: true})`) can therefore record an edit list there, without touching the reader.

### 3.8 Compiled fonts

`compileFont(definition)` checks the table and builds a `CompiledFont` once, at module load (in `engine/stages.js`). **The checks run at load and throw `libraryError(ERR.INVALID_FONT_TABLE, …)`** (PR 2.4 of the plan):

1. Every key is one UTF-16 unit.
2. Every role is a known `ROLE`.
3. For MARK and BEFORE_BASE rows, every unit of the text and of the attached marks has a rank (`markRank < RANK_UNRANKED`). For STACK and KINZI rows, every attached mark does.
4. The shapes of the texts:
   - BASE text is one unit (a syllable base or a Burmese digit), or a ligature (consonant, U+1039, consonant), or one of the font's declared `wholeBases`. Those are Zawgyi lagaung (U+104E U+1004 U+103A U+1038), and Win kyat and nnya-with-aa. Their inner marks are written as they are, not sorted, which is §7 #19 of the plan, kept on purpose.
   - STACK text is U+1039 plus a Burmese consonant.
   - KINZI text is `KINZI_TEXT`.
   - BASE texts are at most 8 units.
   - PLAIN text may be any string, empty included (Win's vendor logo at 0xB0 has no text).
5. Every alias names a key of the table. No `selfBases` code is also a key.

Built-in rule (2.x `font()`, storageOrder.js:206-209): every syllable base in U+1000-U+104F that the table does not list is a base of itself.

The `CompiledFont` layout is private to `readers.js`. It must give `readFont` these things:
- an O(1) glyph lookup by code: a `Uint16Array` index sized to the highest key plus 1, where 0 means no glyph. Win's index runs to U+2039, 8,250 entries.
- for each glyph: its role, its text units, the units it pushes as marks (text plus attached marks for MARK and BEFORE_BASE; attached marks only for STACK and KINZI), and its "whole" units (text plus attached marks, written when it cannot join);
- `name` and `sequences` for the stages.

All of this goes in flat typed arrays, built at load. There are no per-glyph objects.

### 3.9 Rule rows and traces

**Rule rows** (`RuleRow`, §2.3) replace 2.x's bare tuples. The row tables are:
- Unicode to Zawgyi: 65 rows in 2.x order, in the named sections SHAPES_IN_CONTEXT, KINZI, VISUAL_ORDER, SMALL_LETTERS, GLYPHS, NARROW_TA and MEDIAL_RA_SHAPES (PR 3.5 of the plan). GLYPHS stays sequential, because order matters inside it.
- the font sequences;
- the documented typo rows.

**Labels.** A row's `label` is its 2.x `RegExp#source`. For six Unicode to Zawgyi rows, the 2.x literal starts with a unit in U+1000-U+1010 (syllable.js:13, :53-56, :58). Their `re` wraps that first unit in a one-character class (decision 29), and the `label` keeps the old source.

**Typos.** `fixTypos` runs the four 2.x typo rules (typingFixes.js:12-17) as one global regex in one pass:
- i with ii, either order, is ii;
- u with uu, either order, is uu;
- o, e, aa, asat is au;
- four before nga, asat, visarga is lagaung.

The fourth rule checks the unit before the four by char code, because lookbehind is outside ES2015 (`SCR/cleanup/lib/typingFixes-fast.js`). No rule's replacement creates or removes a match of another rule, and no two rules' matches overlap. So one alternation, scanned once from left to right, equals the four sequential passes. The prototype's 4M targeted fuzz showed 0 differences (PR 2.6 of the plan).

**One trace shape (D4).**

| 2.x log | 2.x `steps` | As a Trace |
|---|---|---|
| font pipeline (storageOrder.js:462-485) | the input, then the text after each stage that changed it. "Changed" means it differs from the last recorded text, so `'syllables'` is compared with `'glyphs'` when that was recorded. | `start` = the input; one record per stage recorded by `runStages` |
| Unicode to Zawgyi (syllable.js:301-327) | the text before each logged rule, then the result | `start` = the collapsed text; one record per rule recorded by `traceRuleRows` |

They are the same list, `[start, ...records.map(r => r.text)]`, for a reason. Between two logged rules no rule changed the text: once rows are logged exactly when they change it, and every repeat row's match changes it (its replacement starts with a different unit, which a row test asserts). So "the text before rule k" is "the text after the previous logged rule", and the first one is the collapsed text. compat builds 2.x's `matched_patterns` from the records' `label`s. The 3.0 API will read their `id`s.

### 3.10 Stages and the gating policy

A pipeline is a frozen list of stages, run by `core/rules.js` `runStages` (D10). The `engine/stages.js` functions are three lines each:
- make a `StageContext`;
- for traces, call `startTrace`;
- call `runStages`.

The syllables stage of `NORMALIZE_STAGES` stores the reader's `seen` in `ctx.seen`. So `engine/stages.js` owns both the reader call and the gate check, and the contract sits in one place (§3.4 of the plan).

**A gate skips a stage only when the stage provably cannot change the text.** Only two gates ship (decision 28):

1. **The no-Myanmar fast path.** `normalizeText` returns `toNfc(text)` at once when `text` has no unit in the three Myanmar blocks (`hasMyanmarScriptChar`).
   - Proof: with no Myanmar unit, the reader writes every unit through unchanged, the typing fixes match nothing, and NFC cannot create Myanmar units (`SCR/verify-cleanup/p5`).
   - Measured: 127x on ASCII text (PR 1.5 of the plan).
2. **The final-NFC gate.** The last `'NFC'` stage of `NORMALIZE_STAGES` runs only when `ctx.seen` has `SEEN.LETTER_U` or `SEEN.NFC_UNSAFE`.
   - Proof: the reader's input is already NFC. The reader only reorders Burmese marks within a syllable, drops repeated or slipped marks, and turns ca, u and seven into jha, nya and ra. The typing fixes write only U+102E, U+1030, U+102A, U+104E, U+101D, U+101B, U+1040 and U+1047. None of these compose or reorder under NFC, except U+1025 followed by U+102E, which becomes U+1026. That is why `LETTER_U` opens the gate.
   - Every unit outside the blocks that NFC could move or compose sets `NFC_UNSAFE`. The safe set was checked over 943 code points on Node 26's ICU (`SCR/performance/nfc-safe-check2.js`). `test/next/codes.test.mjs` reruns that check on every runtime the tests run on (§10.5 of the plan).

**Nothing else is gated.**
- The typo and look-alike gates (PR 2.7) are not built: they would couple the typing-fix rules to the reader's trigger bits.
- Zawgyi, Win and Unicode to Zawgyi stay ungated. Their fused trigger bits were never prototyped, and the separate-scan version was slower on one big string: 62.1 ms against 55.2 ms (`SCR/judge-perfarch/zg-endstate.out`).

**The force switch.** `normalizeText(text, { openAllGates: true })` runs every stage and skips the fast path, as if every gate were open. Tests run the fuzz both ways and require the same output. They also check soundness directly: whenever the final-NFC gate stays closed, `toNfc(result) === result`. **The trace runner never gates** (§2.3, `runStages`).

### 3.11 Scratch buffers and memory

| Module | Scratch objects |
|---|---|
| `engine/readers.js` | the Unicode reader's `SyllableBuffer`, its state object and its `CopyThroughWriter`; the font reader's `SyllableBuffer` and its output `CodeBuffer` |
| `engine/syllable.js` | none: every buffer belongs to a `SyllableBuffer` or `CodeBuffer` instance |

Rules:
- Each reader resets its scratch at the start of each call.
- Each reader calls `releaseIfLarge()` on everything it used before it returns. A buffer that grew past 65,536 units goes back to its initial size. Without this, 33.4 MB stayed allocated after an 8.9M-char conversion (`SCR/verify-engine`, engine-P4).
- The readers never call code outside their module while a scratch object holds data, so a call cannot re-enter them.
- The two readers have separate scratch objects. One could call the other without harm.

Slices that copy-through returns keep the input string alive. ARCHITECTURE.md documents this when the core lands.

---

## 4. The stateless core contract

"The core" is every file in `src/` outside `compat/` and `spec/`. Its contract, from Phase 6 #1 of the plan:

1. **No configuration state.**
   - No module holds options, cached results, a loaded module, or a warned-once flag.
   - Module-level values are frozen data (tables, compiled fonts, rule rows) or the scratch objects of §3.11.
   - Top-level `let` and `var` are not allowed.
   - A global regex in a row is left with `lastIndex` 0 by `replace` and `search`, the only methods the core calls on it.
2. **No console and no environment.**
   - No `console`, `process`, `globalThis`, `window` or `self`.
   - No module loading of any kind (§2.2).
   - No `eval` and no `Function`.
3. **Per-call options.**
   - Every option arrives as an argument. Defaults come from `core/options.js` `DEFAULTS`.
   - Option objects are read, never written or kept.
   - Functions that take options are map-safe through `optionsObject`.
4. **Errors with codes.**
   - Everything the core throws on purpose is `libraryError(code, message, Ctor)` with a code from `ERR`.
   - Core functions document their preconditions (a string, a known font name, cleaned text) and trust their callers: compat now, and the 3.0 API later, which validates with `requireText` and friends.
   - On any string input, no core function throws by accident. A property test calls every core entry point on fuzzed strings.
5. **The myanmar-tools detector is injected.** `detect.js` takes a `zawgyiModel` object with `getZawgyiProbability(text)`. The core never loads it. compat loads it, for the 2.x API, in `compat/zawgyiModel.js` (D3).
6. **Determinism.** Outputs depend only on the arguments and on the runtime's NFC data.

`test/next/guards/stateless.test.mjs` checks this. It parses every core file with acorn and checks rules 1 and 2. It runs two configurations interleaved in one process:
- `detectFont` with two different stub models;
- `normalizeText` with and without `openAllGates`.

It requires each call to honour its own arguments, with no carry-over (Phase 6 exit). Every exported plain object and array must be `Object.isFrozen`, deeply for data tables. Typed arrays cannot be frozen; they are read-only by contract.

---

## 5. compat: the 2.x API on the core

### 5.1 Files and shape

| File | Exports | Holds |
|---|---|---|
| `compat/index.js` | `version`, `setGlobalOptions`, `fontDetect`, `fontConvert`, `syllBreak`, `spellingFix`, `truncate`, `normalize` (named), and `default` | The export object: those 8 keys in that order, plus a non-enumerable `default` that points to the object itself (main.js:13-26). `version` is `PACKAGE_VERSION`. |
| `compat/globalOptions.js` | `setGlobalOptions`, `isSilentMode`, `storedDetectorOptions`, `mergeDetectorOptions`, `report`, `reportAlways`, `MESSAGES` | The option store, the only module state besides the loader's. It is the only file that writes to the console. `report(level, message)` checks silent mode at call time and returns whether it printed. Both writers look `console[level]` up at call time, never at load, because the matrix swaps the console methods per cell. |
| `compat/input.js` | `INPUT_POLICY`, `enter`, `unboxString`, `cleanText`, `resolveFont`, `chooseFontLegacy`, `ON_TIE_ASSUME_ZAWGYI` | The 2.x preamble (D1) |
| `compat/legacy.js` | `legacyBreakFont`, `legacyCollapseFont`, `NO_RULES`, `legacyTypeError`, `toJoinSeparator` | 2.x's property-lookup quirks |
| `compat/zawgyiModel.js` | `loadZawgyiModel`, `missingModelMessage` | The myanmar-tools loader (D3) |
| `compat/fontDetect.js` | `fontDetect`, `fontDetectCore` | |
| `compat/fontConvert.js` | `fontConvert` (with `.debugging`) | |
| `compat/text.js` | `normalize`, `syllBreak`, `spellingFix`, `truncate` | |

The flows, as the builder writes them. `enter` returns `{kind: 'missing' | 'other' | 'text', value}`.

```
fontDetect(content, fallback_font_type, options = {})            // length 2, as in 2.x
  input = enter('fontDetect', content); if input.kind !== 'text': return fallback_font_type || 'en'
  if !hasMyanmarBlockChar(input.value): return fallback_font_type || 'en'
  return fontDetectCore(input.value, fallback_font_type || 'zawgyi', options)

fontDetectCore(text, fallback, options)                         // also the routing detector of the other functions
  cleaned = cleanText(text)                                     // trim, then stripZeroWidthBreaks
  requested = options.adapter                                   // null options: TypeError here, as in 2.x
  merged = mergeDetectorOptions(options)                        // may print the threshold error
  if pickAdapter(requested, merged) === 'rules': return decide(countEvidence(cleaned), fallback)
  model = loadZawgyiModel()
  if !model: warn once (silent-aware); return decide(countEvidence(cleaned), fallback)
  return scoreByZawgyiModel(cleaned, model, merged.myanmartools_zg_threshold, fallback)

fontConvert(content, to, from)                                  // a function, not an arrow: `this` is the receiver; length 3
  input = enter('fontConvert', content); if input.kind !== 'text': return input.value
  text = input.value
  if resolveFont(from) !== 'win' and !hasMyanmarBlockChar(text): return text
  if !to: report('error', MESSAGES.noTarget); return text
  text = text.trim(); target = resolveFont(to); source = resolveFont(from)
  if !target: report('error', MESSAGES.unknownTarget); return text
  if !source: source = fontDetectCore(text, ON_TIE_ASSUME_ZAWGYI, NO_OPTIONS)
  if target === source: return text
  if target === 'win' or (source === 'win' and target !== 'unicode'): report('error', MESSAGES.winSourceOnly); return text
  debug = this && this.debug                                    // read here, as converter.js:53 does
  if FONTS[source].visualOrder: return debug ? fontDebug(...) : fontToUnicode(text, source)
  return debug ? zawgyiDebug(...) : unicodeToZawgyi(text)
fontConvert.debugging = function (content, to, from) { return fontConvert.apply({ debug: true }, [content, to, from]) }
```

`syllBreak`, `spellingFix`, `truncate` and `normalize` follow C8-C24 below in the same style.

The order of calls matters wherever 2.x's order is observable:
- `syllBreak` cleans before it detects. Detection therefore sees the text cleaned twice, which is not the same as once when removing U+200B exposes spaces.
- `spellingFix` detects on the raw text, then cleans.
- `truncate` reads all its options before it looks at the content.

### 5.2 The 2.x behaviours compat reproduces

Each row is a behaviour of safety-net's library that the contract matrix or compare can see, with what provides it. "Core" names the core function or option. Everything else is a compat helper.

| # | 2.x behaviour (where) | Provided by |
|---|---|---|
| C1 | Eight exports in order, a non-enumerable `default` pointing back at the object, and `fontConvert.debugging`. Function lengths: `setGlobalOptions` 0, `fontDetect` 2, `fontConvert` 3, `syllBreak` 3, `spellingFix` 2, `truncate` 2, `normalize` 1, `debugging` 3 (main.js:13-26). Function names are not part of the contract. | `compat/index.js`, with the same default parameters |
| C2 | Store `{silent_mode: false, detector: {use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95]}}` (globalOptions.js:1-7) | `globalOptions.js`, initialised from core `DEFAULTS` |
| C3 | `setGlobalOptions(options = {})`. Own enumerable keys, read with `Object.keys`, so `null` throws a TypeError. `silent_mode` is stored as given, and any truthy value is silent. `detector` is merged by C4. Returns undefined. | `setGlobalOptions` |
| C4 | The detector merge (globalOptions.js:13-35): `hasOwnProperty` per key; missing keys come from the *current* store; the threshold must be an array whose `[0]` and `[1]` are of type number, so NaN passes; otherwise `console.error` the threshold message **even in silent mode** and keep the stored threshold. The result's threshold is a copy. | `mergeDetectorOptions`, `reportAlways` |
| C5 | String objects are unwrapped by their `[object String]` tag (contentGate.js:17-19) | `unboxString` in `enter` |
| C6 | Missing content: `null`, `undefined`, `''`, `0`, `false` or `NaN` warns (silent-aware) and returns `''`. `fontDetect` returns `fallback \|\| 'en'`. For `truncate`, `''` is not missing. | `INPUT_POLICY`, `enter` |
| C7 | Other non-strings: returned as they are. `fontDetect` returns `fallback \|\| 'en'`. `truncate` uses `String(content)`, so `Object.create(null)` throws a TypeError. | `INPUT_POLICY`, `enter` |
| C8 | The Myanmar gate is U+1000-U+109F only, not Extended-A/B:<ul><li>`fontDetect` returns `fallback \|\| 'en'`;</li><li>`fontConvert` returns the text unchanged, unless the source resolves to `'win'`, whose check comes first;</li><li>`syllBreak` and `spellingFix` return the text unchanged;</li><li>`truncate` takes the `substr` path;</li><li>`normalize` has no gate.</li></ul> | core `hasMyanmarBlockChar` |
| C9 | Cleaning is trim plus U+200B and U+200C removed (contentGate.js:33-36). It applies to `fontDetect`, to `syllBreak` before breaking, to `spellingFix` after detection, and to `truncate`'s parts. `fontConvert` trims and removes nothing. | `cleanText` = `stripZeroWidthBreaks(text.trim())`, at 2.x's call sites |
| C10 | Font names (contentGate.js:25-31): `null`, `undefined` and `''` mean none. Otherwise `Object.prototype.hasOwnProperty.call(aliases, name)`, which converts `name` to a property key, so `['zawgyi']` resolves and an object whose `toString` throws, throws. Names are case-sensitive. | `resolveFont` over core `FONT_ALIASES` |
| C11 | `syllBreak`, `spellingFix` and `truncate`: a falsy font name means detection with fallback `'zawgyi'`; otherwise `resolveFont(name) \|\| name`, kept as given | `chooseFontLegacy`, `fontDetectCore` |
| C12 | Rule tables looked up as plain-object properties (syllable.js:216, :260): `BREAK_RULES[name]` and `COLLAPSE[name] \|\| COLLAPSE.unicode`. The outcomes:<ul><li>`'win'`, `'Unicode'`, `1` and other unknown names throw a TypeError in `syllBreak` and `truncate`; `spellingFix` uses the Unicode marks for them.</li><li>Inherited `Object.prototype` names whose value has a `length` above 0 (`constructor`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `__lookupGetter__` and the rest) throw a TypeError in all three.</li><li>Names with length 0 or no length (`toString`, `valueOf`, `toLocaleString`, `__proto__`) run no rules: the text comes back cleaned, with no breaks and no collapse.</li></ul> | `legacyBreakFont` / `legacyCollapseFont` do the same property lookup on plain objects with 2.x's own keys and return `'unicode'`, `'zawgyi'` or `NO_RULES`, or throw `legacyTypeError()` (D13) |
| C13 | `fontDetect` (detector.js:126-156):<ul><li>`fallback \|\| 'zawgyi'` for detection, and a tie returns the fallback as given, of any type;</li><li>`options = {}` only for undefined, and `options.adapter` is read before the merge;</li><li>the adapter is the requested one when that is `'rules'` or `'myanmartools'`; otherwise myanmar-tools when the merged `use_myanmartools` is truthy, else the rules. So `{adapter: 'foo'}` falls through to `use_myanmartools`;</li><li>the model path uses the merged threshold;</li><li>if loading failed, warn once and use the rules.</li></ul> | `fontDetect`, `fontDetectCore`, `pickAdapter`; core `scoreByZawgyiModel` |
| C14 | The rule scorer: the `String#match` counts of the 29 signatures on the cleaned text; unicode > zawgyi, unicode < zawgyi, else the fallback | core `countEvidence`, `decide` |
| C15 | `fontConvert`'s order of checks, messages and trims (converter.js:11-59; §5.1). The source is detected on the trimmed text, with the global detector options. The same font returns the trimmed text. Win as a target, or Win to anything but Unicode, is an error that returns the trimmed text. | `fontConvert` |
| C16 | The debug flag is `this && this.debug`, read after the early exits. `debugging` is `fontConvert.apply({debug: true}, [a, b, c])`. A detached call: §5.4. | `fontConvert` |
| C17 | Zawgyi and Win to Unicode (storageOrder.js:462-485). Debug object `{to: 'unicode', from, matched_patterns, steps}` with the stage names of §2.3. `'glyphs'` appears only when debugging. | core `fontToUnicode`, `traceFontToUnicode` |
| C18 | Unicode to Zawgyi (converter.js:57-58; syllable.js:301-327): the Unicode mark collapse, then 57 once rows and 8 repeat rows of at most 40 passes. Debug object `{to: 'zawgyi', from: 'unicode', matched_patterns: labels, steps: [collapsed text, …]}` (§3.9). | core `unicodeToZawgyi`, `traceUnicodeToZawgyi` |
| C19 | `debugging` returns what `fontConvert` returns on every early exit: strings, `''`, non-strings (§7 #3 of the plan) | the same flow |
| C20 | `syllBreak`'s separator (syllable.js:272-275): a falsy separator, or U+200B, means U+200B. Anything else is converted as `Array#join` converts it: `toString` before `valueOf`, and a Symbol throws a TypeError. | `toJoinSeparator(value)` = `['', ''].join(value)`, called after the rule-table lookup, as in 2.x |
| C21 | The break output: Unicode rows U1-U7; Zawgyi rows Z1-Z8, with row Z6 off for text that `looksLikeSgawKaren`; bare consonants joined only in pairs (§7 #11); no break at the start | core `breakString`, `breakParts` |
| C22 | `spellingFix` detects on the raw text, then cleans, then collapses each run of one repeated mark (per font set, syllable.js:210-213) | core `collapseRepeatedMarks` |
| C23 | `truncate` (truncate.js):<ul><li>`options \|\| {}`; `length \|\| 30`; `omission \|\| '...'`; budget = `length - omission.length`, NaN allowed;</li><li>text with no Myanmar block character: `text.substr(0, budget) + omission`;</li><li>otherwise the parts of the cleaned text; whole parts while they fit; a part that does not fit is split on `\s` and adds the words that fit, each followed by a space; then trim, plus the omission;</li><li>not always a prefix (§7 #5).</li></ul> | `truncate` with `fitParts`; core `breakParts` |
| C24 | `normalize`: NFC, the reader, typos, look-alikes, NFC (normalization.js:22-23). Text with no Myanmar still gets NFC. Typos run before look-alikes, while the fonts run zero as wa, then look-alikes, then typos (§7 #8). Not idempotent on garbled input (§7 #12). | core `normalizeText` |
| C25 | The console messages and when they print (§5.3) | `MESSAGES`, `report`, `reportAlways` |
| C26 | myanmar-tools is loaded at most once per process, by the first call that needs it, as the 2.x ES module build does: Node and Bun only, through `process.getBuiltinModule('module').createRequire(process.cwd() + '/package.json')`. It is not loaded in other runtimes. A package without `ZawgyiDetector` counts as a load error. One of three messages is printed once. The warned flag is set only when a message is printed. | `zawgyiModel.js` (D3) |
| C27 | `Array#map` use: every function receives `(value, index, array)`, and the index and array land in the fallback, `to`/`from`, font, separator and options positions with exactly the semantics above | the same parameter lists |

Everything that compare or the matrix can observe is in this table. A behaviour found later goes into this table, with a test.

### 5.3 Console messages

| Level | When | Text |
|---|---|---|
| warn | missing content, unless silent | `Content must be specified on knayi.<name>.`, where `<name>` is fontDetect, fontConvert, syllBreak, spellingFix, truncate or normalize |
| error | `fontConvert` with no target, unless silent | `Convert target font must be specified on knayi.fontConvert.` |
| error | unknown target, unless silent | `Convert library dosen't have this fontType.` (sic: fixing the spelling is PR 4.3) |
| error | Win as a target, or Win to anything but Unicode, unless silent | `knayi.fontConvert converts Win text to Unicode only.` |
| error | invalid threshold, **always** | `myanmartools_zg_threshold must be [number, number]` |
| warn | myanmar-tools missing, once, unless silent | No error recorded: `myanmar-tools is not available in this environment; fontDetect used the rule scorer.` An error whose `code` ends in `MODULE_NOT_FOUND` and whose first line names `'myanmar-tools'`: `myanmar-tools is not installed; fontDetect used the rule scorer. Install myanmar-tools@1.1.3 to use it.` Any other error: `myanmar-tools could not be loaded (<first line of its message>); fontDetect used the rule scorer. Install myanmar-tools@1.1.3.` |

### 5.4 The one known build difference

A detached call, such as `const f = knayi.fontConvert; f(text, 'unicode')`, made while the page has a global `debug` variable:

| Build | Result |
|---|---|
| sloppy-mode builds (`main.js` and the script builds) | the debug object |
| the 2.x ES module build and compat | the text, because both are strict |

The matrix already records this for `knayi-myscript.mjs` under "debug flag read from this" (scripts/contract/matrix.js:28-37). It is 10 cells, the ids beginning `detached fontConvert(`. The compat module (W8) does three things:
- adds `compat` to that entry's `builds`;
- adds `compat` to `BUILDS`, loaded with `import()` of `src/compat/index.js`;
- records the 10 cells with `npm run matrix:update`.

That records nothing new about `main.js`, and no other cell may differ (D2).

### 5.5 What compat does not do

- **No new exports or options.** That rules out `detectEncoding`, `zawgyiDetector`, types and overloads (Phase 5).
- **No contract fixes.** Phase 1c (PRs 4.3-4.5) and PRs 4.1-4.2 are not applied.
- **No output change.** Phase 4 is not applied.
- **No deep paths.** `knayi-myscript/library/converter` remains `library/`'s.
- **No browser build.** That is Phase 6 packaging.

The 2.x line brings each of these, and they reach compat through §8.

---

## 6. Verification

### 6.1 Test layout and shared helpers

- **Layout.**
  - `test/next/<module>.test.mjs`: module tests.
  - `test/next/guards/*.test.mjs`: the rules of §2.2, §4, §1.2 and §6.2.
  - `test/next/*.timing.mjs`: growth checks. They run after the other tests, like test/growth.timing.js.
- **npm scripts.** The `test` script gains the globs `"test/**/*.test.mjs"` (in the first `node --test`) and `"test/**/*.timing.mjs"` (in the second). `npm run test:fuzz` gains `test/next/**/*.fuzz.test.mjs`. `bun test ./test` picks the files up as they are.
- **File names.** Each module has `<module>.test.mjs` for its unit tests and `<module>.fuzz.test.mjs` for its differential tests. The fuzz files match both globs, so `npm test` runs them at PR scale and the nightly fuzz job runs them at scale 100. §7 names only the unit file of each module.
- **`test/next/helpers.mjs`** provides these, through `createRequire` for the CommonJS files and `import` for the `.mjs` ones:
  - `oracle` (`scripts/oracle`);
  - `internals(file, names)` (`scripts/testing/internals.js` `loadWithInternals`), which reaches 2.x private functions such as `order`, `arrange`, `font`, `glyphsInTypedOrder`, `zeroAsWa`, `BREAK_RULES`, `COLLAPSE` and `convertRules`;
  - `library(name)` for `library/*.js`;
  - `arb` (`scripts/testing/arbitraries.js`);
  - `fuzz` (`SEED`, `runs`, `check` of `scripts/testing/fuzz-settings.js`);
  - `tableProbes()` (`test/fixtures/tables.json`);
  - `SHAPES`, `PUMPS` (`scripts/eval/lib/inputs.mjs`).
- **Fuzz scale.** Fuzz counts below are PR-scale. They scale with `KNAYI_FUZZ_SCALE`, which the nightly fuzz workflow runs at 100. At the default scale the `next` tests add at most about 30 s to `npm test`.

### 6.2 What every module's tests do

1. **Unit tests** from this spec's rules and the rows' `example`s.
2. **Differential tests** against the 2.x function the module replaces (table below). They use fast-check arbitraries and the regression strings of test/fuzz.test.js, which run first. Every output must be identical, error class included.
3. **Table probes:** one per row and per branch of a row (`test/fixtures/tables.json`), through the module's entry point and the oracle.
4. **Growth:** every adversarial shape in `SHAPES` and every single-character run in `PUMPS`, through the module's entry point, at n, 2n and 4n units. The growth exponent must be ≤ 1.3, by the screening and confirming method of test/growth.timing.js. Growth that comes from NFC itself is known and listed as in that file.
5. **Guards**, all green:
   - layers (§2.2);
   - errors: every `throw` in `src/` throws `libraryError(...)`, except `legacyTypeError()` in `compat/legacy.js` (D13);
   - stateless core (§4);
   - floor (D14): acorn at ES2015, the regex floor (no lookbehind, named groups, `\p{}` or `s` flag in any regex, literal or built), and the ES2016+ built-in denylist;
   - function size: every function in `src/` is at most 40 lines, except `reorderUnicode` and `readFont`, which may reach 70;
   - atom lint: no `re` in a rule row and no `indexOf` needle is a pure literal starting at exactly U+1000-U+1010 (decision 29);
   - no `NOT_BUILT` stub left, from the acceptance gate on.

The 2.x reference for each module:

| Module | 2.x reference | Reached through |
|---|---|---|
| codes | `isMyanmarLetter`, `isUnicodeMark`, `isConsonant`, `isDigit`, `isOtherMyanmar`, `isTypedFirst`, `isSpace`, `isZeroWidth`, `RANK`/`rank` (storageOrder.js); `MARK`, `TONE`, `CONSONANT`, `WORD_CHAR`, `ANY_DIGIT` (typingFixes.js); `MYANMAR` (contentGate.js) | `internals` |
| core/rules | `replaceOnce`, `replaceRepeated`, `convertText` with debug (syllable.js); the `step()` logic of `toUnicode` | `internals`, `oracle.storageOrder` |
| typing-fixes | `lookAlikes`, `typos` (typingFixes.js); `zeroAsWa` (storageOrder.js) | `oracle.typingFixes`, `internals` |
| segment | `breakParts`, `joinParts`, `collapseMarks`, `BREAK_RULES`, `COLLAPSE` (syllable.js) | `library('syllable')`, `internals` |
| detect | the 29 signatures and `scoreWithRules` | `oracle.signatures` |
| engine-unicode | `order`, `arrangeUnicode`; `normalize` | `internals`, `oracle` |
| engine-fonts | `font`, `arrange`, `glyphsInTypedOrder`, `toUnicode(x, font, true)`; `zawgyi.toUnicode`, `win.toUnicode`; the 2.x tables | `internals`, `oracle` |
| unicode-to-zawgyi | `convertRules`, `collapseMarks`, `convertText` | `internals`, `library('syllable')` |
| compat | `main.js` at safety-net | compare, the matrix, `library/` |

### 6.3 The acceptance gate

The core is done when all of the following pass on `next`, run on a quiet machine with every corpus in `.eval-cache/`, mC4 included:

```bash
# 1. Both suites: the 2.x tests, unchanged, and test/next. Node 22, 24 and 26, then Bun.
npm test
npm run test:bun

# 2. Byte identity: compat against safety-net's main.js on every call form and input set.
npm run compare -- --base safety-net --head mjs:src/compat/index.js
npm run compare -- --base safety-net --head mjs:src/compat/index.js --fuzz 200000 --seed 7
bun scripts/eval/compare.mjs --base safety-net --head mjs:src/compat/index.js

# 3. The contract matrix, with compat among matrix.BUILDS (§5.4), under Node and Bun.
node --test test/contract/api-matrix.test.js
bun scripts/bun-matrix.js

# 4. Speed and growth (§6.4).
npm run perf -- --base safety-net --head mjs:src/compat/index.js

# 5. Sizes, reported.
node scripts/next/size.mjs
```

Each command must show:

1. **The suites** are green, with no `NOT_BUILT` stub left.
2. **compare** prints `OK: 0 differences`, with no `--expect` and no `--without`. It covers:
   - all 20 call forms of `scripts/eval/lib/callForms.mjs`, the four `debugging.*` forms included, and no form missing in the head;
   - every corpus set, mC4 included;
   - `generated.pairs`, `generated.extended`, `generated.rows`, `generated.win` and `generated.cp1252`;
   - `fuzz.block`, `fuzz.marks` and `fuzz.win`, at both seeds.
3. **The matrix** shows every cell (3,523 today) matching for `compat` on Node and Bun. Its only known build differences are the 10 cells of §5.4. The order-independence check also runs on compat.
4. **perf** meets the targets of §6.4:
   - no Node row above the base, and any row above 0.95 explained;
   - every growth exponent ≤ 1.3 under Node and Bun;
   - Bun rows reported, and any Bun row over 1.10 explained.
5. **The size report** lists compat and a normalize-only import (§6.4).

CI for `next`: `.github/workflows/test.yml` already runs on every pull request, whatever its base, but on pushes only to `main`. W8 adds `next` to the push branches, and a `Compat` job that runs steps 2 and 3 with `--without mc4` (CONTRIBUTING.md: mC4 stays out of CI). Phase 6 later points that job at the last 2.x release instead of `safety-net`.

### 6.4 Performance targets

Ratios are head/base time from `npm run perf` (`--base safety-net --head mjs:src/compat/index.js`), in Node, on a quiet machine. Below 1 is faster, so ≤ 0.33 means "3x or faster". The targets come from §6 of the plan. "Measured" cites the prototype run. "Estimate" marks a number composed from stage shares, never measured end to end. Those rows are confirmed or corrected by this run, and the PR states which.

| perf form | Workload | Target | Evidence |
|---|---|---|---|
| `normalize` | line | ≤ 0.33 | measured 3.06x with the simple gates (`SCR/planner/restraint.js`) |
| | word | ≤ 0.42 | measured 2.42x with the simple gates |
| | string, document | ≤ 0.29 | measured 3.99x |
| `fontConvert.zawgyi-unicode` | line | ≤ 0.40 | measured 2.57x, reader only (`SCR/judge-perfarch/zg-endstate.out`) |
| | word | ≤ 0.60 | measured 1.77x |
| | string, document | ≤ 0.29 | measured 3.72x |
| `fontConvert.detected-unicode` | line | ≤ 0.40 | estimate: detection was 33.8% of the call and gets 4x or more, conversion 2.5x |
| `fontConvert.unicode-zawgyi` | line, word | ≤ 0.63 | Phase 1 target: atom wrap −36..−39%, collapse −4.6% |
| `fontConvert.win-unicode` | all | ≤ 1.00, reported | same engine as Zawgyi. The text is synthetic, so the target is set after PR 0.9's Win set; claims are "Win identity only" (decision 26). |
| `fontDetect`, `fontDetect.unicode` | line, word | ≤ 0.25 | measured 5.4x in isolation, 3-5x in mixed order (`SCR/api-verify`, P1) |
| `syllBreak.unicode` | line | ≤ 0.33 | measured 3.1-3.4x (`SCR/syllables-verify`) |
| `syllBreak.zawgyi` | line | ≤ 0.50 | measured 2.3x |
| `syllBreak.detected` | line | ≤ 0.33 | estimate (detection was 45.9% of the call) |
| `spellingFix.unicode` | line | ≤ 0.77 | Phase 1 target |
| `spellingFix.zawgyi` | line | ≤ 0.33 | measured 3.4x (38.4 → 11.2 ms, PR 1.3) |
| `truncate.30` | line | ≤ 0.50, reported | estimate: the breaks get 3x and detection 4x, while the fit loop is unchanged |
| `debugging.*` | all | reported | the trace path; no target |

Other targets:
- **Growth:** every shape and pump ≤ 1.3 under Node and Bun. The old 2.10 quadratic paths stay linear: U+1000 followed by (U+200B U+102C) repeated 1M times must run in under 100 ms (PR 0.0 of the plan).
- **Memory:** no scratch buffer above 65,536 units after a call. A test checks `scratchUnitsForTests()` after an 8.9M-character call.
- **GC share of normalize** under 10%. Informational: copy-through measured 9% (`SCR/verify-cleanup`, P2).
- **Bun:** reported, not gated, because the reader prototypes were timed only on Node (§8.2 of the plan). The break scanners must be faster than the base on Bun (measured 4.0-4.7x).
- **Size** (`scripts/next/size.mjs`, esbuild IIFE at ES2015, minified, Node zlib level 9, as scripts/check-size.js measures):
  - compat: target ≤ 10,854 B, the 2.x limit;
  - a normalize-only import of `normalizeText`: target ≤ 4.3 KB (infra-8 measured 4,268 B);
  - reported per module from the metafile.

The techniques, in order of measured value (§6 of the plan):
1. No quadratic paths. Every run is read once, and the mask answers "has a vowel" in O(1).
2. No regex or `indexOf` needle that starts at U+1000-U+1010 (the V8 slow path; lint).
3. One char-code pass instead of N regex passes: the readers, the detector and the break scanners.
4. No per-syllable allocation: typed arrays, the mask, reused scratch. One small result object per call is fine.
5. Copy-through output.
6. The two gates, and no others.
7. Typed-array decoding in chunks of at most 8,192 units, never `TextDecoder`.

Not worth doing (measured): skipping the first NFC; lazy tables; merging Win's four sequences; exec-loop counting in the detector; esbuild `charset: utf8`.

---

## 7. Work split

### 7.1 Order and branches

```
W0 codes               first, alone: the skeleton of every file
W1 core                after W0
W2 typing-fixes        after W0
W3 segment             after W0
W4 detect              after W0, W1
W5 engine-unicode      after W0, W1, W2
W6 engine-fonts        after W0, W1, W2, W5 (its font data and compileFont need only W0)
W7 unicode-to-zawgyi   after W0, W1, W3
W8 compat              after all of them; its option, input and legacy files need only W0, W1
```

- **W0 lands alone and first.** It creates every file with its final exports (D12).
- **W1-W8 are built in parallel**, each on a branch from `next` after W0, named `next-<module>` (for example `next-engine-unicode`). Each opens a PR into `next`.
- **Merge order:** W1, W2, W3, W4, W5, W6, W7, W8. A module merges only after the modules it assumes. Its branch is rebased on `next` first, and its tests pass on the rebased branch.
- **Testing before a dependency lands.** A builder who needs an unmerged dependency merges that branch locally, and never commits the result.
- **Shared files.** `engine/readers.js` and `engine/stages.js` each have two sections, marked in W0's skeleton: one for engine-unicode and one for engine-fonts. Each builder edits only their own section.
- **Changes to this spec.** A builder who must depart from it updates this file in the same PR and says why.

### 7.2 W0: codes

- **Owns:**
  - `src/package.json`, `src/version.js`, `src/script/codes.js`, `src/core/errors.js`;
  - the skeleton: every other `src/` file of §2.1. Each function has its final signature and throws `libraryError(ERR.NOT_BUILT, '<file> <name> is not built yet')`. Data exports are frozen empty values of the right type, and each class's constructor throws the same error. `FONT_READING`, `UNICODE_READING`, `SEEN` and `ASAT_PLACE` are complete, since this spec defines them. The section markers go in `engine/readers.js` and `engine/stages.js`.
  - `test/next/helpers.mjs`, `test/next/codes.test.mjs`, `test/next/unicode.test.mjs`, all of `test/next/guards/`;
  - the package.json test globs.
- **May assume:** nothing.
- **Done:**
  - Every predicate and class in `codes.js` agrees with its 2.x definition (§6.2 table) on all 65,536 BMP code units.
  - `MARK_RANK` equals 2.x `rank()` on every code, the named ranks are 3, 4, 5, 6, 8 and 12, and each mask equals its definition.
  - `isNfcSafe` passes the nfc-safe check on the runtime.
  - The Unicode test passes.
  - `PACKAGE_VERSION` equals package.json.
  - The guards are green on the skeleton. The function-size and atom lints run on real code only.
  - `npm test` and `npm run test:bun` are green.

### 7.3 W1: core (options, input, rules, nfc, traces)

- **Owns:** `src/core/options.js`, `input.js`, `rules.js`, `nfc.js`; `test/next/core-*.test.mjs`.
- **May assume:** W0.
- **Done:**
  - `DEFAULTS` equals the 2.x defaults (globalOptions.js:1-7, truncate.js:9-10, syllable.js:273).
  - `FONT_ALIASES` equals contentGate.js's own keys and values.
  - `hasMyanmarBlockChar` agrees with `contentGate.hasMyanmar` on strings.
  - `applyRuleRows` agrees with 2.x's per-row `replace` and `replaceRepeated` on every 2.x table: `convertRules`, the Zawgyi and Win sequences, the typos. 100k fuzz plus the table probes.
  - `traceRuleRows` over rows made from `convertRules` reproduces `convertText(…, true)`, mapped by §3.9.
  - **`runStages` with a trace reproduces `oracle.storageOrder.toUnicode(x, font, true)`** (matched_patterns and steps) on 50k Zawgyi and Win fuzz strings. It runs a stage list built from the oracle's own stage functions, which proves the runner and the trace rule independently of the new engine.
  - The gates are skipped only when no trace is given and `openAllGates` is false.
  - `toNfc` agrees with `normalize('NFC')`.
  - `requireText` throws with its code.

### 7.4 W2: typing-fixes

- **Owns:** `src/engine/typingFixes.js`, `test/next/typingFixes.test.mjs`.
- **May assume:** W0.
- **Done:**
  - `fixTypos`, `fixLookAlikes` and `zeroAsWa` agree with `oracle.typingFixes.typos`, `oracle.typingFixes.lookAlikes` and 2.x `zeroAsWa`. The fuzz is 200k targeted strings over digits, wa, ra, zero, seven, separators, signs, marks, tones and the Shan and Tai Laing digits; nightly it is 4M (PR 2.6 of the plan).
  - Issue #43's Shan cases pass.
  - `isInNumber` is unit-tested for both contexts.
  - Every regex is ES2015.
  - Growth ≤ 1.3 for each function.
- Two orders are kept on purpose:
  - **the two typing-fix orders.** `NORMALIZE_STAGES` runs typos then look-alikes, and `FONT_STAGES` runs look-alikes then typos. The stage lists own this order; the module only provides the functions.
  - **the two zero-in-a-number rules** (§2.3).

### 7.5 W3: segment

- **Owns:** `src/segment.js`, `src/spec/breakRules.js`, `test/next/segment.test.mjs`.
- **May assume:** W0.
- **Done:**
  - The spec rows equal `library/syllable.js` `BREAK_RULES`: sources, flags, replacements and the switch. Each row has its `why`, `source` and `example`.
  - `breakParts` and `breakString` agree with 2.x `breakParts` and `joinParts(breakParts(…), sep)` for both fonts. The inputs are cleaned fuzz, with U+200B and U+200C removed: 200k on a PR, 1M nightly. The same inputs are also checked against the spec rows run by the 2.x algorithm.
  - `collapseRepeatedMarks` agrees with 2.x `collapseMarks` for both fonts on 300k strings.
  - `forEachBreak` stops when `onBreak` returns false.
  - Each join reason is a named predicate citing its row. The pairwise rule is `legacyBareConsonantPair`, and the S'gaw Karen switch is `looksLikeSgawKaren` (PRs 3.3-3.4).
  - Growth ≤ 1.3.
  - Start from `SCR/syllables-verify/proto/library/scan.js`.

### 7.6 W4: detect

- **Owns:** `src/detect.js`, `src/spec/detectorSignatures.js`, `test/next/detect.test.mjs`.
- **May assume:** W0, W1 (`DEFAULTS`, `NO_OPTIONS`, `optionsObject`).
- **Done:**
  - The spec rows equal `scripts/oracle/signatures.js`, in source and side. Each row has its `why`, `source` and `example`.
  - `countEvidence` equals the per-side sums of `String#match` counts, including the non-overlapping count of U+1031 U+1031 (row Z15) and the `^` and `$` anchors:
    - exhaustively over every string of length ≤ 3 on a boundary alphabet: every unit named in a signature, both edges of each range, the five detector whitespace units, U+000B (which is not one of them) and `a`;
    - length ≤ 4 nightly (5,884,901 strings, `SCR/api-verify` P1);
    - 200k fuzz.
  - `decide` agrees with `scoreWithRules`.
  - `scoreByZawgyiModel` handles its boundaries: `<`, `>` and equal (the fallback).
  - `detectFont` honours its per-call options (the two-configuration test).
  - Growth ≤ 1.3.
  - Start from `SCR/api-verify/v-scorer/library/detector.js`, which returns a difference. `countEvidence` returns both counts, as Phase 5's `detectEncoding` needs.

### 7.7 W5: engine-unicode

- **Owns:**
  - `src/engine/syllable.js`, all of it: `SyllableBuffer`, `orderSyllable` and its steps, `CodeBuffer`, `CopyThroughWriter`, `isHeld`, `marksGoOn` (D9);
  - the Unicode section of `engine/readers.js` (`reorderUnicode`, its helpers and scratch, `scratchUnitsForTests`);
  - the normalize section of `engine/stages.js` (`NORMALIZE_STAGES`, `normalizeText`, `traceNormalizeText`);
  - `test/next/syllable.test.mjs`, `readers-unicode.test.mjs`, `normalize.test.mjs`, `normalize.timing.mjs`.
- **May assume:** W0, W1 (`runStages`, traces, `toNfc`, `NO_OPTIONS`, `hasMyanmarScriptChar`), W2 (`fixTypos`, `fixLookAlikes`).
- **Done:**
  - `orderSyllable`, through an adapter from 2.x syllable records, agrees with 2.x `order()` on 200k fast-check records. The records cover kinzi or none; one-unit, ligature and whole bases; stacks; 0-12 marks with repeats; and `keepU`.
  - `reorderUnicode(x).text` agrees with `oracle.storageOrder.arrangeUnicode(x)`: 200k fast-check strings plus the test/fuzz.test.js regressions on a PR; 1M plus 400k random strings nightly (`SCR/performance/cls-check.js` method).
  - `normalizeText` agrees with `oracle.normalize`, both with the default gates and with `openAllGates`.
  - When the final-NFC gate stays closed, `toNfc(result) === result`.
  - `traceNormalizeText` gives the same result, and the stage-by-stage texts of the oracle.
  - The ARCHITECTURE.md examples of the four differences pass.
  - `scratchUnitsForTests()` is ≤ the initial sizes after an 8.9M-char call.
  - Growth ≤ 1.3 on every shape and pump.
  - Function sizes are within the limits.
  - The PR quotes an interleaved ratio against `oracle.normalize` from a run on a quiet machine. The binding speed check is the gate's perf run.

### 7.8 W6: engine-fonts

- **Owns:**
  - `src/fonts/zawgyi.js`, `src/fonts/win.js`;
  - the font section of `engine/readers.js` (`compileFont`, `readFont`, `glyphsInTypedOrder`, and its scratch);
  - the font section of `engine/stages.js` (`FONT_STAGES`, `fontToUnicode`, `traceFontToUnicode`, the compiled fonts);
  - `test/next/fonts.test.mjs`, `readers-font.test.mjs`, `fontToUnicode.test.mjs`, `fonts.timing.mjs`.
- **May assume:** W0, W1, W2 (`zeroAsWa`, `fixLookAlikes`, `fixTypos`), W5 (`SyllableBuffer`, `closeSyllable`, `CodeBuffer`, `isHeld`, `marksGoOn`). The font data and `compileFont` can be built before W5 lands.
- **Done:**
  - The tables equal 2.x, with every 2.x row present and each role mapped. The compiled lookup agrees with 2.x `storageOrder.font(...)` (via `internals`) for all 65,536 codes: role, text and marks.
  - For each check of §3.8, one test shows a deliberately broken row being refused with `ERR_KNAYI_INVALID_FONT_TABLE`.
  - `readFont` agrees with 2.x `arrange` on 200k fast-check Zawgyi and Win strings.
  - `fontToUnicode` agrees with `oracle.zawgyi.toUnicode` and `oracle.win.toUnicode`: 100k each on a PR, 300k nightly, plus the regressions of test/fuzz.test.js, the generated Win sets of `scripts/eval/lib/inputs.mjs` and the table probes.
  - `traceFontToUnicode` agrees with `toUnicode(x, font, true)` (matched_patterns and steps) on 50k strings.
  - The heap check passes after an 8.9M-char conversion.
  - Growth ≤ 1.3.
  - The Win results are labelled "Win identity only", because there is no hand-checked Win set yet (PR 0.9 of the plan).

### 7.9 W7: unicode-to-zawgyi

- **Owns:** `src/unicodeToZawgyi.js`, `test/next/unicodeToZawgyi.test.mjs`.
- **May assume:** W0, W1 (rows, traces), W3 (`collapseRepeatedMarks`).
- **Done:**
  - There are 57 once rows and 8 repeat rows, in 2.x order. For each row: `label` equals the 2.x `RegExp#source`; `to` equals the 2.x replacement; the flag is `g`; `repeat` is right; and `re` is the 2.x literal, or for the six rows of §3.9 its wrapped-first-unit form. Each row has a section and a `why`.
  - The atom lint passes.
  - Every repeat row's matches change the text (§3.9).
  - `unicodeToZawgyi` agrees with 2.x `convertText(collapseMarks(x, 'unicode'), 'unicode', 'zawgyi')` on 200k strings, the table probes and the README strings.
  - `traceUnicodeToZawgyi` reproduces 2.x's debug log (§3.9).
  - Growth ≤ 1.3.

### 7.10 W8: compat

- **Owns:**
  - `src/compat/*.js`;
  - the compat build in `scripts/contract/matrix.js` (§5.4), and the 10 recorded cells in `test/contract/api-matrix.json`;
  - `test/next/compat-*.test.mjs`, and a README doctest run against compat (Phase 6 exit);
  - `scripts/next/size.mjs`;
  - the CI changes of §6.3;
  - a "3.0 core on next" section in ARCHITECTURE.md, written from this spec and what was built.
- **May assume:** everything.
- **Can start early:** `globalOptions.js`, `input.js`, `legacy.js` and `zawgyiModel.js` need only W0 and W1. Unit-test them against `library/`:
  - `resolveFont` agrees with `contentGate.resolveFont` on a list of values (strings, aliases, arrays, numbers, Symbols, `Object.prototype` names);
  - `mergeDetectorOptions` agrees with `globalOptions.detector`, console output included;
  - the legacy lookups agree with 2.x on every `Object.prototype` name and on the matrix's font list;
  - port the adapter cases of test/adapter.test.js.
- **Done:** the acceptance gate (§6.3), and every row of §5.2 covered by a named test.

---

## 8. Porting the 2.x line into next

The 2.x line moves on `main`: the linear NFC helper, Phase 1c, Phase 1 speed wins and Phase 4 output changes. Its changes reach `next` after the core passes the gate. Each one arrives as a port PR:

1. **Merge `main` into `next`.** `library/`, its tests, `test/contract/api-matrix.json` and the tools now hold the new 2.x behaviour.
2. **Make the same change in the core module and in compat.** For example:
   - the linear NFC helper goes into `core/nfc.js`;
   - PR 4.3's font-name policy goes into `compat/input.js` and `compat/legacy.js`, where `legacyTypeError` gives way to `libraryError` with a code;
   - PR 4.2's always-an-object `debugging` goes into `compat/fontConvert.js`.
3. **Run the gate against the new 2.x reference:** `--base main` instead of `--base safety-net`. It must show 0 differences. A Phase 4 output change also bumps `OUTPUT_VERSION`.
4. **Update this spec's §5.2 and §1.3.**

A 2.x speed win that the core already has, such as the atom wrap or the one-regex collapse, needs no port, only the merge.

---

## 9. Not in this build

These are the rest of Phase 6. The core is shaped so that they need no core change:

- **The 3.0 API** (`src/index.js`): `toUnicode(text, {from, tie, trace})`, `toZawgyi`, `detectEncoding` (from `countEvidence`), `normalize(text, options)`. It validates with `requireText`, injects `zawgyiModel`, passes `tie` to `decide`, and records traces with ids.
- **Streaming:** `createNormalizer`, `createConverter`, `mapLines`, `lineTransform`. The core functions are stateless and line-local on the proven boundary (Phase 6 #2 of the plan).
- **Lossless segmentation** (`segmentSyllables`, `syllableBoundaries`) on `forEachBreak`. The 3.0 bare-consonant policy replaces `legacyBareConsonantPair` (decision 34).
- **A truncate that always returns a prefix, and stops early** through `onBreak` returning false.
- **The change report** from `CopyThroughWriter.endSyllable`.
- **`isNormalized` and `explain`.**
- **Idempotent normalize** (decision 36).
- **Extended-C and code-point iteration** (decision 20b).
- **The CLI** (decision 32).
- **Packaging:** the exports map (`'.'`, `'./compat'`, `'./stream'`, `'./package.json'`), the `engines` field (Node 22.12 or later), the 3.0 builds with the dist floor checks and the Playwright smoke run, deleting `library/` and its shims, and per-entry import sizes.

---

## Appendix A: names, 2.x to next

| 2.x | next |
|---|---|
| `order` (storageOrder.js:101) | `orderSyllable`, with `placeAsat`, `fixLookAlikeLetters`, `rankMarks`, `sortByRank`, `writeOrdered`, `writeHeld`, `closeSyllable` |
| `arrange` / `arrangeUnicode` | `readFont` / `reorderUnicode` |
| `font`, `glyph`, `glyph.extra` | `compileFont`, compiled glyph arrays, attached marks |
| `toUnicode(content, font, debug)` | `fontToUnicode(text, fontName)` / `traceFontToUnicode(text, fontName, trace)` |
| `MARK_ORDER`, `RANK`, `RANKS` | `MARK_GROUPS`, `MARK_RANK` (Int8Array), `SyllableBuffer.ranks` |
| `LAST_MEDIAL`, `LOWER_RANK`, `AI_ANUSVARA`, `FIRST_VOWEL` | `RANK_LAST_MEDIAL`, `RANK_LOWER_VOWEL`, `RANK_AI_ANUSVARA`, `RANK_FIRST_VOWEL` |
| `hasAny` with `AA`, `I`, `E_AA`, `LOWER_VOWELS`, `MEDIALS` | `markBit`, `MASK_ANY_AA`, `MASK_UPPER_VOWELS`, `MASK_E_OR_AA`, `MASK_LOWER_VOWELS`, `MASK_MEDIALS` |
| `AA_SHORT`, `AA_TALL`, `U`, `SEVEN` | `CP.AA`, `CP.TALL_AA`, `CP.LETTER_U`, `CP.DIGIT_SEVEN` |
| `early`, `afterMedials`, `slip`, `last` | `ASAT_PLACE` |
| `isMyanmarLetter`, `isUnicodeMark`, `isTypedFirst`, `isOtherMyanmar` | `isSyllableBase`, `isBurmeseMark`, `isPrebaseMark`, `isOtherScriptLetter` |
| `isConsonant` ×3, `isDigit` ×2 | `isBurmeseConsonant` / `isScriptConsonant`, `isBurmeseDigit` / `isScriptDigit` |
| `placeTypedFirst`, `HERE`/`NEXT`/`ALONE`, `stackedAt` | `placePrebaseMark`, `TO_OPEN_SYLLABLE`/`TO_NEXT_BASE`/`STAYS`, `stackedConsonantAt` |
| `syllable.after`, `syllable.kept`, `pending` | `held`, `keptUpTo`, `spaceHeld`, `pending` in `SyllableBuffer` |
| `KINZI_TEXT` copies (zawgyi.js:23, win.js:25, syllable.js:114) | `KINZI_TEXT` (codes.js) |
| `ROLES.BASE/PRE/MARK/STACK/KINZI/TEXT` (strings) | `ROLE.BASE/BEFORE_BASE/MARK/STACK/KINZI/PLAIN` (numbers) |
| `ZAWGYI`, `WIN`, `SEQUENCES`, `CP1252` | `ZAWGYI_GLYPHS`, `WIN_GLYPHS`, `LAGAUNG_SEQUENCES` / `LOOK_ALIKE_SEQUENCES`, `C1_ALIASES` |
| `lookAlikes`, `typos`, `fixTypos`, `TYPOS` | `fixLookAlikes` (= `readDigitsAsLetters` + `readLettersAsDigits`), `fixTypos`, `TYPO_ROWS` |
| `BARE`, `PART`, `RUN`, `nextToDigit`, `isSeparator`, `MARKS`/`MARK`/`isMark` | `isBareWaOrRa`, `isNumberPart`, `isInNumber`, `isNumberSeparator`, `isScriptMark` |
| `zeroAsWa` (storageOrder.js) | `zeroAsWa` (engine/typingFixes.js). The stage label `'zero as wa'` is unchanged. |
| `library.detect`, `scoreWithRules`, `scoreWithMyanmarTools`, `chooseAdapter`, `myanmartoolZawgyiDetector`, `fallback_font_type` | `DETECTOR_SIGNATURES` (spec), `countEvidence` + `decide`, `scoreByZawgyiModel`, `pickAdapter` (compat), `zawgyiModel`, `fallback` |
| `globalOptions.detector`, `setOptions` | `mergeDetectorOptions`, `setGlobalOptions` (compat) |
| `toText`, `isMissing`, `resolveFont`, `cleanText(x, true)` | `unboxString`, `enter`, `resolveFont`, `cleanText` = `stripZeroWidthBreaks(x.trim())` (compat) |
| `DRAWING_ORDER_FONTS`, `drawingOrderToUnicode` | `FONTS[from].visualOrder`, `fontToUnicode` |
| `convertRules`, `convertText`, `replaceOnce`, `replaceRepeated`, `ruleMatches` | `UNICODE_TO_ZAWGYI_RULES`, `unicodeToZawgyi` / `traceUnicodeToZawgyi`, `applyRuleRows` / `traceRuleRows`, `ruleMatches` |
| `COLLAPSE`, `compileCollapse`, `collapseMarks` | per-font repeated-mark sets, `collapseRepeatedMarks` |
| `BREAK_RULES`, `breakParts`, `joinParts` | `BREAK_RULES` (spec, the oracle); `forEachBreak`, `breakParts`, `breakString`, `legacyBareConsonantPair`, `looksLikeSgawKaren` |
| `absoulteLength`, `curr`, `syll`, `_curr` (truncate.js) | `budget`, `kept`, `part`, `words` in `fitParts` |
| `parseUnicode`, `serializeUnicode` | not ported (decision 35) |
