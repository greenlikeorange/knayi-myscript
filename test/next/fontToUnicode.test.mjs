// The font pipeline: FONT_STAGES, fontToUnicode and traceFontToUnicode of src/stages/fonts.js
// (docs/next/DESIGN.md §2.3, §3.9, §3.10, §7.8). Owner: W6 (engine-fonts).
//
// Both functions are compared with 2.x zawgyi.toUnicode and win.toUnicode, with and without debug, in the frozen
// copies of scripts/oracle/ (D19), with the typing fixes in normalize's order, as scripts/oracle/index.js makes them
// for the 2.x line's change since 2.10 (2.x ab3676e; DESIGN.md §8): on the regressions of test/fuzz.test.js, the table probes of
// test/fixtures/tables.json, and every generated input set of scripts/eval/lib/inputs.mjs (every Myanmar-block
// pair, Extended-A/B/C, the row probes with the strings of the documents' examples, and the generated Win sets).
// fontToUnicode.fuzz.test.mjs adds random strings; `npm run compare` adds the corpora, mC4 included. The Win
// results are "Win identity only": there is no hand-checked Win set yet (PR 0.9 of the plan).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FONT_STAGES, fontToUnicode, traceFontToUnicode } from '../../src/stages/fonts.js';
import { createTrace } from '../../src/core/rules.js';
import { generatedSets } from '../../scripts/eval/lib/inputs.mjs';
import { oracle, tableProbes } from './helpers.mjs';

const ORACLE = oracle.fonts;

const hexOf = (text) => Array.from(text, (ch) => ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');

// The 2.x debug object from a trace: { matched_patterns, steps } (D4).
function asDebug(trace) {
  return {
    matched_patterns: trace.records.map((record) => record.label),
    steps: [trace.start].concat(trace.records.map((record) => record.text))
  };
}

// Where fontToUnicode or its trace differs from 2.x for the input, or null: the output, the matched stages and the
// steps, and the record ids, which are the labels.
function differenceFrom2x(text, font) {
  const output = fontToUnicode(text, font);
  if (output !== ORACLE[font].toUnicode(text)) return 'output';
  const trace = createTrace();
  if (traceFontToUnicode(text, font, trace) !== output) return 'traced output';
  const debug = asDebug(trace);
  const debug2x = ORACLE[font].toUnicode(text, true);
  if (JSON.stringify(debug.matched_patterns) !== JSON.stringify(debug2x.matched_patterns)) return 'stages';
  if (JSON.stringify(debug.steps) !== JSON.stringify(debug2x.steps)) return 'steps';
  if (trace.records.some((record) => record.id !== record.label)) return 'ids';
  return null;
}

function assertAgreesWith2x(inputs, font, what) {
  const differ = [];
  for (const text of inputs) {
    const difference = differenceFrom2x(text, font);
    if (difference) differ.push(difference + ': ' + hexOf(text));
  }
  assert.deepEqual(differ.slice(0, 10), [], differ.length + ' of ' + inputs.length + ' ' + what + ' differ');
}

describe('FONT_STAGES (DESIGN.md §2.3, §3.10)', () => {
  it('has the 2.x stage names as ids and labels, in the 2.x order, the typing fixes in normalize\'s', () => {
    const names = ['sequences', 'glyphs', 'syllables', 'zero as wa', 'typos', 'look-alikes', 'NFC'];
    assert.deepEqual(FONT_STAGES.map((stage) => stage.id), names);
    assert.deepEqual(FONT_STAGES.map((stage) => stage.label), names);
  });

  it('only \'glyphs\' is trace-only, and only \'NFC\' has a gate (§3.10, gate 4)', () => {
    assert.deepEqual(FONT_STAGES.filter((stage) => stage.traceOnly).map((stage) => stage.id), ['glyphs']);
    assert.deepEqual(FONT_STAGES.filter((stage) => 'gate' in stage).map((stage) => stage.id), ['NFC']);
    assert.ok(Object.isFrozen(FONT_STAGES) && FONT_STAGES.every(Object.isFrozen));
  });
});

describe('fontToUnicode and traceFontToUnicode (DESIGN.md §2.3, §3.9)', () => {
  it('converts the examples of README.md, MIGRATION.md and ARCHITECTURE.md', () => {
    const examples = [
      ['\u1019\u1002\u1064\u101C\u102C\u1015\u102B', 'zawgyi', '\u1019\u1004\u103A\u1039\u1002\u101C\u102C\u1015\u102B'],
      ['\u1031\u101A\u102C\u1000\u1039\u103A\u102C\u1038', 'zawgyi', '\u101A\u1031\u102C\u1000\u103A\u103B\u102C\u1038'],
      ['\u1031\u1005\u103A\u1038', 'zawgyi', '\u1008\u1031\u1038'],
      ['\u108F\u102D\u102F\u1039\u1004\u1039\u1004\u1036', 'zawgyi', '\u1014\u102D\u102F\u1004\u103A\u1004\u1036'],
      ['\u107F\u1019\u102D\u1033 \u1037', 'zawgyi', '\u1019\u103C\u102D\u102F\u1037'],
      ['jrefrm', 'win', '\u1019\u103C\u1014\u103A\u1019\u102C'],
      ['ajumifh', 'win', '\u1000\u103C\u1031\u102C\u1004\u1037\u103A'],
      ['ZvGefaps;', 'win', '\u1007\u101C\u103D\u1014\u103A\u1008\u1031\u1038'],
      ['\u1000\u200C\u102C', 'zawgyi', '\u1000\u102C\u200C'],
      ['\u1041 \u102C', 'zawgyi', '\u1041\u102C'],
      ['\u1031\u200B\u1000', 'zawgyi', '\u200B\u1000\u1031'],
      ['\u101C\u1032\u1025\u1039\u1038', 'zawgyi', '\u101C\u1032\u1009\u103A\u1038'],
      ['&4if;', 'win', '\u101B\u104E\u1004\u103A\u1038']
    ];
    for (const [text, font, expected] of examples) assert.equal(fontToUnicode(text, font), expected, hexOf(text));
  });

  it('traces the stages that changed the text, with their ids and labels, from the input', () => {
    const trace = createTrace();
    const result = traceFontToUnicode('\u1031\u1000\u102C\u1039', 'zawgyi', trace);
    assert.equal(result, '\u1000\u1031\u102C\u103A');
    assert.equal(trace.start, '\u1031\u1000\u102C\u1039');
    assert.deepEqual(trace.records.map((record) => [record.id, record.label]),
      [['glyphs', 'glyphs'], ['syllables', 'syllables']]);
    assert.deepEqual(trace.records.map((record) => record.text),
      ['\u1031\u1000\u102C\u103A', '\u1000\u1031\u102C\u103A']);
  });

  it('a trace object is started again for each call', () => {
    const trace = createTrace();
    traceFontToUnicode('\u1031\u1000', 'zawgyi', trace);
    traceFontToUnicode('abc', 'zawgyi', trace);
    assert.deepEqual(trace, { start: 'abc', records: [] });
  });

  it('returns text the font does not change as it is, and the empty string', () => {
    for (const font of ['zawgyi', 'win']) {
      assert.equal(fontToUnicode('', font), '');
      assert.equal(fontToUnicode('\u1000\u102C', font), '\u1000\u102C');
    }
    assert.equal(fontToUnicode('abc', 'zawgyi'), 'abc');
  });

  it('refuses a font it has no table for, with a coded RangeError', () => {
    for (const name of ['unicode', 'Zawgyi', 'zg', '', undefined, 'toString']) {
      assert.throws(() => fontToUnicode('\u1000', name), (error) => error instanceof RangeError &&
        error.code === 'ERR_KNAYI_INVALID_ARG_VALUE' && /^knayi\.fontToUnicode: /.test(error.message));
      assert.throws(() => traceFontToUnicode('\u1000', name, createTrace()), RangeError);
    }
  });
});

// The regressions of test/fuzz.test.js, which its fuzz checks first.
const ZAWGYI_REGRESSIONS = [
  '\u107F\u1019\u102D\u1033 \u1037', // medial ra, a space before the dot below
  '\u104E\u1004\u1039\u1038', // lagaung typed with the nga, asat and visarga it draws
  '\u1044\u1004\u1039\u1038', // the digit four typed for lagaung
  '\u1031\u101A\u102C\u1000\u1039\u103A\u102C\u1038', // yauk-kya (man): asat on the consonant, before medial ya
  '\u1031' + '\u1000'.repeat(200)
];
const WIN_REGRESSIONS = ['ajumifh', 'a,musfm;', 'usGefkyf', 'aMomf', 'ZvGefaps;', '7if;', '0if'];

describe('against 2.x toUnicode, with and without debug (DESIGN.md §6.2, §7.8)', () => {
  it('zawgyi: the regressions of test/fuzz.test.js', () => {
    assertAgreesWith2x(ZAWGYI_REGRESSIONS, 'zawgyi', 'regressions');
  });

  it('win: the regressions of test/fuzz.test.js', () => {
    assertAgreesWith2x(WIN_REGRESSIONS, 'win', 'regressions');
  });

  it('the table probes of every Zawgyi and Win row, and their edge probes', () => {
    let checked = 0;
    for (const [id, entry] of Object.entries(tableProbes())) {
      const font = id.split(' ')[0];
      if (font !== 'zawgyi' && font !== 'win') continue;
      for (const probe of [entry].concat(entry.edges || [])) {
        assert.equal(differenceFrom2x(probe.probe.trim(), font), null, id + ': ' + hexOf(probe.probe));
        if (!Array.isArray(probe.expect.stages)) continue; // the public call returned before converting
        const trace = createTrace();
        assert.equal(traceFontToUnicode(probe.probe.trim(), font, trace), probe.expect.output, id);
        assert.deepEqual(asDebug(trace).matched_patterns, probe.expect.stages, id);
        checked++;
      }
    }
    assert.ok(checked > 270, checked + ' probes checked against their recorded output');
  });

  const sets = generatedSets();
  for (const set of sets) {
    const fonts = set.kind === 'win' ? ['win'] : ['zawgyi', 'win'];
    for (const font of fonts) {
      const label = font === 'win' ? ' (Win identity only)' : '';
      it(font + ': ' + set.id + ', ' + set.lines.length + ' inputs' + label, () => {
        assertAgreesWith2x(set.lines, font, set.id);
      });
    }
  }
});
