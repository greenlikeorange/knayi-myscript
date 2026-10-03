<!--
One concern per pull request: structure, speed or behaviour. CONTRIBUTING.md explains each check below.
Tick a box only when its output is pasted below, or write why it does not apply.
-->

## What and why



Fixes #

## Checks

- [ ] `npm test`, `npm run test:bun` and `npm run test:pack` pass.
- [ ] **Compare:** `npm run compare -- --base origin/main` shows 0 differences on every call form, or only the `--expect` counts listed under "Output changes".
- [ ] **Contract matrix:** 0 changed cells, or only the cells listed under "Output changes".
- [ ] **Perf:** ratios from `npm run perf -- --base origin/main` on a quiet machine are pasted below. Any Node row more than 5% slower, or Bun row more than 10% slower, has a reason.
- [ ] **Bundle:** `dist/knayi-myscript.min.js` after `gzip -9`, before → after, in bytes.
- [ ] **CHANGELOG.md:** a line under Unreleased, in "Output changes" if output changes.
- [ ] **Output changes:** none, or this pull request has the `DELIBERATE` label, and the README, the research note and the demo (`docs/index.html`) are updated.
- [ ] `dist/` is unchanged (it changes only in release commits).
- [ ] ARCHITECTURE.md still describes the code.

## Output changes

<!-- "None", or each change: the call form, the exact counts (`--expect form:corpus=n`), the matrix cells, and an example. -->

## Compare and matrix

```
```

## Perf ratios and bundle size

```
```
