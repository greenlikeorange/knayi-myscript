// compat: the 2.x preamble of every public function: input policy, cleaning and font names (DESIGN.md §5.1,
// C5-C11, D1). Layer L4. Owner: W8 (compat).
//
// Skeleton (W0): the exports have their final names and signatures. INPUT_POLICY is frozen and empty, and each
// function throws ERR.NOT_BUILT until W8 builds it.

import { deepFreeze } from '../freeze.js';
import { ERR, libraryError } from '../core/errors.js';
import { FONT_ALIASES, stripZeroWidthBreaks } from '../core/input.js';
import { report, MESSAGES } from './globalOptions.js';

// The fallback of the 2.x routing detection: a tie means Zawgyi (decision 13).
export const ON_TIE_ASSUME_ZAWGYI = 'zawgyi';

// Per public function: what counts as missing content, and what other non-strings return (C6, C7).
export const INPUT_POLICY = /* @__PURE__ */ deepFreeze({});

// { kind: 'missing' | 'other' | 'text', value }.
export function enter(apiName, content) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/input.js enter is not built yet');
}

// A String object as the string it wraps (C5).
export function unboxString(content) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/input.js unboxString is not built yet');
}

// stripZeroWidthBreaks(text.trim()) (C9).
export function cleanText(text) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/input.js cleanText is not built yet');
}

// The 2.x font-name lookup (C10).
export function resolveFont(name) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/input.js resolveFont is not built yet');
}

// The 2.x font choice of syllBreak, spellingFix and truncate (C11).
export function chooseFontLegacy(name, text, detect) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/input.js chooseFontLegacy is not built yet');
}
