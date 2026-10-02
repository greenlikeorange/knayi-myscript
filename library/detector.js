const library = {};
const whitespace = '[\\x20\\t\\r\\n\\f]';

const globalOptions = require('./globalOptions');
const gate = require('./contentGate');

let myanmartoolZawgyiDetector;
try {
  const myanmartools = require('myanmar-tools');
  myanmartoolZawgyiDetector = new myanmartools.ZawgyiDetector();
} catch (e) {

}

/** DETECTION Libarary **/
library.detect = {
  unicode: [
    '\u103e', '\u103f', '\u100a\u103a', '\u1014\u103a', '\u1004\u103a', '\u1031\u1038', '\u1031\u102c',
    '\u103a\u1038', '\u1035', '[\u1050-\u1059]', '^([\u1000-\u1021]\u103c|[\u1000-\u1021]\u1031)',
    '[\u1000-\u1021]\u103b', '[\u1000-\u1021]\u1039[\u1000-\u1021]'
  ],
  zawgyi : [
    '\u102c\u1039', '\u103a\u102c', whitespace+'(\u103b|\u1031|[\u107e-\u1084])[\u1000-\u1021]'
    ,'^(\u103b|\u1031|[\u107e-\u1084])[\u1000-\u1021]', '[\u1000-\u1021]\u1039[^\u1000-\u1021]', '\u1025\u1039'
    ,'\u1039\u1038' ,'[\u102b-\u1030\u1031\u103a\u1038](\u103b|[\u107e-\u1084])[\u1000-\u1021]' ,'\u1036\u102f'
    ,'[\u1000-\u1021]\u1039\u1031' , '\u1064','\u1039'+whitespace, '\u102c\u1031'
    ,'[\u102b-\u1030\u103a\u1038]\u1031[\u1000-\u1021]', '\u1031\u1031', '\u102f\u102d', '\u1039$'
  ]
};

// Populate Detect library as Regex
Object.keys(library.detect).forEach((type) => {
  for (var i = 0; i < library.detect[type].length; i++) {
    library.detect[type][i] = new RegExp(library.detect[type][i], 'g');
  }
});

function scoreWithRules(content, fallback) {
  var match = {};

  for (var type in library.detect) {
    match[type] = 0;

    for (var i = 0; i < library.detect[type].length; i++) {
      var found = content.match(library.detect[type][i]);
      match[type] += (found && found.length) || 0;
    }
  }

  if (match.unicode > match.zawgyi) return 'unicode';
  if (match.unicode < match.zawgyi) return 'zawgyi';
  return fallback;
}

function scoreWithMyanmarTools(content, fallback, threshold) {
  var probability = myanmartoolZawgyiDetector.getZawgyiProbability(content);

  if (probability < threshold[0]) return 'unicode';
  if (probability > threshold[1]) return 'zawgyi';
  return fallback;
}

var warnedMissingMyanmarTools = false;

function chooseAdapter(options) {
  if (options.adapter === 'rules' || options.adapter === 'myanmartools') {
    return options.adapter;
  }
  if (options.use_myanmartools) return 'myanmartools';
  return 'rules';
}

/**
 * Font Type Detector agent
 * @param content Text to make a detection
 * @param def Default return format;
 * @return unicode ? zawgyi
 */
function fontDetect(content, fallback_font_type, options = {}){
  if (gate.isMissing(content)) {
    if (!globalOptions.isSilentMode()) console.warn('Content must be specified on knayi.fontDetect.');
    return fallback_font_type || 'en';
  }

	if (!gate.hasMyanmar(content))
		return fallback_font_type || 'en';

	content = gate.cleanText(content, true);
	fallback_font_type = fallback_font_type || 'zawgyi';

  var requestedAdapter = options.adapter;
  options = globalOptions.detector(options);
  if (requestedAdapter) options.adapter = requestedAdapter;

  if (chooseAdapter(options) === 'rules') {
    return scoreWithRules(content, fallback_font_type);
  }

  if (!myanmartoolZawgyiDetector) {
    if (!globalOptions.isSilentMode() && !warnedMissingMyanmarTools) {
      console.warn('myanmar-tools adapter is missing; fontDetect used the rule scorer.');
      warnedMissingMyanmarTools = true;
    }
    return scoreWithRules(content, fallback_font_type);
  }

  return scoreWithMyanmarTools(content, fallback_font_type, options.myanmartools_zg_threshold);
};

module.exports = fontDetect
