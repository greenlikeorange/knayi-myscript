const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const knayi = require('../main');
const arb = require('../scripts/testing/arbitraries');
const { check } = require('../scripts/testing/fuzz-settings');

// Properties of the public API, checked with fast-check on generated input (seed and size: see
// scripts/testing/fuzz-settings.js).

before(() => knayi.setGlobalOptions({ silent_mode: true }));
after(() => knayi.setGlobalOptions({ silent_mode: false }));

function hex(text) {
  return text.split('').map((c) => c.charCodeAt(0).toString(16).toUpperCase()).join(' ');
}

describe('normalize is idempotent', () => {
  // Burmese syllables in storage order and runs of digits, with typing slips: e or medial ra typed before
  // the consonant, a space before a mark, a mark typed twice, two marks swapped (scripts/testing/arbitraries.js).
  it('on Burmese text with typing slips', () => {
    check(fc.property(arb.burmeseText, (text) => {
      const once = knayi.normalize(text);
      assert.equal(hex(knayi.normalize(once)), hex(once));
    }), 20000, [
      ['\u101C\u100A\u103A\u1038\u1031\u1000\u102C\u1004\u103A\u1038'], // e typed before its consonant
      ['\u101E\u102F \u1036\u1038'], // a space before a mark
      ['\u1019\u103C\u102D\u102F\u1004\u103A\u1019\u102D\u103C\u102F\u1004\u103A'] // marks out of order
    ]);
  });

  // Garbled input that normalize does not settle in one pass (refactor plan, section 7 item 12; decision 36:
  // idempotent by construction in 3.0). Each line is the input, the first pass and the second pass. These are
  // pinned: a refactor must not change them, and a fix makes this test fail, so its probe moves to the
  // regressions above.
  const KNOWN = [
    // A zero or seven becomes a letter only once the first pass has moved a mark next to it, or made the
    // digit after it a letter.
    ['\u1040\u103D \u103E', '\u101D\u103D \u103E', '\u101D\u103D\u103E'],
    ['\u1010\u102B\u1039\u1040', '\u1010\u102B\u1039\u101D', '\u1010\u1039\u101D\u102B'],
    ['\u1010\u1040\u1040\u102E', '\u1010\u1040\u101D\u102E', '\u1010\u101D\u101D\u102E'],
    ['\u1040\u1047\u1039', '\u1040\u101B\u1039', '\u101D\u101B\u1039'],
    // Seven with a mark is ra, but as a digit it took no mark from across the space.
    ['\u1047\u102B \u1030', '\u101B\u102B \u1030', '\u101B\u1030\u102B'],
    // u stays u after a vowel sign, which the first pass moves away; then it is nya.
    ['\u101D\u1038\u102D\u1025\u102C', '\u101D\u102D\u1038\u1025\u102C', '\u101D\u102D\u1038\u1009\u102C'],
    ['\u1031\u1025\u102B', '\u1025\u1031\u102B', '\u1009\u1031\u102B'],
    // A typo fix leaves another typo.
    ['\u102D\u102E\u102D', '\u102E\u102D', '\u102E'],
    ['\u1030\u102F\u102F', '\u1030\u102F', '\u1030'],
    // e typed after an asat and before a medial.
    ['\u1000\u103A\u1031\u103D\u1011', '\u1000\u103A\u103D\u1031\u1011', '\u1000\u103A\u103D\u1011\u1031'],
    // ca with medial ya becomes jha, and the asat it had is placed again.
    ['\u1005\u103A\u103B\u102C', '\u1008\u103A\u102C', '\u1008\u102C\u103A'],
    // NFC joins u and ii into the letter uu, which then takes the medial ra left after the zero-width space.
    ['\u1025\u200B\u102E\u103C', '\u1026\u200B\u103C', '\u1026\u103C\u200B'],
    // A space inside kinzi.
    ['\u1004 \u103A\u1039\u1002\u1031 \u102F', '\u1004\u1039\u1002\u1031 \u102F', '\u1004\u1039\u1002\u1031\u102F']
  ];
  for (const [input, first, second] of KNOWN) {
    it('known failure: ' + hex(input) + ' -> ' + hex(first) + ' -> ' + hex(second), () => {
      assert.equal(hex(knayi.normalize(input)), hex(first));
      assert.equal(hex(knayi.normalize(first)), hex(second));
      assert.equal(hex(knayi.normalize(second)), hex(second));
    });
  }
});

describe('debugging ends with the converted text', () => {
  const pairs = [
    ['unicode', 'zawgyi', arb.zawgyiText()],
    ['unicode', 'win', arb.winText()],
    ['zawgyi', 'unicode', arb.unicodeText()],
    ['unicode', undefined, fc.oneof(arb.zawgyiText(), arb.unicodeText())],
    ['zawgyi', undefined, fc.oneof(arb.zawgyiText(), arb.unicodeText())]
  ];
  for (const [to, from, text] of pairs) {
    it('from ' + (from || 'a detected font') + ' to ' + to, () => {
      check(fc.property(text, (content) => {
        const debug = knayi.fontConvert.debugging(content, to, from);
        const converted = knayi.fontConvert(content, to, from);
        if (typeof debug === 'string') {
          // Early exits (same font, no Myanmar letter) return the text itself (refactor plan, section 7 item 3).
          assert.equal(debug, converted);
          return;
        }
        assert.equal(debug.to, to);
        if (from) assert.equal(debug.from, from);
        assert.ok(Array.isArray(debug.matched_patterns));
        assert.equal(debug.steps[debug.steps.length - 1], converted);
      }), 3000);
    });
  }
});

describe('no call form throws', () => {
  const FONTS = ['unicode', 'zawgyi', 'win', undefined];
  const forms = [
    ['fontDetect(x)', (x) => knayi.fontDetect(x)],
    ['fontDetect(x, "unicode")', (x) => knayi.fontDetect(x, 'unicode')],
    ['fontDetect(x, null, myanmartools)', (x) => knayi.fontDetect(x, null, { adapter: 'myanmartools' })],
    ['syllBreak(x)', (x) => knayi.syllBreak(x)],
    ['syllBreak(x, "unicode", "|")', (x) => knayi.syllBreak(x, 'unicode', '|')],
    ['syllBreak(x, "zawgyi", "|")', (x) => knayi.syllBreak(x, 'zawgyi', '|')],
    ['spellingFix(x)', (x) => knayi.spellingFix(x)],
    ['spellingFix(x, "unicode")', (x) => knayi.spellingFix(x, 'unicode')],
    ['spellingFix(x, "zawgyi")', (x) => knayi.spellingFix(x, 'zawgyi')],
    ['truncate(x)', (x) => knayi.truncate(x)],
    ['truncate(x, length 5)', (x) => knayi.truncate(x, { length: 5, omission: '\u2026' })],
    ['truncate(x, unicode)', (x) => knayi.truncate(x, { fontType: 'unicode', length: 10 })],
    ['truncate(x, zawgyi)', (x) => knayi.truncate(x, { fontType: 'zawgyi', length: 10 })],
    ['normalize(x)', (x) => knayi.normalize(x)]
  ];
  FONTS.slice(0, 3).forEach((to) => FONTS.forEach((from) => {
    forms.push(['fontConvert(x, ' + to + ', ' + from + ')', (x) => knayi.fontConvert(x, to, from)]);
    forms.push(['fontConvert.debugging(x, ' + to + ', ' + from + ')', (x) => knayi.fontConvert.debugging(x, to, from)]);
  }));

  function returnsText(name, value) {
    if (/debugging/.test(name) && value && typeof value === 'object') {
      assert.ok(value.steps.every((step) => typeof step === 'string'), name);
    } else {
      assert.equal(typeof value, 'string', name + ' returned ' + typeof value);
    }
  }

  const strings = {
    'Unicode text': arb.unicodeText(24),
    'Zawgyi text': arb.zawgyiText(24),
    'Win text': arb.winText(24),
    'any UTF-16 code units': arb.codeUnits,
    'any code points': fc.string({ unit: 'binary', maxLength: 16 })
  };
  for (const [kind, text] of Object.entries(strings)) {
    it('on ' + kind + ', and returns text', () => {
      check(fc.property(text, (x) => {
        for (const [name, call] of forms) returnsText(name, call(x));
      }), 400, [[''], [' '], ['\u200B'], ['\uD800'], ['\u1031'.repeat(3)]]);
    });
  }

  // README: other values, such as numbers and objects, are returned unchanged, and no function throws on them;
  // truncate turns them into strings first, like lodash.truncate. Values String() cannot convert are left to
  // the known failure below.
  function convertible(x) {
    try {
      String(x);
      return true;
    } catch (e) {
      return false;
    }
  }
  it('on other values', () => {
    check(fc.property(fc.anything().filter(convertible), (x) => {
      for (const [, call] of forms) call(x);
    }), 400, [[null], [undefined], [0], [NaN], [false], [123], [{}], [[]], [new String('\u1000')]]);
  });

  // Pinned: fails once truncate stops throwing, so the values move to the property above.
  it('known failure: truncate throws on an object String() cannot convert', () => {
    for (const value of [Object.create(null), { toString: undefined }]) {
      assert.throws(() => knayi.truncate(value), TypeError);
      for (const [name, call] of forms) {
        if (!/^truncate/.test(name)) call(value);
      }
    }
  });
});
