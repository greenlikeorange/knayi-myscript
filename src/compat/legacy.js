// compat: 2.x's property-lookup quirks, and its accidental TypeErrors (DESIGN.md §5.1, C12, C20, D13). Layer L4.
// Owner: W8 (compat).
//
// legacyTypeError() is the one way src/ throws an error with no code; test/next/guards/errors.test.mjs allows it
// in this file only.
//
// Skeleton (W0): the exports have their final names and signatures. NO_RULES is frozen and empty, and each
// function throws ERR.NOT_BUILT until W8 builds it.

import { deepFreeze } from '../freeze.js';
import { ERR, libraryError } from '../core/errors.js';

// What a rule-table lookup returns for a name with no rules (C12).
export const NO_RULES = /* @__PURE__ */ deepFreeze({});

// 2.x BREAK_RULES[name] (syllable.js:216): 'unicode', 'zawgyi' or NO_RULES, or throws legacyTypeError().
export function legacyBreakFont(name) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/legacy.js legacyBreakFont is not built yet');
}

// 2.x COLLAPSE[name] || COLLAPSE.unicode (syllable.js:260).
export function legacyCollapseFont(name) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/legacy.js legacyCollapseFont is not built yet');
}

// A TypeError with no code, where 2.x threw one by accident (decision 9).
export function legacyTypeError() {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/legacy.js legacyTypeError is not built yet');
}

// ['', ''].join(value): the 2.x separator conversion (C20).
export function toJoinSeparator(value) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/legacy.js toJoinSeparator is not built yet');
}
