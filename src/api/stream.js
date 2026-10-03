// @ts-check
// lineTransform, createNormalizer and createConverter: the streams of 3.0 (DESIGN.md §12). Layer L4.
//
// Each is a WHATWG TransformStream: strings or UTF-8 bytes go in, strings come out, a line at a time. Browsers, Deno,
// Bun and Node all have TransformStream, and Node's stream.pipeline takes one between Node streams, so one object
// serves both kinds of stream (§12.1). Inside, a LineMapper (api/lines.js) cuts the text at '\n' and gives each
// line to the function.
//
// A stream gives what its function gives for the whole text only when the function keeps to the line boundary,
// f(a + '\n' + b) === f(a) + '\n' + f(b) (§12.2). normalize and toUnicode do; toZawgyi does not (DESIGN.md §10
// Q10), so createConverter does not convert to Zawgyi.

import { deepFreeze } from '../freeze.js';
import { ERR, libraryError } from '../core/errors.js';
import { normalize } from './normalize.js';
import { readUnicodeReading, convertToUnicode } from './convert.js';
import { createLineMapper } from './lines.js';
import { readOptions, readChoice, requireFunction, where } from './args.js';

/** @typedef {import('../stream.js').Chunk} Chunk */
/** @typedef {import('../stream.js').LineOptions} LineOptions */
/** @typedef {import('../stream.js').ConverterOptions} ConverterOptions */
/** @typedef {import('./lines.js').LineMapper} LineMapper */

// What createConverter converts to.
/** @type {readonly 'unicode'[]} */
const TARGETS = /* @__PURE__ */ deepFreeze(['unicode']);

// lineTransform(fn, options?): a TransformStream that gives each line to fn, as mapLines does (api/lines.js), and
// writes what fn returns, then the line's ending. options.maxLineLength as for mapLines.
/**
 * @param {(line: string) => string} fn
 * @param {LineOptions | number | null} [options]
 * @returns {TransformStream<Chunk, string>}
 */
export function lineTransform(fn, options) {
  const mapper = createLineMapper('lineTransform', requireFunction('lineTransform', 'fn', fn), options);
  return lineStream('lineTransform', mapper);
}

// createNormalizer(options?): a TransformStream that normalizes each line (api/normalize.js). It gives what
// normalize gives for the whole text: normalize keeps to the line boundary (§12.2). options.maxLineLength as for
// mapLines; normalize's own options, report and trace, are not stream options.
/**
 * @param {LineOptions | number | null} [options]
 * @returns {TransformStream<Chunk, string>}
 */
export function createNormalizer(options) {
  return lineStream('createNormalizer', createLineMapper('createNormalizer', normalizeLine, options));
}

/** @param {string} line */
function normalizeLine(line) {
  return /** @type {string} */ (normalize(line));
}

// createConverter(options?): a TransformStream that converts each line to Unicode, as toUnicode converts it
// (api/convert.js), with options.from, tie, zawgyiDetector and thresholds as toUnicode reads them: with `from`
// every line converts from that font, and with none each line is detected alone. It gives what toUnicode gives for
// the whole text (§12.2). options.to is 'unicode'; options.maxLineLength as for mapLines.
/**
 * @param {ConverterOptions | number | null} [options]
 * @returns {TransformStream<Chunk, string>}
 */
export function createConverter(options) {
  const settings = readOptions('createConverter', options);
  requireUnicodeTarget(settings);
  const reading = readUnicodeReading('createConverter', settings);
  /** @param {string} line */
  const convertLine = (line) => convertToUnicode(line, reading);
  return lineStream('createConverter', createLineMapper('createConverter', convertLine, options));
}

// options.to: 'unicode', the default. Zawgyi is refused, and the message says why: the Unicode to Zawgyi rules
// move an e or a medial ra before the nearest consonant before it, across a line break (DESIGN.md §10 Q10), so a
// line does not convert as it would in the whole text, and a stream converts line by line.
/** @param {import('./args.js').Options} settings */
function requireUnicodeTarget(settings) {
  if (settings.to === 'zawgyi') {
    throw libraryError(ERR.INVALID_ARG_VALUE, where('createConverter', 'options.to cannot be \'zawgyi\': the ' +
      'Unicode to Zawgyi rules move e and medial ra across line breaks, so a line streamed alone would not ' +
      'convert as it does in the whole text; convert the whole text with toZawgyi'), RangeError);
  }
  readChoice('createConverter', settings, 'to', TARGETS, 'unicode');
}

// A TransformStream that runs the mapper on each chunk, and writes one string for each chunk that completes a
// line, then the last line at the end. An error of the mapper or of the function errors the stream.
/**
 * @param {string} api
 * @param {LineMapper} mapper
 * @returns {TransformStream<Chunk, string>}
 */
function lineStream(api, mapper) {
  if (typeof TransformStream !== 'function') {
    throw libraryError(ERR.UNSUPPORTED_RUNTIME,
      where(api, 'this runtime has no TransformStream: mapLines(fn) cuts lines without one'));
  }
  return new TransformStream({
    transform: (chunk, controller) => enqueueText(controller, mapper.transform(chunk)),
    flush: (controller) => enqueueText(controller, mapper.flush())
  });
}

/**
 * @param {TransformStreamDefaultController<string>} controller
 * @param {string} text
 */
function enqueueText(controller, text) {
  if (text.length > 0) controller.enqueue(text);
}
