// Differential fuzz of src/engine/syllable.js against 2.x order() in the frozen oracle (docs/next/DESIGN.md §6.1,
// §7.7; D19). Owner: W5 (engine-unicode).
//
// Each case is a 2.x syllable record, put into a SyllableBuffer through an adapter: a kinzi or none; a one-unit,
// ligature or whole base; up to three stacked consonants; e and medial ra pending from before the base; up to 12
// marks with repeats; keepU; and spaces and zero-width characters held after the syllable, with the syllable going
// on between them. closeSyllable's text must equal 2.x `order(syllable) + syllable.after` (storageOrder.js
// close()). 200,000 records on a pull request, 2,000,000 nightly.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { CodeBuffer, SyllableBuffer, closeSyllable, writesAsTyped } from '../../src/engine/syllable.js';
import { internals, fuzz } from './helpers.mjs';

const { order } = internals('storageOrder.js', ['order']);

const char = (code) => String.fromCharCode(code);
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const hex = (text) => Array.from(text, (ch) => ch.charCodeAt(0).toString(16).toUpperCase()).join(' ');
const units = (codes) => fc.constantFrom(...codes.map(char));

const CONSONANTS = range(0x1000, 0x1021);
// Ca, u and seven have rules of their own, so they are drawn more often.
const LOOK_ALIKE_BASES = [0x1005, 0x1025, 0x1047];
const SYLLABLE_BASES = range(0x1000, 0x102A).concat([0x103F], range(0x104C, 0x104F), range(0x1040, 0x1049));
// The whole bases of the fonts: Zawgyi lagaung, Win nnya with aa and Win kyat (DESIGN.md §3.8).
const WHOLE_BASES = ['\u104E\u1004\u103A\u1038', '\u1009\u102C', '\u1000\u103B\u1015\u103A'];
// The marks a reader pushes: U+102B-U+103E with a rank, that is all but U+1033-U+1035 and the virama.
const MARKS = range(0x102B, 0x1032).concat(range(0x1036, 0x1038), range(0x103A, 0x103E));
// The marks the rules of §3.4 turn on, drawn more often: aa, i, the lower vowels, ai, anusvara, dot below, asat,
// visarga and the medials.
const RULE_MARKS = [0x102B, 0x102C, 0x102D, 0x102F, 0x1032, 0x1036, 0x1037, 0x103A, 0x1038, 0x103B, 0x103E, 0x1031];
const HELD = [0x20, 0xA0, 0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF];
const ZERO_WIDTH = new Set([0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF]);

const base = fc.oneof(
  { weight: 6, arbitrary: units(SYLLABLE_BASES) },
  { weight: 3, arbitrary: units(LOOK_ALIKE_BASES) },
  { weight: 1, arbitrary: fc.tuple(units(CONSONANTS), units(CONSONANTS)).map(([a, b]) => a + '\u1039' + b) },
  { weight: 1, arbitrary: fc.constantFrom(...WHOLE_BASES) }
);
// Up to three stacked consonants, ca among them more often (stacked ca with medial ya is stacked jha), or none.
const stackedConsonant = fc.oneof(
  { weight: 3, arbitrary: units(CONSONANTS) },
  { weight: 1, arbitrary: fc.constant('\u1005') }
);
const stack = fc.oneof(
  { weight: 2, arbitrary: fc.constant('') },
  {
    weight: 1,
    arbitrary: fc.array(stackedConsonant, { minLength: 1, maxLength: 3 }).map((list) => '\u1039' + list.join('\u1039'))
  }
);
const mark = fc.oneof({ weight: 1, arbitrary: units(MARKS) }, { weight: 2, arbitrary: units(RULE_MARKS) });

// A record: { kinzi, base, stack, pending, marks, keepU, held }. `held` is a list of held units, and of 'goOn' where
// a mark joined the syllable after them.
const records = fc.record({
  kinzi: fc.constantFrom('', '', '', '\u1004\u103A\u1039', '\u101B\u103A\u1039'),
  base: base,
  stack: stack,
  pending: fc.array(units([0x1031, 0x103C]), { maxLength: 2 }).map((list) => list.join('')),
  marks: fc.array(mark, { maxLength: 12 }).map((list) => list.join('')),
  keepU: fc.boolean(),
  held: fc.array(fc.oneof(units(HELD), fc.constant('goOn')), { maxLength: 4 })
});

// The cases §7.7 names, checked first: a stacked syllable with aa and asat, dot below with i and no aa, and the
// other places of the asat.
const REGRESSIONS = [
  { base: '\u1000', stack: '\u1039\u1000', marks: '\u102C\u103A' },
  { base: '\u1000', marks: '\u1037\u102D\u103A' },
  { base: '\u1000', marks: '\u103B\u103A\u102C\u1031' },
  { base: '\u101B', marks: '\u103A\u103E\u103B\u102F' },
  { base: '\u1025', marks: '\u102C\u103A', stack: '\u1039\u1005', keepU: true },
  { base: '\u1047', marks: '\u1038\u1038' },
  { base: '\u1005', stack: '\u1039\u1005', marks: '\u103B\u103B' },
  { base: '\u1001', marks: '\u103C\u1036\u102C\u103A' },
  { base: '\u1001', marks: '\u1036\u102B\u1032' },
  { base: '\u100B\u1039\u100C', marks: '\u103A' },
  { base: '\u1000', marks: '\u102C', held: [' ', '\u200B', 'goOn', '\u00A0', '\u2060'] }
].map((record) => [Object.assign({ kinzi: '', stack: '', pending: '', marks: '', keepU: false, held: [] }, record)]);

// closeSyllable's text for a record, through the adapter.
function closedText(record) {
  const buf = bufferOf(record);
  const sink = new CodeBuffer(4);
  closeSyllable(buf, sink);
  return sink.decode();
}

// The record in a SyllableBuffer, its parts pushed in the order a reader pushes them.
function bufferOf(record) {
  const buf = new SyllableBuffer();
  buf.reset();
  for (let i = 0; i < record.pending.length; i++) buf.addPending(record.pending.charCodeAt(i));
  buf.open(record.kinzi ? record.kinzi.charCodeAt(0) : 0, record.keepU);
  const baseCodes = Uint16Array.from(record.base, (ch) => ch.charCodeAt(0));
  buf.setBaseText(baseCodes, 0, baseCodes.length);
  for (let i = 0; i < record.stack.length; i++) buf.pushStack(record.stack.charCodeAt(i));
  for (let i = 0; i < record.marks.length; i++) buf.pushMark(record.marks.charCodeAt(i));
  for (const event of record.held) {
    if (event === 'goOn') buf.goOn();
    else buf.hold(event.charCodeAt(0), ZERO_WIDTH.has(event.charCodeAt(0)));
  }
  return buf;
}

// 2.x: order(syllable) + syllable.after, where a held unit goes into after (and into kept when it is zero-width),
// and the syllable going on sets after = kept (storageOrder.js:235-260).
function closedTextBy2x(record) {
  let after = '';
  let kept = '';
  for (const event of record.held) {
    if (event === 'goOn') {
      after = kept;
    } else {
      after += event;
      if (ZERO_WIDTH.has(event.charCodeAt(0))) kept += event;
    }
  }
  const marks = (record.pending + record.marks).split('');
  return order({ kinzi: record.kinzi, base: record.base, stack: record.stack, marks: marks, after: after, kept: kept,
    keepU: record.keepU }) + after;
}

describe('orderSyllable against 2.x order() (DESIGN.md §7.7)', () => {
  it('closeSyllable writes what 2.x close() writes, on every record', () => {
    fuzz.check(fc.property(records, (record) => {
      const ours = closedText(record);
      const theirs = closedTextBy2x(record);
      if (ours !== theirs) {
        assert.fail(JSON.stringify(record) + '\n  next ' + hex(ours) + '\n  2.x  ' + hex(theirs));
      }
    }), 200000, REGRESSIONS, 2000000);
  });

  it('feeds every place of the asat and every look-alike letter', () => {
    const sample = fc.sample(records, { seed: fuzz.SEED, numRuns: 5000 });
    const changed = sample.filter((r) => closedTextBy2x(r) !== r.kinzi + r.base + r.stack + r.pending + r.marks +
      r.held.filter((e) => e !== 'goOn').join('')).length / sample.length;
    const has = (pattern) => sample.filter((r) => pattern.test(r.pending + r.marks)).length / sample.length;
    assert.ok(changed > 0.3, 'records that order() changes: ' + changed);
    assert.ok(has(/\u103A/) > 0.2 && has(/\u103B/) > 0.15 && has(/[\u102B\u102C]/) > 0.2, 'asat, medial ya and aa');
    assert.ok(sample.filter((r) => r.base === '\u1005' || r.base === '\u1025' || r.base === '\u1047').length > 500);
  });

  it('writesAsTyped holds only where 2.x writes the parts as they came, and on a share of the records', () => {
    const sample = fc.sample(records, { seed: fuzz.SEED, numRuns: 20000 });
    let asTyped = 0;
    for (const r of sample) {
      if (!writesAsTyped(bufferOf(r))) continue;
      asTyped++;
      const typed = r.kinzi + r.base + r.stack + r.pending + r.marks + r.held.filter((e) => e !== 'goOn').join('');
      assert.equal(hex(closedTextBy2x(r)), hex(typed), JSON.stringify(r));
    }
    assert.ok(asTyped > 500, 'records written as typed: ' + asTyped); // 1,107 of the 20,000 at the default seed
  });
});
