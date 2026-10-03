// Option defaults and map-safe option reading (DESIGN.md §2.3). Layer L1. Owner: W1 (core).
//
// Skeleton (W0): the exports have their final names and signatures. The data is frozen and empty, and each
// function throws ERR.NOT_BUILT until W1 builds it.

import { deepFreeze } from '../freeze.js';
import { ERR, libraryError } from './errors.js';

// { detector: { useZawgyiModel: false, thresholds: [0.05, 0.95] }, truncate: { length: 30, omission: '...' },
//   breakSeparator: U+200B }: the 2.x defaults (globalOptions.js:1-7, truncate.js:9-10, syllable.js:273).
export const DEFAULTS = /* @__PURE__ */ deepFreeze({});

// The options of a call that passed none.
export const NO_OPTIONS = /* @__PURE__ */ deepFreeze({});

// value when it is a non-null object that is not an array, else NO_OPTIONS. This makes a call map-safe:
// lines.map(f) passes an index and an array, which are not options.
export function optionsObject(value) {
  throw libraryError(ERR.NOT_BUILT, 'src/core/options.js optionsObject is not built yet');
}
