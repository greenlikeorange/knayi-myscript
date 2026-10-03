// The normalize pipeline: NFC, the Unicode reader, typos, look-alikes, NFC (DESIGN.md §2.3, §3.10; 2.x
// normalization.js normalize). Layer L3 stages. Owner: W5 (engine-unicode); the stable pipeline of 3.0 (§11.2).
//
// NFC comes first as well as last: it can move a dot below in front of an asat or virama, which changes what they
// attach to, so the syllables are read from NFC text (research/normalize.md §2). Typos run before look-alikes here,
// while the font pipeline runs them the other way round (ARCHITECTURE.md, "Typing fixes and their two orders").
//
// Two gates skip work that provably cannot change the text (§3.10, decision 28), and no others:
// 1. the no-Myanmar fast path, in normalizeText;
// 2. the final-NFC gate, a field of the 'nfc.final' stage.
// The trace runner never gates (core/rules.js runStages), and `openAllGates` turns both off for the tests.
//
// Two pipelines share these stages:
// - NORMALIZE_STAGES, 2.x normalize, for compat. A second call can change its output again (DESIGN.md §10 Q12).
// - STABLE_NORMALIZE_STAGES, one pass of 3.0's normalize, which is idempotent (decision 36): normalizeTextStable
//   repeats it where the first pass changed the text, until it changes nothing (§11.2).

import { deepFreeze } from '../freeze.js';
import { isSyllableBase, isBurmeseDigit } from '../script/codes.js';
import { runStages, runStagesLogged, startTrace } from '../core/rules.js';
import { toNfc, logNfcEdits } from '../core/nfc.js';
import { EditLog, composeEdits } from '../core/edits.js';
import { hasMyanmarScriptChar } from '../core/input.js';
import { optionsObject } from '../core/options.js';
import { reorderUnicode, SEEN, UNICODE_READING, STABLE_UNICODE_READING } from '../engine/unicodeReader.js';
import { fixTypos, settleTypos, settleTyposLogged, fixLookAlikes, fixLookAlikesLogged } from '../rules/typingFixes.js';

// Stage ids are new: 2.x normalize has no debug output. The two NFC stages share the label 'NFC' but not the id,
// because the 3.0 trace reads records by id (decision 8).
export const NORMALIZE_STAGES = /* @__PURE__ */ deepFreeze([
  { id: 'nfc.input', label: 'NFC', run: toNfc },
  { id: 'syllables', label: 'syllables', run: readSyllables },
  { id: 'typos', label: 'typos', run: fixTypos },
  { id: 'look-alikes', label: 'look-alikes', run: fixLookAlikes },
  { id: 'nfc.final', label: 'NFC', run: toNfc, gate: finalNfcMayChangeText }
]);

// One pass of 3.0's normalize: the same stages and ids, with two changes that a single pass of 2.x leaves to a later
// pass, each of which could need one pass per unit of a run (§11.2): the reader's stable reading
// (engine/unicodeReader.js STABLE_UNICODE_READING) and typos settled in one scan (rules/typingFixes.js settleTypos).
export const STABLE_NORMALIZE_STAGES = /* @__PURE__ */ deepFreeze([
  { id: 'nfc.input', label: 'NFC', run: toNfc },
  { id: 'syllables', label: 'syllables', run: readSyllablesStably },
  { id: 'typos', label: 'typos', run: settleTypos },
  { id: 'look-alikes', label: 'look-alikes', run: fixLookAlikes },
  { id: 'nfc.final', label: 'NFC', run: toNfc, gate: finalNfcMayChangeText }
]);

// The logged run of each stage of STABLE_NORMALIZE_STAGES, by id (core/rules.js runStagesLogged; DESIGN.md §11.3):
// each gives what the stage's run gives and records its edits in a log. A table of its own, so that a bundle that
// never logs leaves it out.
export const STABLE_NORMALIZE_LOGGED_RUNS = /* @__PURE__ */ deepFreeze({
  'nfc.input': toNfcLogged,
  syllables: readSyllablesStablyLogged,
  typos: settleTyposStageLogged,
  'look-alikes': fixLookAlikesStageLogged,
  'nfc.final': toNfcLogged
});

// The 'syllables' stage: the Unicode reader. What it saw goes into the context, for the final-NFC gate, so this file
// owns both the reader call and the gate check.
function readSyllables(text, ctx) {
  return readSyllablesWith(text, ctx, UNICODE_READING, null);
}

// The 'syllables' stage of STABLE_NORMALIZE_STAGES.
function readSyllablesStably(text, ctx) {
  return readSyllablesWith(text, ctx, STABLE_UNICODE_READING, null);
}

function readSyllablesStablyLogged(text, ctx, log) {
  return readSyllablesWith(text, ctx, STABLE_UNICODE_READING, log);
}

function readSyllablesWith(text, ctx, reading, log) {
  const read = reorderUnicode(text, reading, log);
  ctx.seen = read.seen;
  return read.text;
}

// The logged runs of the typing fixes and NFC: the functions' logged twins, with the log in third place.
function settleTyposStageLogged(text, ctx, log) {
  return settleTyposLogged(text, log);
}

function fixLookAlikesStageLogged(text, ctx, log) {
  return fixLookAlikesLogged(text, log);
}

function toNfcLogged(text, ctx, log) {
  const normalized = toNfc(text);
  if (normalized !== text) logNfcEdits(text, log);
  return normalized;
}

// Gate 2, the final NFC (§3.10). The reader's input is NFC already. The reader only reorders Burmese marks within a
// syllable, drops repeated or slipped marks, and turns ca, u and seven into jha, nya and ra; the typing fixes write
// only U+102E, U+1030, U+102A, U+104E, U+101D, U+101B, U+1040 and U+1047. None of these compose or reorder under NFC,
// except U+1025 followed by U+102E, which becomes U+1026: hence LETTER_U. Every other unit that NFC could move or
// compose sets NFC_UNSAFE (codes.js isNfcSafe, checked on each runtime by test/next/codes.test.mjs).
function finalNfcMayChangeText(ctx) {
  return (ctx.seen & (SEEN.LETTER_U | SEEN.NFC_UNSAFE)) !== 0;
}

// A new context for one run of the stages (NormalizeContext, §2.3).
function normalizeContext(openAllGates) {
  return { openAllGates: openAllGates, seen: 0 };
}

// engineOptions.openAllGates: tests only. compat never passes it, and no public API exposes it.
//
// The stages of NORMALIZE_STAGES are called here directly, in list order, rather than through runStages: the runner
// cost 4.6% on perf's per-word workload, above the 2% that DESIGN.md §7.7 allows (D10). The trace keeps runStages,
// and test/next/normalize.fuzz.test.mjs checks that both paths give the same text, with and without the gates.
export function normalizeText(text, engineOptions) {
  const ctx = normalizeContext(optionsObject(engineOptions).openAllGates === true);
  // Gate 1, the no-Myanmar fast path (§3.10): with no unit of the three Myanmar blocks, the reader writes every
  // unit through unchanged and the typing fixes match nothing, and NFC cannot make a Myanmar unit. So only NFC is
  // left. 2.x normalize still applies NFC to such text, and so does this path (decision 16).
  if (!ctx.openAllGates && !hasMyanmarScriptChar(text)) return toNfc(text);
  let out = toNfc(text); // 'nfc.input'
  out = readSyllables(out, ctx); // 'syllables'
  out = fixTypos(out); // 'typos'
  out = fixLookAlikes(out); // 'look-alikes'
  return ctx.openAllGates || finalNfcMayChangeText(ctx) ? toNfc(out) : out; // 'nfc.final', gate 2
}

// The same result as normalizeText, with every stage's output recorded in `trace` when it changed the text.
export function traceNormalizeText(text, trace) {
  startTrace(trace, text);
  return runStages(text, NORMALIZE_STAGES, normalizeContext(false), trace);
}

// ---------------------------------------------------------------------------------------------------------------
// 3.0's normalize: idempotent (decision 36; DESIGN.md §11.2).
//
// 2.x normalize is not idempotent on garbled text (§10 Q12): a pass can write text that it would read differently
// again, such as a zero that the look-alikes make wa after the reader has kept it out of a stack, or a u it makes
// nya after the stack that would take it has closed. One pass of STABLE_NORMALIZE_STAGES fixes the two such cases
// whose settling would take one pass per unit of a run, and normalizeTextStable repeats the pass where it changed
// the text, until it changes nothing. That is its fixpoint: a second call finds nothing to change.
//
// Repeating it where it changed the text is enough, because a pass is local to regions. Where a unit below U+0300
// that is no number separator ('.', ',') comes right before a syllable base or Burmese digit, no stage reads or
// writes across that point: NFC composes nothing across it, the reader closes its syllable there with nothing
// pending, and the typing fixes read no further than the unit before (§11.2 gives the argument stage by stage;
// test/next/api/normalize.fuzz.test.mjs checks it). So a pass over the text is a pass over each region between such
// points, and a region the first pass did not change is a fixpoint already. On ordinary text the regions it changed
// are a few words, and repeating the pass costs little.

// The number separators the look-alikes read across (rules/typingFixes.js isInNumber): no region starts after one.
const FULL_STOP = 0x2E;
const COMMA = 0x2C;

// The most passes a region gets. Fuzz and pumped inputs settle in at most 3 (test/next/api/normalize.fuzz.test.mjs
// records the count); a region still changing after this many keeps the last pass's text.
export const MOST_NORMALIZE_PASSES = 16;

// 3.0's normalize of text: STABLE_NORMALIZE_STAGES, repeated until they change nothing. engineOptions.openAllGates:
// tests only, as for normalizeText.
export function normalizeTextStable(text, engineOptions) {
  const openAllGates = optionsObject(engineOptions).openAllGates === true;
  if (!openAllGates && !hasMyanmarScriptChar(text)) return toNfc(text); // gate 1; NFC is idempotent
  const log = new EditLog('');
  const once = firstStablePass(text, openAllGates, log);
  if (log.isEmpty()) return once;
  return settleRegions(once, changedRanges(log.edits), openAllGates);
}

// The first pass of STABLE_NORMALIZE_STAGES, its stages called directly as normalizeText calls its own. Each stage
// after the first NFC records its edits in `log`, tagged with its id, in its own text's terms: the regions the pass
// changed are all normalizeTextStable needs to know. A change of the first NFC alone needs no second pass, since
// the stages after it found nothing to change in its output.
function firstStablePass(text, openAllGates, log) {
  const ctx = normalizeContext(openAllGates);
  let out = toNfc(text); // 'nfc.input'
  log.rule = 'syllables';
  out = readSyllablesStablyLogged(out, ctx, log);
  log.rule = 'typos';
  out = settleTyposLogged(out, log);
  log.rule = 'look-alikes';
  out = fixLookAlikesLogged(out, log);
  if (!openAllGates && !finalNfcMayChangeText(ctx)) return out; // gate 2
  log.rule = 'nfc.final';
  return toNfcLogged(out, ctx, log);
}

// A later pass, over a region the first one changed: the stage list through the runner, with its gates.
function stablePass(text, openAllGates) {
  if (!openAllGates && !hasMyanmarScriptChar(text)) return toNfc(text); // gate 1
  return runStages(text, STABLE_NORMALIZE_STAGES, normalizeContext(openAllGates), null);
}

// The ranges of the pass's output that some stage wrote: each stage's edits, in its own text's terms, carried on
// through the stages after it. The log holds them stage by stage, in pipeline order.
function changedRanges(edits) {
  let composed = [];
  for (let start = 0; start < edits.length;) {
    let end = start + 1;
    while (end < edits.length && edits[end].rules[0] === edits[start].rules[0]) end++;
    composed = composeEdits(composed, edits.slice(start, end));
    start = end;
  }
  return composed;
}

// The text with each region that holds a changed range settled: the pass repeated on it until it changes nothing.
// The ranges are in order, and each search for a region's ends starts where the last one stopped, so the text is
// read once however many ranges a region holds (a long line with no space can hold thousands).
function settleRegions(text, ranges, openAllGates) {
  let out = '';
  let copied = 0;
  for (let k = 0; k < ranges.length;) {
    const start = regionStartAtOrBefore(text, Math.max(0, ranges[k].outStart - 1));
    let end = regionEndAfter(text, ranges[k].outEnd + 1);
    while (++k < ranges.length && ranges[k].outStart - 1 < end) {
      if (ranges[k].outEnd + 1 > end) end = regionEndAfter(text, ranges[k].outEnd + 1);
    }
    out += text.slice(copied, start) + settle(text.slice(start, end), openAllGates);
    copied = end;
  }
  return out + text.slice(copied);
}

// The pass, repeated on a region until it changes nothing, at most MOST_NORMALIZE_PASSES times.
function settle(region, openAllGates) {
  for (let pass = 1; pass < MOST_NORMALIZE_PASSES; pass++) {
    const next = stablePass(region, openAllGates);
    if (next === region) break;
    region = next;
  }
  return region;
}

// Whether a region of the pipeline starts at i (see above): i is 0, or the unit before it is below U+0300 and no
// number separator, and the unit at it is a syllable base or Burmese digit.
function isRegionStart(text, i) {
  if (i === 0) return true;
  const before = text.charCodeAt(i - 1);
  if (before >= 0x300 || before === FULL_STOP || before === COMMA) return false;
  const code = text.charCodeAt(i);
  return isSyllableBase(code) || isBurmeseDigit(code);
}

// The start of the region that holds unit i.
function regionStartAtOrBefore(text, i) {
  while (!isRegionStart(text, i)) i--;
  return i;
}

// The end of the region that holds the unit before `from`: the next region start at or after it, or the end.
function regionEndAfter(text, from) {
  let end = Math.min(from, text.length);
  while (end < text.length && !isRegionStart(text, end)) end++;
  return end;
}

// normalizeTextStable, with every pass's stages recorded in `trace` when they changed the text: the stages of the
// first pass, then those of each pass after it that changed something, over the whole text (§11.4). The trace
// starts at the input.
export function traceNormalizeTextStable(text, trace) {
  startTrace(trace, text);
  for (let pass = 0; pass < MOST_NORMALIZE_PASSES; pass++) {
    const next = runStages(text, STABLE_NORMALIZE_STAGES, normalizeContext(false), trace);
    if (next === text) return text;
    text = next;
  }
  return text;
}

// normalizeTextStable, recording in `log`, an EditLog, its edits from the input to the result, each with the ids of
// the stages that made it, over every pass (§11.3).
export function normalizeTextStableLogged(text, log) {
  let edits = [];
  for (let pass = 0; pass < MOST_NORMALIZE_PASSES; pass++) {
    const passLog = new EditLog('');
    const next = runStagesLogged(text, STABLE_NORMALIZE_STAGES, STABLE_NORMALIZE_LOGGED_RUNS, normalizeContext(false),
      passLog);
    if (next === text) break;
    edits = composeEdits(edits, passLog.edits);
    text = next;
  }
  log.addAll(edits);
  return text;
}
