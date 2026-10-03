// The fonts knayi knows, text predicates and the text check of the 3.0 API (DESIGN.md §2.3, D1). Layer L1.
// Owner: W1 (core).
//
// Skeleton (W0): the exports have their final names and signatures. The data is frozen and empty, and each
// function throws ERR.NOT_BUILT until W1 builds it.

import { deepFreeze } from '../freeze.js';
import { MYANMAR_BLOCK_PATTERN, MYANMAR_SCRIPT_PATTERN } from '../script/codes.js';
import { ERR, libraryError } from './errors.js';

// { unicode, zawgyi, win }: each a FontInfo { name, aliases, visualOrder, sourceOnly, ascii }.
export const FONTS = /* @__PURE__ */ deepFreeze({});

// Null prototype: unicode, uni -> 'unicode'; zawgyi, zaw -> 'zawgyi'; win -> 'win'.
export const FONT_ALIASES = /* @__PURE__ */ deepFreeze({});

// Whether text has a unit in U+1000-U+109F.
export function hasMyanmarBlockChar(text) {
  throw libraryError(ERR.NOT_BUILT, 'src/core/input.js hasMyanmarBlockChar is not built yet');
}

// Whether text has a unit in the three Myanmar blocks.
export function hasMyanmarScriptChar(text) {
  throw libraryError(ERR.NOT_BUILT, 'src/core/input.js hasMyanmarScriptChar is not built yet');
}

// text without U+200B and U+200C.
export function stripZeroWidthBreaks(text) {
  throw libraryError(ERR.NOT_BUILT, 'src/core/input.js stripZeroWidthBreaks is not built yet');
}

// value when it is a string; else throws libraryError(ERR.INVALID_ARG_TYPE, 'knayi.<api>: text must be a string',
// TypeError).
export function requireText(apiName, value) {
  throw libraryError(ERR.NOT_BUILT, 'src/core/input.js requireText is not built yet');
}
