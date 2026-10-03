// Differential tests of src/unicodeToZawgyi.js against 2.x (docs/next/DESIGN.md §6.1, §6.2 item 2, §7.9). 2.x is
// convertText(collapseMarks(x, 'unicode'), 'unicode', 'zawgyi') in the frozen scripts/oracle/syllable.js (D19).
//
// 1. unicodeToZawgyi on fast-check strings, after the regressions: 200,000 on a pull request, 1M nightly (D23).
// 2. traceUnicodeToZawgyi, read back as 2.x's debug log (§3.9, D4): 50,000, and 300,000 nightly.
// 3. 2.x's public call fontConvert(x, 'zawgyi', 'unicode') and its fontConvert.debugging, with the call's preamble
//    restated on the oracle (asFontConvert), on the inputs of npm run compare (scripts/eval/lib/inputs.mjs): every
//    generated set, the README and ARCHITECTURE strings and the table probes among them, the seeded fuzz sets, and
//    every cached corpus. A corpus missing from the corpus cache is left out, never downloaded; npm run compare
//    fills the cache.
// Every output must be the same.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { unicodeToZawgyi } from '../../src/unicodeToZawgyi.js';
import { arb, fuzz } from './helpers.mjs';
import {
  TWO_X_ROWS, twoXUnicodeToZawgyi, twoXDebugLog, traceAsDebugLog, asFontConvert
} from './unicodeToZawgyi.oracle.mjs';
import { generatedSets, fuzzSets, corpusSets, DEFAULT_SEED } from '../../scripts/eval/lib/inputs.mjs';
import { checkCache, CORPORA } from '../../scripts/eval/datasets.mjs';

// Strings per property: on a pull request, and the most a nightly run uses (D23).
const COUNT = { convert: [200000, 1000000], trace: [50000, 300000] };

const codes = (text) => Array.from(text, (c) => c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');

// Every unit a 2.x row names, in a pattern (ranges included) or in a replacement, so that random strings reach
// each row and its neighbours; and a few units around them: a space, a line break, zero-width space, an
// independent vowel, a digit and a Latin letter.
function rowUnits() {
  const units = new Set();
  for (const { rule: [re, to] } of TWO_X_ROWS) {
    const escapes = /\\u([0-9a-fA-F]{4})(?:-\\u([0-9a-fA-F]{4}))?/g;
    for (let m = escapes.exec(re.source); m; m = escapes.exec(re.source)) {
      const first = parseInt(m[1], 16);
      for (let code = first; code <= (m[2] ? parseInt(m[2], 16) : first); code++) units.add(code);
    }
    for (const ch of to.replace(/\$\d/g, '')) units.add(ch.charCodeAt(0));
  }
  [0x20, 0x0A, 0x200B, 0x1025, 0x1040, 0x61].forEach((code) => units.add(code));
  return [...units].sort((a, b) => a - b).map((code) => String.fromCharCode(code));
}

// Short strings over the units of the rows, Burmese syllables with typing slips, the 2.x fuzz alphabet, and any
// UTF-16 units (scripts/testing/arbitraries.js).
const text = fc.oneof(
  { weight: 3, arbitrary: fc.string({ unit: fc.constantFrom(...rowUnits()), minLength: 1, maxLength: 16 }) },
  { weight: 3, arbitrary: arb.burmeseText },
  { weight: 1, arbitrary: arb.unicodeText(16) },
  { weight: 1, arbitrary: arb.codeUnits }
);

// test/fuzz.test.js's Unicode regressions, checked first, then the rows' own hard cases.
const REGRESSIONS = [
  '\u101B\u103A\u1039\u1000\u102C', // kinzi written with ra
  '\u1000\u102C\u1039\u1000', // a stack after marks
  '\u1000\u200B\u1031\u1001', // a zero-width space before e
  '\u1047 \u102C', // a digit, a space, a mark
  '\u101C\u1032\u1025\u103A\u1038', // u after a vowel sign (Pa'o)
  '\u1004\u103A\u1039\u1002\u1031 \u102F', // kinzi, then a space before a mark
  '\u1000' + '\u1031'.repeat(300),
  '\u1000' + '\u103C'.repeat(300),
  '\u1000' + '\u103A'.repeat(150) + '\u103C'.repeat(150),
  '\u1000' + '\u200B\u102C'.repeat(150),
  '\u1000\u1039\u1008', // stacked jha: no row reads it, so 2.x leaves the virama, which Zawgyi draws as asat
  '\u1004\u103A\u1039\u1004\u103A\u1039\u1000', // kinzi twice
  '\u100D\u1039\u100D\u1039\u100E', // two joined consonants that overlap
  '\u100B\u1039\u100B\u1039\u100C',
  '\u1009\u103C\u1009\u103C', // medial ra on nya, twice: a repeat row with two matches
  '\u1000\u103C\u103D\u102D\u1000\u103C\u103D\u102E', // the wide ra cut at both ends, twice
  '\u1064\u1000\u1064\u1000\u102D', // Zawgyi kinzi glyphs in the input
  ' \u1000\u103C\u1031\u102C\u1004\u103A ' // spaces around a syllable
].map((x) => [x]);

// Fails with the first input on which the core and 2.x differ.
function same(actual, expected, input) {
  if (actual === expected) return;
  assert.fail('input ' + codes(input) + '\n  next ' + codes(actual) + '\n  2.x  ' + codes(expected));
}

// 2.x's public call and its debugging form on each line of `sets`, against the same preamble around the core.
// Returns the differences, at most five per set, and the number of lines.
function compareCallForms(sets) {
  const differences = [];
  let lines = 0;
  for (const set of sets) {
    let inSet = 0;
    for (const line of set.lines) {
      lines++;
      const converted = asFontConvert(line, unicodeToZawgyi) === asFontConvert(line, twoXUnicodeToZawgyi);
      const debugged = converted && assertDeepEqualQuietly(
        asFontConvert(line, (t) => traceAsDebugLog(t).log), asFontConvert(line, twoXDebugLog));
      if (!(converted && debugged) && inSet++ < 5) {
        differences.push(set.id + (converted ? ' (debugging)' : '') + ': ' + codes(line));
      }
    }
  }
  return { differences, lines };
}

function assertDeepEqualQuietly(a, b) {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

// The corpora whose files the cache holds, intact (scripts/eval/datasets.mjs checkCache): corpusSets would
// download the others. FLORES is read from its two extracted files, CLDR with Google's file, and the Hugging Face
// samples from hf-<id>.
function cachedCorpora() {
  const rows = checkCache();
  const ok = (name) => rows.some((row) => row.name === name && row.status === 'ok');
  const flores = rows.filter((row) => row.name.startsWith('flores/'));
  const cached = {
    flores: flores.length > 0 && flores.every((row) => row.status === 'ok'),
    cldr: ok('cldr') && ok('google')
  };
  return CORPORA.filter((id) => (id in cached ? cached[id] : ok(id) || ok('hf-' + id)));
}

describe('unicodeToZawgyi against 2.x (DESIGN.md §7.9)', () => {
  it('converts fuzzed strings as 2.x does', () => {
    fuzz.check(fc.property(text, (x) => same(unicodeToZawgyi(x), twoXUnicodeToZawgyi(x), x)),
      COUNT.convert[0], REGRESSIONS, COUNT.convert[1]);
  });

  it('traces fuzzed strings as 2.x\'s debug log', () => {
    fuzz.check(fc.property(text, (x) => {
      const { log, result } = traceAsDebugLog(x);
      assert.deepStrictEqual(log, twoXDebugLog(x), 'input ' + codes(x));
      same(result, twoXUnicodeToZawgyi(x), x);
    }), COUNT.trace[0], REGRESSIONS, COUNT.trace[1]);
  });

  it('gives 2.x\'s fontConvert and fontConvert.debugging output on compare\'s generated and fuzz sets', (t) => {
    const seeds = [...new Set([DEFAULT_SEED, fuzz.SEED])];
    const sets = generatedSets().concat(...seeds.map((seed) => fuzzSets({ seed })));
    const { differences, lines } = compareCallForms(sets);
    assert.deepEqual(differences, []);
    const what = sets.map((s) => s.id).join(', ') + '; seeds ' + seeds.join(', ');
    if (t.diagnostic) t.diagnostic(lines + ' lines of ' + what);
  });

  const corpora = cachedCorpora();
  it('gives 2.x\'s fontConvert and fontConvert.debugging output on every cached corpus', {
    skip: corpora.length === 0 && 'no corpus is cached (npm run compare fills the cache)'
  }, async (t) => {
    const { sets } = await corpusSets({ without: CORPORA.filter((id) => corpora.indexOf(id) === -1) });
    const { differences, lines } = compareCallForms(sets);
    assert.deepEqual(differences, []);
    if (t.diagnostic) t.diagnostic(lines + ' distinct lines of ' + sets.map((s) => s.id).join(', '));
  });
});
