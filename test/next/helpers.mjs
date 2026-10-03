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

// The files of scripts/oracle/ that are byte-for-byte copies of library/ at the reference, e5f6e24, with the blob
// id of each (git rev-parse e5f6e24fa756f8f9c8d790f9a15ede85b135e8ae:library/<file>): the whole 2.x library.
// guards/oracle.test.mjs checks the copies against them, and guards/citations.test.mjs lets src/ cite line numbers
// in these files only.
export const ORACLE_REFERENCE_BLOBS = Object.freeze({
  'contentGate.js': '814c5788446495b22daf70de8231a45802de0efb',
  'converter.js': 'f5b880b06a9355810b8bb8741dfe1d670f01ff03',
  'detector.js': '0e7318b4252f69309c2e253aaab32779b7099d1f',
  'globalOptions.js': '32560bc5a88dcefe10280423048b874bea5ed6f9',
  'normalization.js': '6e9b3d069722ba84fadc15b0ab1b99269da55ebb',
  'spellingCheck.js': 'd459ca3eaa9dbee5dc230741a31c97f3b7afc398',
  'storageOrder.js': 'b53e22e200e5296ad582e6c875a5d04a4e8019a2',
  'syllBreak.js': 'c18e8b3ec38c2a08bf5c12792f20b18aba37a523',
  'syllable.js': '3148df4efdf99317630b89684ed53205dacb2a1e',
  'truncate.js': 'ee08e1309d69f293d8a4ddccc2805cfc670b8366',
  'typingFixes.js': 'acf4f9e8e923933c2852082a362a1f7113a17ff2',
  'win.js': '145c84c6d2bb78b25cdb378c37bbbe027797b84a',
  'zawgyi.js': '3fbf65d78fa10373aee9a92ff4ef47b6ecd2ad7b'
});

// main.js at the reference (git rev-parse e5f6e24fa756f8f9c8d790f9a15ede85b135e8ae:main.js). scripts/oracle/main.js
// is that file with a header and with its requires of './library/<file>' made './<file>', since the copies sit next
// to it; guards/oracle.test.mjs undoes both and checks the blob id.
export const ORACLE_MAIN_BLOB = 'dac33b6bf49004dd24ad550deb63266b45119d86';

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

// A module of the 2.x library at the reference, for compat's tests: its frozen copy in scripts/oracle/, which a port
// of the 2.x line moves to the new reference (DESIGN.md §8).
export function library(name) {
  return require('../../scripts/oracle/' + name);
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

// The ten runs of marks of two combining classes that d170cd8 added to the 2.x growth shapes
// (scripts/eval/lib/inputs.mjs on the 2.x line), with the same ids. NFC has to reorder each run: String#normalize
// takes quadratic time on them, and core/nfc.js linear time, since W1 ported the 2.x helper (DESIGN.md §7.3). The
// growth checks of toNfc, normalize and the fonts run them with no exemption (§6.2 item 4, §8). When the merge of
// main brings them into SHAPES (§8), this list goes. make(n) returns about n UTF-16 units.
const fromCodes = (...codes) => String.fromCodePoint(...codes);
const repeatToLength = (unit, n) => unit.repeat(Math.max(1, Math.round(n / unit.length)));
export const NFC_RUNS = Object.freeze([
  ['ka + (dot below + virama) run', (n) => fromCodes(0x1000) + repeatToLength(fromCodes(0x1037, 0x1039), n)],
  ['(dot below + virama) run', (n) => repeatToLength(fromCodes(0x1037, 0x1039), n)],
  ['Win (virama + h) run', (n) => repeatToLength(fromCodes(0x1039) + 'h', n)],
  ['ka + (asat + dot below) run', (n) => fromCodes(0x1000) + repeatToLength(fromCodes(0x103A, 0x1037), n)],
  ['Latin a + (acute + dot below) run', (n) => 'a' + repeatToLength(fromCodes(0x301, 0x323), n)],
  ['Greek alpha + (ypogegrammeni + U+0344) run', (n) => fromCodes(0x3B1) + repeatToLength(fromCodes(0x345, 0x344), n)],
  ['Hebrew bet + (dagesh + qamats) run', (n) => fromCodes(0x5D1) + repeatToLength(fromCodes(0x5BC, 0x5B8), n)],
  ['Arabic beh + (shadda + fatha) run', (n) => fromCodes(0x628) + repeatToLength(fromCodes(0x651, 0x64E), n)],
  ['Tibetan ka + (U+0F73 + U+0F39) run', (n) => fromCodes(0xF40) + repeatToLength(fromCodes(0xF73, 0xF39), n)],
  ['x + (U+1D16D + U+1D165) run', (n) => 'x' + repeatToLength(fromCodes(0x1D16D, 0x1D165), n)]
].map(([id, make]) => Object.freeze({ id, make })));

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
