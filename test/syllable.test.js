const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
var syllable = require('../library/syllable');
var normalize = require('../library/normalization');
const fc = require('fast-check');
const { check, runs } = require('../scripts/testing/fuzz-settings');
const { loadWithInternals } = require('../scripts/testing/internals');

const internals = loadWithInternals('syllable.js', ['convertRules', 'COLLAPSE_MARKS', 'BREAK_RULES']).__internals;
const gate = require('../library/contentGate');
const arb = require('../scripts/testing/arbitraries');

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
// truncate breaks only the start of the text (breakStart), up to a whitespace character after the length it keeps.
// That gives the parts of the whole text there because a break rule reads whitespace only as the first character
// of a match: so no match runs across the start of a whitespace character. This checks it on the patterns: each
// piece of a pattern that can match whitespace (a class, an escape or a character) is a whole alternative of the
// group that starts the pattern, and no quantifier follows that group, so it matches the first character only.
describe('the break rules read whitespace only as the first character of a match', function () {
  const WHITESPACE = [];
  for (let code = 0; code <= 0xffff; code++) {
    if (/\s/.test(String.fromCharCode(code))) WHITESPACE.push(String.fromCharCode(code));
  }

  // The end of the piece of a pattern that starts at i: a class, an escape or one character.
  function pieceEnd(source, i) {
    if (source[i] === '[') {
      let j = i + 1;
      while (source[j] !== ']') j += source[j] === '\\' ? 2 : 1;
      return j + 1;
    }
    if (source[i] === '\\') return i + (source[i + 1] === 'u' ? 6 : 2);
    return i + 1;
  }

  // Each piece of the pattern that can match a whitespace character, as 'start-end'.
  function whitespacePieces(source) {
    const pieces = [];
    for (let i = 0; i < source.length;) {
      if ('()|*+?'.indexOf(source[i]) !== -1) {
        i += 1;
        continue;
      }
      const end = pieceEnd(source, i);
      const piece = new RegExp('^(?:' + source.slice(i, end) + ')$');
      if (WHITESPACE.some((ch) => piece.test(ch))) pieces.push(i + '-' + end);
      i = end;
    }
    return pieces;
  }

  // The alternatives of the group that starts the pattern, as 'start-end', when the group holds no other group and
  // no quantifier follows it; else none.
  function firstCharacterAlternatives(source) {
    if (source[0] !== '(') return [];
    const alternatives = [];
    let start = 1;
    for (let i = 1; i < source.length;) {
      if (source[i] === '(') return [];
      if (source[i] === '|' || source[i] === ')') {
        alternatives.push(start + '-' + i);
        if (source[i] === ')') return '*+?{'.indexOf(source[i + 1]) === -1 ? alternatives : [];
        start = i + 1;
        i += 1;
        continue;
      }
      i = pieceEnd(source, i);
    }
    return [];
  }

  function readsWhitespaceFirstOnly(source) {
    const first = firstCharacterAlternatives(source);
    return whitespacePieces(source).every((piece) => first.indexOf(piece) !== -1);
  }

  it('holds for every rule, and four rules read whitespace', function () {
    let reading = 0;
    ['unicode', 'zawgyi'].forEach(function (font) {
      internals.BREAK_RULES[font].forEach(function (rule, i) {
        const source = rule[0].source;
        assert.ok(readsWhitespaceFirstOnly(source), font + ' rule ' + i + ' reads whitespace after the first character: ' + source);
        if (whitespacePieces(source).length) reading += 1;
      });
    });
    // The rules that keep a syllable with the space before it: two per font.
    assert.equal(reading, 4);
  });

  it('fails on a pattern that reads whitespace after the first character', function () {
    assert.ok(readsWhitespaceFirstOnly('(\\s|\\n)\u200B([\u1000-\u1021])'));
    assert.ok(readsWhitespaceFirstOnly('([\u0009-\u000d>]|\\-)\u200B'));
    assert.ok(!readsWhitespaceFirstOnly('\u1000\\s'));
    assert.ok(!readsWhitespaceFirstOnly('(\\s)+\u1000'));
    assert.ok(!readsWhitespaceFirstOnly('(\\s\u1000|x)'));
    assert.ok(!readsWhitespaceFirstOnly('(x)[\u1000\u00a0]'));
    assert.ok(!readsWhitespaceFirstOnly('(x)[^\u1000]'));
    assert.ok(!readsWhitespaceFirstOnly('(x|(\\s))'));
  });
});

// breakStart gives the parts breakParts gives for the whole text, up to the first whitespace character after the
// length, where its last part stops short.
describe('breakStart', function () {
  ['unicode', 'zawgyi'].forEach(function (font) {
    const text = font === 'unicode' ? fc.oneof(arb.unicodeText(40), arb.burmeseText) : arb.zawgyiText(40);
    it('breaks the start of ' + font + ' text as the whole text breaks', function () {
      check(fc.property(text, fc.integer({ min: -2, max: 44 }), (raw, length) => {
        const content = gate.cleanText(raw, true);
        const whole = syllable.breakParts(content, font);
        const start = syllable.breakStart(content, font, length);
        const last = start.length - 1;
        assert.deepEqual(start.slice(0, last), whole.slice(0, last), hex(content) + ' at ' + length);
        assert.ok(whole[last].startsWith(start[last]), hex(content) + ' at ' + length);
        const kept = start.join('').length;
        if (kept < content.length) {
          // Cut before the first whitespace after the length.
          assert.ok(kept > length && /\s/.test(content[kept]) && !/\s/.test(content.slice(Math.max(0, length + 1), kept)),
            hex(content) + ' at ' + length);
        } else {
          assert.deepEqual(start, whole);
        }
      }), 20000, [['\u1015\u102d\u1002\u1064\u101c\u102c \u1000\u1000 \u1062\u103a', 2]]);
    });
  });
});
