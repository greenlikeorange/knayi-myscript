// @ts-check
// toUnicode and toZawgyi, 3.0 (DESIGN.md §11.5, §11.4; decision 13). Layer L4.
//
// The conversions are the core's, the same as 2.x fontConvert's (stages/fonts.js, rules/unicodeToZawgyi.js). What
// is new is around them:
// - toUnicode never trims, and with no `from` it detects each line on its own. A line whose evidence ties is left
//   as it is, unless tie: 'zawgyi' asks for 2.x's reading (decision 13): 2.x read every tie as Zawgyi, which changed
//   hundreds of Unicode lines of each corpus (§11.5 has the counts).
// - A trace option takes a trace from createTrace() and fills it with stable ids, and toUnicode's offsets option
//   maps each unit of the output to the unit of the input it came from, for span annotation (§11.3).

import { deepFreeze } from '../freeze.js';
import { hasMyanmarBlockChar } from '../core/input.js';
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
/** @typedef {{ start: number, end: number, font: 'zawgyi' | 'win' }} Piece text[start, end) converts from font */

// The fonts toUnicode converts from, and how it may read a tie.
/** @type {readonly ('unicode' | 'zawgyi' | 'win')[]} */
const SOURCES = /* @__PURE__ */ deepFreeze(['unicode', 'zawgyi', 'win']);
/** @type {readonly ('unicode' | 'zawgyi')[]} */
const TIE_READINGS = /* @__PURE__ */ deepFreeze(['unicode', 'zawgyi']);

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
  const from = readChoice('toUnicode', settings, 'from', SOURCES, null);
  const tie = readChoice('toUnicode', settings, 'tie', TIE_READINGS, 'unicode');
  const trace = readTrace('toUnicode', settings);
  const withOffsets = readFlag('toUnicode', settings, 'offsets');
  const pieces = from === null ? zawgyiLines(text, readDetector('toUnicode', settings), tie) : wholeText(text, from);
  if (trace !== null) traceInPieces(text, pieces, trace);
  return withOffsets ? convertWithOffsets(text, pieces) : convertPieces(text, pieces);
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

// With `from`: the whole text, or nothing from Unicode. Zawgyi text with no Myanmar-block character has nothing to
// convert, as in 2.x; Win text is ASCII, so it always converts.
/**
 * @param {string} text
 * @param {'unicode' | 'zawgyi' | 'win'} from
 * @returns {Piece[]}
 */
function wholeText(text, from) {
  if (from === 'unicode' || (from === 'zawgyi' && !hasMyanmarBlockChar(text))) return [];
  return [{ start: 0, end: text.length, font: from }];
}

// With no `from`: the lines that read as Zawgyi, or tie and are read as Zawgyi. Neighbouring lines join one piece,
// line break included: the font pipeline converts each line as it would alone (DESIGN.md §11.5).
/**
 * @param {string} text
 * @param {Detector} detector
 * @param {'unicode' | 'zawgyi'} tie
 * @returns {Piece[]}
 */
function zawgyiLines(text, detector, tie) {
  /** @type {Piece[]} */
  const pieces = [];
  for (let start = 0; start <= text.length;) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = text.length;
    const encoding = encodingOf(text.slice(start, end), detector).encoding;
    if (encoding === 'zawgyi' || (encoding === 'unknown' && tie === 'zawgyi')) addLine(pieces, start, end);
    start = end + 1;
  }
  return pieces;
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
