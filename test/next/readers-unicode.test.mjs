// src/engine/unicodeReader.js: reorderUnicode, the Unicode reader of normalize (docs/next/DESIGN.md §3.5, §3.6,
// §3.11, §7.7). Owner: W5 (engine-unicode).
//
// The steps of §3.6 and the Unicode reader's side of the four deliberate differences (ARCHITECTURE.md), each with an
// example, checked against its expected text and against 2.x arrangeUnicode in the frozen oracle (D19); the SEEN
// flags; the pending invariant; and the scratch memory after a long call. readers-unicode.fuzz.test.mjs compares the
// reader with arrangeUnicode on fuzzed strings and the cached corpora.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { UNICODE_READING, STABLE_UNICODE_READING, SEEN, reorderUnicode } from '../../src/engine/unicodeReader.js';
import { SyllableBuffer } from '../../src/engine/syllable.js';
import { ZW } from '../../src/script/codes.js';
import { oracle, arb, fuzz } from './helpers.mjs';

// The scratch check after long calls, run in a process of its own.
const SCRATCH_PROBE = fileURLToPath(new URL('./readers-unicode.scratch.mjs', import.meta.url));

const hex = (text) => Array.from(text, (ch) => ch.charCodeAt(0).toString(16).toUpperCase()).join(' ');

// reorderUnicode's text, checked against 2.x arrangeUnicode first.
function reordered(text) {
  const out = reorderUnicode(text).text;
  const want = oracle.storageOrder.arrangeUnicode(text);
  assert.equal(hex(out), hex(want), 'reorderUnicode differs from 2.x on ' + hex(text));
  return out;
}

function assertReorders(text, expected, why) {
  assert.equal(hex(reordered(text)), hex(expected), why);
}

describe('the Unicode reader\'s options (DESIGN.md §3.5)', () => {
  it('UNICODE_READING and SEEN have their values', () => {
    assert.deepEqual(UNICODE_READING, {
      heldZeroWidth: ZW.ZWSP | ZW.WORD_JOINER | ZW.BOM, digitTakesMarksAcrossSpace: false,
      prebaseCrossesZeroWidth: false, keepUAfterVowelSign: true, stackedLookAlikesAreLetters: false
    });
    // 3.0's reading differs in one field (DESIGN.md §11.2).
    assert.deepEqual(STABLE_UNICODE_READING, Object.assign({}, UNICODE_READING, { stackedLookAlikesAreLetters: true }));
    assert.deepEqual(SEEN, { LETTER_U: 1, NFC_UNSAFE: 2 });
  });

  // ARCHITECTURE.md, "The four deliberate differences between the readers": the Unicode side.
  it('ZWNJ and ZWJ stay where they were typed; ZWSP, word joiner and BOM move out of the syllable', () => {
    assertReorders('\u1000\u200C\u102C', '\u1000\u200C\u102C', 'ZWNJ is not held');
    assertReorders('\u1000\u200D\u102C', '\u1000\u200D\u102C', 'ZWJ is not held');
    for (const zw of ['\u200B', '\u2060', '\uFEFF']) {
      assertReorders('\u1000' + zw + '\u102C', '\u1000\u102C' + zw, 'held: ' + hex(zw));
    }
  });

  it('a digit takes no mark from across a space; a letter does', () => {
    assertReorders('\u1041 \u102C', '\u1041 \u102C', 'digit, space, aa');
    assertReorders('\u1000 \u102C', '\u1000\u102C', 'letter, space, aa: the space only moved the mark');
    assertReorders('\u1047 \u102C', '\u1047 \u102C', 'seven, space, aa');
  });

  it('an e or medial ra never crosses a zero-width character to reach the next base', () => {
    assertReorders('\u1031\u200B\u1000', '\u1031\u200B\u1000', 'e, ZWSP, ka');
    assertReorders('\u103C\u2060\u1000', '\u103C\u2060\u1000', 'medial ra, word joiner, ka');
    assertReorders('\u1031\u1000', '\u1000\u1031', 'e, ka');
  });

  it('keeps u right after a vowel sign (keepU), and reads it as nya elsewhere', () => {
    assertReorders('\u101C\u1032\u1025\u103A\u1038', '\u101C\u1032\u1025\u103A\u1038', 'Pa\'o, after ai');
    assertReorders('\u1015\u102B\u1025\u1037\u103A', '\u1015\u102B\u1025\u1037\u103A', 'after tall aa');
    assertReorders('\u1009\u1025\u1037\u103A', '\u1009\u1009\u1037\u103A', 'after a consonant: nya');
    assertReorders('\u1025\u102C', '\u1009\u102C', 'at the start: nya');
  });
});

describe('the steps of reorderUnicode (DESIGN.md §3.6)', () => {
  it('1. holds spaces after a syllable, and drops them when a mark joins it', () => {
    assertReorders('\u101E\u102F\u1036 \u1038', '\u101E\u102F\u1036\u1038', '\u101E\u102F\u1036 \u1038');
    assertReorders('\u1000  \u200B \u102C', '\u1000\u102C\u200B', 'the zero-width space stays, after the syllable');
    assertReorders('\u1000 \u1001', '\u1000 \u1001', 'a space before a base stays');
    assertReorders('\u1000\u102C ', '\u1000\u102C ', 'at the end');
  });

  it('2. reads a kinzi of nga, or of ra as repha, with the consonant it sits on', () => {
    assertReorders('\u1004\u103A\u1039\u1002\u102B', '\u1004\u103A\u1039\u1002\u102B', 'kinzi');
    assertReorders('\u101B\u103A\u1039\u1000\u102C', '\u101B\u103A\u1039\u1000\u102C', 'repha');
    assertReorders('\u1031\u1004\u103A\u1039\u1002', '\u1004\u103A\u1039\u1002\u1031', 'e typed before a kinzi');
    assertReorders('\u1004\u103A\u1039\u1040', '\u1004\u103A\u1039\u1040', 'no consonant after it: no kinzi');
  });

  it('3. opens a syllable at every base: letters and digits', () => {
    assertReorders('\u1047\u102D\u102F', '\u101B\u102D\u102F', 'seven with vowels is ra');
    assertReorders('\u1040\u1004\u103A', '\u1040\u1004\u103A', 'zero is its own syllable');
    assertReorders('\u103F\u102C\u102C', '\u103F\u102C', 'great sa; aa typed twice');
  });

  it('4. sends an e or medial ra to the open syllable, to the next base, or leaves it', () => {
    assertReorders('\u101C\u100A\u103A\u1038\u1031\u1000\u102C\u1004\u103A\u1038',
      '\u101C\u100A\u103A\u1038\u1000\u1031\u102C\u1004\u103A\u1038', 'လည်းေကာင်း: after a finished syllable');
    assertReorders('\u1019\u103C\u1004\u1037\u103A\u103C\u1019\u1010\u103A',
      '\u1019\u103C\u1004\u1037\u103A\u1019\u103C\u1010\u103A', 'မြင့်ြမတ်: medial ra after a final');
    assertReorders('\u1000\u1031', '\u1000\u1031', 'a syllable with no vowel takes it');
    assertReorders('\u1001\u103A\u103C', '\u1001\u103A\u103C', 'an asat alone still takes a medial ra (ခ်ြ)');
    assertReorders('\u1019\u103E\u103A\u1031', '\u1019\u103E\u103A\u1031', 'an asat after medial ha still takes e');
    assertReorders('\u1019\u102C\u103C\u1000', '\u1019\u102C\u1000\u103C', 'a syllable with a vowel does not');
    assertReorders('\u1031(\u101B', '\u1031(\u101B', 'Okell\'s ေ(ရ: no base after it');
    assertReorders('\u1010\u105F\u1031\u1004\u103A', '\u1010\u105F\u1031\u1004\u103A',
      'right after a Mon medial (တၟေင်): another language\'s syllable');
    assertReorders('\u1000\u102D \u1031\u102C', '\u1000\u102D \u1031\u102C',
      'never back across a space, even with a mark after it');
    assertReorders('\u1000\u102D\u1031\u102C', '\u1000\u1031\u102D\u102C', 'a mark of the syllable after it');
  });

  it('5. stacks a consonant after a virama, with any e or medial ra typed between', () => {
    assertReorders('\u1019\u1039\u1018\u102C', '\u1019\u1039\u1018\u102C', 'stacked');
    assertReorders('\u1000\u1039\u1031\u1001', '\u1000\u1039\u1001\u1031', 'e between virama and consonant');
    assertReorders('\u1000\u102C\u1039\u1000', '\u1000\u1039\u1000\u102C', 'a stack after marks');
    assertReorders('\u1000\u1039\u1040', '\u1000\u1039\u1040', 'no consonant after it');
    assertReorders('\u1041 \u1039\u1000', '\u1041 \u1039\u1000', 'a digit across a space');
    assertReorders('\u1039\u1000', '\u1039\u1000', 'no syllable before it');
  });

  it('6. joins a mark to the open syllable, and 7. leaves anything else where it is', () => {
    assertReorders('\u1000\u102F\u102D', '\u1000\u102D\u102F', 'marks in storage order');
    assertReorders('\u102C\u1000', '\u102C\u1000', 'a mark with no syllable');
    assertReorders('\u1000\u1033\u102C', '\u1000\u1033\u102C', 'a Mon vowel sign ends the syllable');
    assertReorders('\u1000\u102C.\u1001\u102D', '\u1000\u102C.\u1001\u102D', 'punctuation');
    assertReorders('\uAA60\u102C', '\uAA60\u102C', 'Extended-A');
  });
});

describe('what reorderUnicode returns', () => {
  it('returns the input itself when no syllable changes', () => {
    for (const text of ['', 'abc', '\u1000\u102C\u1004\u103A\u1038', '\u1031', ' \u1000 ', '\uD800\u1000\uDFFF']) {
      assert.equal(reorderUnicode(text).text, text);
    }
  });

  it('sees U+1025, and units outside the Myanmar block that NFC could move or compose', () => {
    const seen = (text) => reorderUnicode(text).seen;
    assert.equal(seen('\u1000\u102C'), 0);
    assert.equal(seen('\u1025\u102E'), SEEN.LETTER_U);
    assert.equal(seen('\u1009\u1037\u103A'), 0);
    assert.equal(seen('\u1004\u103A\u1039\u1000'), 0);
    assert.equal(seen('\u1000\u0301'), SEEN.NFC_UNSAFE);
    assert.equal(seen('e\u0301\u1025'), SEEN.NFC_UNSAFE | SEEN.LETTER_U);
    for (const safe of ['a', '\u00E9', '\u02FF', '\u200B', '\u2060', '\uFEFF', '\uA9E5', '\uAA7B', '\u104A']) {
      assert.equal(seen('\u1000' + safe), 0, hex(safe));
    }
    for (const unsafe of ['\u0300', '\u093C', '\u3099', '\u2000', '\uD800', '\u2070']) {
      assert.equal(seen('\u1000' + unsafe), SEEN.NFC_UNSAFE, hex(unsafe));
    }
  });

  it('keeps the pending invariant: a pending run is always followed by the base it waits for', () => {
    // Watches the reader's SyllableBuffer through its prototype: after addPending, the next call the reader makes on
    // the buffer is addPending or open, and nothing is pending when the call returns.
    const proto = SyllableBuffer.prototype;
    const names = ['open', 'setBase', 'pushMark', 'pushStack', 'hold', 'goOn', 'addPending'];
    const saved = names.map((name) => proto[name]);
    let last = null;
    let reader = null;
    names.forEach((name, n) => {
      proto[name] = function () {
        if (last === 'addPending') assert.ok(name === 'addPending' || name === 'open', 'addPending, then ' + name);
        last = name;
        if (name === 'addPending') reader = this;
        return saved[n].apply(this, arguments);
      };
    });
    try {
      const texts = fc.sample(fc.oneof(arb.unicodeText(), arb.burmeseText), { seed: fuzz.SEED, numRuns: 20000 });
      texts.push('\u1031\u103C\u1031\u1000', '\u1031\u200B\u1000', '\u1000\u102D\u1031\u1031\u1001', '\u1031(\u101B');
      for (const text of texts) {
        last = null;
        reorderUnicode(text);
        if (reader) assert.equal(reader.pendingLength, 0, 'pending at the end of ' + hex(text));
      }
      assert.ok(reader, 'the sample sent an e or medial ra to the next base');
    } finally {
      names.forEach((name, n) => { proto[name] = saved[n]; });
    }
  });

  it('leaves no scratch buffer larger than its first size after an 8.9M-unit call', () => {
    // In a process of its own, whose reader no earlier call has used: a call keeps a buffer of up to 65,536 units
    // (\u00A73.11), and `bun test` runs every test file in one process, where the 2.x tests call compat first.
    const out = execFileSync(process.execPath, [SCRATCH_PROBE], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(out), { afterLong: 'first sizes', afterLines: 'first sizes' });
  });
});
