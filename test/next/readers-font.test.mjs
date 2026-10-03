// The font reader: readFont and glyphsInTypedOrder of src/engine/fontReader.js (docs/next/DESIGN.md §3.5, §3.6,
// §3.11, §7.8). Owner: W6 (engine-fonts).
//
// Each step of §3.6 has an example, and the font reader's side of the four deliberate differences between the
// readers (ARCHITECTURE.md) is pinned with the examples there. The reader is compared with 2.x arrange and
// glyphsInTypedOrder, in the frozen copy of scripts/oracle/storageOrder.js (D19), on every unit alone and on every
// pair of the units each font reads; readers-font.fuzz.test.mjs adds random strings. The memory check converts
// 8.9M characters and requires the scratch buffers back at their sizes (§3.11, §6.4).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ZW } from '../../src/script/codes.js';
import { ZAWGYI_FONT } from '../../src/fonts/zawgyi.js';
import { WIN_FONT } from '../../src/fonts/win.js';
import {
  FONT_READING, compileFont, readFont, glyphsInTypedOrder, fontReaderScratchUnits
} from '../../src/engine/fontReader.js';
import { fontToUnicode } from '../../src/stages/fonts.js';
import { internals } from './helpers.mjs';

const storageOrder = internals('storageOrder.js', ['arrange', 'glyphsInTypedOrder']);
const FONTS = {
  zawgyi: { compiled: compileFont(ZAWGYI_FONT), glyphs2x: internals('zawgyi.js', ['FONT']).FONT.glyphs },
  win: { compiled: compileFont(WIN_FONT), glyphs2x: internals('win.js', ['FONT']).FONT.glyphs }
};
const ZAWGYI = FONTS.zawgyi.compiled;
const WIN = FONTS.win.compiled;

const hexOf = (text) => Array.from(text, (ch) => ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');

// readFont agrees with 2.x arrange on each input, for the font.
function assertAgreesWithArrange(inputs, name) {
  const { compiled, glyphs2x } = FONTS[name];
  const differ = [];
  for (const text of inputs) {
    if (readFont(text, compiled) !== storageOrder.arrange(text, glyphs2x)) differ.push(hexOf(text));
  }
  assert.deepEqual(differ.slice(0, 10), [], differ.length + ' of ' + inputs.length + ' ' + name + ' inputs differ');
}

describe('the font reader\'s side of the four differences (DESIGN.md §3.5; ARCHITECTURE.md)', () => {
  it('heldZeroWidth: all five zero-width characters typed in a syllable move to its end', () => {
    assert.equal(FONT_READING.heldZeroWidth, ZW.ALL);
    for (const zw of ['\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF']) {
      assert.equal(readFont('\u1000' + zw + '\u102C', ZAWGYI), '\u1000\u102C' + zw, hexOf(zw));
    }
    assert.equal(fontToUnicode('\u1000\u200C\u102C', 'zawgyi'), '\u1000\u102C\u200C');
  });

  it('digitTakesMarksAcrossSpace: after a held space, a mark joins a digit too', () => {
    assert.equal(FONT_READING.digitTakesMarksAcrossSpace, true);
    assert.equal(fontToUnicode('\u1041 \u102C', 'zawgyi'), '\u1041\u102C');
    assert.equal(readFont('\u1041 \u102C', ZAWGYI), '\u1041\u102C');
  });

  it('prebaseCrossesZeroWidth: with no open syllable, a zero-width character is written and e waits for the base', () => {
    assert.equal(FONT_READING.prebaseCrossesZeroWidth, true);
    assert.equal(fontToUnicode('\u1031\u200B\u1000', 'zawgyi'), '\u200B\u1000\u1031');
    assert.equal(readFont('\u103B\u2060\u1031\uFEFF\u1000', ZAWGYI), '\u2060\uFEFF\u1000\u103C\u1031');
  });

  it('keepUAfterVowelSign: u with asat is nya, even after a vowel sign', () => {
    assert.equal(FONT_READING.keepUAfterVowelSign, false);
    assert.equal(fontToUnicode('\u101C\u1032\u1025\u1039\u1038', 'zawgyi'), '\u101C\u1032\u1009\u103A\u1038');
  });
});

describe('readFont, step by step (DESIGN.md §3.6)', () => {
  it('1. a space held after a syllable is dropped when a mark follows, and kept before a base', () => {
    assert.equal(readFont('\u1000 \u102C', ZAWGYI), '\u1000\u102C');
    assert.equal(readFont('\u1000 \u1001', ZAWGYI), '\u1000 \u1001');
    assert.equal(readFont('\u1000 \u200B \u102C \u1001', ZAWGYI), '\u1000\u102C\u200B \u1001', 'the zero-width stays');
    assert.equal(readFont('u \u00A0 m', WIN), '\u1000\u102C', 'no-break spaces too');
  });

  it('2. a zero-width character with no open syllable is written at once', () => {
    assert.equal(readFont('\u200B\u1000', ZAWGYI), '\u200B\u1000');
    assert.equal(readFont('\u1031\u200C\u103B\u200D\u1000', ZAWGYI), '\u200C\u200D\u1000\u103C\u1031');
  });

  it('3. a unit with no glyph ends the syllable, after the e or medial ra that found no base', () => {
    assert.equal(readFont('\u1000\u102Ca\u102C', ZAWGYI), '\u1000\u102Ca\u102C');
    assert.equal(readFont('\u1031a', ZAWGYI), '\u1031a');
    assert.equal(readFont('\uD800\u1000\u102C\uDFFF', ZAWGYI), '\uD800\u1000\u102C\uDFFF', 'lone surrogates pass');
  });

  it('4. a base starts a syllable, whose first marks are the pending e and medial ra', () => {
    assert.equal(readFont('\u1031\u1000', ZAWGYI), '\u1000\u1031');
    assert.equal(readFont('\u1031\u103B\u1000\u102C', ZAWGYI), '\u1000\u103C\u1031\u102C');
    assert.equal(readFont('a>u', WIN), '\u1000\u103C\u103D\u1031', 'a medial ra glyph that also draws wa');
    assert.equal(readFont('\u1092\u102F', ZAWGYI), '\u100B\u1039\u100C\u102F', 'a ligature base');
  });

  it('5. e or medial ra ends the open syllable and waits for the next base', () => {
    assert.equal(readFont('\u1000\u1031\u1001', ZAWGYI), '\u1000\u1001\u1031');
    assert.equal(readFont('\u1000\u1031', ZAWGYI), '\u1000\u1031', 'no base after it: written where it was typed');
  });

  it('6. marks, stacked consonants and kinzi join the open syllable, in storage order', () => {
    assert.equal(readFont('\u1000\u1060', ZAWGYI), '\u1000\u1039\u1000');
    assert.equal(readFont('\u1000\u1064', ZAWGYI), '\u1004\u103A\u1039\u1000');
    assert.equal(readFont('\u1002\u108B', ZAWGYI), '\u1004\u103A\u1039\u1002\u102D', 'kinzi with i');
    assert.equal(readFont('\u1000\u102F\u103A', ZAWGYI), '\u1000\u103B\u102F', 'medial ya before u');
    assert.equal(readFont('\u1000\u102C\u102C', ZAWGYI), '\u1000\u102C', 'a mark typed twice counts once');
    assert.equal(readFont('w\u00C9', WIN), '\u1010\u1039\u1010\u103D', 'a stacked consonant with its wa');
    assert.equal(readFont('\u1005\u103A', ZAWGYI), '\u1008', 'ca with medial ya is jha');
  });

  it('7. plain text, or a mark with no base, ends the syllable and is written as it is', () => {
    assert.equal(readFont('u?', WIN), '\u1000\u104A');
    assert.equal(readFont('a?', WIN), '\u1031\u104A', 'after the pending e');
    assert.equal(readFont('\u102C\u1000', ZAWGYI), '\u102C\u1000');
    assert.equal(readFont('\u00D8u', WIN), '\u1004\u103A\u1039\u102D\u1000', 'a kinzi with no base: text and mark');
    assert.equal(readFont('u\u00B0m', WIN), '\u1000\u102C', 'the vendor logo has no text, and the aa no base');
  });

  it('the end: the open syllable is written, then any e or medial ra that found no base', () => {
    assert.equal(readFont('\u1000 ', ZAWGYI), '\u1000 ');
    assert.equal(readFont('\u1031', ZAWGYI), '\u1031');
    assert.equal(readFont('', ZAWGYI), '');
  });
});

// Every unit alone, and every pair of the units a font reads (its keys, the Myanmar block, spaces and zero-width
// characters) after a base of that font.
function unitsAndPairs(compiled, base) {
  const read = [];
  for (let code = 0; code < compiled.index.length; code++) if (compiled.index[code]) read.push(String.fromCharCode(code));
  read.push(' ', '\u00A0', '\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF', 'x');
  const inputs = [];
  for (let code = 0; code < 0x10000; code++) inputs.push(String.fromCharCode(code));
  for (const a of read) for (const b of read) inputs.push(base + a + b);
  return inputs;
}

describe('readFont against 2.x arrange (DESIGN.md §6.2)', () => {
  it('zawgyi: every unit alone, and every pair of the units it reads after ka', () => {
    assertAgreesWithArrange(unitsAndPairs(ZAWGYI, '\u1000'), 'zawgyi');
  });

  it('win: every unit alone, and every pair of the units it reads after ka (Win identity only)', () => {
    assertAgreesWithArrange(unitsAndPairs(WIN, 'u'), 'win');
  });

  it('glyphsInTypedOrder agrees with 2.x on every unit and on the pairs', () => {
    for (const name of ['zawgyi', 'win']) {
      const { compiled, glyphs2x } = FONTS[name];
      const inputs = unitsAndPairs(compiled, name === 'win' ? 'u' : '\u1000');
      const differ = inputs.filter((text) => glyphsInTypedOrder(text, compiled) !== storageOrder.glyphsInTypedOrder(text, glyphs2x));
      assert.deepEqual(differ.map(hexOf).slice(0, 10), [], name);
    }
  });
});

describe('scratch buffers (DESIGN.md §3.11, §6.4)', () => {
  it('after an 8.9M-character conversion, every buffer is back at its size', () => {
    readFont('\u1000', ZAWGYI);
    const before = fontReaderScratchUnits();
    const line = '\u1031\u1000\u102C\u1039 \u107E\u1019\u102D\u1033\u1037 \u1000\u1060\u102C\u1038 \u1044\u1004\u1039\u1038\n';
    const text = line.repeat(Math.ceil(8.9e6 / line.length));
    assert.ok(text.length >= 8.9e6);
    assert.equal(fontToUnicode(text, 'zawgyi').length > 0, true);
    assert.ok(fontReaderScratchUnits() <= before, fontReaderScratchUnits() + ' units after, ' + before + ' before');
  });

  it('a held run, a stack and a pending run past 65,536 units are released too', () => {
    readFont('\u1000', ZAWGYI);
    const before = fontReaderScratchUnits();
    const long = 70000;
    readFont('\u1000' + ' '.repeat(long) + '\u1060'.repeat(long) + '\u1031'.repeat(long), ZAWGYI);
    assert.ok(fontReaderScratchUnits() <= before, fontReaderScratchUnits() + ' units after, ' + before + ' before');
    assert.equal(readFont('\u1031'.repeat(3) + '\u1000', ZAWGYI), '\u1000\u1031', 'and the reader still works');
  });
});
