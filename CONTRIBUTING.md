# Contributing to knayi-myscript

knayi is a small MIT-licensed library for Burmese and other Myanmar-script text. Issues and pull requests are welcome. This guide covers how to report a problem, set up a checkout, and get a change merged, and the steps the maintainer follows for a release.

- [Questions, bugs and feature requests](#questions-bugs-and-feature-requests)
- [Setup](#setup)
- [Commit messages](#commit-messages)
- [Pull requests](#pull-requests)
- [Changing a rule](#changing-a-rule)
- [Licences, fonts and test data](#licences-fonts-and-test-data)
- [Release checklist](#release-checklist)

[ARCHITECTURE.md](ARCHITECTURE.md) explains how the code is organized. Report security problems privately, as [SECURITY.md](SECURITY.md) describes, not in a public issue.

## Questions, bugs and feature requests

Open an issue at <https://github.com/greenlikeorange/knayi-myscript/issues>.

For a bug, include steps someone else can follow to see it:

- the knayi version, and where it runs (Node, Bun or a browser, with its version);
- the exact call, its output, and the output you expected;
- the text as code points (for example `U+1000 U+103B`), not only as rendered text. Unicode and Zawgyi text can look the same and still differ. The [demo](https://greenlikeorange.github.io/knayi-myscript/) shows the code points of any input.

For a feature request, say what you are trying to do and why the existing functions don't cover it.

## Setup

You need Node.js 22.12 or newer to build and test (`.nvmrc` has 24), [Bun](https://bun.sh) for the Bun checks (CI uses Bun 1.4.2), and Playwright's browsers for the browser tests.

```bash
git clone https://github.com/greenlikeorange/knayi-myscript.git
cd knayi-myscript
npm ci
npx playwright install chromium firefox webkit
git config blame.ignoreRevsFile .git-blame-ignore-revs
npm test
```

[ARCHITECTURE.md](ARCHITECTURE.md#running-the-checks) lists every npm script and the CI check that runs it. The sections below say which results a pull request reports.

- **Run `npm ci` in every clone and every git worktree.** Don't share or symlink `node_modules` between them: a shared one can miss dev dependencies, and then a test such as `test/syntax.test.js`, which needs `acorn`, cannot load.
- **The tests never write `dist/`.** They build the browser and ESM files into a temporary directory and test that build; `KNAYI_DIST=dist` points them at the committed files instead. `dist/` changes only in release commits, because jsDelivr serves `main`'s `dist/` to sites that load `@master`, and CI fails a pull request that changes it without a new version.
- **Indentation is two spaces**, as `.editorconfig` says. Older files used tabs until one whitespace-only commit replaced them. `.git-blame-ignore-revs` lists that commit, so `git blame` skips it once you run `git config blame.ignoreRevsFile .git-blame-ignore-revs` (in the setup above); GitHub's blame view skips it already. Don't reformat lines you don't otherwise change.
- **Never push a branch named `master`.** The default branch is `main`. GitHub redirects `master` to `main` only while no `master` branch exists, and jsDelivr links to `@master` depend on that redirect.

The corpora for compare, perf, eval and bench are downloaded into `.eval-cache/` on first use; see [scripts/eval/README.md](scripts/eval/README.md).

## Commit messages

Commits follow the [conventional-changelog format](https://github.com/conventional-changelog/conventional-changelog-angular/blob/master/convention.md), all lowercase in the subject:

```
fix(normalize): keep long runs of marks on one consonant linear

2.10.0's normalize took quadratic time on a consonant followed by a long
run of e or medial ra. ...
```

- **Type:** `feat`, `fix`, `perf`, `refactor`, `style` (whitespace and formatting only), `test`, `docs`, `build`, `ci` or `chore`.
- **Scope:** the part of the project, such as `converter`, `normalize`, `detector`, `syllBreak`, `build`, `eval`, `types`, `site`, `research` or `deps`. Documentation commits use `docs(<scope>)`.
- **Body:** plain English that says why the change is needed and what it changes for users, with counts where output changes. Reference issues with `Fixes #123` or `Closes #123`.
- **Dependencies:** add, update or remove a dependency in a commit of its own, with the `deps` scope and each package and version named, for example `fix(deps): myanmar-tools@>=1.1.2 <1.2.0`.

## Pull requests

Open pull requests against `main`. The [pull request template](.github/pull_request_template.md) asks for the results of the checks below. Code changes come with tests: a test that failed before the change, or new tests for new behaviour.

Merge with **Create a merge commit** when other branches are built on the pull request's commits (stacked pull requests, merged in order) or when one of its commits is listed in `.git-blame-ignore-revs`: squash and rebase merges give the commits new hashes, so the stacked branches no longer share history with `main` and the ignore file names a commit that is not there. CI's `dist only in releases` check fails on the second.

### One concern per pull request

Structure, speed and behaviour never share a pull request. A refactor changes no output. A speed-up changes no output. A behaviour change changes only the output it is about.

### Output stays byte-identical, unless the pull request is DELIBERATE

Knayi's output is used as data, so an unannounced change to it is a bug even when the new output is better.

- **Show that nothing changed:**
  - `npm run compare -- --base origin/main` reports 0 differences on every call form, including `fontConvert.debugging` (in 3.0 it compares the 2.x API, compat, of both copies), and the tests of the 3.0 API pass;
  - the contract matrix (`test/contract/api-matrix.test.js`, part of `npm test` and `npm run test:bun`) shows 0 changed cells;
  - both hold for compat and for the two builds that hold it, the script build's `knayi.compat` and `knayi-myscript-compat.min.mjs`, under Node and Bun, and compat still gives the 2.x reference's output (`npm run compare -- --base e5f6e24fa756f8f9c8d790f9a15ede85b135e8ae --head mjs:src/compat/index.js`). CI checks all of this.
- **The matrix records error messages only for errors knayi throws itself.** For a `TypeError` the engine raises by accident, it records only the class, because those messages differ between runtimes and builds. An error knayi throws on purpose carries a string `code` property; that is how the matrix tells the two apart. So throw it as `libraryError(code, message, Ctor)` from `src/core/errors.js`: `test/next/guards/errors.test.mjs` fails on any other `throw` in `src/`, apart from compat's `legacyTypeError()`, which reproduces 2.x's accidental TypeErrors.
- **A pull request that changes output on purpose** gets the `DELIBERATE` label and:
  - lists the exact counts it expects in its description, one `--expect form:set=n` per changed cell (a set is a corpus, such as `ksw`, or a generated or fuzz set, such as `generated.rows`), and the matrix cells that change. CI's compare job reads those lines. It skips the counts for sets CI does not read (mC4, the legacy `wikipedia-v1` sample, and every corpus when its cache is cold) and `all` totals; re-run the job after you add the label or change the counts;
  - commits the new matrix written by `npm run matrix:update`;
  - changes nothing else;
  - adds a line under "Output changes" in [CHANGELOG.md](CHANGELOG.md);
  - updates the README, the research note behind the rule, and the demo (`docs/index.html`) in the same pull request.

### Speed is measured, not assumed

- Run `npm run perf -- --base origin/main` and paste the ratios from a run on a quiet machine. Quote ratios, never absolute times from another run.
- A Node row more than 5% slower needs a written reason. A Bun row more than 10% slower needs one too.
- CI blocks a pull request only when an adversarial input's growth exponent goes above 1.3 under Node or Bun, or when a Node row is slower than the base branch by more than the CI threshold. The threshold is 20% for now. The `perf A/A` workflow (`.github/workflows/perf-aa.yml`, run by hand from the Actions tab) times the same copy against itself on GitHub's runners and prints the spread of the ratios and the highest growth exponent; its result will set the threshold, between 15 and 20%, and is recorded here. Smaller differences are noise on shared runners.
- A pull request that is slower on purpose, such as a correctness fix, gets the `SLOWER` label and says in its description why the cost is worth it. CI then lets a Node row take up to twice the base's time. Growth exponents still block.
- Every input must run in linear time. Super-linear time on any input is treated as a security bug (see [SECURITY.md](SECURITY.md)).

### Browser floor

The README promises Chrome 51, Edge 15, Firefox 54, Safari 10.1, Samsung Internet 5 and Opera 38: the first versions with all of ES2015 (decision 18). So the `dist/` builds must:

- parse as ES2015 (`test/syntax.test.js`), as `src/` does (`test/next/guards/floor.test.mjs`, with its list of later built-ins);
- avoid built-ins those browsers lack, such as `globalThis`, `Object.entries` or `String.prototype.padStart`, on a path they run (`test/dist-floor.test.js`, whose rules and allowlists are in `scripts/browser/floor.js`, runs both APIs of the script build without them). A read behind a `typeof` guard, or after an `if (typeof x === 'undefined') return`, is allowed;
- build no regex from a string that uses lookbehind, named groups, `\p{…}` or the `s` flag, since the syntax test cannot see inside strings (`test/regex-floor.test.js`);
- give the results of the ES module sources in Chromium, Firefox and WebKit (`npm run test:browser`).

### The public API stays stable

The entries of the exports map and what each exports, the types, the error codes, the `dist/` file names and the `knayi` global, the stage and rule ids of traces, and the output, with `OUTPUT_VERSION`, are 3.0's API. In `knayi-myscript/compat`, the 2.x exports and options, the shape of `legacyWinTables()`, the debug stage names and their order, and the regex-source labels in `matched_patterns` are 2.x API, kept as 2.x had them. [ARCHITECTURE.md](ARCHITECTURE.md#stable-surfaces) lists where each is defined.

- New exports and options may come in a minor version, with types, tests, and matrix rows for compat.
- A change to what a function returns is a deliberate pull request that raises `OUTPUT_VERSION` (`src/version.js`).
- Don't rewrite a regex of the Unicode to Zawgyi rows for style: its `.source` is compat's debugging output.

### Bundle size

Report the sizes from `npm run check:size` (each `dist/` file, with its per-module breakdown) and from `node scripts/next/size.mjs` (an import of each entry of the exports map, and of `normalize` alone), before and after. Each has a budget, about 5% above its size when 3.0 was packaged, proposed for the maintainer to confirm (docs/next/DESIGN.md §6.4): `npm test` fails above a `dist/` budget, and CI's `ReDoS, types and size` check above an import's. The scripts measure with Node's zlib at level 9, as 2.x's baseline was measured; the `gzip` command gives slightly different numbers for the same file, so quote only the scripts'.

### Readable code

Keep functions short (about 40 lines in the engine), and name helpers for what they do and for which script or font. Update [ARCHITECTURE.md](ARCHITECTURE.md) when a change makes it wrong.

### Reviews and labels

- If the pull request fixes an issue, say `Fixes #123` in its description.
- Reviews use GitHub's review feature, once the checks pass. Ask for small changes, but consider whether they really block the merge: lean towards "approve, with comments".
- Be kind. People who send a pull request have put time and care into it.

| Label | Use |
| --- | --- |
| `DELIBERATE` | The pull request changes output on purpose, with counts (above). |
| `SLOWER` | The pull request is slower on purpose, with the reason (above). |
| `bug` | The code or the documentation does not do what it is meant to. |
| `enhancement` | A new feature, or a change to behaviour that works as designed. |
| `dependencies` | Updates a dependency. |
| `question` | A question about using knayi. |
| `duplicate`, `invalid`, `wontfix` | Closed without a change, with a comment saying why. |
| `help wanted` | The maintainer would welcome a pull request. |

## Changing a rule

A rule is anything that decides output: a glyph table entry, an ordering rule, a typing fix, a detector signature, a break rule or a Unicode to Zawgyi rule. Rules change only with evidence.

1. **Write down the evidence** in the research note for that area (`research/zawgyi-to-unicode.md`, `research/normalize.md`, `research/normalize-idempotence.md`, `research/tie-policy.md`, `research/segmentation.md`, `research/win-fonts.md`), or in a new note:
   - the rule, with examples;
   - counts on the eval corpora: how many lines change per corpus, whether the counts are distinct lines or all lines, and which version of each corpus;
   - how many of the changed lines were checked by hand, and how many of those are right;
   - what Unicode Technical Note #11, myanmar-tools, Rabbit and human-typed text do, where they disagree;
   - open questions.
2. **Get the counts from compare** (see [above](#output-stays-byte-identical-unless-the-pull-request-is-deliberate)) and list them with `--expect`. Each count names its corpus.
3. **Add tests** with synthetic or hand-written strings (see the next section). Don't copy corpus lines into tests.
4. **Open one pull request per rule**, labelled `DELIBERATE`, with the CHANGELOG line, the README change and the demo change.

Where Unicode Technical Note #11 and the order people type disagree, knayi has followed UTN #11, for example `ခ်ျ` rather than the more often typed `ချ်`. The research notes record each such choice with its counts.

## Licences, fonts and test data

knayi is MIT-licensed, and contributions are accepted under the same licence.

- **Never copy another converter's tables, rules or code unless its licence is compatible with MIT.** Converters under LGPL or GPL, with no licence, or with an unclear one, are off limits: for example ThanLwinSoft (LGPL), kanaung/converter (an MIT licence file but a GPL header), and python-myanmar's Win table, which is a copy of ThanLwinSoft's. They may be run as outside references when you evaluate, never copied. [research/win-fonts.md](research/win-fonts.md) lists the converters and their licences. Build rules from the fonts' glyphs, keyboard layouts, Unicode's documents and your own checks, and say so in the research note.
- **Never commit or ship the Win fonts.** They are freeware with all rights reserved. Check the Win table with your own copy (`node scripts/eval/win-glyphs.mjs path/to/WININNWA.TTF`) and don't publish the page it writes.
- **Don't add a font to the repository or the site** unless its licence allows redistribution.
- **Test fixtures are synthetic or hand-written by default.** Short snippets are allowed from sources under CC BY, CC0 or Apache-2.0, listed in a `SOURCES` file next to the fixtures with the source, its licence and where the snippet is used.
- **Never commit corpus text from other sources, or anything derived from its lines,** Common Crawl text included: no line hashes, output snapshots or per-line counts keyed by text. Whole-file sha256 pins of a download, as in `scripts/eval/datasets.mjs`, are fine: they check the file and cannot rebuild any of it. mC4 and the unlicensed 2018 query log (`queries.tsv`) also stay out of CI: CI's corpus cache holds the other pinned corpora, and compare runs there with `--without mc4`. The eval scripts keep their downloads in `.eval-cache/`, which git ignores.
- **Dependencies:** no runtime dependencies. myanmar-tools stays an optional peer: the 3.0 API takes its detector as an object, and compat loads it from the working directory, as 2.x's ES module build did. Dev dependencies are fine when they are pinned to an exact version and their licence is checked.

## Release checklist

For the maintainer. A release is the only commit that changes `dist/`.

The checks block a merge only when the rules for `main` (Settings, Rules) require them. Require a pull request, with these checks passing, by the names GitHub shows: `Node 22.12`, `Node 24`, `Node 26`, `Bun`, `ReDoS, types and size`, `Browsers`, `Compare`, `Compat`, `Perf` and `dist only in releases`; and require branches to be up to date before merging, so that a pull request is tested on the `main` it lands on. Require review from code owners too (`.github/CODEOWNERS`). (2.x's rules named `Node 22` and the three `Smoke on Node` checks of Node 16, 18 and 20; 3.0 has neither.)

1. **Check `main`.** CI is green. Every pull request since the last tag that changed output has its line under "Output changes" in the Unreleased section of `CHANGELOG.md`.
2. **Branch** `release-X.Y.Z` from `main`.
3. **Bump the version** in `package.json` and `package-lock.json` (`npm version X.Y.Z --no-git-tag-version`), in `src/version.js` (`PACKAGE_VERSION`), and in the README (the version line and the unpkg URL). `test/next/codes.test.mjs` checks that `src/version.js` and `package.json` agree, and `test/package.test.js` that every entry reports that version.
4. **Update `CHANGELOG.md`:** rename Unreleased to `X.Y.Z` with the date, and start a new, empty Unreleased section.
5. **Rebuild `dist/`** with `npm run build`, check it with `npm run check:dist -- --fresh`, and run `KNAYI_DIST=dist npm test`, `npm run test:bun` and `npm run test:pack`. Note the sizes from `npm run check:size` and `node scripts/next/size.mjs` in the release notes.
6. **Commit** the version bump, `CHANGELOG.md` and `dist/` as `chore(release): X.Y.Z`.
7. **Rebuild the benchmark page** with `npm run bench:page`, after that commit: the page records the commit it measured and whether the code had uncommitted changes, so run before the commit, it would name the previous commit "with uncommitted changes". Commit `docs/benchmark.html` and `docs/benchmark.json` as `docs(benchmark): results for X.Y.Z`. Open the pull request with both commits, and merge it once CI passes.
8. **Wait for `main`'s CI, then tag.** The test run of the merge commit on `main` must pass first: its `dist only in releases` job builds `main` and compares the build with `dist/`, which catches a release pull request merged on an older `main`. Then tag the merge commit: `git tag -a vX.Y.Z -m X.Y.Z`, then `git push origin vX.Y.Z`.
9. **Publish to npm with provenance:** `npm publish --provenance` from a GitHub Actions job with `id-token: write`, since npm generates provenance only on a supported CI provider, not on a laptop. A prerelease goes to the `next` dist-tag (`--tag next`). Until a publish workflow exists, publish from a clean checkout of the tag, and say in the release notes that the release has no provenance.
10. **Pin the demo.** In `docs/index.html`, point the jsDelivr `<script>` at `@X.Y.Z` and set `integrity` to the hash of the published file:

    ```bash
    curl -sL https://cdn.jsdelivr.net/npm/knayi-myscript@X.Y.Z/dist/knayi-myscript.min.js | openssl dgst -sha384 -binary | openssl base64 -A
    ```

    It must equal the hash of the local build (`openssl dgst -sha384 -binary dist/knayi-myscript.min.js | openssl base64 -A`). Commit as `docs(site): pin the demo to X.Y.Z`. The demo calls the 2.x global: pinned to a 3.0 release, it needs `knayi = knayi.compat` after the tag, as `scripts/browser/a11y.spec.js` gives it, until it moves to the 3.0 API.
11. **Publish the GitHub release** for the tag, with the CHANGELOG section as its notes, and a "Before you upgrade" list when output changed. If a draft release for this version exists, check its target first: a draft made earlier points at an older commit, so set its target to the tag (or make it again from the tag).
12. **For a security fix,** say so in the CHANGELOG and the release notes, and publish the GitHub security advisory (see [SECURITY.md](SECURITY.md)).
