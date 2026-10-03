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

You need Node.js 22 or newer to build and test (`.nvmrc` has 24), and [Bun](https://bun.sh) for `npm run test:bun` and `npm run test:pack` (CI uses Bun 1.4.2).

```bash
git clone https://github.com/greenlikeorange/knayi-myscript.git
cd knayi-myscript
npm ci
npm test
npm run test:bun
npm run test:pack
```

- **Run `npm ci` in every clone and every git worktree.** Don't share or symlink `node_modules` between them: a shared one can miss dev dependencies, and then a test such as `test/syntax.test.js`, which needs `acorn`, cannot load.
- **`npm test` rebuilds `dist/`** before it runs the tests. Don't commit those files: `dist/` changes only in release commits, because jsDelivr serves `main`'s `dist/` to sites that load `@master`. Run `git restore dist` before you commit.
- **Indentation is two spaces.** `.editorconfig` still says tabs and some older files use them; that is being fixed in one whitespace-only change. Don't reformat lines you don't otherwise change.
- **Never push a branch named `master`.** The default branch is `main`. GitHub redirects `master` to `main` only while no `master` branch exists, and jsDelivr links to `@master` depend on that redirect.

`npm run eval` and `npm run bench` download their data into `.eval-cache/` on first use; see [scripts/eval/README.md](scripts/eval/README.md).

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

### One concern per pull request

Structure, speed and behaviour never share a pull request. A refactor changes no output. A speed-up changes no output. A behaviour change changes only the output it is about.

### Output stays byte-identical, unless the pull request is DELIBERATE

Knayi's output is used as data, so an unannounced change to it is a bug even when the new output is better.

- **Show that nothing changed:**
  - `npm run compare -- --base origin/main` reports 0 differences on every call form, including `fontConvert.debugging`;
  - the contract matrix (`test/contract/api-matrix.test.js`) shows 0 changed cells;
  - both hold for `main.js`, the `.mjs` build and `min.js`, under Node and Bun.
- **The matrix records error messages only for errors knayi throws itself.** For a `TypeError` the engine raises by accident, it records only the class, because those messages differ between runtimes and builds.
- **A pull request that changes output on purpose** gets the `DELIBERATE` label and:
  - lists the exact counts it expects, as `--expect form:corpus=n` for compare, and the matrix cells that change;
  - changes nothing else;
  - adds a line under "Output changes" in [CHANGELOG.md](CHANGELOG.md);
  - updates the README, the research note behind the rule, and the demo (`docs/index.html`) in the same pull request.

### Speed is measured, not assumed

- Run `npm run perf -- --base origin/main` and paste the ratios from a run on a quiet machine. Quote ratios, never absolute times from another run.
- A Node row more than 5% slower needs a written reason. A Bun row more than 10% slower needs one too.
- CI blocks a pull request only when an adversarial input's growth exponent goes above 1.3, or when a Node row is slower by more than the CI threshold (15–20%, set from an A/A run on GitHub's runners). Smaller differences are noise on shared runners.
- Every input must run in linear time. Super-linear time on any input is treated as a security bug (see [SECURITY.md](SECURITY.md)).

### Browser floor

The README promises Chrome 49, Edge 14, Firefox 34, Safari 10, Samsung Internet 5 and Opera 36. So the `dist/` builds must:

- parse as ES2015 (`test/syntax.test.js`);
- avoid syntax and built-ins those browsers lack: no `let`, `const`, `for…of` or `class`, and no newer built-in, such as `TypedArray.prototype.fill`, on a path they run;
- build no regex from a string that uses lookbehind, named groups, `\p{…}` or the `s` flag, since the syntax test cannot see inside strings.

### The 2.x API stays stable

The exports, `index.d.ts`, the `dist/` file names and the `knayi` global, the option keys, the deep path `library/converter`, the shape of `win.tables`, the debug stage names and their order, and the regex-source labels in `matched_patterns` are 2.x API. [ARCHITECTURE.md](ARCHITECTURE.md#stable-surfaces) lists where each is defined.

- New exports and options may come in a minor version, with types, matrix rows and tests.
- A library file that moves leaves a one-line shim at its old path.
- Don't rewrite a regex literal in `syllable.js` for style: its `.source` is debugging output.

### Bundle size

Report the size of `dist/knayi-myscript.min.js` after `gzip -9`, before and after. The 2.x refactor may add at most 1 KB in total over the 2.10 baseline of 9,830 bytes.

### Readable code

Keep functions short (about 40 lines in the engine), and name helpers for what they do and for which script or font. Update [ARCHITECTURE.md](ARCHITECTURE.md) when a change makes it wrong.

### Reviews and labels

- If the pull request fixes an issue, say `Fixes #123` in its description.
- Reviews use GitHub's review feature, once the checks pass. Ask for small changes, but consider whether they really block the merge: lean towards "approve, with comments".
- Be kind. People who send a pull request have put time and care into it.

| Label | Use |
| --- | --- |
| `DELIBERATE` | The pull request changes output on purpose, with counts (above). |
| `bug` | The code or the documentation does not do what it is meant to. |
| `enhancement` | A new feature, or a change to behaviour that works as designed. |
| `dependencies` | Updates a dependency. |
| `question` | A question about using knayi. |
| `duplicate`, `invalid`, `wontfix` | Closed without a change, with a comment saying why. |
| `help wanted` | The maintainer would welcome a pull request. |

## Changing a rule

A rule is anything that decides output: a glyph table entry, an ordering rule, a typing fix, a detector signature, a break rule or a Unicode to Zawgyi rule. Rules change only with evidence.

1. **Write down the evidence** in the research note for that area (`research/zawgyi-to-unicode.md`, `research/normalize.md`, `research/win-fonts.md`), or in a new note:
   - the rule, with examples;
   - counts on the eval corpora: how many lines change per corpus, whether the counts are distinct lines or all lines, and which version of each corpus;
   - how many of the changed lines were checked by hand, and how many of those are right;
   - what Unicode Technical Note #11, myanmar-tools, Rabbit and human-typed text do, where they disagree;
   - open questions.
2. **Get the counts from compare.** Run `npm run compare -- --base origin/main` and list its counts with `--expect`. Each count names its corpus.
3. **Add tests** with synthetic or hand-written strings (see the next section). Don't copy corpus lines into tests.
4. **Open one pull request per rule**, labelled `DELIBERATE`, with the CHANGELOG line, the README change and the demo change.

Where Unicode Technical Note #11 and the order people type disagree, knayi has followed UTN #11, for example `ခ်ျ` rather than the more often typed `ချ်`. The research notes record each such choice with its counts.

## Licences, fonts and test data

knayi is MIT-licensed, and contributions are accepted under the same licence.

- **Never copy another converter's tables, rules or code unless its licence is compatible with MIT.** Converters under LGPL or GPL, with no licence, or with an unclear one, are off limits: for example ThanLwinSoft (LGPL), kanaung/converter (an MIT licence file but a GPL header), and python-myanmar's Win table, which is a copy of ThanLwinSoft's. They may be run as outside references when you evaluate, never copied. [research/win-fonts.md](research/win-fonts.md) lists the converters and their licences. Build rules from the fonts' glyphs, keyboard layouts, Unicode's documents and your own checks, and say so in the research note.
- **Never commit or ship the Win fonts.** They are freeware with all rights reserved. Check the Win table with your own copy (`node scripts/eval/win-glyphs.mjs path/to/WININNWA.TTF`) and don't publish the page it writes.
- **Don't add a font to the repository or the site** unless its licence allows redistribution.
- **Test fixtures are synthetic or hand-written by default.** Short snippets are allowed from sources under CC BY, CC0 or Apache-2.0, listed in a `SOURCES` file next to the fixtures with the source, its licence and where the snippet is used.
- **Never commit corpus text or digests of it** from other sources. mC4 and other Common Crawl text, and the unlicensed 2018 query log (`queries.tsv`), stay out of the repository and out of CI. The eval scripts keep their downloads in `.eval-cache/`, which git ignores.
- **Dependencies:** no runtime dependencies in 2.x (myanmar-tools stays an optional peer). Dev dependencies are fine when they are pinned to an exact version and their licence is checked.

## Release checklist

For the maintainer. A release is the only commit that changes `dist/`.

1. **Check `main`.** CI is green. Every pull request since the last tag that changed output has its line under "Output changes" in the Unreleased section of `CHANGELOG.md`.
2. **Branch** `release-X.Y.Z` from `main`.
3. **Bump the version** in `package.json` and `package-lock.json` (`npm version X.Y.Z --no-git-tag-version`), in `main.js` (`const version`), and in the README (the version line and the unpkg URL). `test/package.test.js` checks that `main.js` and `package.json` agree.
4. **Update `CHANGELOG.md`:** rename Unreleased to `X.Y.Z` with the date, and start a new, empty Unreleased section.
5. **Rebuild `dist/`** with `npm run build`, and run `npm test`, `npm run test:bun` and `npm run test:pack`. Check the `min.js` size after `gzip -9`.
6. **Rebuild the benchmark page** with `npm run bench:page`, and commit `docs/benchmark.html` and `docs/benchmark.json`.
7. **Commit** as `chore(release): X.Y.Z`, open the pull request, and merge it once CI passes.
8. **Tag** the merge commit on `main`: `git tag -a vX.Y.Z -m X.Y.Z`, then `git push origin vX.Y.Z`.
9. **Publish to npm with provenance:** `npm publish --provenance` from a GitHub Actions job with `id-token: write`, since npm generates provenance only on a supported CI provider, not on a laptop. A prerelease goes to the `next` dist-tag (`--tag next`). Until a publish workflow exists, publish from a clean checkout of the tag, and say in the release notes that the release has no provenance.
10. **Pin the demo.** In `docs/index.html`, point the jsDelivr `<script>` at `@X.Y.Z` and set `integrity` to the hash of the published file:

    ```bash
    curl -sL https://cdn.jsdelivr.net/npm/knayi-myscript@X.Y.Z/dist/knayi-myscript.min.js | openssl dgst -sha384 -binary | openssl base64 -A
    ```

    It must equal the hash of the local build (`openssl dgst -sha384 -binary dist/knayi-myscript.min.js | openssl base64 -A`). Commit as `docs(site): pin the demo to X.Y.Z`.
11. **Publish the GitHub release** for the tag, with the CHANGELOG section as its notes, and a "Before you upgrade" list when output changed.
12. **For a security fix,** say so in the CHANGELOG and the release notes, and publish the GitHub security advisory (see [SECURITY.md](SECURITY.md)).
