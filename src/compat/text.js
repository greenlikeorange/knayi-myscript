// compat: 2.x normalize, syllBreak, spellingFix and truncate on the core (DESIGN.md §5.1, C20-C24). Layer L4.
// Owner: W8 (compat).
//
// Skeleton (W0): the exports have their final names and signatures, and each function throws ERR.NOT_BUILT until
// W8 builds it.

import { ERR, libraryError } from '../core/errors.js';
import { hasMyanmarBlockChar } from '../core/input.js';
import { DEFAULTS } from '../core/options.js';
import { normalizeText } from '../engine/normalizeStages.js';
import { prepareBreakText, breakParts, breakString, collapseRepeatedMarks } from '../segment.js';
import { detectForRouting } from './fontDetect.js';
import { enter, cleanText, chooseFontLegacy } from './input.js';
import { legacyBreakFont, legacyCollapseFont, NO_RULES, toJoinSeparator } from './legacy.js';

export function normalize(content) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/text.js normalize is not built yet');
}

export function syllBreak(content, fontType, breakpoint) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/text.js syllBreak is not built yet');
}

export function spellingFix(content, fontType) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/text.js spellingFix is not built yet');
}

export function truncate(content, options) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/text.js truncate is not built yet');
}
