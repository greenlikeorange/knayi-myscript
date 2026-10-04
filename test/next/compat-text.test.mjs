// compat's normalize, syllBreak, spellingFix and truncate (src/compat/text.js; docs/next/DESIGN.md §5.1, §5.2
// C21-C24), against main.js. The text each function detects the font on is pinned with the inputs of §5.1.

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSameAsReference, compat, recordConsole, reference, resetOptions
} from './compat-helpers.mjs';

const UNICODE = '\u1019\u103C\u1014\u103A\u1019\u102C';
const ZAWGYI = '\u103B\u1019\u1014\u1039\u1019\u102C';
// U+200B, space, ka, medial ra: cleaned once it keeps a space in front, so no anchored signature matches and the
// tie falls back to Zawgyi; cleaned twice it reads as Unicode (§5.1).
const DETECTED_DIFFERENTLY = '\u200B \u1000\u103C';

afterEach(resetOptions);

describe('compat: which text each function detects the font on (§5.1)', () => {
  it('fontDetect gives Zawgyi for the text cleaned once and Unicode for it cleaned twice, as main.js', () => {
    assert.equal(compat.fontDetect(DETECTED_DIFFERENTLY), 'zawgyi');
    assert.equal(reference.fontDetect(DETECTED_DIFFERENTLY), 'zawgyi');
    // Trimming removes the space but not U+200B, which is not white space; the second cleaning removes the space.
    assert.equal(compat.fontDetect(' \u1000\u103C'), 'unicode');
    assert.equal(reference.fontDetect(' \u1000\u103C'), 'unicode');
  });

  it('truncate detects on the content as given, before trim and zero-width removal', () => {
    const text = DETECTED_DIFFERENTLY + '\u1031\u1000\u1000\u1000';
    // Zawgyi breaks: ka with medial ra is a part, and e starts the next one.
    assert.equal(compat.truncate(text, { length: 7 }), '\u1000\u103C...');
    assert.equal(reference.truncate(text, { length: 7 }), '\u1000\u103C...');
    // Cleaned first, the text would read as Unicode, and e would stay with its consonant.
    assert.equal(compat.truncate(text, { length: 7, fontType: 'unicode' }), '\u1000\u103C\u1031...');
  });

  it('syllBreak cleans first and detects on the cleaned text, which detection cleans again', () => {
    for (const text of [' \u200B ' + UNICODE, '\u200B \u1000\u103C\u1031\u1000', ' \u200C' + ZAWGYI + ' ']) {
      assertSameAsReference((k) => k.syllBreak(text), JSON.stringify(text));
      assertSameAsReference((k) => k.syllBreak(text, undefined, '|'), JSON.stringify(text));
    }
  });

  it('spellingFix detects on the text as given, then cleans it for the collapse', () => {
    const texts = ['\u200B \u1000\u103C\u102D\u102D', ' ' + ZAWGYI + '\u102C\u102C \u200B', UNICODE + '\u103A\u103A'];
    for (const text of texts) {
      assertSameAsReference((k) => k.spellingFix(text), JSON.stringify(text));
    }
  });
});

describe('compat: the text functions (C21-C24)', () => {
  it('C21: syllBreak breaks Unicode and Zawgyi as main.js does, with the S\'gaw Karen switch', () => {
    const texts = [UNICODE, ZAWGYI, '\u1000\u1000\u1000', '\u1000\u1064\u1000', '\u1000\u1064\u1000 \u1062\u103A',
      '\u1004\u103A\u1039\u1000', 'abc ' + UNICODE + ' (' + UNICODE + ')', '\u1031\u103B\u1000\u1000'];
    for (const text of texts) {
      for (const font of ['unicode', 'zawgyi', undefined]) {
        assertSameAsReference((k) => k.syllBreak(text, font), font + ' ' + JSON.stringify(text));
      }
    }
  });

  it('C22: spellingFix collapses each run of one repeated mark, per font', () => {
    const texts = [UNICODE + '\u102C\u102C\u102C', ZAWGYI + '\u1039\u1039', '\u1000\u1060\u1060\u1094\u1094',
      '\u1000\u102D\u102E\u102E'];
    for (const text of texts) {
      for (const font of ['unicode', 'zawgyi', 'win', undefined]) {
        assertSameAsReference((k) => k.spellingFix(text, font), font + ' ' + JSON.stringify(text));
      }
    }
  });

  it('C23: truncate reads its options first, and keeps whole parts, then words, then the omission', () => {
    const text = UNICODE + ' ' + UNICODE + ' abc def ' + UNICODE + UNICODE;
    const options = [undefined, null, 0, {}, { length: 0 }, { length: 8 }, { length: 12, omission: '\u2026' },
      { length: '10' }, { length: 10, omission: 5 }, { omission: '' }, { length: 25, fontType: 'zawgyi' },
      { length: -3 }, { length: Infinity }];
    for (const option of options) {
      for (const content of [text, 'abcdef', '', 12345, ZAWGYI + ' ' + ZAWGYI]) {
        assertSameAsReference((k) => k.truncate(content, option), JSON.stringify(option) + ' ' + String(content));
      }
    }
    let reads = 0;
    const counting = { get length() { reads++; return 9; } };
    const run = recordConsole(() => compat.truncate(null, counting));
    assert.equal(reads, 1, 'options are read even when the content is missing');
    assert.deepEqual(run, { value: '', console: ['warn: Content must be specified on knayi.truncate.'] });
  });

  // 2.10.0's truncate went on after a word that did not fit and kept a later one that did, '\u1000\u102C ab...' here;
  // 2.11's returns the start of the text (41984eb).
  it('C23: truncate returns a start of the text: a word that fits after one that does not is left out', () => {
    const text = '\u1000\u102C abcdefghij ab';
    assertSameAsReference((k) => k.truncate(text, { length: 12 }), JSON.stringify(text));
    assert.equal(compat.truncate(text, { length: 12 }), '\u1000\u102C...');
  });

  it('C24: normalize is NFC, the reader, typos, look-alikes and NFC, with NFC on text with no Myanmar', () => {
    const texts = ['e\u0301', '\u1000\u103B\u103C', '\u1000\u102F\u102D', '\u1025\u102E', '\u101D\u1040',
      '\u1040\u101D\u1041', ''];
    for (const text of texts) assertSameAsReference((k) => k.normalize(text), JSON.stringify(text));
    assert.equal(compat.normalize('e\u0301'), '\u00E9');
  });
});
