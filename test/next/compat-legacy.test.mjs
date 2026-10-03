// compat's 2.x property-lookup quirks (src/compat/legacy.js; docs/next/DESIGN.md §5.2 C12, C20, D13), against
// main.js on every Object.prototype name, the matrix's font names and separators of every kind.

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { assertSameAsReference, compat, resetOptions } from './compat-helpers.mjs';
import {
  legacyBreakFont, legacyCollapseFont, NO_RULES, legacyTypeError, toJoinSeparator
} from '../../src/compat/legacy.js';

const UNICODE = '\u1019\u103C\u1014\u103A\u1019\u102C\u1037\u103A';
const ZAWGYI = '\u103B\u1019\u1014\u1039\u1019\u102C\u102C';

// The font names of the contract matrix (scripts/contract/matrix.js FONTS), every name Object.prototype has, and a
// few more values a caller might pass.
const FONT_NAMES = [undefined, null, '', 'unicode', 'uni', 'zawgyi', 'zaw', 'win', 'Unicode', 'ZAWGYI', 'foo', 0, 1,
  'length', 'prototype', ['unicode'], {}, Symbol('zawgyi'), true]
  .concat(Object.getOwnPropertyNames(Object.prototype));

afterEach(resetOptions);

describe('compat: the 2.x rule-table lookups (C12)', () => {
  it('syllBreak, spellingFix and truncate answer every font name as main.js does, error class included', () => {
    for (const name of FONT_NAMES) {
      for (const text of [UNICODE, ZAWGYI, ' ' + UNICODE + '\u200B ']) {
        const what = String(name) + ' on ' + JSON.stringify(text);
        assertSameAsReference((k) => k.syllBreak(text, name, '|'), 'syllBreak ' + what);
        assertSameAsReference((k) => k.spellingFix(text, name), 'spellingFix ' + what);
        assertSameAsReference((k) => k.truncate(text + text, { fontType: name, length: 9 }), 'truncate ' + what);
      }
    }
  });

  it('finds the fonts under their own keys, and what Object.prototype has under other names', () => {
    assert.equal(legacyBreakFont('unicode'), 'unicode');
    assert.equal(legacyBreakFont('zawgyi'), 'zawgyi');
    for (const name of ['win', 'Unicode', 1, 'foo', 'length']) assert.throws(() => legacyBreakFont(name), TypeError);
    for (const name of ['constructor', 'hasOwnProperty', 'isPrototypeOf', '__defineGetter__']) {
      assert.throws(() => legacyBreakFont(name), TypeError, name);
      assert.throws(() => legacyCollapseFont(name), TypeError, name);
    }
    for (const name of ['toString', 'valueOf', 'toLocaleString', '__proto__']) {
      assert.equal(legacyBreakFont(name), NO_RULES, name);
      assert.equal(legacyCollapseFont(name), NO_RULES, name);
    }
    for (const name of ['win', 'Unicode', 1, undefined]) assert.equal(legacyCollapseFont(name), 'unicode');
  });

  it('throws its TypeErrors with no code, so the matrix records them by class only (D13)', () => {
    const error = legacyTypeError();
    assert.ok(error instanceof TypeError);
    assert.equal(Object.prototype.hasOwnProperty.call(error, 'code'), false);
  });
});

describe('compat: the syllBreak separator (C20)', () => {
  const SEPARATORS = [undefined, null, '', 0, NaN, false, '\u200B', '|', ' ', '\u200B\u200B', 1, -0, true, [],
    ['a', 'b'],
    {}, { toString: () => '', valueOf: () => '+' }, { toString: () => '/', valueOf: () => '+' },
    { toString: () => ({}), valueOf: () => '+' }, new String('|'), Symbol('|')];

  it('converts each separator as main.js does, after the rule-table lookup', () => {
    for (const separator of SEPARATORS) {
      for (const font of ['unicode', 'zawgyi', undefined, 'toString', 'win']) {
        assertSameAsReference((k) => k.syllBreak(UNICODE + ' ' + ZAWGYI, font, separator),
          String(font) + ' ' + String(separator && separator.toString ? separator.toString() : separator));
      }
    }
  });

  it('toJoinSeparator converts as Array#join does: toString first, and a Symbol throws', () => {
    assert.equal(toJoinSeparator({ toString: () => 'a', valueOf: () => 'b' }), 'a');
    assert.equal(toJoinSeparator(12), '12');
    assert.throws(() => toJoinSeparator(Symbol('x')), TypeError);
  });

  it('joins with nothing for a separator whose string is empty, as 2.x does: the text with row U1 applied', () => {
    const empty = { toString: () => '' };
    assert.equal(compat.syllBreak('\u1000\u103A\u1037\u1001', 'unicode', empty), '\u1000\u1037\u103A\u1001');
  });
});
