// Rule rows and their runner, traces, and the stage runner (DESIGN.md §2.3, §3.9, §3.10, D4, D10). Layer L1.
// Owner: W1 (core).
//
// A RuleRow is { id, re, to, repeat, needs?, label? }: a global regex, its replacement, whether it repeats, the
// units of which every match holds one (where its table names them), and, on the six wrapped Unicode to Zawgyi
// rows only, the 2.x source as its label (decision 29). A row's `why` is a comment above it in its table, never a
// field (D17). A row with `needs` is skipped on a text that holds none of them: it cannot match there (DESIGN.md
// §3.10, gate 3).
//
// A Trace is { start, records: [{ id, label, text }] }: the text a pipeline started from, then the text after each
// step that changed it. It is one shape for both kinds of 2.x debug log (D4): 2.x's `steps` is
// [start, ...records.map((r) => r.text)] and its `matched_patterns` is records.map((r) => r.label).
//
// A Stage is { id, label, run(text, ctx), traceOnly?, gate?(ctx) }, and a pipeline is a frozen list of them. One
// runner serves the fast path and the trace, so the order and the names are written once (D10).

// The most passes of a repeat row (2.x asLongAsMatch, syllable.js replaceRepeated).
export const REPEAT_LIMIT = 40;

// The 2.x debug label of a row: its label, else its regex source (syllable.js convertText logs rule[0].source).
export function ruleLabel(row) {
  return row.label === undefined ? row.re.source : row.label;
}

// Whether the row's regex matches text. String#search starts at index 0 and leaves the regex's lastIndex as it
// found it (0), so a row carries no state from one call to the next (§4 rule 1).
export function ruleMatches(row, text) {
  return text.search(row.re) !== -1;
}

// text after every row, in order: a once row replaces every match once; a repeat row replaces until it no
// longer matches or changes the text, at most REPEAT_LIMIT times (syllable.js replaceOnce, replaceRepeated). A row
// that cannot match is skipped.
export function applyRuleRows(text, rows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!mayMatch(row, text)) continue;
    text = row.repeat ? replaceRepeatedly(text, row) : text.replace(row.re, row.to);
  }
  return text;
}

// Whether the row may match the text: it names no `needs`, or the text holds one of them. Searching for a unit is
// one fast scan, where a regex that starts with a class or a group is tried at every position of the text.
function mayMatch(row, text) {
  const needs = row.needs;
  if (needs === undefined) return true;
  for (let i = 0; i < needs.length; i++) {
    if (text.indexOf(needs[i]) !== -1) return true;
  }
  return false;
}

// 2.x replaceRepeated: a rule whose replacement makes a new match runs again, so a run of marks moves one step
// per pass. A global String#replace starts at index 0 and leaves lastIndex at 0.
function replaceRepeatedly(text, row) {
  for (let pass = 0; pass < REPEAT_LIMIT; pass++) {
    if (!ruleMatches(row, text)) break;
    const next = text.replace(row.re, row.to);
    if (next === text) break;
    text = next;
  }
  return text;
}

// applyRuleRows, recording the rows 2.x's debug log names (syllable.js convertText with debug), each with its id,
// its label and the text after it:
// - a once row that changed the text;
// - a repeat row that matched before its first pass, with the text after its last pass.
// The caller starts the trace (startTrace) with the text the rows are given.
export function traceRuleRows(text, rows, trace) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!mayMatch(row, text)) continue; // a row that cannot match changes nothing, and 2.x logs nothing for it
    const next = row.repeat ? replaceRepeatedly(text, row) : text.replace(row.re, row.to);
    const logged = row.repeat ? ruleMatches(row, text) : next !== text;
    if (logged) recordStep(trace, row.id, ruleLabel(row), next);
    text = next;
  }
  return text;
}

// An empty trace, for traceRuleRows or a pipeline's trace function to fill.
export function createTrace() {
  return { start: null, records: [] };
}

// Starts trace over at text: the input of a pipeline, or the text a rule table is given.
export function startTrace(trace, text) {
  trace.start = text;
  trace.records.length = 0;
}

// The last record's text, or the start when nothing is recorded: what the next step is compared with.
export function lastTracedText(trace) {
  const records = trace.records;
  return records.length === 0 ? trace.start : records[records.length - 1].text;
}

// Appends a record.
export function recordStep(trace, id, label, text) {
  trace.records.push({ id: id, label: label, text: text });
}

// text through every stage of a pipeline, in order. With no trace, a traceOnly stage is skipped, and so is a
// gated stage whose gate(ctx) is false, unless ctx.openAllGates (tests only) opens every gate. With a trace,
// nothing is skipped or gated, and each stage's output is recorded when it differs from the last recorded text
// (2.x step(), storageOrder.js:452-460); a traceOnly stage's output is recorded but not passed on. The caller
// calls startTrace(trace, text) first.
export function runStages(text, stages, ctx, trace) {
  return trace ? traceStages(text, stages, ctx, trace) : runGatedStages(text, stages, ctx);
}

// The fast path: no records, and the gates of §3.10.
function runGatedStages(text, stages, ctx) {
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (stage.traceOnly || (stage.gate && !ctx.openAllGates && !stage.gate(ctx))) continue;
    text = stage.run(text, ctx);
  }
  return text;
}

// The trace path: every stage runs, so a trace shows the whole pipeline whatever the gates would skip.
function traceStages(text, stages, ctx, trace) {
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const output = stage.run(text, ctx);
    if (output !== lastTracedText(trace)) recordStep(trace, stage.id, stage.label, output);
    if (!stage.traceOnly) text = output;
  }
  return text;
}
