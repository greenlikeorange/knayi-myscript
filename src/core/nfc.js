// NFC: the only call of String#normalize in src/ (DESIGN.md §2.3, §3.10, D20). Layer L1. Owner: W1 (core).
//
// Skeleton (W0): toNfc throws ERR.NOT_BUILT until W1 builds it. The port of the 2.x linear helper (§8) adds
// NFC_MEMO, createNfcMemo and toNfcWith.

import { ERR, libraryError } from './errors.js';

// text.normalize('NFC').
export function toNfc(text) {
  throw libraryError(ERR.NOT_BUILT, 'src/core/nfc.js toNfc is not built yet');
}
