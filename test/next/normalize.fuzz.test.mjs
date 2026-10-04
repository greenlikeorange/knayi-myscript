// Differential fuzz of normalizeText and traceNormalizeText against 2.x normalize in the frozen oracle
// (docs/next/DESIGN.md §3.10, §6.1, §7.7; D10, D19). Owner: W5 (engine-unicode).
//
// On every string, after the regressions of test/fuzz.test.js (100,000 on a pull request, 1,000,000 nightly):
// - normalizeText, with the gates and with every gate open, equals 2.x normalize;
// - runStages over NORMALIZE_STAGES gives the same text, with both gate settings: normalizeText calls the stages
//   directly (D10), and this keeps the two paths from drifting apart;
// - whenever the final-NFC gate stays closed, the result is NFC already, so the gate is sound;
// - traceNormalizeText gives the same text, and records the stages whose 2.x counterparts changed the text.
// The cached corpora are checked too, when the cache is complete.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fc from 'fast-check';
import { NORMALIZE_STAGES, normalizeText, traceNormalizeText } from '../../src/stages/normalize.js';
import { reorderUnicode, SEEN } from '../../src/engine/unicodeReader.js';
import { runStages, createTrace } from '../../src/core/rules.js';
import { oracle, arb, fuzz, ROOT } from './helpers.mjs';

const hex = (text) => Array.from(text, (ch) => ch.charCodeAt(0).toString(16).toUpperCase()).join(' ');

const REGRESSIONS = [
  '\u101B\u103A\u1039\u1000\u102C', // kinzi written with ra
  '\u1000\u102C\u1039\u1000', // a stack after marks
  '\u1000\u200B\u1031\u1001', // a held zero-width space before a pending e
  '\u1047 \u102C', // a digit base across a space
  '\u101C\u1032\u1025\u103A\u1038', // u kept after a vowel sign (Pa'o)
  '\u1004\u103A\u1039\u1002\u1031 \u102F', // kinzi, then a space before a mark
  '\u1025\u102D\u102E', // the typos make U+1025 U+102E, which the final NFC composes
  '\u1000\u103A\u1037', // NFC puts the dot below before the asat first
  'é', // no Myanmar: NFC only
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

// The 2.x stages of normalize (normalization.js:22-23), with the ids and labels of NORMALIZE_STAGES.
const ORACLE_STAGES = [
  ['nfc.input', 'NFC', (text) => text.normalize('NFC')],
  ['syllables', 'syllables', oracle.storageOrder.arrangeUnicode],
  ['typos', 'typos', oracle.typingFixes.typos],
  ['look-alikes', 'look-alikes', oracle.typingFixes.lookAlikes],
  ['nfc.final', 'NFC', (text) => text.normalize('NFC')]
];

// The records a trace of the 2.x stages holds: each stage that changed the text, with the text after it.
function oracleRecords(text) {
  const records = [];
  let current = text;
  for (const [id, label, run] of ORACLE_STAGES) {
    const next = run(current);
    if (next !== current) records.push({ id: id, label: label, text: next });
    current = next;
  }
  return records;
}

function same(actual, expected, what, input) {
  if (actual === expected) return;
  assert.fail(what + ' on ' + hex(input) + '\n  next ' + hex(actual) + '\n  2.x  ' + hex(expected));
}

function assertSameAs2x(text) {
  const want = oracle.normalize(text);
  same(normalizeText(text), want, 'normalizeText', text);
  same(normalizeText(text, { openAllGates: true }), want, 'normalizeText with every gate open', text);
  same(runStages(text, NORMALIZE_STAGES, { openAllGates: false, seen: 0 }, null), want, 'runStages', text);
  same(runStages(text, NORMALIZE_STAGES, { openAllGates: true, seen: 0 }, null), want, 'runStages, gates open', text);
  const gateClosed = (reorderUnicode(text.normalize('NFC')).seen & (SEEN.LETTER_U | SEEN.NFC_UNSAFE)) === 0;
  if (gateClosed) same(want.normalize('NFC'), want, 'the closed final-NFC gate', text);
  const trace = createTrace();
  same(traceNormalizeText(text, trace), want, 'traceNormalizeText', text);
  assert.deepEqual(trace.records, oracleRecords(text), 'the trace of ' + hex(text));
}

async function cachedCorpora() {
  const datasets = await import(pathToFileURL(path.join(ROOT, 'scripts', 'eval', 'datasets.mjs')).href);
  const missing = datasets.checkCache().filter((row) => row.status !== 'ok' && !/queries|legacy/.test(row.name));
  if (missing.length) return { skip: 'the corpus cache lacks ' + missing.map((row) => row.name).join(', ') };
  const data = await datasets.loadAll({ withLegacy: true });
  const sets = Object.assign({ flores: data.flores, wikipedia: data.wikipedia, okell: data.okell, mc4: data.mc4,
    waitzar: data.waitzar, google: data.google.flat(), cldr: data.cldr.flat() }, data.other, data.legacy);
  return { sets };
}

describe('normalizeText against 2.x normalize (DESIGN.md §7.7)', () => {
  it('fast-check strings, after the regressions of test/fuzz.test.js', () => {
    fuzz.check(fc.property(strings, (text) => assertSameAs2x(text)), 100000, REGRESSIONS, 1000000);
  });

  it('every line of the cached corpora', async (t) => {
    const corpora = await cachedCorpora();
    if (corpora.skip) {
      t.skip(corpora.skip);
      return;
    }
    let lines = 0;
    for (const set of Object.values(corpora.sets)) {
      for (const line of set) {
        const want = oracle.normalize(line);
        same(normalizeText(line), want, 'normalizeText', line);
        same(normalizeText(line, { openAllGates: true }), want, 'normalizeText with every gate open', line);
        lines++;
      }
    }
    t.diagnostic(lines + ' corpus lines');
  });
});
