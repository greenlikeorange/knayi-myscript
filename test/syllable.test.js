const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
// The 2.x API: compat, on the 3.0 core.
const knayi = require('../src/compat/index.js').default;

// 2.x's test-only syllable parser, parseUnicode and serializeUnicode, is not in 3.0 (decision 35): it lost the asat
// of many words, and no function used it. What stays is that normalize and the spelling collapse are two policies,
// and that the public break joins bare consonants.
describe('syllable', function () {
  it('keeps normalize and spelling collapse as two policies', function () {
    assert.equal(knayi.normalize('ကိီ'), 'ကီ');
    assert.equal(knayi.spellingFix('ကိီ', 'unicode'), 'ကိီ');
  });

  it('keeps the public break of two bare consonants', function () {
    assert.equal(knayi.syllBreak('ကက', 'unicode', '|'), 'ကက');
  });
});
