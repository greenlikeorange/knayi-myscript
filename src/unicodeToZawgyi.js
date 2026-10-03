// Unicode to Zawgyi: the 65 rule rows in 2.x order, and their runner with and without a trace (DESIGN.md §2.3,
// §3.9). Layer L3 rules. Owner: W7 (unicode-to-zawgyi).
//
// Skeleton (W0): the exports have their final names and signatures. The rows are frozen and empty, and each
// function throws ERR.NOT_BUILT until W7 builds it.

import { deepFreeze } from './freeze.js';
import { ERR, libraryError } from './core/errors.js';
import { applyRuleRows, traceRuleRows, startTrace } from './core/rules.js';
import { collapseRepeatedMarks } from './segment.js';

// 57 once rows, then 8 repeat rows, in 2.x order.
export const UNICODE_TO_ZAWGYI_RULES = /* @__PURE__ */ deepFreeze([]);

// collapseRepeatedMarks(text, 'unicode'), then the rows.
export function unicodeToZawgyi(text) {
  throw libraryError(ERR.NOT_BUILT, 'src/unicodeToZawgyi.js unicodeToZawgyi is not built yet');
}

// The same, recording 2.x's debug log; trace.start is the collapsed text.
export function traceUnicodeToZawgyi(text, trace) {
  throw libraryError(ERR.NOT_BUILT, 'src/unicodeToZawgyi.js traceUnicodeToZawgyi is not built yet');
}
