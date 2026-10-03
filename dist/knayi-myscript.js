var knayi = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

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
        zaw: "zawgyi",
        win: "win"
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
      function fontDetect(content, fallback_font_type, options = {}) {
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
      module.exports = fontDetect;
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
              [/\u100d\u1039\u100e/g, "\u106F"],
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
        }
      };
      var C = "\u1000-\u1021";
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
          // before the asat (င့်) and with a visarga typed before the asat (ငး်). ဥ takes asat only when typed for ဉ,
          // as in ညဥ့်, so it counts too, but only right after a consonant or medial: after a vowel sign it starts
          // a syllable (Pa'o ထွူ|လဲ|ဥ်း).
          [/\u200B([\u1000-\u1021][\u1037\u1038]*\u103A)|([\u1000-\u1021\u103B-\u103E])\u200B(\u1025[\u1037\u1038]*\u103A)/g, "$1$2$3"],
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
        collapseMarks,
        breakParts,
        joinParts,
        convertText
      };
    }
  });

  // library/typingFixes.js
  var require_typingFixes = __commonJS({
    "library/typingFixes.js"(exports, module) {
      var ZERO = "\u1040";
      var SEVEN = "\u1047";
      var WA = "\u101D";
      var RA = "\u101B";
      var VISARGA = "\u1038";
      var TYPOS = [
        [/\u102D\u102E|\u102E\u102D/g, "\u102E"],
        // i with ii is ii
        [/\u102F\u1030|\u1030\u102F/g, "\u1030"],
        // u with uu is uu
        [/\u1029\u1031\u102C\u103A/g, "\u102A"],
        // o with e, aa and asat is au (UTN #11)
        [/(^|[^\u1040-\u1049])\u1044(?=\u1004\u103A\u1038)/g, "$1\u104E"]
        // the digit four typed for lagaung
      ];
      var MARKS = "\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062\u1067\u1068\u1071-\u1074\u1082-\u1086\u109C\u109D\uA9E5";
      var TONES = "\u1063\u1064\u1069-\u106D\u1087-\u108D\u108F\u109A\u109B\uAA7B-\uAA7D";
      var CONSONANTS = "\u1000-\u1021\u103F\u1050\u1051\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\uA9E0-\uA9E4\uA9E7-\uA9EF\uA9FA-\uA9FE\uAA60-\uAA76\uAA7A\uAA7E\uAA7F";
      var MARK = new RegExp("[" + MARKS + "]");
      var TONE = new RegExp("[" + TONES + "]");
      var CONSONANT = new RegExp("[" + CONSONANTS + "]");
      var WORD_CHAR = /[\u1000-\u103F\u104C-\u108F\u109A-\u109F\uA9E0-\uA9EF\uA9FA-\uA9FE\uAA60-\uAA7F]/;
      var ANY_DIGIT = /[\u1040-\u1049\u1090-\u1099\uA9F0-\uA9F9]/;
      function isDigit(ch) {
        return ch >= "\u1040" && ch <= "\u1049";
      }
      function isMark(ch) {
        return MARK.test(ch);
      }
      function isConsonant(ch) {
        return CONSONANT.test(ch);
      }
      function isWordChar(ch) {
        return WORD_CHAR.test(ch);
      }
      function isSeparator(ch) {
        return ch === "." || ch === ",";
      }
      function startsClosedSyllable(text, i) {
        if (!isConsonant(text.charAt(i + 1))) return false;
        var j = i + 2;
        while (text.charAt(j) === "\u1037" || text.charAt(j) === VISARGA) j++;
        return text.charAt(j) === "\u103A" || text.charAt(j) === "\u1039";
      }
      function nextToDigit(text, i) {
        return ANY_DIGIT.test(text.charAt(i - 1)) || ANY_DIGIT.test(text.charAt(i + 1)) || isSeparator(text.charAt(i - 1)) && ANY_DIGIT.test(text.charAt(i - 2)) || isSeparator(text.charAt(i + 1)) && ANY_DIGIT.test(text.charAt(i + 2));
      }
      var BARE = "[\u101D\u101B](?![" + TONES + "]*[" + MARKS + "]|[" + CONSONANTS + "][\u1037\u1038]*[\u103A\u1039])";
      var PART = "(?:[\u1040-\u1049]|" + BARE + ")";
      var RUN = new RegExp(PART + "(?:[.,]?" + PART + ")*", "g");
      var HAS_DIGIT = /[\u1040-\u1049]/;
      function lookAlikes(text) {
        text = text.replace(/[\u1040\u1047]/g, function(ch, i) {
          var j = i + 1;
          while (TONE.test(text.charAt(j))) j++;
          var next = text.charAt(j);
          var letter = isMark(next) && next !== VISARGA || startsClosedSyllable(text, i) || ch === ZERO && isWordChar(text.charAt(i - 1)) && !nextToDigit(text, i);
          return letter ? ch === ZERO ? WA : RA : ch;
        });
        return text.replace(RUN, function(run, start) {
          if (!HAS_DIGIT.test(run)) return run;
          var glued = isWordChar(text.charAt(start - 1));
          var after = text.charAt(start + run.length);
          var out = "";
          for (var k = 0; k < run.length; k++) {
            var c = run.charAt(k);
            if (isDigit(c)) glued = false;
            else if (!glued && c === WA) c = ZERO;
            else if (!glued && c === RA && (k + 1 < run.length || !isWordChar(after))) c = SEVEN;
            out += c;
          }
          return out;
        });
      }
      function fixTypos(text) {
        for (var t = 0; t < TYPOS.length; t++) {
          text = text.replace(TYPOS[t][0], TYPOS[t][1]);
        }
        return text;
      }
      module.exports = {
        lookAlikes,
        typos: fixTypos
      };
    }
  });

  // library/storageOrder.js
  var require_storageOrder = __commonJS({
    "library/storageOrder.js"(exports, module) {
      var typingFixes = require_typingFixes();
      var BASE = "base";
      var PRE = "pre";
      var MARK = "mark";
      var STACK = "stack";
      var KINZI = "kinzi";
      var TEXT = "text";
      var MARK_ORDER = [
        "\u103B",
        // medial ya
        "\u103C",
        // medial ra
        "\u103D",
        // medial wa
        "\u103E",
        // medial ha
        "\u1031",
        // e
        "\u102D\u102E",
        // i, ii
        "\u102F\u1030",
        // lower vowels
        "\u102B\u102C",
        // aa
        "\u1032\u1036",
        // ai and anusvara: after a lower vowel or aa, as Mon and Pa'o write them (UTN #11)
        "\u1037",
        // dot below
        "\u103A",
        // asat
        "\u1038"
        // visarga
      ];
      var LAST_MEDIAL = 3;
      var LOWER_RANK = 6;
      var AI_ANUSVARA = 8;
      var FIRST_VOWEL = 5;
      var ASAT = "\u103A";
      var VIRAMA = "\u1039";
      var VISARGA = "\u1038";
      var AA = "\u102B\u102C";
      var AA_TALL = "\u102B";
      var AA_SHORT = "\u102C";
      var ANUSVARA = "\u1036";
      var LOWER_VOWELS = "\u102F\u1030";
      var E_AA = "\u1031\u102B\u102C";
      var I = "\u102D\u102E";
      var DOT_BELOW = "\u1037";
      var MEDIALS = "\u103B\u103C\u103D\u103E";
      var MEDIAL_YA = "\u103B";
      var MEDIAL_HA = "\u103E";
      var CA = "\u1005";
      var JHA = "\u1008";
      var U = "\u1025";
      var NYA = "\u1009";
      var SEVEN = "\u1047";
      var RA = "\u101B";
      var DIGIT = /[\u1040-\u1049]/;
      var NEXT_TO_ZERO_IN_NUMBER = /[\u1040-\u1049+\-*\/]/;
      var DECIMAL_POINT = /[.,]/;
      var RANKS = [];
      var RANK = {};
      MARK_ORDER.forEach(function(group, index) {
        for (var i = 0; i < group.length; i++) RANK[group[i]] = index;
      });
      function rank(mark) {
        var index = RANK[mark];
        return index === void 0 ? MARK_ORDER.length : index;
      }
      function hasAny(marks, set, end) {
        var stop = end === void 0 ? marks.length : end;
        for (var i = 0; i < stop; i++) {
          if (set.indexOf(marks[i]) >= 0) return true;
        }
        return false;
      }
      function isMyanmarLetter(code) {
        return code >= 4096 && code <= 4138 || code === 4159 || code >= 4172 && code <= 4175;
      }
      function isSpace(code) {
        return code === 32 || code === 160;
      }
      function isZeroWidth(code) {
        return code === 8203 || code === 8204 || code === 8205 || code === 8288 || code === 65279;
      }
      function order(syllable) {
        var base = syllable.base;
        var stack = syllable.stack;
        if (!syllable.marks.length && !stack) return syllable.kinzi + base;
        var stacked = stack !== "" || base.indexOf(VIRAMA) > 0;
        var marks = [];
        for (var m = 0; m < syllable.marks.length; m++) {
          if (marks.indexOf(syllable.marks[m]) < 0) marks.push(syllable.marks[m]);
        }
        var early = false;
        var afterMedials = false;
        var asat = marks.indexOf(ASAT);
        var hasAa = hasAny(marks, AA);
        if (asat >= 0) {
          var dotBelow = marks.indexOf(DOT_BELOW) >= 0;
          var slip = !hasAa && (hasAny(marks, I) || stacked && !dotBelow);
          var last = dotBelow || hasAny(marks, E_AA, asat) || hasAa && !hasAny(marks, MEDIALS);
          if (slip) {
            marks.splice(asat, 1);
          } else if (!last) {
            marks.splice(asat, 1);
            if (marks.indexOf(MEDIAL_HA) >= 0) afterMedials = true;
            else early = true;
          }
        }
        var ya = marks.indexOf(MEDIAL_YA);
        if (ya >= 0 && stack.slice(-1) === CA) {
          stack = stack.slice(0, -1) + JHA;
          marks.splice(ya, 1);
        } else if (ya >= 0 && base === CA && !stack) {
          base = JHA;
          marks.splice(ya, 1);
        }
        if (base === U && !syllable.keepU && (stacked || early || afterMedials || marks.indexOf(ASAT) >= 0 || hasAa)) {
          base = NYA;
        }
        var marksBesidesVisarga = marks.length - (marks.indexOf(VISARGA) >= 0 ? 1 : 0);
        if (base === SEVEN && (early || afterMedials || marksBesidesVisarga > 0)) {
          base = RA;
        }
        var lower = hasAny(marks, LOWER_VOWELS);
        var ranks = RANKS;
        for (var r = 0; r < marks.length; r++) {
          var markRank = rank(marks[r]);
          if (markRank === AI_ANUSVARA && !lower) {
            var aa = marks.indexOf(AA_SHORT) >= 0 ? marks.indexOf(AA_SHORT) : marks.indexOf(AA_TALL);
            var beforeAa = aa > r && !(marks[r] === ANUSVARA && marks[aa] === AA_TALL);
            if (beforeAa) markRank = LOWER_RANK;
          }
          ranks[r] = markRank;
        }
        for (var n = 1; n < marks.length; n++) {
          var mark = marks[n];
          var markRankN = ranks[n];
          var at = n - 1;
          while (at >= 0 && ranks[at] > markRankN) {
            marks[at + 1] = marks[at];
            ranks[at + 1] = ranks[at];
            at--;
          }
          marks[at + 1] = mark;
          ranks[at + 1] = markRankN;
        }
        var sorted = marks;
        if (afterMedials) {
          var medials = 0;
          while (medials < sorted.length && rank(sorted[medials]) <= LAST_MEDIAL) medials++;
          sorted.splice(medials, 0, ASAT);
        }
        return syllable.kinzi + base + stack + (early ? ASAT : "") + sorted.join("");
      }
      function glyph(role, text, extra) {
        return {
          role,
          text,
          extra,
          // The characters that join the syllable's marks (for e and medial ra, the next syllable's).
          marks: ((role === MARK || role === PRE ? text : "") + extra).split("")
        };
      }
      function font(table, sequences) {
        var glyphs = /* @__PURE__ */ new Map();
        Object.keys(table).forEach(function(ch) {
          var entry = table[ch];
          glyphs.set(ch.charCodeAt(0), glyph(entry[0], entry[1], entry[2] || ""));
        });
        for (var code = 4096; code <= 4175; code++) {
          if (!glyphs.has(code) && isMyanmarLetter(code)) glyphs.set(code, glyph(BASE, String.fromCharCode(code), ""));
        }
        return { glyphs, sequences };
      }
      function arrange(content, glyphs) {
        var out = "";
        var syllable = null;
        var pending = [];
        function close() {
          if (!syllable) return;
          out += order(syllable) + syllable.after;
          syllable = null;
        }
        function write(text) {
          close();
          out += pending.join("") + text;
          pending = [];
        }
        for (var i = 0; i < content.length; i++) {
          var code = content.charCodeAt(i);
          var zeroWidth = isZeroWidth(code);
          if (syllable && (zeroWidth || isSpace(code))) {
            syllable.after += content.charAt(i);
            if (zeroWidth) syllable.kept += content.charAt(i);
            continue;
          }
          if (zeroWidth) {
            out += content.charAt(i);
            continue;
          }
          var g = glyphs.get(code);
          if (g === void 0) {
            write(content.charAt(i));
          } else if (g.role === BASE) {
            close();
            syllable = { kinzi: "", base: g.text, stack: "", marks: pending, after: "", kept: "" };
            pending = [];
          } else if (g.role === PRE) {
            close();
            for (var p = 0; p < g.marks.length; p++) pending.push(g.marks[p]);
          } else if (syllable && g.role !== TEXT) {
            syllable.after = syllable.kept;
            if (g.role === STACK) syllable.stack += g.text;
            if (g.role === KINZI) syllable.kinzi = g.text;
            for (var m = 0; m < g.marks.length; m++) syllable.marks.push(g.marks[m]);
          } else {
            write(g.text + g.extra);
          }
        }
        close();
        return out + pending.join("");
      }
      var MYANMAR_CHARS = [];
      for (c = 4096; c <= 4255; c++) MYANMAR_CHARS.push(String.fromCharCode(c));
      var c;
      function isConsonant(code) {
        return code >= 4096 && code <= 4129;
      }
      function isUnicodeMark(code) {
        return code >= 4139 && code <= 4146 || code >= 4150 && code <= 4152 || code >= 4154 && code <= 4158;
      }
      function isKinziAt(content, i) {
        var code = content.charCodeAt(i);
        return (code === 4100 || code === 4123) && content.charCodeAt(i + 1) === 4154 && content.charCodeAt(i + 2) === 4153 && isConsonant(content.charCodeAt(i + 3));
      }
      function isDigit(code) {
        return code >= 4160 && code <= 4169;
      }
      function isOtherMyanmar(code) {
        var inBlocks = code >= 4096 && code <= 4255 || code >= 43488 && code <= 43519 || code >= 43616 && code <= 43647;
        return inBlocks && !isMyanmarLetter(code) && !isDigit(code) && !isUnicodeMark(code) && code !== 4153 && code !== 4170 && code !== 4171;
      }
      function isTypedFirst(code) {
        return code === 4145 || code === 4156;
      }
      var HERE = "here";
      var NEXT = "next";
      var ALONE = "alone";
      function arrangeUnicode(content) {
        var out = "";
        var syllable = null;
        var pending = [];
        var runEnd = 0;
        function close() {
          if (!syllable) return;
          out += order(syllable) + syllable.after;
          syllable = null;
        }
        function start(kinzi, base, keepU) {
          close();
          syllable = { kinzi, base, stack: "", marks: pending, after: "", kept: "", keepU };
          pending = [];
        }
        function write(text) {
          close();
          out += pending.join("") + text;
          pending = [];
        }
        function goesOn(code2) {
          if (syllable.after === syllable.kept) return true;
          return !isTypedFirst(code2) && !isDigit(syllable.base.charCodeAt(0));
        }
        function placeTypedFirst(i2) {
          var code2 = content.charCodeAt(i2);
          if (i2 >= runEnd) {
            runEnd = i2 + 1;
            while (isTypedFirst(content.charCodeAt(runEnd))) runEnd++;
          }
          var after = content.charCodeAt(runEnd);
          if (!syllable && isOtherMyanmar(content.charCodeAt(i2 - 1))) return ALONE;
          var finished = !syllable || syllable.after !== syllable.kept;
          for (var m = 0; !finished && m < syllable.marks.length; m++) {
            var mark = syllable.marks[m];
            if (rank(mark) < FIRST_VOWEL) continue;
            if (mark === ASAT && (code2 === 4156 || syllable.marks.indexOf(MEDIAL_HA) >= 0)) continue;
            finished = true;
          }
          if (!finished || syllable && (isUnicodeMark(after) || after === 4153)) return HERE;
          return isMyanmarLetter(after) || isDigit(after) ? NEXT : ALONE;
        }
        function stackedAt(i2) {
          var next = i2 + 1;
          while (isTypedFirst(content.charCodeAt(next))) next++;
          return isConsonant(content.charCodeAt(next)) ? next : -1;
        }
        for (var i = 0; i < content.length; i++) {
          var code = content.charCodeAt(i);
          var zeroWidth = isZeroWidth(code) && code !== 8204 && code !== 8205;
          var place = isTypedFirst(code) ? placeTypedFirst(i) : HERE;
          if (syllable && (zeroWidth || isSpace(code))) {
            syllable.after += content.charAt(i);
            if (zeroWidth) syllable.kept += content.charAt(i);
          } else if (isKinziAt(content, i)) {
            start(content.slice(i, i + 3), content.charAt(i + 3));
            i += 3;
          } else if (isMyanmarLetter(code) || isDigit(code)) {
            var previous = content.charCodeAt(i - 1);
            var afterVowel = previous >= 4139 && previous <= 4146 || previous === 4150;
            start("", content.charAt(i), code === 4133 && afterVowel);
          } else if (place === NEXT) {
            close();
            pending.push(MYANMAR_CHARS[code - 4096]);
          } else if (place === ALONE) {
            write(content.charAt(i));
          } else if (syllable && code === 4153 && stackedAt(i) >= 0 && goesOn(code)) {
            var stacked = stackedAt(i);
            syllable.after = syllable.kept;
            for (var t = i + 1; t < stacked; t++) syllable.marks.push(MYANMAR_CHARS[content.charCodeAt(t) - 4096]);
            syllable.stack += "\u1039" + content.charAt(stacked);
            i = stacked;
          } else if (syllable && isUnicodeMark(code) && goesOn(code)) {
            syllable.after = syllable.kept;
            syllable.marks.push(MYANMAR_CHARS[code - 4096]);
          } else {
            write(content.charAt(i));
          }
        }
        close();
        return out + pending.join("");
      }
      function glyphsInTypedOrder(content, glyphs) {
        var out = "";
        for (var i = 0; i < content.length; i++) {
          var g = glyphs.get(content.charCodeAt(i));
          out += g === void 0 ? content.charAt(i) : g.text + g.extra;
        }
        return out;
      }
      function zeroAsWa(text) {
        return text.replace(/\u1040/g, function(zero, at) {
          var before = text.charAt(at - 1);
          var after = text.charAt(at + 1);
          if (NEXT_TO_ZERO_IN_NUMBER.test(before) || NEXT_TO_ZERO_IN_NUMBER.test(after)) return zero;
          if (DECIMAL_POINT.test(before) && DIGIT.test(text.charAt(at - 2))) return zero;
          if (DECIMAL_POINT.test(after) && DIGIT.test(text.charAt(at + 2))) return zero;
          return "\u101D";
        });
      }
      function toUnicode(content, font2, debug) {
        var steps = [content];
        var patterns = [];
        function step(name, text2) {
          if (text2 !== steps[steps.length - 1]) {
            patterns.push(name);
            steps.push(text2);
          }
          return text2;
        }
        var text = content;
        for (var s = 0; s < font2.sequences.length; s++) {
          text = text.replace(font2.sequences[s][0], font2.sequences[s][1]);
        }
        text = step("sequences", text);
        if (debug) step("glyphs", glyphsInTypedOrder(text, font2.glyphs));
        var result = step("syllables", arrange(text, font2.glyphs));
        result = step("zero as wa", zeroAsWa(result));
        result = step("look-alikes", typingFixes.lookAlikes(result));
        result = step("typos", typingFixes.typos(result));
        result = step("NFC", result.normalize("NFC"));
        return debug ? { matched_patterns: patterns, steps } : result;
      }
      module.exports = {
        ROLES: { BASE, PRE, MARK, STACK, KINZI, TEXT },
        font,
        toUnicode,
        arrangeUnicode
      };
    }
  });

  // library/win.js
  var require_win = __commonJS({
    "library/win.js"(exports, module) {
      var storageOrder = require_storageOrder();
      var BASE = storageOrder.ROLES.BASE;
      var PRE = storageOrder.ROLES.PRE;
      var MARK = storageOrder.ROLES.MARK;
      var STACK = storageOrder.ROLES.STACK;
      var KINZI = storageOrder.ROLES.KINZI;
      var TEXT = storageOrder.ROLES.TEXT;
      var KINZI_TEXT = "\u1004\u103A\u1039";
      var WIN = {
        // Consonants and independent letters
        "u": [BASE, "\u1000"],
        // ka
        "c": [BASE, "\u1001"],
        // kha
        "*": [BASE, "\u1002"],
        // ga
        "C": [BASE, "\u1003"],
        // gha
        "i": [BASE, "\u1004"],
        // nga
        "p": [BASE, "\u1005"],
        // ca
        "q": [BASE, "\u1006"],
        // cha
        "Z": [BASE, "\u1007"],
        // ja
        "n": [BASE, "\u100A"],
        // nya
        "\xF1": [BASE, "\u100A"],
        // n tilde: nya, short
        "#": [BASE, "\u100B"],
        // tta
        "X": [BASE, "\u100C"],
        // ttha
        "!": [BASE, "\u100D"],
        // dda
        "\xA1": [BASE, "\u100E"],
        // inverted exclamation: ddha
        "P": [BASE, "\u100F"],
        // nna
        "w": [BASE, "\u1010"],
        // ta
        "x": [BASE, "\u1011"],
        // tha
        "'": [BASE, "\u1012"],
        // da
        '"': [BASE, "\u1013"],
        // dha
        "e": [BASE, "\u1014"],
        // na
        "E": [BASE, "\u1014"],
        // na, short
        "y": [BASE, "\u1015"],
        // pa
        "z": [BASE, "\u1016"],
        // pha
        "A": [BASE, "\u1017"],
        // ba
        "b": [BASE, "\u1018"],
        // bha
        "r": [BASE, "\u1019"],
        // ma
        ",": [BASE, "\u101A"],
        // ya
        "&": [BASE, "\u101B"],
        // ra
        "\xBD": [BASE, "\u101B"],
        // one half: ra, short
        "v": [BASE, "\u101C"],
        // la
        "o": [BASE, "\u101E"],
        // sa
        "[": [BASE, "\u101F"],
        // ha
        "V": [BASE, "\u1020"],
        // lla
        "t": [BASE, "\u1021"],
        // a
        "\xA3": [BASE, "\u1023"],
        // pound: i
        "\xFE": [BASE, "\u1024"],
        // thorn: ii
        "O": [BASE, "\u1025"],
        // u
        "{": [BASE, "\u1027"],
        // e
        "\xCD": [BASE, "\u1009"],
        // I acute: nnya, narrow
        "\xDA": [BASE, "\u1009"],
        // U acute: nnya, wide
        "\xF3": [BASE, "\u103F"],
        // o acute: great sa
        "\xD3": [BASE, "\u1009\u102C"],
        // O acute: nnya with aa
        // Two consonants in one glyph
        "@": [BASE, "\u100F\u1039\u100D"],
        // nna + dda
        "|": [BASE, "\u100B\u1039\u100C"],
        // tta + ttha
        "\xA5": [BASE, "\u100B\u1039\u100B"],
        // yen: tta + tta
        "\xD7": [BASE, "\u100D\u1039\u100D"],
        // multiplication: dda + dda
        "\xB9": [BASE, "\u100D\u1039\u100E"],
        // superscript one: dda + ddha
        "$": [BASE, "\u1000\u103B\u1015\u103A"],
        // kyat
        // Vowel signs, tones and asat
        "m": [MARK, "\u102C"],
        // aa
        "g": [MARK, "\u102B"],
        // tall aa
        ":": [MARK, "\u102B\u103A"],
        // tall aa with asat
        "d": [MARK, "\u102D"],
        // i
        "D": [MARK, "\u102E"],
        // ii
        "k": [MARK, "\u102F"],
        // u
        "K": [MARK, "\u102F"],
        // u, long
        "l": [MARK, "\u1030"],
        // uu
        "L": [MARK, "\u1030"],
        // uu, long
        "J": [MARK, "\u1032"],
        // ai
        "H": [MARK, "\u1036"],
        // anusvara
        "\xF0": [MARK, "\u102D\u1036"],
        // eth: i with anusvara
        "h": [MARK, "\u1037"],
        // dot below
        "U": [MARK, "\u1037"],
        // dot below, right
        "Y": [MARK, "\u1037"],
        // dot below, further right
        ";": [MARK, "\u1038"],
        // visarga
        "f": [MARK, "\u103A"],
        // asat
        "a": [PRE, "\u1031"],
        // e
        // Kinzi
        "F": [KINZI, KINZI_TEXT],
        "\xD8": [KINZI, KINZI_TEXT, "\u102D"],
        // O stroke: kinzi with i
        "\xD0": [KINZI, KINZI_TEXT, "\u102E"],
        // eth: kinzi with ii
        "\xF8": [KINZI, KINZI_TEXT, "\u1036"],
        // o stroke: kinzi with anusvara
        // Medials
        "s": [MARK, "\u103B"],
        // ya
        "\xDF": [MARK, "\u103B"],
        // sharp s: ya, long
        "G": [MARK, "\u103D"],
        // wa
        "S": [MARK, "\u103E"],
        // ha
        "\xA7": [MARK, "\u103E"],
        // section: ha, short
        "T": [MARK, "\u103D\u103E"],
        // wa with ha
        "I": [MARK, "\u103E\u102F"],
        // ha with u
        "\xAA": [MARK, "\u103E\u1030"],
        // feminine ordinal: ha with uu
        "Q": [MARK, "\u103B\u103E"],
        // ya with ha
        "R": [MARK, "\u103B\u103D"],
        // ya with wa
        "W": [MARK, "\u103B\u103D\u103E"],
        // ya with wa and ha
        "j": [PRE, "\u103C"],
        // ra, narrow
        "M": [PRE, "\u103C"],
        // ra, wide
        "N": [PRE, "\u103C"],
        // ra, narrow, cut for an upper vowel
        "B": [PRE, "\u103C"],
        // ra, wide, cut for an upper vowel
        "`": [PRE, "\u103C"],
        // ra, narrow, cut for a lower mark
        "~": [PRE, "\u103C"],
        // ra, wide, cut for a lower mark
        ">": [PRE, "\u103C\u103D"],
        // ra, narrow, with wa
        "<": [PRE, "\u103C\u103D"],
        // ra, wide, with wa
        "\xFB": [PRE, "\u103C\u102F"],
        // u circumflex: ra, narrow, with u
        "\xEA": [PRE, "\u103C\u102F"],
        // e circumflex: ra, wide, with u
        // Stacked consonants
        "\xFA": [STACK, "\u1039\u1000"],
        // u acute: ka
        "\xA9": [STACK, "\u1039\u1001"],
        // copyright: kha
        "\xBE": [STACK, "\u1039\u1002"],
        // three quarters: ga
        "\xA2": [STACK, "\u1039\u1003"],
        // cent: gha
        "\xF6": [STACK, "\u1039\u1005"],
        // o umlaut: ca
        "\xE4": [STACK, "\u1039\u1006"],
        // a umlaut: cha
        "\xC6": [STACK, "\u1039\u1007"],
        // AE: ja
        "\xD1": [STACK, "\u1039\u1008"],
        // N tilde: jha
        "\xB3": [STACK, "\u1039\u100B"],
        // superscript three: tta
        "\xB2": [STACK, "\u1039\u100C"],
        // superscript two: ttha
        "\xD6": [STACK, "\u1039\u100F"],
        // O umlaut: nna
        "\xE5": [STACK, "\u1039\u1010"],
        // a ring: ta, wide
        "\xC5": [STACK, "\u1039\u1010"],
        // A ring: ta, narrow
        "\xAC": [STACK, "\u1039\u1011"],
        // not: tha, wide
        "\xA6": [STACK, "\u1039\u1011"],
        // broken bar: tha, narrow
        "\xB4": [STACK, "\u1039\u1012"],
        // acute: da
        "\xA8": [STACK, "\u1039\u1013"],
        // diaeresis: dha
        "\xE9": [STACK, "\u1039\u1014"],
        // e acute: na
        "\xDC": [STACK, "\u1039\u1015"],
        // U umlaut: pa
        "\xE6": [STACK, "\u1039\u1016"],
        // ae: pha
        "\xC1": [STACK, "\u1039\u1017"],
        // A acute: ba
        "\xC7": [STACK, "\u1039\u1018"],
        // C cedilla: bha
        "\xAE": [STACK, "\u1039\u1019"],
        // registered: ma
        "\u2019": [STACK, "\u1039\u101C"],
        // right quote (0x92): la
        "\xC9": [STACK, "\u1039\u1010", "\u103D"],
        // E acute: ta, with wa
        // Digits and Burmese punctuation. Win has no glyph for wa and types it as zero.
        "0": [BASE, "\u1040"],
        "1": [BASE, "\u1041"],
        "2": [BASE, "\u1042"],
        "3": [BASE, "\u1043"],
        "4": [BASE, "\u1044"],
        "5": [BASE, "\u1045"],
        "6": [BASE, "\u1046"],
        "7": [BASE, "\u1047"],
        "8": [BASE, "\u1048"],
        "9": [BASE, "\u1049"],
        "?": [TEXT, "\u104A"],
        // little section
        "/": [TEXT, "\u104B"],
        // section
        "\xFC": [BASE, "\u104C"],
        // u umlaut: locative
        "\xED": [BASE, "\u104D"],
        // i acute: completed
        "\xA4": [BASE, "\u104E"],
        // currency sign: aforementioned
        "\\": [BASE, "\u104F"],
        // genitive
        // Fractions. Unicode has no Burmese fraction characters.
        "\u0192": [TEXT, "\u1041/\u1042"],
        // 0x83
        "\u201E": [TEXT, "\u1041/\u1043"],
        // 0x84
        "\u2026": [TEXT, "\u1042/\u1043"],
        // 0x85
        "\u2020": [TEXT, "\u1041/\u1044"],
        // 0x86
        "\u2021": [TEXT, "\u1043/\u1044"],
        // 0x87
        "\u02C6": [TEXT, "\u1041/\u1045"],
        // 0x88
        "\u2030": [TEXT, "\u1042/\u1045"],
        // 0x89
        "\u0160": [TEXT, "\u1043/\u1045"],
        // 0x8A
        "\u2039": [TEXT, "\u1044/\u1045"],
        // 0x8B
        // Latin punctuation the font moves to other keys
        "]": [TEXT, "\u2018"],
        "}": [TEXT, "\u2019"],
        "^": [TEXT, "/"],
        "_": [TEXT, "\xD7"],
        "\xAB": [TEXT, "["],
        "\xBB": [TEXT, "]"],
        "\xB5": [TEXT, "!"],
        "\u03BC": [TEXT, "!"],
        "\xBF": [TEXT, "?"],
        "\xE7": [TEXT, ","],
        "\xBC": [TEXT, "-"],
        "\u2010": [TEXT, "-"],
        "\xE8": [TEXT, "_"],
        "\xCA": [TEXT, " "],
        // E circumflex: a blank glyph
        // Dingbats. The vendor logo at 0xB0 has no text and is dropped.
        "\u201A": [TEXT, "\u260E"],
        // 0x82 telephone
        "\xC0": [TEXT, "\u2666"],
        "\xC2": [TEXT, "\u2714"],
        "\xC3": [TEXT, "\u2663"],
        "\xC4": [TEXT, "\u2731"],
        "\xE0": [TEXT, "\u2665"],
        "\xE1": [TEXT, "\u27A4"],
        "\xE2": [TEXT, "\u2718"],
        "\xE3": [TEXT, "\u2660"],
        "\xB6": [TEXT, "\u25C4"],
        "\xB0": [TEXT, ""]
      };
      var CP1252 = {
        "\u201A": "\x82",
        "\u0192": "\x83",
        "\u201E": "\x84",
        "\u2026": "\x85",
        "\u2020": "\x86",
        "\u2021": "\x87",
        "\u02C6": "\x88",
        "\u2030": "\x89",
        "\u0160": "\x8A",
        "\u2039": "\x8B",
        "\u2019": "\x92"
      };
      Object.keys(CP1252).forEach(function(ch) {
        WIN[CP1252[ch]] = WIN[ch];
      });
      var SEQUENCES = [
        [/a[Mj]omf/g, "\u102A"],
        // aMomf: au (e + medial ra around sa + aa + asat)
        [/[Mj]o/g, "\u1029"],
        // Mo: o (medial ra around sa)
        [/p[s\u00DF]/g, "\u1008"],
        // ps: jha (ca + medial ya)
        [/OD/g, "\u1026"]
        // OD: uu (u + ii)
      ];
      var FONT = storageOrder.font(WIN, SEQUENCES);
      function toUnicode(content, debug) {
        return storageOrder.toUnicode(content, FONT, debug);
      }
      module.exports = {
        toUnicode,
        // For scripts/eval/win-glyphs.mjs, which draws the table for review.
        tables: { WIN, SEQUENCES, ROLES: storageOrder.ROLES }
      };
    }
  });

  // library/zawgyi.js
  var require_zawgyi = __commonJS({
    "library/zawgyi.js"(exports, module) {
      var storageOrder = require_storageOrder();
      var BASE = storageOrder.ROLES.BASE;
      var PRE = storageOrder.ROLES.PRE;
      var MARK = storageOrder.ROLES.MARK;
      var STACK = storageOrder.ROLES.STACK;
      var KINZI = storageOrder.ROLES.KINZI;
      var KINZI_TEXT = "\u1004\u103A\u1039";
      var ZAWGYI = {
        // Letters in another shape
        "\u106A": [BASE, "\u1009"],
        // nya, small, for a mark below
        "\u106B": [BASE, "\u100A"],
        // nnya, short
        "\u108F": [BASE, "\u1014"],
        // na, short, for a mark below
        "\u1090": [BASE, "\u101B"],
        // ra, short, for a mark below
        "\u1086": [BASE, "\u103F"],
        // great sa
        "\u104E": [BASE, "\u104E\u1004\u103A\u1038"],
        // lagaung, drawn with its nga, asat and visarga
        // Two consonants in one glyph
        "\u106E": [BASE, "\u100D\u1039\u100D"],
        // dda + dda
        "\u106F": [BASE, "\u100D\u1039\u100E"],
        // dda + ddha
        "\u1091": [BASE, "\u100F\u1039\u100D"],
        // nna + dda
        "\u1092": [BASE, "\u100B\u1039\u100C"],
        // tta + ttha
        "\u1097": [BASE, "\u100B\u1039\u100B"],
        // tta + tta
        // Vowel signs, tones and asat
        "\u102B": [MARK, "\u102B"],
        // tall aa
        "\u102C": [MARK, "\u102C"],
        // aa
        "\u105A": [MARK, "\u102B\u103A"],
        // tall aa with asat
        "\u102D": [MARK, "\u102D"],
        // i
        "\u102E": [MARK, "\u102E"],
        // ii
        "\u108E": [MARK, "\u102D\u1036"],
        // i with anusvara
        "\u102F": [MARK, "\u102F"],
        // u
        "\u1033": [MARK, "\u102F"],
        // u, long
        "\u1030": [MARK, "\u1030"],
        // uu
        "\u1034": [MARK, "\u1030"],
        // uu, long
        "\u1031": [PRE, "\u1031"],
        // e
        "\u1032": [MARK, "\u1032"],
        // ai
        "\u1036": [MARK, "\u1036"],
        // anusvara
        "\u1037": [MARK, "\u1037"],
        // dot below
        "\u1094": [MARK, "\u1037"],
        // dot below, moved right
        "\u1095": [MARK, "\u1037"],
        // dot below, moved further right
        "\u1038": [MARK, "\u1038"],
        // visarga
        "\u1039": [MARK, "\u103A"],
        // asat
        // Kinzi
        "\u1064": [KINZI, KINZI_TEXT],
        "\u108B": [KINZI, KINZI_TEXT, "\u102D"],
        // kinzi with i
        "\u108C": [KINZI, KINZI_TEXT, "\u102E"],
        // kinzi with ii
        "\u108D": [KINZI, KINZI_TEXT, "\u1036"],
        // kinzi with anusvara
        // Medials
        "\u103A": [MARK, "\u103B"],
        // ya
        "\u107D": [MARK, "\u103B"],
        // ya, short
        "\u103C": [MARK, "\u103D"],
        // wa
        "\u103D": [MARK, "\u103E"],
        // ha
        "\u1087": [MARK, "\u103E"],
        // ha, short
        "\u103E": [MARK, "\u103E"],
        // Unicode's ha, which Zawgyi does not use, in mixed text
        "\u108A": [MARK, "\u103D\u103E"],
        // wa with ha
        "\u1088": [MARK, "\u103E\u102F"],
        // ha with u
        "\u1089": [MARK, "\u103E\u1030"],
        // ha with uu
        "\u103B": [PRE, "\u103C"],
        // ra, narrow
        "\u107E": [PRE, "\u103C"],
        // ra, wide
        "\u107F": [PRE, "\u103C"],
        // ra, narrow, cut for an upper vowel
        "\u1080": [PRE, "\u103C"],
        // ra, wide, cut for an upper vowel
        "\u1081": [PRE, "\u103C"],
        // ra, narrow, cut for a lower mark
        "\u1082": [PRE, "\u103C"],
        // ra, wide, cut for a lower mark
        "\u1083": [PRE, "\u103C"],
        // ra, narrow, cut at both ends
        "\u1084": [PRE, "\u103C"],
        // ra, wide, cut at both ends
        // Stacked consonants
        "\u1060": [STACK, "\u1039\u1000"],
        // ka
        "\u1061": [STACK, "\u1039\u1001"],
        // kha
        "\u1062": [STACK, "\u1039\u1002"],
        // ga
        "\u1063": [STACK, "\u1039\u1003"],
        // gha
        "\u1065": [STACK, "\u1039\u1005"],
        // ca
        "\u1066": [STACK, "\u1039\u1006"],
        // cha
        "\u1067": [STACK, "\u1039\u1006"],
        // cha, other width
        "\u1068": [STACK, "\u1039\u1007"],
        // ja
        "\u1069": [STACK, "\u1039\u1008"],
        // jha
        "\u106C": [STACK, "\u1039\u100B"],
        // tta
        "\u106D": [STACK, "\u1039\u100C"],
        // ttha
        "\u1070": [STACK, "\u1039\u100F"],
        // nna
        "\u1071": [STACK, "\u1039\u1010"],
        // ta
        "\u1072": [STACK, "\u1039\u1010"],
        // ta, narrow
        "\u1073": [STACK, "\u1039\u1011"],
        // tha
        "\u1074": [STACK, "\u1039\u1011"],
        // tha, other width
        "\u1075": [STACK, "\u1039\u1012"],
        // da
        "\u1076": [STACK, "\u1039\u1013"],
        // dha
        "\u1077": [STACK, "\u1039\u1014"],
        // na
        "\u1078": [STACK, "\u1039\u1015"],
        // pa
        "\u1079": [STACK, "\u1039\u1016"],
        // pha
        "\u107A": [STACK, "\u1039\u1017"],
        // ba
        "\u107B": [STACK, "\u1039\u1018"],
        // bha
        "\u1093": [STACK, "\u1039\u1018"],
        // bha, other shape
        "\u107C": [STACK, "\u1039\u1019"],
        // ma
        "\u1085": [STACK, "\u1039\u101C"],
        // la
        "\u1096": [STACK, "\u1039\u1010", "\u103D"]
        // ta, with wa
      };
      for (digit = 4160; digit <= 4169; digit++) {
        ZAWGYI[String.fromCharCode(digit)] = [BASE, String.fromCharCode(digit)];
      }
      var digit;
      var SEQUENCES = [
        [/(^|[^\u1040-\u1049])\u1044\u1004\u1039\u1038/g, "$1\u104E"],
        // the digit four typed for lagaung
        [/\u104E\u1004\u1039\u1038/g, "\u104E"]
        // lagaung typed with the nga, asat and visarga it draws
      ];
      var FONT = storageOrder.font(ZAWGYI, SEQUENCES);
      function toUnicode(content, debug) {
        return storageOrder.toUnicode(content, FONT, debug);
      }
      module.exports = {
        toUnicode
      };
    }
  });

  // library/converter.js
  var require_converter = __commonJS({
    "library/converter.js"(exports, module) {
      var fontDetect = require_detector();
      var globalOptions = require_globalOptions();
      var gate = require_contentGate();
      var syllable = require_syllable();
      var win = require_win();
      var zawgyi = require_zawgyi();
      var DRAWING_ORDER_FONTS = { win, zawgyi };
      function fontConvert(content, to, from) {
        content = gate.toText(content);
        if (gate.isMissing(content)) {
          if (!globalOptions.isSilentMode()) console.warn("Content must be specified on knayi.fontConvert.");
          return "";
        }
        if (gate.resolveFont(from) !== "win" && !gate.hasMyanmar(content))
          return content;
        if (!to) {
          if (!globalOptions.isSilentMode()) console.error("Convert target font must be specified on knayi.fontConvert.");
          return content;
        }
        content = content.trim();
        to = gate.resolveFont(to);
        from = gate.resolveFont(from);
        if (!to) {
          if (!globalOptions.isSilentMode()) console.error("Convert library dosen't have this fontType.");
          return content;
        } else if (!from) {
          from = fontDetect(content);
        }
        if (to === from) {
          return content;
        }
        if (to === "win" || from === "win" && to !== "unicode") {
          if (!globalOptions.isSilentMode()) console.error("knayi.fontConvert converts Win text to Unicode only.");
          return content;
        }
        var debug = this && this.debug;
        if (DRAWING_ORDER_FONTS[from]) return drawingOrderToUnicode(content, from, debug);
        content = syllable.collapseMarks(content, from);
        return syllable.convertText(content, from, to, debug);
      }
      function drawingOrderToUnicode(content, from, debug) {
        var result = DRAWING_ORDER_FONTS[from].toUnicode(content, debug);
        if (!debug) return result;
        return { to: "unicode", from, matched_patterns: result.matched_patterns, steps: result.steps };
      }
      fontConvert.debugging = function(param1, param2, param3) {
        return fontConvert.apply({ debug: true }, [param1, param2, param3]);
      };
      module.exports = fontConvert;
    }
  });

  // library/syllBreak.js
  var require_syllBreak = __commonJS({
    "library/syllBreak.js"(exports, module) {
      var fontDetect = require_detector();
      var globalOptions = require_globalOptions();
      var gate = require_contentGate();
      var syllable = require_syllable();
      function syllBreak(content, fontType, breakpoint) {
        content = gate.toText(content);
        if (gate.isMissing(content)) {
          if (!globalOptions.isSilentMode()) console.warn("Content must be specified on knayi.syllBreak.");
          return "";
        }
        if (!gate.hasMyanmar(content))
          return content;
        content = gate.cleanText(content, true);
        if (!fontType)
          fontType = fontDetect(content);
        else
          fontType = gate.resolveFont(fontType) || fontType;
        return syllable.joinParts(syllable.breakParts(content, fontType), breakpoint);
      }
      module.exports = syllBreak;
    }
  });

  // library/spellingCheck.js
  var require_spellingCheck = __commonJS({
    "library/spellingCheck.js"(exports, module) {
      var fontDetect = require_detector();
      var globalOptions = require_globalOptions();
      var gate = require_contentGate();
      var syllable = require_syllable();
      function spellingFix(content, fontType) {
        content = gate.toText(content);
        if (gate.isMissing(content)) {
          if (!globalOptions.isSilentMode()) console.warn("Content must be specified on knayi.spellingFix.");
          return "";
        }
        if (!gate.hasMyanmar(content))
          return content;
        if (!fontType)
          fontType = fontDetect(content);
        else
          fontType = gate.resolveFont(fontType) || fontType;
        content = gate.cleanText(content, true);
        return syllable.collapseMarks(content, fontType);
      }
      module.exports = spellingFix;
    }
  });

  // library/truncate.js
  var require_truncate = __commonJS({
    "library/truncate.js"(exports, module) {
      var fontDetect = require_detector();
      var globalOptions = require_globalOptions();
      var gate = require_contentGate();
      var syllable = require_syllable();
      function truncate(content, options) {
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
          fontType = fontDetect(content);
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
      module.exports = truncate;
    }
  });

  // library/normalization.js
  var require_normalization = __commonJS({
    "library/normalization.js"(exports, module) {
      var globalOptions = require_globalOptions();
      var gate = require_contentGate();
      var storageOrder = require_storageOrder();
      var typingFixes = require_typingFixes();
      function normalize(content) {
        content = gate.toText(content);
        if (gate.isMissing(content)) {
          if (!globalOptions.isSilentMode()) console.warn("Content must be specified on knayi.normalize.");
          return "";
        }
        if (typeof content !== "string")
          return content;
        var text = storageOrder.arrangeUnicode(content.normalize("NFC"));
        return typingFixes.lookAlikes(typingFixes.typos(text)).normalize("NFC");
      }
      module.exports = normalize;
    }
  });

  // main.js
  var require_main = __commonJS({
    "main.js"(exports, module) {
      var globalOptions = require_globalOptions();
      var fontDetect = require_detector();
      var fontConvert = require_converter();
      var syllBreak = require_syllBreak();
      var spellingFix = require_spellingCheck();
      var truncate = require_truncate();
      var normalize = require_normalization();
      var version = "2.10.0";
      var setGlobalOptions = globalOptions.setOptions;
      module.exports = {
        version,
        setGlobalOptions,
        fontDetect,
        fontConvert,
        syllBreak,
        spellingFix,
        truncate,
        normalize
      };
      Object.defineProperty(module.exports, "default", { value: module.exports });
    }
  });
  return require_main();
})();
(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window).knayi = knayi;
