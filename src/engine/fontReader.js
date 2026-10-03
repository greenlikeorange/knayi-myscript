// The font reader of Zawgyi and Win conversion: drawing order to storage order, one pass, and the compiled
// fonts it reads (DESIGN.md §3.5, §3.6, §3.8; research/zawgyi-to-unicode.md §2, research/win-fonts.md §5).
// Layer L3 engine. Owner: W6 (engine-fonts).
//
// Skeleton (W0): FONT_READING is complete, since the spec defines it. The functions throw ERR.NOT_BUILT until W6
// builds them.

import { deepFreeze } from '../freeze.js';
import {
  CP, ROLE, KINZI_TEXT, isSyllableBase, isBurmeseConsonant, isBurmeseDigit, zeroWidthBit, markRank, RANK_UNRANKED
} from '../script/codes.js';
import { ERR, libraryError } from '../core/errors.js';
import { SyllableBuffer, CodeBuffer, closeSyllable, isHeld, marksGoOn } from './syllable.js';

// The font reader's side of the four deliberate differences between the readers (§3.5).
export const FONT_READING = /* @__PURE__ */ deepFreeze({
  // ZW.ALL: every zero-width character typed inside a syllable moves to its end
  // (research/zawgyi-to-unicode.md §3, "Zero-width spaces and non-joiners").
  heldZeroWidth: 31,
  // After a held space, a mark joins any base, a digit included (research/zawgyi-to-unicode.md §3).
  digitTakesMarksAcrossSpace: true,
  // With no open syllable, a zero-width unit is written at once, and a pending e or medial ra goes on waiting for
  // the next base.
  prebaseCrossesZeroWidth: true,
  // Zawgyi and Win text is Burmese: U+1025 with asat, aa or a stacked consonant is nya wherever it is
  // (research/normalize.md §3).
  keepUAfterVowelSign: false
});

// The checked, flat form of a FontDefinition (§3.8). Throws libraryError(ERR.INVALID_FONT_TABLE, ...).
export function compileFont(definition) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/fontReader.js compileFont is not built yet');
}

// Font text in Unicode storage order (§3.6).
export function readFont(text, font) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/fontReader.js readFont is not built yet');
}

// Each glyph as Unicode, still in typed order: the trace-only stage 'glyphs'.
export function glyphsInTypedOrder(text, font) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/fontReader.js glyphsInTypedOrder is not built yet');
}

// The capacity, in units, of this module's scratch buffers (§3.11), for the memory tests.
export function fontReaderScratchUnits() {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/fontReader.js fontReaderScratchUnits is not built yet');
}
