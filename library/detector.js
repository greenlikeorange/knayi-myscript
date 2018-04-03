const library = {};
const mmCharacterRange = /[\u1000-\u109F]/;
const whitespace = '[\\x20\\t\\r\\n\\f]';

const myanmartools = require('myanmar-tools');
const myanmartoolZawgyiDetector = new myanmartools.ZawgyiDetector();

var GLOBAL_OPTIONS = {
  use_myanmartools: false,
  myanmartools_zg_threshold: [0.05, 0.95]
};

/** DETECTION Libarary **/
library.detect = {
  unicode: [
    '\u103e', '\u103f', '\u100a\u103a', '\u1014\u103a', '\u1004\u103a', '\u1031\u1038', '\u1031\u102c',
    '\u103a\u1038', '\u1035', '[\u1050-\u1059]', '^([\u1000-\u1021]\u103c|[\u1000-\u1021]\u1031)'
  ],
  zawgyi : [
    '\u102c\u1039', '\u103a\u102c', whitespace+'(\u103b|\u1031|[\u107e-\u1084])[\u1000-\u1021]'
    ,'^(\u103b|\u1031|[\u107e-\u1084])[\u1000-\u1021]', '[\u1000-\u1021]\u1039[^\u1000-\u1021]', '\u1025\u1039'
    ,'\u1039\u1038' ,'[\u102b-\u1030\u1031\u103a\u1038](\u103b|[\u107e-\u1084])[\u1000-\u1021]' ,'\u1036\u102f'
    ,'[\u1000-\u1021]\u1039\u1031' , '\u1064','\u1039'+whitespace, '\u102c\u1031'
    ,'[\u102b-\u1030\u103a\u1038]\u1031[\u1000-\u1021]', '\u1031\u1031', '\u102f\u102d', '\u1039$'
  ]
};

// Populate Detect library as RegExps
Object.keys(library.detect).forEach((type) => {
  for (var i = 0; i < library.detect[type].length; i++) {
    library.detect[type][i] = new RegExp(library.detect[type][i], 'g');
  }
});

/**
 * Font Type Detector agent
 * @param content Text to make a detection
 * @param def Default return format;
 * @return unicode ? zawgyi
 */
function fontDetect(content, fallback_font_type, options = {}){
	if (!content)
		throw new Error('Content must be specified on knayi.fontDetect.');

	if (content === '')
		return content;

	if (!mmCharacterRange.test(content))
		return fallback_font_type || 'en';

	content = content.trim().replace(/\u200B/g, '');
	fallback_font_type = fallback_font_type || 'zawgyi';

  options = verifyOptions(options)

  if (options.use_myanmartools) {

    var myanmartools_zg_probability = myanmartoolZawgyiDetector.getZawgyiProbability(content);

    if (myanmartools_zg_probability < options.myanmartools_zg_threshold[0]) {
  		return 'unicode';
  	} else if (myanmartools_zg_probability > options.myanmartools_zg_threshold[1]) {
  		return 'zawgyi';
  	} else {
  		return fallback_font_type;
  	}

  } else {

    var match = {};

    for (var type in library.detect) {
  		match[type] = 0;

  		for (var i = 0; i < library.detect[type].length; i++) {
  			var rule = library.detect[type][i]
  			var m = content.match(rule);
  			match[type] += (m && m.length) || 0;
  		}
  	}

    if (match.unicode > match.zawgyi) {
  		return 'unicode';
  	} else if (match.unicode < match.zawgyi) {
  		return 'zawgyi';
  	} else {
  		return fallback_font_type;
  	}

  }
};

/**
 * set configuartion of using googlei18n/myanmar-tools
 */
function verifyOptions ({
  use_myanmartools = GLOBAL_OPTIONS.use_myanmartools,
  myanmartools_zg_threshold = [0.05, 0.95]
} = {}) {
  // Check types
  if (
    typeof myanmartools_zg_threshold[0] !== 'number'
    || typeof myanmartools_zg_threshold[1] !== 'number'
  ) {
    console.error('myanmartools_zg_threshold must be [number, number]')
    myanmartools_zg_threshold = GLOBAL_OPTIONS.myanmartools_zg_threshold
  }

  return {
    use_myanmartools: use_myanmartools,
    myanmartools_zg_threshold: myanmartools_zg_threshold
  }
}

fontDetect.__setOptions = function (options) {
  GLOBAL_OPTIONS = verifyOptions(options)
}

module.exports = fontDetect
