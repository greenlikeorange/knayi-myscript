// core/rules.js (docs/next/DESIGN.md §2.3, §3.9, §3.10, D4, D10, §7.3): rule rows and their runner, traces and
// the stage runner.
//
// The unit tests pin each rule of the spec's semantics on synthetic rows and stages. The table probes
// (test/fixtures/tables.json) run every probe of the 2.x rule tables through applyRuleRows and traceRuleRows, and
// every Zawgyi and Win probe through runStages over 2.x's own font stages, against the frozen 2.x code of
// scripts/oracle/. The fuzzed comparisons are in core-rules.fuzz.test.mjs.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REPEAT_LIMIT, ruleLabel, ruleMatches, applyRuleRows, traceRuleRows, createTrace, startTrace, lastTracedText,
  recordStep, runStages
} from '../../src/core/rules.js';
import { internals, tableProbes } from './helpers.mjs';
import { TABLES, PIPELINES, asDebugLog, tracePipeline } from './core-rules.tables.mjs';

const syllable = internals('syllable.js', ['replaceRepeated']);
const row = (id, re, to, repeat, label) => (label === undefined ? { id, re, to, repeat } : { id, re, to, repeat, label });

// Every probe of the cases whose name starts with one of the prefixes: the case's probe and its edges' probes.
function probesOf(...prefixes) {
  const out = [];
  for (const [name, entry] of Object.entries(tableProbes())) {
    if (!prefixes.some((prefix) => name.startsWith(prefix))) continue;
    out.push([name, entry.probe]);
    for (const edge of entry.edges || []) out.push([name + ' (edge)', edge.probe]);
  }
  return out;
}

describe('core/rules.js rule rows', () => {
  it('ruleLabel is the row\'s label, else its regex source', () => {
    assert.equal(ruleLabel(row('a', /[\u1004]\u103A/g, '', false)), '[\\u1004]\\u103A');
    assert.equal(ruleLabel(row('b', /[\u1004]\u103A/g, '', false, '\\u1004\\u103A')), '\\u1004\\u103A');
  });

  it('ruleMatches tells whether the regex matches, and leaves lastIndex at 0', () => {
    const re = /b+/g;
    assert.equal(ruleMatches(row('a', re, '', false), 'abbc'), true);
    assert.equal(re.lastIndex, 0);
    assert.equal(ruleMatches(row('a', re, '', false), 'abbc'), true, 'a second call starts at 0 too');
    assert.equal(ruleMatches(row('a', re, '', false), 'ac'), false);
    assert.equal(re.lastIndex, 0);
  });

  it('applyRuleRows runs a once row one replace, over every match', () => {
    const rows = [row('a', /ab/g, 'b', false)];
    assert.equal(applyRuleRows('aabab', rows), 'abb', 'the match the replacement makes is not replaced');
  });

  it('applyRuleRows runs a repeat row until it no longer matches', () => {
    const rows = [row('a', /ab/g, 'b', true)];
    assert.equal(applyRuleRows('aaaab', rows), 'b');
  });

  it('applyRuleRows stops a repeat row that matches but no longer changes the text', () => {
    let calls = 0;
    const re = /a/g;
    const counting = { id: 'a', get re() { calls++; return re; }, to: 'a', repeat: true };
    assert.equal(applyRuleRows('aaa', [counting]), 'aaa');
    assert.equal(calls, 2, 'one search and one replace');
  });

  it('applyRuleRows stops a repeat row after REPEAT_LIMIT passes, as 2.x replaceRepeated does', () => {
    assert.equal(REPEAT_LIMIT, 40);
    const grows = row('a', /^/g, 'a', true); // matches every text, and every pass adds one unit
    assert.equal(applyRuleRows('', [grows]), 'a'.repeat(REPEAT_LIMIT));
    assert.equal(applyRuleRows('', [grows]), syllable.replaceRepeated('', [/^/g, 'a']));
  });

  it('applyRuleRows runs the rows in order, each on the text the one before left', () => {
    const rows = [row('a', /a/g, 'b', false), row('b', /b/g, 'c', false), row('c', /cc/g, 'd', true)];
    assert.equal(applyRuleRows('ab', rows), 'd');
    assert.equal(applyRuleRows('', rows), '');
    assert.equal(applyRuleRows('xyz', []), 'xyz');
  });

  it('applyRuleRows uses $-references in a replacement, and leaves every regex with lastIndex 0', () => {
    const once = row('a', /(\d)(x)/g, '$2$1', false);
    const repeat = row('b', /(\d)(x)/g, '$2$1', true);
    assert.equal(applyRuleRows('12x', [once]), '1x2');
    assert.equal(applyRuleRows('12x', [repeat]), 'x12', 'the x moves one place per pass');
    assert.equal(once.re.lastIndex, 0);
    assert.equal(repeat.re.lastIndex, 0);
  });
});

describe('core/rules.js traceRuleRows', () => {
  const rows = [
    row('once.changes', /a/g, 'b', false),
    row('once.same', /c/g, 'c', false), // matches, never changes the text: not logged
    row('repeat.moves', /bd/g, 'db', true),
    row('repeat.idle', /z/g, 'y', true), // never matches: not logged
    row('once.idle', /q/g, 'r', false, 'q (label)')
  ];

  it('gives applyRuleRows\'s result and records the rows 2.x logs, each with the text after it', () => {
    const trace = createTrace();
    startTrace(trace, 'aaddc');
    const result = traceRuleRows('aaddc', rows, trace);
    assert.equal(result, applyRuleRows('aaddc', rows));
    assert.deepEqual(trace, {
      start: 'aaddc',
      records: [
        { id: 'once.changes', label: 'a', text: 'bbddc' },
        { id: 'repeat.moves', label: 'bd', text: 'ddbbc' }
      ]
    });
  });

  it('records a labelled row under its label', () => {
    const trace = createTrace();
    startTrace(trace, 'q');
    traceRuleRows('q', rows, trace);
    assert.deepEqual(trace.records, [{ id: 'once.idle', label: 'q (label)', text: 'r' }]);
  });

  it('records a repeat row that matched before its first pass, even when it changed nothing', () => {
    const idle = row('repeat.same', /a/g, 'a', true);
    const trace = createTrace();
    startTrace(trace, 'aa');
    assert.equal(traceRuleRows('aa', [idle], trace), 'aa');
    assert.deepEqual(trace.records, [{ id: 'repeat.same', label: 'a', text: 'aa' }]);
  });
});

describe('core/rules.js traces', () => {
  it('createTrace makes an empty trace, and startTrace starts it over', () => {
    const trace = createTrace();
    assert.deepEqual(trace, { start: null, records: [] });
    assert.notEqual(createTrace(), trace, 'a new trace each time');
    recordStep(trace, 'x', 'X', 'one');
    startTrace(trace, 'input');
    assert.deepEqual(trace, { start: 'input', records: [] });
  });

  it('lastTracedText is the last record\'s text, or the start', () => {
    const trace = createTrace();
    startTrace(trace, 'input');
    assert.equal(lastTracedText(trace), 'input');
    recordStep(trace, 'a', 'A', 'one');
    recordStep(trace, 'b', 'B', 'two');
    assert.equal(lastTracedText(trace), 'two');
    assert.deepEqual(trace.records, [{ id: 'a', label: 'A', text: 'one' }, { id: 'b', label: 'B', text: 'two' }]);
  });
});

describe('core/rules.js runStages', () => {
  // Each stage appends its id, so the output shows which stages ran and in which order.
  const append = (id, extra) => Object.assign({ id: id, label: id.toUpperCase(), run: (text) => text + id }, extra);
  const calls = [];
  const gated = (open) => append('g', { gate: (ctx) => { calls.push(ctx); return open; } });

  it('runs the stages in order, passing each stage the one before\'s output and the context', () => {
    const seen = [];
    const ctx = { openAllGates: false, extra: 1 };
    const stages = [append('a'), { id: 'b', label: 'B', run: (text, c) => { seen.push(c); return text + 'b'; } }];
    assert.equal(runStages('>', stages, ctx, null), '>ab');
    assert.deepEqual(seen, [ctx]);
    assert.equal(runStages('>', [], ctx, null), '>');
  });

  it('without a trace, skips a traceOnly stage and a stage whose gate is closed', () => {
    const ctx = { openAllGates: false };
    calls.length = 0;
    assert.equal(runStages('>', [append('a'), append('t', { traceOnly: true }), gated(false), append('z')], ctx, null), '>az');
    assert.deepEqual(calls, [ctx], 'the gate is asked, with the context');
    assert.equal(runStages('>', [gated(true)], ctx, null), '>g');
    assert.equal(runStages('>', [gated(false)], ctx, undefined), '>', 'undefined is no trace');
  });

  it('with openAllGates, runs every gated stage without asking its gate, but still skips traceOnly', () => {
    calls.length = 0;
    const ctx = { openAllGates: true };
    assert.equal(runStages('>', [gated(false), append('t', { traceOnly: true })], ctx, null), '>g');
    assert.deepEqual(calls, []);
  });

  it('with a trace, runs every stage, never gates, and records each output that differs from the last record', () => {
    calls.length = 0;
    const same = { id: 's', label: 'S', run: (text) => text };
    const stages = [append('a'), same, gated(false), append('t', { traceOnly: true }), append('z')];
    const trace = createTrace();
    startTrace(trace, '>');
    assert.equal(runStages('>', stages, { openAllGates: false }, trace), '>agz', 'the traceOnly output is not passed on');
    assert.deepEqual(calls, [], 'the trace runner never asks a gate');
    assert.deepEqual(trace.records, [
      { id: 'a', label: 'A', text: '>a' },
      { id: 'g', label: 'G', text: '>ag' },
      { id: 't', label: 'T', text: '>agt' },
      { id: 'z', label: 'Z', text: '>agz' }
    ]);
  });

  it('with a trace, compares a stage after a traceOnly one with the traceOnly record, as 2.x step() does', () => {
    // 2.x compares 'syllables' with 'glyphs' when glyphs was recorded (storageOrder.js:452-460): a syllables
    // output equal to the glyphs view is not recorded, though it differs from the text before.
    const view = { id: 'view', label: 'view', traceOnly: true, run: () => 'V' };
    const toView = { id: 'next', label: 'next', run: () => 'V' };
    const trace = createTrace();
    startTrace(trace, 'in');
    assert.equal(runStages('in', [view, toView], { openAllGates: false }, trace), 'V');
    assert.deepEqual(trace.records.map((r) => r.id), ['view']);
  });

  it('with a trace, records nothing for stages that change nothing', () => {
    const trace = createTrace();
    startTrace(trace, 'x');
    runStages('x', [{ id: 'same', label: 'same', run: (text) => text }], { openAllGates: false }, trace);
    assert.deepEqual(asDebugLog(trace), { matched_patterns: [], steps: ['x'] });
  });
});

describe('core/rules.js on the table probes of the 2.x tables (test/fixtures/tables.json)', () => {
  const cases = [
    ['unicode-to-zawgyi', TABLES.unicodeToZawgyi],
    ['zawgyi sequence', TABLES.zawgyiSequences],
    ['win sequence', TABLES.winSequences],
    ['typo', TABLES.typos]
  ];
  for (const [prefix, table] of cases) {
    it('applyRuleRows gives what 2.x gives on every ' + prefix + ' probe', () => {
      const probes = probesOf(prefix);
      assert.ok(probes.length > 0);
      for (const [name, probe] of probes) assert.equal(applyRuleRows(probe, table.rows), table.reference(probe), name);
    });
  }

  it('traceRuleRows gives 2.x\'s debug log on every unicode-to-zawgyi probe', () => {
    for (const [name, probe] of probesOf('unicode-to-zawgyi')) {
      const trace = createTrace();
      startTrace(trace, probe);
      const result = traceRuleRows(probe, TABLES.unicodeToZawgyi.rows, trace);
      const log = TABLES.unicodeToZawgyi.log(probe);
      assert.deepEqual(asDebugLog(trace), { matched_patterns: log.matched_patterns, steps: log.steps }, name);
      assert.equal(result, log.steps[log.steps.length - 1], name);
    }
  });

  for (const font of ['zawgyi', 'win']) {
    it('runStages over 2.x\'s ' + font + ' stages gives 2.x\'s result and debug log on every ' + font + ' probe', () => {
      const pipeline = PIPELINES[font];
      const probes = probesOf(font + ' ');
      assert.ok(probes.length > 80);
      for (const [name, probe] of probes) {
        const expected = pipeline.toUnicode(probe, true);
        const { result, log } = tracePipeline(probe, pipeline);
        assert.deepEqual(log, expected, name);
        assert.equal(result, pipeline.toUnicode(probe, false), name);
        assert.equal(runStages(probe, pipeline.stages, { openAllGates: false }, null), result, name);
      }
    });
  }
});
