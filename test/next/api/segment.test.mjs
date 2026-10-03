// segmentSyllables and syllableBoundaries of the 3.0 API (docs/next/DESIGN.md §11.6; decision 34).
//
// - Lossless: the syllables join back to the text under every policy and font, ZWNJ and all.
// - 'pairs' is 2.x syllBreak's reading; 'separate', the default, gives the syllables of UTN #11.
// - The counts decision 34 chose the default from, recounted on the cached corpora and recorded.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { arb, fuzz } from '../helpers.mjs';
import { units, cachedCorpora } from './helpers.mjs';
import { segmentSyllables, syllableBoundaries } from '../../../src/index.js';
import { syllBreak } from '../../../src/compat/index.js';

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
  // 'separate' differ from 'pairs' (2.x), the pieces of each policy, and the pieces of 'pairs' that hold more than
  // one syllable of 'separate'. mC4 is read as Zawgyi.
  const RECORDED = {
    flores: [2009, 377, 1985, 65805, 65368, 77128, 10597],
    wikipedia: [4812, 1013, 3801, 120363, 118517, 142962, 20393],
    okell: [16924, 3885, 14156, 588013, 581621, 700205, 104143],
    mc4: [14304, 4963, 12779, 618033, 602322, 750691, 129206],
    shn: [9923, 94, 1426, 186348, 186219, 188791, 2401],
    mnw: [2270, 834, 2024, 76094, 74334, 95757, 17918]
  };

  it('recounts them on the cached corpora', async (t) => {
    const corpora = await cachedCorpora();
    if (corpora.skip) return t.skip(corpora.skip);
    const counts = {};
    for (const id of Object.keys(RECORDED)) {
      const font = id === 'mc4' ? 'zawgyi' : 'unicode';
      const lines = corpora.sets[id].filter((line) => /[\u1000-\u109F]/.test(line));
      const row = [lines.length, 0, 0, 0, 0, 0, 0];
      for (const line of lines) {
        const [pairs, chains, separate] = ['pairs', 'chains', 'separate'].map((policy) =>
          segmentSyllables(line, { policy, font }));
        if (chains.join('|') !== pairs.join('|')) row[1]++;
        if (separate.join('|') !== pairs.join('|')) row[2]++;
        row[3] += pairs.length;
        row[4] += chains.length;
        row[5] += separate.length;
        row[6] += piecesHoldingSeveral(pairs, syllableBoundaries(line, { policy: 'separate', font }));
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
