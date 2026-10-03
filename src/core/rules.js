// Rule rows and their runner, traces, and the stage runner (DESIGN.md §2.3, §3.9, §3.10, D4, D10). Layer L1.
// Owner: W1 (core).
//
// Skeleton (W0): the exports have their final names and signatures, and each function throws ERR.NOT_BUILT
// until W1 builds it.
//
// A RuleRow is { id, re, to, repeat, label? }; a Trace is { start, records: [{ id, label, text }] }; a Stage is
// { id, label, run(text, ctx), traceOnly?, gate?(ctx) }.

import { ERR, libraryError } from './errors.js';

// The most passes of a repeat row (2.x asLongAsMatch).
export const REPEAT_LIMIT = 40;

// The 2.x debug label of a row: row.label, else row.re.source.
export function ruleLabel(row) {
  throw libraryError(ERR.NOT_BUILT, 'src/core/rules.js ruleLabel is not built yet');
}

// text.search(row.re) !== -1.
export function ruleMatches(row, text) {
  throw libraryError(ERR.NOT_BUILT, 'src/core/rules.js ruleMatches is not built yet');
}

export function applyRuleRows(text, rows) {
  throw libraryError(ERR.NOT_BUILT, 'src/core/rules.js applyRuleRows is not built yet');
}

export function traceRuleRows(text, rows, trace) {
  throw libraryError(ERR.NOT_BUILT, 'src/core/rules.js traceRuleRows is not built yet');
}

// { start: null, records: [] }.
export function createTrace() {
  throw libraryError(ERR.NOT_BUILT, 'src/core/rules.js createTrace is not built yet');
}

// start = text; records emptied.
export function startTrace(trace, text) {
  throw libraryError(ERR.NOT_BUILT, 'src/core/rules.js startTrace is not built yet');
}

// The last record's text, or start.
export function lastTracedText(trace) {
  throw libraryError(ERR.NOT_BUILT, 'src/core/rules.js lastTracedText is not built yet');
}

// Appends a record.
export function recordStep(trace, id, label, text) {
  throw libraryError(ERR.NOT_BUILT, 'src/core/rules.js recordStep is not built yet');
}

export function runStages(text, stages, ctx, trace) {
  throw libraryError(ERR.NOT_BUILT, 'src/core/rules.js runStages is not built yet');
}
