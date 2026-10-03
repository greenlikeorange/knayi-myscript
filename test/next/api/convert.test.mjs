// toUnicode and toZawgyi of the 3.0 API (docs/next/DESIGN.md §11.5, §11.3, §11.4; decision 13).
//
// - The conversions are 2.x fontConvert's, without its trim: equal on fuzz wherever 2.x had nothing to trim.
// - toUnicode with no `from` detects each line; a tie stays as it is unless tie: 'zawgyi'.
// - The trace and the offsets: their shape, and that they describe the call's own result.
// - The tie damage of decision 13, recounted on the cached corpora (plan §7 item 7) and recorded here.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { arb, fuzz } from '../helpers.mjs';
import { units, cachedCorpora } from './helpers.mjs';
import { toUnicode, toZawgyi, createTrace, detectEncoding } from '../../../src/index.js';
import { FONT_STAGES, fontToUnicode, traceFontToUnicode } from '../../../src/stages/fonts.js';
import { fontConvert } from '../../../src/compat/index.js';

const ZAWGYI = '\u1031\u1000\u102C\u1004\u1039\u1038 \u1031\u1019\u102C\u1004\u1039';
const ZAWGYI_IN_UNICODE = '\u1000\u1031\u102C\u1004\u103A\u1038 \u1019\u1031\u102C\u1004\u103A';
const UNICODE = '\u1014\u103E\u1004\u103A\u1038 \u1000\u103B\u1031\u102C\u1004\u103A\u1038';
const TIE = '\u1000\u1001\u1002';

const hasNothingToTrim = (text) => text === text.trim();
const hasMyanmar = (text) => /[\u1000-\u109F]/.test(text);

describe('toUnicode (DESIGN.md §11.5)', () => {
  it('converts as 2.x fontConvert does, Zawgyi and Win, where 2.x had nothing to trim', () => {
    fuzz.check(fc.property(arb.zawgyiText(16), arb.winText(16), (zawgyi, win) => {
      const converted = hasMyanmar(zawgyi) ? fontToUnicode(zawgyi, 'zawgyi') : zawgyi;
      assert.equal(toUnicode(zawgyi, { from: 'zawgyi' }), converted);
      if (hasNothingToTrim(zawgyi)) {
        assert.equal(toUnicode(zawgyi, { from: 'zawgyi' }), fontConvert(zawgyi, 'unicode', 'zawgyi'), units(zawgyi));
      }
      if (hasNothingToTrim(win)) assert.equal(toUnicode(win, { from: 'win' }), fontConvert(win, 'unicode', 'win'));
    }), 30000, [[ZAWGYI, 'aMomf']], 600000);
  });

  it('never trims, and leaves Unicode as it is', () => {
    assert.equal(toUnicode('  ' + ZAWGYI + ' \n', { from: 'zawgyi' }), '  ' + ZAWGYI_IN_UNICODE + ' \n');
    assert.equal(toUnicode(' ' + ZAWGYI + ' '), ' ' + ZAWGYI_IN_UNICODE + ' ');
    assert.equal(toUnicode(ZAWGYI, { from: 'unicode' }), ZAWGYI);
    // Zawgyi text with no Myanmar-block character has nothing to convert, as in 2.x; Win text is ASCII.
    assert.equal(toUnicode('e\u0301', { from: 'zawgyi' }), 'e\u0301');
    assert.equal(toUnicode('k', { from: 'win' }), fontToUnicode('k', 'win'));
  });

  it('with no source, detects each line, and leaves a line whose evidence ties as it is', () => {
    const text = UNICODE + '\n' + ZAWGYI + '\n' + TIE + '\nabc';
    assert.equal(detectEncoding(TIE).encoding, 'unknown');
    assert.equal(toUnicode(text), UNICODE + '\n' + ZAWGYI_IN_UNICODE + '\n' + TIE + '\nabc');
    assert.equal(toUnicode(text, { tie: 'zawgyi' }), UNICODE + '\n' + ZAWGYI_IN_UNICODE + '\n' +
      fontToUnicode(TIE, 'zawgyi') + '\nabc');
    assert.equal(toUnicode(text, { tie: 'unicode' }), toUnicode(text));
    const always = { getZawgyiProbability: () => 1 };
    assert.equal(toUnicode(UNICODE, { zawgyiDetector: always }), fontToUnicode(UNICODE, 'zawgyi'));
  });

  it('converts each line as it would alone, so a text converts as its lines do', () => {
    fuzz.check(fc.property(arb.zawgyiText(12), arb.zawgyiText(12), (a, b) => {
      for (const options of [{ from: 'zawgyi' }, {}]) {
        assert.equal(toUnicode(a + '\n' + b, options), toUnicode(a, options) + '\n' + toUnicode(b, options),
          units(a) + ' | ' + units(b));
      }
    }), 30000, [], 600000);
  });
});

describe('toUnicode\'s trace and offsets (DESIGN.md §11.3, §11.4)', () => {
  const stageIds = FONT_STAGES.map((stage) => stage.id);

  it('traces the font pipeline as 2.x\'s debug log does, by stage id', () => {
    const trace = createTrace();
    const out = toUnicode(ZAWGYI, { from: 'zawgyi', trace });
    const core = createTrace();
    traceFontToUnicode(ZAWGYI, 'zawgyi', core);
    assert.deepEqual(trace, core);
    assert.equal(trace.records[trace.records.length - 1].text, out);
  });

  it('traces a text of several lines as the whole text, stage by stage', () => {
    fuzz.check(fc.property(fc.array(fc.oneof(arb.zawgyiText(10), arb.unicodeText(10)), { maxLength: 4 }), (lines) => {
      const text = lines.join('\n');
      const trace = createTrace();
      const out = toUnicode(text, { trace });
      assert.equal(trace.start, text);
      let last = -1;
      for (const record of trace.records) {
        const at = stageIds.indexOf(record.id);
        assert.ok(at > last, 'records in stage order');
        last = at;
      }
      const end = trace.records.length ? trace.records[trace.records.length - 1].text : text;
      assert.equal(end, out, units(text));
    }), 10000, [], 200000);
  });

  it('maps each output unit to the input unit it came from, never backwards', () => {
    fuzz.check(fc.property(fc.array(fc.oneof(arb.zawgyiText(10), arb.unicodeText(10), arb.winText(6)),
      { maxLength: 4 }), fc.constantFrom(undefined, 'zawgyi', 'win'), (lines, from) => {
      const text = lines.join('\n');
      const result = toUnicode(text, { from, offsets: true });
      assert.equal(result.text, toUnicode(text, { from }));
      const offsets = result.offsets;
      assert.equal(offsets.length, result.text.length + 1);
      assert.equal(offsets[result.text.length], text.length);
      for (let j = 0; j < result.text.length; j++) {
        assert.ok(offsets[j] <= offsets[j + 1] && offsets[j] >= 0 && offsets[j] < text.length, units(text));
      }
    }), 20000, [], 400000);
  });

  it('maps a line it leaves alone unit for unit, and a converted syllable to where it began', () => {
    const result = toUnicode('abc\n' + ZAWGYI, { offsets: true });
    assert.deepEqual(result.offsets.slice(0, 5), [0, 1, 2, 3, 4]);
    // e typed before its consonant: ka and e, swapped, both come from the pair's start; aa kept its place.
    assert.deepEqual(result.offsets.slice(4, 8), [4, 4, 6, 7]);
    assert.equal(result.offsets[result.text.length], 4 + ZAWGYI.length);
  });
});

describe('toZawgyi (DESIGN.md §11.5)', () => {
  it('converts as 2.x fontConvert does, where 2.x had nothing to trim', () => {
    fuzz.check(fc.property(arb.unicodeText(16), (text) => {
      if (!hasNothingToTrim(text) || !hasMyanmar(text)) return;
      assert.equal(toZawgyi(text), fontConvert(text, 'zawgyi', 'unicode'), units(text));
    }), 30000, [[ZAWGYI_IN_UNICODE]], 600000);
    assert.equal(toZawgyi(' \u1000\u102C '), ' \u1000\u102C ');
  });

  it('traces the collapse and each rule row that changed the text, by id, from the input', () => {
    const text = '\u1000\u103C\u102C\u102C\u1038';
    const trace = createTrace();
    const out = toZawgyi(text, { trace });
    assert.equal(trace.start, text);
    assert.equal(trace.records[0].id, 'uz.collapse');
    assert.equal(trace.records[0].text, '\u1000\u103C\u102C\u1038');
    assert.ok(trace.records.slice(1).every((record) => /^uz\.[a-z-]+\.\d+$/.test(record.id)));
    assert.equal(trace.records[trace.records.length - 1].text, out);
  });
});

describe('the conversions\' arguments (DESIGN.md §11.1)', () => {
  it('throw coded errors', () => {
    const typeError = { name: 'TypeError', code: 'ERR_KNAYI_INVALID_ARG_TYPE' };
    const rangeError = { name: 'RangeError', code: 'ERR_KNAYI_INVALID_ARG_VALUE' };
    assert.throws(() => toUnicode(1), typeError);
    assert.throws(() => toUnicode('a', { from: 'Zawgyi' }), rangeError);
    assert.throws(() => toUnicode('a', { from: 'zaw' }), rangeError);
    assert.throws(() => toUnicode('a', { from: 1 }), typeError);
    assert.throws(() => toUnicode('a', { tie: 'win' }), rangeError);
    assert.throws(() => toUnicode('a', { offsets: 'yes' }), typeError);
    assert.throws(() => toUnicode('a', { trace: [] }), typeError);
    assert.throws(() => toZawgyi(undefined), typeError);
    assert.throws(() => toZawgyi('a', { trace: 'x' }), typeError);
  });

  it('are map-safe', () => {
    const lines = [ZAWGYI, UNICODE, TIE];
    assert.deepEqual(lines.map(toUnicode), lines.map((line) => toUnicode(line)));
    assert.deepEqual(lines.map(toZawgyi), lines.map((line) => toZawgyi(line)));
  });
});

describe('the tie damage of decision 13, on the cached corpora (plan §7 item 7)', () => {
  // Distinct lines of each corpus that converting to Unicode with no source named changes: 2.x fontConvert(line,
  // 'unicode'), which reads a tie as Zawgyi, against 3.0 toUnicode(line), which leaves it, and toUnicode with
  // tie: 'zawgyi', which reads it as 2.x did. Every line of these corpora is Unicode, so every change is damage.
  // wikipedia-v1 and okell are the plan's own figures (504 and 553 lines before, 2 and 3 after); wikipedia is the
  // v2 sample. The 493 lines of S'gaw Karen (ksw) the 3.0 count still changes read as Zawgyi, not as ties.
  const RECORDED = {
    flores: [2009, 0, 0], wikipedia: [4812, 168, 0], 'wikipedia-v1': [10732, 504, 2], okell: [16924, 553, 3],
    shn: [9923, 540, 9], mnw: [2270, 215, 13], ksw: [673, 606, 493], blk: [770, 85, 0]
  };

  it('drops from hundreds of lines a corpus to a few, and tie: \'zawgyi\' restores 2.x\'s reading', async (t) => {
    const corpora = await cachedCorpora();
    if (corpora.skip) return t.skip(corpora.skip);
    const counts = {};
    for (const id of Object.keys(RECORDED)) {
      const lines = corpora.sets[id];
      let before = 0;
      let after = 0;
      let asZawgyi = 0;
      for (const line of lines) {
        if (fontConvert(line, 'unicode') !== line.trim()) before++;
        if (toUnicode(line) !== line) after++;
        if (toUnicode(line, { tie: 'zawgyi' }) !== line) asZawgyi++;
      }
      counts[id] = [lines.length, before, after];
      assert.equal(asZawgyi, before, id + ': tie: \'zawgyi\' reads as 2.x');
    }
    assert.deepEqual(counts, RECORDED);
  });

  it('costs short Zawgyi text named by no source: Google\'s pairs, 79 of 80 right in 2.x, 49 in 3.0', async (t) => {
    const corpora = await cachedCorpora();
    if (corpora.skip) return t.skip(corpora.skip);
    const right = { before: 0, after: 0, tie: 0, named: 0 };
    for (const [zawgyi, unicode] of corpora.google) {
      if (fontConvert(zawgyi, 'unicode') === unicode.trim()) right.before++;
      if (toUnicode(zawgyi).trim() === unicode.trim()) right.after++;
      if (toUnicode(zawgyi, { tie: 'zawgyi' }).trim() === unicode.trim()) right.tie++;
      if (toUnicode(zawgyi, { from: 'zawgyi' }).trim() === unicode.trim()) right.named++;
    }
    assert.equal(corpora.google.length, 80);
    assert.deepEqual(right, { before: 79, after: 49, tie: 79, named: 80 });
  });
});
