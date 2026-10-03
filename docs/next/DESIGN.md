# knayi 3.0 core: design

This is the spec that the module builders on the `next` branch follow. It turns Phases 1.5, 2 and 3 of the refactor plan into one 3.0 core, built once (decision 6b):

- ES modules under `src/`;
- a stateless core;
- `src/compat/`, the 2.x API built on that core.

compat is checked against the 2.x reference, commit `e5f6e24` (§1.1), with the Phase 0 tools: `npm run compare`, the contract matrix and `npm run perf`. The spec is meant to be precise enough that several people can build modules at the same time and have them fit together. Section 7 says who builds what, and in which order.

**Sources.**
- The refactor plan, `knayi-refactor-plan.md` of 2026-10-03, which is kept outside the repository. "§3.4 of the plan" and "§7 #15" (its list of 2.x bugs) refer to the plan; a bare "§3.4" is a section of this spec. §10 restates, with their numbers, the bugs of that list that compat keeps, and the code cites them there. The code cites only this spec, UTN #11 and the research notes, never the plan (§1.2 rule 3).
- ARCHITECTURE.md and CONTRIBUTING.md at the reference, `e5f6e24` (§1.1).
- The prototypes the plan cites as `SCR/...`. SCR is the plan's evidence folder, also outside the repository. On the maintainer's machine it is `scratchpad/refactor/` next to the plan.

Where this spec departs from the plan, §1.4 says so and gives the reason.

**Revised after review**, before any module was built. The changes:
- top-level code is free of side effects, so a normalize-only import stays small (§2.4, D16), and rule rows carry no prose at run time (D17);
- the engine has one file per owner (D15);
- the 2.x reference is a pinned commit (D18), and module tests reach 2.x private code only through `scripts/oracle/` (D19);
- `core/nfc.js` may keep one memo of the runtime's Unicode data (D20);
- the myanmar-tools loader is built by a factory (D21), and `chooseFontLegacy` takes the detector as an argument (§5.1);
- the perf gate binds on regressions and growth, and the ratios are goals (D22);
- the nightly fuzz counts are explicit and run on `next` (D23);
- the Unicode test keeps a KNOWN table (§2.3), CI checks compat's growth (§6.3), and §3.4, §5.1, §5.4 and §6.2 are made precise.

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
10. [Known 2.x quirks kept on purpose](#10-known-2x-quirks-kept-on-purpose)
- [Appendix A: names, 2.x to next](#appendix-a-names-2x-to-next)

---

## 1. Scope

### 1.1 What this branch builds

- **The 3.0 core.** This is the char-code engine of Phase 2, the one-pass scanners of Phase 3, and the input, option, rule and trace pieces of Phase 1.5. It is written once, as ESM, in `src/`.
- **compat** (`src/compat/`). This is the 2.x API on top of the core:
  - `version`, `setGlobalOptions`, `fontDetect`, `fontConvert` with `.debugging`, `syllBreak`, `spellingFix`, `truncate` and `normalize`;
  - the default export.

  Its output is byte-identical to the reference's `main.js` on every input, with two known differences. compat shares both with the 2.x ES module build (§5.4):
  - a detached `fontConvert` call never reads a global `debug`;
  - myanmar-tools is looked up from the working directory, not from `library/`.
- **Not here:**
  - the 3.0 public API: `toUnicode`, `toZawgyi`, `detectEncoding`, streaming, lossless segmentation, change reports and the CLI. Two cores of it are built here: lossless segmentation in `rules/segment.js` (§7.5), and the core's `detectEncoding` in `rules/detect.js`, which computes that function's result (§7.6, as built). The public functions, which check and clean their text and take their options, are 3.0's;
  - the package `exports` map and the 3.0 builds;
  - any output change.

  §9 lists these and says how the core leaves room for them.

`library/` and `main.js` stay as they are on `next` while the core is built. They are the 2.x reference the tests compare against, and the 2.x test suite keeps running. Nothing in `src/` imports them.

**The reference for byte identity is the library at commit `e5f6e24fa756f8f9c8d790f9a15ede85b135e8ae`** (`e5f6e24`), that is, its `main.js`. This spec calls it "the reference".
- It was the tip of `safety-net` when this spec was written, and `next` starts from it.
- A branch can move, so every command, test and CI job names the commit, never a branch.
- compare and perf resolve a bare ref with `git rev-parse`. In CI, `actions/checkout` with `fetch-depth: 0` creates only `origin/<branch>`, not a local branch, so CI passes the full sha.
- `scripts/oracle/` holds the reference's engine files, frozen (§6.1).

A parallel effort is changing the 2.x line: a linear NFC helper, the Phase 1c contract fixes, speed wins and deliberate output fixes. Those changes are ported into `next` later, each as a PR of its own (§8). The module builders do not port them, with one exception: W1 ports the linear NFC helper with `core/nfc.js` (§7.3), which changes no output.

### 1.2 Ground rules for every module

1. **Byte-identical.** compat's output equals the reference's on every input, apart from the two differences of §5.4, and no module changes behaviour on purpose. A module that finds a 2.x bug reproduces it, and the builder writes the bug down in the PR.
2. **One concern per PR.**
   - Commits follow CONTRIBUTING.md: conventional commits, and a body that says why, with evidence.
   - No co-author lines, and no mention of tools or assistants.
   - PRs target `next`, never `main`. Stacked PRs merge with a merge commit (CONTRIBUTING.md). There is one exception: W0's CI-only PR to `main`, which adds the `next` leg to the nightly fuzz workflow (D23).
3. **Readable code is a goal as much as speed.**
   - Steps have names.
   - Functions are about 40 lines or fewer. The two reader dispatch loops may run to about 70 lines, and they call named helpers. A test checks both limits (§6.2).
   - Names say their scope (Appendix A).
   - Every rule has a comment citing UTN #11 or a research note. Cite the note and its section, for example `// research/zawgyi-to-unicode.md §3: …`. The notes are research/zawgyi-to-unicode.md for asat placement, the look-alike letters and the glyph table; research/normalize.md for the Unicode reader's habits and the typing fixes; and research/win-fonts.md for the Win table.
   - A line number of 2.x code (`storageOrder.js:101-185`) names that file of `library/` at the reference, whose frozen copy is in `scripts/oracle/` (§6.1); a 2.x file with no frozen copy is cited by its function name. A 2.x bug kept on purpose is cited by its row of §10. Nothing in `src/` cites the refactor plan or its evidence folder. `guards/citations.test.mjs` checks all three (as reviewed, §7.11).
4. **Licences** (CONTRIBUTING.md).
   - Never copy LGPL, GPL or unlicensed code or tables.
   - `src/fonts/` moves this project's own MIT tables out of `library/`, unchanged except for the role names.
   - Never commit or ship the Win fonts.
   - Test inputs are synthetic or hand-written (decision 22).
5. **Regex sources are 2.x debug output.**
   - The Unicode to Zawgyi labels must equal 2.x's `RegExp#source` strings byte for byte, with the same `\u` escapes and the same letter case.
   - Write regex literals with `\u` escapes. Never paste the characters themselves.
   - One kind of regex is built rather than written: a Unicode to Zawgyi row read from the Zawgyi glyph table, whose pattern is its text's `\u` escapes, made at load by `tableRow` (§3.9). The floor guard lets that one function build a regex from data, and the module test compares each pattern with 2.x's source (§6.2).
6. **Linear time on every input.** Super-linear time is a security bug (SECURITY.md). No loop may rescan text it has already read.
7. **Tree-shakable.** Top-level code follows §2.4, so that an import pulls in only what it uses.

### 1.3 Plan decisions applied here

The recommended option of each decision below is adopted.

| # | Decision | What it means on `next` |
|---|---|---|
| 6 | (b) Build Phases 1.5, 2 and 3 once, as the 3.0 core | This branch. compat is checked by the 2.x compare and the contract matrix. |
| 8 | Stage names, their order and the regex-source labels are 2.x API | compat reproduces them exactly (§5.2, C17-C18). Core rows and stages also carry stable `id`s for 3.0, unique within their table or pipeline. |
| 9 | (b) Accidental TypeErrors count by class only | compat throws a `TypeError` wherever 2.x threw one by accident. The message is free (§5.2, C12). The Phase 1c fixes come later, with the 2.x port (§8). |
| 10 | Shims for every moved 2.x path | `library/` stays untouched on `next`, so no shim is needed yet. Phase 6 packaging deletes `library/` behind an exports map. |
| 11 | Font-name policy (a coded TypeError for `'win'` and unknown names; case-insensitive names) | A Phase 1c change, ported later. Until then compat reproduces the reference, and core `FONTS` is ready for it. |
| 12 | `debugging` always returns ConvertDebug in 2.11 | Ported later. compat still returns strings on early exits (C19). |
| 13 | Keep the `'zawgyi'` tie fallback in 2.x | compat passes `ON_TIE_ASSUME_ZAWGYI` explicitly. Core `decide(evidence, fallback)` takes the fallback as an argument, so 3.0's `tie` option needs no core change. |
| 16 | normalize keeps NFC on text with no Myanmar | The no-Myanmar fast path returns `toNfc(text)`. |
| 18 | (b) Raise the floor to engines with full ES2015 | `src/` uses ES2015 syntax and built-ins only (`TypedArray#fill` is allowed). Checked by a test with a listed denylist (§6.2). The 3.0 release notes state the new floor. |
| 20 | (c) now, (b) in 3.0 | `codes.js` states the Unicode version it matches, and a test checks it against the runtime. Extended-C digits and code-point iteration are a deliberate 3.0 output change, made later. The readers keep reading UTF-16 units and never split a surrogate pair. |
| 28 | Only the two simple gates | The no-Myanmar fast path and the final-NFC gate (§3.10). No typo or look-alike gates (PR 2.7 is not built). As reviewed (§7.11), Unicode to Zawgyi skips the rows that cannot match (§3.10, gate 3): it couples no rule to another module's trigger bits, since each row names its own `needs`, and it was measured end to end, 2.5-2.7x per word. The font pipeline's final NFC is gated too (gate 4): decision 28 asked for a fused prototype that beats the ungated pipeline on one big string, and this one costs one OR per glyph written whole, reads 0.97 of the ungated pipeline on one string and 0.87-0.89 per line and word. |
| 29 | Accept the V8 atom wrap, exactly U+1000-U+1010 | It applies to the Unicode to Zawgyi rows, whose `re` may wrap its first unit while the `label` keeps the 2.x source. A lint test enforces the exact range. The detector no longer uses regexes. |
| 30 | No single-pass GLYPH_MAP alternation for Unicode to Zawgyi | The alternation is not built: it changes the output of a stack on a stack. The generated writer of Phase 6 #5 (§3.9, §7.12) writes GLYPHS in one pass from left to right only where that equals the rows in order, and runs the rows one by one on a text with a stack on a stack, so the output and the debug log stay 2.x's. |
| 31 | ESM-only sources; minimum Node 22.12 for `require(esm)` | `src/package.json` has `"type": "module"`, and `library/` stays CommonJS for the transition. The `engines` field and the exports map come in Phase 6 packaging. |
| 32 | (b) A CLI | Later. The core never reads the working directory or loads code (§4), so a CLI on it is safe (§10.2 of the plan). |
| 33 | (b) `OUTPUT_VERSION` | `src/version.js`. It is 1 for the output of 2.10.0 at the reference. |
| 34 | Lossless segmentation tokens | `forEachBreak` reports positions. The 2.x pairwise rule is one named predicate (`legacyBareConsonantPair`), and `BARE_CONSONANTS` names the policies: `PAIRS` (2.x), `CHAINS` and `SEPARATE`. `rules/segment.js` builds the lossless core, `segmentSyllables` and `syllableBoundaries`: the pieces join to the text, ZWNJ is kept and nothing is reordered. The 3.0 API and its default policy come later; §7.5 gives the corpus counts the default is to be chosen from. |
| 35 | Delete parseUnicode and serializeUnicode | Not ported. |
| 36 | normalize idempotent by construction in 3.0 | Later, as a 3.0 option and invariant. compat stays non-idempotent, exactly like 2.x. |

Decisions 5 and 17 are not adopted. §1.4 says what this spec does instead (D6 and D3).

### 1.4 Decisions this spec makes where the plan leaves it open

| ID | Decision | Why |
|---|---|---|
| D1 | **The 2.x public-layer pieces live in compat, not in the core.** These are: the input policy rows and `enter()` with its warnings; the global option store and `setGlobalOptions`; the 2.x merge of detector options; the 2.x font-name and rule-table lookups. `core/options.js` and `core/input.js` keep only what 3.0 shares: defaults, the font registry, text predicates and `requireText`. | The core is stateless and silent (Phase 6 #1, §4). The plan designed these pieces for the 2.x layout, where the public layer and the engine sat in one package. The 3.0 API validates strictly and throws, which 2.x never does. |
| D2 | **compat is a strict ES module.** A detached `fontConvert` call never reads `debug` from the global object. In those 10 matrix cells compat matches the 2.x ES module build, and the matrix records them as a known build difference, as it already does for `knayi-myscript.mjs` (§5.4). | Reproducing the sloppy-mode read would mean reading `globalThis.debug` on purpose. That brings back global state and §7 bug #2, which PR 4.1 removes from 2.x. The 2.x ES module build already behaves like this. |
| D3 | **compat loads myanmar-tools the way the 2.x ES module build does:** by name, from the working directory, in Node and Bun only. This happens in one file, `compat/zawgyiModel.js`. The core takes the detector as an injected object. `main.js` looks the package up from `library/` instead, so this is the second known build difference (§5.4). | Decision 17 is not adopted, so compat keeps the 2.x behaviour (§10 Q15). The core never loads code (§4). Injection for compat (Phase 5 #2) arrives with the 2.x port. |
| D4 | **One trace shape for both kinds of 2.x debug log.** A trace is `{start, records}`. compat builds `steps` as `[start, ...records.map(r => r.text)]`. | 2.x logs font stages as "input, then the text after each stage that changed it", and Unicode to Zawgyi rules as "the text before each logged rule, then the result". The second is the same list as the first, with the collapsed text as `start` (§3.9). One recorder serves both. |
| D5 | **`fontToUnicode(text, fontName)` takes the font's name.** The compiled fonts stay private to `stages/fonts.js`. | Callers (compat now, the 3.0 API later) name a font. Only the stages need the compiled form. |
| D6 | **No internal switch back to the 2.10 engine** (decision 5's rollback switch). | Under decision 6(b) the new engine ships with 3.0. A user who needs the old engine stays on the 2.x line, and a 2.x branch is cut when 3.0 reaches main (decision 7). `scripts/oracle/` stays as the test oracle. |
| D7 | **Glyph roles (`ROLE`) live in `script/codes.js`.** | The fonts (L2) need them, and L2 may not import the engine (L3). |
| D8 | **`src/version.js` (L0)** holds `PACKAGE_VERSION` and `OUTPUT_VERSION`. | They are constants that both compat and the 3.0 API export. They are not options. |
| D9 | **`CodeBuffer` is built with `engine/syllable.js`, by engine-unicode.** The split this spec was asked to cover put it with engine-fonts. | `orderSyllable` writes into a CodeBuffer for both readers, and the CopyThroughWriter's syllable scratch is one. With the font reader, engine-unicode would have to wait for engine-fonts. |
| D10 | **One stage list per pipeline, one runner.** The fast path and the trace run the same list (`core/rules.js` `runStages`). Gates are stage fields, and the runner ignores them when tracing. Stage ids are unique within a pipeline. | The order and the names are written once. The fast and trace paths cannot drift apart. The runner's cost has not been measured: its `stage.run` calls serve two pipelines. W5 measures it on the per-word workload before building on it, and §7.7 says what happens if it costs more than 2%. |
| D11 | **New tests are ES modules: `test/next/**/*.test.mjs` and `*.timing.mjs`.** They reach the CommonJS oracle through `createRequire`. | The root package stays CommonJS for the 2.x suite. `.mjs` tests avoid `require(esm)` warnings on Node 22. |
| D12 | **Skeleton first.** The first PR (W0) lands every `src/` file as a stub with its final exports and its complete import list, and every timing file of §6.1 as a skipped stub. Builders then work in parallel against stable imports. Merges follow a fixed order (§7.1). | ESM imports fail at link time when an export is missing. With stubs, each module's own tests run before its dependencies are finished. |
| D13 | **compat throws the 2.x accidental TypeErrors through one helper, `legacyTypeError()`, which sets no `code`.** `test/next/guards/errors.test.mjs` allows it in `compat/legacy.js` only. | The matrix records a thrown error with a `code` by code and message, and one without a `code` by class only. 2.x's cells are class-only. |
| D14 | **The ES2015 floor for `src/`.** Syntax is checked by acorn with `ecmaVersion: 2015, sourceType: 'module'`. Built-ins are checked against the denylist of ES2016+ names listed in §6.2, which accepts some false positives. Classes declare no fields: their state is assigned in the constructor. `import.meta` and `globalThis` are not used anywhere in `src/`. | Decision 18(b). Class fields are ES2022, and acorn at ES2015 rejects them. A name cannot tell `Array#includes` (ES2016) from `String#includes` (ES2015), so the list bans both, and `src/` uses `indexOf`. compat's loader detects Node with `typeof process`, which every engine accepts. |
| D15 | **One file per owner, and one directory per L3 part:** `engine/` holds the engine (`syllable.js` and `unicodeReader.js`, W5; `fontReader.js`, W6), `rules/` the rules (`typingFixes.js`, W2; `segment.js`, W3; `detect.js`, W4; `unicodeToZawgyi.js`, W7), and `stages/` the stage lists (`normalize.js`, W5; `fonts.js`, W6). The plan's `readers.js` and `stages.js` are each split in two, and its cap of 2-3 files for `engine/` does not apply to `src/`. As built, `engine/` held all six engine-side files and three rules sat at the root of `src/`; the review moved them (§7.11), so a path names its layer and the imports it may make (§2.2). | No file has two owners, so no builder edits another's import block or helpers. The cap protected bundle bytes from CommonJS module wrappers: the clarity split cost +16%. esbuild bundles ES modules into one scope without wrappers, so a split costs nothing by itself. What costs bytes is top-level code that esbuild cannot drop (D16). `scripts/next/size.mjs` checks both, in every PR from W0 on. |
| D16 | **Top-level code is free of side effects** (§2.4). Data is frozen through one helper, `deepFreeze` (`src/freeze.js`), called with a `/* @__PURE__ */` annotation. So are the compiled fonts, the built tables and the scratch objects. `deepFreeze` freezes plain objects and arrays, and leaves RegExps and typed arrays as they are. | With esbuild 0.25.12 and `"sideEffects": false`, an unused `Object.freeze({...})`, an unannotated call or `new`, and a literal that reads a property (`{a: CP.KA}`) all stay in the bundle, with and without minify. An unannotated top-level `compileFont(TABLE)` keeps the table and `compileFont` in a normalize-only bundle, and a `FONT_STAGES` frozen with a bare `Object.freeze` keeps `readFont` and every stage function with it. Annotated calls whose arguments are identifiers or literals, and plain literals, are dropped. A frozen RegExp has a read-only `lastIndex`, so `replace`, `search`, `match` and `test` throw a TypeError on it (Node 26 and Bun 1.4.2). |
| D17 | **Rule rows carry no prose at run time.** A row has `id`, `re`, `to`, `repeat`, `needs` where gate 3 of §3.10 skips it (the Unicode to Zawgyi rows and `zg.lagaung.1`), and `label` only where the 2.x source differs from `re.source`. A row's `why` is a comment above it, its section is the named array it sits in, and its `example` is in the module's test table. The typo rules are documented in `spec/typoRows.js`. | About 75 rows would otherwise ship a sentence and an example each, in compat and in every 3.0 entry, and nobody had measured them against the size targets. The 3.0 trace needs only the `id`. |
| D18 | **The 2.x reference is the commit `e5f6e24`**, not the branch `safety-net` (§1.1). | A branch can move, and byte identity needs a fixed reference. A bare branch name does not resolve in CI. |
| D19 | **Module tests reach 2.x private code only through `scripts/oracle/`**, frozen at the reference. W0 adds byte-for-byte copies of `library/syllable.js` and `library/contentGate.js` there, and a `dir` option to `loadWithInternals`. compat's tests compare with the live `library/`. | §8 merges `main` into `next`, and the 2.x speed wins rewrite `library/`'s private code (for example PR 1.4's glyph array and PR 1.6's mark bit set). A module test that read `library/` would then break, or quietly test a different engine. compat follows the 2.x line port by port, so it is compared with the live library, and with the reference only through public functions: compare and the matrix. |
| D20 | **`core/nfc.js` may keep one memo, `NFC_MEMO`**, of facts about the runtime's Unicode data: which code points start or continue a run of non-starters, their decompositions and their combining classes. The stateless guard exempts it by name. | The 2.x line's linear NFC helper (d170cd8, ported by W1, §7.3) reads combining classes from `String#normalize` with probes, and keeps them, because JavaScript has no table of them. Building the table eagerly would probe every code point at import. The memo is deterministic and bounded (§3.11): it never holds a result of a call, so outputs still depend only on the arguments and the runtime's NFC data (§4 rule 6). |
| D21 | **The myanmar-tools loader is built by a factory**, `createZawgyiModelLoader(requireFn)`. compat uses one shared instance, which holds the loaded model, the load error and the warned flag. `fontDetectCore` takes the loader as an optional last argument. | An ES module cannot be loaded fresh the way the 2.x adapter tests reload `detector.js`. In Node, `import('x.js?copy=N')` runs only that file again, and its imports stay shared; in Bun 1.4.2 a second `?copy=` import returns the same instance. `bun test ./test` runs every test file in one process, so per-process state would leak between files. Tests build their own loaders with stub requires instead. |
| D22 | **The binding speed check is: no Node row slower than the reference, and every growth exponent ≤ 1.3** under Node and Bun. The ratios of §6.4 are goals, reported with their margins. Rows marked "estimate" never block. | Several goals sit 1-3% from their evidence, inside perf's A/A noise of about ±2.5%. The evidence was timed on 32k corpus lines, while perf times 400 FLORES lines, and on prototypes that kept their hot state in closure locals rather than in this spec's buffer objects and stage runner. |
| D23 | **Each fuzz test has an explicit nightly count**, and the nightly counts run on `next`. A long run uses `min(prCount × KNAYI_FUZZ_SCALE, nightlyCount)`. W0 adds a `next` leg to `main`'s nightly fuzz workflow, and the gate runs the nightly counts once by hand (§6.3). | A scheduled workflow runs the default branch's file on the default branch, and `main` has no `test/next`. Scale 100 would turn each 200k PR count into 20M strings, which does not fit the fuzz job's 30 minutes. |

---

## 2. Layout

### 2.1 Tree

```
src/
  package.json               {"type": "module", "sideEffects": false}
  version.js                 L0          PACKAGE_VERSION, OUTPUT_VERSION
  freeze.js                  L0          deepFreeze() (§2.4)
  script/codes.js            L0          code points, character classes, mark order, glyph roles, the NFC-safe set
  core/errors.js             L1          error codes, libraryError()
  core/options.js            L1          frozen DEFAULTS, map-safe option reading
  core/input.js              L1          FONTS registry, text predicates, requireText()
  core/rules.js              L1          rule rows and their runner, traces, the stage runner
  core/nfc.js                L1          toNfc() in linear time, the only calls of String#normalize in src/
  fonts/zawgyi.js            L2          Zawgyi glyph table and lagaung sequences (data only)
  fonts/win.js               L2          Win Innwa glyph table, look-alike sequences, C1 aliases (data only)
  engine/syllable.js         L3 engine   SyllableBuffer, orderSyllable and its steps, CodeBuffer, CopyThroughWriter
  engine/unicodeReader.js    L3 engine   UNICODE_READING, SEEN, reorderUnicode
  engine/fontReader.js       L3 engine   FONT_READING, compileFont, readFont, glyphsInTypedOrder
  rules/typingFixes.js       L3 rules    typos, look-alikes, zero as wa, isInNumber
  rules/detect.js            L3 rules    countEvidence, decide, scoreByZawgyiModel, detectFont, detectEncoding
  rules/segment.js           L3 rules    break scanners, forEachBreak, breakParts, breakString, segmentSyllables, collapseRepeatedMarks
  rules/unicodeToZawgyi.js   L3 rules    Unicode to Zawgyi rule rows, unicodeToZawgyi, traceUnicodeToZawgyi
  stages/normalize.js        L3 stages   NORMALIZE_STAGES, normalizeText, traceNormalizeText
  stages/fonts.js            L3 stages   the compiled fonts, FONT_STAGES, fontToUnicode, traceFontToUnicode
  compat/index.js            L4          the 2.x export object (named and default exports)
  compat/globalOptions.js    L4          the option store, setGlobalOptions, the silent-aware console writer
  compat/input.js            L4          INPUT_POLICY, enter(), cleanText(), 2.x font-name resolution
  compat/legacy.js           L4          2.x rule-table lookups, legacyTypeError(), legacyWinTables()
  compat/zawgyiModel.js      L4          the myanmar-tools loader factory and its shared instance (the only loader site in src/)
  compat/fontDetect.js       L4          fontDetect, fontDetectCore
  compat/fontConvert.js      L4          fontConvert, fontConvert.debugging
  compat/text.js             L4          normalize, syllBreak, spellingFix, truncate
  spec/detectorSignatures.js  (spec)     the 29 detector signature rows: the scanner's readable oracle
  spec/breakRules.js          (spec)     the 15 break rule rows: the scanners' readable oracle
  spec/typoRows.js            (spec)     the 4 typo rules, documented: fixTypos's readable oracle
test/next/                   module tests (*.test.mjs), fuzz (*.fuzz.test.mjs), timing (*.timing.mjs), guards/, helpers.mjs
scripts/next/size.mjs        bundle size report and tree-shaking check for compat and a normalize-only import (W0)
scripts/oracle/              gains syllable.js and contentGate.js, copies of library/ at the reference (D19)
```

### 2.2 Layers and import rules

| Layer | Files | May import |
|---|---|---|
| L0 script | `version.js`, `freeze.js`, `script/codes.js` | L0 |
| L1 core | `core/*.js` | L0, L1 |
| L2 fonts | `fonts/*.js` | L0, L1 |
| L3 engine | `engine/syllable.js`, `engine/unicodeReader.js`, `engine/fontReader.js` | L0-L2, L3 engine |
| L3 rules | `rules/typingFixes.js`, `rules/detect.js`, `rules/segment.js`, `rules/unicodeToZawgyi.js` | L0-L2, L3 rules |
| L3 stages | `stages/normalize.js`, `stages/fonts.js` | L0-L3, but not each other |
| L4 public | `compat/*.js` (and, later, the 3.0 API) | L0-L4 |
| spec | `spec/*.js` | nothing; nothing in `src/` imports `spec/` (tests do) |

The import rules:

- An import uses a literal relative path that ends in `.js`, and it stays inside `src/`. Nothing imports `library/`, `main.js` or a package.
- Imports within one layer are allowed, but cycles are not. The L3 parts are ordered as the data flows: rules never import the engine, the engine never imports rules, and only stages imports both. The two readers do not import each other; both import `engine/syllable.js`.
- No file loads code at run time, except `compat/zawgyiModel.js` (D3). That means no `require`, no `createRequire`, no `getBuiltinModule`, no dynamic `import()` and no `import.meta`.
- `test/next/guards/layers.test.mjs` parses every file with acorn (`sourceType: 'module'`) and enforces these rules. There are no known exceptions, and none may be added. Every file in `src/` must have a layer. A planned file that does not exist yet is allowed until the acceptance gate.

### 2.3 Modules, exports and signatures

The signatures below are written in TypeScript notation for precision. The sources are JavaScript, with the same types in JSDoc. Two things in the notation are not syntax to copy:
- A class member written as `name: type`, `readonly` or not, is state that the constructor assigns. The sources declare no class fields, which are ES2022 (D14).
- "Frozen" means built with `deepFreeze` (§2.4). It freezes plain objects and arrays, deeply. RegExps and typed arrays are not frozen: a frozen RegExp breaks `replace` and `search` (D16), and a typed array cannot be frozen. Both are read-only by contract, and nothing outside their module writes them.

#### `src/version.js` (L0)

```ts
export const PACKAGE_VERSION: string  // equals package.json "version" (tested); '2.10.0' until a 3.0 prerelease
export const OUTPUT_VERSION: number   // 1 = the output of 2.10.0 at the reference; +1 with each deliberate output change (decision 33)
```

#### `src/freeze.js` (L0)

```ts
// Object.freeze on value and, recursively, on every plain object and array it holds. RegExps and typed arrays are
// left as they are. Returns value. Every top-level call carries /* @__PURE__ */ (§2.4).
export function deepFreeze<T>(value: T): T
```

#### `src/script/codes.js` (L0)

This file holds one definition of every concept that more than one module uses (goal 3). A class used by one row of one table may stay local to that scanner, named after the row. The header states: "The tables match Unicode 15.1, as library/ does."

**`test/next/unicode.test.mjs`** (decision 20c) carries over the method of test/unicode.test.js at the reference, KNOWN table included:
- It scans the Myanmar blocks (U+1000-U+109F, U+A9E0-U+A9FF, U+AA60-U+AA7F, U+116D0-U+116FF) and every other code point the runtime gives Script=Myanmar.
- Each row below compares one runtime set with the tables that should classify it.
- A row fails when the runtime has a code point that the tables leave out and KNOWN does not list. That is a new Unicode version the tables have not caught up with.
- It also fails when a KNOWN code point is now classified, so the list shrinks as the gaps close.

The tables classify only UTF-16 units, so nothing above U+FFFF is ever classified. Extended-C (U+116D0-U+116E3: Pa'o and Eastern Pwo Karen digits) has been Script=Myanmar since Unicode 16.0. CI's Node 24 has Unicode 16.0 and its Node 26 has 17.0, so both see it. It stays KNOWN until decision 20(b) in 3.0.

| Runtime set | Classified when | KNOWN today |
|---|---|---|
| Script=Myanmar | `classOf(cp) !== CLS.OTHER` | Extended-C |
| Script=Myanmar | `isMyanmarBlock(cp)` (the 2.x text gate) | Extended-B U+A9E0-U+A9FE, Extended-A U+AA60-U+AA7F, Extended-C |
| Script=Myanmar | `isMyanmarScript(cp)` (the no-Myanmar fast path) | Extended-C |
| `\p{L}` | `isSyllableBase(cp) \|\| isScriptConsonant(cp)` | U+1052-U+1055 (Pali vocalic r, rr, l, ll), U+A9E6 (Shan reduplication sign) |
| `\p{M}` | `isBurmeseMark(cp) \|\| cp === CP.VIRAMA \|\| isScriptMark(cp) \|\| isScriptTone(cp)` | none |
| `\p{Nd}` | `isBurmeseDigit(cp) \|\| isScriptDigit(cp)` | Extended-C |

These KNOWN entries are exactly the code points left out on Node 26.5 (Unicode 17.0), checked against the 2.x definitions that §6.2 maps to these functions. A runtime with Unicode 15.1 lacks Extended-C and simply has fewer code points.

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
export const KINZI_TEXT: string        // U+1004 U+103A U+1039, a literal of \u escapes. The plan's CP.KINZI_TEXT; CP holds numbers only

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

// Zawgyi classes, shared by rules/detect.js and rules/segment.js.
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
  MASK_VISARGA: number, MASK_MEDIAL_YA: number, MASK_MEDIAL_HA: number, MASK_E_TO_DOT_BELOW: number

// Glyph roles (D7). 3.0 names (§5 of the plan): PRE is BEFORE_BASE, TEXT is PLAIN.
export const ROLE: Readonly<{ BASE: 1, BEFORE_BASE: 2, MARK: 3, STACK: 4, KINZI: 5, PLAIN: 6 }>

// NFC (§3.10).
export function isNfcSafe(code: number): boolean  // below U+0300, U+2002-U+206F, U+FEFF, Extended-A/B
// NFC may move or compose it: U+1025, U+1037, U+1039, U+103A, U+108D in the block; elsewhere at or above U+0300
// and not isNfcSafe (§3.10, gate 4)
export function mayChangeUnderNfc(code: number): boolean

// Unit sets (§3.10, gate 3): the units of U+1000-U+109F a text may hold, 160 bits in an Int32Array(UNIT_SET_WORDS).
export const UNIT_SET_WORDS: 5
export function addBlockUnit(units: Int32Array, code: number): void   // adds code when it lies in U+1000-U+109F

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
// The row's `why` is a comment above it, citing UTN #11 or a research note. Its section is the named array it sits
// in. Its synthetic example is in the module's test table, keyed by id. None of these ship (D17).
type RuleRow = Readonly<{
  id: string,        // stable, short, unique within its table: table, section, number, for example 'uz.kinzi.2'
  re: RegExp,        // g flag, ES2015 syntax; never frozen (D16)
  to: string,        // the replacement, with $1-style references
  repeat: boolean,   // 2.x asLongAsMatch: apply while it matches, at most REPEAT_LIMIT times
  needs?: string,    // units of which every match of re holds one: skipped on a text with none (§3.10 gate 3)
  label?: string     // only where the 2.x source differs from re.source: the six wrapped rows of §3.9
}>
type TraceRecord = { id: string, label: string, text: string }
type Trace = { start: string | null, records: TraceRecord[] }
type StageContext = { openAllGates: boolean }   // each pipeline extends it (§2.3, engine/*Stages.js)
type Stage<C extends StageContext> = Readonly<{ id: string, label: string, run(text: string, ctx: C): string,
  traceOnly?: true, gate?(ctx: C): boolean }>   // ids unique within a pipeline

export const REPEAT_LIMIT: 40
export function ruleLabel(row: RuleRow): string                    // the 2.x debug label: row.label, else row.re.source
export function ruleMatches(row: RuleRow, text: string): boolean   // text.search(row.re) !== -1
export function applyRuleRows(text: string, rows: readonly RuleRow[]): string
export function traceRuleRows(text: string, rows: readonly RuleRow[], trace: Trace): string
export function createTrace(): Trace                                // { start: null, records: [] }
export function startTrace(trace: Trace, text: string): void        // start = text; records emptied
export function lastTracedText(trace: Trace): string                // the last record's text, or start
export function recordStep(trace: Trace, id: string, label: string, text: string): void  // appends
export function runStages<C extends StageContext>(text: string, stages: readonly Stage<C>[], ctx: C, trace: Trace | null): string
```

Semantics, which every caller relies on:

- **`applyRuleRows`** works through the rows in order. A row with `needs` is skipped when the text holds none of them (a search per unit; as reviewed, §3.10 gate 3); it cannot match there.
  - A row with `repeat: false` runs `text = text.replace(row.re, row.to)` once.
  - A row with `repeat: true` repeats 2.x `replaceRepeated`. Up to `REPEAT_LIMIT` times:
    - stop if `!ruleMatches(row, text)`;
    - otherwise compute `next = text.replace(row.re, row.to)`;
    - stop if `next === text`, otherwise set `text = next`.

  `String#search` and a global `String#replace` both start at index 0 and leave `lastIndex` at 0. So a row's regex carries no state from one call to the next.
- **`traceRuleRows`** gives the same result as `applyRuleRows`, skips the same rows, and records 2.x's logged rules, each with its `id` and `ruleLabel(row)`:
  - a once row that changed the text is recorded, with the text after it;
  - a repeat row that matched before its first pass is recorded once, with the text after its last pass.
- **`runStages`** works through the stages in order:
  - A stage marked `traceOnly` runs only when `trace` is given. Its output is recorded but is not passed on to the next stage.
  - A stage with a `gate` is skipped only when no trace is given, `ctx.openAllGates` is false and `gate(ctx)` returns false. **The trace runner never gates.**
  - With a trace, a stage's output is recorded when it differs from `lastTracedText(trace)`. That is the comparison 2.x's `step()` makes in `storageOrder.toUnicode`. The caller calls `startTrace(trace, input)` first.

#### `src/core/nfc.js` (L1)

```ts
export function toNfc(text: string): string   // exactly text.normalize('NFC'), in linear time
// For tests: the stateless test compares a cold memo with the warm one, and core-nfc.test.mjs checks the order
// orderLongRuns gives every pair of run characters, at longest 1.
export function createNfcMemo(): NfcMemo                        // an empty memo
export function toNfcWith(text: string, memo: NfcMemo): string  // toNfc(text) = toNfcWith(text, NFC_MEMO)
export function orderLongRuns(text: string, longest: number, memo: NfcMemo): string  // 2.x nfc.reorder
```

This file holds the only calls of `String#normalize` in `src/`, and `test/next/core-nfc.test.mjs` checks that. It is the 2.x line's linear helper (`library/nfc.js`, d170cd8), ported by W1 (§7.3). The helper puts each run of non-starters longer than 30 units (the stream-safe limit of UAX #15) in canonical order before NFC: it decomposes the run and sorts its code points by combining class with a stable bucket sort, which is what NFC does to the run, so the text keeps its NFC. It changes no output. A text of 30 units or fewer goes to `String#normalize` at once.

**The memo (D20).** The helper reads combining classes from `String#normalize` with short probes and keeps them. The file holds them in one module constant, `NFC_MEMO`, made by `/* @__PURE__ */ createNfcMemo()` and filled lazily. It holds:
- `kinds`: a `Uint8Array(0x20000)` of kinds (not seen yet, ends a run, run character) for the code points below U+20000. It is 128 KB, allocated on the first probe.
- `decompositions`: the decomposition of each run character seen;
- `classes`: one entry per combining class seen, in canonical order, and `classOfMark`, the entry of each non-starter seen.

It is bounded by the runtime's Unicode data, not by the text. It never holds a result of a call, and it is never reset. Its properties are filled; its binding is never reassigned (there is no `let` or `var`). Ka followed by 32,000 pairs of dot below and virama takes about 2.5 ms in `toNfc`, against about 960 ms in `String#normalize` (Node 26.5).

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

The 2.x shape of this data, library/win.js `tables`, is 2.x API (ARCHITECTURE.md, "Stable surfaces"), and it is built in compat, not here (`compat/legacy.js` `legacyWinTables`, §5.1).

The rows are copied from `library/zawgyi.js` and `library/win.js`, with their comments. Only the role names change. The file headers state the full pipeline, including the typing-fix stages that the 2.x headers leave out (§7 #23).

#### `src/engine/syllable.js` (L3 engine)

```ts
// The four deliberate differences between the readers (§3.5). Each reader defines its own frozen value.
type ReaderOptions = Readonly<{ heldZeroWidth: number /* ZW bits */, digitTakesMarksAcrossSpace: boolean,
  prebaseCrossesZeroWidth: boolean, keepUAfterVowelSign: boolean }>
export const ASAT_PLACE: Readonly<{ NONE: 0, DROPPED: 1, IN_ORDER: 2, ON_CONSONANT: 3, AFTER_MEDIALS: 4 }>
export class CodeBuffer { /* §3.7 */ }
export class SyllableBuffer { /* §3.3 */ }
export class CopyThroughWriter { /* §3.7 */ }
// The steps of §3.4. Each is a module function taking the buffer: no closures, no allocation.
export function closeSyllable(buf: SyllableBuffer, sink: CodeBuffer): void     // orderSyllable, writeHeld, then closed
export function writesAsTyped(buf: SyllableBuffer): boolean   // orderSyllable would write the parts as they came (§3.4)
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

#### `src/engine/unicodeReader.js` (L3 engine, W5)

```ts
// heldZeroWidth is the number literal 25 (ZW.ZWSP | ZW.WORD_JOINER | ZW.BOM), with that comment (§2.4).
export const UNICODE_READING: ReaderOptions  // { 25, false, false, true }
export const SEEN: Readonly<{ LETTER_U: 1, NFC_UNSAFE: 2 }>
export function reorderUnicode(text: string): { text: string, seen: number }   // §3.6
export function unicodeReaderScratchUnits(): number   // capacity of this module's scratch buffers (§3.11), for tests
```

#### `src/engine/fontReader.js` (L3 engine, W6)

```ts
// heldZeroWidth is the number literal 31 (ZW.ALL), with that comment (§2.4).
export const FONT_READING: ReaderOptions     // { 31, true, true, false }
export function compileFont(definition: FontDefinition): CompiledFont           // §3.8; throws ERR.INVALID_FONT_TABLE
export function readFont(text: string, font: CompiledFont): string             // §3.6
// readFont, and whether NFC may change its output (§3.10, gate 4)
export function readFontNoting(text: string, font: CompiledFont): { text: string, nfcMayChange: boolean }
export function glyphsInTypedOrder(text: string, font: CompiledFont): string   // trace stage 'glyphs' only
export function fontReaderScratchUnits(): number      // capacity of this module's scratch buffers (§3.11), for tests
```

The memory tests add the two scratch counts; no module sums them.

#### `src/rules/typingFixes.js` (L3 rules)

```ts
type NumberContext = Readonly<{ isDigit(code: number): boolean, isSign(code: number): boolean }>
export function fixTypos(text: string): string              // the 4 rules of spec/typoRows.js in one scan (§3.9)
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

The two contexts restate a 2.x difference on purpose (§10 Q20), and each is kept as it is:
- `ZERO_AS_WA` counts Burmese digits, and `+ - * /` as signs (storageOrder.js:59-61).
- `LOOK_ALIKES` counts Burmese, Shan and Tai Laing digits, and has no signs (typingFixes.js:37, :70-74).

Every function returns its input string when nothing changes (copy-through).

#### `src/rules/detect.js` (L3 rules)

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
// The rule evidence and what it says (plan Phase 5 #1). encoding is 'none' when text has no unit of U+1000-U+109F
// (2.x fontDetect's gate; both counts are then 0), 'unknown' on a tie, else the side with more evidence.
type Encoding = { encoding: 'unicode' | 'zawgyi' | 'unknown' | 'none', unicode: number, zawgyi: number }
export function detectEncoding(text: string): Encoding
```

The precondition is that `text` has been cleaned: trimmed, with no U+200B or U+200C. The anchored signatures (`^`, `$`) apply to the start and end of that cleaned text.

2.x `fontDetect` with the rule scorer is `detectEncoding(cleaned).encoding`, with the fallback in place of `'none'` (`fallback || 'en'`) and of `'unknown'` (`fallback || 'zawgyi'`). 3.0's public `detectEncoding` is the core one after `requireText` and cleaning, with a model when one is injected.

#### `src/rules/segment.js` (L3 rules)

```ts
type BreakFont = 'unicode' | 'zawgyi'
// How a bare consonant joins the syllable after it (rows U7 and Z8, decision 34). Frozen.
export const BARE_CONSONANTS: Readonly<{ PAIRS: 'pairs', CHAINS: 'chains', SEPARATE: 'separate' }>
type BareConsonants = 'pairs' | 'chains' | 'separate'
export function prepareBreakText(text: string, font: BreakFont): string   // unicode: U+103A U+1037 -> U+1037 U+103A (row U1)
// Calls onBreak(index) at every break, in increasing order, never at 0; stops when onBreak returns false.
export function forEachBreak(prepared: string, font: BreakFont, onBreak: (index: number) => boolean | void,
  bareConsonants?: BareConsonants /* default 'pairs', as 2.x */): void
export function breakParts(text: string, font: BreakFont): string[]                // 2.x breakParts
// 2.x joinParts(breakParts(...)): an empty separator means U+200B. compat passes a string (C20).
export function breakString(text: string, font: BreakFont, separator: string): string
// Lossless (decision 34): no precondition; join('') === text; [] for ''. U+200B and U+200C are ordinary units.
export function segmentSyllables(text: string, font: BreakFont, bareConsonants?: BareConsonants): string[]
export function syllableBoundaries(text: string, font: BreakFont, bareConsonants?: BareConsonants): number[]  // the breaks
export function looksLikeSgawKaren(text: string): boolean   // row Z6's switch: /[U+1062 U+1063]U+103A/ tested on the input
// 2.x collapseMarks for a known font. Given a unit set (codes.js), the same pass adds every unit of U+1000-U+109F
// the text holds to it, for gate 3 of §3.10.
export function collapseRepeatedMarks(text: string, font: BreakFont, units?: Int32Array): string
```

The precondition for the break functions (`forEachBreak`, `breakParts`, `breakString`) is that `text` has no U+200B or U+200C. 2.x always cleans the text first. `font` is one of the two names. compat resolves every other value (§5.2, C12), and every function of `rules/segment.js` throws `libraryError(ERR.INVALID_ARG_VALUE, …, RangeError)` for any other font, and for a policy outside `BARE_CONSONANTS` (`null` and `'Separate'` included), so that the two fonts never read an unknown value two different ways (as reviewed, §7.11).

The policies of `BARE_CONSONANTS`: `PAIRS` is 2.x (`legacyBareConsonantPair`: a consonant that has just been joined to the one before it joins nothing, so ကကက breaks as ကက|က); `CHAINS` joins every bare consonant, as the comment of 2.x syllable.js:239 says; `SEPARATE` joins none, so each bare consonant is a syllable of its own (UTN #11). In Zawgyi text an e or medial ra with no base after it joins the consonant before it under every policy. `segmentSyllables` and `syllableBoundaries` default to `PAIRS` until decision 34 picks the 3.0 default.

#### `src/rules/unicodeToZawgyi.js` (L3 rules)

```ts
export const UNICODE_TO_ZAWGYI_RULES: readonly RuleRow[]   // 57 once rows, then 8 repeat rows, in 2.x order
export function unicodeToZawgyi(text: string): string     // collapseRepeatedMarks(text, 'unicode'), then the rows that can match (§3.10, gate 3), GLYPHS in one pass (§3.9)
export function traceUnicodeToZawgyi(text: string, trace: Trace): string   // trace.start = the collapsed text; every row on its own
```

The rows of one fixed text whose glyph the Zawgyi glyph table gives, read backwards, are built from `fonts/zawgyi.js` at load (§3.9, Phase 6 #5): a section lists such a row by its Unicode text alone.

#### `src/stages/normalize.js` (L3 stages, W5)

```ts
type NormalizeContext = StageContext & { seen: number }
export const NORMALIZE_STAGES: readonly Stage<NormalizeContext>[]
//   ids     'nfc.input', 'syllables', 'typos', 'look-alikes', 'nfc.final' (gated, §3.10)
//   labels  'NFC',       'syllables', 'typos', 'look-alikes', 'NFC'
// engineOptions.openAllGates: tests only. compat never passes it, and no public API exposes it.
export function normalizeText(text: string, engineOptions?: { openAllGates?: boolean }): string
export function traceNormalizeText(text: string, trace: Trace): string
```

2.x `normalize` has no debug output, so these ids are new. The two NFC stages share the label `'NFC'` but not the id, because the 3.0 trace reads records by id (decision 8).

#### `src/stages/fonts.js` (L3 stages, W6)

```ts
type FontContext = StageContext & { font: CompiledFont, nfcMayChange: boolean }   // a new one per call; 'syllables' sets nfcMayChange
export const FONT_STAGES: readonly Stage<FontContext>[]
//   ids and labels  'sequences', 'glyphs' (traceOnly), 'syllables', 'zero as wa', 'look-alikes', 'typos', 'NFC' (gated, §3.10)
// engineOptions.openAllGates: tests only, as for normalizeText
export function fontToUnicode(text: string, fontName: 'zawgyi' | 'win', engineOptions?: { openAllGates?: boolean }): string
export function traceFontToUnicode(text: string, fontName: 'zawgyi' | 'win', trace: Trace): string
```

The font stage `id`s and `label`s are exactly the 2.x names, in this order (README.md, `fontConvert.debugging`; test/zawgyi.test.js). The compiled Zawgyi and Win fonts are private module constants here, each built once at load from `fonts/*.js` by a `/* @__PURE__ */ compileFont(...)` call (§2.4, §3.8).

**Stage ids are unique within a pipeline.** `test/next/guards/pipelines.test.mjs` (W0) imports every exported `*_STAGES` list from `src/stages/` and checks it. The check passes on the skeleton's empty lists, and binds as soon as a list is filled.

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
// typoRows.js: the 4 typo rules of typingFixes.js:12-17, in 2.x order (§3.9).
export const TYPO_ROWS: readonly Readonly<{ id: string, pattern: RegExp /* the 2.x literal */, replacement: string,
  why: string, source: string, example: string }>[]
```

A row's `why` says what the row detects or joins and why. `source` names the evidence: UTN #11, a research note section, an issue, or "kept from 2.x; evidence not recorded" when none is known. The scanner code cites the row `id`s in its comments. `spec/` files are never bundled, so their prose costs no bytes; the tests read them.

#### `src/compat/*` (L4)

compat's files, exports and behaviour are in §5.

### 2.4 Top-level code and tree-shaking

A 3.0 user who imports only `normalize` must not download the glyph tables (§6.4 sets the normalize-only size). esbuild drops an unused top-level binding only when it can see that its initialiser has no side effects. So every file in `src/` follows these rules (D16):

1. **A top-level statement** is one of these: an `import` or `export` declaration, a function or class declaration, or a `const` declaration.
2. **A `const` initialiser** is built only from these parts:
   - literals, regex literals included;
   - identifiers;
   - function and arrow function expressions;
   - array and object literals of these, with no computed keys.
3. **Anything else goes in a builder function**, called once with a `/* @__PURE__ */` annotation. That covers a call, a `new` (typed arrays and scratch objects included), a property read such as `CP.KA`, and an operator on any value. For example, `export const CLASS = /* @__PURE__ */ buildClassTable()`, and `const ZAWGYI = /* @__PURE__ */ compileFont(ZAWGYI_FONT)`. The arguments of an annotated call follow rule 2: identifiers and literals only.
   - **A table whose rows read properties**, such as glyph rows that name `ROLE.BASE`, is returned by its builder: `export const ZAWGYI_GLYPHS = /* @__PURE__ */ zawgyiGlyphTable()`. The builder's body is a single `return deepFreeze({ ... })`. The function-size guard counts such a body as data, not code, so its 40-line limit does not apply (§6.2).
4. **Frozen data goes through `deepFreeze`**, annotated: `export const ERR = /* @__PURE__ */ deepFreeze({ ... })`. A bare `Object.freeze(...)` is not allowed at the top level.
5. **Strings are literals**, with `\u` escapes, never built at load. `KINZI_TEXT` is a literal of three escapes. The patterns and labels of the rows read from the glyph table (§3.9) are the one exception: an annotated builder makes them from the table's texts, which are literals.
6. **Bit masks and option bits are number literals**, each with a comment that names what it combines (`MASK_ANY_AA`, `UNICODE_READING.heldZeroWidth`). A test checks each one against its definition.

The evidence is from esbuild 0.25.12, with `"sideEffects": false` and with and without minify. These stay in the bundle when nothing uses them:
- `Object.freeze({...})`;
- an unannotated call or `new`, a typed array included;
- a literal that reads a property, such as `{a: CP.KA}` or `[[ROLE.BASE, text]]`. That holds whether the object read is frozen, a plain literal, local or imported, and also when the literal is the argument of an annotated call.

These are dropped:
- plain literals;
- annotated calls whose arguments are identifiers or literals;
- a table returned by an annotated builder, whatever its rows read;
- chains of them, such as a table, then `compileFont(TABLE)`, then a stage list that uses the result;
- unused classes, with their methods and getters.

**Checks.**
- `test/next/guards/treeShaking.test.mjs` checks rules 1-5 with acorn. It reads the comments through `onComment`, to see each annotation.
- `scripts/next/size.mjs` bundles a normalize-only entry (`import { normalizeText } from 'src/stages/normalize.js'`) and reads esbuild's metafile. These must contribute 0 bytes to it:
  - `fonts/*.js`, `engine/fontReader.js` and `stages/fonts.js`;
  - `rules/detect.js`, `rules/segment.js` and `rules/unicodeToZawgyi.js`;
  - `compat/` and `spec/`.
- Both run in every PR from W0 on (§7.2).

The cost is small. A table built by a function is still built once, at load, when the module's export is used. `compileFont`'s load-time checks (§3.8) are dropped only from a bundle that never converts, and the font tests run every check.

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
- U+1022 and U+1028 are syllable bases for the readers, but not in the Unicode break letters (`rules/segment.js`, row U2).
- The Zawgyi break bases do not match the glyph table (syllable.js:226 against zawgyi.js:29-30).
- The script-wide CONSONANT set is not `isBurmeseConsonant`.

`rules/segment.js` keeps its break-letter and opener sets locally, named after the rows they serve (U2/U6, Z1/Z7, U3/Z4), because no other module uses them.

### 3.2 Mark order: MARK_GROUPS, MARK_RANK and the mark bits

`MARK_GROUPS` is the UTN #11 storage order of the marks after the base, taken from storageOrder.js:19-32. Marks in one group keep the order they were typed in.

```
0 medial ya   1 medial ra   2 medial wa   3 medial ha   4 e   5 i, ii   6 u, uu   7 tall aa, aa
8 ai, anusvara (after a lower vowel or aa, as Mon and Pa'o write them)   9 dot below   10 asat   11 visarga
```

- **`MARK_RANK`** is an `Int8Array(20)` over U+102B-U+103E, built from `MARK_GROUPS` at load by a `/* @__PURE__ */` builder call (§2.4). U+1033-U+1035 and U+1039 get `RANK_UNRANKED` (12), so they sort last as in 2.x's `rank()`.
- **The named ranks** (`RANK_LAST_MEDIAL` and the others) are read from the table by code point, in builder calls, never written as numbers. A test asserts the values 3, 4, 5, 6, 8 and 12. This replaces the hand-copied indexes of storageOrder.js:34-37.
- **The mark bits.** Every mark a reader pushes lies in U+102B-U+103E (§3.3), so `markBit(code)` fits in 20 bits. Each mask is the union of `markBit` over the marks below. In the source each mask is a number literal, with a comment that names its marks (§2.4 rule 6), and `codes.test.mjs` checks each against its union:

| Mask | Marks |
|---|---|
| ANY_AA | U+102B, U+102C |
| UPPER_VOWELS | U+102D, U+102E |
| LOWER_VOWELS | U+102F, U+1030 |
| E_OR_AA | U+1031, U+102B, U+102C |
| MEDIALS | U+103B-U+103E |
| VOWEL_OR_FINAL | every mark whose rank is `RANK_FIRST_VOWEL` or more, except asat (2.x `hasVowel`, storageOrder.js:376-383) |
| ASAT, DOT_BELOW, VISARGA, MEDIAL_YA, MEDIAL_HA | one mark each |
| E_TO_DOT_BELOW | the marks of ranks `RANK_E` to 9: U+102B-U+1032, U+1036, U+1037 (as reviewed, for `writesAsTyped`, §3.4) |

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
| `typedInOrder` | boolean | no part came out of its place (as reviewed, §3.4): cleared by a pending e or medial ra at `open`, a mark typed twice, a stack pushed after a mark, and `goOn` past a held unit |

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

- **`placeAsat`** (UTN #11; research/zawgyi-to-unicode.md §3) decides in this order, as storageOrder.js:117-132 does. The first test that holds wins:

  ```
  hasAa                = markMask has ANY_AA (U+102B or U+102C)
  hasUpperVowel        = markMask has UPPER_VOWELS (i or ii)
  hasDotBelow          = markMask has DOT_BELOW
  hasMedial            = markMask has MEDIALS
  eOrAaTypedBeforeAsat = e, tall aa or aa comes before the asat in `marks` (typed order; 2.x hasAny(marks, E_AA, asat))

  no asat                                                            -> NONE
  !hasAa && (hasUpperVowel || (stacked && !hasDotBelow))             -> DROPPED: remove the asat
  hasDotBelow || eOrAaTypedBeforeAsat || (hasAa && !hasMedial)       -> IN_ORDER: keep it in marks, sorted with them
  medial ha among the marks                                          -> AFTER_MEDIALS: remove it (Mon final h)
  otherwise                                                          -> ON_CONSONANT: remove it (kyun-up, loanword finals)
  ```

  - `DROPPED` is a slip, typed early for the next consonant's asat. The `!hasAa` covers both alternatives, as in 2.x's `slip = !hasAa && (I || (stacked && !dotBelow))`. So a stacked syllable with aa and asat, such as U+1000 U+1039 U+1000 U+102C U+103A, is not `DROPPED`. It is `IN_ORDER`, because it has aa and no medial.
  - `DROPPED` is tested before `IN_ORDER`. So a syllable with a dot below and i, and no aa, drops its asat even though the dot below alone would keep it.
  - `IN_ORDER` means the asat is stored last. Its three reasons are a dot below, e or aa typed before the asat (kyaw), and aa with no medial.
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

**As typed** (as reviewed, §7.11). 99.92% of the syllables normalize reads come out unchanged, so before ordering, `writesAsTyped(buf)` asks whether `orderSyllable` would write the parts exactly as they came: kinzi, base, stack, then the marks in typed order. It holds when all of these do:
- `typedInOrder`: no pending e or medial ra became a mark, no mark was typed twice, no stack came after a mark, and the syllable did not go on past a held unit;
- the marks came in rank order, so `sortByRank` keeps them, and `rankMarks` changes no rank: ai or anusvara ranks lower only when typed before aa, which ranks below them;
- the asat stays where it was typed: `placeAsat` does not drop it; `IN_ORDER` sorts it with the marks; `ON_CONSONANT` writes it right after the stack, which is where it was typed only as the first mark; `AFTER_MEDIALS` writes it after the medials, which is where it was typed only when no mark of ranks `RANK_E` to 9 is present (`MASK_E_TO_DOT_BELOW`);
- `fixLookAlikeLetters` changes nothing: no ca with medial ya where rule 1 reads it, a u that keeps its reading (`keepU`, or no stack, asat or aa), and a seven with no mark but visarga.

The Unicode reader then writes and compares nothing (§3.6). The font reader does not ask: `writesAsTyped` holds on 86% of the syllables of perf's FLORES lines in Zawgyi, but writing those as they came was no faster than `orderSyllable`, which already skips the sort for a syllable of one mark, and the check made the Zawgyi and Win rows 3-7% slower under Node (`npm run perf`, 5 rounds). `syllable.fuzz.test.mjs` checks on 20,000 records that 2.x writes the parts as they came wherever `writesAsTyped` holds.

### 3.5 Reader options: the four deliberate differences

The two readers share `SyllableBuffer`, `orderSyllable` and the held-character logic. They differ on purpose in four places (ARCHITECTURE.md, "The four deliberate differences between the readers"). Each difference is a named field of the reader's frozen options, and the reader reads it at the one place where it decides. No other branch may encode a difference. The options name the readers' behaviour; they are not switches. Only the shipped values are supported and tested.

| Option | FONT_READING | UNICODE_READING | Read at |
|---|---|---|---|
| `heldZeroWidth` | `ZW.ALL`: U+200B, U+200C, U+200D, U+2060, U+FEFF | `ZW.ZWSP \| ZW.WORD_JOINER \| ZW.BOM`. ZWNJ and ZWJ stay where they were typed: in Unicode they can shape the syllable. | `isHeld(buf, code, reading)` |
| `digitTakesMarksAcrossSpace` | `true`: after a held space, a mark joins any base | `false`: a Burmese digit base takes no mark from across a space | `marksGoOn(buf, reading)`, which is `!buf.spaceHeld \|\| reading.digitTakesMarksAcrossSpace \|\| !isBurmeseDigit(buf.base)` |
| `prebaseCrossesZeroWidth` | `true`: with no open syllable, a zero-width character is written at once, and pending e or medial ra go on waiting for the next base | `false`: an e or medial ra looks only at the unit right after its run, so a zero-width unit there makes it stay | font reader, step 2; Unicode reader, `placePrebaseMark` (§3.6) |
| `keepUAfterVowelSign` | `false`: Zawgyi and Win text is Burmese | `true`: U+1025 right after a vowel sign (U+102B-U+1032, U+1036) stays u, as Pa'o writes it | Unicode reader, step 3 |

`test/next/readers-unicode.test.mjs` (W5) and `readers-font.test.mjs` (W6) each pin their reader's side of each difference, with the examples in the ARCHITECTURE.md section. The Unicode reader adds one rule of its own that is not one of the four: e and medial ra never go back across a space (research/normalize.md §3). It reads that rule from `buf.spaceHeld` in its step 6.

### 3.6 The readers

Both readers read UTF-16 units once, from left to right, and dispatch in the order below. **The order is part of the behaviour.** The authoritative behaviour is the oracle (`scripts/oracle/storageOrder.js`, identical to `library/storageOrder.js` at the reference). The plan's verified prototypes are the starting point for the code:
- `SCR/performance/fused-arrange.js` for the Unicode reader;
- `SCR/engine/pc/fast-arrange.js` for the font reader.

They keep their hot state in the scratch `SyllableBuffer` and in one per-reader state object, and call module-level helpers. They create no closures per call (§6 of the plan, the remaining frontier). The prototypes kept that state in closure locals instead, so their speed is evidence for the algorithm, not for this structure; W5 and W6 measure the structure early (§7.7, §7.8).

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

Closing a syllable that `writesAsTyped` (§3.4) writes and compares nothing: here its source is exactly what `orderSyllable` would write, since the reader reads a kinzi as its four units, a stack as its virama and consonant, and each mark where it was typed, and the units held after the last mark are written after it as they came (as reviewed, §7.11).

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

As reviewed (§7.11), the loop also notes whether NFC may change what it writes, for gate 4 of §3.10: it ORs the compiled font's `nfcRisk` of every glyph written whole (steps 4, 5 and 7) and `mayChangeUnderNfc` of every unit with no glyph. `readFontNoting` returns the text with that flag; `readFont` returns the text alone.

As built (W6), the loop looks the glyph up first, and takes steps 1-3 only for a unit with no glyph. That keeps this order, because compileFont gives no space or zero-width character a glyph (§3.8, check 1), and it spares every other unit the held and zero-width tests: measured before W5 landed, with a stand-in for its buffer, the reader alone went from 0.434 to 0.416 of 2.x `arrange` on Zawgyi lines, and from 0.458 to 0.389 on Win lines.

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

As everywhere in this spec, `length: number` is state the constructor assigns (`this.length = 0`), not a class field (§2.3, D14). The same holds for `syllable` below.

`decode` never uses `TextDecoder`, because it replaces lone surrogates (§3.4 of the plan).

**`CopyThroughWriter`** is the Unicode reader's output. It appends slices of the input and returns the input string itself when nothing changed (§3.4 of the plan). 99.92% of syllables and 93.6% of lines come out of `normalize` unchanged (`SCR/profile/floor.js`).

```ts
class CopyThroughWriter {
  begin(source: string): void          // copyFrom = 0; out = ''
  readonly syllable: CodeBuffer        // assigned in the constructor; closeSyllable writes here; cleared by beginSyllable()
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

`compileFont(definition)` checks the table and builds a `CompiledFont` once, at module load, in `stages/fonts.js`. Each call is `/* @__PURE__ */` (§2.4), so a bundle that never converts drops both the call and the tables. **The checks run at load and throw `libraryError(ERR.INVALID_FONT_TABLE, …)`** (PR 2.4 of the plan). `test/next/fonts.test.mjs` runs each one on a deliberately broken row, so a bundle that drops them loses no coverage. The checks:

1. Every key is one UTF-16 unit, and no key or alias is a space (U+0020, U+00A0) or a zero-width character: `readFont` holds or writes those before a glyph could be read (§3.6), so a row for one would be dead.
2. Every role is a known `ROLE`.
3. For MARK and BEFORE_BASE rows, every unit of the text and of the attached marks has a rank (`markRank < RANK_UNRANKED`). For STACK and KINZI rows, every attached mark does.
4. The shapes of the texts:
   - BASE text is one unit (a syllable base or a Burmese digit), or a ligature (consonant, U+1039, consonant), or one of the font's declared `wholeBases`. Those are Zawgyi lagaung (U+104E U+1004 U+103A U+1038), and Win kyat and nnya-with-aa. Their inner marks are written as they are, not sorted, which is §10 Q19, kept on purpose.
   - STACK text is U+1039 plus a Burmese consonant.
   - KINZI text is `KINZI_TEXT`.
   - BASE texts are at most 8 units, and a BASE row has no attached marks (2.x never wrote them for a base).
   - PLAIN text may be any string, empty included (Win's vendor logo at 0xB0 has no text).
5. Every alias names a key of the table, and no alias is itself a key, which would hide its row. No `selfBases` code is also a key.

Built-in rule (2.x `font()`, storageOrder.js:206-209): every syllable base in U+1000-U+104F that the table does not list is a base of itself.

The `CompiledFont` layout is private to `fontReader.js`. It must give `readFont` these things:
- `nfcRisk`: for each glyph, 1 when NFC may move or compose one of its units (`mayChangeUnderNfc`), for gate 4 of §3.10 (as reviewed);
- an O(1) glyph lookup by code: a `Uint16Array` index sized to the highest key plus 1, where 0 means no glyph. Win's index runs to U+2039, 8,250 entries.
- for each glyph: its role, its text units, the units it pushes as marks (text plus attached marks for MARK and BEFORE_BASE; attached marks only for STACK and KINZI), and its "whole" units (text plus attached marks, written when it cannot join);
- `name` and `sequences` for the stages.

All of this goes in flat typed arrays, built at load. There are no per-glyph objects.

### 3.9 Rule rows and traces

**Rule rows** (`RuleRow`, §2.3) replace 2.x's bare tuples. A row ships only what the code reads: `id`, `re`, `to`, `repeat`, `needs` on the Unicode to Zawgyi rows (§3.10, gate 3), and `label` on six rows (D17). The row tables are:
- Unicode to Zawgyi: 65 rows in 2.x order. The source holds them in named section arrays, SHAPES_IN_CONTEXT, KINZI, VISUAL_ORDER, SMALL_LETTERS, GLYPHS, NARROW_TA and MEDIAL_RA_SHAPES (PR 3.5 of the plan). They are joined in 2.x order by a `/* @__PURE__ */` builder (§2.4). The rows of one fixed text whose glyph the Zawgyi glyph table gives are read from it (below). Each row has a `why` comment above it, a run of table texts one comment for the run, and each id has an example in `test/next/unicodeToZawgyi.test.mjs`.
- the font sequences, with their 2.x comments.

**Rows read from the Zawgyi glyph table** (plan Phase 6 #5, §7.12). 42 of 2.x's 65 rows replace one fixed Unicode text with one fixed text. For 38 of them, the replacement is the glyph that `fonts/zawgyi.js` draws that text with: the table read backwards, taking the first glyph whose row is exactly the text, its attached marks included (where several glyphs draw one text, the table lists the plain shape first). A section lists such a row by its Unicode text alone, and `tableRows` builds the row at load: its regex is the text's `\u` escapes in lowercase, as 2.x wrote them, so its label is 2.x's source, and a text that starts at U+1000-U+1010 gets the wrapped regex and the label of decision 29. Its `needs` is the text's virama, or its first unit. That is the kinzi row and 37 of the 38 rows of GLYPHS. The other four are written by hand, each with the reason above it, because the table read backwards does not give them: `uz.order.5` moves e and writes no glyph; `uz.small.2` writes the short na, which the table gives for every na, only after medial ra; `uz.glyphs.23` writes the stacked jha glyph U+1069 for stacked ca with medial ya, while the table reads U+1069 as stacked jha, which 2.x leaves alone; `uz.medial-ra.8` writes two glyphs, each chosen by the other. The test checks both ways: the rows the source lists as texts are exactly the 2.x rows whose replacement is the table's glyph for their text. The order of the rows stays 2.x's and is written out: it decides the output where two rows can match the same units, and `fontConvert.debugging` lists the rows that changed the text in it.

**GLYPHS in one pass.** `unicodeToZawgyi` does not run the 38 GLYPHS rows one by one. `writeGlyphs` reads the text once, from left to right, and at each unit writes the glyph of the first row, in row order, whose text starts there, then goes on after that text. That is the rows' own result whenever two facts hold, and the test checks both on every pair of rows:
- no row reads a unit that a row before it writes, so each row matches only units of the text GLYPHS is given, left as the rows before it left them, and a row's match never spans a glyph;
- where the matches of two rows overlap, the one that starts first belongs to the earlier row; two that start at the same unit are tried in row order.

Then the rows give the leftmost matches, each taken by the earliest row that matches there, which is what one pass from the left takes. The second fact fails only in a stack on a stack, a virama two units after another: there 2.x writes a joined consonant before the stacked consonant whose virama it shares, so the rows give U+1039 U+1092 for U+1039 U+100B U+1039 U+100C, where one pass would give U+106C U+106D (the made-up input of decision 30). Five pairs of rows overlap that way, and `writeGlyphs` runs the rows one by one on any text that holds a virama two units after a virama. The trace runs the rows one by one too, since 2.x's log names each. The test compares the pass with the rows on every string of up to four units over the 19 units where rows meet, every string of up to five over the units of the stacks, and long texts joined from them; the fuzz compares the whole conversion with 2.x.

The typo rules are not rule rows: `fixTypos` is one scan (below). They are documented, with a `why` and an example each, in `spec/typoRows.js`, which the tests read.

**Labels.** `ruleLabel(row)` is the row's 2.x `RegExp#source`. For most rows the literal is the 2.x literal, so that is `row.re.source`, and the row has no `label`. For six Unicode to Zawgyi rows, the 2.x literal starts with a unit in U+1000-U+1010 (syllable.js:13, :53-56, :58). Their `re` wraps that first unit in a one-character class (decision 29), and their `label` keeps the old source.

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

They are the same list, `[start, ...records.map(r => r.text)]`, for a reason. Between two logged rules no rule changed the text: once rows are logged exactly when they change it, and every repeat row's match changes it (its replacement starts with a different unit, which a row test asserts). So "the text before rule k" is "the text after the previous logged rule", and the first one is the collapsed text. compat builds 2.x's `matched_patterns` from the records' `label`s. The 3.0 API will read their `id`s, which is why ids are unique within a table and stage ids within a pipeline.

### 3.10 Stages and the gating policy

A pipeline is a frozen list of stages, run by `core/rules.js` `runStages` (D10). The functions of `stages/normalize.js` and `stages/fonts.js` are three lines each:
- make the pipeline's context;
- for traces, call `startTrace`;
- call `runStages`.

If W5's measurement (§7.7) shows that the runner costs more than 2% on the per-word row, `normalizeText` calls its stage functions directly, in list order, and the trace keeps `runStages`. A test then checks on the fuzz that `normalizeText` equals `runStages` over `NORMALIZE_STAGES`, both gate settings included, so the two paths still cannot drift.

The syllables stage of `NORMALIZE_STAGES` stores the reader's `seen` in `ctx.seen`. So `stages/normalize.js` owns both the reader call and the gate check, and the contract sits in one place (§3.4 of the plan).

**A gate skips a stage only when the stage provably cannot change the text.** Two gates ship with decision 28, and the review added two (§7.11):

1. **The no-Myanmar fast path.** `normalizeText` returns `toNfc(text)` at once when `text` has no unit in the three Myanmar blocks (`hasMyanmarScriptChar`).
   - Proof: with no Myanmar unit, the reader writes every unit through unchanged, the typing fixes match nothing, and NFC cannot create Myanmar units (`SCR/verify-cleanup/p5`).
   - Measured: 127x on ASCII text (PR 1.5 of the plan).
2. **The final-NFC gate.** The `'nfc.final'` stage of `NORMALIZE_STAGES` runs only when `ctx.seen` has `SEEN.LETTER_U` or `SEEN.NFC_UNSAFE`.
   - Proof: the reader's input is already NFC. The reader only reorders Burmese marks within a syllable, drops repeated or slipped marks, and turns ca, u and seven into jha, nya and ra. The typing fixes write only U+102E, U+1030, U+102A, U+104E, U+101D, U+101B, U+1040 and U+1047. None of these compose or reorder under NFC, except U+1025 followed by U+102E, which becomes U+1026. That is why `LETTER_U` opens the gate.
   - Every unit outside the blocks that NFC could move or compose sets `NFC_UNSAFE`. The safe set was checked over 943 code points on Node 26's ICU (`SCR/performance/nfc-safe-check2.js`). `test/next/codes.test.mjs` reruns that check on every runtime the tests run on (§10.5 of the plan).

3. **The Unicode to Zawgyi rows that cannot match** (as reviewed, §7.11). Each row names `needs`: units of which every match of its `re` holds at least one, a literal of the pattern that no match can leave out (the rarest, where it has several). While `collapseRepeatedMarks` collapses the text, the same pass notes every unit of U+1000-U+109F it holds in a unit set (`codes.js`), and `unicodeToZawgyi` skips a row whose `needs` share no unit with the set. A row that changes the text adds every unit of its replacement to the set.
   - Proof: the set holds every unit of U+1000-U+109F the text can hold at each row's turn. The text's own units are noted before the first row, and a replacement writes only its literal units, which are added, and the units its $-references copy, which the text held already. A row is skipped only when the text holds none of its `needs`, and then it has no match, so its replace would return the text.
   - The repeat rows are tested, then replaced once, as 2.x's 1584410 does: one replace leaves no match of a repeat row. A row is recorded in a trace exactly when it changes the text, which is when 2.x logs it, because a repeat row's match always changes the text (§3.9).
   - Checked: `test/next/unicodeToZawgyi.test.mjs` runs the examples, the table probes and 20,000 seeded strings through the rows one by one, and requires every match of each row, on the text that row is given, to hold one of its `needs` (every row matches at least once there), one replace of a repeat row to leave no match, and the result and trace to equal `applyRuleRows` and `traceRuleRows` over every row. The fuzz of §6.1 compares with 2.x.
   - The font sequences use the same field: `zg.lagaung.1`, whose regex starts with a group and so is tried at every position of the text, names the four it needs, and `applyRuleRows` skips it on a text with no four, after one search for that unit. `fonts.test.mjs` checks on 20,000 strings that every match holds a four.
   - Measured, against the ungated rows (`npm run perf`, Node 26.5, 3 rounds): `fontConvert.unicode-zawgyi` 0.81, 0.37, 0.97 and 0.97 per line, word, string and document; Bun 1.4.2: 0.80, 0.40, 0.97 and 0.97. The skip is decided by the units, never by text length: a version that stopped noting units above 1,024 units jumped in cost per unit there, and read 1.5-2.2 on 69 growth cells under Bun.

4. **The final NFC of the font pipeline** (as reviewed, §7.11). The `'NFC'` stage of `FONT_STAGES` runs only when the font reader noted a unit NFC may change (`readFontNoting`, §3.6). Zawgyi and Win text is not NFC on the way in, so the proof differs from gate 2's.
   - In U+1000-U+109F, NFC changes only U+1037, U+1039, U+103A and U+108D (combining classes 7, 9, 9 and 220) and U+1025, which composes with a U+102E after it into U+1026 (`mayChangeUnderNfc`; `codes.test.mjs` checks this on every runtime). Outside the block it changes only units that `isNfcSafe` leaves out.
   - The reader notes every unit it writes outside a sorted syllable: the glyphs of bases, of pending e and medial ra and of glyphs that join no syllable, through each glyph's `nfcRisk`, and every unit with no glyph. The marks of a sorted syllable are in canonical order: `MARK_GROUPS` puts dot below before asat, the kinzi and a stack put a starter after their virama, and the two asat placements that move the asat forward, `ON_CONSONANT` and `AFTER_MEDIALS`, never have a dot below.
   - The typing-fix stages after the reader write and remove only U+102E, U+1030, U+102A, U+104E, U+101D, U+101B, U+1040 and U+1047, starters that NFC leaves alone, and each replaces its match with a starter, so they put no two non-starters side by side. The one composition they can make, U+1025 before U+102E, needs a U+1025, which the reader noted.
   - Checked: `fontToUnicode.fuzz.test.mjs` runs the stages by hand on 100,000 Zawgyi and Win strings and requires `toNfc(text) === text` wherever the gate stays closed (it does on more than a thousand of each), the result to equal the stages with the gate open, and the gated call to equal `openAllGates`. On perf's FLORES text the gate stays closed on 314 of 400 Zawgyi lines and 3,523 of 3,598 words, and opens on one string.
   - Measured, against the ungated pipeline (`npm run perf`, 5 rounds): `fontConvert.zawgyi-unicode` 0.89, 0.87, 0.97 and 0.97 per line, word, string and document under Node, 0.96, 0.94, 1.02 and 1.01 under Bun; `fontConvert.win-unicode` 0.89, 0.87, 0.95 and 0.92 under Node.

**Nothing else is gated.**
- The typo and look-alike gates (PR 2.7) are not built: they would couple the typing-fix rules to the reader's trigger bits.
- The font pipeline's other stages stay ungated. Their fused trigger bits were never prototyped, and the separate-scan version was slower on one big string: 62.1 ms against 55.2 ms.

**The force switch.** `normalizeText(text, { openAllGates: true })` runs every stage and skips the fast path, as if every gate were open; `fontToUnicode(text, fontName, { openAllGates: true })` runs the final NFC. Tests run the fuzz both ways and require the same output. They also check soundness directly: whenever the final-NFC gate stays closed, `toNfc(result) === result`. **The trace runner never gates** (§2.3, `runStages`).

### 3.11 Scratch buffers and memory

| Module | Scratch objects |
|---|---|
| `engine/unicodeReader.js` | the Unicode reader's `SyllableBuffer`, its state object and its `CopyThroughWriter` |
| `engine/fontReader.js` | the font reader's `SyllableBuffer` and its output `CodeBuffer` |
| `engine/syllable.js` | none: every buffer belongs to a `SyllableBuffer` or `CodeBuffer` instance |
| `core/nfc.js` | not scratch, but the one memo of the core: `NFC_MEMO` (D20). At most 128 KB of kinds, plus one entry per run character and per combining class of the runtime's Unicode data. |

Rules:
- Each scratch object is a module constant made by a `/* @__PURE__ */` factory call (§2.4), so a bundle that does not use its reader drops it.
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
   - Module-level values are frozen data (tables, compiled fonts, rule rows), the scratch objects of §3.11, `NFC_MEMO` in `core/nfc.js` (D20), or the three module-private exec-loop regexes of `rules/typingFixes.js` (`TYPOS`, `ZERO_OR_SEVEN`, `BURMESE_DIGIT`). The memo holds facts about the runtime's Unicode data, never the result of a call. Each exec loop sets its regex's `lastIndex` to 0 first and runs until `exec` returns null, which leaves it at 0, so the regex carries nothing from one call to the next.
   - Top-level `let` and `var` are not allowed.
   - A global regex in a row is never frozen (D16). `replace` and `search`, the only methods the core calls on it, leave its `lastIndex` at 0.
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
5. **The myanmar-tools detector is injected.** `rules/detect.js` takes a `zawgyiModel` object with `getZawgyiProbability(text)`. The core never loads it. compat loads it, for the 2.x API, in `compat/zawgyiModel.js` (D3).
6. **Determinism.** Outputs depend only on the arguments and on the runtime's NFC data.

`test/next/guards/stateless.test.mjs` checks this. It parses every core file with acorn and checks rules 1 and 2. For rule 1 it reads what each top-level `const` holds (`test/next/guards/moduleState.mjs`): a literal, an identifier or a function; a regex literal that no code drives with `exec`, a sticky or global `test`, or a write to `lastIndex`; frozen data, made by `deepFreeze(...)` or by a builder, in the file or imported, whose every `return` is `deepFreeze(...)`; a table, made by a builder whose every `return` is a typed array it makes; or an exported primitive, checked at run time. Anything else is module state and must be listed by name, with its reason, in the guard's `MODULE_STATE`: `NFC_MEMO`, the readers' scratch (`SCRATCH` in `engine/unicodeReader.js`, `FONT_SYLLABLE` and `FONT_OUTPUT` in `engine/fontReader.js`) and the three exec-loop regexes. No other may be added without a line there and here. (As built, the guard flagged only object and array literals, so it never saw the objects made by calls, and a `/* @__PURE__ */ new Map()` cache would have passed; the review made it read the initialisers, §7.11.) It runs these configurations interleaved in one process:
- `detectFont` with two different stub models;
- `normalizeText` with and without `openAllGates`;
- `toNfc` (the warm memo) against `toNfcWith(text, createNfcMemo())` (a cold one); `core-nfc.fuzz.test.mjs` repeats it on the fuzz.

It requires each call to honour its own arguments, with no carry-over (Phase 6 exit).

It also checks freezing. Every exported plain object and array must be `Object.isFrozen`, deeply through plain objects and arrays. RegExps and typed arrays are exempt (§2.3): they are read-only by contract, and the test checks that every row's `re` has `lastIndex` 0 after the fuzz. The exec-loop regexes are private, so the test checks them by their effect: each typing fix runs on a fuzz string built to make its loop pass over a match before the end, then at once on a probe whose match is at index 0, and must give 2.x's result. A loop that left `lastIndex` past 0 would skip that match.

---

## 5. compat: the 2.x API on the core

### 5.1 Files and shape

| File | Exports | Holds |
|---|---|---|
| `compat/index.js` | `version`, `setGlobalOptions`, `fontDetect`, `fontConvert`, `syllBreak`, `spellingFix`, `truncate`, `normalize` (named), and `default` | The export object: those 8 keys in that order, plus a non-enumerable `default` that points to the object itself (main.js:13-26). `version` is `PACKAGE_VERSION`. |
| `compat/globalOptions.js` | `setGlobalOptions`, `isSilentMode`, `storedDetectorOptions`, `mergeDetectorOptions`, `report`, `reportAlways`, `MESSAGES` | The option store. It and the loader instance of `zawgyiModel.js` are compat's only module state. It is the only file that writes to the console. `report(level, message)` checks silent mode at call time and returns whether it printed. Both writers look `console[level]` up at call time, never at load, because the matrix swaps the console methods per cell. |
| `compat/input.js` | `INPUT_POLICY`, `enter`, `unboxString`, `cleanText`, `resolveFont`, `chooseFontLegacy`, `ON_TIE_ASSUME_ZAWGYI` | The 2.x preamble (D1) |
| `compat/legacy.js` | `legacyBreakFont`, `legacyCollapseFont`, `NO_RULES`, `legacyTypeError`, `toJoinSeparator`, `legacyWinTables` | 2.x's property-lookup quirks, and the 2.x shape of the Win tables: `legacyWinTables()` returns library/win.js's `{ WIN, SEQUENCES, ROLES }` (role strings, the C1 controls as keys sharing their key's row, `[RegExp, replacement]` pairs), with new objects and RegExps at each call, for compat and the shim of library/win.js when 3.0 deletes library/ (§9) |
| `compat/zawgyiModel.js` | `createZawgyiModelLoader`, `zawgyiModelLoader` | The myanmar-tools loader (D3, D21). It imports no other compat file, and writes nothing to the console. |
| `compat/fontDetect.js` | `fontDetect`, `fontDetectCore`, `detectForRouting` | |
| `compat/fontConvert.js` | `fontConvert` (with `.debugging`) | |
| `compat/text.js` | `normalize`, `syllBreak`, `spellingFix`, `truncate` | |

The compat imports run one way, so there is no cycle (§2.2):

| File | Imports these compat files |
|---|---|
| `globalOptions.js`, `legacy.js`, `zawgyiModel.js` | none |
| `input.js` | `globalOptions.js` (`enter` warns) |
| `fontDetect.js` | `input.js`, `globalOptions.js`, `zawgyiModel.js` |
| `fontConvert.js`, `text.js` | `fontDetect.js`, `input.js`, `legacy.js`, `globalOptions.js` |
| `index.js` | `fontDetect.js`, `fontConvert.js`, `text.js`, `globalOptions.js` |

The two shared signatures:

```ts
// The 2.x font choice of syllBreak, spellingFix and truncate (C11). A falsy name means detect(text);
// otherwise resolveFont(name) || name, kept as given. The caller passes the detector, so input.js does not
// import fontDetect.js, which imports input.js for cleanText.
export function chooseFontLegacy(name: unknown, text: string, detect: (text: string) => unknown): unknown

// compat/zawgyiModel.js
type ZawgyiModelLoader = Readonly<{
  load(): ZawgyiModel | null,   // the first call tries to load and records the outcome; later calls return it
  missingMessage(): string,     // the §5.3 text for the recorded outcome
  // Calls write(missingMessage()) unless a warning has already printed, and records that one printed only when
  // write returns true. So a call in silent mode leaves the next call free to warn (C26).
  warnOnce(write: (message: string) => boolean): void
}>
// requireFn(id) returns the package, throws its load error, or returns null where there is no Node-style require.
export function createZawgyiModelLoader(requireFn: (id: string) => unknown): ZawgyiModelLoader
// The one instance compat uses. Its requireFn builds the require of C26 at its first call, from the working
// directory at that moment, not at import.
export const zawgyiModelLoader: ZawgyiModelLoader
```

The flows, as the builder writes them. `enter` returns `{kind: 'missing' | 'other' | 'text', value}`.

```
fontDetect(content, fallback_font_type, options = {})            // length 2, as in 2.x
  input = enter('fontDetect', content); if input.kind !== 'text': return fallback_font_type || 'en'
  if !hasMyanmarBlockChar(input.value): return fallback_font_type || 'en'
  return fontDetectCore(input.value, fallback_font_type || 'zawgyi', options)

fontDetectCore(text, fallback, options, loader = zawgyiModelLoader)   // compat never passes loader; tests do
  cleaned = cleanText(text)                                     // trim, then stripZeroWidthBreaks
  requested = options.adapter                                   // null options: TypeError here, as in 2.x
  merged = mergeDetectorOptions(options)                        // may print the threshold error
  if pickAdapter(requested, merged) === 'rules': return decide(countEvidence(cleaned), fallback)
  model = loader.load()
  if !model:
    loader.warnOnce(function (message) { return report('warn', message) })   // silent-aware
    return decide(countEvidence(cleaned), fallback)
  return scoreByZawgyiModel(cleaned, model, merged.myanmartools_zg_threshold, fallback)

detectForRouting(text)                                          // 2.x fontDetect(text), called on text with Myanmar
  return fontDetectCore(text, ON_TIE_ASSUME_ZAWGYI, NO_OPTIONS)

fontConvert(content, to, from)                                  // a function, not an arrow: `this` is the receiver; length 3
  input = enter('fontConvert', content); if input.kind !== 'text': return input.value
  text = input.value
  if resolveFont(from) !== 'win' and !hasMyanmarBlockChar(text): return text
  if !to: report('error', MESSAGES.noTarget); return text
  text = text.trim(); target = resolveFont(to); source = resolveFont(from)
  if !target: report('error', MESSAGES.unknownTarget); return text
  if !source: source = detectForRouting(text)                   // on the trimmed text (C15)
  if target === source: return text
  if target === 'win' or (source === 'win' and target !== 'unicode'): report('error', MESSAGES.winSourceOnly); return text
  debug = this && this.debug                                    // read here, as converter.js:53 does
  if FONTS[source].visualOrder: return debug ? fontDebug(...) : fontToUnicode(text, source)
  return debug ? zawgyiDebug(...) : unicodeToZawgyi(text)
fontConvert.debugging = function (content, to, from) { return fontConvert.apply({ debug: true }, [content, to, from]) }
```

`syllBreak`, `spellingFix`, `truncate` and `normalize` follow C8-C24 below in the same style.

The order of calls matters wherever 2.x's order is observable. Each of the three detects through `chooseFontLegacy(name, text, detectForRouting)`, and the `text` it passes differs. **Do not write one "clean, then choose the font" helper for all three:**
- **`syllBreak`** cleans, then detects on the cleaned text (syllBreak.js:16-19). `detectForRouting` cleans it again. Cleaning twice is not the same as once when removing U+200B exposes spaces.
- **`spellingFix`** detects on the text as given (spellingCheck.js:16-17), then cleans it for the collapse.
- **`truncate`** reads all its options before it looks at the content. It detects on `String(content)`, before trim and zero-width removal, and breaks the cleaned text (truncate.js:27-32). On the reference, `fontDetect` of U+200B, space, U+1000, U+103C returns `'zawgyi'`: cleaning once leaves a leading space, so no anchored signature matches and the tie falls back. The same text cleaned first returns `'unicode'`. The difference shows in `truncate`'s output: on U+200B, space, U+1000, U+103C, U+1031, U+1000, U+1000, U+1000 with `{length: 7}`, the reference returns U+1000 U+103C and `'...'` (Zawgyi breaks), while detecting the cleaned text would return U+1000 U+103C U+1031 and `'...'`. `test/next/compat-text.test.mjs` pins both inputs.

### 5.2 The 2.x behaviours compat reproduces

Each row is a behaviour of the reference library that the contract matrix or compare can see, with what provides it. "Core" names the core function or option. Everything else is a compat helper.

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
| C11 | `syllBreak`, `spellingFix` and `truncate`: a falsy font name means detection with fallback `'zawgyi'`; otherwise `resolveFont(name) \|\| name`, kept as given. Each detects on a different text (§5.1). | `chooseFontLegacy(name, text, detectForRouting)` |
| C12 | Rule tables looked up as plain-object properties (syllable.js:216, :260): `BREAK_RULES[name]` and `COLLAPSE[name] \|\| COLLAPSE.unicode`. The outcomes:<ul><li>`'win'`, `'Unicode'`, `1` and other unknown names throw a TypeError in `syllBreak` and `truncate`; `spellingFix` uses the Unicode marks for them.</li><li>Inherited `Object.prototype` names whose value has a `length` above 0 (`constructor`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `__lookupGetter__` and the rest) throw a TypeError in all three.</li><li>Names with length 0 or no length (`toString`, `valueOf`, `toLocaleString`, `__proto__`) run no rules: the text comes back cleaned, with no breaks and no collapse.</li></ul> | `legacyBreakFont` / `legacyCollapseFont` do the same property lookup on plain objects with 2.x's own keys and return `'unicode'`, `'zawgyi'` or `NO_RULES`, or throw `legacyTypeError()` (D13) |
| C13 | `fontDetect` (detector.js:126-156):<ul><li>`fallback \|\| 'zawgyi'` for detection, and a tie returns the fallback as given, of any type;</li><li>`options = {}` only for undefined, and `options.adapter` is read before the merge;</li><li>the adapter is the requested one when that is `'rules'` or `'myanmartools'`; otherwise myanmar-tools when the merged `use_myanmartools` is truthy, else the rules. So `{adapter: 'foo'}` falls through to `use_myanmartools`;</li><li>the model path uses the merged threshold;</li><li>if loading failed, warn once and use the rules.</li></ul> | `fontDetect`, `fontDetectCore`, `pickAdapter`; core `scoreByZawgyiModel` |
| C14 | The rule scorer: the `String#match` counts of the 29 signatures on the cleaned text; unicode > zawgyi, unicode < zawgyi, else the fallback | core `countEvidence`, `decide` |
| C15 | `fontConvert`'s order of checks, messages and trims (converter.js:11-59; §5.1). The source is detected on the trimmed text, with the global detector options. The same font returns the trimmed text. Win as a target, or Win to anything but Unicode, is an error that returns the trimmed text. | `fontConvert` |
| C16 | The debug flag is `this && this.debug`, read after the early exits. `debugging` is `fontConvert.apply({debug: true}, [a, b, c])`. A detached call: §5.4. | `fontConvert` |
| C17 | Zawgyi and Win to Unicode (storageOrder.js:462-485). Debug object `{to: 'unicode', from, matched_patterns, steps}` with the stage names of §2.3. `'glyphs'` appears only when debugging. | core `fontToUnicode`, `traceFontToUnicode` |
| C18 | Unicode to Zawgyi (converter.js:57-58; syllable.js:301-327): the Unicode mark collapse, then 57 once rows and 8 repeat rows of at most 40 passes. Debug object `{to: 'zawgyi', from: 'unicode', matched_patterns: labels, steps: [collapsed text, …]}` (§3.9). | core `unicodeToZawgyi`, `traceUnicodeToZawgyi` |
| C19 | `debugging` returns what `fontConvert` returns on every early exit: strings, `''`, non-strings (§10 Q3) | the same flow |
| C20 | `syllBreak`'s separator (syllable.js:272-275): a falsy separator, or U+200B, means U+200B. Anything else is converted as `Array#join` converts it: `toString` before `valueOf`, and a Symbol throws a TypeError. | `toJoinSeparator(value)` = `['', ''].join(value)`, called after the rule-table lookup, as in 2.x |
| C21 | The break output: Unicode rows U1-U7; Zawgyi rows Z1-Z8, with row Z6 off for text that `looksLikeSgawKaren`; bare consonants joined only in pairs (§10 Q11); no break at the start | core `breakString`, `breakParts` |
| C22 | `spellingFix` detects on the raw text, then cleans, then collapses each run of one repeated mark (per font set, syllable.js:210-213) | core `collapseRepeatedMarks` |
| C23 | `truncate` (truncate.js):<ul><li>`options \|\| {}`; `length \|\| 30`; `omission \|\| '...'`; budget = `length - omission.length`, NaN allowed;</li><li>text with no Myanmar block character: `text.substr(0, budget) + omission`;</li><li>otherwise it detects on `String(content)`, before trim and zero-width removal, and breaks the cleaned text (§5.1);</li><li>whole parts while they fit; a part that does not fit is split on `\s` and adds the words that fit, each followed by a space; then trim, plus the omission;</li><li>not always a prefix (§10 Q5).</li></ul> | `truncate` with `fitParts`; `chooseFontLegacy`; core `breakParts` |
| C24 | `normalize`: NFC, the reader, typos, look-alikes, NFC (normalization.js:22-23). Text with no Myanmar still gets NFC. Typos run before look-alikes, while the fonts run zero as wa, then look-alikes, then typos (§10 Q8). Not idempotent on garbled input (§10 Q12). | core `normalizeText` |
| C25 | The console messages and when they print (§5.3) | `MESSAGES`, `report`, `reportAlways` |
| C26 | myanmar-tools is loaded at most once per process, by the first call that needs it, as the 2.x ES module build does: Node and Bun only, through `process.getBuiltinModule('module').createRequire(process.cwd() + '/package.json')`. It is not loaded in other runtimes. A package without `ZawgyiDetector` counts as a load error. One of three messages is printed once. The warned flag is set only when a message is printed. `main.js` resolves the package from `library/` instead (§5.4). | the shared `zawgyiModelLoader` (D3, D21): it holds the model, the error and the warned flag |
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

### 5.4 The known build differences

compat differs from `main.js` in two ways, and the 2.x ES module build (`knayi-myscript.mjs`) differs in the same two. No other difference is allowed.

**1. The debug flag of a detached call.** A detached call, such as `const f = knayi.fontConvert; f(text, 'unicode')`, made while the page has a global `debug` variable:

| Build | Result |
|---|---|
| sloppy-mode builds (`main.js` and the script builds) | the debug object |
| the 2.x ES module build and compat | the text, because both are strict |

The matrix already records this for `knayi-myscript.mjs` under "debug flag read from this" (scripts/contract/matrix.js:28-37). It is 10 cells, the ids beginning `detached fontConvert(`. The compat module (W8) does three things:
- adds `compat` to that entry's `builds`;
- adds `compat` to `BUILDS`, loaded with `import()` of `src/compat/index.js`;
- checks compat against the 10 cells recorded for `knayi-myscript.mjs`, which it shares (as built, §7.10): `SHARES_RECORDED_DIFFERENCES` maps `compat` to that build, so `test/contract/api-matrix.json` stays as it is, and `npm run matrix:update` fails unless compat differs from `main.js` in exactly those cells, the same way.

That records nothing new about `main.js`, and no other cell may differ (D2).

**2. Where myanmar-tools is looked up** (D3, C26), with `use_myanmartools` on or `adapter: 'myanmartools'`:

| Build | Resolves `myanmar-tools` from |
|---|---|
| `main.js` | `library/detector.js`, through `module.require` |
| the 2.x ES module build and compat | the working directory, through `createRequire(process.cwd() + '/package.json')` |

So in a working directory that cannot resolve the package, `main.js` scores with the model while compat warns and uses the rules (§10 Q15). That happens in a monorepo whose package sits elsewhere, or in a worker started from another directory. Neither compare nor the matrix runs the adapter, so neither can see this. W8 pins it with an adapter test. It runs compat and `main.js` in a child process whose working directory is an empty temporary directory, on plain Unicode text, with the threshold `[-1, -1]`, under which every model score means `'zawgyi'`. `main.js` must answer `'zawgyi'` (the model). compat must print the "not installed" message and answer `'unicode'` (the rule scorer).

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
  - `test/next/<module>.fuzz.test.mjs`: differential tests.
  - `test/next/guards/*.test.mjs`: the rules of §2.2, §2.4, §4, §1.2 and §6.2.
  - `test/next/*.timing.mjs`: growth checks. They run after the other tests, like test/growth.timing.js. There is one per module that has a growth check: `typingFixes`, `segment`, `detect`, `normalize`, `fonts` and `unicodeToZawgyi`. W0 creates each as a stub that skips while its module throws `NOT_BUILT`, so every glob below matches from the first PR on.
- **npm scripts** (W0):
  - The `test` script gains the globs `"test/**/*.test.mjs"` (in the first `node --test`) and `"test/**/*.timing.mjs"` (in the second).
  - `test:fuzz` gains `"test/next/**/*.fuzz.test.mjs"`, and a new `test:fuzz:next` runs only those.
  - `test:bun` gains `bun test ./test/next/*.timing.mjs`. `bun test ./test` picks up only `*.test.*` files, so, as with `test/growth.timing.js`, the timing files are named on the command line; the shell expands the glob to file names, which Bun then runs.
- **File names.** Each module has `<module>.test.mjs` for its unit tests and `<module>.fuzz.test.mjs` for its differential tests. The fuzz files match the `test` glob too, so `npm test` runs them at PR counts, and the nightly leg runs them at nightly counts. §7 names only the unit file of each module.
- **`test/next/helpers.mjs`** provides these, through `createRequire` for the CommonJS files and `import` for the `.mjs` ones:
  - `oracle` (`scripts/oracle`);
  - `internals(file, names)`, which is `loadWithInternals(file, names, { dir: ORACLE })`. It reaches 2.x private functions such as `order`, `arrange`, `font`, `glyphsInTypedOrder`, `zeroAsWa`, `BREAK_RULES`, `COLLAPSE` and `convertRules`, always in the frozen copies of `scripts/oracle/`, never in `library/` (D19);
  - `library(name)` for the live `library/*.js`, for compat's tests only;
  - `arb` (`scripts/testing/arbitraries.js`);
  - `fuzz` (`SEED`, `LONG_RUN`, `runs`, `check` of `scripts/testing/fuzz-settings.js`);
  - `tableProbes()` (`test/fixtures/tables.json`);
  - `SHAPES`, `PUMPS` (`scripts/eval/lib/inputs.mjs`);
  - `NFC_RUNS`, the ten runs of marks that d170cd8 added to the 2.x growth shapes, with their ids, until the merge of `main` brings them into `SHAPES` (§6.2 item 4).
- **The oracle (W0, D19).** `scripts/oracle/` holds `storageOrder.js`, `typingFixes.js`, `zawgyi.js` and `win.js`, byte for byte as `library/` has them at the reference (checked: the blobs are identical), and `signatures.js`. W0 adds `syllable.js` and `contentGate.js`, also byte-for-byte copies of `library/` at the reference; neither requires another file. W0 updates the header of `scripts/oracle/index.js` to list them. `loadWithInternals(file, names, options)` in `scripts/testing/internals.js` gains `options.dir`, the directory to read the file from, which defaults to `library/`; its sibling requires resolve in that directory.
- **Fuzz counts (D23).** Every fuzz property in `test/next` passes two counts: `runs(prCount, nightlyCount)`, or `check(property, prCount, regressions, nightlyCount)`. `scripts/testing/fuzz-settings.js` (W0) returns `min(prCount × KNAYI_FUZZ_SCALE, nightlyCount)`. The second argument is optional there, so the 2.x tests are unchanged, but `test/next/helpers.mjs` requires it. `LONG_RUN` is true when `KNAYI_FUZZ_SCALE` is above 1; it switches on sets that are not counts, such as W4's exhaustive length-4 strings. At the default scale the `next` tests add at most about 30 s to `npm test`.

| Fuzz file | Property | PR | Nightly |
|---|---|---|---|
| `core-rules.fuzz.test.mjs` | `applyRuleRows` against 2.x, per table (`traceRuleRows` too, on the Unicode to Zawgyi rows) | 100k each | 1M each |
| | `runStages` traces against `oracle.storageOrder.toUnicode(x, font, true)`, Zawgyi and Win | 50k each | 300k each |
| `core-nfc.fuzz.test.mjs` | `toNfc` and `orderLongRuns` against `String#normalize`, on text with runs of marks | 20k | 400k |
| | `toNfc`, warm and cold memo, on Myanmar text and any UTF-16 units | 20k | 1M |
| `typingFixes.fuzz.test.mjs` | `fixTypos`, `fixLookAlikes`, `zeroAsWa`, targeted strings | 200k | 4M (PR 2.6 of the plan) |
| `segment.fuzz.test.mjs` | `breakParts`, `breakString`, the spec rows, and 2.x `syllBreak` and `spellingFix` with their preamble, both fonts | 200k | 1M, plus every corpus line |
| | `collapseRepeatedMarks`, both fonts | 300k | 1M |
| | `segmentSyllables`, `syllableBoundaries`: lossless under every policy, 2.x's breaks under `PAIRS` | 100k | 1M |
| `detect.fuzz.test.mjs` | `countEvidence` | 200k, plus every string of length ≤ 3 (120,100) | 2M, plus every string of length ≤ 4 (5,884,901) |
| | `decide` against `scoreWithRules`, and the rule path against `oracle.fontDetect` | 50k | 500k |
| | `countEvidence` and the rule path on every line of every cached corpus, raw and cleaned | all | all |
| `syllable.fuzz.test.mjs` | `orderSyllable` on records | 200k | 2M |
| `readers-unicode.fuzz.test.mjs` | `reorderUnicode` | 200k | 1M, plus 400k random strings |
| `normalize.fuzz.test.mjs` | `normalizeText`, both gate settings | 100k | 1M |
| `readers-font.fuzz.test.mjs` | `readFont`, Zawgyi and Win | 200k | 1M |
| `fontToUnicode.fuzz.test.mjs` | `fontToUnicode`, Zawgyi and Win | 100k each | 300k each |
| | `traceFontToUnicode` | 50k | 300k |
| `unicodeToZawgyi.fuzz.test.mjs` | `unicodeToZawgyi` | 200k | 1M |

- **The nightly leg (W0, D23).** A scheduled workflow runs the default branch's file on the default branch, so `next`'s own `fuzz.yml` never runs at night. W0 opens one CI-only PR to `main`, after W0 lands on `next`. It adds a `fuzz-next` job to `main`'s `.github/workflows/fuzz.yml`, with its own `timeout-minutes: 60`:
  - `actions/checkout` with `ref: next`;
  - the same seed step as the `fuzz` job;
  - `KNAYI_FUZZ_SCALE=100 npm run test:fuzz:next`, then `node --test "test/next/*.timing.mjs"`;
  - a failure artifact with `replay.txt`.

  Each fuzz file's nightly run must take at most 15 minutes on a CI runner, and the builder states its time in the PR.

### 6.2 What every module's tests do

1. **Unit tests** from this spec's rules, the examples in the module's test table, and the `example`s of its `spec/` rows.
2. **Differential tests** against the 2.x function the module replaces (table below), in the frozen oracle copies (D19). They use fast-check arbitraries and the regression strings of test/fuzz.test.js, which run first. Every output must be identical, error class included.
3. **Table probes:** one per row and per branch of a row (`test/fixtures/tables.json`), through the module's entry point and the oracle.
4. **Growth:** every adversarial shape in `SHAPES` and every single-character run in `PUMPS`, through the module's entry point, at n, 2n and 4n units. The growth exponent must be ≤ 1.3, by the screening and confirming method of test/growth.timing.js. W1 ported the NFC helper, so growth that comes from NFC has no exemption: `toNfc` is linear on long runs of non-starters. `core-nfc.timing.mjs` times the helper's ten run shapes (the runs d170cd8 added to the 2.x growth shapes) through `toNfc`. The other modules' checks time them through `SHAPES` once the merge of `main` brings them there (§8); until then they come from `NFC_RUNS` in `helpers.mjs`, which the `core-nfc`, `normalize` and `fonts` timing files run.
5. **Guards**, all green:
   - layers (§2.2);
   - tree-shaking (§2.4): the acorn rules, and the normalize-only metafile check of `scripts/next/size.mjs`;
   - pipelines: stage ids unique within each `*_STAGES` list (§2.3);
   - errors: every `throw` in `src/` throws `libraryError(...)`, except `legacyTypeError()` in `compat/legacy.js` (D13);
   - stateless core (§4);
   - floor (D14): acorn at ES2015, the regex floor (no lookbehind, named groups, `\p{}` or `s` flag in any regex, literal or built; a built regex is built from string literals, except in the one function the guard lists, `tableRow` of `rules/unicodeToZawgyi.js`, whose patterns `unicodeToZawgyi.test.mjs` reads instead, §3.9), and the ES2016+ built-in denylist below;
   - function size: every function in `src/` is at most 40 lines, except `reorderUnicode` and `readFont`, which may reach 70, and the table builders of §2.4, whose body is a single `return` of a literal or of `deepFreeze` of a literal;
   - atom lint: no `re` in a rule row and no `indexOf` needle is a pure literal starting at exactly U+1000-U+1010 (decision 29);
   - citations (as reviewed, §7.11): no comment in `src/` cites the refactor plan or its evidence folder, which are outside the repository; every plan decision and every kept 2.x quirk it names is a row of §1.3 or §10; and every 2.x line number names a file that `scripts/oracle/` keeps frozen at the reference;
   - no `NOT_BUILT` stub left, from the acceptance gate on.

**The ES2016+ denylist** (D14). The floor guard fails on any of these names in `src/`, as a global identifier or as a property name (`x.name` or `x['name']`). It does not know the receiver's type, so it also bans some ES2015 methods of the same name, such as `String#includes` and `Array#values`; use `indexOf` and a loop instead.
- Global names: `globalThis`, `BigInt`, `BigInt64Array`, `BigUint64Array`, `SharedArrayBuffer`, `Atomics`, `WeakRef`, `FinalizationRegistry`, `AggregateError`, `Iterator`, `Float16Array`.
- ES2016-ES2019 property names: `includes`, `values`, `entries`, `getOwnPropertyDescriptors`, `padStart`, `padEnd`, `finally`, `flat`, `flatMap`, `fromEntries`, `trimStart`, `trimEnd`, `trimLeft`, `trimRight`, `description`.
- ES2020-ES2022 property names: `matchAll`, `allSettled`, `replaceAll`, `any`, `at`, `hasOwn`, `cause`.
- ES2023 and later property names: `findLast`, `findLastIndex`, `toSorted`, `toReversed`, `toSpliced`, `with`, `fromAsync`, `groupBy`, `withResolvers`, `isWellFormed`, `toWellFormed`, `transfer`, `transferToFixedLength`, `resize`, `union`, `intersection`, `difference`, `symmetricDifference`, `isSubsetOf`, `isSupersetOf`, `isDisjointFrom`, `escape`, `try`, `f16round`.

Syntax after ES2015 (`**`, `async`, object spread, optional catch binding, `?.`, `??`, class fields, private names) is rejected by acorn itself.

The 2.x reference for each module. Every module but compat reaches it in `scripts/oracle/` (D19):

| Module | 2.x reference | Reached through |
|---|---|---|
| codes | `isMyanmarLetter`, `isUnicodeMark`, `isConsonant`, `isDigit`, `isOtherMyanmar`, `isTypedFirst`, `isSpace`, `isZeroWidth`, `RANK`/`rank` (storageOrder.js); `MARK`, `TONE`, `CONSONANT`, `WORD_CHAR`, `ANY_DIGIT` (typingFixes.js); `MYANMAR` (contentGate.js) | `internals` |
| core/rules | `replaceOnce`, `replaceRepeated`, `convertText` with debug (syllable.js); the `step()` logic of `toUnicode` | `internals`, `oracle.storageOrder` |
| typing-fixes | `lookAlikes`, `typos` (typingFixes.js); `zeroAsWa` (storageOrder.js) | `oracle.typingFixes`, `internals` |
| segment | `breakParts`, `joinParts`, `collapseMarks`, `BREAK_RULES`, `COLLAPSE` (syllable.js) | `internals` |
| detect | the 29 signatures and `scoreWithRules` | `oracle.signatures` |
| engine-unicode | `order`, `arrangeUnicode`; `normalize` | `internals`, `oracle` |
| engine-fonts | `font`, `arrange`, `glyphsInTypedOrder`, `toUnicode(x, font, true)`; `zawgyi.toUnicode`, `win.toUnicode`; the 2.x tables | `internals`, `oracle` |
| unicode-to-zawgyi | `convertRules`, `collapseMarks`, `convertText` | `internals` |
| compat | `main.js` at the reference, for byte identity; the live `library/`, for its unit tests | compare and the matrix; `library(name)` |

### 6.3 The acceptance gate

The core is done when all of the following pass on `next`, run on a quiet machine with every corpus in `.eval-cache/`, mC4 included:

```bash
# The 2.x reference (§1.1, D18): a commit, never a branch name.
REF=e5f6e24fa756f8f9c8d790f9a15ede85b135e8ae

# 1. Both suites: the 2.x tests, unchanged, and test/next. Node 22, 24 and 26, then Bun.
npm test
npm run test:bun

# 2. The nightly fuzz counts, once, by hand, with a new seed (D23).
KNAYI_FUZZ_SCALE=100 KNAYI_FUZZ_SEED=$RANDOM npm run test:fuzz:next

# 3. Byte identity: compat against the reference's main.js on every call form and input set.
npm run compare -- --base $REF --head mjs:src/compat/index.js
npm run compare -- --base $REF --head mjs:src/compat/index.js --fuzz 200000 --seed 7
bun scripts/eval/compare.mjs --base $REF --head mjs:src/compat/index.js

# 4. The contract matrix, with compat among matrix.BUILDS (§5.4), under Node and Bun.
node --test test/contract/api-matrix.test.js
bun scripts/bun-matrix.js

# 5. Speed and growth (§6.4). No Node row may be slower than the reference.
npm run perf -- --base $REF --head mjs:src/compat/index.js --rounds 5 --max-slowdown 0

# 6. Sizes and the tree-shaking check.
node scripts/next/size.mjs
```

Each numbered step must show:

1. **The suites** are green, with no `NOT_BUILT` stub left.
2. **The nightly counts** pass. The gate PR records the seed and the time each file took.
3. **compare** prints `OK: 0 differences`, with no `--expect` and no `--without`. It covers:
   - all 20 call forms of `scripts/eval/lib/callForms.mjs`, the four `debugging.*` forms included, and no form missing in the head;
   - every corpus set, mC4 included;
   - `generated.pairs`, `generated.extended`, `generated.rows`, `generated.win` and `generated.cp1252`;
   - `fuzz.block`, `fuzz.marks` and `fuzz.win`, at both seeds.
4. **The matrix** shows every cell (3,523 today) matching for `compat` on Node and Bun. Its only known build differences are the 10 cells of §5.4. The order-independence check also runs on compat. The adapter test of §5.4 pins the second difference.
5. **perf** passes its binding checks (D22):
   - no Node row above 1.00, over 5 rounds;
   - every growth exponent ≤ 1.3 under Node and Bun.

   A second run reads the one-string goals at the size of their evidence (§6.4): `npm run perf -- --base $REF --head mjs:src/compat/index.js --forms normalize,fontConvert.zawgyi-unicode --workloads string,document --long-units 2000000 --min-ms 50 --rounds 5 --growth none`.

   It also reports, without blocking:
   - each row against its goal in §6.4. The gate PR lists every goal missed, with its ratio;
   - any Node row above 0.95, explained;
   - the Bun rows, with any Bun row over 1.10 explained. A Bun row of one call (string, document) reads each copy's fastest round (as reviewed, §7.11): JavaScriptCore compiles the one-pass scanners in one of two ways depending on the calls before, round to round, and the median of three rounds read false slowdowns.
6. **The size report** shows compat and the normalize-only import within the targets of §6.4, and the tree-shaking check passes.

**CI for `next`.** `.github/workflows/test.yml` already runs on every pull request, whatever its base, but on pushes only to `main`.
- W0 adds `node scripts/next/size.mjs` to the `checks` job, so every PR into `next` reports the sizes and runs the tree-shaking check.
- W8 adds `next` to the push branches, and a `Compat` job. It checks out with `fetch-depth: 0`, so that the reference commit is present, and runs:
  - step 3 with `--base e5f6e24fa756f8f9c8d790f9a15ede85b135e8ae` (the full sha: CI has no local `safety-net` branch, only `origin/safety-net`), and with the corpus flags that the existing `Compare` job chooses: `--without mc4` with the corpus cache, `--offline` without it (CONTRIBUTING.md: mC4 stays out of CI);
  - step 4;
  - the growth check: `npm run perf -- --base . --head mjs:src/compat/index.js --offline`. It needs no corpus, measures growth only, and runs under Node and Bun. The existing `Perf` job measures only `main.js`, which `next` does not change, so without this step nothing in CI would time the new readers and scanners.

Phase 6 later points the `Compat` job at the last 2.x release instead of the reference.

### 6.4 Performance goals and size targets

Ratios are head/base time from `npm run perf` (`--base $REF --head mjs:src/compat/index.js`), in Node, on a quiet machine. Below 1 is faster, so ≤ 0.33 means "3x or faster".

**The one-string goals are read at the size of their evidence** (as reviewed, §7.11). The evidence for 0.29 on one string was timed on 2M-4.6M characters, while perf's string and document are 61,425 units, and a call costs relatively more on short text: through the same code, Zawgyi to Unicode read 0.39 of 2.x at 61,425 units, 0.33 at 250,000, 0.29 at 1,000,000 and 0.28 at 2,000,000, and normalize 0.23, 0.23, 0.21 and 0.20. So those two goals are read with `--long-units 2000000`, which repeats the lines up to that size (§6.3, step 5); the default run still reports the 61,425-unit rows.

**What binds and what does not (D22).**
- **Binding:** no Node row above 1.00, at the gate; every growth exponent ≤ 1.3 under Node and Bun, in every PR (the module timing files and CI's `Compat` job) and at the gate.
- **Goals**, reported: the ratios below, from §6 of the plan. A goal missed is listed in the PR with its ratio. It does not fail the gate.
- **Estimates never block.** A row marked "estimate" is composed from stage shares and was never measured end to end. The gate PR states the measured ratio and whether the estimate held.

The margin column is goal ÷ evidence − 1, the room the goal leaves over the prototype's ratio. perf's A/A noise is about ±2.5%, so a margin under 3% is inside the noise. The evidence also came from 32k corpus lines and from prototypes with their hot state in closure locals, while perf times 400 FLORES lines through this spec's structure (§3.6). Rows with a small margin are read over 5 rounds.

| perf form | Workload | Goal | Evidence | Margin |
|---|---|---|---|---|
| `normalize` | line | ≤ 0.33 | measured 3.06x with the simple gates (`SCR/planner/restraint.js`) | 1% |
| | word | ≤ 0.42 | measured 2.42x with the simple gates | 2% |
| | string, document | ≤ 0.29 at 2,000,000 units (`--long-units 2000000`; as reviewed) | measured 3.99x on 2M-4.6M characters | 16% |
| `fontConvert.zawgyi-unicode` | line | ≤ 0.40 | measured 2.57x, reader only (`SCR/judge-perfarch/zg-endstate.out`) | 3% |
| | word | ≤ 0.60 | measured 1.77x | 6% |
| | string, document | ≤ 0.29 at 2,000,000 units (`--long-units 2000000`; as reviewed) | measured 3.72x on 2M-4.6M characters | 8% |
| `fontConvert.detected-unicode` | line | ≤ 0.40 | estimate: detection was 33.8% of the call and gets 4x or more, conversion 2.5x | none (estimate) |
| `fontConvert.unicode-zawgyi` | line, word | ≤ 0.63 | Phase 1 target, composed from two measurements: atom wrap −36..−39%, collapse −4.6% | 3-8% |
| `fontConvert.win-unicode` | all | ≤ 1.00, reported | same engine as Zawgyi. The text is synthetic, so the goal is set after PR 0.9's Win set; claims are "Win identity only" (decision 26). | |
| `fontDetect`, `fontDetect.unicode` | line, word | ≤ 0.25 | measured 5.4x in isolation, 3-5x in mixed order (`SCR/api-verify`, P1) | −25% at 3x, 25% at 5x |
| `syllBreak.unicode` | line | ≤ 0.33 | measured 3.1-3.4x (`SCR/syllables-verify`) | 2-12% |
| `syllBreak.zawgyi` | line | ≤ 0.50 | measured 2.3x | 15% |
| `syllBreak.detected` | line | ≤ 0.33 | estimate (detection was 45.9% of the call) | none (estimate) |
| `spellingFix.unicode` | line | ≤ 0.77 | Phase 1 target | none |
| `spellingFix.zawgyi` | line | ≤ 0.33 | measured 3.4x (38.4 → 11.2 ms, PR 1.3) | 12% |
| `truncate.30` | line | ≤ 0.50, reported | estimate: the breaks get 3x and detection 4x, while the fit loop is unchanged | none (estimate) |
| `debugging.*` | all | reported | the trace path; no goal | |

Other targets:
- **Growth (binding):** every shape and pump ≤ 1.3 under Node and Bun. The old 2.10 quadratic paths stay linear: U+1000 followed by (U+200B U+102C) repeated 1M times must run in under 100 ms (PR 0.0 of the plan).
- **Memory (binding):** no scratch buffer above 65,536 units after a call. A test checks `unicodeReaderScratchUnits() + fontReaderScratchUnits()` after an 8.9M-character call.
- **GC share of normalize** under 10%. Informational: copy-through measured 9% (`SCR/verify-cleanup`, P2).
- **Bun:** reported, not gated, because the reader prototypes were timed only on Node (§8.2 of the plan). The break scanners should be faster than the base on Bun (measured 4.0-4.7x).
- **Size** (`scripts/next/size.mjs`, W0; esbuild IIFE at ES2015, minified, Node zlib level 9, as scripts/check-size.js measures). It runs in every PR from W0 on, so each builder sees the sizes from the first commit. The tree-shaking check (§2.4) binds in every PR. The byte targets bind at the gate:

  W1 ported the NFC helper, so the "After it" column binds.

  | Bundle | Before the NFC port (§8) | After it |
  |---|---|---|
  | compat | ≤ 10,854 B, the 2.x limit | ≤ 10,854 B, the helper included. 2.x's `min.js` with the helper is 10,422 B (d170cd8). |
  | normalize-only (`normalizeText`) | ≤ 4,300 B (infra-8 measured 4,268 B for the prototype) | ≤ 4,850 B. The helper added 543 B gzip to 2.x's `min.js` (1,212 B minified). |

  The report also lists each module's bytes from the metafile. Before this revision, the sizes left out two things: the prose of about 75 rule rows, now gone (D17), and the NFC helper, now counted above.

The techniques, in order of measured value (§6 of the plan):
1. No quadratic paths. Every run is read once, and the mask answers "has a vowel" in O(1).
2. No regex or `indexOf` needle that starts at U+1000-U+1010 (the V8 slow path; lint).
3. One char-code pass instead of N regex passes: the readers, the detector and the break scanners.
4. No per-syllable allocation: typed arrays, the mask, reused scratch. One small result object per call is fine.
5. Copy-through output.
6. Gates that provably cannot change the text, and no others: the two of decision 28, the rows of Unicode to Zawgyi that cannot match, and the font pipeline's final NFC (§3.10).
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

- **W0 lands alone and first.** It creates every file with its final exports and its complete import list (D12).
- **W1-W8 are built in parallel**, each on a branch from `next` after W0, named `next-<module>` (for example `next-engine-unicode`). Each opens a PR into `next`.
- **Merge order:** W1, W2, W3, W4, W5, W6, W7, W8. A module merges only after the modules it assumes. Its branch is rebased on `next` first, and its tests pass on the rebased branch.
- **Testing before a dependency lands.** A builder who needs an unmerged dependency merges that branch locally, and never commits the result.
- **No shared files.** Every `src/` file and every test file has one owner (D15). W0 creates the skeleton and the stub timing files; from then on each belongs to the builder that §7 names for its module, together with the module's `.fuzz.test.mjs` and `.timing.mjs` files. The signatures are fixed, so W0's skeleton already holds each file's whole import block, and no builder edits another's imports. A builder who needs an import the skeleton lacks changes this spec first (below), and the file's owner adds it.
- **Changes to this spec.** A builder who must depart from it updates this file in the same PR and says why.
- **As integrated.** W1-W7 were merged into `next` in the order above, after W0 (`next-codes`, which every module branch started from), each with a merge commit `merge(next): <module>`. The branches were merged as built, not rebased: each touched only the files it owns and its own section here, so the only conflicts were in this file, where W3 and W4 had each extended §1.1, the §2.1 tree and the §6.1 fuzz table. Both extensions are kept. The integration then:
  - removed the skips that let a module's tests run while a module it calls was still a stub (`skipUntilBuilt`). Only compat was a stub on `next` then, so the tests of the built modules bind, and `guards/notBuilt.test.mjs` counted compat's 24 stubs; W8 built them (§7.10, as built);
  - dropped W5's TODO probe of normalize on the run of dot below and virama, which reads linear with W1's helper (§7.7, as built), and moved the ten NFC runs that `core-nfc.timing.mjs` and `fonts.timing.mjs` each wrote out into `helpers.mjs` (`NFC_RUNS`). `normalize.timing.mjs` runs them too, through `reorderUnicode` and `normalizeText`, with no exemption (§6.2 item 4);
  - moved `scripts/next/size.mjs` to the "after it" column of §6.4, since the port is in. The normalize-only bundle is 6,357 B gzip, 1,507 B over 4,850 B, for the reason W5 gives (§7.7, as built). The target needs the maintainer's decision before the gate;
  - made `FONT_STAGES` hold the typing-fix and NFC functions themselves, as `NORMALIZE_STAGES` does. One of the four wrappers it had, `fixLookAlikeLetters`, shared its name with the step of §3.4;
  - made `guards/layers.test.mjs` read the tree of §2.1, so that a file's layer there and in the guard must agree, and check that both readers import `engine/syllable.js` (§2.2).

### 7.2 W0: codes

- **Owns:**
  - `src/package.json`, `src/version.js`, `src/freeze.js`, `src/script/codes.js`, `src/core/errors.js`;
  - the skeleton: every other `src/` file of §2.1, with its complete import list. Each function has its final signature and throws `libraryError(ERR.NOT_BUILT, '<file> <name> is not built yet')`. Data exports are frozen empty values of the right type, made by `/* @__PURE__ */ deepFreeze(...)`, and each class's constructor throws the same error. `FONT_READING`, `UNICODE_READING`, `SEEN` and `ASAT_PLACE` are complete, since this spec defines them.
  - `test/next/helpers.mjs`, `test/next/codes.test.mjs`, `test/next/unicode.test.mjs`, all of `test/next/guards/` (layers, tree-shaking, pipelines, errors, stateless, floor, function size, atom lint), and the stub timing files of §6.1;
  - the npm scripts of §6.1: the `test` globs, `test:fuzz`, `test:fuzz:next` and `test:bun`;
  - `scripts/next/size.mjs`, and its step in the `checks` job of `.github/workflows/test.yml` (§6.3);
  - the two-count `runs` and `check`, and `LONG_RUN`, in `scripts/testing/fuzz-settings.js`; the `dir` option of `loadWithInternals`; `scripts/oracle/syllable.js` and `scripts/oracle/contentGate.js` (§6.1);
  - the CI-only PR to `main` that adds the `fuzz-next` job (§6.1, D23), opened after W0 merges into `next`.
- **May assume:** nothing.
- **Done:**
  - Every predicate and class in `codes.js` agrees with its 2.x definition (§6.2 table) on all 65,536 BMP code units.
  - `MARK_RANK` equals 2.x `rank()` on every code, the named ranks are 3, 4, 5, 6, 8 and 12, and each mask literal equals its union of `markBit`.
  - `isNfcSafe` passes the nfc-safe check on the runtime.
  - The Unicode test passes with the KNOWN table of §2.3 on Node 22, 24 and 26, and fails if a KNOWN entry becomes classified.
  - `PACKAGE_VERSION` equals package.json.
  - The guards are green on the skeleton. The function-size and atom lints run on real code only.
  - `scripts/next/size.mjs` reports compat and the normalize-only bundle, and its tree-shaking check passes on the skeleton.
  - The oracle copies are byte-identical to `library/` at the reference. A test hashes each copy as git hashes a blob and compares it with the blob id recorded from `git rev-parse e5f6e24:library/<file>`, so it needs no git history in CI.
  - `npm test` and `npm run test:bun` are green.
- **As built**, where the build settles what this section leaves open:
  - `AT_ACCEPTANCE_GATE` in `test/next/helpers.mjs` is false, and the gate PR sets it to true. Until then the stub guard (`guards/notBuilt.test.mjs`) and the planned-files check of `guards/layers.test.mjs` skip, and the stub guard says how many stubs are left.
  - A stub's import list is what its builder is expected to need, plus `ERR` and `libraryError` for the stubs. The builder drops what the module does not use.
  - `REPEAT_LIMIT` (40) and `ON_TIE_ASSUME_ZAWGYI` (`'zawgyi'`) are complete in the skeleton too, since this spec gives their values.
  - `spec/` files import nothing (§2.2), so their rows are plain literals, not frozen. Nothing ships them.
  - Each stub timing file skips while its module throws `NOT_BUILT`, and fails once the module is built, until its owner writes the growth check.
  - The atom lint reads every regex of the shipped code (`src/` outside `spec/`), not only rule rows, and every `indexOf` needle.
  - `guards/treeShaking.test.mjs` also runs the normalize-only metafile check of `scripts/next/size.mjs`, so `npm test` covers it. `node scripts/next/size.mjs --gate` makes the byte targets binding.
  - The KNOWN table of §2.3 had Extended-A and -B the wrong way round. Extended-A is U+AA60-U+AA7F and Extended-B U+A9E0-U+A9FF; the table is corrected.

### 7.3 W1: core (options, input, rules, nfc, traces)

- **Owns:** `src/core/options.js`, `input.js`, `rules.js`, `nfc.js`; `test/next/core-*.test.mjs`.
- **May assume:** W0.
- **Done:**
  - `DEFAULTS` equals the 2.x defaults (globalOptions.js:1-7, truncate.js:9-10, syllable.js:273).
  - `FONT_ALIASES` equals contentGate.js's own keys and values.
  - `hasMyanmarBlockChar` agrees with `contentGate.hasMyanmar` (the oracle copy) on strings.
  - `applyRuleRows` agrees with 2.x's per-row `replace` and `replaceRepeated` on every 2.x table: `convertRules`, the Zawgyi and Win sequences, the typos. 100k fuzz (1M nightly) plus the table probes.
  - `traceRuleRows` over rows made from `convertRules` reproduces `convertText(…, true)`, mapped by §3.9, with `ruleLabel` giving the 2.x labels.
  - **`runStages` with a trace reproduces `oracle.storageOrder.toUnicode(x, font, true)`** (matched_patterns and steps) on 50k Zawgyi and Win fuzz strings (300k nightly). It runs a stage list built from the oracle's own stage functions, which proves the runner and the trace rule independently of the new engine.
  - The gates are skipped only when no trace is given and `openAllGates` is false.
  - `toNfc` agrees with `normalize('NFC')`, in linear time: W1 ports the 2.x helper (below).
  - `requireText` throws with its code.
- **As built**, where the build settles what this section leaves open:
  - **The NFC helper is ported here**, not in a §8 port PR: the core work item asked for `toNfc` in linear time. `core/nfc.js` is the 2.x helper (d170cd8) with the memo of D20, in named steps (`orderLongRuns`, `isRunCharacterAt`, `decomposeRunCharacter`, `findOrInsertClass`, `canonicalOrder`). It also exports `orderLongRuns`, the 2.x `nfc.reorder`, for the exhaustive tests. `toNfcWith` sends a text of 30 units or fewer to `String#normalize` at once, which saves a call per word.
  - **The NFC tests** follow the 2.x helper's test, with a cold memo per test (`core-nfc.test.mjs`): every code point the runtime knows, classified with the test's own probe marks (U+0334 and U+0345; 971 run characters and 989 letters with marks on Node 26.5); every ordered pair of run characters (942,841); every letter with marks next to a long run; long runs in seven scripts; the 30-unit boundary; lone surrogates; the bounded memo; and no call of `normalize` in `src/` outside `core/nfc.js`. `core-nfc.fuzz.test.mjs` adds random text and text with long runs, and `core-nfc.timing.mjs` the growth check. 11 of 13 mutants of the helper fail the unit tests; the other two cannot change an output on this runtime (a guard that the run start never passes `done`, and the branch for run characters above U+1FFFF, of which Unicode 17 has none).
  - **`core/errors.js` stays W0's.** Its four codes are pinned by `codes.test.mjs`. `ERR_KNAYI_INVALID_FONT`, the code of decision 11's font-name policy (PR 4.3 on the 2.x line), arrives with that port (§8), with the compat change that throws it.
  - **The 2.x preamble stays in compat** (D1): `INPUT_POLICY`, `enter` and `chooseFontLegacy(name, text, detect)`, which takes the detector as an argument, are W8's (`compat/input.js`). `core/input.js` holds `FONTS` and builds `FONT_ALIASES` from the fonts' `aliases`, so each alias is written once.
  - **The 2.x tables as rows** for the tests are built in `test/next/core-rules.tables.mjs` from `scripts/oracle/`, each row with a copy of its regex: 2.x's `ruleMatches` leaves a matched regex's `lastIndex` past the match. The Zawgyi and Win sequences are checked against the `'sequences'` step of 2.x's own debug log.
  - **Speed**, interleaved in one process against the 2.x code each function replaces, on perf's 400 FLORES lines (ratio = core / 2.x, median of 5 rounds; Node 26.5, then Bun 1.4.2 over 3 rounds):
    - `applyRuleRows` over the Unicode to Zawgyi rows against `convertText`: 0.99, 0.99, 1.00, 1.00 (line, word, string, document); Bun 0.97-1.00.
    - `runStages` over 2.x's own font stages against 2.x `toUnicode` (Zawgyi): 0.98-1.00 with native NFC and 0.99-1.01 with `toNfc`; with a trace against `toUnicode(x, font, true)`: 0.99-1.03. Bun 0.95-1.04. The runner costs nothing measurable on these rows; W5 still measures it on its own slice (D10).
    - `toNfc` against the 2.x helper: 0.98-1.01 (Bun 0.97-1.01). Against the bare `String#normalize` of the reference: 1.02 per word, 1.08 per line and 1.13-1.14 on one string or document (Bun 1.01-1.06): the price of one probe every 31 units. It does not show in the font pipeline above (0.99-1.01).
    - `hasMyanmarBlockChar` against 2.x `hasMyanmar`: 0.95-1.05, depending on the call site's state; `stripZeroWidthBreaks(text.trim())` against `cleanText(text, true)`: 0.95-1.03 (Node and Bun).
  - **Sizes**, each bundled alone (esbuild IIFE, ES2015, minified, gzip level 9): `toNfc` 1,630 B minified (837 B gzip; the 2.x helper is 1,212 B minified); `core/rules.js` 1,313 B (650 B); `core/input.js` 1,564 B (807 B); `core/options.js` 692 B (445 B). What a normalize-only bundle takes from the core (`toNfc`, `runStages`, the trace helpers, `hasMyanmarScriptChar`, `NO_OPTIONS`) is 2,573 B minified, 1,241 B gzip.
  - **Fuzz times** at the nightly counts, once (`KNAYI_FUZZ_SCALE=100 KNAYI_FUZZ_SEED=4711`, Node 26.5, this machine): `core-rules.fuzz.test.mjs` 41 s, `core-nfc.fuzz.test.mjs` 40 s.

### 7.4 W2: typing-fixes

- **Owns:** `src/rules/typingFixes.js`, `src/spec/typoRows.js`, `test/next/typingFixes.test.mjs`.
- **May assume:** W0.
- **Done:**
  - The spec rows equal the 2.x `TYPOS` table (typingFixes.js:12-17): sources, flags and replacements. Each row has its `why`, `source` and `example`, and `fixTypos` cites the row ids in its comments.
  - `fixTypos`, `fixLookAlikes` and `zeroAsWa` agree with `oracle.typingFixes.typos`, `oracle.typingFixes.lookAlikes` and 2.x `zeroAsWa`. The fuzz is 200k targeted strings over digits, wa, ra, zero, seven, separators, signs, marks, tones and the Shan and Tai Laing digits; nightly it is 4M (PR 2.6 of the plan).
  - Issue #43's Shan cases pass.
  - `isInNumber` is unit-tested for both contexts.
  - Every regex is ES2015.
  - Growth ≤ 1.3 for each function.
- Two orders are kept on purpose:
  - **the two typing-fix orders.** `NORMALIZE_STAGES` runs typos then look-alikes, and `FONT_STAGES` runs look-alikes then typos. The stage lists own this order; the module only provides the functions.
  - **the two zero-in-a-number rules** (§2.3).
- **As built**, where the build settles what this section leaves open:
  - The typo row ids are `typo.ii`, `typo.uu`, `typo.au` and `typo.lagaung`. Each string of a spec row is one literal, because the tree-shaking guard reads `spec/` too (§2.4 rule 2).
  - `fixTypos` runs the one alternation in an exec loop with copy-through, not `String#replace` with a function. The scan is the same; replace's cost per call was most of the time on short text (on FLORES words, the exec loop took 0.51 of replace's time).
  - `fixLookAlikes` returns its input after one scan when the text has no Burmese digit: the first pass reads only zero and seven, and the second only numbers, which hold a digit. It reads nothing from the reader, so it is not one of the gates that §3.10 and decision 28 leave out. The fuzz checks it against the two passes. On FLORES words it took 0.60 of the two passes' time.
  - Each exec loop sets its regex's `lastIndex` to 0 first and runs until `exec` returns null, which leaves `lastIndex` at 0 (§4 rule 1). The regexes are private to the module.
  - `NUMBER_CONTEXT` holds the codes.js predicates `isBurmeseDigit` and `isScriptDigit`, and two local ones, `isArithmeticSign` and `isNoSign`.
  - The nightly count of `typingFixes.fuzz.test.mjs` is reached at `KNAYI_FUZZ_SCALE=20`. `typingFixes.timing.mjs` runs `SHAPES`, `PUMPS` and 23 shapes of its own through `fixTypos`, `fixLookAlikes` and `zeroAsWa`.

### 7.5 W3: segment

- **Owns:** `src/rules/segment.js`, `src/spec/breakRules.js`, `test/next/segment.test.mjs`.
- **May assume:** W0.
- **Done:**
  - The spec rows equal `BREAK_RULES` of `scripts/oracle/syllable.js` (the reference's `library/syllable.js`): sources, flags, replacements and the switch. Each row has its `why`, `source` and `example`.
  - `breakParts` and `breakString` agree with 2.x `breakParts` and `joinParts(breakParts(…), sep)` for both fonts. The inputs are cleaned fuzz, with U+200B and U+200C removed: 200k on a PR, 1M nightly. The same inputs are also checked against the spec rows run by the 2.x algorithm.
  - `collapseRepeatedMarks` agrees with 2.x `collapseMarks` for both fonts on 300k strings (1M nightly).
  - `forEachBreak` stops when `onBreak` returns false.
  - Each join reason is a named predicate citing its row. The pairwise rule is `legacyBareConsonantPair`, and the S'gaw Karen switch is `looksLikeSgawKaren` (PRs 3.3-3.4).
  - Growth ≤ 1.3.
  - Start from `SCR/syllables-verify/proto/library/scan.js`.
- **As built**, where the build settles what this section leaves open:
  - W3 also owns `test/next/segment.fuzz.test.mjs`, `segment.timing.mjs` and `segmentOracle.mjs`, the 2.x side the three share: the frozen break and collapse code, and 2.x `syllBreak` and `spellingFix` composed from it with the reference's preamble.
  - **The lossless core of 3.0 segmentation is built** (decision 34): `segmentSyllables` and `syllableBoundaries` (§2.3) run the scanners on the text as given, decide on row U1's order without writing it, and slice the text, so the pieces join to it. `BARE_CONSONANTS` names the three policies the decision weighs, and `forEachBreak` takes one as an optional fourth argument. Nothing in compat changes: 2.x's `PAIRS` is the default everywhere.
  - Decision 34's counts, for choosing the 3.0 default: lines whose pieces change from `PAIRS`, of the distinct lines with a Myanmar-block character.

    | Corpus (read as) | Lines | `CHAINS` | `SEPARATE` | Pieces: `PAIRS` / `CHAINS` / `SEPARATE` |
    |---|---|---|---|---|
    | FLORES-200 (Unicode) | 2,009 | 377 (18.8%) | 1,985 (98.8%) | 65,805 / 65,368 / 77,128 |
    | Wikipedia v2 (Unicode) | 4,812 | 1,013 (21.1%) | 3,801 (79.0%) | 120,363 / 118,517 / 142,962 |
    | Okell (Unicode) | 16,924 | 3,885 (23.0%) | 14,156 (83.6%) | 588,013 / 581,621 / 700,205 |
    | mC4, raw (Zawgyi) | 14,304 | 4,963 (34.7%) | 12,750 (89.1%) | 618,033 / 602,322 / 750,691 |
    | Shan GlotCC (Unicode) | 9,923 | 94 (0.9%) | 1,426 (14.4%) | 186,348 / 186,219 / 188,791 |
    | Mon GlotCC (Unicode) | 2,270 | 834 (36.7%) | 2,024 (89.2%) | 76,094 / 74,334 / 95,757 |

    `SEPARATE` moves most lines because a bare consonant before another syllable is common (အ|မျိုး); it is the only policy whose pieces are the syllables of UTN #11.
  - **Row U4 never decides a break.** Its text starts with nga and asat, which row U5's first branch already keeps with the syllable before. The scanner has no predicate for it, and `segment.test.mjs` checks that the rows give the same breaks without it.
  - **Row Z8 is decided left to right**, with no consumed span. Its first branch takes a base typed after e or a medial ra whole, and row Z3 never leaves a break between those glyphs and their base, so a consonant right after e or a medial ra is never bare. Under `PAIRS`, the consonant the last join took is not bare either (`legacyBareConsonantPair`, as row U7). A run of e and medial ra with no break inside is at most four glyphs: e and a medial ra, twice, when row Z6 deleted the break between the pairs.
  - The classes of the rows stay local predicates named after them (§3.1): `startsUnicodeSyllable` (U2), `startsZawgyiSyllable` (Z1), `isZawgyiBreakBase` (Z3-Z5, Z8), `isOpeningCharacter` (U3, Z4) and `isWhiteSpace` (U6, Z7). `segment.test.mjs` checks every class on all 65,536 units, in the positions the rows read it.
  - `spec/breakRules.js` writes each `why` and `source` as one string literal: the tree-shaking guard reads every file of `src/`, `spec/` included, and `'a' + 'b'` is an operator (§2.4 rule 3).
  - `collapseRepeatedMarks` is one char-code pass with copy-through. 2.x ran one regex per mark (17 for Unicode, 67 for Zawgyi); collapsing a run never makes a run of another mark, so one pass gives the same text.
  - The growth check screens each shape and pump with a quick n-to-4n reading and measures a high one in full with `growthExponent` (scripts/eval/lib/timing.mjs), up to twice; it fails only when every reading is above 1.3. It runs in about 6 s under Node and 5 s under Bun, and it fails a scanner made quadratic (a whole-text scan per letter) with exponents of about 2.0.
  - The fuzz file takes about 6 s at the pull-request counts, and 34 s at the nightly scale (`KNAYI_FUZZ_SCALE=100`, seed 4242): 1M strings per property, then 64,986 corpus lines in 12 sets, with 0 differences.
  - Speed, interleaved in one process on perf's 400 FLORES lines (Zawgyi made by the reference converter), as core time ÷ 2.x time. The public forms run 2.x's preamble around the core function; the function forms compare the functions alone, on cleaned text.

    | Form | Node 26.5: line / word / string / document | Bun 1.4.2: line / word / string / document |
    |---|---|---|
    | `syllBreak.unicode` | 0.27 / 0.20 / 0.38 / 0.38 | 0.25 / 0.27 / 0.31 / 0.30 |
    | `syllBreak.zawgyi` | 0.28 / 0.20 / 0.42 / 0.42 | 0.32 / 0.28 / 0.38 / 0.38 |
    | `spellingFix.unicode` | 0.24 / 0.13 / 0.43 / 0.43 | 0.20 / 0.14 / 0.23 / 0.24 |
    | `spellingFix.zawgyi` | 0.08 / 0.04 / 0.15 / 0.15 | 0.07 / 0.04 / 0.09 / 0.09 |
    | `breakParts` + `joinParts`, Unicode | 0.30 / 0.18 / 0.38 / 0.38 | 0.29 / 0.24 / 0.30 / 0.29 |
    | `breakParts` + `joinParts`, Zawgyi | 0.29 / 0.18 / 0.33 / 0.33 | 0.32 / 0.26 / 0.37 / 0.36 |
    | `collapseMarks`, Unicode | 0.19 / 0.07 / 0.29 / 0.29 | 0.14 / 0.10 / 0.15 / 0.15 |
    | `collapseMarks`, Zawgyi | 0.06 / 0.02 / 0.10 / 0.10 | 0.05 / 0.03 / 0.08 / 0.08 |

    The goals of §6.4 for these rows hold on lines: `syllBreak.unicode` ≤ 0.33, `syllBreak.zawgyi` ≤ 0.50, `spellingFix.unicode` ≤ 0.77 and `spellingFix.zawgyi` ≤ 0.33. The binding check is the gate's perf run.

### 7.6 W4: detect

- **Owns:** `src/rules/detect.js`, `src/spec/detectorSignatures.js`, `test/next/detect.test.mjs`.
- **May assume:** W0, W1 (`DEFAULTS`, `NO_OPTIONS`, `optionsObject`, `hasMyanmarBlockChar`).
- **Done:**
  - The spec rows equal `scripts/oracle/signatures.js`, in source and side. Each row has its `why`, `source` and `example`.
  - `detectEncoding` is `'none'` exactly where 2.x `fontDetect` returns before counting, `'unknown'` on a tie, and the side of `decide` otherwise, with both counts.
  - `countEvidence` equals the per-side sums of `String#match` counts, including the non-overlapping count of U+1031 U+1031 (row Z15) and the `^` and `$` anchors:
    - exhaustively over every string of length ≤ 3 on a boundary alphabet: every unit named in a signature, both edges of each range, the five detector whitespace units, U+000B (which is not one of them) and `a`;
    - length ≤ 4 nightly, when `LONG_RUN` is true (5,884,901 strings, `SCR/api-verify` P1);
    - 200k fuzz (2M nightly).
  - `decide` agrees with `scoreWithRules`.
  - `scoreByZawgyiModel` handles its boundaries: `<`, `>` and equal (the fallback).
  - `detectFont` honours its per-call options (the two-configuration test).
  - Growth ≤ 1.3.
  - Start from `SCR/api-verify/v-scorer/library/detector.js`, which returns a difference. `countEvidence` returns both counts, as Phase 5's `detectEncoding` needs.
- **As built**, where the build settles what this section leaves open or departs from it:
  - **`detectEncoding(text)` is a core export** (§2.3), which the spec had left to the 3.0 API. The work order for W4 asked for it, and the result is the core's concern: `'none'` must be 2.x's block gate and `'unknown'` the tie, so that 2.x `fontDetect` is its `encoding` with the fallback in their place, and 3.0's public function only checks, cleans and injects. It reads W1's `hasMyanmarBlockChar`. compat does not use it, so no bundle carries it yet.
  - **The scan has one step per kind of unit**: `matchesAtConsonant`, `matchesAtOtherUnit` (one switch over the literal rows of both sides) and `matchesBeforeConsonant` (Z08, Z14), with Z03 and Z15 in the loop and the anchored rows before it. A step returns both sides in one number (`ONE_UNICODE` = 1, `ONE_ZAWGYI` = 0x100); a position starts at most one Unicode and two Zawgyi matches. Past the end the window holds `END` (-1), not charCodeAt's NaN, which would make the window doubles. Interleaved in one process on Node 26.5 (400 cleaned FLORES lines, the same lines in Zawgyi, and 400 mC4 lines; the median of 41 rounds):
    - the prototype's single 45-line loop (`SCR/api/scorer.js` `scoreDiff`) is 5-19% faster than these steps, which keep every function under 40 lines;
    - separate Unicode and Zawgyi steps, each with its own switch, were 36-47% slower than the prototype, and were dropped;
    - against 2.x `scoreWithRules` on the same cleaned text, `decide(countEvidence(text))` takes 0.15-0.19 of the time per line (5.4-6.6x faster), 0.07-0.08 per word and 0.21-0.25 on one long string. With the 2.x gate and cleaning in front, as compat's `fontDetect` will have them, the ratios are 0.17-0.21 per line, 0.10 per word and 0.24-0.26 on one string;
    - Node 24.12: 0.16-0.21 per line, 0.10 per word and 0.20-0.24 on one string, and 0.17-0.22, 0.12-0.13 and 0.23-0.25 with the gate and cleaning;
    - Bun 1.4.2, where 2.x's regexes are about twice as fast as on Node: faster than 2.x on every row, by 1.35-2.3x on one long string, 1.65-1.7x on mC4 lines and 2.9-4.1x on the other rows.
  - **The boundary alphabet has 49 units** (`SCR/api-verify/scanner-fuzz.js`): the units the rows name, the ends of each range with the units just outside them, the whitespace class with U+000B, U+0000, `a`, U+00A0 and a lone surrogate. Every string of up to 3 units is 120,100 strings, and of up to 4 units 5,884,901.
  - **`detect.fuzz.test.mjs` also reads the corpora.** Every line of every corpus in `.eval-cache`, raw and cleaned, against the 2.x regexes, and the rule path against `oracle.fontDetect`: 259,944 calls on a full cache, 0 differences, 3 s. It reads only corpora whose cached files match their pins, so it never downloads, and it skips in CI's test job, which has no cache. The nightly counts of the whole file took 22.5 s on Node 26.5.
  - **`spec/detectorSignatures.js` returns its rows from a function**, `/* @__PURE__ */ detectorSignatures()`: the guard of §2.4 rule 2 reads `spec/` too, and the rows' prose is joined with `+` over several lines.
  - **The 2.x behaviour kept, as found:** U11's consonant and U+103C also matches Zawgyi's consonant with medial wa, and Z06 also matches Unicode text that types the vowel u for nya before a stack. Each row's `why` says so where it applies.

### 7.7 W5: engine-unicode

- **Owns:**
  - `src/engine/syllable.js`, all of it: `SyllableBuffer`, `orderSyllable` and its steps, `CodeBuffer`, `CopyThroughWriter`, `isHeld`, `marksGoOn` (D9);
  - `src/engine/unicodeReader.js` (`UNICODE_READING`, `SEEN`, `reorderUnicode`, its helpers and scratch, `unicodeReaderScratchUnits`);
  - `src/stages/normalize.js` (`NORMALIZE_STAGES`, `normalizeText`, `traceNormalizeText`);
  - `test/next/syllable.test.mjs`, `readers-unicode.test.mjs`, `normalize.test.mjs`, `normalize.timing.mjs`.
- **May assume:** W0, W1 (`runStages`, traces, `toNfc`, `NO_OPTIONS`, `hasMyanmarScriptChar`), W2 (`fixTypos`, `fixLookAlikes`).
- **First, measure the structure (D10, D22).** Before building on `SyllableBuffer`, the module helpers and `runStages`, time a thin end-to-end slice against `oracle.normalize` on perf's word and line workloads, interleaved, on a quiet machine. The slice is `normalizeText` through `runStages`, with the reader written in this spec's structure. Time the same slice with the stages called directly. Post both ratios in the PR.
  - If the runner costs more than 2% on the word workload, `normalizeText` calls the stages directly, as §3.10 describes.
  - If the slice misses the §6.4 goals by more than the noise, the PR says by how much and updates those goals in §6.4 from this measurement.
- **Done:**
  - `orderSyllable`, through an adapter from 2.x syllable records, agrees with 2.x `order()` on 200k fast-check records (2M nightly). The records cover kinzi or none; one-unit, ligature and whole bases; stacks; 0-12 marks with repeats; and `keepU`. They include the `placeAsat` cases of §3.4: a stacked syllable with aa and asat, and dot below with i and no aa.
  - `reorderUnicode(x).text` agrees with `oracle.storageOrder.arrangeUnicode(x)`: 200k fast-check strings plus the test/fuzz.test.js regressions on a PR; 1M plus 400k random strings nightly (`SCR/performance/cls-check.js` method).
  - `normalizeText` agrees with `oracle.normalize`, both with the default gates and with `openAllGates`: 100k on a PR, 1M nightly.
  - When the final-NFC gate stays closed, `toNfc(result) === result`.
  - `traceNormalizeText` gives the same result, and the stage-by-stage texts of the oracle.
  - The ARCHITECTURE.md examples of the Unicode reader's side of the four differences pass.
  - `unicodeReaderScratchUnits()` is ≤ the initial sizes after an 8.9M-char call.
  - Growth ≤ 1.3 on every shape and pump.
  - Function sizes are within the limits.
  - The PR quotes an interleaved ratio against `oracle.normalize` from a run on a quiet machine. The binding speed check is the gate's perf run.
- **As built**, where the build settles what this section leaves open:
  - **The structure, measured first (D10).** The workloads were perf's word and line sets (the first 400 FLORES lines), timed interleaved in one process on Node 26.5, 9 rounds of 7 runs, with local stand-ins for W1's `runStages` and W2's typing fixes. `runStages` cost 4.6% per word and 1.8% per line against the same stage functions called in list order. With W1 and W2 merged locally (`next-core` 481916f, `next-typing-fixes` 96f13f0; the merge is not committed), W1's `runStages` cost 6.0% per word and 1.7% per line. So `normalizeText` calls the stages directly (§3.10), and `traceNormalizeText` keeps `runStages`. `normalize.fuzz.test.mjs` checks on every fuzz string that `normalizeText` equals `runStages` over `NORMALIZE_STAGES`, with both gate settings.
  - **Speed**, head/base against the frozen 2.x functions, interleaved in one process, Node 26.5, 7 rounds of 7 runs:

    | | line | word | string | document |
    |---|---|---|---|---|
    | `reorderUnicode` / `arrangeUnicode` | 0.28-0.31 | 0.30 | 0.28-0.31 | 0.31 |
    | `normalizeText` / `oracle.normalize`, with the 2.x typing fixes standing in for W2 | 0.35 | 0.43 | 0.31 | 0.31 |
    | the same, with the plan's typing-fix prototype (`SCR/cleanup/lib/typingFixes-fast.js`) as an estimate of W2 | 0.31 | 0.31 | 0.30 | 0.30 |
    | `normalizeText` / `oracle.normalize`, with W1 and W2 merged locally | 0.33 | 0.30 | 0.29 | 0.30 |

    The reader prototype (`SCR/performance/fused-arrange.js`) read 0.24-0.28 in the same runs; the buffer objects of §3.3 cost the difference. With W1 and W2, the goals of §6.4 hold for word and string, and line and document sit 0-3% above theirs (0.33 and 0.29), inside perf's noise, so the goals stand until the gate's perf run. Bun 1.4.2, same runs: the reader 0.23-0.33, `normalizeText` 0.28-0.35 with the 2.x typing fixes.
  - **Size.** The normalize-only bundle is 4,640 B gzip with W1 and W2 still stubs, 340 B over the 4,300 B target. With W1 (and its NFC port) and W2 merged locally it is 6,367 B, 1,517 B over the 4,850 B that §6.4 sets after the port. Of its 17,783 minified bytes, `engine/syllable.js` has 6,465 B, `engine/unicodeReader.js` 2,626 B and `stages/normalize.js` 298 B, mostly the field and method names of §3.3 and §3.7, which minifying keeps. The 4,268 B behind the target was the 2.x `library/normalization.js` deep import (infra-8), not a build of this engine. The target needs the maintainer's decision before the gate.
  - **The reader's dispatch.** `reorderUnicode` switches on `classOf` first. The classes are disjoint, so the step order of §3.6 holds: only a unit outside the Burmese classes can be held, and only a consonant can start a kinzi. `seen` is noted where those units are read: U+1025 in the base step, and units outside the block in the step for held and other units.
  - **One shortcut.** A bare base, or a kinzi and its base, with nothing held after it skips `orderSyllable` and the comparison, because its source is exactly what would be written. The review widened it to every syllable that `writesAsTyped` (§3.4, as typed; §7.11).
  - **More members, for W6.** `SyllableBuffer` also has `emptySyllable()`, `replaceBase(code)`, `indexOfMark(code)`, `removeMark(code)` (of a mark it holds) and `capacity()`, the units of all its arrays. `CodeBuffer` also has `makeRoom(units)` and `capacity()`, and keeps its first capacity in `firstCapacity`. `closeSyllable` does nothing when no syllable is open, as 2.x `close()` does. `orderSyllable` skips `rankMarks` and `sortByRank` for fewer than two marks.
  - **Imports.** `stages/normalize.js` also imports `optionsObject` from `core/options.js`, so `engineOptions` is map-safe (§4 rule 3).
  - **Tests.** `readers-unicode.fuzz.test.mjs` and `normalize.fuzz.test.mjs` also check every line of the cached corpora (64,989 lines; the reader also on their NFC) when the corpus cache is complete. They never download it, so in CI they skip. The nightly counts took 11.4 s (`syllable.fuzz`, 2M records), 4.4 s (`readers-unicode.fuzz`, 1M strings and 400k random strings) and 11 s (`normalize.fuzz`, 1M strings) on the build machine. The normalize tests skipped while W1 and W2 were stubs; on `next` they bind (§7.1, as integrated).
  - **Growth.** `normalize.timing.mjs` checks `reorderUnicode` and `normalizeText` on every shape and pump, and ka followed by a million pairs of zero-width space and aa (28 ms; the limit is 100 ms). Ka followed by pairs of dot below and virama is a TODO probe, as in test/growth.timing.js, because NFC itself is quadratic there until the port (§8). `reorderUnicode` alone must be linear on it. With W1's port merged locally the probe reads linear, so the integration dropped it (§7.1, as integrated): `normalize.timing.mjs` runs `NFC_RUNS` through `reorderUnicode` and `normalizeText`, with no exemption.

### 7.8 W6: engine-fonts

- **Owns:**
  - `src/fonts/zawgyi.js`, `src/fonts/win.js`;
  - `src/engine/fontReader.js` (`FONT_READING`, `compileFont`, `readFont`, `glyphsInTypedOrder`, its scratch, `fontReaderScratchUnits`);
  - `src/stages/fonts.js` (`FONT_STAGES`, `fontToUnicode`, `traceFontToUnicode`, the compiled fonts);
  - `test/next/fonts.test.mjs`, `readers-font.test.mjs`, `fontToUnicode.test.mjs`, `fonts.timing.mjs`.
- **May assume:** W0, W1, W2 (`zeroAsWa`, `fixLookAlikes`, `fixTypos`), W5 (`SyllableBuffer`, `closeSyllable`, `CodeBuffer`, `isHeld`, `marksGoOn`). The font data and `compileFont` can be built before W5 lands.
- **Measure early**, as W5 does: once `readFont` runs, post an interleaved ratio of `fontToUnicode` against `oracle.zawgyi.toUnicode` on perf's line and word workloads.
- **Done:**
  - The tables equal 2.x, with every 2.x row present and each role mapped. The compiled lookup agrees with 2.x `storageOrder.font(...)` (via `internals`) for all 65,536 codes: role, text and marks.
  - For each check of §3.8, one test shows a deliberately broken row being refused with `ERR_KNAYI_INVALID_FONT_TABLE`.
  - `readFont` agrees with 2.x `arrange` on 200k fast-check Zawgyi and Win strings (1M nightly).
  - `fontToUnicode` agrees with `oracle.zawgyi.toUnicode` and `oracle.win.toUnicode`: 100k each on a PR, 300k nightly, plus the regressions of test/fuzz.test.js, the generated Win sets of `scripts/eval/lib/inputs.mjs` and the table probes.
  - `traceFontToUnicode` agrees with `toUnicode(x, font, true)` (matched_patterns and steps) on 50k strings (300k nightly).
  - The ARCHITECTURE.md examples of the font reader's side of the four differences pass.
  - The heap check passes after an 8.9M-char conversion: `fontReaderScratchUnits()` is ≤ the initial sizes.
  - The tree-shaking check passes: the normalize-only bundle has no bytes from `fonts/`, `fontReader.js` or `fontStages.js`.
  - Growth ≤ 1.3.
  - The Win results are labelled "Win identity only", because there is no hand-checked Win set yet (PR 0.9 of the plan).
- **As built**, where the build settles what this section leaves open:
  - **The tables** are the rows of `library/zawgyi.js` and `library/win.js` at the reference, copied with their comments, only the role names changed. The sequence ids are `zg.lagaung.1-2` and `win.look-alike.1-4`. W6 built `legacyWinTables()`, the 2.x shape of `win.tables`, in `fonts/win.js`; the review moved it to `compat/legacy.js` (§5.1, §7.11), so the font module holds data only and `LOOK_ALIKE_SEQUENCES` is a plain frozen literal again. It returns new objects and new RegExps at each call, copies made with `new RegExp(re.source, re.flags)`, so no caller can reach the core's own rows.
  - **`compileFont`** makes three checks the list of §3.8 did not spell out: no key or alias is a space or zero-width character (check 1), no BASE row has attached marks (check 4), and no alias is a key (check 5). The `CompiledFont` is `{ name, sequences, index, roles, units, textStart, textEnd, marksStart, end }`: a `Uint16Array` index, a `Uint8Array` of roles, every glyph's text and then its attached marks in one `Uint16Array`, and `Uint32Array` offsets into it.
  - **`readFont`** looks the glyph up first (§3.6, as built), and is 32 lines, its steps in named helpers.
  - **Memory.** `fontReaderScratchUnits()` is `SyllableBuffer#capacity()` plus `CodeBuffer#capacity()`, the members W5 added for both readers (§7.7, as built).
  - **`fontToUnicode` and `traceFontToUnicode`** keep each compiled font and its frozen stage context as module constants, so a call allocates nothing for them. (As reviewed, §7.11: the context is a new object per call, since the 'syllables' stage writes what the reader saw into it for gate 4.) A font name other than `'zawgyi'` or `'win'` throws `ERR.INVALID_ARG_VALUE` (a RangeError) instead of converting with the wrong table.
  - **Tests.** `fonts.test.mjs` (the tables, the compiled lookup on all 65,536 units, a broken row for each check); `readers-font.test.mjs` (each step of §3.6, the four differences, every unit alone and every pair of the units each font reads against 2.x `arrange` and `glyphsInTypedOrder`, the memory checks); `fontToUnicode.test.mjs` (the stages, the README and ARCHITECTURE examples, the regressions, the table probes, and every generated set of `scripts/eval/lib/inputs.mjs`, with traces); the two fuzz files of §6.1, the second also running the seeded `fuzzSets` of compare, with traces; and `fonts.timing.mjs`, which adds d170cd8's ten NFC run shapes and has no NFC exemption, since W1 ported the helper. Nightly counts, once (`KNAYI_FUZZ_SCALE=100 KNAYI_FUZZ_SEED=4711`, Node 26.5): `fontToUnicode.fuzz.test.mjs` 8 s, `readers-font.fuzz.test.mjs` 3 s.
  - **Corpora.** `npm run compare -- --base e5f6e24 --head <file>`, where the file is this worktree's `main.js` with `library/zawgyi.js` and `library/win.js` `toUnicode` routed to `fontToUnicode` and `traceFontToUnicode`: 0 differences on 2,771,318 comparisons (all 20 call forms, all 20 input sets, mC4 included), under Node and Bun, and on 3,324,063 more with `--fuzz 200000 --seed 7`.
  - **Speed** (measure early), with W1's, W2's and W5's modules merged locally, on a machine shared with other builds. Interleaved in one process against the 2.x function each replaces, on perf's 400 FLORES lines in Zawgyi and their synthetic Win copy (ratio = new / 2.x, median of 21 runs, Node 26.5):

    | | line | word | string | document |
    |---|---|---|---|---|
    | `fontToUnicode` / `zawgyi.toUnicode` | 0.41 | 0.45 | 0.36 | 0.36 |
    | `fontToUnicode` / `win.toUnicode` | 0.41 | 0.45 | 0.37 | 0.36 |
    | `readFont` / 2.x `arrange`, Zawgyi | 0.39 | 0.43 | | |
    | `readFont` / 2.x `arrange`, Win | 0.37 | 0.41 | | |

    On the 14,304 mC4 lines, `fontToUnicode` reads 0.42 of `zawgyi.toUnicode`. Through `npm run perf` with the compare head above (5 rounds), `fontConvert.zawgyi-unicode` reads 0.41, 0.48, 0.36 and 0.37 under Node, and 0.40, 0.51, 0.30 and 0.30 under Bun; `fontConvert.win-unicode` 0.40, 0.47, 0.37 and 0.36 under Node; every growth exponent of the three font call forms is at most 1.18 (Node) and 1.05 (Bun). Against the goals of §6.4: the word goal (0.60) holds, the line goal (0.40) sits at its edge, inside perf's noise, and string and document miss 0.29 by 0.07-0.08 under Node. The stage 'syllables' takes 77-84% of the pipeline's time, so what is left is in `readFont` and `orderSyllable`; the reader prototype read 0.27 on one string with its state in closure locals (`SCR/judge-perfarch/zg-endstate.out`).

### 7.9 W7: unicode-to-zawgyi

- **Owns:** `src/rules/unicodeToZawgyi.js`, `test/next/unicodeToZawgyi.test.mjs`.
- **May assume:** W0, W1 (rows, traces), W3 (`collapseRepeatedMarks`).
- **Done:**
  - There are 57 once rows and 8 repeat rows, in 2.x order. For each row: `ruleLabel(row)` equals the 2.x `RegExp#source`; `to` equals the 2.x replacement; the flag is `g`; `repeat` is right; and `re` is the 2.x literal, or for the six rows of §3.9 its wrapped-first-unit form. Only those six rows have a `label`.
  - Each row sits in its section array, under a `why` comment, and the test table has an example for each id (D17).
  - The atom lint passes.
  - Every repeat row's matches change the text (§3.9).
  - `unicodeToZawgyi` agrees with 2.x `convertText(collapseMarks(x, 'unicode'), 'unicode', 'zawgyi')` on 200k strings (1M nightly), the table probes and the README strings.
  - `traceUnicodeToZawgyi` reproduces 2.x's debug log (§3.9).
  - Growth ≤ 1.3.
- **As built**, where the build settles what this section leaves open:
  - Row ids are `uz.<section>.<n>`, numbered from 1 in each section: `shapes`, `kinzi`, `order`, `small`, `glyphs`, `narrow-ta` and `medial-ra`, for SHAPES_IN_CONTEXT to MEDIAL_RA_SHAPES.
  - Each section is a top-level `/* @__PURE__ */ deepFreeze([...])`, since the stateless guard rejects an unfrozen top-level array, and `joinSections` joins them into `UNICODE_TO_ZAWGYI_RULES`.
  - W7 also owns `test/next/unicodeToZawgyi.oracle.mjs`, the 2.x side that the unit and fuzz files share: the oracle's rows and debug log, the trace read back as that log (D4), and the preamble of 2.x `fontConvert(x, 'zawgyi', 'unicode')` restated, so that the core converts exactly the text the 2.x call converts. The test globs do not match the file.
  - Besides the 200k strings, `unicodeToZawgyi.fuzz.test.mjs` runs compare's generated and fuzz sets and every cached corpus through both call forms, the converted text and `fontConvert.debugging`'s log. It reads only the corpora that `checkCache` finds intact, and never downloads one.

### 7.10 W8: compat

- **Owns:**
  - `src/compat/*.js`;
  - the compat build in `scripts/contract/matrix.js` (§5.4), and the 10 recorded cells in `test/contract/api-matrix.json`;
  - `test/next/compat-*.test.mjs`, and a README doctest run against compat (Phase 6 exit);
  - W8's CI changes of §6.3: `next` in the push branches, and the `Compat` job;
  - a "3.0 core on next" section in ARCHITECTURE.md, written from this spec and what was built.
- **May assume:** everything.
- **Can start early:** `globalOptions.js`, `input.js`, `legacy.js` and `zawgyiModel.js` need only W0 and W1. Unit-test them against the live `library/` (D19):
  - `resolveFont` agrees with `contentGate.resolveFont` on a list of values (strings, aliases, arrays, numbers, Symbols, `Object.prototype` names);
  - `mergeDetectorOptions` agrees with `globalOptions.detector`, console output included;
  - the legacy lookups agree with 2.x on every `Object.prototype` name and on the matrix's font list;
  - port the adapter cases of test/adapter.test.js. Each case builds its own loader with `createZawgyiModelLoader` and a stub require (missing package, broken package, package without `ZawgyiDetector`, working fake), and passes it to `fontDetectCore`. No case touches the shared `zawgyiModelLoader`, so the cases are independent of each other and of other test files under `bun test ./test`;
  - the warned flag: a call in silent mode prints nothing and leaves the next call free to warn once (C26).
- **Also pins:**
  - the two known differences of §5.4, the second with the working-directory adapter test;
  - `truncate`'s detection input, with the two inputs of §5.1.
- **Done:** the acceptance gate (§6.3), and every row of §5.2 covered by a named test.
- **As built**, where the build settles what this section leaves open:
  - **Byte identity.** `npm run compare -- --base e5f6e24fa756f8f9c8d790f9a15ede85b135e8ae --head mjs:src/compat/index.js`, with every corpus cached and pinned: 0 differences on 2,771,318 comparisons (all 20 call forms, the four `debugging.*` forms included; all 20 input sets, mC4 included), under Node 26.5 and under Bun 1.4.2; and 0 on 8,957,756 comparisons with `--fuzz 200000 --seed 7`. compare loads the ES module itself (`mjs:<file>` imports it), so compat needs no CommonJS entry.
  - **The matrix.** All 3,523 cells match for compat under Node 26.5 and Bun 1.4.2, and so does the order-independence check, which `test/contract/api-matrix.test.js` and `scripts/bun-matrix.js` now run on compat as well as `main.js`. compat does not record its own copy of the 10 cells of §5.4: `SHARES_RECORDED_DIFFERENCES` in `scripts/contract/matrix.js` checks it against the cells recorded for `knayi-myscript.mjs`, so `test/contract/api-matrix.json` is unchanged. `npm run matrix:update` fails if compat ever differs from that build's recorded cells; run with `--out`, it rewrites the snapshot byte for byte.
  - **No core change was needed.** Every module of W1-W7 gave 2.x's output through compat's preamble on the first run of compare and the matrix.
  - **Where the structure of §5.1 had to bend:**
    - `fontConvert` is `/* @__PURE__ */ withDebugging(function fontConvert (…) {…})`, since a top-level `fontConvert.debugging = …` breaks §2.4 rule 1. `withDebugging` sets `debugging` on the function and returns it.
    - The default export is built by `/* @__PURE__ */ createKnayiObject()`, and is not frozen, like `main.js`'s object.
    - The option store is a `const` made by a builder from core `DEFAULTS`. `setGlobalOptions` reads `Object.keys` once per key, as 2.x does.
    - A package without `ZawgyiDetector` is recorded as a frozen `{ message }`, not a `new Error(…)`: only `compat/legacy.js` may construct an error class (`guards/errors.test.mjs`), and the message is all that `missingMessage()` reads.
    - The rule-table lookups of C12 are made on two frozen plain objects with 2.x's own keys; freezing keeps `Object.prototype` as their prototype, so an inherited name finds what it found in 2.x.
  - **One case compare and the matrix cannot see.** Core `breakString` reads an empty separator as U+200B (C20), while 2.x joins with an empty string when the separator converts to `''` (an object whose `toString` returns `''`). compat converts first and then returns `prepareBreakText(text, font)`, which is the parts joined with nothing. `compat-legacy.test.mjs` pins it.
  - **Tests**, all against the live `main.js` and `library/` (D19), shared helpers in `test/next/compat-helpers.mjs`: `compat-index` (C1, C27, and every README and ARCHITECTURE example run against compat), `compat-globalOptions` (C2-C4, C25), `compat-input` (C5-C11), `compat-legacy` (C12, C20, every `Object.prototype` name, and, since the review, `legacyWinTables` against the live library/win.js), `compat-fontDetect` (C13, C14, C26, the adapter cases with their own loaders, and the working-directory test of §5.4 in child processes), `compat-fontConvert` (C15-C19, and the detached call of §5.4) and `compat-text` (C21-C24, and the two inputs of §5.1).
  - **Bun installs what it cannot resolve.** Run outside a directory with `node_modules`, Bun auto-installs a package that `require` cannot find; for myanmar-tools that is 1.2.0, which fails to load (detector.js:56), so the 2.x ES module build and compat print "could not be loaded" there instead of "not installed". The working-directory test runs Bun with `--no-install`. Users are not affected where myanmar-tools is installed.
  - **CI.** `next` is in the push branches of `test.yml`, and the `Compat` job of §6.3 runs compare under Node and Bun against the full sha (corpus flags as the `Compare` job), the matrix under both, and the growth check of compat.
  - **Sizes**, which bind at the gate (`node scripts/next/size.mjs`): compat is 15,926 B gzip, 5,072 B over the 10,854 B target; its own eight files are 6,471 B of its 50,043 minified bytes, and the rest is the core, led by `engine/syllable.js` (6,477 B), `rules/unicodeToZawgyi.js` (5,561 B) and `fonts/win.js` (4,866 B). The normalize-only bundle is unchanged at 6,357 B. Both targets need the maintainer's decision before the gate.
  - **Speed**, `npm run perf -- --base e5f6e24fa756f8f9c8d790f9a15ede85b135e8ae --head mjs:src/compat/index.js --rounds 5 --max-slowdown 0`, on a machine shared with other builds (load average 5-7), so this is not the gate's quiet run. It passes the binding checks of D22: no Node row above 1.00 (the highest is `fontConvert.unicode-zawgyi` per word, 0.79), and no growth exponent above 1.3 of the 2,264 cells under Node (highest 1.23) or Bun (highest 1.26). Node ratios (line / word / string / document): `normalize` 0.31 / 0.29 / 0.31 / 0.30; `fontConvert.zawgyi-unicode` 0.40 / 0.48 / 0.35 / 0.34; `fontConvert.win-unicode` 0.40 / 0.49 / 0.35 / 0.35; `fontConvert.detected-unicode` 0.33 / 0.30 / 0.32 / 0.32; `fontConvert.unicode-zawgyi` 0.59 / 0.79 / 0.50 / 0.51; `fontDetect` 0.18 / 0.11 / 0.24 / 0.24; `syllBreak.unicode` 0.30 / 0.23 / 0.40 / 0.40; `syllBreak.zawgyi` 0.34 / 0.24 / 0.46 / 0.45; `syllBreak.detected` 0.25 / 0.16 / 0.33 / 0.33; `spellingFix.unicode` 0.28 / 0.18 / 0.50 / 0.50; `spellingFix.zawgyi` 0.08 / 0.05 / 0.16 / 0.16; `truncate.30` 0.29 / 0.18 / 0.34 / 0.34; the `debugging.*` rows within 0.04 of their conversions. Against §6.4, these goals are missed: `normalize` per string and document (0.31 and 0.30 against 0.29), `fontConvert.zawgyi-unicode` per string and document (0.35 and 0.34 against 0.29, as W6 found), and `fontConvert.unicode-zawgyi` per word (0.79 against 0.63). The estimates held: `fontConvert.detected-unicode` per line 0.33 (≤ 0.40), `syllBreak.detected` 0.25 (≤ 0.33) and `truncate.30` 0.29 (≤ 0.50). Under Bun, `fontConvert.unicode-zawgyi` and its debugging row read 0.92-1.03, and three `fontDetect` rows on one string or document read 1.12-1.18 with round ranges of 0.56-1.28, which W4's runs on a quiet machine did not show (1.35-2.3x faster on one long string); they need the gate's quiet run before a reason is given.
  - **The gate is not run yet.** `AT_ACCEPTANCE_GATE` stays false, though no stub is left (`guards/notBuilt.test.mjs` finds 0): the gate also needs the nightly fuzz counts once by hand, a perf run on a quiet machine, and the size decisions above.

### 7.11 Review fixes

A review of W0-W8 on `next-compat` (3af8172) found the problems below. Each fix is its own commit, on a branch from `next-compat`, and none changes compat's output: compare and the contract matrix still show 0 differences against the reference.

- **`segment.js` checks its font and its policy.** An unknown bare-consonant policy acted as `SEPARATE` in Unicode and as `CHAINS` in Zawgyi, and an unknown font as Unicode. Every function now throws a coded `RangeError` for them (§2.3, "`src/rules/segment.js`"), and Zawgyi reads the policy through `bareConsonantJoins`, as Unicode does.
- **`legacyWinTables` lives in compat.** It moved from `fonts/win.js` to `compat/legacy.js` (§5.1), so the font module holds data only.
- **One directory per L3 part** (D15). `engine/` holds the engine, `rules/` the rules (`typingFixes.js`, `detect.js`, `segment.js`, `unicodeToZawgyi.js`) and `stages/` the stage lists (`normalize.js`, `fonts.js`, formerly `engine/normalizeStages.js` and `engine/fontStages.js`). A path now names its layer, and so the imports it may make (§2.2). As ES modules the move costs no bytes: compat 16,009 B and normalize-only 6,357 B gzip, before and after.
- **The stateless guard reads every top-level value** (§4). Its rule 1 flagged only object and array literals, so the module state the core really holds, all made by calls (`NFC_MEMO`, `SCRATCH`, `FONT_SYLLABLE`, `FONT_OUTPUT`) or regex literals (the exec-loop regexes), went unchecked, and its `NFC_MEMO` exemption was never used. It now classifies each initialiser and requires module state to be listed by name; six mutants (a `new Map()` cache, an unfrozen builder result, an `exec`-driven literal, an unlisted typed array, and two exec loops that leave early without their reset) each fail it.
- **The code cites only what is in the repository.** About 17 comments of `src/` cited the refactor plan's list of 2.x bugs ("refactor plan §7 #11") or its evidence folder (`SCR/verify-engine`), which a contributor cannot open. §10 now restates the kept 2.x bugs, with their counts, and the comments cite `DESIGN.md §10 Q11`; a measurement is cited by its number and the test that pins it. `guards/citations.test.mjs` fails on a citation of the plan or of `SCR/`, and on a decision or quirk that §1.3 or §10 does not list.
- **Line numbers name a frozen file.** `src/` had 99 citations of the form `file.js:NN` with no path. 32 of them named files with no frozen copy: 31 in 2.x files that the port pull requests rewrite (`converter.js`, `detector.js`, `globalOptions.js`, `truncate.js`, `syllBreak.js`, `spellingCheck.js`, `normalization.js`, `main.js`), whose lines would go stale when §8 merges `main` into `next`, and one in the extracted `scripts/oracle/signatures.js`. Those now name the 2.x function or table instead; the other 67 name files that `scripts/oracle/` keeps frozen at the reference. ARCHITECTURE.md and §1.2 rule 3 state the convention once, and `guards/citations.test.mjs` checks it, reading the list of frozen copies from `test/next/helpers.mjs`, which `guards/oracle.test.mjs` uses for their blob ids.
- **Unicode to Zawgyi skips the rows that cannot match** (§3.10, gate 3). Every call ran all 57 once rows and the 8 repeat rows, a `String#replace` each, however short its text: in the per-word profile the rule runner held 68.6% of the self time, and per word compat read 0.79 of 2.x under Node (the goal is 0.63) and 1.09 under Bun. Each row now names its `needs`, the collapse notes the text's units in the same pass, and a row with none of its `needs` in the text is skipped; the repeat rows are tested and replaced once, as 2.x's 1584410 does. Against 2.x (`npm run perf`, 5 rounds, on a machine shared with other work): Node 0.48, 0.30, 0.48 and 0.48 per line, word, string and document (W8 read 0.59, 0.79, 0.50 and 0.51); Bun 0.78, 0.41, 0.92 and 0.92 (the review read 1.06, 1.09, 0.94 and 0.92). The growth exponents of the Unicode to Zawgyi and `spellingFix.unicode` forms stay at most 1.23 under Node and 1.18 under Bun.
- **normalize copies through the syllables typed in order** (§3.4, as typed; §3.6). Every syllable with a mark went through `placeAsat`, `rankMarks`, `sortByRank` and `fixLookAlikeLetters`, a write into a `CodeBuffer` and `equalsText`, though 99.92% of syllables come out unchanged: about 33% of the one-string profile. normalize read 0.32, 0.30, 0.31 and 0.30 of 2.x, missing the one-string and document goals (0.29) and the Phase 2 exit of 3.5x. `writesAsTyped` now decides from the buffer whether `orderSyllable` would write the parts as they came, and the Unicode reader closes such a syllable without writing or comparing. Against 2.x (`npm run perf`, 5 rounds): Node 0.23 on all four workloads, Bun 0.21, 0.20, 0.17 and 0.18; growth at most 1.17 (Node) and 1.06 (Bun).
- **The font pipeline gates its final NFC** (§3.10, gate 4). The final NFC never skipped: in the per-line profile it held 9.7% of the samples, and Zawgyi to Unicode read 0.40, 0.48, 0.34 and 0.34 of 2.x, per line at the edge of its goal of 0.40. The compiled fonts carry an NFC risk per glyph, the reader ORs it for every glyph written whole and notes every unit with no glyph, and the 'NFC' stage runs only when that flag is set. Against the previous commit (5 rounds): Zawgyi 0.89, 0.87, 0.97 and 0.97 under Node.
- **The lagaung sequence is skipped on text with no four** (§3.10, gate 3). `zg.lagaung.1`, `(^|[^\u1040-\u1049])\u1044…`, starts with an alternation, so it was tried at every position of every text: 1.0-1.8% of the per-line profile. A regex that starts at the four cannot keep 2.x's rule that the unit before the four counts only when no earlier match took it (ES2015 has no lookbehind), so the row keeps its regex and names `needs: '\u1044'`, and `applyRuleRows` skips a row whose `needs` the text lacks. Against the previous commit (5 rounds): Zawgyi 0.98, 0.90, 1.01 and 1.01 under Node, 0.94, 0.99, 0.95 and 0.97 under Bun.
- **The Bun `fontDetect` rows over 1.10 were a timing effect, and perf reads them better.** In full Bun runs `fontDetect` and `fontDetect.unicode` per string and document read 1.09-1.25, with round ranges of 0.60-1.27, which W4's quiet-machine runs never showed. In isolation, the same timing as perf's (16 calls per run, `Bun.gc` before each run, alternating copies) read 0.40-0.46 in every round: the 2.x base took 632-715 µs per call on the 61,425-character string and next 279-306 µs, so next is about 2.3x faster than 2.x on one string under Bun (the review measured 665 and 290 µs, of which `countEvidence` 258 µs and `cleanText` 28 µs). A replay of perf's rows found the cause: after the line and word rows, JavaScriptCore runs next's `countEvidence` on the long string at about 290 or about 590 µs per call, round to round, and the mode lasts the whole round, so a median of three rounds could land on the slow one. perf now reads a Bun row of one call as each copy's fastest round (`scripts/eval/perf.mjs`, `rowRatio`); in the next full run `fontDetect` per string read 0.61 instead of 1.09, while `fontDetect.unicode` read 1.12 and 1.18 because all three of its rounds ran slow. More rounds (`--rounds 5` at the gate) make an all-slow row less likely; a row still listed reads its round range and these numbers as its reason. The perf change is a tool change, to be made on `main` too.
- **The one-string goals are read at 2,000,000 units.** perf's string is 61,425 units, but the goal of 0.29 for normalize and Zawgyi to Unicode on one string came from prototypes run on 2M-4.6M characters, and a call costs relatively more on short text. perf gains `--long-units <n>` (`scripts/eval/lib/inputs.mjs` `workloads`), and §6.4 reads those two goals with it. At 2,000,000 units against 2.x (5 rounds): normalize 0.18 per string and document under Node, 0.13 under Bun; Zawgyi to Unicode 0.27 under Node, 0.20 under Bun; Win 0.28 and 0.19-0.20; Unicode to Zawgyi 0.47 and 0.92. The optional steps (c) of the review, checking capacity once per syllable and decoding in chunks of 32,768 units, are not taken: they reach into `CodeBuffer`'s array from outside for 2-3%, and Zawgyi meets its goal at that size without them.
- **Sizes.** The gates and the `needs` of the 65 Unicode to Zawgyi rows cost bytes: compat is 16,708 B gzip (16,009 B before the review's speed changes) and the normalize-only bundle 6,528 B (6,357 B). Both targets of §6.4 were missed before, and still need the maintainer's decision before the gate.
- **The branch.** The review found `next` holding only the design (e1fb695) and checked out in the `next-design` worktree, while the built core sat on `next-integration` and `next-compat`, merged into `next` by no one. The fixes above are commits on `next-review`, which starts from `next-compat` and so contains every module of W0-W8; `next` is an ancestor of it. Once `next` is free of the `next-design` worktree, `next-review` merges into `next`, with a merge commit as CONTRIBUTING.md asks of stacked pull requests, or as a fast-forward.
- **Speed after the review**, `npm run perf -- --base e5f6e24fa756f8f9c8d790f9a15ede85b135e8ae --head mjs:src/compat/index.js --rounds 5 --max-slowdown 0`, on a machine shared with other work (load 4-7), so not the gate's quiet run: it passes the binding checks of D22, with no Node row above 1.00 (the highest is `spellingFix.unicode` per string, 0.54) and no growth exponent above 1.3 of the 2,264 cells under Node (highest 1.20) or Bun (highest 1.18). Node, line / word / string / document: `normalize` 0.23 / 0.23 / 0.23 / 0.24; `fontConvert.zawgyi-unicode` 0.36 / 0.39 / 0.37 / 0.37; `fontConvert.win-unicode` 0.38 / 0.43 / 0.38 / 0.38; `fontConvert.detected-unicode` 0.30 / 0.25 / 0.33 / 0.33; `fontConvert.unicode-zawgyi` 0.49 / 0.30 / 0.49 / 0.49; `fontDetect` 0.19 / 0.11 / 0.23 / 0.23; `syllBreak.unicode` 0.31 / 0.23 / 0.41 / 0.41; `syllBreak.zawgyi` 0.35 / 0.24 / 0.44 / 0.44; `spellingFix.unicode` 0.37 / 0.19 / 0.54 / 0.54 (round ranges 0.27-0.37 and 0.44-0.54); `spellingFix.zawgyi` 0.11 / 0.05 / 0.17 / 0.17; `truncate.30` 0.29 / 0.18 / 0.34 / 0.33. Every goal of §6.4 holds, the one-string goals at 2,000,000 units. Bun reads no row over 1.10: `fontConvert.unicode-zawgyi` 0.80 / 0.41 / 0.91 / 0.92, `normalize` 0.21-0.23, Zawgyi to Unicode 0.33-0.49, and `fontDetect` per string 0.58.

### 7.12 The generated Unicode to Zawgyi writer (plan Phase 6 #5)

Phase 6 #5 of the plan: the rows of Unicode to Zawgyi that write one glyph for one fixed text are generated from the Zawgyi glyph table read backwards, the rows where that inverse does not hold stay written by hand, and decision 30's one-pass writer is revisited. Built on `next-u2z-writer`, from `next` at c8ebefe. No output changes: compat and its debug log stay the reference's.

- **The rows** (§3.9). 42 of 2.x's rows replace one fixed text with one fixed text. 38 of them replace it with the glyph the table draws it with, and none with another of its glyphs, as reuse-11 of the plan counted. These 38, the kinzi row and 37 of GLYPHS, are listed as their Unicode texts and built at load by `tableRows`, with 2.x's labels, the six wrapped rows of decision 29 among them. The four the table does not give are written by hand, each with its reason above it. The test checks both ways, and that each hand-written row says why. The order of GLYPHS stays written out: no rule of the table gives it (medial wa with ha and ha with uu sit between stacked kha and stacked ka), and it is output, through the rows that overlap and through the order of `fontConvert.debugging`. One `needs` changed: `uz.glyphs.30`, medial wa with ha, now names its first unit, wa, where it named ha; only the trace runs that row on its own.
- **The one pass** (§3.9). It replaces up to 38 `String#replace` calls, each gated by the unit set, with one char-code pass over typed tables built from the rows (`PASS_*`). A text with a stack on a stack runs the rows one by one, so decision 30's divergence never shows. The trace runs the rows one by one, as before.
- **What the pass costs, and the choices that follow.** The first version read the frozen rows at every match and joined slices of the text to the glyphs. Against `next` it read 0.88, 0.76, 0.95 and 0.95 per line, word, string and document under Node, but 1.03, 0.88, 1.16 and 1.15 under Bun. Two causes, each measured:
  - a read from a frozen array costs about 7 ns under JavaScriptCore, 6 times a plain array's and 16 times a typed array's (under V8 about 4.7 ns, 10 times a typed array's), so the pass reads typed arrays;
  - under JavaScriptCore, joining the thousands of slices of one long text costs more than the rows did: with the typed tables and slices alone, Bun read 1.07 and 1.05 on the string and the document. So the pass writes a text of more than 64 units into a buffer of units, and a shorter one as slices. A buffer for every text read 1.06 per word under Bun and 0.80 under Node, against 0.82-0.84 and 0.72 with the split. Splits at 32, 64, 128 and 256 units read alike, within the noise; at 4,096, Bun read 0.95 per line.
- **The floor guard** reads every regex of `src/`, and these rows' regexes are built from the table's texts. It now lists `tableRow` as the one function that may build a regex from data (`BUILT_FROM_DATA`), whose patterns `unicodeToZawgyi.test.mjs` compares with 2.x's sources, and a test pins that it is the only one.
- **Checks.**
  - `npm run compare -- --base e5f6e24fa756f8f9c8d790f9a15ede85b135e8ae --head mjs:src/compat/index.js`: 0 differences in 2,771,318 comparisons under Node 26.5 and under Bun 1.4.2, and 0 in 8,957,756 with `--fuzz 200000 --seed 7`.
  - The contract matrix: all 3,523 cells match for compat under Node and Bun, in either order.
  - `unicodeToZawgyi.fuzz.test.mjs` at its nightly counts (1,000,000 strings and 300,000 traces, seed 31337): 0 differences.
  - `unicodeToZawgyi.test.mjs` compares the pass with the rows on 203,989 short strings and on long texts joined from them. Mutants that drop the stack-on-stack check, the last unit of the buffer or of the slices, or a unit of a row's text, or that try the rows at a unit in the wrong order, each fail it.
- **Speed**, `npm run perf`, 5 rounds, interleaved, on a machine shared with other work (load 5-7):
  - against `next` at c8ebefe: `fontConvert.unicode-zawgyi` 0.85, 0.73, 0.90 and 0.90 per line, word, string and document under Node, and 0.86, 0.90, 0.90 and 0.90 under Bun; at 2,000,000 units (3 rounds), 0.86 under Node and 0.88-0.89 under Bun. `debugging.unicode-zawgyi`, which runs the rows one by one as before, reads 0.99-1.01. The rows read from the table, before the pass, read 0.98-1.01 of `next` (an interleaved A/B of the core call, 21 runs);
  - against 2.x at e5f6e24: 0.40, 0.22, 0.43 and 0.43 under Node, and 0.69, 0.34, 0.82 and 0.84 under Bun, where §7.11 read 0.49, 0.30, 0.49 and 0.49, and 0.80, 0.41, 0.91 and 0.92, after the review;
  - growth: 0 of 308 cells above 1.3, the highest 1.15 under Node and 1.06 under Bun.
- **Size.** compat is 17,289 B gzip, 581 B more than `next`'s 16,708 B. The rows read from the table took 107 B off it (16,601 B, 51,433 B minified), and the pass adds 688 B (53,557 B minified): its builders, its two ways of writing and its typed tables compress worse than the regex literals the rows replaced. The normalize-only bundle is unchanged at 6,528 B. Both were over their targets before, and still need the maintainer's decision.

---

## 8. Porting the 2.x line into next

The 2.x line moves on `main`: the linear NFC helper, Phase 1c, Phase 1 speed wins and Phase 4 output changes. Its changes reach `next` after the core passes the gate. Each one arrives as a port PR:

1. **Merge `main` into `next`.** `library/`, its tests, `test/contract/api-matrix.json` and the tools now hold the new 2.x behaviour.
2. **Make the same change in the core module and in compat.** For example:
   - the linear NFC helper is already in `core/nfc.js` (W1, §7.3), so its port PR only merges `library/nfc.js` and its tests;
   - PR 4.3's font-name policy goes into `compat/input.js` and `compat/legacy.js`, where `legacyTypeError` gives way to `libraryError` with a code;
   - PR 4.2's always-an-object `debugging` goes into `compat/fontConvert.js`.
3. **Run the gate against the new 2.x reference.** That is the sha of the `main` commit just merged, pinned as in §1.1, never `--base main`. It must show 0 differences. A Phase 4 output change also bumps `OUTPUT_VERSION`.
4. **Update this spec**: §1.1's reference, §5.2 and §1.3, and the sizes of §6.4 when the port adds code.

**The NFC port** was done by W1 (§7.3): `core/nfc.js` is linear, the stateless test runs its warm-against-cold memo check, and the "after" column of §6.4 binds. The merge of `main` brings the helper's ten run shapes into `scripts/eval/lib/inputs.mjs`, and with them into `SHAPES`, so every module growth check then times them too.

**Module tests after a port (D19).** The core's module tests read the 2.x engine only in `scripts/oracle/`, so a port that changes `library/`'s private code (PR 1.4's glyph array, PR 1.6's mark bit set) changes nothing for them. compat's tests compare with the live `library/` and follow it. A port that changes output on purpose (a Phase 4 fix, labelled DELIBERATE on `main`) does what `main` did:
- if `main` updated a file in `scripts/oracle/`, the merge brings the update, and the core module's differential tests follow it;
- if `main` instead kept the oracle and listed the difference in its fuzz test, the core module's differential test lists the same difference, with the same count, citing the 2.x PR.

A 2.x speed win that the core already has, such as the atom wrap or the one-regex collapse, needs no port, only the merge.

---

## 9. Not in this build

These are the rest of Phase 6. The core is shaped so that they need no core change:

- **The 3.0 API** (`src/index.js`): `toUnicode(text, {from, tie, trace})`, `toZawgyi`, `detectEncoding` (from `countEvidence`), `normalize(text, options)`. It validates with `requireText`, injects `zawgyiModel`, passes `tie` to `decide`, and records traces with ids.
- **Streaming:** `createNormalizer`, `createConverter`, `mapLines`, `lineTransform`. The core functions are stateless and line-local on the proven boundary (Phase 6 #2 of the plan).
- **Lossless segmentation** in the 3.0 API, on the core's `segmentSyllables` and `syllableBoundaries` (built, §7.5). Its default bare-consonant policy is decision 34's to pick from the counts of §7.5; `PAIRS` stays the 2.x reading (`legacyBareConsonantPair`).
- **A truncate that always returns a prefix, and stops early** through `onBreak` returning false.
- **The change report** from `CopyThroughWriter.endSyllable`.
- **`isNormalized` and `explain`.**
- **Idempotent normalize** (decision 36).
- **Extended-C and code-point iteration** (decision 20b).
- **The CLI** (decision 32).
- **Packaging:** the exports map (`'.'`, `'./compat'`, `'./stream'`, `'./package.json'`), the `engines` field (Node 22.12 or later), the 3.0 builds with the dist floor checks and the Playwright smoke run, deleting `library/` and its shims, and per-entry import sizes.

---

## 10. Known 2.x quirks kept on purpose

compat must give the reference's output on every input (§1.2 rule 1), so the core keeps these 2.x behaviours, and each is pinned by a test. Each changes only in a deliberate pull request of the 2.x line, which reaches `next` through §8. They are numbered as in the refactor plan's list of 2.x bugs (§7 of the plan, outside the repository), so Q11 here is the plan's #11. Code cites them as `DESIGN.md §10 Q11`.

| # | Quirk | Example | Size | Kept in | Planned fix |
|---|---|---|---|---|---|
| Q3 | `fontConvert.debugging` returns what `fontConvert` returns on every early exit: strings, `''` and non-strings, not a debug object (C19). index.d.ts promises an object. | `debugging('abc', 'unicode')` is `'abc'`; `debugging('က', 'unicode', 'unicode')` is `'က'` | 190 matrix cells; the demo's string check depends on it | `compat/fontConvert.js` | 2.11, decision 12 (§8: "always-an-object `debugging`") |
| Q5 | `truncate` is not always a prefix of its input: a part that does not fit adds those of its words that do, so a later word can follow a skipped one (truncate.js `reduce`, C23). | The README pangram cut at 30 drops ဇလွန် and keeps the later ဈေး | 29% of Myanmar lines at length 30 | `compat/text.js` `fitParts` | 2.11, its own pull request; a prefix truncate that stops early is 3.0's (§9) |
| Q8 | The two pipelines run the typing fixes in different orders: normalize runs typos then look-alikes, and the font pipeline look-alikes then typos (C24; ARCHITECTURE.md, "Typing fixes and their two orders"). | `normalize('ဝ၄င်း')` gives U+101D U+104E (lagaung); the Win text `&4if;` gives U+1047 U+1044 (digits) | 0 corpus lines; synthetic input only | `stages/normalize.js`, `stages/fonts.js` | decision 15: typos first in both |
| Q11 | Bare consonants join only in pairs: one global replace never looks again at the consonant it has just taken, though the comment of syllable.js says every bare consonant joins (rows U7 and Z8, C21). | `syllBreak('ကကက', 'unicode', '\|')` is `ကက\|က`; ပထမဆုံး breaks as ပထ\|မဆုံး | 6,032 of 34,285 lines would change | `rules/segment.js` `legacyBareConsonantPair`; `spec/breakRules.js` U7, Z8 | decision 34 picks the 3.0 policy from the counts of §7.5 |
| Q12 | normalize is not idempotent on garbled input: a second call can change the text again (C24). | `၀ွ ှ` gives `ဝွ ှ`, then `ဝွှ`; `ိီိ` gives `ီိ`, then `ီ` | 0 Unicode corpus lines; 104 of 15,405 raw mC4 lines | `engine/unicodeReader.js`, `rules/typingFixes.js` | decision 36: idempotent by construction in 3.0 |
| Q15 | The 2.x ES module build, and compat with it, look myanmar-tools up from the working directory, where `main.js` looks from `library/` (known build difference 2, §5.4; C26). | A worker started from another directory finds the package "not installed" | monorepos and workers | `compat/zawgyiModel.js` | decision 17: an injected detector (Phase 5) |
| Q17 | The Zawgyi break classes disagree: row Z1 puts no break before the base glyphs U+106A (small nya) and U+106B, which the bases of rows Z3-Z5 and Z8 include, and neither class is the set of bases of the glyph table (syllable.js `BREAK_RULES` against zawgyi.js). | ငန္းၫွိ gets no break before U+106B | both class edits together fix 16 lines; one alone fixes 16 and breaks 4 | `rules/segment.js` `startsZawgyiSyllable`, `isZawgyiBreakBase`; `spec/breakRules.js` Z1 | a deliberate 2.x pull request (Phase 4) |
| Q19 | A base glyph's own marks are written as they are, not sorted with the syllable's: a whole base (Zawgyi lagaung, Win kyat and nnya with aa) keeps its inner marks first, and 2.x drops the attached marks of a BASE row, so compileFont refuses them (§3.8, check 4). | Win `aÓ` gives U+1009 U+102C U+1031 (ဉာေ), not ဉော | a latent table trap; a fix changes 16 mC4 and 107 Unicode lines | `fonts/zawgyi.js`, `fonts/win.js` `wholeBases`; `engine/fontReader.js` | a deliberate 2.x pull request, after a decision |
| Q20 | zero as wa and the look-alikes judge "a zero in a number" by two different rules (`NUMBER_CONTEXT.ZERO_AS_WA` and `.LOOK_ALIKES`, §2.3). | `(၇ ဒသမ ၀)` gives `(၇ ဒသမ ဝ)` | 45 mC4 lines with a lone zero | `rules/typingFixes.js` `isInNumber` | a deliberate 2.x pull request, after a decision |

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
| `lookAlikes`, `typos`, `fixTypos`, `TYPOS` | `fixLookAlikes` (= `readDigitsAsLetters` + `readLettersAsDigits`), `fixTypos`, `TYPO_ROWS` (spec) |
| `BARE`, `PART`, `RUN`, `nextToDigit`, `isSeparator`, `MARKS`/`MARK`/`isMark` | `isBareWaOrRa`, `isNumberPart`, `isInNumber`, `isNumberSeparator`, `isScriptMark` |
| `zeroAsWa` (storageOrder.js) | `zeroAsWa` (rules/typingFixes.js). The stage label `'zero as wa'` is unchanged. |
| `library.detect`, `scoreWithRules`, `scoreWithMyanmarTools`, `chooseAdapter`, `myanmartoolZawgyiDetector`, `fallback_font_type` | `DETECTOR_SIGNATURES` (spec), `countEvidence` + `decide`, `scoreByZawgyiModel`, `pickAdapter` (compat), `zawgyiModel`, `fallback` |
| `loadMyanmarTools`, `missingMyanmarToolsMessage`, `warnedMissingMyanmarTools`, `myanmarToolsLoadError` | `createZawgyiModelLoader`, and the shared `zawgyiModelLoader`'s `load`, `missingMessage` and `warnOnce` (compat) |
| `fontDetect(content)` called by the other functions | `detectForRouting(text)` (compat), passed to `chooseFontLegacy` |
| `nfc`, `reorder`, `LONGEST`, `isRunAt`, `decompose`, `classFor`, `inOrder` (library/nfc.js, d170cd8, not at the reference) | `toNfc`, `orderLongRuns`, `STREAM_SAFE_RUN`, `isRunCharacterAt`, `decomposeRunCharacter`, `combiningClassOf` with `findOrInsertClass`, `canonicalOrder` (core/nfc.js, W1) |
| `kinds`, `parts`, `classes`, `classOf` | `NFC_MEMO`'s fields `kinds`, `decompositions`, `classes`, `classOfMark` |
| `globalOptions.detector`, `setOptions` | `mergeDetectorOptions`, `setGlobalOptions` (compat) |
| `toText`, `isMissing`, `resolveFont`, `cleanText(x, true)` | `unboxString`, `enter`, `resolveFont`, `cleanText` = `stripZeroWidthBreaks(x.trim())` (compat) |
| `DRAWING_ORDER_FONTS`, `drawingOrderToUnicode` | `FONTS[from].visualOrder`, `fontToUnicode` |
| `convertRules`, `convertText`, `replaceOnce`, `replaceRepeated`, `ruleMatches` | `UNICODE_TO_ZAWGYI_RULES`, `unicodeToZawgyi` / `traceUnicodeToZawgyi`, `applyRuleRows` / `traceRuleRows`, `ruleMatches`, `ruleLabel` |
| `storageOrder.js` (one file: order, both readers, the font pipeline) | `engine/syllable.js`, `engine/unicodeReader.js`, `engine/fontReader.js`, `stages/normalize.js`, `stages/fonts.js` (D15) |
| `COLLAPSE`, `compileCollapse`, `collapseMarks` | per-font repeated-mark sets, `collapseRepeatedMarks` |
| `BREAK_RULES`, `breakParts`, `joinParts` | `BREAK_RULES` (spec, the oracle); `forEachBreak`, `breakParts`, `breakString`, `legacyBareConsonantPair`, `looksLikeSgawKaren` |
| `absoulteLength`, `curr`, `syll`, `_curr` (truncate.js) | `budget`, `kept`, `part`, `words` in `fitParts` |
| `parseUnicode`, `serializeUnicode` | not ported (decision 35) |
