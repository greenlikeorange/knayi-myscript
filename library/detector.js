const library = {};
const whitespace = '[\\x20\\t\\r\\n\\f]';

const globalOptions = require('./globalOptions');
const gate = require('./contentGate');

var myanmartoolZawgyiDetector = null;
var myanmarToolsLoadAttempted = false;
var myanmarToolsLoadError = null;

function nodeRequire(id) {
  var proc = globalThis.process;
  if (!proc || !proc.versions || typeof proc.versions.node !== 'string') return null;
  var req = null;
  try {
    req = module.require;
  } catch (e) {
    req = null;
  }
  if (typeof req === 'function') return req.call(module, id);
  if (typeof proc.getBuiltinModule === 'function') {
    var nodeModule = proc.getBuiltinModule('module');
    if (nodeModule && typeof nodeModule.createRequire === 'function') {
      var from = typeof __filename === 'string' ? __filename : proc.cwd() + '/package.json';
      return nodeModule.createRequire(from)(id);
    }
  }
  return null;
}

function loadMyanmarTools() {
  if (myanmarToolsLoadAttempted) return myanmartoolZawgyiDetector;
  myanmarToolsLoadAttempted = true;
  try {
    var loaded = nodeRequire('myanmar-tools');
    if (loaded && typeof loaded.ZawgyiDetector === 'function') {
      myanmartoolZawgyiDetector = new loaded.ZawgyiDetector();
    } else if (loaded) {
      myanmarToolsLoadError = new Error('the package has no ZawgyiDetector export');
    }
  } catch (e) {
    myanmarToolsLoadError = e;
  }
  return myanmartoolZawgyiDetector;
}

function missingMyanmarToolsMessage() {
  var error = myanmarToolsLoadError;
  if (!error) {
    return 'myanmar-tools is not available in this environment; fontDetect used the rule scorer.';
  }
  var firstLine = String(error.message).split('\n')[0];
  if (/MODULE_NOT_FOUND$/.test(String(error.code)) && firstLine.indexOf("'myanmar-tools'") !== -1) {
    return 'myanmar-tools is not installed; fontDetect used the rule scorer. Install myanmar-tools@1.1.3 to use it.';
  }
  // myanmar-tools 1.2.0 on npm ships without build_node/, so require() fails inside the package.
  return 'myanmar-tools could not be loaded (' + firstLine + '); fontDetect used the rule scorer. Install myanmar-tools@1.1.3.';
}

/** DETECTION Libarary **/
// A signature that is a plain literal starting in U+1000-U+1010, such as nya or nga with asat, has its first
// character in a class of one: V8 searches for such a literal many times more slowly (see library/syllable.js).
library.detect = {
  unicode: [
    '\u103e', '\u103f', '[\u100a]\u103a', '\u1014\u103a', '[\u1004]\u103a', '\u1031\u1038', '\u1031\u102c',
    '\u103a\u1038', '\u1035', '[\u1050-\u1059]', '^([\u1000-\u1021]\u103c|[\u1000-\u1021]\u1031)',
    // Zawgyi writes medial ra as U+103B before its consonant, so only count ya-pin when no consonant follows.
    // C + U+1039 + C is left out: it is a Pali stack in Unicode but asat + next syllable in Zawgyi.
    '[\u1000-\u1021]\u103b(?![\u1000-\u1021])'
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

// The adapter a call names, 'rules' or 'myanmartools', or else the one use_myanmartools picks. The adapter is read
// with gate.givenName, as a font name is: a string other than '', or a String object's string; any other value names
// no adapter. A name other than those two warns, unless silent.
function chooseAdapter(requested, use_myanmartools) {
  requested = gate.givenName(requested);
  if (requested === 'rules' || requested === 'myanmartools') return requested;
  if (requested && !globalOptions.isSilentMode()) {
    console.warn('Unknown adapter ' + JSON.stringify(requested) + ' on knayi.fontDetect.');
  }
  return use_myanmartools ? 'myanmartools' : 'rules';
}

/**
 * Font Type Detector agent
 * @param content Text to make a detection
 * @param def Default return format;
 * @return unicode ? zawgyi
 */
function fontDetect(content, fallback_font_type, options){
  // The fallback is a string other than '' (a String object counts as its string), returned as given. Any other
  // value, such as the index Array#map passes, is no fallback: the call returns 'en' or 'zawgyi', as if omitted.
  fallback_font_type = gate.givenName(fallback_font_type);
  content = gate.toText(content);
  if (gate.isMissing(content)) {
    if (!globalOptions.isSilentMode()) console.warn('Content must be specified on knayi.fontDetect.');
    return fallback_font_type || 'en';
  }

  if (!gate.hasMyanmar(content))
    return fallback_font_type || 'en';

  content = gate.cleanText(content, true);
  fallback_font_type = fallback_font_type || 'zawgyi';

  // undefined and null are no options; globalOptions.detector reads them as {}.
  var requestedAdapter = options && options.adapter;
  options = globalOptions.detector(options);

  if (chooseAdapter(requestedAdapter, options.use_myanmartools) === 'rules') {
    return scoreWithRules(content, fallback_font_type);
  }

  if (!loadMyanmarTools()) {
    if (!globalOptions.isSilentMode() && !warnedMissingMyanmarTools) {
      console.warn(missingMyanmarToolsMessage());
      warnedMissingMyanmarTools = true;
    }
    return scoreWithRules(content, fallback_font_type);
  }

  return scoreWithMyanmarTools(content, fallback_font_type, options.myanmartools_zg_threshold);
};

module.exports = fontDetect
