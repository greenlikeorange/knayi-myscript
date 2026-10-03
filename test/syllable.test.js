const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
var syllable = require('../library/syllable');
var normalize = require('../library/normalization');
const fc = require('fast-check');
const { check, runs } = require('../scripts/testing/fuzz-settings');
const { loadWithInternals } = require('../scripts/testing/internals');

const internals = loadWithInternals('syllable.js', ['convertRules', 'COLLAPSE_MARKS']).__internals;

function hex(text) {
  return text.split('').map((c) => c.charCodeAt(0).toString(16).toUpperCase()).join(' ');
}

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

// spellingFix collapses every run of one mark with one regex per font. 2.10 ran one [mark]{2,} regex per mark,
// in turn; the two must agree on every string.
function collapseEachMark(text, marks) {
  return marks.split('').reduce((out, mark) => out.replace(new RegExp('[' + mark + ']{2,}', 'g'), mark), text);
}

describe('collapseMarks', function () {
  ['unicode', 'zawgyi'].forEach(function (font) {
    const marks = internals.COLLAPSE_MARKS[font];
    it('collapses each run of one ' + font + ' mark, as one regex per mark did', function () {
      const unit = fc.oneof(
        { weight: 4, arbitrary: fc.constantFrom(...marks.split('')) },
        { weight: 1, arbitrary: fc.constantFrom('\u1000', '\u1031', '\u1033', '\u1040', '\u1064', ' ', 'a') }
      );
      check(fc.property(fc.string({ unit: unit, maxLength: 16 }), (text) => {
        assert.equal(hex(syllable.collapseMarks(text, font)), hex(collapseEachMark(text, marks)));
      }), 20000, [['\u102d\u102d\u102e\u102e\u102e\u102d'], ['\u1031\u1031\u1031\u1000\u103a\u103a\u1039\u1039']]);
    });
  });

  it('keeps two different marks, and uses the Unicode marks for any name but zawgyi', function () {
    assert.equal(syllable.collapseMarks('\u1000\u102d\u102e\u102e\u102e', 'unicode'), '\u1000\u102d\u102e');
    assert.equal(syllable.collapseMarks('\u1000\u1033\u1033', 'zawgyi'), '\u1000\u1033');
    assert.equal(syllable.collapseMarks('\u1000\u1033\u1033', 'win'), '\u1000\u1033\u1033');
    assert.equal(syllable.collapseMarks('\u1000\u102c\u102c', 'constructor'), '\u1000\u102c');
  });
});

// convertText applies each asLongAsMatch rule of Unicode to Zawgyi with one replace, where 2.10 replaced again
// while the rule matched (at most 40 times). That gives the same text, and the same debugging log, only if one
// replace never leaves a match: the reason is in library/syllable.js, and this checks it on generated strings.
describe('the asLongAsMatch rules of Unicode to Zawgyi', function () {
  const rules = internals.convertRules.unicode.zawgyi.asLongAsMatch;
  // Syllables of the shape the rules read: a medial ra glyph (each rule starts with one), a consonant, a medial
  // and a vowel, each but the consonant left out at times; and single characters, among them the glyphs the
  // rules write, so that a match often stands next to another or comes after a second medial ra.
  const CONSONANTS = ['\u1000', '\u1001', '\u1003', '\u1009', '\u101b', '\u101f', '\u1021', '\u106a', '\u108f'];
  const shaped = fc.tuple(
    fc.constantFrom('', '\u103b', '\u107e'),
    fc.constantFrom(...CONSONANTS),
    fc.constantFrom('', '\u103c', '\u103c\u103d', '\u108a', '\u103d', '\u103e'),
    fc.constantFrom('', '\u102d', '\u102e')
  ).map((parts) => parts.join(''));
  const single = fc.constantFrom('\u103b', '\u107e', '\u103c', '\u102d', '\u1083', '\u1084', '\u107f', '\u1080', '\u1081',
    '\u1082', '\u1031', ' ', ...CONSONANTS);
  const unit = fc.oneof({ weight: 2, arbitrary: shaped }, { weight: 1, arbitrary: single });

  it('leaves no match after one replace', function (t) {
    const matched = rules.map(() => 0);
    check(fc.property(fc.string({ unit: unit, maxLength: 16 }), (text) => {
      rules.forEach((rule, i) => {
        rule[0].lastIndex = 0;
        if (!rule[0].test(text)) return;
        matched[i] += 1;
        rule[0].lastIndex = 0;
        const once = text.replace(rule[0], rule[1]);
        rule[0].lastIndex = 0;
        assert.equal(rule[0].test(once), false, 'rule ' + i + ' (' + rule[0].source + ') matches ' + hex(once) +
          ', which one replace made of ' + hex(text));
      });
    }), 20000, [['\u103b\u103b\u1000'], ['\u103b\u1000\u103b\u1000\u103c\u102d'], ['\u107e\u107e\u1000\u102d'], ['\u103b\u103b\u1009']]);
    // Every rule matched in at least one string in a hundred, so the check reached each of them.
    t.diagnostic('strings each rule matched: ' + matched.join(', '));
    matched.forEach((count, i) => assert.ok(count >= runs(20000) / 100, 'rule ' + i + ' matched ' + count + ' strings'));
  });
});
