// compat: the 2.x global option store, setGlobalOptions, and the silent-aware console writer (DESIGN.md §5.1,
// C2-C4, C25). Layer L4. Owner: W8 (compat).
//
// The store and the loader instance of zawgyiModel.js are compat's only module state, and this is the only file
// of src/ that writes to the console.
//
// Skeleton (W0): the exports have their final names and signatures. MESSAGES is frozen and empty, and each
// function throws ERR.NOT_BUILT until W8 builds it.

import { deepFreeze } from '../freeze.js';
import { ERR, libraryError } from '../core/errors.js';
import { DEFAULTS } from '../core/options.js';

// The console texts of §5.3.
export const MESSAGES = /* @__PURE__ */ deepFreeze({});

export function setGlobalOptions(options = {}) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/globalOptions.js setGlobalOptions is not built yet');
}

export function isSilentMode() {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/globalOptions.js isSilentMode is not built yet');
}

export function storedDetectorOptions() {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/globalOptions.js storedDetectorOptions is not built yet');
}

// The 2.x detector merge (globalOptions.js:13-35).
export function mergeDetectorOptions(options) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/globalOptions.js mergeDetectorOptions is not built yet');
}

// console[level](message) unless silent; returns whether it printed.
export function report(level, message) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/globalOptions.js report is not built yet');
}

// console[level](message), even in silent mode.
export function reportAlways(level, message) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/globalOptions.js reportAlways is not built yet');
}
