// explain of the 3.0 API (docs/next/DESIGN.md §11.8).
//
// - One synthetic example per rule id, with its span, its fix and its kind.
// - Lines: a Zawgyi line is one issue, with its Unicode as the fix; offsets count from the start of the text.
// - On fuzz, the fixes of explain's issues, written into the text, give normalize's result, for every line that is
//   not read as Zawgyi: explain names exactly what normalize changes.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { arb, fuzz } from '../helpers.mjs';
import { units, cachedCorpora } from './helpers.mjs';
import { explain, normalize, detectEncoding } from '../../../src/index.js';
import { fontToUnicode } from '../../../src/stages/fonts.js';

// A Unicode word that each example follows, as real text has around a slip: medial ha, nga with asat, and asat
// with visarga are three Unicode signatures (rules/detect.js), so a slip that is a Zawgyi signature, such as e typed
// before its consonant, does not make the line read as Zawgyi.
const CONTEXT = '\u1014\u103E\u1004\u103A\u1038 ';

// [rule, kind, text, the span of the issue in the text, its fix]
const EXAMPLES = [
  ['order.prebase', 'order', '\u1031\u1000\u102C', [0, 3], '\u1000\u1031\u102C'],
  ['order.marks', 'order', '\u1000\u102F\u102D', [0, 3], '\u1000\u102D\u102F'],
  ['mark.repeated', 'mark', '\u1000\u102C\u102C', [0, 3], '\u1000\u102C'],
  ['mark.space', 'mark', '\u1000 \u102C', [0, 3], '\u1000\u102C'],
  ['asat.dropped', 'mark', '\u1000\u102D\u103A', [0, 3], '\u1000\u102D'],
  ['look-alike.u-as-nya', 'look-alike', '\u1000\u1025\u102C', [1, 3], '\u1009\u102C'],
  ['look-alike.seven-as-ra', 'look-alike', '\u1047\u102D', [0, 2], '\u101B\u102D'],
  ['look-alike.ca-as-jha', 'look-alike', '\u1005\u103B', [0, 2], '\u1008'],
  ['look-alike.zero-as-wa', 'look-alike', '\u1040\u102C', [0, 1], '\u101D'],
  ['look-alike.wa-as-zero', 'look-alike', '\u1041\u101D', [1, 2], '\u1040'],
  ['look-alike.ra-as-seven', 'look-alike', '\u1041\u101B', [1, 2], '\u1047'],
  ['typo.ii', 'typo', '\u1000\u102D\u102E', [1, 3], '\u102E'],
  ['typo.uu', 'typo', '\u1000\u102F\u1030', [1, 3], '\u1030'],
  ['typo.au', 'typo', '\u1029\u1031\u102C\u103A', [0, 4], '\u102A'],
  ['typo.lagaung', 'typo', '\u1044\u1004\u103A\u1038', [0, 1], '\u104E'],
  ['nfc.order', 'nfc', '\u1000\u103A\u1037', [1, 3], '\u1037\u103A']
];

// The text with each issue's fix written over its span; issues that share a span share their fix.
function applyFixes(text, issues) {
  let out = '';
  let copied = 0;
  for (const issue of issues) {
    if (issue.start < copied) continue;
    out += text.slice(copied, issue.start) + issue.fix;
    copied = issue.end;
  }
  return out + text.slice(copied);
}

describe('explain, one issue per thing normalize changes (DESIGN.md §11.8)', () => {
  for (const [rule, kind, text, [start, end], fix] of EXAMPLES) {
    it(rule + ': ' + units(text), () => {
      const issues = explain(CONTEXT + text);
      const issue = issues.find((found) => found.rule === rule);
      assert.ok(issue, rule + ' among ' + JSON.stringify(issues.map((found) => found.rule)));
      const at = CONTEXT.length;
      assert.deepEqual(issue, { kind, rule, start: at + start, end: at + end, text: text.slice(start, end), fix });
    });
  }

  it('names a syllable\'s several changes as several issues on one span', () => {
    const issues = explain(CONTEXT + '\u1031\u1000\u102C\u102C');
    const at = CONTEXT.length;
    assert.deepEqual(issues.map((issue) => issue.rule).sort(), ['mark.repeated', 'order.prebase']);
    const fix = '\u1000\u1031\u102C';
    assert.ok(issues.every((issue) => issue.start === at && issue.end === at + 4 && issue.fix === fix));
  });

  it('finds nothing in normalized text, and nothing in text with no Myanmar', () => {
    assert.deepEqual(explain(normalize('\u1031\u1000\u102C\u1004\u103A\u1038 \u1040\u102C')), []);
    assert.deepEqual(explain('plain ASCII, and \u00E9'), []);
    assert.deepEqual(explain(''), []);
  });

  it('reads each line on its own: a Zawgyi line is one issue, fixed by conversion to Unicode', () => {
    const zawgyi = '\u1031\u1000\u102C\u1004\u1039\u1038 \u1031\u1019\u102C\u1004\u1039';
    assert.equal(detectEncoding(zawgyi).encoding, 'zawgyi');
    const first = CONTEXT + '\u1000\u102F\u102D';
    const third = CONTEXT + '\u1031\u1000';
    const text = first + '\n  ' + zawgyi + ' \n' + third;
    const issues = explain(text);
    const thirdAt = first.length + 5 + zawgyi.length + CONTEXT.length;
    assert.deepEqual(issues.map((issue) => [issue.rule, issue.start, issue.end]), [
      ['order.marks', CONTEXT.length, first.length], ['encoding.zawgyi', first.length + 3, first.length + 3 +
        zawgyi.length], ['order.prebase', thirdAt, thirdAt + 2]
    ]);
    assert.equal(issues[1].kind, 'zawgyi');
    assert.equal(issues[1].text, zawgyi);
    assert.equal(issues[1].fix, fontToUnicode(zawgyi, 'zawgyi'));
  });

  it('takes a ZawgyiDetector, as detectEncoding does', () => {
    const always = { getZawgyiProbability: () => 1 };
    assert.deepEqual(explain('\u1000\u102C', { zawgyiDetector: always }).map((issue) => issue.rule),
      ['encoding.zawgyi']);
    const never = { getZawgyiProbability: () => 0 };
    assert.deepEqual(explain('\u1031\u1000\u102C\u1004\u1039\u1038', { zawgyiDetector: never }).map((i) => i.kind)
      .indexOf('zawgyi'), -1);
  });

  it('throws coded errors for bad arguments, and is map-safe', () => {
    assert.throws(() => explain(1), { name: 'TypeError', code: 'ERR_KNAYI_INVALID_ARG_TYPE' });
    assert.throws(() => explain('a', 'x'), { name: 'TypeError', code: 'ERR_KNAYI_INVALID_ARG_TYPE' });
    assert.throws(() => explain('a', { zawgyiDetector: {} }), { code: 'ERR_KNAYI_INVALID_ARG_TYPE' });
    const lines = ['\u1031\u1000', '\u1000\u102C'];
    assert.deepEqual(lines.map(explain), lines.map((line) => explain(line)));
  });
});

describe('explain covers exactly what normalize changes', () => {
  it('its fixes, written into the text, give normalize\'s result on every line not read as Zawgyi', () => {
    const notZawgyi = (text) => text.split('\n').every((line) => detectEncoding(line).encoding !== 'zawgyi');
    fuzz.check(fc.property(fc.oneof(arb.unicodeText(16), arb.burmeseText), (text) => {
      if (!notZawgyi(text)) return;
      const issues = explain(text);
      assert.equal(units(applyFixes(text, issues)), units(normalize(text)), units(text));
      for (const issue of issues) assert.equal(text.slice(issue.start, issue.end), issue.text);
    }), 20000, [['\u1031\u1000\u102C\u102C'], ['\u1010\u102B\u1039\u1040'], ['\u102D\u102E\u102D']], 400000);
  });

  it('on the cached Unicode corpora, does the same, line by line', async (t) => {
    const corpora = await cachedCorpora();
    if (corpora.skip) return t.skip(corpora.skip);
    let lines = 0;
    let issues = 0;
    for (const id of ['flores', 'wikipedia', 'okell']) {
      for (const line of corpora.sets[id]) {
        if (detectEncoding(line).encoding === 'zawgyi') continue;
        const found = explain(line);
        assert.equal(applyFixes(line, found), normalize(line), id + ': ' + units(line));
        lines++;
        issues += found.length;
      }
    }
    t.diagnostic(lines + ' lines, ' + issues + ' issues');
  });
});
