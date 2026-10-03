// One syllable in UTN #11 storage order, shared by both readers: SyllableBuffer, orderSyllable and its steps,
// CodeBuffer and CopyThroughWriter (DESIGN.md §3.3-§3.5, §3.7, D9). Layer L3 engine. Owner: W5 (engine-unicode).
//
// Skeleton (W0): ASAT_PLACE is complete, since the spec defines it. The classes' constructors and the functions
// throw ERR.NOT_BUILT until W5 builds them.

import { deepFreeze } from '../freeze.js';
import {
  CP, isBurmeseDigit, zeroWidthBit, markRank, markBit, RANK_LAST_MEDIAL, RANK_LOWER_VOWEL, RANK_AI_ANUSVARA,
  MASK_ANY_AA, MASK_UPPER_VOWELS, MASK_LOWER_VOWELS, MASK_E_OR_AA, MASK_MEDIALS, MASK_ASAT, MASK_DOT_BELOW,
  MASK_VISARGA, MASK_MEDIAL_YA, MASK_MEDIAL_HA
} from '../script/codes.js';
import { ERR, libraryError } from '../core/errors.js';

// Where orderSyllable puts the asat (§3.4; UTN #11, research/zawgyi-to-unicode.md §3). 2.x had the flags early,
// afterMedials, slip and last (storageOrder.js:117-132).
export const ASAT_PLACE = /* @__PURE__ */ deepFreeze({
  NONE: 0, // no asat
  DROPPED: 1, // a slip, typed early for the next consonant's asat: removed
  IN_ORDER: 2, // stored last, sorted with the marks (kyaw, dot below, aa with no medial)
  ON_CONSONANT: 3, // right after the base and stack, before the medials (kyun-up, loanword finals)
  AFTER_MEDIALS: 4 // after the medials: Mon's final h, with medial ha
});

// A growable Uint16Array (§3.7).
export class CodeBuffer {
  constructor(capacity) {
    throw libraryError(ERR.NOT_BUILT, 'src/engine/syllable.js CodeBuffer is not built yet');
  }
}

// The open syllable in typed order and the text held after it (§3.3).
export class SyllableBuffer {
  constructor() {
    throw libraryError(ERR.NOT_BUILT, 'src/engine/syllable.js SyllableBuffer is not built yet');
  }
}

// The Unicode reader's output: slices of the input, and the input itself when nothing changed (§3.7).
export class CopyThroughWriter {
  constructor() {
    throw libraryError(ERR.NOT_BUILT, 'src/engine/syllable.js CopyThroughWriter is not built yet');
  }
}

// orderSyllable, then writeHeld, then the syllable is closed.
export function closeSyllable(buf, sink) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/syllable.js closeSyllable is not built yet');
}

export function orderSyllable(buf, sink) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/syllable.js orderSyllable is not built yet');
}

// Returns an ASAT_PLACE.
export function placeAsat(buf, stacked) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/syllable.js placeAsat is not built yet');
}

export function fixLookAlikeLetters(buf, place, stacked, hadAa) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/syllable.js fixLookAlikeLetters is not built yet');
}

// Fills buf.ranks.
export function rankMarks(buf) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/syllable.js rankMarks is not built yet');
}

export function sortByRank(buf) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/syllable.js sortByRank is not built yet');
}

export function writeOrdered(buf, place, sink) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/syllable.js writeOrdered is not built yet');
}

export function writeHeld(buf, sink) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/syllable.js writeHeld is not built yet');
}

// Whether the unit is held after the open syllable, by the reader's options (§3.5).
export function isHeld(buf, code, reading) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/syllable.js isHeld is not built yet');
}

// Whether a mark joins the open syllable across what is held, by the reader's options (§3.5).
export function marksGoOn(buf, reading) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/syllable.js marksGoOn is not built yet');
}
