// compat's fontConvert and fontConvert.debugging (src/compat/fontConvert.js; docs/next/DESIGN.md §5.2 C15-C19,
// §5.4), against main.js.

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { assertSameAsReference, compat, pendingPort, reference, resetOptions } from './compat-helpers.mjs';

const UNICODE = '\u1019\u103C\u1014\u103A\u1019\u102C';
const ZAWGYI = '\u103B\u1019\u1014\u1039\u1019\u102C';
const WIN = 'jrefrm';
const TEXTS = [UNICODE, ZAWGYI, WIN, ' ' + ZAWGYI + '\u200B ', '  ' + WIN + ' ', 'abc',
  '\u1017\u102F\u1012\u1039\u1013',
  '\u1000\u1040 \u1040\u1041 \u1031\u101B\u102C', ZAWGYI + '\n' + UNICODE];
const FONTS = [undefined, null, '', 'unicode', 'uni', 'zawgyi', 'zaw', 'win', 'Unicode', 'foo', 'constructor', 0];

afterEach(resetOptions);

describe('compat: fontConvert (C15-C19)', () => {
  // The font names of 2.11: any letter case (579be3d), and an unknown source that warns, and "doesn't" (24f81c6).
  it('C15: answers every target and source as main.js does, console included', () => {
    for (const text of TEXTS) {
      for (const to of FONTS) {
        for (const from of FONTS) {
          assertSameAsReference((k) => k.fontConvert(text, to, from), JSON.stringify([text, to, from]));
        }
      }
    }
  });

  // And debugging's report on every exit with text (b6cbfca).
  it('C17-C19: debugging gives main.js\'s log, and its report on every early exit',
    pendingPort('b6cbfca', () => {
      for (const text of TEXTS.concat([null, '', 0, {}, new String(ZAWGYI)])) {
        for (const to of FONTS) {
          for (const from of FONTS) {
            assertSameAsReference((k) => k.fontConvert.debugging(text, to, from), JSON.stringify([text, to, from]));
          }
        }
      }
    }));

  it('C17: the font log names its stages in 2.x order, with \'glyphs\' only when debugging', () => {
    // Zero before i is wa, and i typed twice and then ii is a typo for ii.
    const text = ZAWGYI + ' \u1040\u102D\u102D\u102E';
    const log = compat.fontConvert.debugging(text, 'unicode', 'zawgyi');
    assert.deepEqual(Object.keys(log), ['to', 'from', 'matched_patterns', 'steps']);
    assert.deepEqual(log, reference.fontConvert.debugging(text, 'unicode', 'zawgyi'));
    assert.deepEqual(log.matched_patterns, ['glyphs', 'syllables', 'zero as wa', 'typos']);
    assert.equal(log.steps.length, log.matched_patterns.length + 1);
    assert.equal(log.steps[log.steps.length - 1], compat.fontConvert(text, 'unicode', 'zawgyi'));
  });

  it('C18: the Unicode to Zawgyi log gives the 2.x regex sources, from the collapsed text', () => {
    const text = UNICODE + '\u102C\u102C';
    const log = compat.fontConvert.debugging(text, 'zawgyi', 'unicode');
    assert.deepEqual(log, reference.fontConvert.debugging(text, 'zawgyi', 'unicode'));
    assert.equal(log.steps[0], UNICODE);
    assert.equal(log.steps[log.steps.length - 1], compat.fontConvert(text, 'zawgyi', 'unicode'));
  });

  // 2.x read the debug flag from the receiver until d20027a; 2.11's fontConvert returns text whatever `this` is.
  it('C16: reads no debug flag from its receiver', pendingPort('d20027a', () => {
    const receiver = { debug: 1 };
    assert.deepEqual(compat.fontConvert.call(receiver, ZAWGYI, 'unicode'),
      reference.fontConvert.call(receiver, ZAWGYI, 'unicode'));
    assert.equal(compat.fontConvert.call(receiver, ZAWGYI, 'unicode'), UNICODE);
    assert.equal(compat.fontConvert.call({ debug: 0 }, ZAWGYI, 'unicode'), UNICODE);
  }));
});

describe('compat: the debug flag of a detached call (§5.4)', () => {
  it('never reads a global debug: compat is a strict module, like the 2.x ES module build', () => {
    const detached = compat.fontConvert;
    globalThis.debug = true;
    try {
      assert.equal(detached(ZAWGYI, 'unicode'), UNICODE);
      assert.equal(detached(UNICODE, 'zawgyi', 'unicode'), ZAWGYI);
    } finally {
      delete globalThis.debug;
    }
  });
});
