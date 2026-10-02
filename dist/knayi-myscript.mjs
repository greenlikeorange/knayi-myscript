var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// library/globalOptions.js
var require_globalOptions = __commonJS({
  "library/globalOptions.js"(exports, module) {
    var OPTIONS = {
      silent_mode: false,
      detector: {
        use_myanmartools: false,
        myanmartools_zg_threshold: [0.05, 0.95]
      }
    };
    function detector(incoming) {
      incoming = incoming || {};
      var use_myanmartools = Object.prototype.hasOwnProperty.call(incoming, "use_myanmartools") ? incoming.use_myanmartools : OPTIONS.detector.use_myanmartools;
      var myanmartools_zg_threshold = Object.prototype.hasOwnProperty.call(incoming, "myanmartools_zg_threshold") ? incoming.myanmartools_zg_threshold : OPTIONS.detector.myanmartools_zg_threshold;
      if (!Array.isArray(myanmartools_zg_threshold) || typeof myanmartools_zg_threshold[0] !== "number" || typeof myanmartools_zg_threshold[1] !== "number") {
        console.error("myanmartools_zg_threshold must be [number, number]");
        myanmartools_zg_threshold = OPTIONS.detector.myanmartools_zg_threshold;
      }
      return {
        use_myanmartools,
        myanmartools_zg_threshold: myanmartools_zg_threshold.slice()
      };
    }
    function setOptions(options = {}) {
      if (Object.keys(options).indexOf("silent_mode") !== -1) {
        OPTIONS.silent_mode = options.silent_mode;
      }
      if (Object.keys(options).indexOf("detector") !== -1) {
        OPTIONS.detector = detector(options.detector);
      }
    }
    module.exports = {
      isSilentMode: () => {
        return OPTIONS.silent_mode;
      },
      setOptions,
      detector
    };
  }
});

// library/contentGate.js
var require_contentGate = __commonJS({
  "library/contentGate.js"(exports, module) {
    var MYANMAR = /[\u1000-\u109F]/;
    var FONT_ALIASES = {
      unicode: "unicode",
      uni: "unicode",
      zawgyi: "zawgyi",
      zaw: "zawgyi"
    };
    function isMissing(content) {
      return !content;
    }
    function toText(content) {
      return Object.prototype.toString.call(content) === "[object String]" ? String(content) : content;
    }
    function hasMyanmar(content) {
      return typeof content === "string" && MYANMAR.test(content);
    }
    function resolveFont(fontType) {
      if (fontType == null || fontType === "") return null;
      if (Object.prototype.hasOwnProperty.call(FONT_ALIASES, fontType)) {
        return FONT_ALIASES[fontType];
      }
      return null;
    }
    function cleanText(content, trim) {
      var text = trim ? content.trim() : content;
      return text.replace(/[\u200B\u200C]/g, "");
    }
    module.exports = {
      isMissing,
      toText,
      hasMyanmar,
      resolveFont,
      cleanText
    };
  }
});

// library/detector.js
var require_detector = __commonJS({
  "library/detector.js"(exports, module) {
    var library = {};
    var whitespace = "[\\x20\\t\\r\\n\\f]";
    var globalOptions = require_globalOptions();
    var gate = require_contentGate();
    var myanmartoolZawgyiDetector = null;
    var myanmarToolsLoadAttempted = false;
    var myanmarToolsLoadError = null;
    function nodeRequire(id) {
      var proc = globalThis.process;
      if (!proc || !proc.versions || typeof proc.versions.node !== "string") return null;
      var req = null;
      try {
        req = module.require;
      } catch (e) {
        req = null;
      }
      if (typeof req === "function") return req.call(module, id);
      if (typeof proc.getBuiltinModule === "function") {
        var nodeModule = proc.getBuiltinModule("module");
        if (nodeModule && typeof nodeModule.createRequire === "function") {
          var from = typeof __filename === "string" ? __filename : proc.cwd() + "/package.json";
          return nodeModule.createRequire(from)(id);
        }
      }
      return null;
    }
    function loadMyanmarTools() {
      if (myanmarToolsLoadAttempted) return myanmartoolZawgyiDetector;
      myanmarToolsLoadAttempted = true;
      try {
        var loaded = nodeRequire("myanmar-tools");
        if (loaded && typeof loaded.ZawgyiDetector === "function") {
          myanmartoolZawgyiDetector = new loaded.ZawgyiDetector();
        } else if (loaded) {
          myanmarToolsLoadError = new Error("the package has no ZawgyiDetector export");
        }
      } catch (e) {
        myanmarToolsLoadError = e;
      }
      return myanmartoolZawgyiDetector;
    }
    function missingMyanmarToolsMessage() {
      var error = myanmarToolsLoadError;
      if (!error) {
        return "myanmar-tools is not available in this environment; fontDetect used the rule scorer.";
      }
      var firstLine = String(error.message).split("\n")[0];
      if (/MODULE_NOT_FOUND$/.test(String(error.code)) && firstLine.indexOf("'myanmar-tools'") !== -1) {
        return "myanmar-tools is not installed; fontDetect used the rule scorer. Install myanmar-tools@1.1.3 to use it.";
      }
      return "myanmar-tools could not be loaded (" + firstLine + "); fontDetect used the rule scorer. Install myanmar-tools@1.1.3.";
    }
    library.detect = {
      unicode: [
        "\u103E",
        "\u103F",
        "\u100A\u103A",
        "\u1014\u103A",
        "\u1004\u103A",
        "\u1031\u1038",
        "\u1031\u102C",
        "\u103A\u1038",
        "\u1035",
        "[\u1050-\u1059]",
        "^([\u1000-\u1021]\u103C|[\u1000-\u1021]\u1031)",
        // Zawgyi writes medial ra as U+103B before its consonant, so only count ya-pin when no consonant follows.
        // C + U+1039 + C is left out: it is a Pali stack in Unicode but asat + next syllable in Zawgyi.
        "[\u1000-\u1021]\u103B(?![\u1000-\u1021])"
      ],
      zawgyi: [
        "\u102C\u1039",
        "\u103A\u102C",
        whitespace + "(\u103B|\u1031|[\u107E-\u1084])[\u1000-\u1021]",
        "^(\u103B|\u1031|[\u107E-\u1084])[\u1000-\u1021]",
        "[\u1000-\u1021]\u1039[^\u1000-\u1021]",
        "\u1025\u1039",
        "\u1039\u1038",
        "[\u102B-\u1030\u1031\u103A\u1038](\u103B|[\u107E-\u1084])[\u1000-\u1021]",
        "\u1036\u102F",
        "[\u1000-\u1021]\u1039\u1031",
        "\u1064",
        "\u1039" + whitespace,
        "\u102C\u1031",
        "[\u102B-\u1030\u103A\u1038]\u1031[\u1000-\u1021]",
        "\u1031\u1031",
        "\u102F\u102D",
        "\u1039$"
      ]
    };
    Object.keys(library.detect).forEach((type) => {
      for (var i = 0; i < library.detect[type].length; i++) {
        library.detect[type][i] = new RegExp(library.detect[type][i], "g");
      }
    });
    function scoreWithRules(content, fallback) {
      var match = {};
      for (var type in library.detect) {
        match[type] = 0;
        for (var i = 0; i < library.detect[type].length; i++) {
          var found = content.match(library.detect[type][i]);
          match[type] += found && found.length || 0;
        }
      }
      if (match.unicode > match.zawgyi) return "unicode";
      if (match.unicode < match.zawgyi) return "zawgyi";
      return fallback;
    }
    function scoreWithMyanmarTools(content, fallback, threshold) {
      var probability = myanmartoolZawgyiDetector.getZawgyiProbability(content);
      if (probability < threshold[0]) return "unicode";
      if (probability > threshold[1]) return "zawgyi";
      return fallback;
    }
    var warnedMissingMyanmarTools = false;
    function chooseAdapter(options) {
      if (options.adapter === "rules" || options.adapter === "myanmartools") {
        return options.adapter;
      }
      if (options.use_myanmartools) return "myanmartools";
      return "rules";
    }
    function fontDetect2(content, fallback_font_type, options = {}) {
      content = gate.toText(content);
      if (gate.isMissing(content)) {
        if (!globalOptions.isSilentMode()) console.warn("Content must be specified on knayi.fontDetect.");
        return fallback_font_type || "en";
      }
      if (!gate.hasMyanmar(content))
        return fallback_font_type || "en";
      content = gate.cleanText(content, true);
      fallback_font_type = fallback_font_type || "zawgyi";
      var requestedAdapter = options.adapter;
      options = globalOptions.detector(options);
      if (requestedAdapter) options.adapter = requestedAdapter;
      if (chooseAdapter(options) === "rules") {
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
    }
    module.exports = fontDetect2;
  }
});

// library/syllable.js
var require_syllable = __commonJS({
  "library/syllable.js"(exports, module) {
    var convertRules = {
      unicode: {
        zawgyi: {
          oneTime: [
            [/([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u102f/g, "$1\u1033"],
            [/([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u1030/g, "$1\u1034"],
            [/([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u1037/g, "$1\u1094"],
            [/([\u1000-\u1021])\u103b([\u103d][\u103e]*)/g, "$1\u107D$2"],
            // ့ rules
            [/([\u1033\u1034])[\u1037\u1094]/g, "$1\u1095"],
            // [/\u107e([\u1000-\u1021])/],
            [/\u103c([\u1000-\u1021][\u102f\u1030\u1039\u103b\u103d\u103e])/g, "\u1082$1"],
            [/\u1004\u103a\u1039/g, "\u1064"],
            [/\u1064([\u1000-\u1021])/g, "$1\u1064"],
            // င်္ + ျ ြ ွ ှ ့ ု ူ + ိ ီ ံ
            [/\u1064([\u103b\u103c\u103d\u103e\u1037\u102f\u1030]*)\u102d/g, "\u108B$1"],
            [/\u1064([\u103b\u103c\u103d\u103e\u1037\u102f\u1030]*)\u102e/g, "\u108C$1"],
            [/\u1064([\u103b\u103c\u103d\u103e\u1037\u102f\u1030]*)\u1036/g, "\u108D$1"],
            // ြ first
            [/([\u1000-\u1021][^\u1000-\u1021]*)([\u103c\u1082])/g, "$2$1"],
            [/([\u1000-\u1021]\u1039)\u103c([\u1000-\u1021])/g, "\u103C$1$2"],
            // ေ first
            [/([\u1000-\u1021][^\u1000-\u1021]*)\u1031/g, "\u1031$1"],
            [/([\u1000-\u1021]\u1039)\u1031([\u1000-\u1021])/g, "\u1031$1$2"],
            [/\u103c\u1031/g, "\u1031\u103C"],
            // ြေ -> ေြ
            // နဉ + ​(ျ ြ ွ ှ ု ူ)
            [/\u1014([\u102f\u1030\u1039\u103b\u103d\u103e])/g, "\u108F$1"],
            [/\u103c\u1014/g, "\u103C\u108F"],
            // ြန
            [/\u1009([\u102f\u1030\u1039\u103b\u103d\u103e])/g, "\u106A$1"],
            // [/\u103c\u1009/g, "\u1081\u106a"], // ြဉ
            // \u101e\u107e\u1000\u1064\u1014\u1039
            [/\u104e\u1004\u103a\u1038/g, "\u104E"],
            [/\u102b\u103a/g, "\u105A"],
            [/\u103f/g, "\u1086"],
            [/\u1039\u101c/g, "\u1085"],
            [/\u1039\u1019/g, "\u107C"],
            [/\u1039\u1018/g, "\u107B"],
            [/\u1039\u1017/g, "\u107A"],
            [/\u1039\u1016/g, "\u1079"],
            [/\u1039\u1015/g, "\u1078"],
            [/\u1039\u1014/g, "\u1077"],
            [/\u1039\u1013/g, "\u1076"],
            [/\u1039\u1012/g, "\u1075"],
            [/\u1039\u1011/g, "\u1073"],
            [/\u1039\u1010/g, "\u1071"],
            [/\u1039\u100f/g, "\u1070"],
            [/\u100e\u1039\u100d/g, "\u106F"],
            [/\u100f\u1039\u100d/g, "\u1091"],
            [/\u100d\u1039\u100d/g, "\u106E"],
            [/\u100b\u1039\u100c/g, "\u1092"],
            [/\u1039\u100c/g, "\u106D"],
            [/\u100b\u1039\u100b/g, "\u1097"],
            [/\u1039\u100b/g, "\u106C"],
            // [/\u1009/g, "\u106a"],
            [/\u1039\u1005\u103b/g, "\u1069"],
            [/\u1039\u1007/g, "\u1068"],
            [/\u1039\u1006/g, "\u1066"],
            [/\u1039\u1005/g, "\u1065"],
            [/\u1039\u1003/g, "\u1063"],
            [/\u1039\u1002/g, "\u1062"],
            [/\u1039\u1001/g, "\u1061"],
            [/\u103d\u103e/g, "\u108A"],
            [/\u103e\u1030/g, "\u1089"],
            [/\u1039\u1000/g, "\u1060"],
            [/\u103e\u102f/g, "\u1088"],
            // [/\u1037/g, "\u1037"],
            [/\u103a/g, "\u1039"],
            [/\u103b/g, "\u103A"],
            [/\u103c/g, "\u103B"],
            [/\u103d/g, "\u103C"],
            [/\u103e/g, "\u103D"],
            [/([^\u1000\u1003\u1006\u100f\u1010\u1011\u1018\u1021\u101a\u101c\u101e\u101f])\u1071/g, "$1\u1072"]
          ],
          asLongAsMatch: [
            // [/([\u103b\u103c\u103d\u103e])\u1031/g, "\u1031$1"],
            [/\u103b([\u1000\u1003\u1006\u100f\u1010\u1011\u1018\u1021\u101a\u101c\u101e\u101f])/g, "\u107E$1"],
            [/\u103b([\u1000-\u1021\u106a\u108f](\u103c\u103d|\u108a|\u103c)[\u102d\u102e])/g, "\u1083$1"],
            [/\u107e([\u1000-\u1021](\u103c\u103d|\u108a|\u103c)[\u102d\u102e])/g, "\u1084$1"],
            [/\u103b([\u1000-\u1021\u106a\u108f][\u102d\u102e])/g, "\u107F$1"],
            [/\u107e([\u1000-\u1021][\u102d\u102e])/g, "\u1080$1"],
            [/\u103b([\u1000-\u1021\u106a\u108f][\u103c\u103e\u108a])/g, "\u1081$1"],
            [/\u107e([\u1000-\u1021][\u103c\u103e\u108a])/g, "\u1082$1"],
            [/\u103b\u1009/g, "\u1081\u106A"]
          ]
        }
      },
      zawgyi: {
        unicode: {
          oneTime: [
            // A zero not next to a digit or an operator is the letter wa typed as ၀. Inside numbers it stays a digit.
            [/(^|[^\u1040-\u1049\+\-\*\/])\u1040(?![\u1040-\u1049\+\-\*\/])/g, "$1\u101D"],
            [/\u103d|\u1087/g, "\u103E"],
            [/\u103c/g, "\u103D"],
            [/[\u103b\u107e-\u1084]/g, "\u103C"],
            [/[\u103a\u107d]/g, "\u103B"],
            [/\u1039/g, "\u103A"],
            [/[\u1094-\u1095]/g, "\u1037"],
            [/\s([\u1037])/g, "$1"],
            // remove space infront
            [/[\u107b\u1093]/g, "\u1039\u1018"],
            [/\u1033/g, "\u102F"],
            [/\u1034/g, "\u1030"],
            [/\u1088/g, "\u103E\u102F"],
            // [/\u1064/g, '\u1004\u103a\u1039'],
            [/\u1089/g, "\u103E\u1030"],
            [/\u108a/g, "\u103D\u103E"],
            [/\u1061/g, "\u1039\u1001"],
            [/\u108f/g, "\u1014"],
            [/\u1062/g, "\u1039\u1002"],
            [/\u1063/g, "\u1039\u1003"],
            [/\u1065/g, "\u1039\u1005"],
            [/[\u1066\u1067]/g, "\u1039\u1006"],
            [/\u1068/g, "\u1039\u1007"],
            [/\u1069/g, "\u1039\u1005\u103B"],
            [/\u106a/g, "\u1009"],
            [/\u106b/g, "\u100A"],
            [/\u106c/g, "\u1039\u100B"],
            [/\u106d/g, "\u1039\u100C"],
            [/\u106e/g, "\u100D\u1039\u100D"],
            [/\u106f/g, "\u100E\u1039\u100D"],
            [/\u1070/g, "\u1039\u100F"],
            [/[\u1071\u1072]/g, "\u1039\u1010"],
            [/[\u1073\u1074]/g, "\u1039\u1011"],
            [/\u1075/g, "\u1039\u1012"],
            [/\u1076/g, "\u1039\u1013"],
            [/\u1077/g, "\u1039\u1014"],
            [/\u1078/g, "\u1039\u1015"],
            [/\u1079/g, "\u1039\u1016"],
            [/\u1079/g, "\u1039\u1016"],
            [/\u107a/g, "\u1039\u1017"],
            [/\u107c/g, "\u1039\u1019"],
            [/\u1085/g, "\u1039\u101C"],
            [/\u1086/g, "\u103F"],
            [/\u1090/g, "\u101B"],
            [/\u1091/g, "\u100F\u1039\u100D"],
            [/\u1092/g, "\u100B\u1039\u100C"],
            [/\u1097/g, "\u100B\u1039\u100B"],
            [/\u1060/g, "\u1039\u1000"],
            [/\u105a/g, "\u102B\u103A"],
            [/\u104e/g, "\u104E\u1004\u103A\u1038"],
            [/\u1025\u103a/g, "\u1009\u103A"],
            // The tail is optional so each run of marks is read once (linear time); without a tail, $2 is empty and the run stays.
            // The third item is the character the rule needs; the rule is skipped when the text has none.
            [/([\u102b\u102c\u102d\u102e\u102f\u1030\u1031\u1032\u1036\u1037\u1038\u103b\u103c\u103d\u103e]+)(\u1039[\u1000-\u1021])?/g, "$2$1", "\u1039"],
            // eg: က + ျ ြ ွ ှ ံ ့ ိ ီ ု ူ +​ င်္ီ
            [/([\u1000-\u1021])([\u103b\u103c\u103d\u103e\u1037\u102f\u1030\u102d\u102e\u1036]*)\u108b/g, "$1\u1064$2\u102D"],
            [/([\u1000-\u1021])([\u103b\u103c\u103d\u103e\u1037\u102f\u1030\u102d\u102e\u1036]*)\u108c/g, "$1\u1064$2\u102E"],
            [/([\u1000-\u1021])([\u103b\u103c\u103d\u103e\u1037\u102f\u1030\u102d\u102e\u1036]*)\u108d/g, "$1\u1064$2\u1036"],
            [/\u108e/g, "\u102D\u1036"],
            [/\u103c([\u1000-\u1021])/g, "$1\u103C"],
            [/\u1031([\u1000-\u1021])/g, "$1\u1031"],
            [/([\u102b\u102c\u102d\u102e\u102f\u1030\u1031\u1032\u1036\u1037\u1038\u103b\u103c\u103d\u103e]+)(\u1064)?/g, "$2$1", "\u1064"],
            // [/([\u103b\u103c\u103d])(\u1064)/g, '$2$1'],
            [/\u1031(\u1064)/g, "$1\u1031"],
            [/([\u1000-\u1021])(\u1064)/g, "$2$1"],
            [/\u0020(\u1039[\u1000-\u1021])/g, "$1"],
            [/\u1064/g, "\u1004\u103A\u1039"]
          ],
          asLongAsMatch: [
            [/([\u102b\u102c\u102d\u102e\u1031\u102f\u1030\u1032\u1036\u1037\u1038])([\u103b\u103c\u103d\u103e])/g, "$2$1"],
            [/\u103d([\u103b\u103c])/g, "$1\u103D"],
            [/\u103e([\u103b\u103c\u103d])/g, "$1\u103E"],
            [/([\u102f\u1030])([\u102d\u102e])/g, "$2$1"],
            [/\u1036([\u102d\u102e\u102f\u1030])/g, "$1\u1036"],
            [/\u1037([\u1031\u102c\u102b\u102f\u1030\u1032])/g, "$1\u1037"],
            [/([\u1031\u102b\u102c])(\u1039[\u1000-\u1021])/g, "$2$1"],
            [/([\u102b\u102c])(\u1004\u103a\u1039)/g, "$2$1"]
          ]
        }
      }
    };
    var C = "\u1000-\u1021";
    var SHORT_C = "\u1001\u1002\u1004\u1005\u1007\u1008\u1009\u100E\u1012\u1013\u1014\u1015\u1016\u1017\u1019\u101B\u101D\u1020";
    var M = "\u103B\u103C\u103D\u103E";
    var V = "\u102B\u102C\u102D\u102E\u102F\u1030\u1031\u1032";
    var S = "\u1039";
    var A = "\u103A";
    var F = "\u1036\u1037\u1038";
    var MEDIALS = M;
    var VOWELS = V;
    var TONES = F;
    var ASAT = A;
    var VIRAMA = S;
    var KINZI = "\u1004" + ASAT + VIRAMA;
    var CONSONANT = new RegExp("[" + C + "]");
    var E = "\u1023\u1025\u1026\u1029\u104E";
    var WA_LONE = "\u101D";
    var NUMBER_ZERO = "\u1040";
    var rankingMap = {
      "\u103B": 1,
      "\u103C": 2,
      "\u103D": 3,
      "\u103E": 4,
      "\u1031": 5,
      "\u102B": 6,
      "\u102C": 7,
      "\u102D": 8,
      "\u102E": 9,
      "\u102F": 10,
      "\u1030": 11,
      "\u1032": 12,
      "\u103A": 13,
      "\u1036": 14,
      "\u1037": 15,
      "\u1038": 16
    };
    var brakePoint = new RegExp("([" + C + E + NUMBER_ZERO + "])([" + M + V + A + F + "]+)", "gm");
    function addRule(list, pattern, replacement) {
      list.push([new RegExp(pattern, "gm"), replacement]);
    }
    var extendedRules = [];
    var postExtendedRules = [];
    [
      ["\u1040", "\u101D"],
      ["\u1025\u102E", "\u1026"],
      ["\u1029\u1031\u102C\u103A", "\u102A"],
      ["\u102D\u102E", "\u102E"],
      ["\u102F\u1030", "\u1030"],
      ["\u1005\u103B", "\u1008"]
    ].forEach(function(pair) {
      addRule(extendedRules, pair[0], pair[1]);
    });
    addRule(postExtendedRules, "([" + SHORT_C + "])\\s(\u1039[\u1000-\u1021])", "$1$2");
    function uniquify(marks) {
      return Array.from(new Set(marks));
    }
    function applyReplacementRules(rules, content) {
      return rules.reduce(function(text, rule) {
        return text.replace(rule[0], rule[1]);
      }, content);
    }
    var NON_NUMBER_BEHIND = new RegExp(S + "$");
    var NON_NUMBER_AHEAD_SIGN = new RegExp("^[" + M + V + S + A + F + "]");
    var NON_NUMBER_AHEAD_C_SIGN = new RegExp("^[" + C + "][" + S + A + F + "]");
    function fixWaAndYa(text) {
      function rebuild(content2, splitter, num, char) {
        var isWa = char === WA_LONE;
        var parts = content2.split(splitter);
        var out = [parts[0]];
        var tail = parts[0].slice(-2);
        for (var i = 1; i < parts.length; i++) {
          var ahead = parts[i];
          var isNumber = isWa;
          if (NON_NUMBER_BEHIND.test(tail)) isNumber = false;
          if (!isWa) {
            if (/[၀-၉=+-/]\s?$/.test(tail) && /^\s|\s?[၀-၉=+-/]/.test(ahead)) isNumber = true;
            if (/[၀-၉]|\s?[=+-/]/.test(ahead)) isNumber = true;
          }
          if (NON_NUMBER_AHEAD_SIGN.test(ahead) || NON_NUMBER_AHEAD_C_SIGN.test(ahead)) isNumber = false;
          if (isWa && /^\s?လုံး/.test(ahead) && !/[၀-၉]\s?$/.test(tail)) isNumber = false;
          var letter = isNumber ? num : char;
          out.push(letter, ahead);
          tail = ahead.length >= 2 ? ahead.slice(-2) : (tail + letter + ahead).slice(-2);
        }
        return out.join("");
      }
      var content = String(text == null ? "" : text);
      return rebuild(rebuild(content, /၀|ဝ/, "\u1040", "\u101D"), /၇|ရ/, "\u1047", "\u101B");
    }
    function parseChunks(content) {
      var chunks = [];
      var re = brakePoint;
      re.lastIndex = 0;
      var last = 0;
      var match;
      while (match = re.exec(content)) {
        if (match.index > last) chunks.push(content.slice(last, match.index));
        chunks.push({ base: match[1], marks: match[2] });
        last = match.index + match[0].length;
      }
      if (last < content.length) chunks.push(content.slice(last));
      return chunks;
    }
    function serializeCanonical(chunk) {
      var marks = uniquify(chunk.marks).sort(function(a, b) {
        return rankingMap[a] - rankingMap[b];
      }).join("");
      return applyReplacementRules(extendedRules, chunk.base + marks);
    }
    function normalizeText(content) {
      var chunks = parseChunks(content);
      var result = chunks.map(function(chunk) {
        return typeof chunk === "string" ? chunk : serializeCanonical(chunk);
      }).join("");
      return fixWaAndYa(applyReplacementRules(postExtendedRules, result));
    }
    function isConsonant(ch) {
      return !!ch && CONSONANT.test(ch);
    }
    function parseUnicode(content) {
      var syllables = [];
      var i = 0;
      while (i < content.length) {
        var start = i;
        var kinzi = false;
        if (content.slice(i, i + KINZI.length) === KINZI && isConsonant(content[i + KINZI.length])) {
          kinzi = true;
          i += KINZI.length;
        }
        if (!isConsonant(content[i])) {
          syllables.push({ raw: content[start] });
          i = start + 1;
          continue;
        }
        var onset = "";
        while (isConsonant(content[i])) {
          onset += content[i];
          i += 1;
          if (content[i] === VIRAMA && isConsonant(content[i + 1])) {
            onset += VIRAMA + content[i + 1];
            i += 2;
          } else {
            break;
          }
        }
        var medials = "";
        var vowel = "";
        var marks = "";
        var coda = "";
        var tones = "";
        while (i < content.length) {
          var ch = content[i];
          if (MEDIALS.indexOf(ch) !== -1) {
            medials += ch;
            marks += ch;
            i += 1;
            continue;
          }
          if (VOWELS.indexOf(ch) !== -1) {
            vowel += ch;
            marks += ch;
            i += 1;
            continue;
          }
          if (TONES.indexOf(ch) !== -1) {
            tones += ch;
            marks += ch;
            i += 1;
            continue;
          }
          if (ch === ASAT) {
            marks += ch;
            i += 1;
            continue;
          }
          if (isConsonant(ch) && content[i + 1] === ASAT) {
            coda += ch + ASAT;
            i += 2;
            continue;
          }
          break;
        }
        syllables.push({
          kinzi,
          onset,
          medials,
          vowel,
          coda,
          tones,
          marks
        });
      }
      return syllables;
    }
    function serializeUnicode(syllables) {
      return syllables.map(function(syllable) {
        if (syllable.raw != null) return syllable.raw;
        return (syllable.kinzi ? KINZI : "") + syllable.onset + syllable.medials + syllable.vowel + syllable.coda + syllable.tones;
      }).join("");
    }
    function compileCollapse(chars) {
      return chars.split(" ").map(function(ch) {
        return [new RegExp("[" + ch + "]{2,}", "g"), ch];
      });
    }
    var COLLAPSE = {
      unicode: compileCollapse("\u102B \u102C \u102D \u102E \u102F \u1030 \u1031 \u1032 \u1036 \u1037 \u1038 \u103A \u103B \u103C \u103D \u103E \u1039"),
      zawgyi: compileCollapse("\u102B \u102C \u102D \u102E \u102F \u1030 \u1031 \u1032 \u1033 \u1034 \u1036 \u1037 \u1038 \u1039 \u103A \u103B \u103C \u103D \u105A \u1060 \u1061 \u1062 \u1063 \u1064 \u1065 \u1066 \u1067 \u1068 \u1069 \u106A \u106B \u106C \u106D \u1070 \u1071 \u1072 \u1073 \u1074 \u1075 \u1076 \u1077 \u1078 \u1079 \u107A \u107B \u107C \u107D \u107E \u107F \u1080 \u1081 \u1082 \u1083 \u1084 \u1085 \u1087 \u1088 \u1089 \u108A \u108B \u108C \u108D \u108E \u1093 \u1094 \u1095 \u1096")
    };
    function collapseMarks(content, fontType) {
      var rules = COLLAPSE[fontType] || COLLAPSE.unicode;
      for (var i = 0; i < rules.length; i++) {
        rules[i][0].lastIndex = 0;
        content = content.replace(rules[i][0], rules[i][1]);
      }
      return content;
    }
    var BREAK_RULES = {
      zawgyi: [
        [/([\u1000-\u1021\u1023-\u1027\u1029\u102a\u104c-\u104f\u1086\u108f-\u1092])/g, "\u200B$1"],
        [/([\u1031][\u103b\u107e-\u1084]|[\u1031\u103b\u107e-\u1084])/g, "\u200B$1"],
        [/([\u1031\u103b\u107e-\u1084])\u200B([\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090])/g, "$1$2"],
        [/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014])\u200B([\u1000-\u1021\u1031\u103b\u1025\u1029\u106A\u106B\u107e-\u1084\u1086\u108F\u1090])/g, "$1$2"],
        // A consonant with asat (U+1039 in Zawgyi) closes the syllable before it, also when a dot below or a visarga
        // was typed before the asat (င့္, ငး္).
        [/\u200B([\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090][\u1037\u1038\u1094\u1095]*\u1039)/g, "$1"],
        // Zawgyi writes kinzi (ၤ, or U+108B-U+108D with a vowel) after the consonant it sits on, but it is the
        // final nga of the syllable before, so that consonant and any ေ or medial ra typed before it stay there.
        // S'gaw Karen uses U+1064 as a tone mark, and its text is often detected as Zawgyi, so the rule is off for
        // text with a Karen vowel plus asat (ၢ် or ၣ်), which Zawgyi text practically never contains.
        [/\u200B([\u1031\u103b\u107e-\u1084]*[\u1000-\u1021][\u1064\u108b-\u108d])/g, "$1", /[\u1062\u1063]\u103a/],
        [/(\s|\n)\u200B([\u1000-\u1021\u1023-\u1027\u1029\u102a\u104c-\u104f\u1086\u108f-\u1092])/g, "$1$2"],
        // A bare consonant joins the next letter, as in Unicode. A consonant typed after ေ or a medial ra
        // (U+1031, U+103B, U+107E-U+1084) already has its marks, like ကြ in Unicode, so it ends its syllable:
        // the first branch matches it unchanged, and the second takes it whole after a bare consonant.
        [/([\u1031\u103b\u107e-\u1084]+[\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090])|([\u1000-\u1021])\u200B([\u1031\u103b\u107e-\u1084]+[\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090]|[\u1000-\u1021\u1031\u103b\u107e-\u1084])/g, "$1$2$3"]
      ],
      unicode: [
        [/(\u103A)(\u1037)/g, "$2$1"],
        [/([\u1000-\u1021\u1023-\u1027\u1029\u102a\u103f\u104c-\u104f])/g, "\u200B$1"],
        [/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014]|\u1039)\u200B([\u1000-\u1021])/g, "$1$2"],
        [/\u200B(\u1004\u103A\u1039\u1037)/g, "$1"],
        // A consonant with asat closes the syllable before it, also with the dot below that the first rule puts
        // before the asat (င့်). ဥ takes asat only when typed for ဉ, as in ညဥ့်, so it counts too.
        [/\u200B([\u1000-\u1021\u1025]\u1037?\u103A)/g, "$1"],
        [/(\s|\n)\u200B([\u1000-\u1021\u1023-\u1027\u1029\u102a\u103f\u104c-\u104f])/g, "$1$2"],
        [/([\u1000-\u1021])\u200B([\u1000-\u1021])/g, "$1$2"]
      ]
    };
    function breakParts(content, fontType) {
      var rules = BREAK_RULES[fontType];
      var text = content;
      for (var i = 0; i < rules.length; i++) {
        if (rules[i][2] && rules[i][2].test(content)) continue;
        rules[i][0].lastIndex = 0;
        text = text.replace(rules[i][0], rules[i][1]);
      }
      text = text.replace(/^\u200B/, "");
      return text.split(/[\u200B\u200C]/);
    }
    function joinParts(parts, breakpoint) {
      var breakChar = breakpoint && breakpoint !== "\u200B" ? breakpoint : "\u200B";
      return parts.join(breakChar);
    }
    function ruleMatches(rule, content) {
      var re = rule[0];
      re.lastIndex = 0;
      return re.test(content);
    }
    function replaceOnce(content, rule) {
      if (rule[2] && content.indexOf(rule[2]) === -1) return content;
      var re = rule[0];
      re.lastIndex = 0;
      return content.replace(re, rule[1]);
    }
    function replaceRepeated(content, rule) {
      var guard = 0;
      while (guard < 40) {
        guard += 1;
        if (!ruleMatches(rule, content)) break;
        var next = replaceOnce(content, rule);
        if (next === content) break;
        content = next;
      }
      return content;
    }
    function convertText(content, from, to, debug) {
      var refLib = convertRules[from][to];
      var logs = debug ? { to, from, matched_patterns: [], steps: [] } : null;
      function record(rule, current) {
        if (!logs) return;
        if (!ruleMatches(rule, current)) return;
        logs.matched_patterns.push(rule[0].source);
        logs.steps.push(current);
      }
      for (var i = 0; i < refLib.oneTime.length; i++) {
        var next = replaceOnce(content, refLib.oneTime[i]);
        if (next !== content) record(refLib.oneTime[i], content);
        content = next;
      }
      for (var j = 0; j < refLib.asLongAsMatch.length; j++) {
        record(refLib.asLongAsMatch[j], content);
        content = replaceRepeated(content, refLib.asLongAsMatch[j]);
      }
      if (logs) {
        logs.steps.push(content);
        return logs;
      }
      return content;
    }
    module.exports = {
      parseUnicode,
      serializeUnicode,
      normalizeText,
      collapseMarks,
      breakParts,
      joinParts,
      convertText
    };
  }
});

// library/spellingCheck.js
var require_spellingCheck = __commonJS({
  "library/spellingCheck.js"(exports, module) {
    var fontDetect2 = require_detector();
    var globalOptions = require_globalOptions();
    var gate = require_contentGate();
    var syllable = require_syllable();
    function spellingFix2(content, fontType) {
      content = gate.toText(content);
      if (gate.isMissing(content)) {
        if (!globalOptions.isSilentMode()) console.warn("Content must be specified on knayi.spellingFix.");
        return "";
      }
      if (!gate.hasMyanmar(content))
        return content;
      if (!fontType)
        fontType = fontDetect2(content);
      else
        fontType = gate.resolveFont(fontType) || fontType;
      content = gate.cleanText(content, true);
      return syllable.collapseMarks(content, fontType);
    }
    module.exports = spellingFix2;
  }
});

// library/converter.js
var require_converter = __commonJS({
  "library/converter.js"(exports, module) {
    var spellingFix2 = require_spellingCheck();
    var fontDetect2 = require_detector();
    var globalOptions = require_globalOptions();
    var gate = require_contentGate();
    var syllable = require_syllable();
    function fontConvert2(content, to, from) {
      content = gate.toText(content);
      if (gate.isMissing(content)) {
        if (!globalOptions.isSilentMode()) console.warn("Content must be specified on knayi.fontConvert.");
        return "";
      }
      if (!gate.hasMyanmar(content))
        return content;
      if (!to) {
        if (!globalOptions.isSilentMode()) console.error("Convert target font must be specified on knayi.fontConvert.");
        return content;
      }
      content = gate.cleanText(content, true);
      to = gate.resolveFont(to);
      from = gate.resolveFont(from);
      if (!to) {
        if (!globalOptions.isSilentMode()) console.error("Convert library dosen't have this fontType.");
        return content;
      } else if (!from) {
        from = fontDetect2(content);
      }
      if (to === from) {
        return content;
      }
      content = spellingFix2(content, from);
      return syllable.convertText(content, from, to, this && this.debug);
    }
    fontConvert2.debugging = function(param1, param2, param3) {
      return fontConvert2.apply({ debug: true }, [param1, param2, param3]);
    };
    module.exports = fontConvert2;
  }
});

// library/syllBreak.js
var require_syllBreak = __commonJS({
  "library/syllBreak.js"(exports, module) {
    var fontDetect2 = require_detector();
    var globalOptions = require_globalOptions();
    var gate = require_contentGate();
    var syllable = require_syllable();
    function syllBreak2(content, fontType, breakpoint) {
      content = gate.toText(content);
      if (gate.isMissing(content)) {
        if (!globalOptions.isSilentMode()) console.warn("Content must be specified on knayi.syllBreak.");
        return "";
      }
      if (!gate.hasMyanmar(content))
        return content;
      content = gate.cleanText(content, true);
      if (!fontType)
        fontType = fontDetect2(content);
      else
        fontType = gate.resolveFont(fontType) || fontType;
      return syllable.joinParts(syllable.breakParts(content, fontType), breakpoint);
    }
    module.exports = syllBreak2;
  }
});

// library/truncate.js
var require_truncate = __commonJS({
  "library/truncate.js"(exports, module) {
    var fontDetect2 = require_detector();
    var globalOptions = require_globalOptions();
    var gate = require_contentGate();
    var syllable = require_syllable();
    function truncate2(content, options) {
      options = options || {};
      var fontType = options.fontType;
      var length = options.length || 30;
      var omission = options.omission || "...";
      var absoulteLength = length - omission.length;
      content = gate.toText(content);
      if (content !== "" && gate.isMissing(content)) {
        if (!globalOptions.isSilentMode()) console.warn("Content must be specified on knayi.truncate.");
        return "";
      }
      if (typeof content !== "string")
        content = String(content);
      if (content === "" || !gate.hasMyanmar(content))
        return content.substr(0, absoulteLength) + omission;
      if (!fontType)
        fontType = fontDetect2(content);
      else
        fontType = gate.resolveFont(fontType) || fontType;
      var syllables = syllable.breakParts(gate.cleanText(content, true), fontType);
      return syllables.reduce(function(curr, syll) {
        var left = absoulteLength - curr.length;
        if (left > 0) {
          if (syll.length <= left) {
            curr += syll;
          } else {
            var spaceBreak = syll.split(/\s/);
            curr += spaceBreak.reduce(function(_curr, word) {
              if (word.length + 1 <= left - _curr.length) {
                _curr += word + " ";
              }
              return _curr;
            }, "");
          }
        }
        return curr;
      }, "").trim() + omission;
    }
    module.exports = truncate2;
  }
});

// library/normalization.js
var require_normalization = __commonJS({
  "library/normalization.js"(exports, module) {
    var globalOptions = require_globalOptions();
    var gate = require_contentGate();
    var syllable = require_syllable();
    function normalize2(content) {
      content = gate.toText(content);
      if (gate.isMissing(content)) {
        if (!globalOptions.isSilentMode()) console.warn("Content must be specified on knayi.normalize.");
        return "";
      }
      if (typeof content !== "string")
        return content;
      return syllable.normalizeText(gate.cleanText(content, false));
    }
    module.exports = normalize2;
  }
});

// main.js
var require_main = __commonJS({
  "main.js"(exports, module) {
    var globalOptions = require_globalOptions();
    var fontDetect2 = require_detector();
    var fontConvert2 = require_converter();
    var syllBreak2 = require_syllBreak();
    var spellingFix2 = require_spellingCheck();
    var truncate2 = require_truncate();
    var normalize2 = require_normalization();
    var version2 = "2.9.1";
    var setGlobalOptions2 = globalOptions.setOptions;
    module.exports = {
      version: version2,
      setGlobalOptions: setGlobalOptions2,
      fontDetect: fontDetect2,
      fontConvert: fontConvert2,
      syllBreak: syllBreak2,
      spellingFix: spellingFix2,
      truncate: truncate2,
      normalize: normalize2
    };
    Object.defineProperty(module.exports, "default", { value: module.exports });
  }
});

// esm-entry.js
var import_main = __toESM(require_main());
var { version, setGlobalOptions, fontDetect, fontConvert, syllBreak, spellingFix, truncate, normalize } = import_main.default;
var esm_entry_default = import_main.default;
export {
  esm_entry_default as default,
  fontConvert,
  fontDetect,
  normalize,
  setGlobalOptions,
  spellingFix,
  syllBreak,
  truncate,
  version
};
