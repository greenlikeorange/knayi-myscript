const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const knayi = require('../main');
const oracle = require('../scripts/oracle');
const arb = require('../scripts/testing/arbitraries');
const { SEED, check, runs } = require('../scripts/testing/fuzz-settings');

// Differential fuzz: the library against the frozen 2.10 engine in scripts/oracle/, on short strings over the
// characters each reader decides on (scripts/testing/arbitraries.js). 50,000 strings in all on a pull request;
// see scripts/testing/fuzz-settings.js for a longer run. Every output must be the same.

function hex(text) {
  return typeof text === 'string' ? text.split('').map((c) => c.charCodeAt(0).toString(16).toUpperCase()).join(' ') : text;
}

function same(actual, expected, input) {
  if (actual !== expected) {
    assert.fail('input ' + hex(input) + '\n  library ' + hex(actual) + '\n  oracle  ' + hex(expected));
  }
}

// Paths the plan names as rare and easy to break (refactor plan, section 8.1), and the long shapes that were
// quadratic in 2.10.0, checked first.
const UNICODE_REGRESSIONS = [
  '\u101B\u103A\u1039\u1000\u102C', // kinzi written with ra
  '\u1000\u102C\u1039\u1000', // a stack after marks
  '\u1000\u200B\u1031\u1001', // a held zero-width space before a pending e
  '\u1047 \u102C', // a digit base across a space
  '\u101C\u1032\u1025\u103A\u1038', // u kept after a vowel sign (Pa'o)
  '\u1004\u103A\u1039\u1002\u1031 \u102F', // kinzi, then a space before a mark
  '\u1000' + '\u1031'.repeat(300),
  '\u1000' + '\u103C'.repeat(300),
  '\u1000' + '\u103A'.repeat(150) + '\u103C'.repeat(150),
  '\u1000' + '\u200B\u102C'.repeat(150)
].map((text) => [text]);

const ZAWGYI_REGRESSIONS = [
  '\u107F\u1019\u102D\u1033 \u1037', // medial ra, a space before the dot below
  '\u104E\u1004\u1039\u1038', // lagaung typed with the nga, asat and visarga it draws
  '\u1044\u1004\u1039\u1038', // the digit four typed for lagaung
  '\u1031\u101A\u102C\u1000\u1039\u103A\u102C\u1038', // yauk-kya (man): asat on the consonant, before medial ya
  '\u1031' + '\u1000'.repeat(200)
].map((text) => [text]);

const WIN_REGRESSIONS = ['ajumifh', 'a,musfm;', 'usGefkyf', 'aMomf', 'ZvGefaps;', '7if;', '0if'].map((text) => [text]);

// Strings per comparison on a pull request: 50,000 in all.
const COUNT = { normalize: 25000, zawgyi: 10000, win: 5000, detect: 8000, debugging: 2000 };

// Inputs: short strings over each reader's characters, Burmese text with typing slips, and that text written
// in Zawgyi (by the library, which only makes the input here).
const unicode = fc.oneof({ weight: 3, arbitrary: arb.unicodeText() }, { weight: 1, arbitrary: arb.burmeseText });
const zawgyiWords = arb.burmeseText.map((text) => knayi.fontConvert(text, 'zawgyi', 'unicode'));
const zawgyi = fc.oneof({ weight: 3, arbitrary: arb.zawgyiText() }, { weight: 1, arbitrary: zawgyiWords });
const win = arb.winText();
const detectable = fc.oneof(arb.unicodeText(24), arb.zawgyiText(24), arb.burmeseText, zawgyiWords);

describe('library against the 2.10 oracle', () => {
  it('normalize', () => {
    check(fc.property(unicode, (text) => {
      same(knayi.normalize(text), oracle.normalize(text), text);
    }), COUNT.normalize, UNICODE_REGRESSIONS);
  });

  it('Zawgyi to Unicode', () => {
    check(fc.property(zawgyi, (text) => {
      same(knayi.fontConvert(text, 'unicode', 'zawgyi'), oracle.toUnicode(text, 'zawgyi'), text);
    }), COUNT.zawgyi, ZAWGYI_REGRESSIONS);
  });

  it('Win to Unicode', () => {
    check(fc.property(win, (text) => {
      same(knayi.fontConvert(text, 'unicode', 'win'), oracle.toUnicode(text, 'win'), text);
    }), COUNT.win, WIN_REGRESSIONS);
  });

  it('fontDetect with the rule scorer', () => {
    const fallback = fc.constantFrom(undefined, 'unicode', 'zawgyi');
    check(fc.property(detectable, fallback, (text, fb) => {
      same(knayi.fontDetect(text, fb, { adapter: 'rules' }), oracle.fontDetect(text, fb), text);
    }), COUNT.detect);
  });

  it('the debugging stages of Zawgyi and Win', () => {
    const fonts = { zawgyi: require('../scripts/oracle/zawgyi'), win: require('../scripts/oracle/win') };
    const text = fc.oneof(zawgyi.map((t) => ['zawgyi', t]), win.map((t) => ['win', t]));
    check(fc.property(text, ([font, content]) => {
      const debug = knayi.fontConvert.debugging(content, 'unicode', font);
      if (typeof debug === 'string') {
        same(debug, oracle.toUnicode(content, font), content);
        return;
      }
      const frozen = fonts[font].toUnicode(content.trim(), true);
      assert.deepEqual(debug.matched_patterns, frozen.matched_patterns, 'stages for ' + hex(content));
      assert.deepEqual(debug.steps, frozen.steps, 'steps for ' + hex(content));
    }), COUNT.debugging);
  });

  // The font reader reads each glyph from an array indexed by character code, which ends at the highest code
  // with a glyph (library/storageOrder.js, font); 2.10 kept the glyphs in a Map. Every UTF-16 code unit, alone
  // and after ka, through both fonts with the debugging stages, which include each glyph's text.
  it('every code unit through the glyph tables', () => {
    const fonts = {
      zawgyi: [require('../library/zawgyi'), require('../scripts/oracle/zawgyi')],
      win: [require('../library/win'), require('../scripts/oracle/win')]
    };
    const KA = String.fromCharCode(0x1000);
    for (const font of Object.keys(fonts)) {
      const [library, frozen] = fonts[font];
      for (let code = 0; code <= 0xFFFF; code++) {
        const ch = String.fromCharCode(code);
        for (const text of [ch, KA + ch]) {
          same(JSON.stringify(library.toUnicode(text, true)), JSON.stringify(frozen.toUnicode(text, true)), text);
        }
      }
    }
  });

  // A generator that stopped reaching the readers would let every comparison above pass. About 28% of the
  // Unicode strings change under normalize, over 90% of the Zawgyi and Win strings convert to something else,
  // and detection gives each font and ties.
  it('feeds the readers', (t) => {
    const sample = (arbitrary) => fc.sample(arbitrary, { seed: SEED, numRuns: 2000 });
    const share = (inputs, changed) => inputs.filter(changed).length / inputs.length;
    const normalized = share(sample(unicode), (s) => knayi.normalize(s) !== s);
    const fromZawgyi = share(sample(zawgyi), (s) => knayi.fontConvert(s, 'unicode', 'zawgyi') !== s);
    const fromWin = share(sample(win), (s) => knayi.fontConvert(s, 'unicode', 'win') !== s);
    const detected = sample(detectable).map((s) => knayi.fontDetect(s, 'tie', { adapter: 'rules' }));
    const asUnicode = share(detected, (d) => d === 'unicode');
    const asZawgyi = share(detected, (d) => d === 'zawgyi');
    t.diagnostic('seed ' + SEED + ', ' + runs(50000) + ' strings; changed: normalize ' + normalized.toFixed(2) +
      ', Zawgyi ' + fromZawgyi.toFixed(2) + ', Win ' + fromWin.toFixed(2) + '; detected Unicode ' +
      asUnicode.toFixed(2) + ', Zawgyi ' + asZawgyi.toFixed(2));
    assert.ok(normalized > 0.15, 'normalize changed ' + normalized);
    assert.ok(fromZawgyi > 0.6, 'Zawgyi conversion changed ' + fromZawgyi);
    assert.ok(fromWin > 0.6, 'Win conversion changed ' + fromWin);
    assert.ok(asUnicode > 0.1 && asZawgyi > 0.1, 'detected Unicode ' + asUnicode + ', Zawgyi ' + asZawgyi);
  });
});
