// core/input.js (docs/next/DESIGN.md §2.3, D1, §7.3): the font registry, the text predicates and requireText.
//
// FONT_ALIASES is checked against contentGate.js's own table, and the predicates against contentGate.js's
// hasMyanmar and cleanText, in the frozen copy of scripts/oracle/ (D19): on every single UTF-16 unit, on
// boundary strings, and on fuzzed strings.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  FONTS, FONT_ALIASES, hasMyanmarBlockChar, hasMyanmarScriptChar, stripZeroWidthBreaks, requireText
} from '../../src/core/input.js';
import { isMyanmarBlock, isMyanmarScript } from '../../src/script/codes.js';
import { internals, arb, fuzz, ranges } from './helpers.mjs';

const contentGate = internals('contentGate.js', ['FONT_ALIASES', 'hasMyanmar', 'resolveFont', 'cleanText']);
const char = (code) => String.fromCharCode(code);

// Strings over every unit the predicates decide on, both edges of each range, and units next to them.
const EDGES = [0x0, 0x20, 0x61, 0xFFF, 0x1000, 0x1001, 0x103A, 0x109F, 0x10A0, 0x200A, 0x200B, 0x200C, 0x200D,
  0x2060, 0xA9DF, 0xA9E0, 0xA9FF, 0xAA00, 0xAA5F, 0xAA60, 0xAA7F, 0xAA80, 0xD800, 0xDC00, 0xFEFF, 0xFFFF].map(char);
const edgeText = fc.array(fc.constantFrom(...EDGES), { maxLength: 12 }).map((units) => units.join(''));
const anyText = fc.oneof(edgeText, arb.codeUnits, arb.unicodeText(24), arb.zawgyiText(24), arb.winText(24));

describe('core/input.js FONTS', () => {
  it('lists unicode, zawgyi and win, each under its own name', () => {
    assert.deepEqual(Object.keys(FONTS), ['unicode', 'zawgyi', 'win']);
    for (const name of Object.keys(FONTS)) assert.equal(FONTS[name].name, name);
  });

  it('says what a converter needs to know of each font', () => {
    const capabilities = (font) => [font.visualOrder, font.sourceOnly, font.ascii];
    assert.deepEqual(capabilities(FONTS.unicode), [false, false, false]);
    assert.deepEqual(capabilities(FONTS.zawgyi), [true, false, false]); // drawing order (converter.js:9)
    assert.deepEqual(capabilities(FONTS.win), [true, true, true]); // to Unicode only, and ASCII (converter.js:23, :47)
  });

  it('is frozen all the way down', () => {
    assert.ok(Object.isFrozen(FONTS));
    for (const font of Object.values(FONTS)) {
      assert.ok(Object.isFrozen(font));
      assert.ok(Object.isFrozen(font.aliases));
    }
  });
});

describe('core/input.js FONT_ALIASES', () => {
  it('equals contentGate.js\'s own keys and values, in its order', () => {
    assert.deepEqual(Object.keys(FONT_ALIASES), Object.keys(contentGate.FONT_ALIASES));
    for (const key of Object.keys(contentGate.FONT_ALIASES)) {
      assert.equal(FONT_ALIASES[key], contentGate.FONT_ALIASES[key], key);
    }
  });

  it('is built from the aliases of FONTS, and names a font of FONTS for each', () => {
    const fromFonts = [];
    for (const font of Object.values(FONTS)) for (const alias of font.aliases) fromFonts.push([alias, font.name]);
    assert.deepEqual(Object.keys(FONT_ALIASES).map((alias) => [alias, FONT_ALIASES[alias]]), fromFonts);
  });

  it('has a null prototype and is frozen, so Object.prototype names find no font', () => {
    assert.equal(Object.getPrototypeOf(FONT_ALIASES), null);
    assert.ok(Object.isFrozen(FONT_ALIASES));
    for (const name of Object.getOwnPropertyNames(Object.prototype).concat(['__proto__'])) {
      assert.equal(FONT_ALIASES[name], undefined, name);
    }
  });

  it('finds the font 2.x resolveFont finds for every string name, with case kept', () => {
    const names = Object.keys(FONT_ALIASES).concat(['', 'Unicode', 'ZAWGYI', 'Win', 'uni ', 'foo', 'detect', 'en',
      'constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__', '__defineGetter__']);
    for (const name of names) assert.equal(FONT_ALIASES[name] || null, contentGate.resolveFont(name), name);
  });
});

describe('core/input.js text predicates', () => {
  it('hasMyanmarBlockChar agrees with 2.x hasMyanmar on every unit, and with isMyanmarBlock', () => {
    const differ = [];
    for (let code = 0; code < 0x10000; code++) {
      const text = 'a' + char(code) + 'b';
      const ours = hasMyanmarBlockChar(text);
      if (ours !== contentGate.hasMyanmar(text) || ours !== isMyanmarBlock(code)) differ.push(code);
    }
    assert.equal(ranges(differ), '');
  });

  it('hasMyanmarScriptChar agrees with isMyanmarScript on every unit: the block, Extended-A and Extended-B', () => {
    const differ = [];
    for (let code = 0; code < 0x10000; code++) {
      if (hasMyanmarScriptChar(char(code) + ' ') !== isMyanmarScript(code)) differ.push(code);
    }
    assert.equal(ranges(differ), '');
    assert.equal(hasMyanmarScriptChar(''), false);
    assert.equal(hasMyanmarScriptChar('\uAA7Fx'), true);
  });

  it('stripZeroWidthBreaks removes U+200B and U+200C only, and returns text without them unchanged', () => {
    assert.equal(stripZeroWidthBreaks('\u200Ba\u200C\u200Db\u2060\uFEFF\u200B'), 'a\u200Db\u2060\uFEFF');
    const plain = '\u1000\u102C abc';
    assert.equal(stripZeroWidthBreaks(plain), plain);
    assert.equal(stripZeroWidthBreaks(''), '');
  });

  it('agree with 2.x hasMyanmar and cleanText on fuzzed strings', () => {
    fuzz.check(fc.property(anyText, (text) => {
      assert.equal(hasMyanmarBlockChar(text), contentGate.hasMyanmar(text));
      assert.equal(hasMyanmarScriptChar(text), Array.from(text).some((ch) => isMyanmarScript(ch.charCodeAt(0))));
      assert.equal(stripZeroWidthBreaks(text), contentGate.cleanText(text, false));
      assert.equal(stripZeroWidthBreaks(text.trim()), contentGate.cleanText(text, true));
    }), 20000, [['\u200B \u1000\u103C'], ['\uD800\u1000'], ['']], 400000);
  });
});

describe('core/input.js requireText', () => {
  it('returns a string as it is, the empty string included', () => {
    for (const text of ['', ' ', '\u1000', 'abc', '\uD800']) assert.equal(requireText('normalize', text), text);
  });

  it('throws a TypeError with the code ERR_KNAYI_INVALID_ARG_TYPE for anything else', () => {
    const values = [undefined, null, 0, 1, NaN, true, Symbol('x'), {}, [], ['a'], new String('a'), () => 'a',
      Object.create(null)];
    for (const value of values) {
      assert.throws(() => requireText('toUnicode', value), (error) => {
        assert.ok(error instanceof TypeError);
        assert.equal(error.code, 'ERR_KNAYI_INVALID_ARG_TYPE');
        assert.equal(error.message, 'knayi.toUnicode: text must be a string');
        assert.ok(Object.keys(error).includes('code'));
        return true;
      });
    }
  });

  it('never converts the value: it calls none of its methods', () => {
    const touched = [];
    const value = { toString() { touched.push('toString'); return 'a'; }, valueOf() { touched.push('valueOf'); return 1; } };
    assert.throws(() => requireText('normalize', value), TypeError);
    assert.deepEqual(touched, []);
  });
});
