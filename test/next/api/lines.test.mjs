// mapLines, the line cutter every stream runs on (docs/next/DESIGN.md §12.1, §12.3, §12.4).
//
// - Lines: cut at '\n', '\r\n' kept as the ending, a lone '\r' part of the line, the last line without '\n'.
// - Chunks: any cut of the text gives what the whole text gives, strings or UTF-8 bytes, a surrogate pair or a
//   UTF-8 character split between chunks included; bytes decode as TextDecoder decodes the whole input.
// - maxLineLength: an error as soon as a line passes it, never a cut.
// - Arguments and chunks of the wrong kind throw coded errors.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fc from 'fast-check';
import { fuzz } from '../helpers.mjs';
import { units, mapWholeText, chunksOf } from './helpers.mjs';
import { mapLines } from '../../../src/stream.js';
import { DEFAULT_MAX_LINE_LENGTH } from '../../../src/api/lines.js';
import { normalize } from '../../../src/index.js';

const marked = (line) => '<' + line + '>';
const encoder = new TextEncoder();
const decodeWhole = (bytes) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);

// Everything a mapper gives for these chunks, flush included.
function run(mapper, chunks) {
  let out = '';
  for (const chunk of chunks) out += mapper.transform(chunk);
  return out + mapper.flush();
}

const typeError = { name: 'TypeError', code: 'ERR_KNAYI_INVALID_ARG_TYPE' };
const rangeError = { name: 'RangeError', code: 'ERR_KNAYI_INVALID_ARG_VALUE' };
const tooLong = { name: 'RangeError', code: 'ERR_KNAYI_LINE_TOO_LONG' };

describe('mapLines: lines (DESIGN.md §12.1)', () => {
  it('cuts at \\n, gives each line without its ending, and the ending after the result', () => {
    const mapper = mapLines(marked);
    assert.equal(mapper.transform('ab\ncd'), '<ab>\n');
    assert.equal(mapper.transform('\ne'), '<cd>\n');
    assert.equal(mapper.transform('f'), '');
    assert.equal(mapper.flush(), '<ef>');
  });

  it('keeps \\r\\n as the ending, even split between chunks, and a lone \\r in its line', () => {
    assert.equal(run(mapLines(marked), ['a\r\nb\r\n']), '<a>\r\n<b>\r\n');
    assert.equal(run(mapLines(marked), ['a\r', '\nb']), '<a>\r\n<b>');
    assert.equal(run(mapLines(marked), ['a\rb\n', '\r']), '<a\rb>\n<\r>');
    assert.equal(run(mapLines(marked), ['\r\r\n']), '<\r>\r\n');
  });

  it('gives the text after the last \\n as the last line, and no empty line after a final \\n', () => {
    assert.equal(run(mapLines(marked), []), '');
    assert.equal(run(mapLines(marked), ['']), '');
    assert.equal(run(mapLines(marked), ['\n']), '<>\n');
    assert.equal(run(mapLines(marked), ['\n\n', 'a']), '<>\n<>\n<a>');
    assert.equal(run(mapLines(marked), ['a', 'b', '\n']), '<ab>\n');
  });

  it('calls fn once per line, in order, with the line alone and no `this`', () => {
    const seen = [];
    run(mapLines(function (line) {
      seen.push([line, this]);
      return line;
    }), ['x\ny', '\r\n', 'z']);
    assert.deepEqual(seen, [['x', undefined], ['y', undefined], ['z', undefined]]);
  });

  it('starts again after flush, as a new mapper', () => {
    const mapper = mapLines(marked);
    assert.equal(run(mapper, [encoder.encode('a\nb')]), '<a>\n<b>');
    assert.equal(run(mapper, ['c\n', 'd']), '<c>\n<d>');
  });
});

describe('mapLines: chunks and bytes (DESIGN.md §12.3)', () => {
  // One character of each UTF-8 length, line breaks, a Myanmar syllable and a pair of surrogates.
  const TEXT = 'a\u00E9\u1000\u103C\u1031\u102C\uD83D\uDE00\r\n\u1004\u103A\u1038\n\uD83D\uDE00b';

  it('gives what the whole text gives for every cut of the string into two and three chunks', () => {
    const whole = mapWholeText(TEXT, encodeURIComponent);
    for (let i = 0; i <= TEXT.length; i++) {
      for (let j = i; j <= TEXT.length; j++) {
        const chunks = [TEXT.slice(0, i), TEXT.slice(i, j), TEXT.slice(j)];
        // encodeURIComponent throws on a lone surrogate: a pair cut between chunks must reach it whole.
        assert.equal(run(mapLines(encodeURIComponent), chunks), whole, 'cut at ' + i + ', ' + j);
      }
    }
  });

  it('gives what the whole text gives for every cut of its UTF-8 bytes into two and three chunks', () => {
    const bytes = encoder.encode(TEXT);
    const whole = mapWholeText(TEXT, marked);
    for (let i = 0; i <= bytes.length; i++) {
      for (let j = i; j <= bytes.length; j++) {
        const chunks = [bytes.subarray(0, i), bytes.subarray(i, j), bytes.subarray(j)];
        assert.equal(run(mapLines(marked), chunks), whole, 'cut at byte ' + i + ', ' + j);
      }
    }
  });

  it('takes bytes as an ArrayBuffer or any view of one, a Node Buffer included', () => {
    const bytes = encoder.encode('\u1000\n\u1001');
    const whole = '<\u1000>\n<\u1001>';
    assert.equal(run(mapLines(marked), [bytes.buffer.slice(0, 2), bytes.buffer.slice(2)]), whole);
    assert.equal(run(mapLines(marked), [new DataView(bytes.buffer, 0, 1), Buffer.from(bytes.subarray(1))]), whole);
    // An ArrayBuffer of another realm, as a worker or vm context makes one.
    const elsewhere = vm.runInNewContext('new Uint8Array([0x61, 0x0A]).buffer');
    assert.equal(run(mapLines(marked), [elsewhere]), '<a>\n');
  });

  it('decodes bytes as TextDecoder decodes the whole input: a byte-order mark kept, bad bytes as U+FFFD', () => {
    const bytes = Uint8Array.from([0xEF, 0xBB, 0xBF, 0x61, 0xFF, 0x0A, 0xC3, 0x0A, 0xE1, 0x80]);
    const text = decodeWhole(bytes);
    assert.equal(text, '\uFEFFa\uFFFD\n\uFFFD\n\uFFFD');
    for (let i = 0; i <= bytes.length; i++) {
      assert.equal(run(mapLines(marked), [bytes.subarray(0, i), bytes.subarray(i)]), mapWholeText(text, marked));
    }
  });

  it('gives back the text of the lines each chunk ends, and nothing for a chunk that ends none', () => {
    const mapper = mapLines(marked);
    assert.deepEqual(['ab', 'c\nd', 'e', '\n\n'].map((chunk) => mapper.transform(chunk)),
      ['', '<abc>\n', '', '<de>\n<>\n']);
  });

  it('gives what the whole text gives on fuzz: any text, any cut, strings or bytes, with normalize', () => {
    const unit = fc.constantFrom('\n', '\r', '\r\n', 'a', ' ', '\u1000', '\u1031', '\u103C', '\u102C', '\u1039',
      '\u1040', '\u101D', '\uD83D', '\uDE00', '\uD83D\uDE00', '\u00E9', 'e\u0301');
    const text = fc.array(unit, { maxLength: 40 }).map((parts) => parts.join(''));
    const sizes = fc.array(fc.integer({ min: 1, max: 9 }), { minLength: 1, maxLength: 6 });
    fuzz.check(fc.property(text, sizes, fc.boolean(), (input, cuts, asBytes) => {
      for (const fn of [marked, normalize]) {
        if (asBytes) {
          const bytes = encoder.encode(input);
          assert.equal(run(mapLines(fn), chunksOf(bytes, cuts)), mapWholeText(decodeWhole(bytes), fn), units(input));
        } else {
          assert.equal(run(mapLines(fn), chunksOf(input, cuts)), mapWholeText(input, fn), units(input));
        }
      }
    }), 20000, [['a\uD83D\uDE00\r\nb', [2, 1], false], ['\u1000\u00E9\r\n', [1], true]], 400000);
  });
});

describe('mapLines: maxLineLength (DESIGN.md §12.4)', () => {
  it('takes a line of maxLineLength units, its ending not counted, and throws on one more', () => {
    assert.equal(run(mapLines(marked, { maxLineLength: 3 }), ['abc\r\nabc\n', 'abc']), '<abc>\r\n<abc>\n<abc>');
    assert.throws(() => run(mapLines(marked, { maxLineLength: 3 }), ['abcd\n']), tooLong);
    assert.throws(() => run(mapLines(marked, { maxLineLength: 3 }), ['ab', 'cd']), tooLong);
    // The last line has no ending, so a '\r' at its end is part of it.
    assert.throws(() => run(mapLines(marked, { maxLineLength: 3 }), ['abc\r']), tooLong);
    assert.throws(() => run(mapLines(marked, { maxLineLength: 3 }), ['a\nb\nabcd']), /line 3 passes/);
  });

  it('throws as soon as the line that waits passes the limit, so no more than it is ever held', () => {
    const mapper = mapLines(marked, { maxLineLength: 4 });
    assert.equal(mapper.transform('x\n'), '<x>\n');
    for (const unit of 'abcd') assert.equal(mapper.transform(unit), '');
    // A '\r' may still be the start of the ending; the unit after it shows it is not.
    assert.equal(mapper.transform('\r'), '');
    assert.throws(() => mapper.transform('e'), (error) => {
      assert.equal(error.code, 'ERR_KNAYI_LINE_TOO_LONG');
      assert.match(error.message, /^knayi\.mapLines: line 2 passes options\.maxLineLength, 4 UTF-16 units/);
      return true;
    });
  });

  it('holds 2^20 units by default, and none at all is Infinity', () => {
    assert.equal(DEFAULT_MAX_LINE_LENGTH, 1048576);
    const line = 'a'.repeat(DEFAULT_MAX_LINE_LENGTH);
    assert.equal(run(mapLines((x) => String(x.length)), [line, '\n']), DEFAULT_MAX_LINE_LENGTH + '\n');
    assert.throws(() => run(mapLines(marked), [line, 'a']), tooLong);
    assert.equal(run(mapLines((x) => String(x.length), { maxLineLength: Infinity }), [line, 'a']),
      String(DEFAULT_MAX_LINE_LENGTH + 1));
  });
});

describe('mapLines: arguments, chunks and results (DESIGN.md §11.1, §12.3)', () => {
  it('throws coded errors for a bad fn or option, and is map-safe', () => {
    assert.throws(() => mapLines('x'), typeError);
    assert.throws(() => mapLines(), typeError);
    assert.throws(() => mapLines(marked, []), typeError);
    assert.throws(() => mapLines(marked, { maxLineLength: '9' }), typeError);
    for (const bad of [0, -1, 1.5, NaN, -Infinity]) {
      assert.throws(() => mapLines(marked, { maxLineLength: bad }), rangeError, String(bad));
    }
    for (const none of [undefined, null, 3, { maxLineLength: null }]) {
      assert.equal(run(mapLines(marked, none), ['a\nb']), '<a>\n<b>');
    }
  });

  it('takes strings or bytes, not both, and nothing else', () => {
    const stringThenBytes = mapLines(marked);
    stringThenBytes.transform('a');
    assert.throws(() => stringThenBytes.transform(new Uint8Array([0x62])), typeError);
    const bytesThenString = mapLines(marked);
    bytesThenString.transform(new Uint8Array([0xE1]));
    assert.throws(() => bytesThenString.transform('b'), typeError);
    for (const bad of [1, null, undefined, {}, ['a'], new String('a')]) {
      assert.throws(() => mapLines(marked).transform(bad), typeError);
    }
  });

  it('requires fn to return a string, and names the line', () => {
    assert.throws(() => run(mapLines((line) => (line === 'b' ? 1 : line)), ['a\nb\n']), (error) => {
      assert.equal(error.code, 'ERR_KNAYI_INVALID_ARG_TYPE');
      assert.match(error.message, /^knayi\.mapLines: what fn returns for line 2 must be a string, not a number/);
      return true;
    });
  });
});
