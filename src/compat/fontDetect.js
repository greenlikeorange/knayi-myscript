// compat: 2.x fontDetect on the core (DESIGN.md §5.1, C13, C14). Layer L4. Owner: W8 (compat).
//
// Skeleton (W0): the exports have their final names and signatures, and each function throws ERR.NOT_BUILT until
// W8 builds it.

import { ERR, libraryError } from '../core/errors.js';
import { hasMyanmarBlockChar } from '../core/input.js';
import { NO_OPTIONS } from '../core/options.js';
import { countEvidence, decide, scoreByZawgyiModel } from '../detect.js';
import { enter, cleanText, ON_TIE_ASSUME_ZAWGYI } from './input.js';
import { report, mergeDetectorOptions } from './globalOptions.js';
import { zawgyiModelLoader } from './zawgyiModel.js';

export function fontDetect(content, fallback_font_type, options = {}) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/fontDetect.js fontDetect is not built yet');
}

// compat never passes loader; tests do.
export function fontDetectCore(text, fallback, options, loader = zawgyiModelLoader) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/fontDetect.js fontDetectCore is not built yet');
}

// 2.x fontDetect(text), as the other functions call it on text with Myanmar.
export function detectForRouting(text) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/fontDetect.js detectForRouting is not built yet');
}
