// Edit lists (src/core/edits.js) and the edits the copy-through writers record (docs/next/DESIGN.md §11.3).
//
// - composeEdits: two passes of random edits over random text, composed, give the edits of both: applied to the
//   first input, they give the last output, they are in order and do not overlap, and no unit they leave out
//   changed.
// - The writers: with a log, each function gives exactly what it gives without one, and its edits, applied to its
//   input, give its output: the Unicode reader, the typing fixes, NFC, and the stable normalize pipeline through
//   runStagesLogged.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { arb, fuzz, hex } from './helpers.mjs';
import { EditLog, composeEdits, shiftEdits, outputToInputOffsets } from '../../src/core/edits.js';
import { runStages, runStagesLogged } from '../../src/core/rules.js';
import { toNfc, logNfcEdits } from '../../src/core/nfc.js';
import { reorderUnicode, UNICODE_READING, STABLE_UNICODE_READING } from '../../src/engine/unicodeReader.js';
import {
  settleTypos, settleTyposLogged, fixLookAlikes, fixLookAlikesLogged, readDigitsAsLetters, readLettersAsDigits
} from '../../src/rules/typingFixes.js';
import { STABLE_NORMALIZE_STAGES, STABLE_NORMALIZE_LOGGED_RUNS } from '../../src/stages/normalize.js';

// Applies edits to text: the units between them are copied, and each edit's input is replaced by `output`'s slice.
function applyEdits(text, edits, output) {
  let out = '';
  let copied = 0;
  for (const edit of edits) {
    out += text.slice(copied, edit.start) + output.slice(edit.outStart, edit.outEnd);
    copied = edit.end;
  }
  return out + text.slice(copied);
}

// The edits are in order, do not overlap, and agree with both texts: the units between them are the same in both.
function assertAligns(input, output, edits, what) {
  let inputAt = 0;
  let outputAt = 0;
  for (const edit of edits) {
    assert.ok(edit.start >= inputAt && edit.end >= edit.start, what + ': input ranges in order');
    assert.ok(edit.outStart >= outputAt && edit.outEnd >= edit.outStart, what + ': output ranges in order');
    assert.equal(edit.start - inputAt, edit.outStart - outputAt, what + ': the units between edits are copied');
    assert.equal(input.slice(inputAt, edit.start), output.slice(outputAt, edit.outStart), what + ': unchanged units');
    inputAt = edit.end;
    outputAt = edit.outEnd;
    assert.ok(Array.isArray(edit.rules) && edit.rules.length > 0, what + ': rules');
  }
  assert.equal(input.slice(inputAt), output.slice(outputAt), what + ': the tail is copied');
  assert.equal(applyEdits(input, edits, output), output, what + ': the edits make the output');
}

// A random pass over text: random spans replaced by random text, in order. [output, edits].
const randomPass = (text, cuts, rule) => {
  const log = new EditLog(rule);
  let out = '';
  let copied = 0;
  for (const [at, length, replacement] of cuts) {
    const start = Math.max(copied, Math.min(text.length, at));
    const end = Math.min(text.length, start + length);
    out += text.slice(copied, start);
    log.add(start, end, out.length, out.length + replacement.length);
    out += replacement;
    copied = end;
  }
  return [out + text.slice(copied), log.edits];
};

const replacement = fc.string({ unit: fc.constantFrom('a', 'b', 'c'), maxLength: 4 });
const cutsOf = fc.array(fc.tuple(fc.nat(20), fc.nat(4), replacement), { maxLength: 6 })
  .map((cuts) => cuts.sort((x, y) => x[0] - y[0]));

describe('composeEdits (DESIGN.md §11.3)', () => {
  it('composes two passes of random edits into edits of both', () => {
    const text = fc.string({ unit: fc.constantFrom('x', 'y', 'z'), maxLength: 20 });
    fuzz.check(fc.property(text, cutsOf, cutsOf, (input, firstCuts, secondCuts) => {
      const [middle, first] = randomPass(input, firstCuts, 'first');
      const [output, second] = randomPass(middle, secondCuts, 'second');
      const composed = composeEdits(first, second);
      assertAligns(input, output, composed, 'composed');
      for (const edit of composed) assert.ok(edit.rules.every((rule) => rule === 'first' || rule === 'second'));
    }), 20000, [], 400000);
  });

  it('joins overlapping edits, keeps touching ones apart, and lists each rule once, in order', () => {
    const first = [{ start: 1, end: 3, outStart: 1, outEnd: 2, rules: ['a'] }];
    const second = [{ start: 1, end: 2, outStart: 1, outEnd: 4, rules: ['b'] }, { start: 2, end: 3, outStart: 4,
      outEnd: 5, rules: ['a'] }];
    assert.deepEqual(composeEdits(first, second), [
      { start: 1, end: 3, outStart: 1, outEnd: 4, rules: ['a', 'b'] },
      { start: 3, end: 4, outStart: 4, outEnd: 5, rules: ['a'] }
    ]);
    assert.deepEqual(composeEdits([], second), second.map((edit) => Object.assign({}, edit)));
  });

  it('records nothing for a change that changes nothing, and only the units that differ', () => {
    const log = new EditLog('r');
    log.addChange(4, 'abc', 6, 'abc');
    assert.ok(log.isEmpty());
    log.addChange(4, 'abcd', 6, 'abXd');
    assert.deepEqual(log.edits, [{ start: 6, end: 7, outStart: 8, outEnd: 9, rules: ['r'] }]);
  });

  it('maps every output unit to the input it came from, never backwards', () => {
    const edits = [{ start: 1, end: 3, outStart: 1, outEnd: 4, rules: [] }, { start: 5, end: 5, outStart: 6,
      outEnd: 7, rules: [] }];
    assert.deepEqual(outputToInputOffsets(edits, 8), [0, 1, 1, 1, 3, 4, 5, 5, 6]);
    assert.deepEqual(shiftEdits(edits, 10, 20)[1], { start: 15, end: 15, outStart: 26, outEnd: 27, rules: [] });
  });
});

// Runs fn(text, log) and fn without a log, and checks the two agree and the log aligns input and output.
function assertLogs(what, text, plain, logged) {
  const log = new EditLog(what);
  const output = logged(text, log);
  assert.equal(output, plain(text), what + ' with a log on ' + hex(text));
  assertAligns(text, output, log.edits, what + ' on ' + hex(text));
}

describe('the copy-through writers record their edits (DESIGN.md §11.3)', () => {
  const unicodeText = arb.unicodeText(16);
  it('the Unicode reader, both readings', () => {
    fuzz.check(fc.property(unicodeText, (text) => {
      const nfc = toNfc(text);
      for (const reading of [UNICODE_READING, STABLE_UNICODE_READING]) {
        assertLogs('reorderUnicode', nfc, (t) => reorderUnicode(t, reading).text,
          (t, log) => reorderUnicode(t, reading, log).text);
      }
    }), 20000, [], 400000);
  });

  it('the typing fixes', () => {
    fuzz.check(fc.property(unicodeText, (text) => {
      assertLogs('settleTypos', text, settleTypos, settleTyposLogged);
      assertLogs('fixLookAlikes', text, fixLookAlikes, fixLookAlikesLogged);
      assertLogs('readDigitsAsLetters', text, readDigitsAsLetters, readDigitsAsLetters);
      assertLogs('readLettersAsDigits', text, readLettersAsDigits, readLettersAsDigits);
    }), 20000, [], 400000);
  });

  it('NFC', () => {
    fuzz.check(fc.property(unicodeText, (text) => {
      assertLogs('NFC', text + '\u0301\u0323', toNfc, (t, log) => {
        assert.equal(logNfcEdits(t, log), toNfc(t).length);
        return toNfc(t);
      });
    }), 20000, ['\u1000\u103A\u1037', 'e\u0301\u0323', '\u1025\u102E'].map((t) => [t]), 400000);
  });

  it('the stable normalize pipeline, through runStagesLogged', () => {
    fuzz.check(fc.property(unicodeText, (text) => {
      const ctx = () => ({ openAllGates: false, seen: 0 });
      assertLogs('normalize stages', text, (t) => runStages(t, STABLE_NORMALIZE_STAGES, ctx(), null),
        (t, log) => runStagesLogged(t, STABLE_NORMALIZE_STAGES, STABLE_NORMALIZE_LOGGED_RUNS, ctx(), log));
    }), 10000, [], 300000);
  });
});
