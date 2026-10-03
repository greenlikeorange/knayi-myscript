// normalize and isNormalized of the 3.0 API (docs/next/DESIGN.md §11.2, §11.3; decision 36).
//
// - The garbled classes 2.x normalize changes again on a second pass (DESIGN.md §10 Q12): 3.0 gives the text 2.x
//   settles on, and changes it no further.
// - The report and the trace: their shape, and that they describe the call's own result.
// - The options and errors of §11.1, map-safety, and no carry-over between calls.
// - Every line of the cached corpora: idempotent, and the same as 2.x on every Unicode corpus; the mC4 counts.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { units, cachedCorpora, UNICODE_CORPORA } from './helpers.mjs';
import { normalize, isNormalized, createTrace } from '../../../src/index.js';
import { normalizeText } from '../../../src/stages/normalize.js';
import { normalize as compatNormalize } from '../../../src/compat/index.js';

// 2.x normalize, repeated until it changes nothing.
function settledBy2x(text) {
  for (let pass = 0; pass < 50; pass++) {
    const next = normalizeText(text);
    if (next === text) return text;
    text = next;
  }
  throw new Error('2.x normalize did not settle on ' + units(text));
}

const STAGE_IDS = ['nfc.input', 'syllables', 'typos', 'look-alikes', 'nfc.final'];

// The known garbled classes of 2.x (DESIGN.md §10 Q12), each with what 2.x settles on.
const GARBLED = [
  ['zero with medial wa, a space, medial ha', '\u1040\u103D \u103E', '\u101D\u103D\u103E'],
  ['tall aa, virama, zero', '\u1010\u102B\u1039\u1040', '\u1010\u1039\u101D\u102B'],
  ['two zeros before ii', '\u1010\u1040\u1040\u102E', '\u1010\u101D\u101D\u102E'],
  ['visarga, i, u, aa', '\u101D\u1038\u102D\u1025\u102C', '\u101D\u102D\u1038\u1009\u102C'],
  ['i, ii, i with no base', '\u102D\u102E\u102D', '\u102E']
];

describe('normalize settles the garbled classes of 2.x (decision 36; DESIGN.md §10 Q12)', () => {
  for (const [name, text, settled] of GARBLED) {
    it(name + ': ' + units(text), () => {
      const once = normalizeText(text);
      assert.notEqual(normalizeText(once), once, '2.x changes its own output again');
      assert.equal(units(settledBy2x(text)), units(settled), 'what 2.x settles on');
      assert.equal(units(normalize(text)), units(settled), '3.0 gives it at once');
      assert.equal(normalize(normalize(text)), normalize(text), 'and keeps it');
    });
  }

  it('reads a run of i and ii, or u and uu, whole (settleTypos)', () => {
    assert.equal(units(normalize('\u102D'.repeat(40) + '\u102E')), units('\u102E'));
    assert.equal(units(normalize('\u102F\u1030\u102F\u1030')), units('\u1030\u1030'));
  });

  it('reads u, zero and seven after a virama as the consonants they stand for (STABLE_UNICODE_READING)', () => {
    // 2.x needs a pass per link of such a chain.
    const chain = '\u1000\u103E' + '\u1039\u1025'.repeat(30) + '\u102B';
    assert.equal(normalize(normalize(chain)), normalize(chain));
    assert.equal(units(normalize('\u1015\u1039\u1025\u103A')), units('\u1015\u1039\u1009'));
    assert.equal(units(normalize('\u1000\u1039\u1047')), units('\u1000\u1039\u101B'));
  });
});

describe('normalize, what it keeps (DESIGN.md §11.2)', () => {
  it('gives 2.x\'s result where 2.x keeps it, and NFC for text with no Myanmar (decision 16)', () => {
    for (const text of ['\u1031\u1000\u102C\u1004\u103A\u1038', '\u1000\u103A\u1037', 'e\u0301', '', 'abc']) {
      assert.equal(normalize(text), compatNormalize(text), units(text));
    }
    assert.equal(normalize('e\u0301'), '\u00E9');
  });

  it('never trims, and keeps zero-width characters', () => {
    assert.equal(normalize('  \u1000\u102C\u200B '), '  \u1000\u102C\u200B ');
    assert.equal(normalize('\u200C\u1000\u102C\u200C'), '\u200C\u1000\u102C\u200C');
  });

  it('isNormalized is whether normalize keeps the text', () => {
    for (const [, text, settled] of GARBLED) {
      assert.equal(isNormalized(text), false);
      assert.equal(isNormalized(settled), true);
    }
    assert.equal(isNormalized(''), true);
    assert.equal(isNormalized('e\u0301'), false);
  });
});

describe('normalize\'s report and trace (DESIGN.md §11.3, §11.4)', () => {
  const garbled = '\u1031\u1000\u102C\u1004\u103A\u1038 \u1015\u102B\u1010\u101A\u103A\u1039\u1037 \u1040\u102C';

  it('reports each change with its offsets, its text before and after, and its stages', () => {
    const report = normalize(garbled, { report: true });
    assert.deepEqual(Object.keys(report), ['text', 'changes']);
    assert.equal(report.text, normalize(garbled));
    assert.deepEqual(report.changes[0], {
      start: 0, end: 3, before: '\u1031\u1000\u102C', after: '\u1000\u1031\u102C', outputStart: 0, outputEnd: 3,
      rules: ['syllables']
    });
    let rebuilt = '';
    let copied = 0;
    for (const change of report.changes) {
      assert.equal(garbled.slice(change.start, change.end), change.before);
      assert.equal(report.text.slice(change.outputStart, change.outputEnd), change.after);
      assert.ok(change.rules.length > 0 && change.rules.every((rule) => STAGE_IDS.indexOf(rule) !== -1));
      rebuilt += garbled.slice(copied, change.start) + change.after;
      copied = change.end;
    }
    assert.equal(rebuilt + garbled.slice(copied), report.text);
  });

  it('reports no change for normalized text, and the changes of every pass for a garbled class', () => {
    assert.deepEqual(normalize(normalize(garbled), { report: true }).changes, []);
    const report = normalize('\u1010\u102B\u1039\u1040', { report: true });
    assert.equal(units(report.text), units('\u1010\u1039\u101D\u102B'));
    assert.deepEqual(report.changes.map((change) => [change.start, change.end]), [[0, 4]]);
  });

  it('traces each stage of each pass that changed the text, by its stage id', () => {
    const trace = createTrace();
    const out = normalize(garbled, { trace });
    assert.equal(trace.start, garbled);
    assert.deepEqual(trace.records.map((record) => record.id), ['nfc.input', 'syllables', 'look-alikes']);
    assert.equal(trace.records[trace.records.length - 1].text, out);
    const again = createTrace();
    normalize(out, { trace: again });
    assert.deepEqual(again.records, [], 'normalized text: nothing to record');
  });

  it('gives the report and fills the trace in one call', () => {
    const trace = createTrace();
    const report = normalize(garbled, { report: true, trace });
    assert.equal(trace.records[trace.records.length - 1].text, report.text);
  });
});

describe('normalize\'s arguments (DESIGN.md §11.1)', () => {
  it('throws coded errors for a text that is not a string and for bad options', () => {
    const typeError = { name: 'TypeError', code: 'ERR_KNAYI_INVALID_ARG_TYPE' };
    for (const text of [undefined, null, 1, new String('a'), ['a']]) {
      assert.throws(() => normalize(text), typeError);
      assert.throws(() => isNormalized(text), typeError);
    }
    assert.throws(() => normalize('a', 'report'), typeError);
    assert.throws(() => normalize('a', [true]), typeError);
    assert.throws(() => normalize('a', { report: 'yes' }), typeError);
    assert.throws(() => normalize('a', { trace: {} }), typeError);
    assert.throws(() => normalize(1), /^TypeError: knayi\.normalize: text must be a string, not a number$/);
  });

  it('reads undefined and null options as the defaults, and an index from Array#map as no options', () => {
    const lines = ['\u1031\u1000', '\u1000\u102C', '\u1040\u102C'];
    assert.deepEqual(lines.map(normalize), lines.map((line) => normalize(line)));
    assert.equal(normalize(lines[0], null), normalize(lines[0]));
    assert.equal(normalize(lines[0], { report: null, trace: undefined }), normalize(lines[0]));
  });

  it('keeps nothing from one call to the next', () => {
    const texts = ['\u1031\u1000\u102C', '\u102D\u102E\u102D', 'abc', '\u1040\u103D \u103E'];
    const alone = texts.map((text) => [normalize(text), normalize(text, { report: true })]);
    for (let round = 0; round < 3; round++) {
      texts.forEach((text, i) => {
        const trace = createTrace();
        assert.deepEqual(normalize(text, { report: true, trace }), alone[i][1]);
        assert.equal(normalize(text), alone[i][0]);
      });
    }
  });
});

describe('normalize on the cached corpora (DESIGN.md §11.2)', () => {
  it('is idempotent on every line, and gives 2.x\'s result on every line of the Unicode corpora', async (t) => {
    const corpora = await cachedCorpora();
    if (corpora.skip) return t.skip(corpora.skip);
    const counts = {};
    for (const [id, lines] of Object.entries(corpora.sets)) {
      let differ = 0;
      let unsettled = 0;
      for (const line of lines) {
        const once = normalize(line);
        assert.equal(normalize(once), once, id + ': ' + units(line));
        const old = normalizeText(line);
        if (old !== once) differ++;
        if (normalizeText(old) !== old) unsettled++;
      }
      counts[id] = [lines.length, unsettled, differ];
      if (UNICODE_CORPORA.indexOf(id) !== -1) assert.equal(differ, 0, id + ': lines 3.0 changes differently');
    }
    // mC4 is raw web text, mostly Zawgyi, which normalize is not for: 104 lines that 2.x changes again on a second
    // pass, and 199 lines that 3.0 changes differently (the 104, settled, and 95 with u, zero or seven after
    // U+1039, Zawgyi's asat, which 3.0 reads as stacked).
    assert.deepEqual(counts.mc4, [14304, 104, 199]);
    t.diagnostic(Object.entries(counts).map(([id, [lines, unsettled, differ]]) =>
      id + ' ' + lines + ' lines, 2.x unsettled ' + unsettled + ', 3.0 differs ' + differ).join('; '));
  });
});
