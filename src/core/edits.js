// Edit lists: where a pass changed its text, as ranges of its input and of its output (DESIGN.md §11.3). Layer L1.
//
// The copy-through writers of the core (the Unicode reader's CopyThroughWriter, the typing fixes, the font reader,
// the rule rows and NFC) already know, at the one place where they write something new, which units of their input
// they replaced and where the replacement lands in their output. Given an EditLog, they record that there; given
// none, they record nothing and run as before. The 3.0 API builds normalize's change report, toUnicode's offsets
// and the regions normalize settles from these lists.
//
// An edit is { start, end, outStart, outEnd, rules }: input[start, end) became output[outStart, outEnd). The units
// between two edits, and before the first and after the last, are copied through unchanged, so the edits of a pass
// are in order and never overlap, and an edit list with its two texts is the whole alignment of them. `rules` holds
// the ids of the stages that made the edit (a stage id of DESIGN.md §2.3, such as 'syllables' or 'typos'), in the
// order they ran.
//
// composeEdits turns the edits of two passes run one after the other into the edits of the two together, so a
// pipeline's stages, or several passes, give one list from the first input to the last output.

import { deepFreeze } from '../freeze.js';

/** @typedef {{ start: number, end: number, outStart: number, outEnd: number, rules: string[] }} Edit */

// The edits of a log that recorded nothing. Frozen, so no caller can add to it by mistake.
const NO_EDITS = /* @__PURE__ */ deepFreeze([]);

// The edits one pass records, in order. A log takes the id of the stage that records into it from `rule`, which
// the runner of a pipeline sets before each stage. Its list is made at the first edit, so a pass that changes
// nothing allocates nothing but the log itself.
export class EditLog {
  constructor(rule) {
    this.rule = rule || '';
    this.edits = NO_EDITS;
  }

  // input[start, end) became output[outStart, outEnd).
  add(start, end, outStart, outEnd) {
    if (this.edits === NO_EDITS) this.edits = [];
    this.edits.push({ start: start, end: end, outStart: outStart, outEnd: outEnd, rules: [this.rule] });
  }

  // `before`, at `start` in the input, became `after`, at `outStart` in the output: an edit of the units in which
  // they differ, leaving out what they share at the start and at the end (sharedEnds). Nothing when they are equal.
  addChange(start, before, outStart, after) {
    if (before === after) return;
    const ends = sharedEnds(before.length, after.length, (k) => before[k] === after[k],
      (k) => before[before.length - 1 - k] === after[after.length - 1 - k], (k) => before.charCodeAt(k));
    this.add(start + ends.head, start + before.length - ends.tail, outStart + ends.head,
      outStart + after.length - ends.tail);
  }

  // Appends the edits of a list made elsewhere, such as composeEdits's result.
  addAll(edits) {
    for (let i = 0; i < edits.length; i++) {
      if (this.edits === NO_EDITS) this.edits = [];
      this.edits.push(edits[i]);
    }
  }

  isEmpty() {
    return this.edits.length === 0;
  }
}

// How many units two different texts share at the start (head) and at the end (tail), counted only while each text
// keeps at least one unit between them: a replacement stays a replacement, so the units it wrote still map to a unit
// of its input (outputToInputOffsets). An empty side stays empty. sameAtStart(k) and sameAtEnd(k) compare the k-th
// unit from the start and from the end; beforeUnitAt(k) is the k-th unit of the first text.
//
// A surrogate pair is never cut: the edit takes the whole pair when a shared end would stop between its halves.
// NFC changes supplementary characters that share a high or a low surrogate (U+11131 U+11127 compose to U+1112E,
// and musical symbols reorder), and an edit that began at a low surrogate gave a change report, and explain, lone
// surrogates for well-formed text. The shared units are the same in both texts, so the first text tells.
export function sharedEnds(beforeLength, afterLength, sameAtStart, sameAtEnd, beforeUnitAt) {
  const keep = beforeLength > 0 && afterLength > 0 ? 1 : 0;
  let head = 0;
  while (head < beforeLength - keep && head < afterLength - keep && sameAtStart(head)) head++;
  if (head > 0 && isHighSurrogate(beforeUnitAt(head - 1))) head--;
  let tail = 0;
  while (tail < beforeLength - head - keep && tail < afterLength - head - keep && sameAtEnd(tail)) tail++;
  if (tail > 0 && isLowSurrogate(beforeUnitAt(beforeLength - tail))) tail--;
  return { head: head, tail: tail };
}

function isHighSurrogate(code) {
  return code >= 0xD800 && code <= 0xDBFF;
}

function isLowSurrogate(code) {
  return code >= 0xDC00 && code <= 0xDFFF;
}

// ---------------------------------------------------------------------------------------------------------------
// Composing two passes.

// The edits of `first` (text X to T) followed by `second` (T to U), as edits of X to U. Both lists are in order and
// do not overlap. On the middle text T, the output ranges of `first` and the input ranges of `second` are swept
// together: ranges that overlap, or an empty range strictly inside another, join one group, and each group becomes
// one edit, with the rules of its edits in order. Every group's ends are units that both passes copied through or
// ends of edits, so each end has one place in X and one in U. Linear in the number of edits.
export function composeEdits(first, second) {
  const groups = groupsOnMiddleText(first, second);
  const composed = [];
  let firstDelta = 0; // output length minus input length of the first pass's edits before the group
  let secondDelta = 0; // the same for the second pass
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    const firstGrowth = growth(group.firstEdits);
    const secondGrowth = growth(group.secondEdits);
    composed.push({
      start: group.start - firstDelta,
      end: group.end - firstDelta - firstGrowth,
      outStart: group.start + secondDelta,
      outEnd: group.end + secondDelta + secondGrowth,
      rules: rulesOf(group.firstEdits, group.secondEdits)
    });
    firstDelta += firstGrowth;
    secondDelta += secondGrowth;
  }
  return composed;
}

// The groups of the sweep: { start, end, firstEdits, secondEdits }, in order on the middle text.
function groupsOnMiddleText(first, second) {
  const groups = [];
  let i = 0;
  let j = 0;
  let group = null;
  while (i < first.length || j < second.length) {
    const takeFirst = j >= second.length || (i < first.length && comesFirst(first[i].outStart, first[i].outEnd,
      second[j].start, second[j].end));
    const edit = takeFirst ? first[i++] : second[j++];
    const start = takeFirst ? edit.outStart : edit.start;
    const end = takeFirst ? edit.outEnd : edit.end;
    if (group === null || !joinsGroup(group, start, end)) {
      group = { start: start, end: end, firstEdits: [], secondEdits: [] };
      groups.push(group);
    }
    if (end > group.end) group.end = end;
    (takeFirst ? group.firstEdits : group.secondEdits).push(edit);
  }
  return groups;
}

// Whether the range [start, end) of the first pass's output comes before the range [otherStart, otherEnd) of the
// second pass's input in the sweep: by start, and at one start an empty range first, since it lies before the unit
// there; between two ranges of the same kind, the first pass's.
function comesFirst(start, end, otherStart, otherEnd) {
  if (start !== otherStart) return start < otherStart;
  return start === end || otherStart !== otherEnd;
}

// Whether a range of the middle text joins the group: it overlaps it, or it is empty and strictly inside it. Ranges
// that only touch stay apart, since the unit between them is a boundary both passes agree on.
function joinsGroup(group, start, end) {
  if (end > start) return start < group.end;
  return start > group.start && start < group.end;
}

// How many units longer the output of these edits is than their input.
function growth(edits) {
  let units = 0;
  for (let k = 0; k < edits.length; k++) {
    units += (edits[k].outEnd - edits[k].outStart) - (edits[k].end - edits[k].start);
  }
  return units;
}

// The rules of a group: the first pass's, then the second's, each id once.
function rulesOf(firstEdits, secondEdits) {
  const rules = [];
  const add = (edits) => {
    for (let k = 0; k < edits.length; k++) {
      for (let r = 0; r < edits[k].rules.length; r++) {
        if (rules.indexOf(edits[k].rules[r]) === -1) rules.push(edits[k].rules[r]);
      }
    }
  };
  add(firstEdits);
  add(secondEdits);
  return rules;
}

// ---------------------------------------------------------------------------------------------------------------
// Edits of part of a text.

// The edits, moved by `inputShift` units on the input and `outputShift` on the output: the edits of a slice that
// starts at inputShift in the whole input and at outputShift in the whole output.
export function shiftEdits(edits, inputShift, outputShift) {
  const shifted = [];
  for (let k = 0; k < edits.length; k++) {
    const edit = edits[k];
    shifted.push({
      start: edit.start + inputShift,
      end: edit.end + inputShift,
      outStart: edit.outStart + outputShift,
      outEnd: edit.outEnd + outputShift,
      rules: edit.rules
    });
  }
  return shifted;
}

// For each unit of the output, and for the end of the output, the index of the input it came from (outputLength + 1
// numbers): a unit an edit wrote maps to the start of the input that edit replaced, and a unit copied through maps
// to itself. The numbers never decrease, so a span of the output maps to a span of the input.
export function outputToInputOffsets(edits, outputLength) {
  const offsets = new Array(outputLength + 1);
  let out = 0;
  let delta = 0; // input index minus output index, for units copied through
  for (let k = 0; k < edits.length; k++) {
    const edit = edits[k];
    for (; out < edit.outStart; out++) offsets[out] = out + delta;
    for (; out < edit.outEnd; out++) offsets[out] = edit.start;
    delta = edit.end - edit.outEnd;
  }
  for (; out <= outputLength; out++) offsets[out] = out + delta;
  return offsets;
}
