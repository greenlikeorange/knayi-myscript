// @ts-check
// toUnicode and toZawgyi, 3.0 (DESIGN.md §11.5, §11.4; decision 13). Layer L4.
//
// The conversions are the core's, the same as 2.x fontConvert's (stages/fonts.js, rules/unicodeToZawgyi.js). What
// is new is around them:
// - toUnicode never trims, and with no `from` it detects each line on its own. A line whose evidence ties is left
//   as it is, unless tie: 'zawgyi' asks for 2.x's reading (decision 13): 2.x read every tie as Zawgyi, which changed
//   hundreds of Unicode lines of each corpus (§11.5 has the counts).
// - toUnicode converts a text as it converts each of its lines alone (§11.5).
// - A trace option takes a trace from createTrace() and fills it with stable ids, and toUnicode's offsets option
//   maps each unit of the output to the unit of the input it came from, for span annotation (§11.3).

import { deepFreeze } from '../freeze.js';
import { isMyanmarBlock } from '../script/codes.js';
import { EditLog, shiftEdits, outputToInputOffsets } from '../core/edits.js';
import { createTrace, startTrace, recordStep, lastTracedText } from '../core/rules.js';
import { FONT_STAGES, fontToUnicode, fontToUnicodeLogged, traceFontToUnicode } from '../stages/fonts.js';
import { unicodeToZawgyi, traceUnicodeToZawgyi } from '../rules/unicodeToZawgyi.js';
import { requireString, readOptions, readChoice, readFlag, readTrace } from './args.js';
import { readDetector, encodingOf } from './encoding.js';

/** @typedef {import('../index.js').ToUnicodeOptions} ToUnicodeOptions */
/** @typedef {import('../index.js').ToZawgyiOptions} ToZawgyiOptions */
/** @typedef {import('../index.js').ConversionWithOffsets} ConversionWithOffsets */
/** @typedef {import('../index.js').Trace} Trace */
/** @typedef {import('./encoding.js').Detector} Detector */
/** @typedef {import('./args.js').Options} Options */
/** @typedef {{ start: number, end: number, font: 'zawgyi' | 'win' }} Piece text[start, end) converts from font */
/**
 * What toUnicode reads a text as: `from`, or with none, each line detected by `detector`, a tie read as `tie`.
 * @typedef {{ from: 'unicode' | 'zawgyi' | 'win' | null, tie: 'unicode' | 'zawgyi', detector: Detector | null }}
 *   UnicodeReading
 */

// The fonts toUnicode converts from, and how it may read a tie.
/** @type {readonly ('unicode' | 'zawgyi' | 'win')[]} */
const SOURCES = /* @__PURE__ */ deepFreeze(['unicode', 'zawgyi', 'win']);
/** @type {readonly ('unicode' | 'zawgyi')[]} */
const TIE_READINGS = /* @__PURE__ */ deepFreeze(['unicode', 'zawgyi']);

const NEWLINE = 0x0A;

// toUnicode(text, options?): the text in Unicode, or with { offsets: true }, { text, offsets }.
//   from            'unicode', 'zawgyi' or 'win'. Not given: each line is detected (options.zawgyiDetector and
//                   options.thresholds as for detectEncoding); Win text cannot be detected and needs from: 'win'.
//   tie             what a line whose detection ties is read as: 'unicode' (the default: it stays as it is) or
//                   'zawgyi' (2.x).
//   trace           a trace from createTrace(): the text after each stage of the font pipeline that changed it.
//   offsets         true: offsets[i] is the index of the input unit that output unit i came from, and
//                   offsets[text.length] is the input's length.
/**
 * @param {string} text
 * @param {ToUnicodeOptions | number | null} [options]
 * @returns {string | ConversionWithOffsets}
 */
export function toUnicode(text, options) {
  requireString('toUnicode', 'text', text);
  const settings = readOptions('toUnicode', options);
  const reading = readUnicodeReading('toUnicode', settings);
  const trace = readTrace('toUnicode', settings);
  const withOffsets = readFlag('toUnicode', settings, 'offsets');
  const pieces = piecesToConvert(text, reading);
  if (trace !== null) traceInPieces(text, pieces, trace);
  return withOffsets ? convertWithOffsets(text, pieces) : convertPieces(text, pieces);
}

// The options that say what toUnicode reads a text as, checked: from, tie, and with no `from`, zawgyiDetector and
// thresholds.
/**
 * @param {string} api
 * @param {Options} settings
 * @returns {UnicodeReading}
 */
function readUnicodeReading(api, settings) {
  const from = readChoice(api, settings, 'from', SOURCES, null);
  const tie = readChoice(api, settings, 'tie', TIE_READINGS, 'unicode');
  return { from: from, tie: tie, detector: from === null ? readDetector(api, settings) : null };
}

// toZawgyi(text, options?): Unicode text in Zawgyi. options.trace, a trace from createTrace(), gets the text after
// the repeated-mark collapse (id 'uz.collapse') and after each rule row that changed it (ids 'uz.<section>.<n>').
/**
 * @param {string} text
 * @param {ToZawgyiOptions | number | null} [options]
 * @returns {string}
 */
export function toZawgyi(text, options) {
  requireString('toZawgyi', 'text', text);
  const trace = readTrace('toZawgyi', readOptions('toZawgyi', options));
  if (trace === null) return unicodeToZawgyi(text);
  // The core's trace starts at the collapsed text, as 2.x's debug log does (DESIGN.md §3.9); 3.0's starts at the
  // input, so the collapse is a record of its own.
  /** @type {Trace} */
  const rows = createTrace();
  const converted = traceUnicodeToZawgyi(text, rows);
  startTrace(trace, text);
  if (rows.start !== text) recordStep(trace, 'uz.collapse', 'collapse', rows.start);
  for (let k = 0; k < rows.records.length; k++) trace.records.push(rows.records[k]);
  return converted;
}

// ---------------------------------------------------------------------------------------------------------------
// Which parts convert. A piece is { start, end, font }: text[start, end) converts from that font.

// Every part converts line by line, so that a text converts as its lines do, each alone (DESIGN.md §11.5):
// - from Unicode, nothing;
// - from Win, the whole text: it is ASCII, so it always converts;
// - from Zawgyi, each line with a Myanmar-block character. A line with none has nothing to convert and stays as it
//   is, as 2.x left such a text. 2.x decided on the whole text, so a line with no Myanmar went through the final NFC
//   when another line had some: e U+0301 became U+00E9 next to a Zawgyi line, and stayed alone;
// - with no `from`, each line that reads as Zawgyi, or ties and is read as Zawgyi.
/**
 * @param {string} text
 * @param {UnicodeReading} reading
 * @returns {Piece[]}
 */
function piecesToConvert(text, reading) {
  if (reading.from === 'unicode') return [];
  if (reading.from === 'win') return [{ start: 0, end: text.length, font: 'win' }];
  if (reading.from === 'zawgyi') return linesWithMyanmar(text);
  const detector = /** @type {Detector} */ (reading.detector);
  return zawgyiLines(text, (line) => readsAsZawgyi(encodingOf(line, detector).encoding, reading.tie));
}

/**
 * @param {import('../index.js').Encoding} encoding
 * @param {'unicode' | 'zawgyi'} tie
 */
function readsAsZawgyi(encoding, tie) {
  return encoding === 'zawgyi' || (encoding === 'unknown' && tie === 'zawgyi');
}

// The lines of the text that `converts` picks, as pieces from Zawgyi. Neighbouring lines join one piece, line break
// included: the font pipeline converts each line as it would alone (DESIGN.md §11.5).
/**
 * @param {string} text
 * @param {(line: string) => boolean} converts
 * @returns {Piece[]}
 */
function zawgyiLines(text, converts) {
  /** @type {Piece[]} */
  const pieces = [];
  for (let start = 0; start <= text.length;) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = text.length;
    if (converts(text.slice(start, end))) addLine(pieces, start, end);
    start = end + 1;
  }
  return pieces;
}

// The lines of the text with a Myanmar-block character, as pieces from Zawgyi, joined as zawgyiLines joins them.
// Each line is read up to its first Myanmar-block character, and the rest of it is skipped to its line break, so no
// line is sliced or read twice.
/**
 * @param {string} text
 * @returns {Piece[]}
 */
function linesWithMyanmar(text) {
  /** @type {Piece[]} */
  const pieces = [];
  for (let start = 0; start <= text.length;) {
    const at = firstMyanmarOrLineBreak(text, start);
    let end = at;
    if (at < text.length && text.charCodeAt(at) !== NEWLINE) {
      end = text.indexOf('\n', at);
      if (end === -1) end = text.length;
      addLine(pieces, start, end);
    }
    start = end + 1;
  }
  return pieces;
}

// The index of the first Myanmar-block character or line break in text from `start`, or text.length.
/**
 * @param {string} text
 * @param {number} start
 */
function firstMyanmarOrLineBreak(text, start) {
  let at = start;
  for (; at < text.length; at++) {
    const code = text.charCodeAt(at);
    if (code === NEWLINE || isMyanmarBlock(code)) break;
  }
  return at;
}

/**
 * @param {Piece[]} pieces
 * @param {number} start
 * @param {number} end
 */
function addLine(pieces, start, end) {
  const last = pieces[pieces.length - 1];
  if (last !== undefined && last.end + 1 === start) last.end = end;
  else pieces.push({ start: start, end: end, font: 'zawgyi' });
}

// ---------------------------------------------------------------------------------------------------------------
// Converting the pieces.

/**
 * @param {string} text
 * @param {readonly Piece[]} pieces
 * @returns {string}
 */
function convertPieces(text, pieces) {
  let out = '';
  let copied = 0;
  for (let k = 0; k < pieces.length; k++) {
    const piece = pieces[k];
    out += text.slice(copied, piece.start) + fontToUnicode(text.slice(piece.start, piece.end), piece.font);
    copied = piece.end;
  }
  return copied === 0 ? text : out + text.slice(copied);
}

// { text, offsets }: each piece converts with its edits recorded, moved to where the piece lies in the input and in
// the output, and the offsets come from all of them (core/edits.js outputToInputOffsets).
/**
 * @param {string} text
 * @param {readonly Piece[]} pieces
 * @returns {ConversionWithOffsets}
 */
function convertWithOffsets(text, pieces) {
  let out = '';
  let copied = 0;
  /** @type {import('../core/edits.js').Edit[]} */
  const edits = [];
  for (let k = 0; k < pieces.length; k++) {
    const piece = pieces[k];
    out += text.slice(copied, piece.start);
    const log = new EditLog('');
    const converted = fontToUnicodeLogged(text.slice(piece.start, piece.end), piece.font, log);
    const moved = shiftEdits(log.edits, piece.start, out.length);
    for (let e = 0; e < moved.length; e++) edits.push(moved[e]);
    out += converted;
    copied = piece.end;
  }
  out += text.slice(copied);
  return { text: out, offsets: outputToInputOffsets(edits, out.length) };
}

// The trace of the conversion: for each stage of FONT_STAGES, the whole text with every piece as that stage left
// it, recorded when it differs from the text recorded last. With one piece over the whole text, that is
// traceFontToUnicode's own trace.
/**
 * @param {string} text
 * @param {readonly Piece[]} pieces
 * @param {Trace} trace
 */
function traceInPieces(text, pieces, trace) {
  const stagesOfPieces = pieces.map((piece) => textAfterEachStage(text.slice(piece.start, piece.end), piece.font));
  startTrace(trace, text);
  for (let s = 0; s < FONT_STAGES.length; s++) {
    let whole = '';
    let copied = 0;
    for (let k = 0; k < pieces.length; k++) {
      whole += text.slice(copied, pieces[k].start) + stagesOfPieces[k][s];
      copied = pieces[k].end;
    }
    whole += text.slice(copied);
    if (whole !== lastTracedText(trace)) recordStep(trace, FONT_STAGES[s].id, FONT_STAGES[s].label, whole);
  }
}

// The text after each stage of FONT_STAGES, in order: a stage that changed nothing leaves the text it was given.
/**
 * @param {string} piece
 * @param {'zawgyi' | 'win'} font
 * @returns {string[]}
 */
function textAfterEachStage(piece, font) {
  /** @type {Trace} */
  const trace = createTrace();
  traceFontToUnicode(piece, font, trace);
  /** @type {string[]} */
  const after = [];
  let last = piece; // the trace's start
  let r = 0;
  for (let s = 0; s < FONT_STAGES.length; s++) {
    if (r < trace.records.length && trace.records[r].id === FONT_STAGES[s].id) last = trace.records[r++].text;
    after.push(last);
  }
  return after;
}
