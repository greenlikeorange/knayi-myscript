'use strict';

const library = {};
const whitespace = '[\\x20\\t\\r\\n\\f]';

const globalOptions = require('./globalOptions');
const gate = require('./contentGate');

var myanmartoolZawgyiDetector = null;
var myanmarToolsLoadAttempted = false;
var myanmarToolsLoadError = null;

// Loads a package the way main.js and the files in library/ load a dependency: with module.require, which Node and
// Bun resolve from knayi's own folder. Every other copy of knayi has no module.require and loads nothing by name:
// the builds in dist/, whose module object is esbuild's, and knayi bundled into an app. There the myanmar-tools
// adapter needs a detector passed as zawgyiDetector (refactor plan, decision 17); the builds no longer look for the
// package from the working directory or from their own file.
// Browsers inside the README floor may have no globalThis (Chrome before 71, Firefox before 65, Safari before 12.1,
// Edge before 79), so it is read only behind a typeof check. A bare `process` would make webpack 4 and browserify
// bundle a shim for it.
function nodeRequire(id) {
  var proc = typeof globalThis !== 'undefined' && globalThis.process;
  if (!proc || !proc.versions || typeof proc.versions.node !== 'string') return null;
  var req = null;
  try {
    req = module.require;
  } catch (e) {
    req = null;
  }
  return typeof req === 'function' ? req.call(module, id) : null;
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
// character in a class of one: V8 searches for such a literal many times more slowly (see library/syllableRules.js).
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

// The rule scorer. The evidence in a text for each encoding is the number of matches of its signatures (String#match
// with the g flag, so the matches of one signature do not overlap); the encoding is the one with more evidence, or
// 'unknown' when the two counts tie. detectEncoding returns this object as it is.
function countEvidence(content) {
  var evidence = { encoding: 'unknown', unicode: 0, zawgyi: 0 };

  for (var type in library.detect) {
    for (var i = 0; i < library.detect[type].length; i++) {
      var found = content.match(library.detect[type][i]);
      evidence[type] += (found && found.length) || 0;
    }
  }

  if (evidence.unicode > evidence.zawgyi) evidence.encoding = 'unicode';
  if (evidence.unicode < evidence.zawgyi) evidence.encoding = 'zawgyi';
  return evidence;
}

// fontDetect's answer for the rule scorer's evidence: the encoding it found, or the fallback on a tie.
function decide(evidence, fallback) {
  return evidence.encoding === 'unknown' ? fallback : evidence.encoding;
}

function scoreWithMyanmarTools(zawgyiDetector, content, fallback, threshold) {
  var probability = zawgyiDetector.getZawgyiProbability(content);

  if (probability < threshold[0]) return 'unicode';
  if (probability > threshold[1]) return 'zawgyi';
  return fallback;
}

// The text fontDetect and detectEncoding score: trimmed, and without U+200B and U+200C. null for missing content,
// which warns unless silent, for any other value that is not a string, and for text with no Myanmar letter.
function textToDetect(content, apiName) {
  content = gate.toText(content);
  if (gate.isMissing(content) && !globalOptions.isSilentMode()) {
    console.warn('Content must be specified on knayi.' + apiName + '.');
  }
  return gate.hasMyanmar(content) ? gate.cleanText(content, true) : null;
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
  content = textToDetect(content, 'fontDetect');
  if (content === null) return fallback_font_type || 'en';
  fallback_font_type = fallback_font_type || 'zawgyi';

  // undefined and null are no options; globalOptions.detector reads them as {}.
  var requestedAdapter = options && options.adapter;
  options = globalOptions.detector(options);

  if (chooseAdapter(requestedAdapter, options.use_myanmartools) === 'rules') {
    return decide(countEvidence(content), fallback_font_type);
  }

  // The detector passed as zawgyiDetector, for this call or stored, or else the package, which nodeRequire loads
  // in main.js under Node and Bun only.
  var zawgyiDetector = options.zawgyiDetector || loadMyanmarTools();
  if (!zawgyiDetector) {
    if (!globalOptions.isSilentMode() && !warnedMissingMyanmarTools) {
      console.warn(missingMyanmarToolsMessage());
      warnedMissingMyanmarTools = true;
    }
    return decide(countEvidence(content), fallback_font_type);
  }

  return scoreWithMyanmarTools(zawgyiDetector, content, fallback_font_type, options.myanmartools_zg_threshold);
};

// The rule scorer's evidence in the text, { encoding, unicode, zawgyi }; for missing content, a value that is not a
// string and text with no Myanmar letter, 'none' and two zeros. It scores with the rules whatever the detector
// options say, and reads one argument, so lines.map(knayi.detectEncoding) works. fontDetect with the rules reads the
// same evidence through its fallback (decide).
function detectEncoding(content) {
  content = textToDetect(content, 'detectEncoding');
  return content === null ? { encoding: 'none', unicode: 0, zawgyi: 0 } : countEvidence(content);
}

module.exports = {
  fontDetect,
  detectEncoding
};
