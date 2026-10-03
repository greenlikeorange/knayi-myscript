// The normalize pipeline: NFC, the Unicode reader, typos, look-alikes, NFC (DESIGN.md §2.3, §3.10). Layer L3
// stages. Owner: W5 (engine-unicode).
//
// Skeleton (W0): the exports have their final names and signatures. The stage list is frozen and empty, and each
// function throws ERR.NOT_BUILT until W5 builds it.
//
// Stage ids 'nfc.input', 'syllables', 'typos', 'look-alikes', 'nfc.final' (gated); labels 'NFC', 'syllables',
// 'typos', 'look-alikes', 'NFC'.

import { deepFreeze } from '../freeze.js';
import { ERR, libraryError } from '../core/errors.js';
import { runStages, startTrace } from '../core/rules.js';
import { toNfc } from '../core/nfc.js';
import { hasMyanmarScriptChar } from '../core/input.js';
import { reorderUnicode, SEEN } from './unicodeReader.js';
import { fixTypos, fixLookAlikes } from './typingFixes.js';

export const NORMALIZE_STAGES = /* @__PURE__ */ deepFreeze([]);

// engineOptions.openAllGates: tests only. compat never passes it, and no public API exposes it.
export function normalizeText(text, engineOptions) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/normalizeStages.js normalizeText is not built yet');
}

export function traceNormalizeText(text, trace) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/normalizeStages.js traceNormalizeText is not built yet');
}
