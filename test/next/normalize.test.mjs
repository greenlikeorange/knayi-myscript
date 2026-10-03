// src/stages/normalize.js: NORMALIZE_STAGES, normalizeText and traceNormalizeText (docs/next/DESIGN.md §2.3,
// §3.10, §7.7). Owner: W5 (engine-unicode).
//
// The stage list, the two gates, the trace, the normalize examples of README.md and ARCHITECTURE.md, and the table
// probes of test/fixtures/tables.json, each against the frozen 2.x oracle (D19). normalize.fuzz.test.mjs compares
// normalizeText with 2.x on fuzzed strings.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as acorn from 'acorn';
import { NORMALIZE_STAGES, normalizeText, traceNormalizeText } from '../../src/stages/normalize.js';
import { createTrace } from '../../src/core/rules.js';
import { toNfc } from '../../src/core/nfc.js';
import { fixTypos, fixLookAlikes } from '../../src/rules/typingFixes.js';
import { oracle, ROOT, tableProbes } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { readExamples } = require('../../scripts/testing/readme-examples.js');

const hex = (text) => Array.from(text, (ch) => ch.charCodeAt(0).toString(16).toUpperCase()).join(' ');

// normalizeText's text, checked against 2.x first, with the gates and with every gate open.
function normalized(text) {
  const want = oracle.normalize(text);
  assert.equal(hex(normalizeText(text)), hex(want), 'normalizeText differs from 2.x on ' + hex(text));
  assert.equal(hex(normalizeText(text, { openAllGates: true })), hex(want), 'openAllGates, on ' + hex(text));
  return normalizeText(text);
}

// The examples of `file` whose call is knayi.normalize('...'): [argument, expected value].
function normalizeExamples(file) {
  const literal = (code) => {
    const node = acorn.parseExpressionAt(code, 0, { ecmaVersion: 'latest' });
    assert.equal(node.type, 'Literal', file + ': ' + code);
    return node.value;
  };
  return readExamples(fs.readFileSync(path.join(ROOT, file), 'utf8'), file)
    .filter((example) => /^knayi\.normalize\(/.test(example.code))
    .map((example) => {
      const call = acorn.parseExpressionAt(example.code, 0, { ecmaVersion: 'latest' });
      assert.equal(call.arguments.length, 1, file + ': ' + example.code);
      return [literal(example.code.slice(call.arguments[0].start, call.arguments[0].end)), literal(example.expected)];
    });
}

// Counts the calls of String#normalize that fn makes: toNfc is the only place src/ calls it (D20).
function nfcCalls(fn) {
  const normalize = String.prototype.normalize;
  let calls = 0;
  String.prototype.normalize = function () {
    calls++;
    return normalize.apply(this, arguments);
  };
  try {
    fn();
  } finally {
    String.prototype.normalize = normalize;
  }
  return calls;
}

describe('NORMALIZE_STAGES (DESIGN.md §2.3)', () => {
  it('is NFC, syllables, typos, look-alikes and a gated NFC, with 2.x\'s order and labels', () => {
    assert.ok(Object.isFrozen(NORMALIZE_STAGES) && NORMALIZE_STAGES.every((stage) => Object.isFrozen(stage)));
    assert.deepEqual(NORMALIZE_STAGES.map((stage) => stage.id),
      ['nfc.input', 'syllables', 'typos', 'look-alikes', 'nfc.final']);
    assert.deepEqual(NORMALIZE_STAGES.map((stage) => stage.label), ['NFC', 'syllables', 'typos', 'look-alikes', 'NFC']);
    assert.deepEqual(NORMALIZE_STAGES.map((stage) => typeof stage.gate), ['undefined', 'undefined', 'undefined',
      'undefined', 'function']);
    assert.ok(NORMALIZE_STAGES.every((stage) => stage.traceOnly === undefined));
    assert.equal(NORMALIZE_STAGES[0].run, toNfc);
    assert.equal(NORMALIZE_STAGES[2].run, fixTypos);
    assert.equal(NORMALIZE_STAGES[3].run, fixLookAlikes);
    assert.equal(NORMALIZE_STAGES[4].run, toNfc);
  });

  it('opens the final-NFC gate for U+1025 and for units NFC could move or compose', () => {
    const gate = NORMALIZE_STAGES[4].gate;
    assert.equal(gate({ openAllGates: false, seen: 0 }), false);
    assert.equal(gate({ openAllGates: false, seen: 1 }), true);
    assert.equal(gate({ openAllGates: false, seen: 2 }), true);
  });

  it('records what the reader saw in the context, for the gate', () => {
    const ctx = { openAllGates: false, seen: 0 };
    assert.equal(hex(NORMALIZE_STAGES[1].run('\u1025\u102D\u0301', ctx)), hex('\u1025\u102D\u0301'));
    assert.equal(ctx.seen, 3);
  });
});

describe('normalizeText (DESIGN.md §3.10)', () => {
  it('gives the results README.md and ARCHITECTURE.md show', () => {
    const examples = normalizeExamples('README.md').concat(normalizeExamples('ARCHITECTURE.md'));
    assert.ok(examples.length >= 14, examples.length + ' examples');
    for (const [input, expected] of examples) assert.equal(hex(normalized(input)), hex(expected), hex(input));
  });

  it('takes the no-Myanmar fast path to NFC alone (decision 16)', () => {
    assert.equal(normalized('e\u0301'), '\u00E9');
    assert.equal(normalized(''), '');
    assert.equal(normalized('abc ​‌'), 'abc ​‌');
    assert.equal(normalized('\u212B'), '\u00C5');
    assert.equal(hex(normalized('\uAA60\u102C\u1031')), hex('\uAA60\u102C\u1031')); // Extended-A is Myanmar script
    assert.equal(nfcCalls(() => normalizeText('e\u0301')), 1);
  });

  it('runs the final NFC only when the gate opens, or when every gate is open', () => {
    assert.equal(hex(normalized('\u1025\u102D\u102E')), hex('\u1026')); // typos make U+1025 U+102E
    assert.equal(hex(normalized('\u1000\u102D\u102E\u0301')), hex('\u1000\u102E\u0301'));
    const burmese = '\u1019\u103C\u1014\u103A\u1019\u102C';
    const closed = nfcCalls(() => normalizeText(burmese));
    const open = nfcCalls(() => normalizeText(burmese, { openAllGates: true }));
    assert.ok(open > closed, 'openAllGates runs the final NFC');
    assert.ok(nfcCalls(() => normalizeText('\u1025' + burmese)) > closed, 'U+1025 opens the gate');
    assert.ok(nfcCalls(() => normalizeText(burmese + '\u0301')) > closed, 'U+0301 opens the gate');
    assert.ok(nfcCalls(() => normalizeText('ab', { openAllGates: true })) > nfcCalls(() => normalizeText('ab')),
      'openAllGates skips the fast path');
  });

  it('reads engineOptions map-safely: only an object with openAllGates: true opens the gates', () => {
    const text = '\u1019\u103C\u1014\u103A';
    const closed = nfcCalls(() => normalizeText(text));
    for (const options of [undefined, null, 0, 1, 'openAllGates', [], [true], { openAllGates: 'yes' }]) {
      assert.equal(normalizeText(text, options), text);
      assert.equal(nfcCalls(() => normalizeText(text, options)), closed, String(options));
    }
    assert.deepEqual(['\u1031\u1000', 'abc'].map(normalizeText), ['\u1000\u1031', 'abc']);
  });

  it('agrees with 2.x on every probe of test/fixtures/tables.json', () => {
    let probes = 0;
    for (const entry of Object.values(tableProbes())) {
      for (const probe of [entry.probe].concat((entry.edges || []).map((edge) => edge.probe))) {
        normalized(probe);
        probes++;
      }
    }
    assert.ok(probes > 900, probes + ' probes');
  });
});

describe('traceNormalizeText', () => {
  // The records of a trace: [id, label, text].
  function traced(text) {
    const trace = createTrace();
    const out = traceNormalizeText(text, trace);
    assert.equal(hex(out), hex(normalizeText(text)), 'the same result');
    assert.equal(trace.start, text);
    return trace.records.map((record) => [record.id, record.label, hex(record.text)]);
  }

  it('records each stage that changed the text, with its id and label', () => {
    assert.deepEqual(traced('\u1000\u102C'), []);
    assert.deepEqual(traced('e\u0301'), [['nfc.input', 'NFC', hex('\u00E9')]]);
    assert.deepEqual(traced('\u1031\u1000\u102C'), [['syllables', 'syllables', hex('\u1000\u1031\u102C')]]);
    assert.deepEqual(traced('\u1041\u101D'), [['look-alikes', 'look-alikes', hex('\u1041\u1040')]]);
    assert.deepEqual(traced('\u1025\u102D\u102E'), [['typos', 'typos', hex('\u1025\u102E')],
      ['nfc.final', 'NFC', hex('\u1026')]]);
  });

  it('never gates: the final NFC runs, and is recorded only when it changes the text', () => {
    const burmese = '\u1019\u103C\u1014\u103A\u1019\u102C';
    assert.ok(nfcCalls(() => traceNormalizeText(burmese, createTrace())) >= 2);
    assert.deepEqual(traced(burmese), []);
    assert.deepEqual(traced('ab\u0301'), []);
  });
});
