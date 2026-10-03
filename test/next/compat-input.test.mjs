// compat's 2.x preamble (src/compat/input.js; docs/next/DESIGN.md §5.2 C5-C11), against the live
// library/contentGate.js (D19), and the input policy through the public functions against main.js.

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { library } from './helpers.mjs';
import { assertSameAsReference, compat, recordConsole, resetOptions } from './compat-helpers.mjs';
import {
  INPUT_POLICY, enter, unboxString, cleanText, resolveFont, chooseFontLegacy, ON_TIE_ASSUME_ZAWGYI
} from '../../src/compat/input.js';
import { setGlobalOptions } from '../../src/compat/globalOptions.js';

const gate = library('contentGate.js');

const UNICODE = '\u1019\u103C\u1014\u103A\u1019\u102C';
const ZAWGYI = '\u103B\u1019\u1014\u1039\u1019\u102C';

// Font names: the aliases, their case variants, values that convert to them, and the names Object.prototype has.
const OBJECT_PROTOTYPE_NAMES = Object.getOwnPropertyNames(Object.prototype);
const FONT_NAMES = [undefined, null, '', 'unicode', 'uni', 'zawgyi', 'zaw', 'win', 'Unicode', 'ZAWGYI', 'foo', 0, 1,
  NaN, true, false, ['zawgyi'], ['uni'], [], {}, { toString: () => 'zaw' }, new String('unicode'), Symbol('zawgyi'),
  Symbol.iterator].concat(OBJECT_PROTOTYPE_NAMES);

// Contents: missing ones, other non-strings, String objects, and text.
const CONTENTS = [undefined, null, '', 0, false, NaN, 123, -0, true, {}, [], [UNICODE], new String(UNICODE),
  new String(''), Symbol('x'), () => UNICODE, '  abc  ', UNICODE, ' \u200B' + ZAWGYI + '\u200C '];

afterEach(resetOptions);

describe('compat: the 2.x preamble (C5-C11)', () => {
  it('C5: unboxString unwraps a String object by its tag, as contentGate.toText', () => {
    for (const content of CONTENTS) assert.deepEqual(unboxString(content), gate.toText(content));
    const tagged = { [Symbol.toStringTag]: 'String', toString: () => 'tagged' };
    assert.equal(unboxString(tagged), gate.toText(tagged));
  });

  it('C9: cleanText trims and removes U+200B and U+200C, as contentGate.cleanText(x, true)', () => {
    const texts = ['', ' ', '\u200B', ' \u200B ', '\u200B \u1000', '\u1000\u200C\u200D\u2060\uFEFF', '\t\u1000\n',
      '\u00A0\u1000\u3000', '\u200C\u200B\u200C'];
    for (const text of texts) assert.equal(cleanText(text), gate.cleanText(text, true), JSON.stringify(text));
  });

  it('C10: resolveFont agrees with contentGate.resolveFont on every name, error class included', () => {
    for (const name of FONT_NAMES) {
      const expected = recordConsole(() => gate.resolveFont(name));
      const actual = recordConsole(() => resolveFont(name));
      assert.deepEqual([actual.value, actual.throws], [expected.value, expected.throws], String(name));
    }
    const throwing = { toString() { throw new RangeError('no name'); } };
    assert.throws(() => resolveFont(throwing), RangeError);
    assert.throws(() => gate.resolveFont(throwing), RangeError);
  });

  it('C11: chooseFontLegacy detects for a falsy name, and keeps an unknown name as given', () => {
    const detected = [];
    const detect = (text) => {
      detected.push(text);
      return 'detected';
    };
    for (const name of [undefined, null, '', 0, false, NaN]) {
      assert.equal(chooseFontLegacy(name, 'text', detect), 'detected');
    }
    assert.deepEqual(detected, Array(6).fill('text'));
    assert.equal(chooseFontLegacy('zaw', 'text', detect), 'zawgyi');
    assert.equal(chooseFontLegacy('Unicode', 'text', detect), 'Unicode');
    const object = {};
    assert.equal(chooseFontLegacy(object, 'text', detect), object);
    assert.equal(detected.length, 6);
    assert.equal(ON_TIE_ASSUME_ZAWGYI, 'zawgyi');
  });
});

describe('compat: enter() and INPUT_POLICY (C6, C7)', () => {
  it('has a policy for each public function that takes content', () => {
    assert.deepEqual(Object.keys(INPUT_POLICY).sort(),
      ['fontConvert', 'fontDetect', 'normalize', 'spellingFix', 'syllBreak', 'truncate']);
    assert.ok(Object.isFrozen(INPUT_POLICY));
  });

  it('C6: missing content warns, unless silent, and is \'\'; truncate takes \'\' as text', () => {
    for (const content of [undefined, null, '', 0, false, NaN, new String('')]) {
      const run = recordConsole(() => enter('normalize', content));
      assert.deepEqual(run.value, { kind: 'missing', value: '' });
      assert.deepEqual(run.console, ['warn: Content must be specified on knayi.normalize.']);
    }
    assert.deepEqual(recordConsole(() => enter('truncate', '')), { value: { kind: 'text', value: '' }, console: [] });
    setGlobalOptions({ silent_mode: 1 });
    assert.deepEqual(recordConsole(() => enter('syllBreak', null)).console, []);
  });

  it('C7: other values come back as they are, and truncate reads them as String(value)', () => {
    const object = {};
    assert.deepEqual(enter('fontConvert', object), { kind: 'other', value: object });
    assert.deepEqual(enter('fontConvert', new String(UNICODE)), { kind: 'text', value: UNICODE });
    assert.deepEqual(enter('truncate', 123), { kind: 'text', value: '123' });
    assert.deepEqual(enter('truncate', [1, 2]), { kind: 'text', value: '1,2' });
    assert.throws(() => enter('truncate', Object.create(null)), TypeError);
  });

  it('C6-C8: every public function answers each content as main.js does, console included', () => {
    const calls = [
      ['fontDetect', (k, c) => k.fontDetect(c)],
      ['fontDetect with a fallback', (k, c) => k.fontDetect(c, 'unicode')],
      ['fontConvert', (k, c) => k.fontConvert(c, 'unicode')],
      ['fontConvert from Win', (k, c) => k.fontConvert(c, 'unicode', 'win')],
      ['syllBreak', (k, c) => k.syllBreak(c)],
      ['spellingFix', (k, c) => k.spellingFix(c)],
      ['truncate', (k, c) => k.truncate(c)],
      ['normalize', (k, c) => k.normalize(c)]
    ];
    const contents = CONTENTS.concat(['\uAA60\uAA61', '\uA9E0 abc', 'abc \u1000']);
    for (const [name, call] of calls) {
      for (const content of contents) assertSameAsReference((k) => call(k, content), name + ' ' + String(content));
    }
  });

  it('C8: the Myanmar gate is U+1000-U+109F only, and normalize has none', () => {
    const extendedA = '\uAA60\uAA61';
    assert.equal(compat.fontDetect(extendedA), 'en');
    assert.equal(compat.syllBreak(extendedA), extendedA);
    assert.equal(compat.normalize('e\u0301'), '\u00E9');
    assert.equal(compat.truncate(extendedA + extendedA, { length: 4, omission: '.' }), extendedA + '\uAA60.');
  });
});
