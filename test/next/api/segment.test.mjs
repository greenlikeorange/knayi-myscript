// segmentSyllables, syllableBoundaries, truncate and collapseRepeatedMarks of the 3.0 API (docs/next/DESIGN.md
// §11.6, §11.7; decision 34).
//
// - Lossless: the syllables join back to the text under every policy and font, ZWNJ and all.
// - 'pairs' is 2.x syllBreak's reading; 'separate', the default, gives the syllables of UTN #11.
// - The counts decision 34 chose the default from, recounted on the cached corpora and recorded.
// - truncate always returns a prefix of the text, then the omission, within `length`.
// - collapseRepeatedMarks is 2.x spellingFix without its trim and its removal of zero-width characters.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { arb, fuzz } from '../helpers.mjs';
import { units, cachedCorpora } from './helpers.mjs';
import { segmentSyllables, syllableBoundaries, truncate, collapseRepeatedMarks } from '../../../src/index.js';
import { syllBreak, spellingFix } from '../../../src/compat/index.js';

const FIRST = '\u1015\u1011\u1019\u1006\u102F\u1036\u1038'; // ပထမဆုံး, first
const POLICIES = ['separate', 'chains', 'pairs'];
const FONTS = ['unicode', 'zawgyi'];

// 2.x cleaned the text before it broke it: trimmed, without U+200B and U+200C. Removing them can leave white space
// at an end, and 2.x cleans again where it calls its detector, so the text here is cleaned until it stays the same.
function cleaned(text) {
  for (;;) {
    const next = text.trim().replace(/[\u200B\u200C]/g, '');
    if (next === text) return text;
    text = next;
  }
}

describe('segmentSyllables and syllableBoundaries (DESIGN.md §11.6)', () => {
  it('read a bare consonant as a syllable of its own by default; the other policies on request', () => {
    assert.deepEqual(segmentSyllables(FIRST), ['\u1015', '\u1011', '\u1019', '\u1006\u102F\u1036\u1038']);
    assert.deepEqual(segmentSyllables(FIRST, { policy: 'separate' }), segmentSyllables(FIRST));
    assert.deepEqual(segmentSyllables(FIRST, { policy: 'pairs' }), ['\u1015\u1011', '\u1019\u1006\u102F\u1036\u1038']);
    assert.deepEqual(segmentSyllables(FIRST, { policy: 'chains' }), [FIRST]);
    assert.deepEqual(syllableBoundaries(FIRST), [1, 2, 3]);
    assert.deepEqual(segmentSyllables(''), []);
    assert.deepEqual(syllableBoundaries(''), []);
  });

  it('end a piece at white space, and start one at the opening marks before a syllable, unless policy is \'pairs\'', () => {
    const GOOD = '\u1000\u1031\u102C\u1004\u103A\u1038'; // ကောင်း
    const MAUNG = '\u1019\u1031\u102C\u1004\u103A'; // မောင်
    assert.deepEqual(segmentSyllables(GOOD + ' ' + MAUNG), [GOOD + ' ', MAUNG]);
    assert.deepEqual(segmentSyllables(GOOD + '\n' + MAUNG), [GOOD + '\n', MAUNG]);
    assert.deepEqual(segmentSyllables(GOOD + ' (' + MAUNG + ')'), [GOOD + ' ', '(' + MAUNG + ')']);
    assert.deepEqual(segmentSyllables(GOOD + '(' + MAUNG + ')'), [GOOD, '(' + MAUNG + ')']);
    assert.deepEqual(segmentSyllables(GOOD + ' ' + MAUNG, { policy: 'chains' }), [GOOD + ' ', MAUNG]);
    assert.deepEqual(segmentSyllables(GOOD + ' ' + MAUNG, { policy: 'pairs' }), [GOOD + ' ' + MAUNG]);
    assert.deepEqual(segmentSyllables(' ' + MAUNG + ' '), [' ', MAUNG + ' ']);
    assert.deepEqual(syllableBoundaries(GOOD + ' ' + MAUNG), [GOOD.length + 1]);
  });

  it('are lossless under every policy and font: the pieces join to the text, none empty', () => {
    const text = fc.oneof(arb.unicodeText(16), arb.zawgyiText(16), arb.burmeseText, arb.codeUnits);
    fuzz.check(fc.property(text, fc.constantFrom(...POLICIES), fc.constantFrom(...FONTS), (x, policy, font) => {
      const pieces = segmentSyllables(x, { policy, font });
      assert.equal(pieces.join(''), x, units(x));
      assert.ok(pieces.every((piece) => piece.length > 0));
      const boundaries = syllableBoundaries(x, { policy, font });
      let at = 0;
      assert.deepEqual(boundaries, pieces.slice(0, -1).map((piece) => (at += piece.length)));
    }), 30000, [['\u1000\u200C\u102C\u200B\u1001'], [FIRST]], 600000);
  });

  it('read with \'pairs\' as 2.x syllBreak does, on the text 2.x breaks', () => {
    fuzz.check(fc.property(fc.oneof(arb.unicodeText(16), arb.burmeseText), arb.zawgyiText(16), (unicode, zawgyi) => {
      for (const [text, font] of [[cleaned(unicode), 'unicode'], [cleaned(zawgyi), 'zawgyi']]) {
        // 2.x swapped asat and dot below before breaking Unicode text (row U1); the lossless pieces keep them.
        if (!/[\u1000-\u109F]/.test(text) || (font === 'unicode' && text.indexOf('\u103A\u1037') !== -1)) continue;
        assert.equal(segmentSyllables(text, { policy: 'pairs', font }).join('|'), syllBreak(text, font, '|'),
          font + ': ' + units(text));
      }
    }), 30000, [[FIRST, '\u1031\u1000']], 600000);
  });

  it('throw coded errors for bad options, and are map-safe', () => {
    const rangeError = { name: 'RangeError', code: 'ERR_KNAYI_INVALID_ARG_VALUE' };
    const typeError = { name: 'TypeError', code: 'ERR_KNAYI_INVALID_ARG_TYPE' };
    assert.throws(() => segmentSyllables(FIRST, { policy: 'words' }), rangeError);
    assert.throws(() => segmentSyllables(FIRST, { font: 'win' }), rangeError);
    assert.throws(() => syllableBoundaries(FIRST, { policy: 1 }), typeError);
    assert.throws(() => segmentSyllables(null), typeError);
    const lines = [FIRST, '\u1000\u102C\u1001'];
    assert.deepEqual(lines.map(segmentSyllables), lines.map((line) => segmentSyllables(line)));
    assert.deepEqual(lines.map(syllableBoundaries), lines.map((line) => syllableBoundaries(line)));
  });
});

describe('the counts decision 34 chose the default policy from (DESIGN.md §11.6)', () => {
  // Per corpus, its distinct lines with a Myanmar-block character: the lines whose pieces under 'chains' and under
  // 'separate' differ from 'pairs' (2.x), the pieces of each policy, and the pieces of 'pairs' and of 'chains' that
  // hold more than one syllable of 'separate'. mC4 is read as Zawgyi. 'pairs' joins syllables across white space,
  // as 2.x did; the other two do not.
  const RECORDED = {
    flores: [2009, 2009, 2009, 65805, 82744, 94504, 21684, 11017],
    wikipedia: [4812, 4309, 4505, 120363, 156268, 180713, 44148, 21267],
    okell: [16924, 15452, 15952, 588013, 807703, 926287, 248545, 109825],
    mc4: [14304, 13257, 13784, 618033, 774647, 923016, 230190, 136018],
    shn: [9923, 7332, 7444, 186348, 240191, 242763, 46648, 2421],
    mnw: [2270, 2110, 2200, 76094, 95473, 116896, 30472, 18602]
  };

  it('recounts them on the cached corpora', async (t) => {
    const corpora = await cachedCorpora();
    if (corpora.skip) return t.skip(corpora.skip);
    const counts = {};
    for (const id of Object.keys(RECORDED)) {
      const font = id === 'mc4' ? 'zawgyi' : 'unicode';
      const lines = corpora.sets[id].filter((line) => /[\u1000-\u109F]/.test(line));
      const row = [lines.length, 0, 0, 0, 0, 0, 0, 0];
      for (const line of lines) {
        const [pairs, chains, separate] = ['pairs', 'chains', 'separate'].map((policy) =>
          segmentSyllables(line, { policy, font }));
        const syllables = syllableBoundaries(line, { policy: 'separate', font });
        if (chains.join('|') !== pairs.join('|')) row[1]++;
        if (separate.join('|') !== pairs.join('|')) row[2]++;
        row[3] += pairs.length;
        row[4] += chains.length;
        row[5] += separate.length;
        row[6] += piecesHoldingSeveral(pairs, syllables);
        row[7] += piecesHoldingSeveral(chains, syllables);
      }
      counts[id] = row;
    }
    assert.deepEqual(counts, RECORDED);
  });
});

// How many pieces hold a boundary of `boundaries` inside them.
function piecesHoldingSeveral(pieces, boundaries) {
  const inside = new Set(boundaries);
  let count = 0;
  let at = 0;
  for (const piece of pieces) {
    for (let k = at + 1; k < at + piece.length; k++) {
      if (inside.has(k)) {
        count++;
        break;
      }
    }
    at += piece.length;
  }
  return count;
}

describe('truncate (DESIGN.md §11.7)', () => {
  // A line like the pangram of MIGRATION.md's truncate examples, which 2.x truncate cuts into text that is no prefix
  // of it (DESIGN.md §10 Q5).
  const PANGRAM = '\u101E\u102E\u101F\u102D\u102F\u1020\u103A\u1000\u1031\u102C\u1004\u103A\u1038\u1000\u102C\u1038' +
    ' \u1012\u1031\u102C\u1004\u103A\u1038\u1001\u101B\u1019\u1038\u1006\u1004\u1037\u103A \u1019\u1031\u101C\u1000' +
    '\u103B\u1004\u103A \u1007\u101C\u103D\u1014\u103A \u1005\u102C\u1000\u102D\u102F \u1008\u1031\u1038';

  it('returns the text when it fits, else a prefix cut at a syllable, then the omission', () => {
    assert.equal(truncate('short'), 'short');
    assert.equal(truncate(FIRST + FIRST, { length: 6, omission: '.' }), '\u1015\u1011\u1019.');
    assert.equal(truncate(FIRST + FIRST, { length: 6, omission: '.', policy: 'pairs' }), '\u1015\u1011.');
    const cut = truncate(PANGRAM, { length: 30 });
    assert.ok(cut.length <= 30 && cut.endsWith('...'));
    assert.ok(PANGRAM.startsWith(cut.slice(0, -3)), 'a prefix');
    assert.equal(truncate('hello world', { length: 8 }), 'hello...', 'no white space before the omission');
  });

  it('reads undefined and null as the defaults, 30 and \'...\', and takes an empty omission', () => {
    const long = FIRST.repeat(10);
    assert.equal(truncate(long), truncate(long, { length: 30, omission: '...' }));
    assert.equal(truncate(long, { length: null, omission: null }), truncate(long));
    assert.equal(truncate(long, { length: 7, omission: '' }), long.slice(0, 7));
    assert.equal(truncate('abc', { length: 0, omission: '' }), '');
  });

  it('never splits a surrogate pair or cuts before a combining mark', () => {
    assert.equal(truncate('\uD83D\uDE00\uD83D\uDE00', { length: 3, omission: '' }), '\uD83D\uDE00');
    assert.equal(truncate('ae\u0301b', { length: 2, omission: '' }), 'a');
  });

  it('always gives a prefix, then the omission, within the length', () => {
    const text = fc.oneof(arb.unicodeText(24), arb.burmeseText, arb.codeUnits, fc.string());
    const options = fc.record({ length: fc.integer({ min: 3, max: 40 }), omission: fc.constantFrom('...', '', '\u2026'),
      policy: fc.constantFrom(...POLICIES) });
    fuzz.check(fc.property(text, options, (x, settings) => {
      const out = truncate(x, settings);
      assert.ok(out.length <= settings.length, units(x));
      if (out === x) return;
      assert.ok(out.endsWith(settings.omission));
      const kept = out.slice(0, out.length - settings.omission.length);
      assert.ok(x.startsWith(kept), units(x) + ' gives ' + units(out));
    }), 30000, [[PANGRAM, { length: 30, omission: '...', policy: 'separate' }]], 600000);
  });

  it('throws coded errors for bad options', () => {
    const rangeError = { name: 'RangeError', code: 'ERR_KNAYI_INVALID_ARG_VALUE' };
    const typeError = { name: 'TypeError', code: 'ERR_KNAYI_INVALID_ARG_TYPE' };
    assert.throws(() => truncate('abc', { length: 2 }), rangeError, 'no room for the omission');
    assert.throws(() => truncate('abc', { length: -1 }), rangeError);
    assert.throws(() => truncate('abc', { length: 2.5, omission: '' }), rangeError);
    assert.throws(() => truncate('abc', { length: '5' }), typeError);
    assert.throws(() => truncate('abc', { omission: 1 }), typeError);
    assert.throws(() => truncate(5), typeError);
    const lines = [FIRST.repeat(10), 'abc'];
    assert.deepEqual(lines.map(truncate), lines.map((line) => truncate(line)));
  });
});

describe('collapseRepeatedMarks (DESIGN.md §11.6)', () => {
  it('collapses a run of one mark, and keeps white space and zero-width characters', () => {
    assert.equal(collapseRepeatedMarks(' \u1000\u102C\u102C\u102C\u200B '), ' \u1000\u102C\u200B ');
    assert.equal(collapseRepeatedMarks('\u1000\u102C\u102C', { font: 'zawgyi' }), '\u1000\u102C');
    assert.equal(collapseRepeatedMarks('\u1000\u1060\u1060'), '\u1000\u1060\u1060', 'not a Unicode mark');
    assert.equal(collapseRepeatedMarks('\u1000\u1060\u1060', { font: 'zawgyi' }), '\u1000\u1060');
  });

  it('is 2.x spellingFix on the text 2.x cleaned', () => {
    fuzz.check(fc.property(arb.unicodeText(16), arb.zawgyiText(16), (unicode, zawgyi) => {
      for (const [text, font] of [[cleaned(unicode), 'unicode'], [cleaned(zawgyi), 'zawgyi']]) {
        if (!/[\u1000-\u109F]/.test(text)) continue;
        assert.equal(collapseRepeatedMarks(text, { font }), spellingFix(text, font), font + ': ' + units(text));
      }
    }), 30000, [], 600000);
  });

  it('throws coded errors for bad options', () => {
    assert.throws(() => collapseRepeatedMarks('a', { font: 'win' }), { code: 'ERR_KNAYI_INVALID_ARG_VALUE' });
    assert.throws(() => collapseRepeatedMarks({}), { code: 'ERR_KNAYI_INVALID_ARG_TYPE' });
  });
});
