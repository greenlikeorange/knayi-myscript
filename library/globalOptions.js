'use strict';

var OPTIONS = {
  silent_mode: false,
  detector: {
    use_myanmartools: false,
    myanmartools_zg_threshold: [0.05, 0.95],
    zawgyiDetector: null
  }
}
// options

/**
 * set configuartion of using googlei18n/myanmar-tools
 */
function detector (incoming) {
  incoming = incoming || {};
  var use_myanmartools = Object.prototype.hasOwnProperty.call(incoming, 'use_myanmartools')
    ? incoming.use_myanmartools
    : OPTIONS.detector.use_myanmartools;
  var myanmartools_zg_threshold = Object.prototype.hasOwnProperty.call(incoming, 'myanmartools_zg_threshold')
    ? incoming.myanmartools_zg_threshold
    : OPTIONS.detector.myanmartools_zg_threshold;
  var zawgyiDetector = Object.prototype.hasOwnProperty.call(incoming, 'zawgyiDetector')
    ? incoming.zawgyiDetector
    : OPTIONS.detector.zawgyiDetector;

  // A threshold is two finite numbers in order. A probability below the first is Unicode, above the second Zawgyi,
  // and from the first to the second the fallback, so equal numbers leave only that one probability to the fallback.
  // Any other value keeps the stored pair, with an error unless silent. The code at the start of the error is API,
  // like the code of an error knayi throws; the words after it may change.
  if (
    !Array.isArray(myanmartools_zg_threshold)
    || typeof myanmartools_zg_threshold[0] !== 'number'
    || typeof myanmartools_zg_threshold[1] !== 'number'
    || !isFinite(myanmartools_zg_threshold[0])
    || !isFinite(myanmartools_zg_threshold[1])
    || myanmartools_zg_threshold[0] > myanmartools_zg_threshold[1]
  ) {
    if (!OPTIONS.silent_mode) {
      console.error('[ERR_KNAYI_INVALID_THRESHOLD] myanmartools_zg_threshold must be two finite numbers in order.')
    }
    myanmartools_zg_threshold = OPTIONS.detector.myanmartools_zg_threshold
  }

  // The detector the myanmar-tools adapter calls instead of loading the package: anything with a
  // getZawgyiProbability method, such as myanmar-tools' ZawgyiDetector. undefined and null are none. Any other
  // value keeps the stored detector, with an error unless silent, as for the threshold.
  if (zawgyiDetector != null && typeof zawgyiDetector.getZawgyiProbability !== 'function') {
    if (!OPTIONS.silent_mode) {
      console.error('[ERR_KNAYI_INVALID_DETECTOR] zawgyiDetector must have a getZawgyiProbability method.')
    }
    zawgyiDetector = OPTIONS.detector.zawgyiDetector
  }

  return {
    use_myanmartools: use_myanmartools,
    myanmartools_zg_threshold: myanmartools_zg_threshold.slice(),
    zawgyiDetector: zawgyiDetector
  }
}

// undefined and null are no options: the call changes nothing.
function setOptions (options) {
  if (options == null) return;

  if (Object.keys(options).indexOf('silent_mode') !== -1) {
    OPTIONS.silent_mode = options.silent_mode;
  }

  if (Object.keys(options).indexOf('detector') !== -1) {
    OPTIONS.detector = detector(options.detector);
  }
}

module.exports = {
  isSilentMode: () => { return OPTIONS.silent_mode },
  setOptions,
  detector
}
