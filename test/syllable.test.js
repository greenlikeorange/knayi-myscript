const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
var syllable = require('../library/syllable');
var normalize = require('../library/normalization');
describe('syllable', function () {
  it('parses an onset, a medial, and an asat coda', function () {
    var parsed = syllable.parseUnicode('မြန်');
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].onset, 'မ');
    assert.equal(parsed[0].medials, 'ြ');
    assert.equal(parsed[0].coda, 'န်');
    assert.equal(syllable.serializeUnicode(parsed), 'မြန်');
  });

  it('parses kinzi onto the following onset', function () {
    var parsed = syllable.parseUnicode('င်္ဂ');
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].kinzi, true);
    assert.equal(parsed[0].onset, 'ဂ');
    assert.equal(syllable.serializeUnicode(parsed), 'င်္ဂ');
  });

  it('keeps normalize and spelling collapse as two policies', function () {
    assert.equal(normalize('ကိီ'), 'ကီ');
    assert.equal(syllable.collapseMarks('ကိီ', 'unicode'), 'ကိီ');
  });

  it('segments orthographic syllables without changing the public break', function () {
    assert.equal(syllable.parseUnicode('ကက').length, 2);
    assert.deepEqual(syllable.breakParts('ကက', 'unicode'), ['ကက']);
  });
});
