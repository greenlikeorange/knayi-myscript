// Differential fuzz of the font reader (docs/next/DESIGN.md §6.1, §7.8). Owner: W6 (engine-fonts).
//
// readFont against 2.x arrange, and glyphsInTypedOrder against 2.x glyphsInTypedOrder, in the frozen copy of
// scripts/oracle/storageOrder.js (D19), on fast-check strings over each font's alphabet
// (scripts/testing/arbitraries.js) and on any UTF-16 units, lone surrogates included. The input is read after the
// font's sequences, as the stage 'syllables' reads it. 100,000 strings per font on a pull request, 500,000 in a
// long run (1M in all; D23); the regressions of test/fuzz.test.js run first.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { ZAWGYI_FONT } from '../../src/fonts/zawgyi.js';
import { WIN_FONT } from '../../src/fonts/win.js';
import { compileFont, readFont, glyphsInTypedOrder } from '../../src/engine/fontReader.js';
import { applyRuleRows } from '../../src/core/rules.js';
import { internals, arb, fuzz } from './helpers.mjs';

const storageOrder = internals('storageOrder.js', ['arrange', 'glyphsInTypedOrder']);
const FONTS = {
  zawgyi: { definition: ZAWGYI_FONT, glyphs2x: internals('zawgyi.js', ['FONT']).FONT.glyphs },
  win: { definition: WIN_FONT, glyphs2x: internals('win.js', ['FONT']).FONT.glyphs }
};
for (const font of Object.values(FONTS)) font.compiled = compileFont(font.definition);

const hexOf = (text) => Array.from(text, (ch) => ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');

const REGRESSIONS = {
  zawgyi: ['\u107F\u1019\u102D\u1033 \u1037', '\u104E\u1004\u1039\u1038', '\u1044\u1004\u1039\u1038',
    '\u1031\u101A\u102C\u1000\u1039\u103A\u102C\u1038', '\u1031' + '\u1000'.repeat(200)],
  win: ['ajumifh', 'a,musfm;', 'usGefkyf', 'aMomf', 'ZvGefaps;', '7if;', '0if']
};

function readerProperty(name, text) {
  const { definition, compiled, glyphs2x } = FONTS[name];
  const typed = applyRuleRows(text, definition.sequences);
  const ours = readFont(typed, compiled);
  const theirs = storageOrder.arrange(typed, glyphs2x);
  if (ours !== theirs) assert.fail(name + ' ' + hexOf(typed) + '\n  readFont ' + hexOf(ours) + '\n  arrange  ' + hexOf(theirs));
  const glyphs = glyphsInTypedOrder(typed, compiled);
  if (glyphs !== storageOrder.glyphsInTypedOrder(typed, glyphs2x)) assert.fail(name + ' glyphs of ' + hexOf(typed));
}

describe('readFont against 2.x arrange (DESIGN.md §6.1)', () => {
  for (const name of ['zawgyi', 'win']) {
    const text = name === 'zawgyi' ? arb.zawgyiText() : arb.winText();
    it(name + (name === 'win' ? ' (Win identity only)' : ''), () => {
      const strings = fc.oneof({ weight: 9, arbitrary: text }, { weight: 1, arbitrary: arb.codeUnits });
      fuzz.check(fc.property(strings, (s) => readerProperty(name, s)), 100000,
        REGRESSIONS[name].map((s) => [s]), 500000);
    });
  }
});
