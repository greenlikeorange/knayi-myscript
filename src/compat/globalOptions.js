// compat: the 2.x global option store, setGlobalOptions, and the silent-aware console writer (DESIGN.md §5.1,
// C2-C4, C25). Layer L4. Owner: W8 (compat).
//
// The store and the warning of zawgyiModel.js are compat's only module state, and this is the only file of src/
// that writes to the console. The writer looks console[level] up at each call, never at load, because a
// caller (the contract matrix, a test) may swap the console methods between calls.
//
// The option names and shapes are 2.x's (library/globalOptions.js), since setGlobalOptions is 2.x API:
// { silent_mode, detector: { use_myanmartools, myanmartools_zg_threshold, zawgyiDetector } }. The core reads the
// same values under its own names, as arguments (core/options.js DEFAULTS; the detector is the model of
// rules/detect.js scoreByZawgyiModel).

import { deepFreeze } from '../freeze.js';
import { DEFAULTS } from '../core/options.js';

// The console texts of §5.3, and the message of the font error, word for word as 2.x writes them (library/*.js).
export const MESSAGES = /* @__PURE__ */ deepFreeze({
  missingContent: (apiName) => 'Content must be specified on knayi.' + apiName + '.',
  noTarget: 'Convert target font must be specified on knayi.fontConvert.',
  unknownTarget: 'Convert library doesn\'t have this fontType.',
  unknownSource: (name) => 'Unknown source font ' + JSON.stringify(name) + ' on knayi.fontConvert; detecting it.',
  invalidFont: (apiName, name) => 'knayi.' + apiName + ' takes the font \'unicode\' or \'zawgyi\', not ' +
    JSON.stringify(name) + '.',
  winSourceOnly: 'knayi.fontConvert converts Win text to Unicode only.',
  unknownAdapter: (name) => 'Unknown adapter ' + JSON.stringify(name) + ' on knayi.fontDetect.',
  // The code at the start is API, like the code of an error knayi throws; the words after it may change (2.11).
  badThreshold: '[ERR_KNAYI_INVALID_THRESHOLD] myanmartools_zg_threshold must be two finite numbers in order.',
  badDetector: '[ERR_KNAYI_INVALID_DETECTOR] zawgyiDetector must have a getZawgyiProbability method.',
  // The myanmar-tools adapter with no detector, once (2.x detection.js missingMyanmarToolsMessage, for a copy of knayi
  // that loads no package).
  noDetector: 'myanmar-tools is not available in this environment; fontDetect used the rule scorer.'
});

// The store (2.x globalOptions.js OPTIONS), initialised from the core's defaults (C2).
const STORE = /* @__PURE__ */ createOptionStore();

function createOptionStore() {
  return {
    silent_mode: false,
    detector: {
      use_myanmartools: DEFAULTS.detector.useZawgyiModel,
      myanmartools_zg_threshold: DEFAULTS.detector.thresholds.slice(),
      zawgyiDetector: null
    }
  };
}

// 2.x setOptions (globalOptions.js, C3). undefined and null are no options: the call changes nothing (2.11,
// fb6594d). Otherwise each key counts when it is an own enumerable key of options, as Object.keys finds it.
// silent_mode is stored as given, and any truthy value is silent; detector goes through the merge, after
// silent_mode, so the merge's error follows the new setting. Returns undefined.
export function setGlobalOptions(options) {
  if (options == null) return;
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

// The stored detector options: { use_myanmartools, myanmartools_zg_threshold, zawgyiDetector }.
export function storedDetectorOptions() {
  return STORE.detector;
}

// The 2.x detector merge (globalOptions.js detector, C4), used by setGlobalOptions and by every fontDetect call:
// - undefined and null are no options; a key counts when incoming has it as an own property; a missing key comes
//   from the current store;
// - the threshold must be two finite numbers in order, [low, high], which may be equal (2.11, fb6594d). Otherwise
//   the threshold error goes to console.error, unless silent, and the stored threshold stays;
// - zawgyiDetector, the detector the myanmar-tools adapter calls (2.11, 840c8c5), is anything with a
//   getZawgyiProbability method, such as myanmar-tools' ZawgyiDetector; undefined and null are none. Any other value
//   keeps the stored detector, with the detector error unless silent, as for the threshold;
// - the result is a new object, with a copy of the threshold.
// Each key is read before either check, in 2.x's order.
export function mergeDetectorOptions(incoming) {
  const given = incoming || {};
  const useModel = hasOwn(given, 'use_myanmartools') ? given.use_myanmartools : STORE.detector.use_myanmartools;
  let thresholds = hasOwn(given, 'myanmartools_zg_threshold')
    ? given.myanmartools_zg_threshold
    : STORE.detector.myanmartools_zg_threshold;
  let detector = hasOwn(given, 'zawgyiDetector') ? given.zawgyiDetector : STORE.detector.zawgyiDetector;
  if (!isThresholdPair(thresholds)) {
    report('error', MESSAGES.badThreshold);
    thresholds = STORE.detector.myanmartools_zg_threshold;
  }
  if (detector != null && typeof detector.getZawgyiProbability !== 'function') {
    report('error', MESSAGES.badDetector);
    detector = STORE.detector.zawgyiDetector;
  }
  return { use_myanmartools: useModel, myanmartools_zg_threshold: thresholds.slice(), zawgyiDetector: detector };
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

// [low, high] as 2.11 checks it: an array whose first two items are finite numbers, the first no greater than the
// second. NaN, an infinity and a pair the wrong way round are refused.
function isThresholdPair(value) {
  return Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number' &&
    isFinite(value[0]) && isFinite(value[1]) && value[0] <= value[1];
}

// console[level](message) unless silent mode is on; returns whether it printed (C25). Every message of compat goes
// through it: since 2.11 the threshold error honours silent mode too (fb6594d).
export function report(level, message) {
  if (STORE.silent_mode) return false;
  console[level](message);
  return true;
}
