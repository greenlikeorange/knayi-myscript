// compat: the 2.x global option store, setGlobalOptions, and the silent-aware console writer (DESIGN.md §5.1,
// C2-C4, C25). Layer L4. Owner: W8 (compat).
//
// The store and the loader instance of zawgyiModel.js are compat's only module state, and this is the only file
// of src/ that writes to the console. Both writers look console[level] up at each call, never at load, because a
// caller (the contract matrix, a test) may swap the console methods between calls.
//
// The option names and shapes are 2.x's (library/globalOptions.js), since setGlobalOptions is 2.x API:
// { silent_mode, detector: { use_myanmartools, myanmartools_zg_threshold } }. The core reads the same values under
// its own names, as arguments (core/options.js DEFAULTS).

import { deepFreeze } from '../freeze.js';
import { DEFAULTS } from '../core/options.js';

// The console texts of §5.3, word for word as 2.x prints them (library/*.js). unknownTarget keeps 2.x's spelling:
// fixing it is a 2.x change, ported later (DESIGN.md §5.3, §8).
export const MESSAGES = /* @__PURE__ */ deepFreeze({
  missingContent: (apiName) => 'Content must be specified on knayi.' + apiName + '.',
  noTarget: 'Convert target font must be specified on knayi.fontConvert.',
  unknownTarget: 'Convert library dosen\'t have this fontType.',
  winSourceOnly: 'knayi.fontConvert converts Win text to Unicode only.',
  badThreshold: 'myanmartools_zg_threshold must be [number, number]'
});

// The store (globalOptions.js:1-7), initialised from the core's defaults (C2).
const STORE = /* @__PURE__ */ createOptionStore();

function createOptionStore() {
  return {
    silent_mode: false,
    detector: {
      use_myanmartools: DEFAULTS.detector.useZawgyiModel,
      myanmartools_zg_threshold: DEFAULTS.detector.thresholds.slice()
    }
  };
}

// 2.x setOptions (globalOptions.js:37-45, C3). Each key counts when it is an own enumerable key of options, as
// Object.keys finds it, so null throws a TypeError, as in 2.x. silent_mode is stored as given, and any truthy value
// is silent; detector goes through the merge. Returns undefined.
export function setGlobalOptions(options = {}) {
  if (hasEnumerableKey(options, 'silent_mode')) {
    STORE.silent_mode = options.silent_mode;
  }
  if (hasEnumerableKey(options, 'detector')) {
    STORE.detector = mergeDetectorOptions(options.detector);
  }
}

// 2.x reads Object.keys once per key it looks for, so it does here.
function hasEnumerableKey(options, key) {
  return Object.keys(options).indexOf(key) !== -1;
}

// The stored silent_mode, as given: callers test it for truth.
export function isSilentMode() {
  return STORE.silent_mode;
}

// The stored detector options: { use_myanmartools, myanmartools_zg_threshold }.
export function storedDetectorOptions() {
  return STORE.detector;
}

// The 2.x detector merge (globalOptions.js:13-35, C4), used by setGlobalOptions and by every fontDetect call:
// - a key counts when incoming has it as an own property; a missing key comes from the current store;
// - the threshold must be an array whose [0] and [1] are of type number (so NaN passes). Otherwise the threshold
//   message goes to console.error even in silent mode, and the stored threshold stays;
// - the result is a new object, with a copy of the threshold.
export function mergeDetectorOptions(incoming) {
  const given = incoming || {};
  const useModel = Object.prototype.hasOwnProperty.call(given, 'use_myanmartools')
    ? given.use_myanmartools
    : STORE.detector.use_myanmartools;
  let thresholds = Object.prototype.hasOwnProperty.call(given, 'myanmartools_zg_threshold')
    ? given.myanmartools_zg_threshold
    : STORE.detector.myanmartools_zg_threshold;
  if (!isThresholdPair(thresholds)) {
    reportAlways('error', MESSAGES.badThreshold);
    thresholds = STORE.detector.myanmartools_zg_threshold;
  }
  return { use_myanmartools: useModel, myanmartools_zg_threshold: thresholds.slice() };
}

// [number, number] as 2.x checks it: an array whose first two items are of type number.
function isThresholdPair(value) {
  return Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number';
}

// console[level](message) unless silent mode is on; returns whether it printed (C25).
export function report(level, message) {
  if (STORE.silent_mode) return false;
  console[level](message);
  return true;
}

// console[level](message), even in silent mode: 2.x prints the threshold message whatever silent_mode says (C4).
export function reportAlways(level, message) {
  console[level](message);
}
