const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const knayi = require('../main');
const oracle = require('../scripts/oracle');
const arb = require('../scripts/testing/arbitraries');
const { SEED, check, runs } = require('../scripts/testing/fuzz-settings');

// Differential fuzz: the library against the frozen 2.10 engine in scripts/oracle/, with the deliberate output
// changes made since (scripts/oracle/index.js), on short strings over the characters each reader decides on
// (scripts/testing/arbitraries.js). 60,000 strings in all on a pull request; see scripts/testing/fuzz-settings.js
// for a longer run. Every output must be the same.

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
const COUNT = { normalize: 25000, codeUnits: 10000, zawgyi: 10000, win: 5000, detect: 8000, debugging: 2000 };

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

  // The font reader reads each glyph from an array indexed by character code, which ends at the highest code
  // with a glyph (library/storageOrder.js, font); 2.10 kept the glyphs in a Map. Every UTF-16 code unit, alone
  // and after ka, through both fonts with the debugging stages, which include each glyph's text.
  it('every code unit through the glyph tables', () => {
    const fonts = {
      zawgyi: [require('../library/zawgyi'), oracle.fonts.zawgyi],
      win: [require('../library/win'), oracle.fonts.win]
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

  // order tells which marks a syllable has from one number with the bit 1 << rank of each
  // (library/storageOrder.js); 2.10 searched the marks. Every run of up to three of the 16 marks it sorts, on
  // each kind of base it treats apart, through normalize; and the same runs, with two marks outside its table,
  // through a made-up font whose glyphs are the marks themselves, a stacked consonant, kinzi, a ligature base,
  // and e and medial ra drawn first.
  it('every run of up to three marks', () => {
    const MARKS = '\u103B\u103C\u103D\u103E\u1031\u102D\u102E\u102F\u1030\u102B\u102C\u1032\u1036\u1037\u103A\u1038';
    const OTHER = '\u1033\u0301'; // a Mon vowel sign and a combining acute, which MARK_ORDER does not have
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

    const table = {
      '\uE000': ['stack', '\u1039\u1000'],
      '\uE001': ['stack', '\u1039\u1005'],
      '\uE002': ['kinzi', '\u1004\u103A\u1039'],
      '\uE003': ['base', '\u100B\u1039\u100C'],
      '\uE004': ['pre', '\u1031'],
      '\uE005': ['pre', '\u103C']
    };
    for (const mark of MARKS + OTHER) table[mark] = ['mark', mark];
    const library = require('../library/storageOrder');
    const font = library.font(table, []);
    const frozen = oracle.storageOrder.font(table, []);
    const starts = [
      '\u1000', '\u1005', '\u1025', '\u1047', // ka, ca, u, seven
      '\u1000\uE000', '\u1000\uE001', '\u1002\uE002', '\uE003', // a stacked ka, a stacked ca, kinzi, a ligature
      '\uE004\u1000', '\uE005\u1005' // e before ka, medial ra before ca
    ];
    for (const run of runsOf((MARKS + OTHER).split(''))) {
      for (const start of starts) {
        same(library.toUnicode(start + run, font), oracle.fontToUnicode(start + run, frozen), start + run);
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
    t.diagnostic('seed ' + SEED + ', ' + runs(60000) + ' strings; changed: normalize ' + normalized.toFixed(2) +
      ', Zawgyi ' + fromZawgyi.toFixed(2) + ', Win ' + fromWin.toFixed(2) + '; detected Unicode ' +
      asUnicode.toFixed(2) + ', Zawgyi ' + asZawgyi.toFixed(2));
    assert.ok(normalized > 0.15, 'normalize changed ' + normalized);
    assert.ok(fromZawgyi > 0.6, 'Zawgyi conversion changed ' + fromZawgyi);
    assert.ok(fromWin > 0.6, 'Win conversion changed ' + fromWin);
    assert.ok(asUnicode > 0.1 && asZawgyi > 0.1, 'detected Unicode ' + asUnicode + ', Zawgyi ' + asZawgyi);
  });
});
