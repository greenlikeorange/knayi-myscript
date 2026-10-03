// Differential fuzz of core/rules.js (docs/next/DESIGN.md §6.1, §7.3) against the frozen 2.x code of
// scripts/oracle/, on the strings of the 2.x fuzz tests (scripts/testing/arbitraries.js). Every output must be
// identical.
//
// - applyRuleRows against 2.x's per-row replace and replaceRepeated, on every 2.x table: the Unicode to Zawgyi
//   rules (syllable.js convertText), the Zawgyi and Win sequences (the 'sequences' step of storageOrder.js
//   toUnicode) and the typos (typingFixes.js). traceRuleRows against convertText's debug log, mapped by §3.9.
// - runStages with a trace against storageOrder.js toUnicode(x, font, true), matched_patterns and steps, on a
//   stage list built from 2.x's own stage functions: this proves the runner and the trace rule independently of
//   the new engine. Without a trace, runStages gives toUnicode's result.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { applyRuleRows, traceRuleRows, createTrace, startTrace, runStages } from '../../src/core/rules.js';
import { arb, fuzz } from './helpers.mjs';
import { TABLES, PIPELINES, zawgyiOf, asDebugLog, tracePipeline } from './core-rules.tables.mjs';

const hex = (text) => text.split('').map((c) => c.charCodeAt(0).toString(16).toUpperCase()).join(' ');

function same(actual, expected, input) {
  if (actual !== expected) assert.fail('input ' + hex(input) + '\n  core ' + hex(actual) + '\n  2.x  ' + hex(expected));
}

// The 2.x fuzz regressions (test/fuzz.test.js) for the readers these tables feed, checked first.
const UNICODE_REGRESSIONS = [
  '\u101B\u103A\u1039\u1000\u102C', '\u1000\u102C\u1039\u1000', '\u1000\u200B\u1031\u1001', '\u1047 \u102C',
  '\u101C\u1032\u1025\u103A\u1038', '\u1004\u103A\u1039\u1002\u1031 \u102F', '\u1000' + '\u1031'.repeat(300),
  '\u1000' + '\u103C'.repeat(300), '\u1000' + '\u103A'.repeat(150) + '\u103C'.repeat(150),
  '\u1000' + '\u200B\u102C'.repeat(150)
].map((text) => [text]);
const ZAWGYI_REGRESSIONS = [
  '\u107F\u1019\u102D\u1033 \u1037', '\u104E\u1004\u1039\u1038', '\u1044\u1004\u1039\u1038',
  '\u1031\u101A\u102C\u1000\u1039\u103A\u102C\u1038', '\u1031' + '\u1000'.repeat(200)
].map((text) => [text]);
const WIN_REGRESSIONS = ['ajumifh', 'a,musfm;', 'usGefkyf', 'aMomf', 'ZvGefaps;', '7if;', '0if'].map((text) => [text]);

const unicode = fc.oneof({ weight: 3, arbitrary: arb.unicodeText() }, { weight: 1, arbitrary: arb.burmeseText });
const zawgyi = fc.oneof({ weight: 3, arbitrary: arb.zawgyiText() }, { weight: 1, arbitrary: arb.burmeseText.map(zawgyiOf) });
const win = arb.winText();

describe('applyRuleRows and traceRuleRows against 2.x, per table', () => {
  it('the Unicode to Zawgyi rules, with the debug log', () => {
    const table = TABLES.unicodeToZawgyi;
    fuzz.check(fc.property(unicode, (text) => {
      same(applyRuleRows(text, table.rows), table.reference(text), text);
      const trace = createTrace();
      startTrace(trace, text);
      const traced = traceRuleRows(text, table.rows, trace);
      const log = table.log(text);
      assert.deepEqual(asDebugLog(trace), { matched_patterns: log.matched_patterns, steps: log.steps }, hex(text));
      same(traced, log.steps[log.steps.length - 1], text);
    }), 100000, UNICODE_REGRESSIONS, 1000000);
  });

  it('the Zawgyi sequences', () => {
    const table = TABLES.zawgyiSequences;
    fuzz.check(fc.property(zawgyi, (text) => {
      same(applyRuleRows(text, table.rows), table.reference(text), text);
    }), 100000, ZAWGYI_REGRESSIONS, 1000000);
  });

  it('the Win sequences', () => {
    const table = TABLES.winSequences;
    fuzz.check(fc.property(win, (text) => {
      same(applyRuleRows(text, table.rows), table.reference(text), text);
    }), 100000, WIN_REGRESSIONS, 1000000);
  });

  it('the typos', () => {
    const table = TABLES.typos;
    fuzz.check(fc.property(unicode, (text) => {
      same(applyRuleRows(text, table.rows), table.reference(text), text);
    }), 100000, UNICODE_REGRESSIONS, 1000000);
  });
});

describe('runStages traces against 2.x toUnicode(x, font, true)', () => {
  for (const [font, text, regressions] of [['zawgyi', zawgyi, ZAWGYI_REGRESSIONS], ['win', win, WIN_REGRESSIONS]]) {
    it(font, () => {
      const pipeline = PIPELINES[font];
      fuzz.check(fc.property(text, (input) => {
        const { result, log } = tracePipeline(input, pipeline);
        assert.deepEqual(log, pipeline.toUnicode(input, true), hex(input));
        const expected = pipeline.toUnicode(input, false);
        same(result, expected, input);
        same(runStages(input, pipeline.stages, { openAllGates: false }, null), expected, input);
      }), 50000, regressions, 300000);
    });
  }
});
