// compat's font names in syllBreak, spellingFix and truncate, against main.js on every Object.prototype name, the
// matrix's font names and values of every kind (docs/next/DESIGN.md §5.2 C11, C12); the syllBreak separator (C20);
// and the 2.x shape of the Win tables, against library/win.js of the 2.x reference (scripts/reference/). 2.11 gives
// font names one policy (24f81c6), in any letter case (579be3d), and truncate a prefix (41984eb): the comparison
// of truncate with main.js waits for the port of the last.

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { assertSameAsReference, compat, recordConsole, resetOptions } from './compat-helpers.mjs';
import { toJoinSeparator, legacyWinTables } from '../../src/compat/legacy.js';
import { WIN_GLYPHS, LOOK_ALIKE_SEQUENCES, C1_ALIASES } from '../../src/fonts/win.js';
import { library } from './helpers.mjs';

const UNICODE = '\u1019\u103C\u1014\u103A\u1019\u102C\u1037\u103A';
const ZAWGYI = '\u103B\u1019\u1014\u1039\u1019\u102C\u102C';

// The font names of the contract matrix (scripts/contract/matrix.js FONTS), every name Object.prototype has, and a
// few more values a caller might pass.
const FONT_NAMES = [undefined, null, '', 'unicode', 'uni', 'zawgyi', 'zaw', 'win', 'Unicode', 'ZAWGYI', 'Win', 'foo',
  0, 1, 'length', 'prototype', ['unicode'], {}, Symbol('zawgyi'), true, new String('Zaw')]
  .concat(Object.getOwnPropertyNames(Object.prototype));

afterEach(resetOptions);

describe('compat: font names in syllBreak, spellingFix and truncate (C11, C12)', () => {
  it('syllBreak and spellingFix answer every font name as main.js does, the error\'s code and message included', () => {
    for (const name of FONT_NAMES) {
      for (const text of [UNICODE, ZAWGYI, ' ' + UNICODE + '\u200B ']) {
        const what = String(name) + ' on ' + JSON.stringify(text);
        assertSameAsReference((k) => k.syllBreak(text, name, '|'), 'syllBreak ' + what);
        assertSameAsReference((k) => k.spellingFix(text, name), 'spellingFix ' + what);
      }
    }
  });

  it('truncate answers every font name as main.js does', () => {
    for (const name of FONT_NAMES) {
      for (const text of [UNICODE, ZAWGYI, ' ' + UNICODE + '\u200B ']) {
        const what = String(name) + ' on ' + JSON.stringify(text);
        assertSameAsReference((k) => k.truncate(text + text, { fontType: name, length: 9 }), 'truncate ' + what);
      }
    }
  });

  it('syllBreak and truncate throw ERR_KNAYI_INVALID_FONT for win and unknown names, Object.prototype\'s too', () => {
    for (const name of ['win', 'WIN', 'foo', 'constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      for (const [api, call] of [['syllBreak', () => compat.syllBreak(UNICODE, name)],
        ['truncate', () => compat.truncate(UNICODE, { fontType: name })]]) {
        const run = recordConsole(call);
        assert.equal(run.throws, 'TypeError', api + ' ' + name);
        assert.equal(run.error.code, 'ERR_KNAYI_INVALID_FONT');
        assert.equal(run.error.message, 'knayi.' + api + ' takes the font \'unicode\' or \'zawgyi\', not ' +
          JSON.stringify(name) + '.');
      }
    }
  });

  it('spellingFix collapses the Zawgyi marks for a name of Zawgyi, and the Unicode marks for any other', () => {
    assert.equal(compat.spellingFix('\u1000\u1033\u1033', 'Zaw'), '\u1000\u1033');
    for (const name of ['win', 'foo', 'constructor', 'toString', '__proto__']) {
      assert.equal(compat.spellingFix('\u1000\u102C\u102C', name), '\u1000\u102C', name);
    }
  });
});

describe('compat: the syllBreak separator (C20)', () => {
  const SEPARATORS = [undefined, null, '', 0, NaN, false, '\u200B', '|', ' ', '\u200B\u200B', 1, -0, true, [],
    ['a', 'b'],
    {}, { toString: () => '', valueOf: () => '+' }, { toString: () => '/', valueOf: () => '+' },
    { toString: () => ({}), valueOf: () => '+' }, new String('|'), Symbol('|')];

  it('converts each separator as main.js does, after reading the font', () => {
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

describe('compat: the 2.x shape of the Win tables (library/win.js tables)', () => {
  it('legacyWinTables() has the 2.x shape of win.tables: keys in 2.x order, shared alias rows, role strings', () => {
    const tables = legacyWinTables();
    const tables2x = library('win.js').tables;
    assert.deepEqual(Object.keys(tables), ['WIN', 'SEQUENCES', 'ROLES']);
    assert.deepEqual(Object.keys(tables.WIN), Object.keys(tables2x.WIN));
    assert.deepEqual(tables.WIN, tables2x.WIN);
    for (const [control, key] of Object.entries(C1_ALIASES)) assert.equal(tables.WIN[control], tables.WIN[key]);
    assert.deepEqual(tables.ROLES, tables2x.ROLES);
    assert.deepEqual(Object.keys(tables.ROLES), Object.keys(tables2x.ROLES));
    assert.deepEqual(tables.SEQUENCES.map(([re, to]) => [re.source, re.flags, to]),
      tables2x.SEQUENCES.map(([re, to]) => [re.source, re.flags, to]));
  });

  it('legacyWinTables() returns new objects each call, none of them the core\'s own data', () => {
    const first = legacyWinTables();
    const second = legacyWinTables();
    assert.notEqual(first, second);
    assert.notEqual(first.WIN, second.WIN);
    assert.ok(!Object.isFrozen(first.WIN), 'as open to change as 2.x\'s');
    first.SEQUENCES.forEach(([re], i) => assert.notEqual(re, LOOK_ALIKE_SEQUENCES[i].re));
    first.WIN.u[1] = 'changed';
    assert.equal(WIN_GLYPHS.u[1], '\u1000');
    assert.equal(legacyWinTables().WIN.u[1], '\u1000');
  });
});
