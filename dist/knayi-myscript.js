/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 2);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var whitespace = '[\\x20\\t\\r\\n\\f]';
var mmCharacterRange = /[\u1000-\u109F]/;
var library = {};

/** DETECTION Libarary **/
library.detect = {
	unicode: ['\u103E', '\u103F', '\u100A\u103A', '\u1014\u103A', '\u1004\u103A', '\u1031\u1038', '\u1031\u102C', '\u103A\u1038', '\u1035', '[\u1050-\u1059]', '^([\u1000-\u1021]\u103C|[\u1000-\u1021]\u1031)'],
	zawgyi: ['\u102C\u1039', '\u103A\u102C', whitespace + '(\u103B|\u1031|[\u107E-\u1084])[\u1000-\u1021]', '^(\u103B|\u1031|[\u107E-\u1084])[\u1000-\u1021]', '[\u1000-\u1021]\u1039[^\u1000-\u1021]', '\u1025\u1039', '\u1039\u1038', '[\u102B-\u1030\u1031\u103A\u1038](\u103B|[\u107E-\u1084])[\u1000-\u1021]', '\u1036\u102F', '[\u1000-\u1021]\u1039\u1031', '\u1064', '\u1039' + whitespace, '\u102C\u1031', '[\u102B-\u1030\u103A\u1038]\u1031[\u1000-\u1021]', '\u1031\u1031', '\u102F\u102D', '\u1039$']
};

// Populate Detect library as RegExps
Object.keys(library.detect).forEach(function (type) {
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
function fontDetect(content, def) {
	if (!content) throw new Error('Content must be specified on knayi.fontDetect');

	if (content === '') return content;

	if (!mmCharacterRange.test(content)) return def;

	content = content.trim().replace(/\u200B/g, '');
	def = def || 'zawgyi';

	var match = {};

	for (var type in library.detect) {
		match[type] = 0;

		for (var i = 0; i < library.detect[type].length; i++) {
			var rule = library.detect[type][i];
			var m = content.match(rule);
			match[type] += m && m.length || 0;
		}
	}

	if (match.unicode > match.zawgyi) {
		return 'unicode';
	} else if (match.unicode < match.zawgyi) {
		return 'zawgyi';
	} else {
		return def;
	}
};

module.exports = fontDetect;

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var fontDetect = __webpack_require__(0);

var mmCharacterRange = /[\u1000-\u109F]/;
var library = {};

/** Spelling Check Libarary **/
library.spellingFix = {
	unicode: "\u102B \u102C \u102D \u102E \u102F \u1030 \u1031 \u1032 \u1036 \u1037 \u1038 \u103A \u103B \u103C \u103D \u103E \u1039".split(" "),
	zawgyi: "\u102B \u102C \u102D \u102E \u102F \u1030 \u1031 \u1032 \u1033 \u1034 \u1036 \u1037 \u1038 \u1039 \u103A \u103B \u103C \u103D \u105A \u1060 \u1061 \u1062 \u1063 \u1064 \u1065 \u1066 \u1067 \u1068 \u1069 \u106A \u106B \u106C \u106D \u1070 \u1071 \u1072 \u1073 \u1074 \u1075 \u1076 \u1077 \u1078 \u1079 \u107A \u107B \u107C \u107D \u107E \u107F \u1080 \u1081 \u1082 \u1083 \u1084 \u1085 \u1087 \u1088 \u1089 \u108A \u108B \u108C \u108D \u108E \u1093 \u1094 \u1095 \u1096".split(" ")
};

// Populate Spelling Check
Object.keys(library.spellingFix).forEach(function (sys) {
	library.spellingFix[sys] = library.spellingFix[sys].map(function (exp) {
		return [new RegExp("[" + exp + "]{2,}", 'g'), exp];
	});
});

/**
* Spelling Check agent
* @param content Text to process
* @param fontType Type of font of content
* @return edited text
*/
function spellingFix(content, fontType) {
	if (!content) throw new Error('Content must be specified on knayi.fontConvert');

	if (content === '' || !mmCharacterRange.test(content)) return content;

	if (!fontType) fontType = fontDetect(content);

	content = content.trim().replace(/\u200B/g, '');

	switch (fontType) {
		case 'zawgyi':
			for (var i = 0; i < library.spellingFix.zawgyi.length; i++) {
				var rule = library.spellingFix.zawgyi[i];
				content = content.replace(rule[0], rule[1]);
			}
			return content;
		case 'unicode':
		default:
			for (var i = 0; i < library.spellingFix.unicode.length; i++) {
				var rule = library.spellingFix.unicode[i];
				content = content.replace(rule[0], rule[1]);
			}
			return content;
	}
};

module.exports = spellingFix;

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


(function (window) {
  var lib = __webpack_require__(3);
  window.kny = lib;
  window.knayi = lib;
})(window);

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var fontDetect = __webpack_require__(0);
var fontConvert = __webpack_require__(4);
var syllBreak = __webpack_require__(5);
var spellingFix = __webpack_require__(1);

module.exports = {
	fontDetect: fontDetect,
	fontConvert: fontConvert,
	syllBreak: syllBreak,
	spellingFix: spellingFix
};

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var spellingFix = __webpack_require__(1);
var fontDetect = __webpack_require__(0);

var fontTypes = {
  unicode: "unicode",
  uni: "unicode",
  zawgyi: "zawgyi",
  zaw: "zawgyi"
};
var mmCharacterRange = /[\u1000-\u109F]/;
var library = {};

/** Converting Libarary **/
library.convert = {
  unicode: {
    zawgyi: {
      oneTime: [[/([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u102f/g, '$1\u1033'], [/([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u1030/g, '$1\u1034'], [/([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u1037/g, '$1\u1094'], [/([\u1000-\u1021])\u103b([\u103d][\u103e]*)/g, '$1\u107D$2'], [/([\u102f\u1030])[\u1037\u1094]/g, '$1\u1095'], [/([\u1000-\u1021])\u103c/g, '\u103C$1'], [/([\u1000-\u1021][^\u1000-\u1021]*)\u1031/g, '\u1031$1'], [/\u103c\u1031/g, '\u1031\u103C'], [/\u1014\u103d/g, '\u108F\u103D'], [/\u104e\u1004\u103a\u1038/g, '\u104E'], [/\u102b\u103a/g, '\u105A'], [/\u103f/g, '\u1086'], [/\u1039\u101c/g, '\u1085'], [/\u1039\u1019/g, '\u107C'], [/\u1039\u1018/g, '\u107B'], [/\u1039\u1017/g, '\u107A'], [/\u1039\u1016/g, '\u1079'], [/\u1039\u1016/g, '\u1079'], [/\u1039\u1015/g, '\u1078'], [/\u1039\u1014/g, '\u1077'], [/\u1039\u1013/g, '\u1076'], [/\u1039\u1012/g, '\u1075'], [/\u1039\u1011/g, '\u1073'], [/\u1039\u1010/g, '\u1071'], [/\u1039\u100f/g, '\u1070'], [/\u100e\u1039\u100d/g, '\u106F'], [/\u100f\u1039\u100d/g, '\u1091'], [/\u100d\u1039\u100d/g, '\u106E'], [/\u1039\u100c/g, '\u106D'], [/\u1039\u100b/g, '\u106C'], [/\u1009/g, '\u106A'], [/\u1039\u1005\u103b/g, '\u1069'], [/\u1039\u1007/g, '\u1068'], [/\u1039\u1006/g, '\u1066'], [/\u1039\u1005/g, '\u1065'], [/\u1039\u1003/g, '\u1063'], [/\u100c/g, '\u1092'], [/\u1039\u1002/g, '\u1062'], [/\u1039\u1001/g, '\u1061'], [/\u103d\u103e/g, '\u108A'], [/\u103e\u1030/g, '\u1089'], [/\u1039\u1000/g, '\u1060'], [/\u100b\u1039\u100b/g, '\u1097'], [/\u1004\u103a\u1039/g, '\u1064'], [/\u103e\u102f/g, '\u1088'], [/\u1037/g, '\u1037'], [/\u103a/g, '\u1039'], [/\u103b/g, '\u103A'], [/\u103c/g, '\u103B'], [/\u103d/g, '\u103C'], [/\u103e/g, '\u103D']],
      asFoundAs: [[/([\u103b\u103c\u103d\u103e])\u1031/g, '\u1031$1'], [/\u103b([\u1000\u1003\u1006\u100f\u1010\u1011\u1018\u101a\u101c\u101e\u101f\u1021])/g, '\u107E$1'], [/\u103b([\u1000-\u1021](\u103c\u103d|\u108a|\u103c)[\u102d\u102e])/g, '\u1083$1'], [/\u107e([\u1000-\u1021](\u103c\u103d|\u108a|\u103c)[\u102d\u102e])/g, '\u1084$1'], [/\u103b([\u1000-\u1021][\u102d\u102e])/g, '\u107F$1'], [/\u107e([\u1000-\u1021][\u102d\u102e])/g, '\u1080$1'], [/\u103b([\u1000-\u1021][\u103c])/g, '\u1081$1'], [/\u107e([\u1000-\u1021][\u103c])/g, '\u1082$1']]
    }
  },
  zawgyi: {
    unicode: {
      oneTime: [[/([^\u1040-\u1049\+\-\*\/])?\u1040([^\u1040-\u1049\+\-\*\/])?/g, '$1\u101D$2'], [/\u103d|\u1087/g, '\u103E'], [/\u103c/g, '\u103D'], [/[\u103b\u107e-\u1084]/g, '\u103C'], [/[\u103a\u107d]/g, '\u103B'], [/\u1039/g, '\u103A'], [/[\u1094-\u1095]/g, '\u1037'], [/[\u107b\u1093]/g, '\u1039\u1018'], [/\u1033/g, '\u102F'], [/\u1034/g, '\u1030'], [/\u1088/g, '\u103E\u102F'],
      // [/\u1064/g, '\u1004\u103a\u1039'],
      [/\u1089/g, '\u103E\u1030'], [/\u108a/g, '\u103D\u103E'], [/\u1061/g, '\u1039\u1001'], [/\u108f/g, '\u1014'], [/\u1062/g, '\u1039\u1002'], [/\u1063/g, '\u1039\u1003'], [/\u1065/g, '\u1039\u1005'], [/\u1066/g, '\u1039\u1006'], [/\u1068/g, '\u1039\u1007'], [/\u1069/g, '\u1039\u1005\u103B'], [/\u106a/g, '\u1009'], [/\u106b/g, '\u100A'], [/\u106c/g, '\u1039\u100B'], [/\u106d/g, '\u1039\u100C'], [/\u106e/g, '\u100D\u1039\u100D'], [/\u106f/g, '\u100E\u1039\u100D'], [/\u1070/g, '\u1039\u100F'], [/\u1071/g, '\u1039\u1010'], [/\u1073/g, '\u1039\u1011'], [/\u1075/g, '\u1039\u1012'], [/\u1076/g, '\u1039\u1013'], [/\u1077/g, '\u1039\u1014'], [/\u1078/g, '\u1039\u1015'], [/\u1079/g, '\u1039\u1016'], [/\u1079/g, '\u1039\u1016'], [/\u107a/g, '\u1039\u1017'], [/\u107c/g, '\u1039\u1019'], [/\u1085/g, '\u1039\u101C'], [/\u1086/g, '\u103F'], [/\u1090/g, '\u101B'], [/\u1091/g, '\u100F\u1039\u100D'], [/\u1092/g, '\u100C'], [/\u1097/g, '\u100B\u1039\u100B'], [/\u1060/g, '\u1039\u1000'], [/\u105a/g, '\u102B\u103A'], [/\u104e/g, '\u104E\u1004\u103A\u1038'], [/\u1025\u103a/g, '\u1009\u103A'], [/([\u1000-\u1021])\u108b/g, '\u1064$1\u102D'], [/([\u1000-\u1021])\u108c/g, '\u1064$1\u102E'], [/([\u1000-\u1021])\u108d/g, '\u1064$1\u1036'], [/\u108e/g, '\u102D\u1036'], [/\u103c([\u1000-\u1021])/g, '$1\u103C'], [/\u1031([\u1000-\u1021])/g, '$1\u1031'], [/([\u103b\u103c\u103d])(\u1064)/g, '$2$1'], [/\u1031(\u1064)/g, '$1\u1031'], [/([\u1000-\u1021])(\u1064)/g, '$2$1'], [/\u0020(\u1039[\u1000-\u1021])/g, '$1'], [/\u1064/g, '\u1004\u103A\u1039']],
      asFoundAs: [[/([\u102b\u102c\u102d\u102e\u1031\u102f\u1030\u1032\u1036\u1037\u1038])([\u103b\u103c\u103d\u103e])/g, "$2$1"], [/\u103d([\u103b\u103c])/g, '$1\u103D'], [/\u103e([\u103b\u103c\u103d])/g, '$1\u103E'], [/([\u102f\u1030])([\u102d\u102e])/g, "$2$1"], [/\u1036([\u102d\u102e\u102f\u1030])/g, '$1\u1036'], [/\u1037([\u1031\u102c\u102b\u102f\u1030\u1032])/g, '$1\u1037'], [/([\u1031\u102b\u102c])(\u1039[\u1000-\u1021])/g, "$2$1"], [/([\u102b\u102c])(\u1004\u103a\u1039)/g, "$2$1"]]
    }
  }
};

/**
 * Font Converter agent
 * @param content Text that you want to convert
 * @param to Type of font to convert. Default: "unicode";
 * @param from Type of font of content text
 * @return converted text
 */
function fontConvert(content, to, from) {
  if (!content) throw new Error('Content must be specified on knayi.fontConvert');

  if (content === '' || !mmCharacterRange.test(content)) return content;

  if (!to) throw new Error('convertTo must be specified on knayi.fontConvert');

  content = content.trim().replace(/\u200B/g, '');
  to = fontTypes[to];
  from = fontTypes[from];

  if (!to) {
    console.error('Convert library dosen\'t this fontType to convert');
    return content;
  } else if (!from) {
    from = fontDetect(content);
  }

  if (to === from) {
    return content;
  }

  content = spellingFix(content, from);
  var refLib = library.convert[from][to];

  for (var i = 0; i < refLib.oneTime.length; i++) {
    var rule1 = refLib.oneTime[i];
    content = content.replace(rule1[0], rule1[1]);
  }

  for (var j = 0; j < refLib.asFoundAs.length; j++) {
    var rule2 = refLib.asFoundAs[j];
    while (rule2[0].test(content)) {
      content = content.replace(rule2[0], rule2[1]);
    }
  }

  return content;
};

module.exports = fontConvert;

/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var fontDetect = __webpack_require__(0);

var mmCharacterRange = /[\u1000-\u109F]/;
var library = {};

/** Syllable Libarary **/
library.syllable = {
  zawgyi: [[/([\u1000-\u1021\u1023-\u1027\u1029\u102a\u104c-\u104f\u1086\u108f-\u1092])/g, '\u200B$1'], [/([\u1031][\u103b\u107e-\u1084]|[\u1031\u103b\u107e-\u1084])/g, '\u200B$1'], [/([\u1031\u103b\u107e-\u1084])\u200B([\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090])/g, '$1$2'], [/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014])\u200B([\u1000-\u1021\u1031\u103b\u1025\u1029\u106A\u106B\u107e-\u1084\u1086\u108F\u1090])/g, '$1$2'], [/\u200B([\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090]\u1039)/g, '$1'], [/(\s|\n)\u200B([\u1000-\u1021\u1023-\u1027\u1029\u102a\u104c-\u104f\u1086\u108f-\u1092])/g, '$1$2'], [/([\u1000-\u1021])\u200B([\u1000-\u1021\u1031\u103b\u107e-\u1084])/g, '$1$2']],
  unicode: [[/(\u103A)(\u1037)/g, "$2$1"], [/([\u1000-\u1021\u1023-\u1027\u1029\u102a\u103f\u104c-\u104f])/g, '\u200B$1'], [/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014]|\u1039)\u200B([\u1000-\u1021])/g, "$1$2"], [/\u200B(\u1004\u103A\u1039)/g, "$1"], [/\u200B([\u1000-\u1021]\u103A)/g, "$1"], [/(\s|\n)\u200B([\u1000-\u1021\u1023-\u1027\u1029\u102a\u103f\u104c-\u104f])/g, "$1$2"], [/([\u1000-\u1021])\u200B([\u1000-\u1021])/g, "$1$2"]]
};

/**
* Syllable-Break agent
* @param content Text content
* @param language Language of content 'zawgyi' ? 'my'
* @param breakpoint Default is '\u200B'
* @return edited text
*/
function syllBreak(content, fontType, breakpoint) {
  if (!content) throw new Error('Content must be specified on knayi.fontConvert');

  if (content === '' || !mmCharacterRange.test(content)) return content;

  content = content.trim().replace(/\u200B/g, '');

  if (!fontType) fontType = fontDetect(content);

  var lib = library.syllable[fontType];

  for (var i = 0; i < lib.length; i++) {
    content = content.replace(lib[i][0], lib[i][1]);
  };

  content = content.replace(/^\u200B/, '');

  if (breakpoint && breakpoint !== '\u200B') return content.replace(/\u200B/g, breakpoint);

  return content;
};

module.exports = syllBreak;

/***/ })
/******/ ]);