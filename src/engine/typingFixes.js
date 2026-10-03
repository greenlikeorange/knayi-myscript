// Typing fixes on text in storage order: typos, look-alike digits and letters, zero typed as wa (DESIGN.md
// §2.3, §3.9; research/normalize.md §3). Layer L3 rules. Owner: W2 (typing-fixes).
//
// Skeleton (W0): the exports have their final names and signatures. NUMBER_CONTEXT is frozen and empty, and each
// function throws ERR.NOT_BUILT until W2 builds it.

import { deepFreeze } from '../freeze.js';
import {
  CP, isBurmeseDigit, isScriptDigit, isScriptMark, isScriptTone, isScriptConsonant, isScriptWordChar
} from '../script/codes.js';
import { ERR, libraryError } from '../core/errors.js';

// The 4 rules of spec/typoRows.js in one scan (§3.9).
export function fixTypos(text) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/typingFixes.js fixTypos is not built yet');
}

// 2.x lookAlikes, first pass: zero and seven as wa and ra.
export function readDigitsAsLetters(text) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/typingFixes.js readDigitsAsLetters is not built yet');
}

// 2.x lookAlikes, second pass: bare wa and ra in a number.
export function readLettersAsDigits(text) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/typingFixes.js readLettersAsDigits is not built yet');
}

// readLettersAsDigits(readDigitsAsLetters(text)).
export function fixLookAlikes(text) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/typingFixes.js fixLookAlikes is not built yet');
}

// The font pipeline's 'zero as wa' stage.
export function zeroAsWa(text) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/typingFixes.js zeroAsWa is not built yet');
}

// { ZERO_AS_WA, LOOK_ALIKES }: each { isDigit(code), isSign(code) }, the two 2.x zero-in-a-number rules (§7 #20).
export const NUMBER_CONTEXT = /* @__PURE__ */ deepFreeze({});

// Whether the unit at i sits in a number of the context.
export function isInNumber(text, i, context) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/typingFixes.js isInNumber is not built yet');
}
