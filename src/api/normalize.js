// @ts-check
// normalize and isNormalized, 3.0 (DESIGN.md §11.2, §11.3; decision 36). Layer L4.
//
// normalize puts Unicode Burmese text in the storage order of UTN #11, fixes the typing slips and look-alike digits
// research/normalize.md describes, and returns NFC. Unlike 2.x's, it is idempotent: normalize(normalize(x)) ===
// normalize(x) for every string, because it repeats its pass where the pass changed the text, until the pass changes
// nothing (stages/normalize.js normalizeTextStable). It never trims, and keeps zero-width characters.

import { EditLog } from '../core/edits.js';
import { normalizeTextStable, normalizeTextStableLogged, traceNormalizeTextStable } from '../stages/normalize.js';
import { requireString, readOptions, readFlag, readTrace } from './args.js';

/** @typedef {import('../index.js').NormalizeOptions} NormalizeOptions */
/** @typedef {import('../index.js').NormalizeReport} NormalizeReport */
/** @typedef {import('../index.js').NormalizeChange} NormalizeChange */
/** @typedef {import('../index.js').NormalizeStageId} NormalizeStageId */
/** @typedef {{ start: number, end: number, outStart: number, outEnd: number, rules: string[] }} Edit */

// normalize(text, options?): the normalized text, or with { report: true }, { text, changes }.
// options.trace, a trace from createTrace(), gets the text after each stage of each pass that changed it.
/**
 * @param {string} text
 * @param {NormalizeOptions | number | null} [options]
 * @returns {string | NormalizeReport}
 */
export function normalize(text, options) {
  requireString('normalize', 'text', text);
  if (options === undefined) return normalizeTextStable(text); // the common call, with no option to read
  const settings = readOptions('normalize', options);
  const report = readFlag('normalize', settings, 'report');
  const trace = readTrace('normalize', settings);
  if (trace !== null) traceNormalizeTextStable(text, trace);
  return report ? normalizeReport(text) : normalizeTextStable(text);
}

// Whether normalize would leave the text as it is: the text is in storage order, with no typing slip or look-alike
// digit that normalize fixes, and in NFC. It does not tell Zawgyi from Unicode: Zawgyi text can read as normalized
// (explain and detectEncoding do).
/**
 * @param {string} text
 * @returns {boolean}
 */
export function isNormalized(text) {
  requireString('isNormalized', 'text', text);
  return normalizeTextStable(text) === text;
}

// { text, changes }: the normalized text and what changed, from the edits of every pass (DESIGN.md §11.3).
/**
 * @param {string} text
 * @returns {NormalizeReport}
 */
function normalizeReport(text) {
  const log = new EditLog('');
  const normalized = normalizeTextStableLogged(text, log);
  return { text: normalized, changes: describeChanges(text, normalized, log.edits) };
}

// Each edit as a change: { start, end, before, after, outputStart, outputEnd, rules }. text[start, end), which is
// `before`, became normalized[outputStart, outputEnd), which is `after`; rules are the ids of the stages that made
// it, in the order they ran ('nfc.input', 'syllables', 'typos', 'look-alikes', 'nfc.final'). An edit a later stage
// undid, so that `before` is `after`, is no change.
/**
 * @param {string} text
 * @param {string} normalized
 * @param {readonly Edit[]} edits
 * @returns {NormalizeChange[]}
 */
function describeChanges(text, normalized, edits) {
  const changes = [];
  for (let k = 0; k < edits.length; k++) {
    const edit = edits[k];
    const before = text.slice(edit.start, edit.end);
    const after = normalized.slice(edit.outStart, edit.outEnd);
    if (before === after) continue;
    const rules = /** @type {NormalizeStageId[]} */ (edit.rules.slice());
    changes.push({ start: edit.start, end: edit.end, before: before, after: after, outputStart: edit.outStart,
      outputEnd: edit.outEnd, rules: rules });
  }
  return changes;
}
