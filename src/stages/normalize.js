// The normalize pipeline: NFC, the Unicode reader, typos, look-alikes, NFC (DESIGN.md §2.3, §3.10; 2.x
// normalization.js:22-23). Layer L3 stages. Owner: W5 (engine-unicode).
//
// NFC comes first as well as last: it can move a dot below in front of an asat or virama, which changes what they
// attach to, so the syllables are read from NFC text (research/normalize.md §2). Typos run before look-alikes here,
// while the font pipeline runs them the other way round (ARCHITECTURE.md, "Typing fixes and their two orders").
//
// Two gates skip work that provably cannot change the text (§3.10, decision 28), and no others:
// 1. the no-Myanmar fast path, in normalizeText;
// 2. the final-NFC gate, a field of the 'nfc.final' stage.
// The trace runner never gates (core/rules.js runStages), and `openAllGates` turns both off for the tests.

import { deepFreeze } from '../freeze.js';
import { runStages, startTrace } from '../core/rules.js';
import { toNfc } from '../core/nfc.js';
import { hasMyanmarScriptChar } from '../core/input.js';
import { optionsObject } from '../core/options.js';
import { reorderUnicode, SEEN } from '../engine/unicodeReader.js';
import { fixTypos, fixLookAlikes } from '../rules/typingFixes.js';

// Stage ids are new: 2.x normalize has no debug output. The two NFC stages share the label 'NFC' but not the id,
// because the 3.0 trace reads records by id (decision 8).
export const NORMALIZE_STAGES = /* @__PURE__ */ deepFreeze([
  { id: 'nfc.input', label: 'NFC', run: toNfc },
  { id: 'syllables', label: 'syllables', run: readSyllables },
  { id: 'typos', label: 'typos', run: fixTypos },
  { id: 'look-alikes', label: 'look-alikes', run: fixLookAlikes },
  { id: 'nfc.final', label: 'NFC', run: toNfc, gate: finalNfcMayChangeText }
]);

// The 'syllables' stage: the Unicode reader. What it saw goes into the context, for the final-NFC gate, so this file
// owns both the reader call and the gate check.
function readSyllables(text, ctx) {
  const read = reorderUnicode(text);
  ctx.seen = read.seen;
  return read.text;
}

// Gate 2, the final NFC (§3.10). The reader's input is NFC already. The reader only reorders Burmese marks within a
// syllable, drops repeated or slipped marks, and turns ca, u and seven into jha, nya and ra; the typing fixes write
// only U+102E, U+1030, U+102A, U+104E, U+101D, U+101B, U+1040 and U+1047. None of these compose or reorder under NFC,
// except U+1025 followed by U+102E, which becomes U+1026: hence LETTER_U. Every other unit that NFC could move or
// compose sets NFC_UNSAFE (codes.js isNfcSafe, checked on each runtime by test/next/codes.test.mjs).
function finalNfcMayChangeText(ctx) {
  return (ctx.seen & (SEEN.LETTER_U | SEEN.NFC_UNSAFE)) !== 0;
}

// engineOptions.openAllGates: tests only. compat never passes it, and no public API exposes it.
//
// The stages of NORMALIZE_STAGES are called here directly, in list order, rather than through runStages: the runner
// cost 4.6% on perf's per-word workload, above the 2% that DESIGN.md §7.7 allows (D10). The trace keeps runStages,
// and test/next/normalize.fuzz.test.mjs checks that both paths give the same text, with and without the gates.
export function normalizeText(text, engineOptions) {
  const ctx = { openAllGates: optionsObject(engineOptions).openAllGates === true, seen: 0 };
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
  return runStages(text, NORMALIZE_STAGES, { openAllGates: false, seen: 0 }, trace);
}
