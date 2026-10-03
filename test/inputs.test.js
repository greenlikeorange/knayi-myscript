const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
// The 2.x API: compat, on the 3.0 core.
const knayi = require('../src/compat/index.js').default;

const missing = [0, false, NaN];
const others = [123, true, {}, []];
const transforms = {
  fontConvert: (x) => knayi.fontConvert(x, 'unicode'),
  fontConvertFromWin: (x) => knayi.fontConvert(x, 'unicode', 'win'),
  syllBreak: (x) => knayi.syllBreak(x),
  spellingFix: (x) => knayi.spellingFix(x),
  normalize: (x) => knayi.normalize(x),
};

describe('non-string input', () => {
  let warnings;
  const warn = console.warn;

  before(() => {
    console.warn = (message) => { warnings.push(String(message)); };
  });

  after(() => {
    console.warn = warn;
  });

  it('treats 0, false, and NaN as missing content, as 2.8.3 did', () => {
    for (const x of missing) {
      for (const [name, call] of Object.entries(transforms)) {
        warnings = [];
        assert.equal(call(x), '', name + '(' + String(x) + ')');
        assert.equal(warnings.length, 1, name + '(' + String(x) + ') warns');
      }
      warnings = [];
      assert.equal(knayi.fontDetect(x), 'en');
      assert.equal(knayi.truncate(x), '');
      assert.equal(warnings.length, 2);
    }
  });

  it('returns other values unchanged and never throws', () => {
    for (const x of others) {
      for (const [name, call] of Object.entries(transforms)) {
        assert.equal(call(x), x, name + '(' + JSON.stringify(x) + ')');
      }
      assert.equal(knayi.fontDetect(x), 'en');
    }
  });

  it('truncates other values as strings, like lodash.truncate', () => {
    assert.equal(knayi.truncate(123), '123...');
    assert.equal(knayi.truncate(true), 'true...');
  });

  it('keeps an empty string distinct for truncate', () => {
    assert.equal(knayi.truncate(''), '...');
  });

  it('treats String objects as strings', () => {
    const text = new String('ျမန္မာ');
    assert.equal(knayi.fontDetect(text), 'zawgyi');
    assert.equal(knayi.fontConvert(text, 'unicode'), 'မြန်မာ');
    assert.equal(knayi.fontConvert(new String('jrefrm'), 'unicode', 'win'), 'မြန်မာ');
    assert.equal(knayi.syllBreak(new String('မြန်မာ'), 'unicode', '|'), 'မြန်|မာ');
    assert.equal(knayi.spellingFix(new String('ကာာ'), 'unicode'), 'ကာ');
    assert.equal(knayi.normalize(new String('မိြုင်')), 'မြိုင်');
    assert.equal(knayi.truncate(new String('မြန်မာ')), 'မြန်မာ...');
  });
});
