// Syllable breaks: the one-pass break scanners of both fonts, and the repeated-mark collapse (DESIGN.md §2.3).
// Layer L3 rules. Owner: W3 (segment).
//
// Skeleton (W0): the exports have their final names and signatures, and each function throws ERR.NOT_BUILT until
// W3 builds it.

import {
  CP, isBurmeseConsonant, isZawgyiPrebase, isZawgyiMedialRa, isZawgyiKinzi
} from './script/codes.js';
import { ERR, libraryError } from './core/errors.js';

// unicode: U+103A U+1037 -> U+1037 U+103A (row U1).
export function prepareBreakText(text, font) {
  throw libraryError(ERR.NOT_BUILT, 'src/segment.js prepareBreakText is not built yet');
}

// Calls onBreak(index) at every break, in increasing order, never at 0; stops when onBreak returns false.
export function forEachBreak(prepared, font, onBreak) {
  throw libraryError(ERR.NOT_BUILT, 'src/segment.js forEachBreak is not built yet');
}

// 2.x breakParts.
export function breakParts(text, font) {
  throw libraryError(ERR.NOT_BUILT, 'src/segment.js breakParts is not built yet');
}

// 2.x joinParts(breakParts(...)).
export function breakString(text, font, separator) {
  throw libraryError(ERR.NOT_BUILT, 'src/segment.js breakString is not built yet');
}

// Row Z6's switch: /[U+1062 U+1063]U+103A/ tested on the input.
export function looksLikeSgawKaren(text) {
  throw libraryError(ERR.NOT_BUILT, 'src/segment.js looksLikeSgawKaren is not built yet');
}

// 2.x collapseMarks for a known font.
export function collapseRepeatedMarks(text, font) {
  throw libraryError(ERR.NOT_BUILT, 'src/segment.js collapseRepeatedMarks is not built yet');
}
