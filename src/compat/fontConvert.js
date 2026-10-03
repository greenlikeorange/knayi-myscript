// compat: 2.x fontConvert and fontConvert.debugging on the core (DESIGN.md §5.1, C15-C19). Layer L4. Owner: W8
// (compat).
//
// Skeleton (W0): fontConvert has its final signature and throws ERR.NOT_BUILT until W8 builds it, with its
// debugging property.

import { ERR, libraryError } from '../core/errors.js';
import { FONTS, hasMyanmarBlockChar } from '../core/input.js';
import { createTrace } from '../core/rules.js';
import { fontToUnicode, traceFontToUnicode } from '../engine/fontStages.js';
import { unicodeToZawgyi, traceUnicodeToZawgyi } from '../unicodeToZawgyi.js';
import { detectForRouting } from './fontDetect.js';
import { enter, resolveFont } from './input.js';
import { report, MESSAGES } from './globalOptions.js';

// A function, not an arrow: `this` is the receiver, whose debug flag 2.x reads (C16).
export function fontConvert(content, to, from) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/fontConvert.js fontConvert is not built yet');
}
