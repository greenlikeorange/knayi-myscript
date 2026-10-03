// src/engine/syllable.js: CodeBuffer, SyllableBuffer, orderSyllable and its steps, CopyThroughWriter, and the reader
// decisions isHeld and marksGoOn (docs/next/DESIGN.md §3.3-§3.5, §3.7, §7.7). Owner: W5 (engine-unicode).
//
// Each rule of §3.4 has an example here, checked against its expected text and against 2.x order() in the frozen
// oracle (D19). syllable.fuzz.test.mjs compares orderSyllable with order() on fuzzed records.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ASAT_PLACE, CodeBuffer, SyllableBuffer, CopyThroughWriter, closeSyllable, orderSyllable, placeAsat,
  fixLookAlikeLetters, rankMarks, sortByRank, writeOrdered, writeHeld, isHeld, marksGoOn
} from '../../src/engine/syllable.js';
import { UNICODE_READING } from '../../src/engine/unicodeReader.js';
import { FONT_READING } from '../../src/engine/fontReader.js';
import { internals } from './helpers.mjs';

const { order } = internals('storageOrder.js', ['order']);

const codesOf = (text) => Array.from(text, (ch) => ch.charCodeAt(0));
const hex = (text) => codesOf(text).map((c) => c.toString(16).toUpperCase()).join(' ');

// A SyllableBuffer holding a 2.x-style record: { kinzi, base, stack, marks, keepU, pending }. kinzi is '' or its
// three units; base and stack are text; marks and pending are text, one mark per unit, in typed order.
function bufferOf(record) {
  const buf = new SyllableBuffer();
  buf.reset();
  for (const code of codesOf(record.pending || '')) buf.addPending(code);
  buf.open(record.kinzi ? record.kinzi.charCodeAt(0) : 0, Boolean(record.keepU));
  const base = Uint16Array.from(codesOf(record.base));
  if (base.length === 1) buf.setBase(base[0]);
  else buf.setBaseText(base, 0, base.length);
  for (const code of codesOf(record.stack || '')) buf.pushStack(code);
  for (const code of codesOf(record.marks || '')) buf.pushMark(code);
  return buf;
}

// orderSyllable's text for a record.
function ordered(record) {
  const sink = new CodeBuffer();
  orderSyllable(bufferOf(record), sink);
  return sink.decode();
}

// 2.x order() on the same record.
function orderedBy2x(record) {
  return order({
    kinzi: record.kinzi || '', base: record.base, stack: record.stack || '',
    marks: (record.pending || '').split('').concat((record.marks || '').split('')), after: '', kept: '',
    keepU: Boolean(record.keepU)
  });
}

// Checks a record's ordered text against the expected text and against 2.x.
function assertOrders(record, expected, why) {
  assert.equal(hex(ordered(record)), hex(expected), why);
  assert.equal(hex(orderedBy2x(record)), hex(expected), why + ' (2.x order)');
}

describe('CodeBuffer (DESIGN.md §3.7)', () => {
  it('pushes units, grows by doubling, and keeps its capacity when cleared', () => {
    const buffer = new CodeBuffer(2);
    assert.equal(buffer.capacity(), 2);
    buffer.push(0x1000);
    buffer.pushText('abေc', 1, 3);
    buffer.pushCodes(Uint16Array.of(1, 2, 3, 4), 1, 3);
    assert.equal(buffer.length, 5);
    assert.equal(buffer.capacity(), 8);
    assert.deepEqual([0, 1, 2, 3, 4].map((i) => buffer.codeAt(i)), [0x1000, 0x62, 0x1031, 2, 3]);
    buffer.clear();
    assert.equal(buffer.length, 0);
    assert.equal(buffer.capacity(), 8);
    assert.equal(new CodeBuffer().capacity(), 256);
  });

  it('compares itself with a slice of a text', () => {
    const buffer = new CodeBuffer();
    buffer.pushText('\u1000\u102C', 0, 2);
    assert.equal(buffer.equalsText('x\u1000\u102Cy', 1, 3), true);
    assert.equal(buffer.equalsText('x\u1000\u102Dy', 1, 3), false);
    assert.equal(buffer.equalsText('x\u1000\u102Cy', 1, 4), false);
    assert.equal(buffer.equalsText('\u1000', 0, 1), false);
  });

  it('decodes in chunks of at most 8,192 units, and keeps lone surrogates', () => {
    const text = '\uD800' + '\u1000\u102C'.repeat(10000) + '\uDC00';
    const buffer = new CodeBuffer();
    buffer.pushText(text, 0, text.length);
    assert.equal(buffer.decode(), text);
    assert.equal(new CodeBuffer().decode(), '');
  });

  it('releases itself only when it grew past 65,536 units', () => {
    const buffer = new CodeBuffer(16);
    for (let i = 0; i < 65536; i++) buffer.push(0x1000);
    buffer.releaseIfLarge();
    assert.equal(buffer.capacity(), 65536);
    assert.equal(buffer.length, 65536);
    buffer.push(0x1000);
    buffer.releaseIfLarge();
    assert.equal(buffer.capacity(), 16);
    assert.equal(buffer.length, 0);
  });
});

describe('SyllableBuffer (DESIGN.md §3.3)', () => {
  it('holds each mark once, in the order first typed, with its bit in the mask', () => {
    const buf = bufferOf({ base: '\u1000', marks: '\u102F\u102D\u102F\u1036\u102D' });
    assert.deepEqual(Array.from(buf.marks.subarray(0, buf.markCount)), [0x102F, 0x102D, 0x1036]);
    assert.equal(buf.markMask, (1 << 4) | (1 << 2) | (1 << 11));
    buf.removeMark(0x102D);
    assert.deepEqual(Array.from(buf.marks.subarray(0, buf.markCount)), [0x102F, 0x1036]);
    assert.equal(buf.indexOfMark(0x102D), -1);
    assert.equal(buf.markMask, (1 << 4) | (1 << 11));
  });

  it('opens a syllable with the pending e and medial ra as its first marks, and empties pending', () => {
    const buf = bufferOf({ pending: '\u1031\u103C\u1031', base: '\u1000', marks: '\u102C' });
    assert.deepEqual(Array.from(buf.marks.subarray(0, buf.markCount)), [0x1031, 0x103C, 0x102C]);
    assert.equal(buf.pendingLength, 0);
    assert.equal(buf.isOpen, true);
  });

  it('counts a ligature base as stacked, and a whole base as not', () => {
    assert.equal(bufferOf({ base: '\u100B\u1039\u100C' }).baseHasVirama, true);
    assert.equal(bufferOf({ base: '\u104E\u1004\u103A\u1038' }).baseHasVirama, false);
    assert.equal(bufferOf({ base: '\u1039\u1000' }).baseHasVirama, false); // a virama first is not after the base
    const buf = bufferOf({ base: '\u1000\u103B\u1015\u103A' });
    assert.equal(buf.base, 0x1000);
    assert.equal(buf.baseLength, 4);
  });

  it('holds spaces and zero-width characters, and drops the spaces when the syllable goes on', () => {
    const buf = bufferOf({ base: '\u1000' });
    buf.hold(0x20, false);
    buf.hold(0x200B, true);
    assert.equal(buf.spaceHeld, true);
    buf.goOn();
    assert.equal(buf.spaceHeld, false);
    assert.equal(buf.keptUpTo, 2);
    buf.hold(0x20, false);
    const sink = new CodeBuffer();
    writeHeld(buf, sink);
    assert.equal(hex(sink.decode()), hex('\u200B '));
  });

  it('writes pending marks that found no base as they were typed, and resets', () => {
    const buf = new SyllableBuffer();
    buf.addPending(0x1031);
    buf.addPending(0x103C);
    const sink = new CodeBuffer();
    buf.writePending(sink);
    assert.equal(hex(sink.decode()), hex('\u1031\u103C'));
    assert.equal(buf.pendingLength, 0);
    const open = bufferOf({ pending: '\u1031', base: '\u1000', marks: '\u102C', stack: '\u1039\u1000' });
    open.reset();
    assert.equal(open.isOpen, false);
    assert.equal(open.markCount + open.markMask + open.stackLength + open.heldLength + open.pendingLength, 0);
  });

  it('grows its stack, held and pending arrays, and releases them past 65,536 units', () => {
    const buf = bufferOf({ base: '\u1000' });
    const first = buf.scratchUnits();
    for (let i = 0; i < 70000; i++) {
      buf.pushStack(0x1039);
      buf.hold(0x20, false);
      buf.addPending(0x1031);
    }
    assert.equal(buf.stackLength, 70000);
    assert.ok(buf.scratchUnits() > 3 * 65536);
    buf.releaseIfLarge();
    assert.equal(buf.scratchUnits(), first);
  });
});

describe('orderSyllable and its steps (DESIGN.md §3.4)', () => {
  it('writes a syllable with no marks and no stack as kinzi and base', () => {
    assertOrders({ kinzi: '\u1004\u103A\u1039', base: '\u1002' }, '\u1004\u103A\u1039\u1002', 'kinzi');
    assertOrders({ kinzi: '\u101B\u103A\u1039', base: '\u1000' }, '\u101B\u103A\u1039\u1000', 'repha');
    assertOrders({ base: '\u1005' }, '\u1005', 'ca alone stays ca');
  });

  it('places the asat: NONE, DROPPED, IN_ORDER, ON_CONSONANT and AFTER_MEDIALS', () => {
    const place = (record) => placeAsat(bufferOf(record), Boolean(record.stack));
    assert.equal(place({ base: '\u1000', marks: '\u102C' }), ASAT_PLACE.NONE);
    assert.equal(place({ base: '\u1014', marks: '\u102D\u103A' }), ASAT_PLACE.DROPPED); // i with asat: a slip
    assert.equal(place({ base: '\u1000', stack: '\u1039\u1000', marks: '\u103A' }), ASAT_PLACE.DROPPED);
    // DROPPED is tested first: dot below with i and no aa drops the asat although the dot below alone keeps it.
    assert.equal(place({ base: '\u1000', marks: '\u1037\u102D\u103A' }), ASAT_PLACE.DROPPED);
    // A stacked syllable with aa and asat is not a slip: aa makes it the vowel's asat, stored last.
    assert.equal(place({ base: '\u1000', stack: '\u1039\u1000', marks: '\u102C\u103A' }), ASAT_PLACE.IN_ORDER);
    assert.equal(place({ base: '\u1000', marks: '\u1037\u103A' }), ASAT_PLACE.IN_ORDER); // dot below
    assert.equal(place({ base: '\u1000', marks: '\u103B\u1031\u102C\u103A' }), ASAT_PLACE.IN_ORDER); // kyaw
    assert.equal(place({ base: '\u1000', marks: '\u103A\u102C' }), ASAT_PLACE.IN_ORDER); // aa, no medial
    assert.equal(place({ base: '\u1001', marks: '\u103B\u103A' }), ASAT_PLACE.ON_CONSONANT);
    assert.equal(place({ base: '\u101B', marks: '\u103E\u103A' }), ASAT_PLACE.AFTER_MEDIALS);
  });

  it('writes the asat where UTN #11 puts it', () => {
    assertOrders({ base: '\u1014', marks: '\u102D\u103A' }, '\u1014\u102D', 'i with asat: dropped');
    assertOrders({ base: '\u1000', stack: '\u1039\u1000', marks: '\u102C\u103A' }, '\u1000\u1039\u1000\u102C\u103A',
      'stacked, aa and asat: last');
    assertOrders({ base: '\u1000', marks: '\u103B\u103A\u102C\u1031' }, '\u1000\u103A\u103B\u1031\u102C',
      'yauk-kya: asat typed before aa, with a medial, sits on the consonant');
    assertOrders({ base: '\u1000', marks: '\u103B\u1031\u102C\u103A' }, '\u1000\u103B\u1031\u102C\u103A',
      'kyaw: asat typed after e and aa goes last');
    assertOrders({ base: '\u1001', marks: '\u103B\u103A' }, '\u1001\u103A\u103B', 'loanword final: on the consonant');
    assertOrders({ base: '\u1014', marks: '\u103A\u102F' }, '\u1014\u103A\u102F', 'kyun-up: on the consonant');
    assertOrders({ base: '\u101B', marks: '\u103A\u103E' }, '\u101B\u103E\u103A', 'medial ha: after the medials');
    assertOrders({ base: '\u101B', marks: '\u103A\u103E\u103B\u102F' }, '\u101B\u103B\u103E\u103A\u102F',
      'after the medials, before the vowels');
  });

  it('reads the letters the fonts draw alike', () => {
    assertOrders({ base: '\u1005', marks: '\u103B' }, '\u1008', 'ca with medial ya is jha');
    assertOrders({ base: '\u1019', stack: '\u1039\u1005', marks: '\u103B\u102D' }, '\u1019\u1039\u1008\u102D',
      'stacked ca with medial ya is stacked jha');
    assertOrders({ base: '\u1005', stack: '\u1039\u1000', marks: '\u103B' }, '\u1005\u1039\u1000\u103B',
      'a stacked ca comes first; a ca base with a stack keeps its medial ya');
    assertOrders({ base: '\u1025', marks: '\u1037\u103A' }, '\u1009\u1037\u103A', 'u with asat is nya');
    assertOrders({ base: '\u1025', marks: '\u102C' }, '\u1009\u102C', 'u with aa is nya');
    assertOrders({ base: '\u1025', stack: '\u1039\u1005' }, '\u1009\u1039\u1005', 'u with a stack is nya');
    assertOrders({ base: '\u1025', marks: '\u103A\u1038', keepU: true }, '\u1025\u103A\u1038', 'keepU: Pa\'o u');
    assertOrders({ base: '\u1025', marks: '\u102D' }, '\u1025\u102D', 'u with i stays u');
    assertOrders({ base: '\u1047', marks: '\u1031\u1038' }, '\u101B\u1031\u1038', 'seven with a vowel sign is ra');
    assertOrders({ base: '\u1047', marks: '\u1038' }, '\u1047\u1038', 'seven with visarga alone: a time, 7:30');
    assertOrders({ base: '\u1047', marks: '\u103B\u103A' }, '\u101B\u103A\u103B', 'seven with an asat on it is ra');
  });

  it('keeps fixLookAlikeLetters to one-unit bases, and reads aa before any mark is removed', () => {
    const buf = bufferOf({ base: '\u1005\u1039\u1005', marks: '\u103B' }); // a ligature base starting with ca
    fixLookAlikeLetters(buf, ASAT_PLACE.NONE, true, false);
    assert.equal(buf.base, 0x1005);
    assert.equal(buf.markCount, 1);
    const u = bufferOf({ base: '\u1025' });
    fixLookAlikeLetters(u, ASAT_PLACE.NONE, false, true); // aa was among the marks before one was removed
    assert.equal(u.base, 0x1009);
  });

  it('ranks ai and anusvara typed before aa with the lower vowels, except anusvara before tall aa', () => {
    const ranks = (record) => {
      const buf = bufferOf(record);
      rankMarks(buf);
      return Array.from(buf.ranks.subarray(0, buf.markCount));
    };
    assert.deepEqual(ranks({ base: '\u1001', marks: '\u103C\u1036\u102C' }), [1, 6, 7]); // Karen ခရံာ်, Christ
    assert.deepEqual(ranks({ base: '\u1001', marks: '\u1036\u102B' }), [8, 7]); // anusvara before tall aa
    assert.deepEqual(ranks({ base: '\u1001', marks: '\u1032\u102B' }), [6, 7]); // ai before tall aa
    assert.deepEqual(ranks({ base: '\u1010', marks: '\u1032\u102F' }), [8, 6]); // a lower vowel: Mon တုဲ
    assert.deepEqual(ranks({ base: '\u1010', marks: '\u102C\u1032' }), [7, 8]); // after aa
    assertOrders({ base: '\u1001', marks: '\u103C\u1036\u102C\u103A' }, '\u1001\u103C\u1036\u102C\u103A',
      'Karen ခရံာ်: anusvara stays before aa');
    assertOrders({ base: '\u1001', marks: '\u1036\u102B' }, '\u1001\u102B\u1036', 'anusvara goes after tall aa');
    assertOrders({ base: '\u1010', marks: '\u1032\u102F' }, '\u1010\u102F\u1032', 'ai after a lower vowel');
  });

  it('sorts stably by rank: marks of one group keep their typed order', () => {
    const buf = bufferOf({ base: '\u1000', marks: '\u1038\u102E\u102D\u103B\u1037' });
    rankMarks(buf);
    sortByRank(buf);
    const sorted = String.fromCharCode(...buf.marks.subarray(0, buf.markCount));
    assert.equal(hex(sorted), hex('\u103B\u102E\u102D\u1037\u1038'));
  });

  it('writes kinzi, base, stack, asat on the consonant and the marks, in that order', () => {
    const buf = bufferOf({ kinzi: '\u1004\u103A\u1039', base: '\u1000', stack: '\u1039\u1001', marks: '\u102F' });
    const sink = new CodeBuffer();
    writeOrdered(buf, ASAT_PLACE.ON_CONSONANT, sink);
    assert.equal(hex(sink.decode()), hex('\u1004\u103A\u1039\u1000\u1039\u1001\u103A\u102F'));
  });

  it('closes a syllable: ordered text, then what was held, and closed', () => {
    const buf = bufferOf({ base: '\u1000', marks: '\u102C' });
    buf.hold(0x20, false);
    buf.hold(0x2060, true);
    buf.goOn();
    buf.pushMark(0x1031);
    buf.hold(0xA0, false);
    const sink = new CodeBuffer();
    closeSyllable(buf, sink);
    assert.equal(hex(sink.decode()), hex('\u1000\u1031\u102C\u2060\u00A0'));
    assert.equal(buf.isOpen, false);
    closeSyllable(buf, sink); // nothing open: nothing written
    assert.equal(sink.length, 5);
  });
});

describe('the reader decisions (DESIGN.md §3.5)', () => {
  it('isHeld: spaces, and the zero-width characters of each reader, after an open syllable only', () => {
    const buf = bufferOf({ base: '\u1000' });
    const held = (code, reading) => isHeld(buf, code, reading);
    for (const code of [0x20, 0xA0, 0x200B, 0x2060, 0xFEFF]) {
      assert.equal(held(code, UNICODE_READING), true, code.toString(16));
      assert.equal(held(code, FONT_READING), true, code.toString(16));
    }
    for (const code of [0x200C, 0x200D]) {
      assert.equal(held(code, UNICODE_READING), false, 'Unicode: ZWNJ and ZWJ stay where they were typed');
      assert.equal(held(code, FONT_READING), true, 'fonts: all five zero-width characters');
    }
    for (const code of [0x0A, 0x09, 0x3000, 0x1000, 0x102C]) assert.equal(held(code, FONT_READING), false);
    buf.isOpen = false;
    assert.equal(held(0x20, UNICODE_READING), false);
  });

  it('marksGoOn: a digit takes no mark from across a space in Unicode text; in the fonts it does', () => {
    const digit = bufferOf({ base: '\u1041' });
    const letter = bufferOf({ base: '\u1000' });
    assert.equal(marksGoOn(digit, UNICODE_READING), true);
    digit.hold(0x20, false);
    letter.hold(0x20, false);
    assert.equal(marksGoOn(digit, UNICODE_READING), false);
    assert.equal(marksGoOn(digit, FONT_READING), true);
    assert.equal(marksGoOn(letter, UNICODE_READING), true);
    digit.hold(0x200B, true);
    digit.goOn();
    assert.equal(marksGoOn(digit, UNICODE_READING), true);
  });
});

describe('CopyThroughWriter (DESIGN.md §3.7)', () => {
  // Writes each [start, end, text] syllable in turn.
  function write(source, syllables) {
    const writer = new CopyThroughWriter();
    writer.begin(source);
    for (const [start, end, text] of syllables) {
      writer.beginSyllable();
      writer.syllable.pushText(text, 0, text.length);
      writer.endSyllable(start, end);
    }
    return writer.finish();
  }

  it('returns the source string itself when no syllable changed', () => {
    const source = 'a\u1000\u102C b';
    const out = write(source, [[1, 3, '\u1000\u102C']]);
    assert.equal(out, source);
    assert.equal(write('', []), '');
  });

  it('copies the source between changed syllables', () => {
    const source = 'x\u1000\u103A\u103B y\u1001\u1031 z';
    assert.equal(hex(write(source, [[1, 4, '\u1000\u103B\u103A'], [6, 8, '\u1001\u1031']])),
      hex('x\u1000\u103B\u103A y\u1001\u1031 z'));
    assert.equal(hex(write(source, [[1, 4, '\u1000\u103A\u103B'], [6, 8, '\u1001'], [8, 8, '']])),
      hex('x\u1000\u103A\u103B y\u1001 z'));
    assert.equal(hex(write(source, [[1, 5, '\u1000']])), hex('x\u1000y\u1001\u1031 z'));
  });

  it('lets go of the source when it finishes, and releases a large syllable buffer', () => {
    const writer = new CopyThroughWriter();
    writer.begin('\u1000'.repeat(70000));
    writer.beginSyllable();
    writer.syllable.pushText('\u1001'.repeat(70000), 0, 70000);
    writer.endSyllable(0, 70000);
    assert.equal(writer.finish(), '\u1001'.repeat(70000));
    assert.equal(writer.source, '');
    assert.equal(writer.out, '');
    writer.releaseIfLarge();
    assert.equal(writer.syllable.capacity(), 256);
  });
});
