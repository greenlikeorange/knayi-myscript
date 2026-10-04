// Edit lists (src/core/edits.js) and the edits the copy-through writers record (docs/next/DESIGN.md §11.3).
//
// - composeEdits: two passes of random edits over random text, composed, give the edits of both: applied to the
//   first input, they give the last output, they are in order and do not overlap, and no unit they leave out
//   changed.
// - The writers: with a log, each function gives exactly what it gives without one, and its edits, applied to its
//   input, give its output: the Unicode reader, the typing fixes, the font reader, the rule rows, NFC, and whole
//   pipelines through runStagesLogged.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { arb, fuzz, hex } from './helpers.mjs';
import { EditLog, composeEdits, shiftEdits, outputToInputOffsets } from '../../src/core/edits.js';
import { applyRuleRows, applyRuleRowsLogged, runStages, runStagesLogged } from '../../src/core/rules.js';
import { toNfc, logNfcEdits } from '../../src/core/nfc.js';
import { reorderUnicode, UNICODE_READING, STABLE_UNICODE_READING } from '../../src/engine/unicodeReader.js';
import { compileFont, readFontNoting, readFontLogged } from '../../src/engine/fontReader.js';
import { ZAWGYI_FONT } from '../../src/fonts/zawgyi.js';
import { WIN_FONT } from '../../src/fonts/win.js';
import {
  fixTypos, fixTyposLogged, settleTypos, settleTyposLogged, fixLookAlikes, fixLookAlikesLogged, readDigitsAsLetters,
  readLettersAsDigits, zeroAsWa, zeroAsWaLogged
} from '../../src/rules/typingFixes.js';
import { STABLE_NORMALIZE_STAGES, STABLE_NORMALIZE_LOGGED_RUNS } from '../../src/stages/normalize.js';
import { FONT_STAGES, fontToUnicode, fontToUnicodeLogged } from '../../src/stages/fonts.js';
import { UNICODE_TO_ZAWGYI_RULES } from '../../src/rules/unicodeToZawgyi.js';

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
  if (input.isWellFormed()) assertWholePairs(input, output, edits, what);
}

// No edit of well-formed text starts or ends between the two halves of a surrogate pair, in its input or its output,
// so a change it describes is well-formed text.
function assertWholePairs(input, output, edits, what) {
  const cutsPair = (text, at) => at > 0 && at < text.length && isHighSurrogate(text.charCodeAt(at - 1)) &&
    isLowSurrogate(text.charCodeAt(at));
  for (const edit of edits) {
    assert.ok(!cutsPair(input, edit.start) && !cutsPair(input, edit.end), what + ': an input pair cut');
    assert.ok(!cutsPair(output, edit.outStart) && !cutsPair(output, edit.outEnd), what + ': an output pair cut');
  }
}

const isHighSurrogate = (code) => code >= 0xD800 && code <= 0xDBFF;
const isLowSurrogate = (code) => code >= 0xDC00 && code <= 0xDFFF;

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

  it('keeps a surrogate pair whole, where the texts share one half of it', () => {
    // U+11131 U+11127 compose to U+1112E under NFC: the three share the high surrogate U+D804.
    const chakma = new EditLog('nfc');
    chakma.addChange(0, 'a\uD804\uDD31\uD804\uDD27', 0, 'a\uD804\uDD2E');
    assert.deepEqual(chakma.edits, [{ start: 1, end: 5, outStart: 1, outEnd: 3, rules: ['nfc'] }]);
    // U+1D16D U+1D165 are put in canonical order, U+1D165 U+1D16D: both halves are shared at one end only.
    const music = new EditLog('nfc');
    music.addChange(0, 'x\uD834\uDD6D\uD834\uDD65', 0, 'x\uD834\uDD65\uD834\uDD6D');
    assert.deepEqual(music.edits, [{ start: 1, end: 5, outStart: 1, outEnd: 5, rules: ['nfc'] }]);
    // A shared low surrogate at the end stays with its high one.
    const tail = new EditLog('r');
    tail.addChange(0, 'a\uD800\uDC00', 0, 'b\uD801\uDC00');
    assert.deepEqual(tail.edits, [{ start: 0, end: 3, outStart: 0, outEnd: 3, rules: ['r'] }]);
    const kept = new EditLog('r');
    kept.addChange(0, '\uD800\uDC00a', 0, '\uD800\uDC00b');
    assert.deepEqual(kept.edits, [{ start: 2, end: 3, outStart: 2, outEnd: 3, rules: ['r'] }], 'a whole pair is shared');
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

const ZAWGYI = compileFont(ZAWGYI_FONT);
const WIN = compileFont(WIN_FONT);

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
      assertLogs('fixTypos', text, fixTypos, fixTyposLogged);
      assertLogs('settleTypos', text, settleTypos, settleTyposLogged);
      assertLogs('fixLookAlikes', text, fixLookAlikes, fixLookAlikesLogged);
      assertLogs('readDigitsAsLetters', text, readDigitsAsLetters, readDigitsAsLetters);
      assertLogs('readLettersAsDigits', text, readLettersAsDigits, readLettersAsDigits);
      assertLogs('zeroAsWa', text, zeroAsWa, zeroAsWaLogged);
    }), 20000, [], 400000);
  });

  it('the font reader, Zawgyi and Win', () => {
    fuzz.check(fc.property(arb.zawgyiText(16), arb.winText(16), (zawgyi, win) => {
      for (const [text, font] of [[zawgyi, ZAWGYI], [win, WIN]]) {
        assertLogs('readFont ' + font.name, text, (t) => readFontNoting(t, font).text,
          (t, log) => readFontLogged(t, font, log).text);
        // The logged reader is a loop of its own: it notes the same NFC risk as the fast one.
        assert.equal(readFontLogged(text, font, new EditLog('')).nfcMayChange, readFontNoting(text, font).nfcMayChange);
      }
    }), 20000, [], 400000);
  });

  it('the rule rows, once and repeated, and NFC', () => {
    fuzz.check(fc.property(unicodeText, arb.zawgyiText(16), (text, zawgyi) => {
      assertLogs('rows', text, (t) => applyRuleRows(t, UNICODE_TO_ZAWGYI_RULES),
        (t, log) => applyRuleRowsLogged(t, UNICODE_TO_ZAWGYI_RULES, log));
      assertLogs('sequences', zawgyi, (t) => applyRuleRows(t, ZAWGYI.sequences),
        (t, log) => applyRuleRowsLogged(t, ZAWGYI.sequences, log));
      assertLogs('NFC', text + '\u0301\u0323', toNfc, (t, log) => {
        assert.equal(logNfcEdits(t, log), toNfc(t).length);
        return toNfc(t);
      });
    }), 20000, ['\u1000\u103A\u1037', 'e\u0301\u0323', '\u1025\u102E'].map((t) => [t, '']), 400000);
  });

  it('whole pipelines, through runStagesLogged', () => {
    fuzz.check(fc.property(unicodeText, arb.zawgyiText(16), arb.winText(16), (text, zawgyi, win) => {
      const ctx = () => ({ openAllGates: false, seen: 0 });
      assertLogs('normalize stages', text, (t) => runStages(t, STABLE_NORMALIZE_STAGES, ctx(), null),
        (t, log) => runStagesLogged(t, STABLE_NORMALIZE_STAGES, STABLE_NORMALIZE_LOGGED_RUNS, ctx(), log));
      assertLogs('fontToUnicode zawgyi', zawgyi, (t) => fontToUnicode(t, 'zawgyi'),
        (t, log) => fontToUnicodeLogged(t, 'zawgyi', log));
      assertLogs('fontToUnicode win', win, (t) => fontToUnicode(t, 'win'),
        (t, log) => fontToUnicodeLogged(t, 'win', log));
    }), 10000, [], 300000);
  });

  it('every stage of FONT_STAGES and the normalize lists names its edits by its id', () => {
    const log = new EditLog('');
    fontToUnicodeLogged('\u1031\u1000\u102C\u1004\u1039\u1038 \u1040', 'zawgyi', log);
    const ids = new Set(FONT_STAGES.map((stage) => stage.id));
    assert.ok(log.edits.length > 0 && log.edits.every((edit) => edit.rules.every((rule) => ids.has(rule))));
  });
});
