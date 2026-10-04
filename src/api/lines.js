// @ts-check
// mapLines, and the LineMapper every stream of src/stream.js runs on (DESIGN.md §12). Layer L4.
//
// A LineMapper takes the chunks of a text one at a time, strings or UTF-8 bytes, and gives back the text of the
// lines each chunk completes, every line through a function, with its line ending as it came (§12.1):
// - a line ends at '\n'. A '\r' right before it belongs to the ending, so the function sees a '\r\n' line without
//   its '\r'; a '\r' anywhere else is part of the line;
// - the text after the last '\n' is the last line, given by flush(); a text that ends with '\n' has no empty line
//   after it.
// Nothing of a line goes out before its end, so a function never sees part of a line: not a UTF-8 character whose
// bytes are split between chunks, which waits in the decoder, nor a surrogate pair split between string chunks,
// whose high surrogate waits with the rest of its line (§12.3). maxLineLength bounds what waits: a line that passes
// it is an error, never a cut (§12.4).

import { deepFreeze } from '../freeze.js';
import { ERR, libraryError } from '../core/errors.js';
import { readOptions, readLimit, requireFunction, where, wrongType } from './args.js';

/** @typedef {import('../stream.js').Chunk} Chunk */
/** @typedef {import('../stream.js').LineOptions} LineOptions */
/** @typedef {(line: string) => string} LineFunction */

const CARRIAGE_RETURN = 0x0D;

// The longest line a stream holds by default, in UTF-16 units: 2^20, 19 times the longest line of the cached
// corpora (54,804 units, in mC4), and 2 MB of memory (§12.4).
export const DEFAULT_MAX_LINE_LENGTH = 1048576;

// Bytes are UTF-8 (§12.3). ignoreBOM keeps a byte-order mark as U+FEFF: the stream drops no character, as normalize
// keeps U+FEFF. TextDecoder's default, fatal: false, writes U+FFFD for bytes that are not UTF-8, as it and Node's
// Buffer#toString do for a whole input.
const DECODER_OPTIONS = /* @__PURE__ */ deepFreeze({ ignoreBOM: true });
// decode(chunk, { stream: true }) keeps the bytes of a character the chunk cuts short, for the next chunk.
const MORE_TO_COME = /* @__PURE__ */ deepFreeze({ stream: true });

const CHUNK_KINDS = 'a string or bytes (an ArrayBuffer or a view of one, such as a Uint8Array or a Buffer)';

// The options of mapLines, lineTransform and createNormalizer (api/args.js readOptions refuses any other key).
/** @type {readonly string[]} */
export const LINE_OPTIONS = /* @__PURE__ */ deepFreeze(['maxLineLength']);

// Whether a chunk is bytes: a view of an ArrayBuffer, or one, from this realm or another (a worker's, a vm's).
/**
 * @param {unknown} chunk
 * @returns {chunk is ArrayBuffer | ArrayBufferView}
 */
function isBytes(chunk) {
  return ArrayBuffer.isView(chunk) || Object.prototype.toString.call(chunk) === '[object ArrayBuffer]';
}

// mapLines(fn, options?): a LineMapper that gives each line to fn. fn takes the line, without its ending, and
// returns a string; options.maxLineLength is the most UTF-16 units a line may hold, its ending not counted
// (DEFAULT_MAX_LINE_LENGTH; Infinity for no limit).
/**
 * @param {LineFunction} fn
 * @param {LineOptions | number | null} [options]
 * @returns {LineMapper}
 */
export function mapLines(fn, options) {
  return createLineMapper('mapLines', requireFunction('mapLines', 'fn', fn), options, LINE_OPTIONS);
}

// A LineMapper for the public function `api`, which names it in messages, with that function's options checked:
// `keys` are its options, maxLineLength among them.
/**
 * @param {string} api
 * @param {LineFunction} fn
 * @param {LineOptions | number | null | undefined} options
 * @param {readonly string[]} keys
 * @returns {LineMapper}
 */
export function createLineMapper(api, fn, options, keys) {
  const settings = readOptions(api, options, keys);
  return new LineMapper(api, fn, readLimit(api, settings, 'maxLineLength', DEFAULT_MAX_LINE_LENGTH));
}

export class LineMapper {
  /**
   * @param {string} api
   * @param {LineFunction} fn
   * @param {number} maxLineLength
   */
  constructor(api, fn, maxLineLength) {
    this.api = api;
    this.fn = fn;
    this.maxLineLength = maxLineLength;
    /** @type {string[]} the pieces of the line that has not ended yet */
    this.held = [];
    this.heldLength = 0;
    this.linesGiven = 0;
    /** @type {'' | 'text' | 'bytes'} what the first chunk was; a stream takes one kind */
    this.kind = '';
    /** @type {TextDecoder | null} */
    this.decoder = null;
  }

  // The text of the lines this chunk completes, each through fn and followed by its ending; '' when it completes
  // none. The rest of the chunk waits for the next one.
  /**
   * @param {Chunk} chunk
   * @returns {string}
   */
  transform(chunk) {
    return this.mapEndedLines(this.textOf(chunk));
  }

  // The last line, through fn, when the text did not end with '\n', else ''. Then the mapper starts again, as new.
  /** @returns {string} */
  flush() {
    // The bytes of a character the input cut short decode as U+FFFD, as TextDecoder decodes a whole input.
    const ended = this.decoder === null ? '' : this.mapEndedLines(this.decoder.decode());
    const last = this.takeHeld('');
    // The last line has no ending, so a '\r' at its end is part of it.
    this.requireLength(last.length);
    const mapped = last.length === 0 ? '' : this.mapLine(last);
    this.reset();
    return ended + mapped;
  }

  // The chunk as text: a string as it is, bytes decoded as UTF-8 (§12.3).
  /**
   * @param {Chunk} chunk
   * @returns {string}
   */
  textOf(chunk) {
    if (typeof chunk === 'string') {
      this.requireKind('text');
      return chunk;
    }
    if (isBytes(chunk)) {
      this.requireKind('bytes');
      return this.byteDecoder().decode(chunk, MORE_TO_COME);
    }
    throw libraryError(ERR.INVALID_ARG_TYPE, wrongType(this.api, 'a chunk', CHUNK_KINDS, chunk), TypeError);
  }

  // The first chunk sets the kind of the stream; a chunk of the other kind is an error, since a string between
  // byte chunks could not go where a character the bytes cut short is waiting.
  /** @param {'text' | 'bytes'} kind */
  requireKind(kind) {
    if (this.kind === kind) return;
    if (this.kind === '') {
      this.kind = kind;
      return;
    }
    const what = kind === 'text' ? 'a string follows bytes' : 'bytes follow strings';
    throw libraryError(ERR.INVALID_ARG_TYPE, where(this.api, what + ': a stream takes ' + CHUNK_KINDS +
      ', one or the other'), TypeError);
  }

  /** @returns {TextDecoder} */
  byteDecoder() {
    if (this.decoder === null) {
      if (typeof TextDecoder !== 'function') {
        throw libraryError(ERR.UNSUPPORTED_RUNTIME,
          where(this.api, 'this runtime has no TextDecoder to read bytes: give the stream strings'));
      }
      this.decoder = new TextDecoder('utf-8', DECODER_OPTIONS);
    }
    return this.decoder;
  }

  // Cuts the text at each '\n': the line the first '\n' ends starts with what waits from the chunks before. Each
  // unit is read once, by indexOf; the text after the last '\n' waits.
  /**
   * @param {string} text
   * @returns {string}
   */
  mapEndedLines(text) {
    let out = '';
    let start = 0;
    for (let end = text.indexOf('\n'); end !== -1; end = text.indexOf('\n', start)) {
      out += this.mapEndedLine(this.takeHeld(text.slice(start, end)));
      start = end + 1;
    }
    this.hold(text.slice(start));
    return out;
  }

  // One line with its ending, '\r\n' when the line ends with '\r', else '\n'.
  /**
   * @param {string} lineAndReturn
   * @returns {string}
   */
  mapEndedLine(lineAndReturn) {
    const crlf = lineAndReturn.charCodeAt(lineAndReturn.length - 1) === CARRIAGE_RETURN;
    const line = crlf ? lineAndReturn.slice(0, -1) : lineAndReturn;
    this.requireLength(line.length);
    return this.mapLine(line) + (crlf ? '\r\n' : '\n');
  }

  // What waits, ended by `last`, as one string; nothing waits after.
  /**
   * @param {string} last
   * @returns {string}
   */
  takeHeld(last) {
    if (this.held.length === 0) return last;
    this.held.push(last);
    const line = this.held.join('');
    this.held = [];
    this.heldLength = 0;
    return line;
  }

  // Keeps the start of a line that has not ended, as a piece, so that a long line arriving in small chunks is
  // joined once, at its end. It must stay within maxLineLength, but for a '\r' at its end, which may yet be part
  // of a '\r\n' ending.
  /** @param {string} piece */
  hold(piece) {
    if (piece.length === 0) return;
    this.held.push(piece);
    this.heldLength += piece.length;
    const mayEndWithReturn = piece.charCodeAt(piece.length - 1) === CARRIAGE_RETURN;
    this.requireLength(mayEndWithReturn ? this.heldLength - 1 : this.heldLength);
  }

  /** @param {number} length the units of the line so far, its ending not counted */
  requireLength(length) {
    if (length <= this.maxLineLength) return;
    throw libraryError(ERR.LINE_TOO_LONG, where(this.api, 'line ' + (this.linesGiven + 1) + ' passes ' +
      'options.maxLineLength, ' + this.maxLineLength + ' UTF-16 units, before it ends: pass a larger limit, or ' +
      'Infinity'), RangeError);
  }

  /**
   * @param {string} line
   * @returns {string}
   */
  mapLine(line) {
    const fn = this.fn; // called as Array#map calls its function, with no `this`
    const mapped = fn(line);
    this.linesGiven++;
    if (typeof mapped === 'string') return mapped;
    throw libraryError(ERR.INVALID_ARG_TYPE,
      wrongType(this.api, 'what fn returns for line ' + this.linesGiven, 'a string', mapped), TypeError);
  }

  reset() {
    this.held = [];
    this.heldLength = 0;
    this.linesGiven = 0;
    this.kind = '';
    this.decoder = null;
  }
}
