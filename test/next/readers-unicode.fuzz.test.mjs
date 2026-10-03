// Differential fuzz of reorderUnicode against 2.x arrangeUnicode in the frozen oracle (docs/next/DESIGN.md §6.1,
// §7.7; D19). Owner: W5 (engine-unicode).
//
// - fast-check strings over the reader's characters, Burmese text with typing slips and any UTF-16 units, after the
//   regressions of test/fuzz.test.js: 200,000 on a pull request, 1,000,000 nightly. The SEEN flags are checked on
//   the same strings.
// - seeded random strings over the Myanmar block and over the units the rules turn on, by the method of the plan's
//   SCR/performance/cls-check.js: 20,000 on a pull request, 400,000 nightly.
// - every line of every cached corpus, as it is and as NFC, when the corpus cache is complete (it is not read in CI,
//   and the test never downloads it: `node scripts/eval/datasets.mjs --fetch` fills it).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fc from 'fast-check';
import { reorderUnicode, SEEN } from '../../src/engine/unicodeReader.js';
import { isMyanmarBlock, isNfcSafe } from '../../src/script/codes.js';
import { oracle, arb, fuzz, ROOT } from './helpers.mjs';

const hex = (text) => Array.from(text, (ch) => ch.charCodeAt(0).toString(16).toUpperCase()).join(' ');
const arrangeUnicode = oracle.storageOrder.arrangeUnicode;

// The rare paths and long shapes that test/fuzz.test.js checks first (refactor plan §8.1).
const REGRESSIONS = [
  '\u101B\u103A\u1039\u1000\u102C', // kinzi written with ra
  '\u1000\u102C\u1039\u1000', // a stack after marks
  '\u1000\u200B\u1031\u1001', // a held zero-width space before a pending e
  '\u1047 \u102C', // a digit base across a space
  '\u101C\u1032\u1025\u103A\u1038', // u kept after a vowel sign (Pa'o)
  '\u1004\u103A\u1039\u1002\u1031 \u102F', // kinzi, then a space before a mark
  '\u1000' + '\u1031'.repeat(300),
  '\u1000' + '\u103C'.repeat(300),
  '\u1000' + '\u103A'.repeat(150) + '\u103C'.repeat(150),
  '\u1000' + '\u200B\u102C'.repeat(150)
].map((text) => [text]);

const strings = fc.oneof(
  { weight: 3, arbitrary: arb.unicodeText() },
  { weight: 1, arbitrary: arb.burmeseText },
  { weight: 1, arbitrary: arb.codeUnits }
);

// The SEEN flags the reader must return for a text.
function expectedSeen(text) {
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0x1025) seen |= SEEN.LETTER_U;
    else if (code >= 0x0300 && !isMyanmarBlock(code) && !isNfcSafe(code)) seen |= SEEN.NFC_UNSAFE;
  }
  return seen;
}

function assertSameAs2x(text) {
  const read = reorderUnicode(text);
  const want = arrangeUnicode(text);
  if (read.text !== want) assert.fail('input ' + hex(text) + '\n  next ' + hex(read.text) + '\n  2.x  ' + hex(want));
  if (read.seen !== expectedSeen(text)) assert.fail('seen ' + read.seen + ' on ' + hex(text));
}

// `count` strings of 1-14 units, alternately over the two alphabets of cls-check.js, from its linear congruential
// generator seeded with the fuzz seed.
function randomStrings(count) {
  let seed = fuzz.SEED >>> 0;
  const next = (n) => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed % n;
  };
  const block = [];
  for (let code = 0x1000; code <= 0x104F; code++) block.push(String.fromCharCode(code));
  block.push(' ', '\u00A0', '\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF', 'a', '.', ',', '́', '\u1075',
    '\u1087', '\uAA7B', '\u1033', '\uA9E5');
  const hot = ['\u1000', '\u1004', '\u101B', '\u1005', '\u1025', '\u1047', '\u1040', '\u103A', '\u1039', '\u1031',
    '\u103C', '\u103B', '\u103E', '\u102C', '\u102B', '\u102D', '\u102F', '\u1032', '\u1036', '\u1037', '\u1038', ' ',
    '\u200B', '\u1075', '\u102E', '\u1029'];
  const out = [];
  for (let n = 0; n < count; n++) {
    const alphabet = n % 2 ? block : hot;
    let text = '';
    const length = 1 + next(14);
    for (let j = 0; j < length; j++) text += alphabet[next(alphabet.length)];
    out.push(text);
  }
  return out;
}

// Every cached corpus as distinct lines, or a reason to skip when the cache lacks one (nothing is downloaded).
async function cachedCorpora() {
  const datasets = await import(pathToFileURL(path.join(ROOT, 'scripts', 'eval', 'datasets.mjs')).href);
  const missing = datasets.checkCache().filter((row) => row.status !== 'ok' && !/queries|legacy/.test(row.name));
  if (missing.length) return { skip: 'the corpus cache lacks ' + missing.map((row) => row.name).join(', ') };
  const data = await datasets.loadAll({ withLegacy: true });
  const sets = Object.assign({ flores: data.flores, wikipedia: data.wikipedia, okell: data.okell, mc4: data.mc4,
    waitzar: data.waitzar, google: data.google.flat(), cldr: data.cldr.flat() }, data.other, data.legacy);
  return { sets };
}

describe('reorderUnicode against 2.x arrangeUnicode (DESIGN.md §7.7)', () => {
  it('fast-check strings, after the regressions of test/fuzz.test.js', () => {
    fuzz.check(fc.property(strings, (text) => assertSameAs2x(text)), 200000, REGRESSIONS, 1000000);
  });

  it('seeded random strings over the Myanmar block and the units the rules turn on', () => {
    for (const text of randomStrings(fuzz.runs(20000, 400000))) assertSameAs2x(text);
  });

  it('every line of the cached corpora, as it is and as NFC', async (t) => {
    const corpora = await cachedCorpora();
    if (corpora.skip) {
      t.skip(corpora.skip);
      return;
    }
    let lines = 0;
    for (const set of Object.values(corpora.sets)) {
      for (const line of set) {
        assertSameAs2x(line);
        assertSameAs2x(line.normalize('NFC'));
        lines++;
      }
    }
    t.diagnostic(lines + ' corpus lines');
    assert.ok(lines > 50000, 'the corpora have ' + lines + ' lines');
  });
});
