// detectEncoding of the 3.0 API (docs/next/DESIGN.md §11.5).
//
// - The result's shape, the four encodings and the cleaning 2.x did (trim, U+200B and U+200C removed).
// - The rule evidence is 2.x fontDetect's: on fuzz and on every cached line, fontDetect with a fallback gives
//   detectEncoding's encoding, with the fallback for 'none' and 'unknown'.
// - An injected ZawgyiDetector decides, with the thresholds; myanmar-tools 1.1.3 itself, from the dev dependencies.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fc from 'fast-check';
import { arb, fuzz } from '../helpers.mjs';
import { units, cachedCorpora } from './helpers.mjs';
import { detectEncoding } from '../../../src/index.js';
import { countEvidence } from '../../../src/rules/detect.js';
import { fontDetect } from '../../../src/compat/index.js';

const require = createRequire(import.meta.url);
const ZAWGYI = '\u1031\u1000\u102C\u1004\u1039\u1038 \u1031\u1019\u102C\u1004\u1039';
const UNICODE = '\u1000\u1031\u102C\u1004\u103A\u1038 \u1019\u1031\u102C\u1004\u103A';

// 2.x fontDetect with a fallback that is no encoding: 'none' and 'unknown' read as the fallback.
const asFontDetect = (text) => {
  const encoding = detectEncoding(text).encoding;
  return encoding === 'none' || encoding === 'unknown' ? 'fallback' : encoding;
};

describe('detectEncoding (DESIGN.md §11.5)', () => {
  it('gives the encoding and the evidence of each side', () => {
    assert.deepEqual(detectEncoding(ZAWGYI), { encoding: 'zawgyi', unicode: 0, zawgyi: 5 });
    assert.deepEqual(detectEncoding(UNICODE), { encoding: 'unicode', unicode: 6, zawgyi: 0 });
    assert.deepEqual(detectEncoding('\u1000\u1001\u1002'), { encoding: 'unknown', unicode: 0, zawgyi: 0 });
    assert.deepEqual(detectEncoding('no Myanmar here'), { encoding: 'none', unicode: 0, zawgyi: 0 });
    assert.deepEqual(detectEncoding(''), { encoding: 'none', unicode: 0, zawgyi: 0 });
    // Extended-A and -B are not the 2.x gate's block.
    assert.equal(detectEncoding('\uAA60\uA9E0').encoding, 'none');
  });

  it('reads the text trimmed and without U+200B and U+200C, as 2.x did', () => {
    const text = '  \u1031\u200B\u1000\u102C ';
    assert.deepEqual(detectEncoding(text), Object.assign({ encoding: 'zawgyi' }, countEvidence('\u1031\u1000\u102C')));
  });

  it('agrees with 2.x fontDetect on fuzz', () => {
    fuzz.check(fc.property(fc.oneof(arb.unicodeText(16), arb.zawgyiText(16), arb.codeUnits), (text) => {
      assert.equal(asFontDetect(text), fontDetect(text, 'fallback'), units(text));
    }), 30000, [[ZAWGYI], [UNICODE], [' \u200B']], 600000);
  });

  it('agrees with 2.x fontDetect on every cached line', async (t) => {
    const corpora = await cachedCorpora();
    if (corpora.skip) return t.skip(corpora.skip);
    let lines = 0;
    for (const [id, set] of Object.entries(corpora.sets)) {
      for (const line of set) {
        assert.equal(asFontDetect(line), fontDetect(line, 'fallback'), id + ': ' + units(line));
        lines++;
      }
    }
    t.diagnostic(lines + ' lines');
  });
});

describe('detectEncoding with a ZawgyiDetector', () => {
  const stub = (probability) => {
    const calls = [];
    return { calls, getZawgyiProbability: (text) => { calls.push(text); return probability; } };
  };

  it('lets the detector decide on the cleaned text, with its probability, and keeps the rule counts', () => {
    const detector = stub(0.99);
    const found = detectEncoding(' ' + UNICODE + '\u200B', { zawgyiDetector: detector });
    assert.deepEqual(found, { encoding: 'zawgyi', unicode: 6, zawgyi: 0, zawgyiProbability: 0.99 });
    assert.deepEqual(detector.calls, [UNICODE]);
  });

  it('reads the probability by the thresholds: below the first Unicode, above the second Zawgyi', () => {
    const at = (p, thresholds) => detectEncoding(UNICODE, { zawgyiDetector: stub(p), thresholds }).encoding;
    assert.equal(at(0.01), 'unicode');
    assert.equal(at(0.5), 'unknown');
    assert.equal(at(0.96), 'zawgyi');
    assert.equal(at(0.05), 'unknown', 'the default thresholds are [0.05, 0.95], both ends unknown');
    assert.equal(at(NaN), 'unknown');
    assert.equal(at(0.3, [0.4, 0.6]), 'unicode');
    assert.equal(at(0.7, [0.4, 0.6]), 'zawgyi');
  });

  it('does not ask the detector about text with no Myanmar', () => {
    const detector = stub(1);
    assert.deepEqual(detectEncoding('abc', { zawgyiDetector: detector }), { encoding: 'none', unicode: 0, zawgyi: 0 });
    assert.deepEqual(detector.calls, []);
  });

  it('works with myanmar-tools 1.1.3', () => {
    const { ZawgyiDetector } = require('myanmar-tools');
    const zawgyiDetector = new ZawgyiDetector();
    assert.equal(detectEncoding(ZAWGYI, { zawgyiDetector }).encoding, 'zawgyi');
    assert.equal(detectEncoding(UNICODE, { zawgyiDetector }).encoding, 'unicode');
    assert.equal(typeof detectEncoding(UNICODE, { zawgyiDetector }).zawgyiProbability, 'number');
  });
});

describe('detectEncoding\'s arguments (DESIGN.md §11.1)', () => {
  it('throws coded errors', () => {
    const typeError = { name: 'TypeError', code: 'ERR_KNAYI_INVALID_ARG_TYPE' };
    const rangeError = { name: 'RangeError', code: 'ERR_KNAYI_INVALID_ARG_VALUE' };
    assert.throws(() => detectEncoding(null), typeError);
    assert.throws(() => detectEncoding('a', true), typeError);
    assert.throws(() => detectEncoding('a', { zawgyiDetector: {} }), typeError);
    assert.throws(() => detectEncoding('a', { zawgyiDetector: () => 1 }), typeError);
    assert.throws(() => detectEncoding('a', { thresholds: 0.5 }), typeError);
    assert.throws(() => detectEncoding('a', { thresholds: [0.1] }), typeError);
    assert.throws(() => detectEncoding('a', { thresholds: [0.9, 0.1] }), rangeError);
    assert.throws(() => detectEncoding('a', { thresholds: [-0.1, 0.5] }), rangeError);
  });

  it('is map-safe', () => {
    const lines = [ZAWGYI, UNICODE, 'abc'];
    assert.deepEqual(lines.map(detectEncoding), lines.map((line) => detectEncoding(line)));
  });
});
