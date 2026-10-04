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
import { SHAPES, PUMPS } from '../../scripts/eval/lib/inputs.mjs';

const require = createRequire(import.meta.url);
const settings = require('../../scripts/testing/fuzz-settings.js');
const { loadWithInternals } = require('../../scripts/testing/internals.js');

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SRC = path.join(ROOT, 'src');
export const ORACLE = path.join(ROOT, 'scripts', 'oracle');

// The files of scripts/oracle/ that are byte-for-byte copies of library/ at e5f6e24, 2.10.0's code and the 2.x
// reference the core was built against, with the blob id of each (git rev-parse
// e5f6e24fa756f8f9c8d790f9a15ede85b135e8ae:library/<file>): the whole 2.x library, frozen as the 2.10 engine.
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

// main.js at e5f6e24 (git rev-parse e5f6e24fa756f8f9c8d790f9a15ede85b135e8ae:main.js). scripts/oracle/main.js is
// that file with a header and with its requires of './library/<file>' made './<file>', since the copies sit next to
// it; guards/oracle.test.mjs undoes both and checks the blob id.
export const ORACLE_MAIN_BLOB = 'dac33b6bf49004dd24ad550deb63266b45119d86';

// The 2.x reference that compat follows (docs/next/DESIGN.md §1.1, §8): the commit of the 2.x line whose output
// compat must give, until v2.11.0 is tagged and the tag takes its place. scripts/reference/ holds its main.js and
// library/, byte for byte, with the blob id of each (git ls-tree <commit> main.js library/);
// guards/reference.test.mjs checks the copies against them. compat's tests, the contract matrix and the table rows
// read these copies; compare (scripts/eval/compare.mjs) reads the commit itself.
export const REFERENCE = path.join(ROOT, 'scripts', 'reference');
export const REFERENCE_COMMIT = '8923365919943a84826e31649d094e1aa5ff285a';
export const REFERENCE_BLOBS = Object.freeze({
  'main.js': 'dd6738b04977ee8d2328adcab8f87031162ee69c',
  'library/contentGate.js': '5d32ed12454d54de58ed8c28cceb0cf325cfa4b2',
  'library/converter.d.ts': 'ed71d106d61a4e03c0bd0f6b4d2e329bf1154150',
  'library/converter.js': 'a3ddeb459da5c4756ef036a0703a3315fca55432',
  'library/detection.js': '74abe794483798c38f6c87e811141c97caccaf64',
  'library/detector.js': '2f2e5341ae122ba2db2717f6b0c03b8db049d196',
  'library/globalOptions.js': '0814db29ebe08c3b4ca05b295edc39766df00ba7',
  'library/nfc.js': 'c1ee0bf00cd11a801cf3ce683b871a986164093a',
  'library/normalization.js': 'e340e429707e0eb0b1e8b529b8b239bff54fc8da',
  'library/spellingCheck.js': 'c2698e3dfdb7fc45bdb9b93d71c1d79b6ad4aa0b',
  'library/storageOrder.js': 'b0976d738ae79f33da54b949b91436ece188e21c',
  'library/syllBreak.js': '885603f66386a16c8d02e1a72ae19af9257825f0',
  'library/syllable.js': '3d884c35cccf061068b213809738cee237f5ac6b',
  'library/syllableRules.js': '3c0d5bf1b64126004485c6fc059c03f23baadb4e',
  'library/truncate.js': '79f39faa07e07c9361c68bbd0b436bf921e1342b',
  'library/typingFixes.js': 'a7d6a16814b2a92f43ebfc154a45c5975018fa61',
  'library/unicodeParser.js': '632e2c802ef3d14fb2065f78be58073aa4ff726f',
  'library/win.js': '2784bb9cc25c07ed7d251e7cd5a692b1e60a1365',
  'library/zawgyi.js': 'b26a989f6dbc1f238a13bef5c00dc867c1dd7341'
});

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

// A module of the 2.x library at the 2.x reference, for compat's tests: its copy in scripts/reference/library/,
// which a port of the 2.x line moves to the new reference (DESIGN.md §8). The core's module tests read the frozen
// 2.10 engine of scripts/oracle/ instead (internals, oracle).
export function library(name) {
  return require('../../scripts/reference/library/' + name);
}

// The fast-check arbitraries of the 2.x tests: unicodeText, zawgyiText, winText, codeUnits, burmeseText.
export const arb = require('../../scripts/testing/arbitraries.js');

// A test of a 2.x change next does not have yet, it(name, pendingPort(commit, fn)): it passes while fn fails
// (scripts/testing/pending-port.js).
export const { pendingPort } = require('../../scripts/testing/pending-port.js');

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
export { SHAPES, PUMPS };

// The ten runs of marks of two combining classes that d170cd8 added to the 2.x growth shapes, in SHAPES since the
// merge of the 2.x line (DESIGN.md §8). NFC has to reorder each run: String#normalize takes quadratic time on them,
// and core/nfc.js linear time, since W1 ported the 2.x helper (§7.3). Every growth check meets them in SHAPES, with
// no exemption (§6.2 item 4); core-nfc.timing.mjs also times them alone through toNfc. make(n) returns about n
// UTF-16 units.
const NFC_RUN_IDS = ['ka + (dot below + virama) run', '(dot below + virama) run', 'Win (virama + h) run',
  'ka + (asat + dot below) run', 'Latin a + (acute + dot below) run', 'Greek alpha + (ypogegrammeni + U+0344) run',
  'Hebrew bet + (dagesh + qamats) run', 'Arabic beh + (shadda + fatha) run', 'Tibetan ka + (U+0F73 + U+0F39) run',
  'x + (U+1D16D + U+1D165) run'];
export const NFC_RUNS = Object.freeze(NFC_RUN_IDS.map((id) => {
  const shape = SHAPES.find((s) => s.id === id);
  assert.ok(shape, 'SHAPES (scripts/eval/lib/inputs.mjs) has no shape ' + id);
  return shape;
}));

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
