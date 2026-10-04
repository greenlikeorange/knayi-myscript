const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
// The 2.x API: compat, on the 3.0 core.
const knayi = require('../src/compat/index.js').default;
const oracle = require('../scripts/oracle');
const arb = require('../scripts/testing/arbitraries');
const { SEED, check, runs } = require('../scripts/testing/fuzz-settings');

// Differential fuzz: compat, the 2.x API on the 3.0 core, against the frozen 2.10 engine in scripts/oracle/, with
// the deliberate output changes the 2.x line made since (scripts/oracle/index.js), on short strings over the
// characters each reader decides on (scripts/testing/arbitraries.js). 60,000 strings in all on a pull request; see
// scripts/testing/fuzz-settings.js for a longer run. Every output must be the same.
//
// The 2.x line also tested its own private code here, the glyph array of library/storageOrder.js font() and the
// mark bits of order(), against the oracle. library/ is gone on next; test/next/readers-font.test.mjs and
// test/next/syllable.fuzz.test.mjs check the 3.0 core's reader and orderSyllable against the same oracle.

function hex(text) {
  return typeof text === 'string' ? text.split('').map((c) => c.charCodeAt(0).toString(16).toUpperCase()).join(' ') : text;
}

function same(actual, expected, input) {
  if (actual !== expected) {
    assert.fail('input ' + hex(input) + '\n  compat  ' + hex(actual) + '\n  oracle  ' + hex(expected));
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
  '\u101B\u1044\u1004\u1038\u1039', // ra, then the digit four for lagaung, visarga typed first: typos come first
  '\u1031\u101A\u102C\u1000\u1039\u103A\u102C\u1038', // yauk-kya (man): asat on the consonant, before medial ya
  '\u1031' + '\u1000'.repeat(200)
].map((text) => [text]);

const WIN_REGRESSIONS = ['ajumifh', 'a,musfm;', 'usGefkyf', 'aMomf', 'ZvGefaps;', '7if;', '0if', '&4if;']
  .map((text) => [text]);

// The typing fixes come in normalize's order, typos and then look-alikes: kinzi with ii, then i, seven and ra,
// where both change the text; and Win ra before the digit four typed for lagaung.
const DEBUGGING_REGRESSIONS = [
  ['zawgyi', '\u108C\u102D\u1047\u1090 '],
  ['win', '&4if;']
].map((pair) => [pair]);

// Strings per comparison on a pull request: 60,000 in all.
const COUNT = { normalize: 25000, codeUnits: 10000, zawgyi: 10000, win: 5000, detect: 5000, encoding: 3000,
  debugging: 2000 };

// Inputs: short strings over each reader's characters, Burmese text with typing slips, and that text written
// in Zawgyi (by compat, which only makes the input here).
const unicode = fc.oneof({ weight: 3, arbitrary: arb.unicodeText() }, { weight: 1, arbitrary: arb.burmeseText });
const zawgyiWords = arb.burmeseText.map((text) => knayi.fontConvert(text, 'zawgyi', 'unicode'));
const zawgyi = fc.oneof({ weight: 3, arbitrary: arb.zawgyiText() }, { weight: 1, arbitrary: zawgyiWords });
const win = arb.winText();
const detectable = fc.oneof(arb.unicodeText(24), arb.zawgyiText(24), arb.burmeseText, zawgyiWords);

describe('compat against the 2.10 oracle', () => {
  it('normalize', () => {
    check(fc.property(unicode, (text) => {
      same(knayi.normalize(text), oracle.normalize(text), text);
    }), COUNT.normalize, UNICODE_REGRESSIONS);
  });

  // normalize returns text with no character of the Myanmar blocks in NFC, without its other steps
  // (library/normalization.js). Every UTF-16 code unit, alone and between e and a combining acute, every code
  // point of plane 1 (Myanmar Extended-C among them), and random code units, which seldom hold a Myanmar
  // character, against the oracle, which runs every step.
  it('normalize on text with no character of the Myanmar blocks', () => {
    for (let code = 0; code <= 0xFFFF; code++) {
      const ch = String.fromCharCode(code);
      for (const text of [ch, 'e' + ch + '\u0301']) same(knayi.normalize(text), oracle.normalize(text), text);
    }
    for (let code = 0x10000; code <= 0x1FFFF; code++) {
      const text = String.fromCodePoint(code);
      same(knayi.normalize(text), oracle.normalize(text), text);
    }
    check(fc.property(arb.codeUnits.filter((text) => text !== ''), (text) => {
      same(knayi.normalize(text), oracle.normalize(text), text);
    }), COUNT.codeUnits);
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

  // detectEncoding's counts are the rule scorer's, and fontDetect reads the same result through its fallback:
  // 'unicode' and 'zawgyi' as they are, a tie ('unknown') as the fallback or 'zawgyi', and 'none' as the fallback
  // or 'en'. Random code units seldom hold a Myanmar letter, and give 'none'. '' is missing content, which warns.
  it('detectEncoding, and fontDetect read from it', () => {
    const fallback = fc.constantFrom(undefined, 'unicode', 'tie');
    const answer = (result, fb) => (result.encoding === 'unicode' || result.encoding === 'zawgyi' ? result.encoding
      : fb || (result.encoding === 'none' ? 'en' : 'zawgyi'));
    const text = fc.oneof(detectable, arb.codeUnits).filter((s) => s !== '');
    check(fc.property(text, fallback, (content, fb) => {
      const result = knayi.detectEncoding(content);
      assert.deepEqual(result, oracle.detectEncoding(content), 'input ' + hex(content));
      same(knayi.fontDetect(content, fb, { adapter: 'rules' }), answer(result, fb), content);
    }), COUNT.encoding, [[' \u200B ', 'tie'], ['\u1000', undefined],
      ['\u1031\u1031 \u103B\u1000', 'unicode']]);
  });

  it('the debugging stages of Zawgyi and Win', () => {
    const text = fc.oneof(zawgyi.map((t) => ['zawgyi', t]), win.map((t) => ['win', t]));
    check(fc.property(text, ([font, content]) => {
      const debug = knayi.fontConvert.debugging(content, 'unicode', font);
      if (font === 'zawgyi' && !/[\u1000-\u109F]/.test(content)) {
        // No Myanmar letter: fontConvert returns the text before converting, and debugging reports no stage and
        // that text as its one step.
        assert.deepEqual(debug.matched_patterns, [], 'stages for ' + hex(content));
        assert.equal(debug.steps.length, 1, 'steps for ' + hex(content));
        same(debug.steps[0], oracle.toUnicode(content, font), content);
        return;
      }
      const frozen = oracle.fonts[font].toUnicode(content.trim(), true);
      assert.deepEqual(debug.matched_patterns, frozen.matched_patterns, 'stages for ' + hex(content));
      assert.deepEqual(debug.steps, frozen.steps, 'steps for ' + hex(content));
    }), COUNT.debugging, DEBUGGING_REGRESSIONS);
  });

  // Every run of up to three of the 16 marks the syllable sort ranks, on each kind of base it treats apart, through
  // normalize. (2.x also ran them, with two marks outside its table, through a made-up font of library/'s private
  // font(); test/next/syllable.fuzz.test.mjs checks orderSyllable against the oracle's order.)
  it('every run of up to three marks', () => {
    const MARKS = '\u103B\u103C\u103D\u103E\u1031\u102D\u102E\u102F\u1030\u102B\u102C\u1032\u1036\u1037\u103A\u1038';
    const runsOf = (marks) => {
      let runs = [''];
      let last = [''];
      for (let length = 1; length <= 3; length++) {
        last = last.flatMap((run) => marks.map((mark) => run + mark));
        runs = runs.concat(last);
      }
      return runs;
    };
    const bases = [
      '\u1000', '\u1005', '\u1025', '\u1047', // ka, ca, u, seven
      '\u1000\u1039\u1000', '\u1000\u1039\u1005', // ka with a stacked ka, with a stacked ca
      '\u1004\u103A\u1039\u1002', '\u101C\u1032\u1025' // kinzi on ga, u after a vowel sign
    ];
    for (const run of runsOf(MARKS.split(''))) {
      for (const base of bases) same(knayi.normalize(base + run), oracle.normalize(base + run), base + run);
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
    t.diagnostic('seed ' + SEED + ', ' + runs(60000) + ' strings; changed: normalize ' + normalized.toFixed(2) +
      ', Zawgyi ' + fromZawgyi.toFixed(2) + ', Win ' + fromWin.toFixed(2) + '; detected Unicode ' +
      asUnicode.toFixed(2) + ', Zawgyi ' + asZawgyi.toFixed(2));
    assert.ok(normalized > 0.15, 'normalize changed ' + normalized);
    assert.ok(fromZawgyi > 0.6, 'Zawgyi conversion changed ' + fromZawgyi);
    assert.ok(fromWin > 0.6, 'Win conversion changed ' + fromWin);
    assert.ok(asUnicode > 0.1 && asZawgyi > 0.1, 'detected Unicode ' + asUnicode + ', Zawgyi ' + asZawgyi);
  });
});
