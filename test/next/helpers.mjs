// Shared helpers for the tests of the 3.0 core in src/ (docs/next/DESIGN.md §6.1).
//
// The tests are ES modules (D11). They reach the CommonJS 2.x code through createRequire, and the 2.x engine's
// private code only in the frozen copies of scripts/oracle/ (D19), never in library/: the 2.x line keeps
// rewriting library/'s private code, and a module test that read it would then test a different engine.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const settings = require('../../scripts/testing/fuzz-settings.js');
const { loadWithInternals } = require('../../scripts/testing/internals.js');

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SRC = path.join(ROOT, 'src');
export const ORACLE = path.join(ROOT, 'scripts', 'oracle');

// The 2.10 engine at the reference: storageOrder, typingFixes, signatures, normalize, toUnicode and fontDetect.
export const oracle = require('../../scripts/oracle/index.js');

// The named private bindings of a frozen 2.x file in scripts/oracle/, such as order, arrange, font,
// glyphsInTypedOrder, zeroAsWa, BREAK_RULES, COLLAPSE and convertRules. Each name must still be defined there.
export function internals(file, names) {
  const loaded = loadWithInternals(file, names, { dir: ORACLE }).__internals;
  for (const name of names) {
    assert.notEqual(loaded[name], undefined, 'scripts/oracle/' + file + ' defines no ' + name);
  }
  return loaded;
}

// A live module of library/, for compat's tests only: compat follows the 2.x line port by port (D19).
export function library(name) {
  return require('../../library/' + name);
}

// The fast-check arbitraries of the 2.x tests: unicodeText, zawgyiText, winText, codeUnits, burmeseText.
export const arb = require('../../scripts/testing/arbitraries.js');

// The fuzz settings, with both counts required (D23): the count for a pull request, and the most a long run
// may use. A long run takes min(prCount * KNAYI_FUZZ_SCALE, nightlyCount).
export const fuzz = Object.freeze({
  SEED: settings.SEED,
  SCALE: settings.SCALE,
  LONG_RUN: settings.LONG_RUN,
  runs(prCount, nightlyCount) {
    requireNightlyCount(nightlyCount);
    return settings.runs(prCount, nightlyCount);
  },
  check(property, prCount, regressions, nightlyCount) {
    requireNightlyCount(nightlyCount);
    settings.check(property, prCount, regressions, nightlyCount);
  }
});

function requireNightlyCount(nightlyCount) {
  if (!Number.isInteger(nightlyCount) || nightlyCount < 1) {
    throw new TypeError('test/next fuzz counts need a nightly count (docs/next/DESIGN.md D23)');
  }
}

// The acceptance gate (DESIGN.md §6.3) sets this to true. Until then, the checks that only bind at the gate (no
// NOT_BUILT stub left, every planned file present) skip, saying why.
export const AT_ACCEPTANCE_GATE = false;

// One synthetic probe per table row and per branch of a row, with what the 2.x API returned for it
// (test/fixtures/tables.json): { '<row name>': { probe, expect } }.
export function tableProbes() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'tables.json'), 'utf8')).cases;
}

// The adversarial shapes and single-character pumps of perf's growth check.
export { SHAPES, PUMPS } from '../../scripts/eval/lib/inputs.mjs';

// Every file under src/, as paths relative to src/ with forward slashes, sorted.
export function srcFiles() {
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) out.push(path.relative(SRC, full).split(path.sep).join('/'));
    }
  })(SRC);
  return out.sort();
}

// The text of a file under src/.
export function srcText(file) {
  return fs.readFileSync(path.join(SRC, file), 'utf8');
}

// U+XXXX, for messages.
export function hex(code) {
  return 'U+' + code.toString(16).toUpperCase().padStart(4, '0');
}

// A list of code points as ranges, for messages: 'U+1052-U+1055, U+A9E6'.
export function ranges(codes) {
  const out = [];
  for (const code of codes) {
    const last = out[out.length - 1];
    if (last && last[1] === code - 1) last[1] = code;
    else out.push([code, code]);
  }
  return out.map(([first, last]) => (first === last ? hex(first) : hex(first) + '-' + hex(last))).join(', ');
}
