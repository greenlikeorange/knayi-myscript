// Option defaults and map-safe option reading (DESIGN.md §2.3, §4 rule 3). Layer L1. Owner: W1 (core).
//
// The core holds no option store: every option arrives as an argument of the call that uses it, and DEFAULTS
// fills in what the caller left out. Option objects are read, never written or kept. compat's option store
// (setGlobalOptions) starts from these values (DESIGN.md C2), and the 3.0 API reads them directly.

import { deepFreeze } from '../freeze.js';

// The 2.x defaults, in the 3.0 core's own names:
// - detector: globalOptions.js:1-7. use_myanmartools is useZawgyiModel, and myanmartools_zg_threshold is
//   thresholds: myanmar-tools' Zawgyi probability below thresholds[0] reads as Unicode, above thresholds[1] as
//   Zawgyi, and anything between falls back.
// - truncate: truncate.js:9-10. length counts UTF-16 units, the omission included.
// - breakSeparator: syllable.js:273, the zero-width space syllBreak writes between syllables.
export const DEFAULTS = /* @__PURE__ */ deepFreeze({
  detector: { useZawgyiModel: false, thresholds: [0.05, 0.95] },
  truncate: { length: 30, omission: '...' },
  breakSeparator: '\u200B'
});

// The options of a call that passed none.
export const NO_OPTIONS = /* @__PURE__ */ deepFreeze({});

// value when it is a non-null object that is not an array, else NO_OPTIONS. This makes a call map-safe:
// lines.map(f) passes an index and an array where the options go, and neither is options.
export function optionsObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : NO_OPTIONS;
}
