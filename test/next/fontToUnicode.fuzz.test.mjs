// Differential fuzz of the font pipeline (docs/next/DESIGN.md §6.1, §7.8). Owner: W6 (engine-fonts).
//
// fontToUnicode against 2.x zawgyi.toUnicode and win.toUnicode, and traceFontToUnicode against their debug log
// (matched_patterns and steps), in the frozen copies of scripts/oracle/ (D19), with the typing fixes in normalize's
// order, as scripts/oracle/index.js makes them (2.x ab3676e; DESIGN.md §8). The Zawgyi strings are short
// strings over the Zawgyi alphabet and Burmese text with typing slips written in Zawgyi by the 2.x converter; the
// Win strings are over the Win alphabet; both get any UTF-16 units too. Then the seeded fuzz sets of
// `npm run compare` (scripts/eval/lib/inputs.mjs). The counts (D23):
//   fontToUnicode, each font      100,000 on a pull request, 300,000 in a long run
//   traceFontToUnicode            50,000 on a pull request, 300,000 in a long run
// The regressions of test/fuzz.test.js run first. The Win results are "Win identity only".

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fc from 'fast-check';
import { fontToUnicode, traceFontToUnicode } from '../../src/stages/fonts.js';
import { createTrace, applyRuleRows } from '../../src/core/rules.js';
import { toNfc } from '../../src/core/nfc.js';
import { compileFont, readFontNoting } from '../../src/engine/fontReader.js';
import { zeroAsWa, fixLookAlikes, fixTypos } from '../../src/rules/typingFixes.js';
import { ZAWGYI_FONT } from '../../src/fonts/zawgyi.js';
import { WIN_FONT } from '../../src/fonts/win.js';
import { fuzzSets } from '../../scripts/eval/lib/inputs.mjs';
import { arb, fuzz, oracle } from './helpers.mjs';

const require = createRequire(import.meta.url);
const ORACLE = oracle.fonts;
const syllable2x = require('../../scripts/oracle/syllable.js');

const hexOf = (text) => Array.from(text, (ch) => ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');

// Burmese text with typing slips, written in Zawgyi as 2.x fontConvert(text, 'zawgyi', 'unicode') writes it.
const zawgyiWords = arb.burmeseText.map((text) =>
  syllable2x.convertText(syllable2x.collapseMarks(text, 'unicode'), 'unicode', 'zawgyi'));
const INPUTS = {
  zawgyi: fc.oneof({ weight: 6, arbitrary: arb.zawgyiText() }, { weight: 3, arbitrary: zawgyiWords },
    { weight: 1, arbitrary: arb.codeUnits }),
  win: fc.oneof({ weight: 9, arbitrary: arb.winText() }, { weight: 1, arbitrary: arb.codeUnits })
};

const REGRESSIONS = {
  zawgyi: ['\u107F\u1019\u102D\u1033 \u1037', '\u104E\u1004\u1039\u1038', '\u1044\u1004\u1039\u1038',
    '\u1031\u101A\u102C\u1000\u1039\u103A\u102C\u1038', '\u1031' + '\u1000'.repeat(200)],
  win: ['ajumifh', 'a,musfm;', 'usGefkyf', 'aMomf', 'ZvGefaps;', '7if;', '0if']
};

function sameAs2x(font, text) {
  const ours = fontToUnicode(text, font);
  const theirs = ORACLE[font].toUnicode(text);
  if (ours !== theirs) assert.fail(font + ' ' + hexOf(text) + '\n  ours ' + hexOf(ours) + '\n  2.x  ' + hexOf(theirs));
}

function sameTraceAs2x(font, text) {
  const trace = createTrace();
  const result = traceFontToUnicode(text, font, trace);
  const debug = ORACLE[font].toUnicode(text, true);
  assert.deepEqual(trace.records.map((record) => record.label), debug.matched_patterns, 'stages of ' + hexOf(text));
  assert.deepEqual([trace.start].concat(trace.records.map((record) => record.text)), debug.steps, 'steps of ' + hexOf(text));
  assert.equal(result, ORACLE[font].toUnicode(text), 'result of ' + hexOf(text));
}

describe('fontToUnicode against 2.x toUnicode (DESIGN.md §6.1)', () => {
  for (const font of ['zawgyi', 'win']) {
    it(font + (font === 'win' ? ' (Win identity only)' : ''), () => {
      fuzz.check(fc.property(INPUTS[font], (text) => sameAs2x(font, text)), 100000,
        REGRESSIONS[font].map((text) => [text]), 300000);
    });
  }

  it('traceFontToUnicode against 2.x toUnicode(text, true): matched_patterns and steps', () => {
    const input = fc.oneof(INPUTS.zawgyi.map((text) => ['zawgyi', text]), INPUTS.win.map((text) => ['win', text]));
    const regressions = REGRESSIONS.zawgyi.map((text) => [['zawgyi', text]])
      .concat(REGRESSIONS.win.map((text) => [['win', text]]));
    fuzz.check(fc.property(input, ([font, text]) => sameTraceAs2x(font, text)), 50000, regressions, 300000);
  });

  it('the final-NFC gate stays closed only where NFC changes nothing (DESIGN.md §3.10, gate 4)', () => {
    const compiled = { zawgyi: compileFont(ZAWGYI_FONT), win: compileFont(WIN_FONT) };
    const closed = { zawgyi: 0, win: 0 };
    const input = fc.oneof(INPUTS.zawgyi.map((text) => ['zawgyi', text]), INPUTS.win.map((text) => ['win', text]));
    const regressions = REGRESSIONS.zawgyi.map((text) => [['zawgyi', text]])
      .concat(REGRESSIONS.win.map((text) => [['win', text]]));
    fuzz.check(fc.property(input, ([font, text]) => {
      // The stages before 'NFC', run by hand on the font compiled here.
      const read = readFontNoting(applyRuleRows(text, compiled[font].sequences), compiled[font]);
      const beforeNfc = fixLookAlikes(fixTypos(zeroAsWa(read.text)));
      if (!read.nfcMayChange) {
        closed[font]++;
        assert.equal(hexOf(toNfc(beforeNfc)), hexOf(beforeNfc), font + ' ' + hexOf(text));
      }
      assert.equal(fontToUnicode(text, font), read.nfcMayChange ? toNfc(beforeNfc) : beforeNfc, hexOf(text));
      assert.equal(fontToUnicode(text, font, { openAllGates: true }), fontToUnicode(text, font), hexOf(text));
    }), 100000, regressions, 300000);
    assert.ok(closed.zawgyi > 1000 && closed.win > 1000, 'the gate stayed closed ' + JSON.stringify(closed));
  });

  it('the seeded fuzz sets of npm run compare: fuzz.block, fuzz.marks and fuzz.win, with traces', () => {
    for (const set of fuzzSets({ seed: fuzz.SEED, count: fuzz.runs(5000, 20000) })) {
      for (const font of set.kind === 'win' ? ['win'] : ['zawgyi', 'win']) {
        for (const text of set.lines) {
          sameAs2x(font, text);
          sameTraceAs2x(font, text);
        }
      }
    }
  });
});
