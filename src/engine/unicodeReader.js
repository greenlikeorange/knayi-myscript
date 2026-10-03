// The Unicode reader of normalize: Unicode text in storage order, one pass (DESIGN.md §3.5, §3.6;
// research/normalize.md §2-3). Layer L3 engine. Owner: W5 (engine-unicode).
//
// Skeleton (W0): UNICODE_READING and SEEN are complete, since the spec defines them. The functions throw
// ERR.NOT_BUILT until W5 builds them.

import { deepFreeze } from '../freeze.js';
import {
  CP, CLS, CLASS, isBurmeseConsonant, isSyllableBase, isBurmeseDigit, isBurmeseMark, isPrebaseMark,
  isOtherScriptLetter, isVowelSign, isNfcSafe, isMyanmarBlock, zeroWidthBit, MASK_VOWEL_OR_FINAL, MASK_ASAT,
  MASK_MEDIAL_HA
} from '../script/codes.js';
import { ERR, libraryError } from '../core/errors.js';
import { SyllableBuffer, CopyThroughWriter, closeSyllable, isHeld, marksGoOn } from './syllable.js';

// The Unicode reader's side of the four deliberate differences between the readers (§3.5).
export const UNICODE_READING = /* @__PURE__ */ deepFreeze({
  // ZW.ZWSP | ZW.WORD_JOINER | ZW.BOM: ZWNJ and ZWJ stay where they were typed, since in Unicode text they can
  // shape the syllable (research/normalize.md §3, "Spaces and joiners").
  heldZeroWidth: 25,
  // A Burmese digit takes no mark from across a space (research/normalize.md §3).
  digitTakesMarksAcrossSpace: false,
  // An e or medial ra looks only at the unit right after its run, so a zero-width unit there makes it stay.
  prebaseCrossesZeroWidth: false,
  // U+1025 right after a vowel sign stays u, as Pa'o writes it (research/normalize.md §3).
  keepUAfterVowelSign: true
});

// What the reader saw, for the final-NFC gate (§3.10).
export const SEEN = /* @__PURE__ */ deepFreeze({
  LETTER_U: 1, // U+1025: followed by U+102E, NFC composes it into U+1026
  NFC_UNSAFE: 2 // a unit at or above U+0300, outside U+1000-U+109F, for which isNfcSafe does not hold
});

// { text, seen }: text in storage order, and the SEEN flags (§3.6).
export function reorderUnicode(text) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/unicodeReader.js reorderUnicode is not built yet');
}

// The capacity, in units, of this module's scratch buffers (§3.11), for the memory tests.
export function unicodeReaderScratchUnits() {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/unicodeReader.js unicodeReaderScratchUnits is not built yet');
}
