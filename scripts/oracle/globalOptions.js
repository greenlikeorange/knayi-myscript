var OPTIONS = {
  silent_mode: false,
  detector: {
    use_myanmartools: false,
    myanmartools_zg_threshold: [0.05, 0.95]
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

  if (
    !Array.isArray(myanmartools_zg_threshold)
    || typeof myanmartools_zg_threshold[0] !== 'number'
    || typeof myanmartools_zg_threshold[1] !== 'number'
  ) {
    console.error('myanmartools_zg_threshold must be [number, number]')
    myanmartools_zg_threshold = OPTIONS.detector.myanmartools_zg_threshold
  }

  return {
    use_myanmartools: use_myanmartools,
    myanmartools_zg_threshold: myanmartools_zg_threshold.slice()
  }
}

function setOptions (options = {}) {
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
