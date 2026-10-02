const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const knayi = require('../main');

// Each input took several seconds in 2.9.0 because a regex retried from every position (quadratic time).
// Linear code finishes these in a few milliseconds, so the limit only fails on a real regression.
const LIMIT_MS = 1000;

function timed(fn) {
  const start = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - start) / 1e6;
}

describe('long input', () => {
  it('converts a long run of vowel signs in linear time', () => {
    // A stacked ka (U+1060) or a kinzi (U+1064) makes the conversion reach the two rules that were quadratic;
    // without them those rules are skipped.
    for (const head of ['\u1000\u1060', '\u1064']) {
      const text = head + '\u102c\u102d'.repeat(40000);
      const ms = timed(() => knayi.fontConvert(text, 'unicode', 'zawgyi'));
      assert.ok(ms < LIMIT_MS, 'fontConvert took ' + ms.toFixed(0) + 'ms');
    }
  });

  it('normalizes a long run of wa in linear time', () => {
    const text = 'ဝ'.repeat(200000);
    const ms = timed(() => knayi.normalize(text));
    assert.ok(ms < LIMIT_MS, 'normalize took ' + ms.toFixed(0) + 'ms');
  });

  it('still moves marks behind a stacked consonant and kinzi (2.8.3 output)', () => {
    assert.equal(knayi.fontConvert('ကိၠ', 'unicode', 'zawgyi'), 'က္ကိ');
    assert.equal(knayi.fontConvert('ကုၠ', 'unicode', 'zawgyi'), 'က္ကု');
    assert.equal(knayi.fontConvert('ေကၠ', 'unicode', 'zawgyi'), 'က္ကေ');
    assert.equal(knayi.fontConvert('ကာၤ', 'unicode', 'zawgyi'), 'င်္ကာ');
    assert.equal(knayi.fontConvert('သီၤ', 'unicode', 'zawgyi'), 'င်္သီ');
  });

  it('does not log a rule in debug mode when it leaves the text unchanged', () => {
    assert.equal(knayi.fontConvert.debugging('ကိ', 'unicode', 'zawgyi').matched_patterns.length, 0);
  });
});
