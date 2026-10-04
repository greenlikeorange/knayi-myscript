// @ts-check
// explain, 3.0 (DESIGN.md §11.8). Layer L4.
//
// explain(text) lists what is wrong with a Unicode Burmese text, as a checker of LLM output or a corpus audit needs
// it: each issue with its offsets in the text, a stable rule id, and the text normalize writes there. It reads the
// text line by line:
// - a line the detector reads as Zawgyi is one issue, 'encoding.zawgyi', whose fix is the line in Unicode;
// - every other line gets one issue for each thing normalize changes in it: typing order, repeated marks, slips,
//   look-alike letters and digits, typos and NFC. These come from the edits each stage of each pass of normalize
//   records (DESIGN.md §11.3), carried back to the input and named by what the stage changed.

import { deepFreeze } from '../freeze.js';
import { EditLog, composeEdits } from '../core/edits.js';
import {
  STABLE_NORMALIZE_STAGES, STABLE_NORMALIZE_LOGGED_RUNS, MOST_NORMALIZE_PASSES
} from '../stages/normalize.js';
import { fontToUnicode } from '../stages/fonts.js';
import { requireString, readOptions } from './args.js';
import { DETECTOR_OPTIONS, readDetector, encodingOf } from './encoding.js';

/** @typedef {import('../index.js').Issue} Issue */
/** @typedef {import('../index.js').IssueKind} IssueKind */
/** @typedef {import('../index.js').IssueRule} IssueRule */
/** @typedef {import('../index.js').DetectorOptions} DetectorOptions */
/** @typedef {import('./encoding.js').Detector} Detector */
/** @typedef {import('../core/edits.js').Edit} Edit */
/** @typedef {{ rule: IssueRule, start: number, end: number }} NamedEdit an edit of a stage, named, in the line */
/** @typedef {{ units: Int32Array, spaces: number }} Census how many of each unit a text holds (unitCensus) */

// What each rule is about: 'zawgyi', 'order', 'mark', 'look-alike', 'typo' or 'nfc', by the rule's first part.
/** @type {Readonly<Record<string, IssueKind>>} */
const KIND_OF_RULE_PREFIX = /* @__PURE__ */ deepFreeze({
  encoding: 'zawgyi', order: 'order', mark: 'mark', asat: 'mark', 'look-alike': 'look-alike', typo: 'typo', nfc: 'nfc'
});

// The marks the reader sorts, U+102B-U+103E, and asat among them.
const FIRST_MARK = 0x102B;
const MARK_COUNT = 20;
const ASAT = 0x103A;

// The look-alikes, each [typed, written, rule]: a unit the reader writes as the letter it looks like.
/** @type {readonly (readonly [number, number, IssueRule])[]} */
const LOOK_ALIKE_LETTERS = /* @__PURE__ */ deepFreeze([[0x1025, 0x1009, 'look-alike.u-as-nya'],
  [0x1047, 0x101B, 'look-alike.seven-as-ra'], [0x1040, 0x101D, 'look-alike.zero-as-wa'],
  [0x1005, 0x1008, 'look-alike.ca-as-jha']]);

// explain(text, options?): the issues of the text, by where they start. Each is { kind, rule, start, end, text, fix }:
// text[start, end), which is `text`, has the issue, and normalize writes `fix` there (toUnicode, for a Zawgyi line).
// options.zawgyiDetector and options.thresholds are those of detectEncoding.
/**
 * @param {string} text
 * @param {DetectorOptions | number | null} [options]
 * @returns {Issue[]}
 */
export function explain(text, options) {
  requireString('explain', 'text', text);
  const detector = readDetector('explain', readOptions('explain', options, DETECTOR_OPTIONS));
  /** @type {Issue[]} */
  const issues = [];
  for (let start = 0; start <= text.length;) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = text.length;
    explainLine(text.slice(start, end), start, detector, issues);
    start = end + 1;
  }
  return issues;
}

// The issues of one line, which starts at `offset` in the text, added to `issues`.
/**
 * @param {string} line
 * @param {number} offset
 * @param {Detector} detector
 * @param {Issue[]} issues
 */
function explainLine(line, offset, detector, issues) {
  if (line === '') return;
  const read = encodingOf(line, detector);
  if (read.encoding === 'zawgyi') {
    issues.push(zawgyiIssue(line, offset));
    return;
  }
  const found = normalizeIssues(line);
  for (let k = 0; k < found.length; k++) {
    const issue = found[k];
    issue.start += offset;
    issue.end += offset;
    issues.push(issue);
  }
}

// A line in Zawgyi: the span from its first character to its last that is not white space. The end comes from trim
// on the rest of the line, which removes the white space that \s matches: /\s+$/ would try again from every position
// of a run of white space that does not end the line, in quadratic time (scripts/check-redos.mjs).
/**
 * @param {string} line
 * @param {number} offset
 * @returns {Issue}
 */
function zawgyiIssue(line, offset) {
  const start = line.length - line.replace(/^\s+/, '').length;
  const end = start + line.slice(start).trim().length;
  const zawgyi = line.slice(start, end);
  return issueOf('encoding.zawgyi', offset + start, offset + end, zawgyi, fontToUnicode(zawgyi, 'zawgyi'));
}

// ---------------------------------------------------------------------------------------------------------------
// The issues normalize finds in one line.

// The passes of normalize, stage by stage (stages/normalize.js STABLE_NORMALIZE_STAGES), with each stage's edits
// named (nameEdit) and carried back to the line, then each placed in the change of normalize's report that holds it:
// its span and fix are that change's.
/**
 * @param {string} line
 * @returns {Issue[]}
 */
function normalizeIssues(line) {
  /** @type {NamedEdit[]} */
  const named = [];
  /** @type {Edit[]} */
  let composed = []; // the edits from the line to the text so far
  let text = line;
  for (let pass = 0; pass < MOST_NORMALIZE_PASSES; pass++) {
    const passStart = text;
    const ctx = { openAllGates: false, seen: 0 };
    for (let s = 0; s < STABLE_NORMALIZE_STAGES.length; s++) {
      const stage = STABLE_NORMALIZE_STAGES[s];
      if (stage.gate && !stage.gate(ctx)) continue;
      const log = new EditLog(stage.id);
      const input = text;
      text = STABLE_NORMALIZE_LOGGED_RUNS[stage.id](text, ctx, log);
      nameEdits(stage.id, input, text, log.edits, composed, named);
      composed = composeEdits(composed, log.edits);
    }
    if (text === passStart) break;
  }
  return placeInChanges(line, text, composed, named);
}

// Names each edit of a stage and carries it back to the line: { rule, start, end } in the line. The stage's edits
// and the edits so far are both in order, so one sweep carries them all.
/**
 * @param {string} stageId
 * @param {string} input
 * @param {string} output
 * @param {readonly Edit[]} edits
 * @param {readonly Edit[]} composed
 * @param {NamedEdit[]} named
 */
function nameEdits(stageId, input, output, edits, composed, named) {
  const back = { composed: composed, next: 0, growth: 0 };
  for (let k = 0; k < edits.length; k++) {
    const edit = edits[k];
    const before = input.slice(edit.start, edit.end);
    const after = output.slice(edit.outStart, edit.outEnd);
    const start = lineIndexOfStart(back, edit.start);
    const end = Math.max(start, lineIndexOfEnd(back, edit.end));
    if (before === after) continue;
    const rules = nameEdit(stageId, before, after);
    for (let r = 0; r < rules.length; r++) named.push({ rule: rules[r], start: start, end: end });
  }
}

// Where the text so far, at index i, came from in the line: the start of the input of an edit that wrote unit i,
// else the unit itself, moved back by what the edits before it added. `back` sweeps the edits so far in order:
// `next` is the first that may still hold i, and `growth` what the ones before it added.
/**
 * @param {{ composed: readonly Edit[], next: number, growth: number }} back
 * @param {number} i
 * @returns {number}
 */
function lineIndexOfStart(back, i) {
  const composed = back.composed;
  while (back.next < composed.length && composed[back.next].outEnd <= i && !holdsStart(composed[back.next], i)) {
    back.growth += grownBy(composed[back.next]);
    back.next++;
  }
  const edit = composed[back.next];
  return edit !== undefined && holdsStart(edit, i) ? edit.start : i - back.growth;
}

// The same for the end of a span: the end of the input of an edit that wrote the unit before i. It looks ahead of
// `next` without moving it, since the next span starts at or after i.
/**
 * @param {{ composed: readonly Edit[], next: number, growth: number }} back
 * @param {number} i
 * @returns {number}
 */
function lineIndexOfEnd(back, i) {
  const composed = back.composed;
  let growth = back.growth;
  for (let k = back.next; k < composed.length && composed[k].outStart < i; k++) {
    if (i <= composed[k].outEnd) return composed[k].end;
    growth += grownBy(composed[k]);
  }
  return i - growth;
}

// Whether the edit wrote unit i.
/**
 * @param {Edit} edit
 * @param {number} i
 */
function holdsStart(edit, i) {
  return edit.outStart <= i && i < edit.outEnd;
}

// How many units longer the edit's output is than its input.
/** @param {Edit} edit */
function grownBy(edit) {
  return (edit.outEnd - edit.outStart) - (edit.end - edit.start);
}

// Each named edit in the change of normalize's report that holds it (the last change that starts at or before it;
// the changes do not overlap, and every named edit lies inside one), one issue per change and rule, by start. A
// change that normalize undid later in the pipeline, whose text is its fix, is no issue.
/**
 * @param {string} line
 * @param {string} normalized
 * @param {readonly Edit[]} composed
 * @param {NamedEdit[]} named
 * @returns {Issue[]}
 */
function placeInChanges(line, normalized, composed, named) {
  /** @type {Issue[]} */
  const issues = [];
  /** @type {Record<string, boolean>} */
  const listed = {};
  named.sort((a, b) => a.start - b.start || a.end - b.end);
  let c = 0;
  for (let k = 0; k < named.length; k++) {
    const item = named[k];
    while (c + 1 < composed.length && composed[c + 1].start <= item.start) c++;
    const change = composed[c];
    const before = line.slice(change.start, change.end);
    const fix = normalized.slice(change.outStart, change.outEnd);
    const key = change.start + ' ' + change.end + ' ' + item.rule;
    if (before === fix || listed[key]) continue;
    listed[key] = true;
    issues.push(issueOf(item.rule, change.start, change.end, before, fix));
  }
  return issues;
}

// An issue: what it is about, its rule, its span and text, and what belongs there.
/**
 * @param {IssueRule} rule
 * @param {number} start
 * @param {number} end
 * @param {string} text
 * @param {string} fix
 * @returns {Issue}
 */
function issueOf(rule, start, end, text, fix) {
  const kind = KIND_OF_RULE_PREFIX[rule.slice(0, rule.indexOf('.'))];
  return { kind: kind, rule: rule, start: start, end: end, text: text, fix: fix };
}

// ---------------------------------------------------------------------------------------------------------------
// What a stage changed, by rule id.

// The rules of one edit of a stage: what its input `before` became, `after`.
/**
 * @param {string} stageId
 * @param {string} before
 * @param {string} after
 * @returns {IssueRule[]}
 */
function nameEdit(stageId, before, after) {
  if (stageId === 'nfc.input' || stageId === 'nfc.final') return ['nfc.order'];
  if (stageId === 'typos') return [typoRule(before)];
  if (stageId === 'look-alikes') return [lookAlikeRule(before)];
  return syllableRules(before, after);
}

// The typo row of spec/typoRows.js the edit applied, by its first unit.
/**
 * @param {string} before
 * @returns {IssueRule}
 */
function typoRule(before) {
  const code = before.charCodeAt(0);
  if (code === 0x102D || code === 0x102E) return 'typo.ii';
  if (code === 0x102F || code === 0x1030) return 'typo.uu';
  if (code === 0x1029) return 'typo.au';
  return 'typo.lagaung';
}

// The look-alike the edit read: a digit as a letter, or a letter as a digit (research/normalize.md §3).
/**
 * @param {string} before
 * @returns {IssueRule}
 */
function lookAlikeRule(before) {
  switch (before.charCodeAt(0)) {
    case 0x1040: return 'look-alike.zero-as-wa';
    case 0x1047: return 'look-alike.seven-as-ra';
    case 0x101D: return 'look-alike.wa-as-zero';
    default: return 'look-alike.ra-as-seven';
  }
}

// What the reader changed in one syllable, by comparing the units it read with those it wrote:
//   look-alike.u-as-nya, .seven-as-ra, .zero-as-wa, .ca-as-jha  a letter or digit read as the one it looks like;
//   mark.space       a space typed before a mark, dropped;
//   mark.repeated    a mark typed twice, kept once;
//   asat.dropped     an asat that slipped onto the wrong syllable, dropped;
//   order.prebase    e or medial ra typed before its consonant;
//   order.marks      the marks, an asat or a stacked consonant in another order than UTN #11 stores them.
// Each text is read once (unitCensus), so a syllable of thousands of marks costs no more than its length.
/**
 * @param {string} before
 * @param {string} after
 * @returns {IssueRule[]}
 */
function syllableRules(before, after) {
  const typed = unitCensus(before);
  const written = unitCensus(after);
  const rules = lettersReadAs(typed, written);
  if (typed.spaces > written.spaces) rules.push('mark.space');
  if (hasRepeatedMarkDropped(typed, written)) rules.push('mark.repeated');
  else if (countIn(typed, ASAT) > countIn(written, ASAT)) rules.push('asat.dropped');
  if (isPrebase(before.charCodeAt(0)) && !isPrebase(after.charCodeAt(0))) rules.push('order.prebase');
  else if (rules.length === 0 || marksMoved(before, after, typed, written)) rules.push('order.marks');
  return rules;
}


// What a text holds: how many of each unit of U+1000-U+104F (the letters, digits and marks the reader reads),
// and of spaces.
/**
 * @param {string} text
 * @returns {Census}
 */
function unitCensus(text) {
  const census = { units: new Int32Array(0x50), spaces: 0 };
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x1000 && code < 0x1050) census.units[code - 0x1000]++;
    else if (code === 0x20 || code === 0xA0) census.spaces++;
  }
  return census;
}

// How many of a unit of U+1000-U+104F the census counted.
/**
 * @param {Census} census
 * @param {number} code
 * @returns {number}
 */
function countIn(census, code) {
  return census.units[code - 0x1000];
}

// The look-alikes the reader read: fewer of the unit typed, and more of the letter it stands for.
/**
 * @param {Census} typed
 * @param {Census} written
 * @returns {IssueRule[]}
 */
function lettersReadAs(typed, written) {
  /** @type {IssueRule[]} */
  const rules = [];
  for (let k = 0; k < LOOK_ALIKE_LETTERS.length; k++) {
    const pair = LOOK_ALIKE_LETTERS[k];
    const fewerTyped = countIn(typed, pair[0]) > countIn(written, pair[0]);
    if (fewerTyped && countIn(written, pair[1]) > countIn(typed, pair[1])) rules.push(pair[2]);
  }
  return rules;
}

// Whether a mark typed more than once lost a copy.
/**
 * @param {Census} typed
 * @param {Census} written
 */
function hasRepeatedMarkDropped(typed, written) {
  for (let code = FIRST_MARK; code < FIRST_MARK + MARK_COUNT; code++) {
    if (countIn(typed, code) > 1 && countIn(written, code) < countIn(typed, code)) return true;
  }
  return false;
}

// Whether the marks both texts hold come in another order: the order of their first copies differs.
/**
 * @param {string} before
 * @param {string} after
 * @param {Census} typed
 * @param {Census} written
 */
function marksMoved(before, after, typed, written) {
  return firstMarks(before, written) !== firstMarks(after, typed);
}

// The marks of `text` that the other text holds too (its census), each once, in the order they first come.
/**
 * @param {string} text
 * @param {Census} other
 * @returns {string}
 */
function firstMarks(text, other) {
  const seen = new Uint8Array(MARK_COUNT);
  let marks = '';
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i) - FIRST_MARK;
    if (k < 0 || k >= MARK_COUNT || seen[k] === 1 || countIn(other, FIRST_MARK + k) === 0) continue;
    seen[k] = 1;
    marks += text[i];
  }
  return marks;
}

// e or medial ra, which Unicode stores after their consonant.
/** @param {number} code */
function isPrebase(code) {
  return code === 0x1031 || code === 0x103C;
}
