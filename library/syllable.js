const convertRules = {
  unicode: {
    zawgyi: {
      oneTime: [
        [/([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u102f/g, "$1\u1033"],
        [/([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u1030/g, "$1\u1034"],
        [/([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u1037/g, "$1\u1094"],
        [/([\u1000-\u1021])\u103b([\u103d][\u103e]*)/g, "$1\u107d$2"],
        // ့ rules
        [/([\u1033\u1034])[\u1037\u1094]/g, "$1\u1095"],
        // [/\u107e([\u1000-\u1021])/],

        [/\u103c([\u1000-\u1021][\u102f\u1030\u1039\u103b\u103d\u103e])/g, "\u1082$1"],

        [/\u1004\u103a\u1039/g, "\u1064"],
        [/\u1064([\u1000-\u1021])/g, "$1\u1064"],

        // င်္ + ျ ြ ွ ှ ့ ု ူ + ိ ီ ံ
        [/\u1064([\u103b\u103c\u103d\u103e\u1037\u102f\u1030]*)\u102d/g, '\u108b$1'],
        [/\u1064([\u103b\u103c\u103d\u103e\u1037\u102f\u1030]*)\u102e/g, '\u108c$1'],
        [/\u1064([\u103b\u103c\u103d\u103e\u1037\u102f\u1030]*)\u1036/g, '\u108d$1'],

        // ြ first
        [/([\u1000-\u1021][^\u1000-\u1021]*)([\u103c\u1082])/g, "$2$1"],
        [/([\u1000-\u1021]\u1039)\u103c([\u1000-\u1021])/g, "\u103c$1$2"],

        // ေ first
        [/([\u1000-\u1021][^\u1000-\u1021]*)\u1031/g, "\u1031$1"],
        [/([\u1000-\u1021]\u1039)\u1031([\u1000-\u1021])/g, "\u1031$1$2"],
        [/\u103c\u1031/g, "\u1031\u103c"], // ြေ -> ေြ

        // နဉ + ​(ျ ြ ွ ှ ု ူ)
        [/\u1014([\u102f\u1030\u1039\u103b\u103d\u103e])/g, "\u108f$1"],
        [/\u103c\u1014/g, "\u103c\u108f"], // ြန
        [/\u1009([\u102f\u1030\u1039\u103b\u103d\u103e])/g, "\u106a$1"],
        // [/\u103c\u1009/g, "\u1081\u106a"], // ြဉ

        // \u101e\u107e\u1000\u1064\u1014\u1039

        [/\u104e\u1004\u103a\u1038/g, "\u104e"],
        [/\u102b\u103a/g, "\u105a"],
        [/\u103f/g, "\u1086"],
        [/\u1039\u101c/g, "\u1085"],
        [/\u1039\u1019/g, "\u107c"],
        [/\u1039\u1018/g, "\u107b"],
        [/\u1039\u1017/g, "\u107a"],
        [/\u1039\u1016/g, "\u1079"],
        [/\u1039\u1015/g, "\u1078"],
        [/\u1039\u1014/g, "\u1077"],
        [/\u1039\u1013/g, "\u1076"],
        [/\u1039\u1012/g, "\u1075"],
        [/\u1039\u1011/g, "\u1073"],
        [/\u1039\u1010/g, "\u1071"],
        [/\u1039\u100f/g, "\u1070"],
        [/\u100e\u1039\u100d/g, "\u106f"],
        [/\u100f\u1039\u100d/g, "\u1091"],
        [/\u100d\u1039\u100d/g, "\u106e"],
        [/\u100b\u1039\u100c/g, "\u1092"],
        [/\u1039\u100c/g, "\u106d"],
        [/\u100b\u1039\u100b/g, "\u1097"],
        [/\u1039\u100b/g, "\u106c"],
        // [/\u1009/g, "\u106a"],
        [/\u1039\u1005\u103b/g, "\u1069"],
        [/\u1039\u1007/g, "\u1068"],
        [/\u1039\u1006/g, "\u1066"],
        [/\u1039\u1005/g, "\u1065"],
        [/\u1039\u1003/g, "\u1063"],
        [/\u1039\u1002/g, "\u1062"],
        [/\u1039\u1001/g, "\u1061"],
        [/\u103d\u103e/g, "\u108a"],
        [/\u103e\u1030/g, "\u1089"],
        [/\u1039\u1000/g, "\u1060"],

        [/\u103e\u102f/g, "\u1088"],
        // [/\u1037/g, "\u1037"],

        [/\u103a/g, "\u1039"],
        [/\u103b/g, "\u103a"],
        [/\u103c/g, "\u103b"],
        [/\u103d/g, "\u103c"],
        [/\u103e/g, "\u103d"],

        [/([^\u1000\u1003\u1006\u100f\u1010\u1011\u1018\u1021\u101a\u101c\u101e\u101f])\u1071/g, "$1\u1072"],
      ],
      asLongAsMatch: [
        // [/([\u103b\u103c\u103d\u103e])\u1031/g, "\u1031$1"],

        [/\u103b([\u1000\u1003\u1006\u100f\u1010\u1011\u1018\u1021\u101a\u101c\u101e\u101f])/g, "\u107e$1"],

        [/\u103b([\u1000-\u1021\u106a\u108f](\u103c\u103d|\u108a|\u103c)[\u102d\u102e])/g, "\u1083$1"],
        [/\u107e([\u1000-\u1021](\u103c\u103d|\u108a|\u103c)[\u102d\u102e])/g, "\u1084$1"],

        [/\u103b([\u1000-\u1021\u106a\u108f][\u102d\u102e])/g, "\u107f$1"],
        [/\u107e([\u1000-\u1021][\u102d\u102e])/g, "\u1080$1"],

        [/\u103b([\u1000-\u1021\u106a\u108f][\u103c\u103e\u108a])/g, "\u1081$1"],
        [/\u107e([\u1000-\u1021][\u103c\u103e\u108a])/g, "\u1082$1"],

        [/\u103b\u1009/g, "\u1081\u106a"],
      ]
    }
  },
  zawgyi: {
    unicode: {
      oneTime: [
        [/([^\u1040-\u1049\+\-\*\/])?\u1040([^\u1040-\u1049\+\-\*\/])?/g, '$1\u101d$2'],
        [/\u103d|\u1087/g, '\u103e'],
        [/\u103c/g, '\u103d'],
        [/[\u103b\u107e-\u1084]/g, '\u103c'],
        [/[\u103a\u107d]/g, '\u103b'],
        [/\u1039/g, '\u103a'],
        [/[\u1094-\u1095]/g, '\u1037'],
        [/\s([\u1037])/g, '$1'], // remove space infront
        [/[\u107b\u1093]/g, '\u1039\u1018'],
        [/\u1033/g, '\u102f'],
        [/\u1034/g, '\u1030'],
        [/\u1088/g, '\u103e\u102f'],
        // [/\u1064/g, '\u1004\u103a\u1039'],
        [/\u1089/g, '\u103e\u1030'],
        [/\u108a/g, '\u103d\u103e'],
        [/\u1061/g, '\u1039\u1001'],
        [/\u108f/g, '\u1014'],
        [/\u1062/g, '\u1039\u1002'],
        [/\u1063/g, '\u1039\u1003'],
        [/\u1065/g, '\u1039\u1005'],
        [/[\u1066\u1067]/g, '\u1039\u1006'],
        [/\u1068/g, '\u1039\u1007'],
        [/\u1069/g, '\u1039\u1005\u103b'],
        [/\u106a/g, '\u1009'],
        [/\u106b/g, '\u100a'],
        [/\u106c/g, '\u1039\u100b'],
        [/\u106d/g, '\u1039\u100c'],
        [/\u106e/g, '\u100d\u1039\u100d'],
        [/\u106f/g, '\u100e\u1039\u100d'],
        [/\u1070/g, '\u1039\u100f'],
        [/[\u1071\u1072]/g, '\u1039\u1010'],
        [/[\u1073\u1074]/g, '\u1039\u1011'],
        [/\u1075/g, '\u1039\u1012'],
        [/\u1076/g, '\u1039\u1013'],
        [/\u1077/g, '\u1039\u1014'],
        [/\u1078/g, '\u1039\u1015'],
        [/\u1079/g, '\u1039\u1016'],
        [/\u1079/g, '\u1039\u1016'],
        [/\u107a/g, '\u1039\u1017'],
        [/\u107c/g, '\u1039\u1019'],
        [/\u1085/g, '\u1039\u101c'],
        [/\u1086/g, '\u103f'],
        [/\u1090/g, '\u101b'],
        [/\u1091/g, '\u100f\u1039\u100d'],
        [/\u1092/g, '\u100b\u1039\u100c'],
        [/\u1097/g, '\u100b\u1039\u100b'],
        [/\u1060/g, '\u1039\u1000'],
        [/\u105a/g, '\u102b\u103a'],
        [/\u104e/g, '\u104e\u1004\u103a\u1038'],
        [/\u1025\u103a/g, '\u1009\u103a'],



        [/([\u102b\u102c\u102d\u102e\u102f\u1030\u1031\u1032\u1036\u1037\u1038\u103b\u103c\u103d\u103e]+)(\u1039[\u1000-\u1021])/g, '$2$1'],
        // eg: က + ျ ြ ွ ှ ံ ့ ိ ီ ု ူ +​ င်္ီ
        [/([\u1000-\u1021])([\u103b\u103c\u103d\u103e\u1037\u102f\u1030\u102d\u102e\u1036]*)\u108b/g, '$1\u1064$2\u102d'],
        [/([\u1000-\u1021])([\u103b\u103c\u103d\u103e\u1037\u102f\u1030\u102d\u102e\u1036]*)\u108c/g, '$1\u1064$2\u102e'],
        [/([\u1000-\u1021])([\u103b\u103c\u103d\u103e\u1037\u102f\u1030\u102d\u102e\u1036]*)\u108d/g, '$1\u1064$2\u1036'],
        [/\u108e/g, '\u102d\u1036'],
        [/\u103c([\u1000-\u1021])/g, '$1\u103c'],
        [/\u1031([\u1000-\u1021])/g, '$1\u1031'],
        [/([\u102b\u102c\u102d\u102e\u102f\u1030\u1031\u1032\u1036\u1037\u1038\u103b\u103c\u103d\u103e]+)\u1064/g, '\u1064$1'],
        // [/([\u103b\u103c\u103d])(\u1064)/g, '$2$1'],
        [/\u1031(\u1064)/g, '$1\u1031'],
        [/([\u1000-\u1021])(\u1064)/g, '$2$1'],
        [/\u0020(\u1039[\u1000-\u1021])/g, '$1'],


        [/\u1064/g, '\u1004\u103a\u1039'],
      ],
      asLongAsMatch: [
        [/([\u102b\u102c\u102d\u102e\u1031\u102f\u1030\u1032\u1036\u1037\u1038])([\u103b\u103c\u103d\u103e])/g, "$2$1"],
        [/\u103d([\u103b\u103c])/g, "$1\u103d"],
        [/\u103e([\u103b\u103c\u103d])/g, "$1\u103e"],
        [/([\u102f\u1030])([\u102d\u102e])/g, "$2$1"],
        [/\u1036([\u102d\u102e\u102f\u1030])/g, "$1\u1036"],
        [/\u1037([\u1031\u102c\u102b\u102f\u1030\u1032])/g, "$1\u1037"],
        [/([\u1031\u102b\u102c])(\u1039[\u1000-\u1021])/g, "$2$1"],
        [/([\u102b\u102c])(\u1004\u103a\u1039)/g, "$2$1"]
      ]
    }
  }
};

const MEDIALS = "ျြွှ";
const VOWELS = "ါာိီုူေဲ";
const TONES = "ံ့း";
const ASAT = "်";
const VIRAMA = "္";
const KINZI = "င်္";
const CONSONANT = /[က-အ]/;

const C = "က-အ";
const SHORT_C = "ခဂငစဇဈဉဎဒဓနပဖဗမရဝဠ";
const M = "ျြွှ";
const V = "ါာိီုူေဲ";
const S = "္";
const A = "်";
const F = "ံ့း";
const E = "ဣဥဦဩ၎";
const WA_LONE = "ဝ";
const NUMBER_ZERO = "၀";

const rankingMap = {
  "ျ": 1,
  "ြ": 2,
  "ွ": 3,
  "ှ": 4,
  "ေ": 5,
  "ါ": 6,
  "ာ": 7,
  "ိ": 8,
  "ီ": 9,
  "ု": 10,
  "ူ": 11,
  "ဲ": 12,
  "်": 13,
  "ံ": 14,
  "့": 15,
  "း": 16
};

const brakePoint = new RegExp("([" + C + E + NUMBER_ZERO + "])([" + M + V + A + F + "]+)", "gm");

function addRule(list, pattern, replacement) {
  list.push([new RegExp(pattern, "gm"), replacement]);
}

const extendedRules = [];
const postExtendedRules = [];
[
  ["၀", "ဝ"],
  ["ဦ", "ဦ"],
  ["ဩော်", "ဪ"],
  ["ိီ", "ီ"],
  ["ုူ", "ူ"],
  ["စျ", "ဈ"]
].forEach(function (pair) {
  addRule(extendedRules, pair[0], pair[1]);
});
addRule(postExtendedRules, "([" + SHORT_C + "])\\s(္[က-အ])", "$1$2");

function uniquify(marks) {
  return Array.from(new Set(marks));
}

function applyReplacementRules(rules, content) {
  return rules.reduce(function (text, rule) {
    return text.replace(rule[0], rule[1]);
  }, content);
}

const NON_NUMBER_BEHIND = new RegExp(S + "$");
const NON_NUMBER_AHEAD_SIGN = new RegExp("^\\s?[" + M + V + S + A + F + "]");
const NON_NUMBER_AHEAD_C_SIGN = new RegExp("^\\s?[" + C + "][" + S + A + F + "]");

function fixWaAndYa(text) {
  function ruleFunction(num, char) {
    var isWa = char === WA_LONE;
    return function (behind, ahead) {
      var isNumber = isWa;
      if (NON_NUMBER_BEHIND.test(behind)) isNumber = false;
      if (!isWa) {
        if (/[၀-၉=+-/]\s?$/.test(behind) && /^\s|\s?[၀-၉=+-/]/.test(ahead)) isNumber = true;
        if (/[၀-၉]|\s?[=+-/]/.test(ahead)) isNumber = true;
      }
      if (NON_NUMBER_AHEAD_SIGN.test(ahead) || NON_NUMBER_AHEAD_C_SIGN.test(ahead)) isNumber = false;
      if (isWa && /^\s?လုံး/.test(ahead) && !/[၀-၉]\s?$/.test(behind)) isNumber = false;
      return behind + (isNumber ? num : char) + ahead;
    };
  }
  return String(text == null ? "" : text)
    .split(/၀|ဝ/)
    .reduce(ruleFunction("၀", "ဝ"))
    .split(/၇|ရ/)
    .reduce(ruleFunction("၇", "ရ"));
}

function parseChunks(content) {
  var chunks = [];
  var re = new RegExp(brakePoint.source, brakePoint.flags);
  var last = 0;
  var match;
  while ((match = re.exec(content))) {
    if (match.index > last) chunks.push(content.slice(last, match.index));
    chunks.push({ base: match[1], marks: match[2] });
    last = match.index + match[0].length;
  }
  if (last < content.length) chunks.push(content.slice(last));
  return chunks;
}

function serializeCanonical(chunk) {
  var marks = uniquify(chunk.marks).sort(function (a, b) {
    return rankingMap[a] - rankingMap[b];
  }).join("");
  return applyReplacementRules(extendedRules, chunk.base + marks);
}

function normalizeText(content) {
  var chunks = parseChunks(content);
  var result = chunks.map(function (chunk) {
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
      kinzi: kinzi,
      onset: onset,
      medials: medials,
      vowel: vowel,
      coda: coda,
      tones: tones,
      marks: marks
    });
  }
  return syllables;
}

function serializeUnicode(syllables) {
  return syllables.map(function (syllable) {
    if (syllable.raw != null) return syllable.raw;
    return (syllable.kinzi ? KINZI : "") + syllable.onset + syllable.medials + syllable.vowel + syllable.coda + syllable.tones;
  }).join("");
}

const COLLAPSE = {
  unicode: "\u102b \u102c \u102d \u102e \u102f \u1030 \u1031 \u1032 \u1036 \u1037 \u1038 \u103a \u103b \u103c \u103d \u103e \u1039".split(" "),
  zawgyi: "\u102b \u102c \u102d \u102e \u102f \u1030 \u1031 \u1032 \u1033 \u1034 \u1036 \u1037 \u1038 \u1039 \u103a \u103b \u103c \u103d \u105a \u1060 \u1061 \u1062 \u1063 \u1064 \u1065 \u1066 \u1067 \u1068 \u1069 \u106a \u106b \u106c \u106d \u1070 \u1071 \u1072 \u1073 \u1074 \u1075 \u1076 \u1077 \u1078 \u1079 \u107a \u107b \u107c \u107d \u107e \u107f \u1080 \u1081 \u1082 \u1083 \u1084 \u1085 \u1087 \u1088 \u1089 \u108a \u108b \u108c \u108d \u108e \u1093 \u1094 \u1095 \u1096".split(" ")
};

function collapseMarks(content, fontType) {
  var marks = COLLAPSE[fontType] || COLLAPSE.unicode;
  for (var i = 0; i < marks.length; i++) {
    content = content.replace(new RegExp("[" + marks[i] + "]{2,}", "g"), marks[i]);
  }
  return content;
}

const BREAK_RULES = {
  zawgyi: [
    [/([\u1000-\u1021\u1023-\u1027\u1029\u102a\u104c-\u104f\u1086\u108f-\u1092])/g, "\u200B$1"],
    [/([\u1031][\u103b\u107e-\u1084]|[\u1031\u103b\u107e-\u1084])/g, "\u200B$1"],
    [/([\u1031\u103b\u107e-\u1084])\u200B([\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090])/g, "$1$2"],
    [/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014])\u200B([\u1000-\u1021\u1031\u103b\u1025\u1029\u106A\u106B\u107e-\u1084\u1086\u108F\u1090])/g, "$1$2"],
    [/\u200B([\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090]\u1039)/g, "$1"],
    [/(\s|\n)\u200B([\u1000-\u1021\u1023-\u1027\u1029\u102a\u104c-\u104f\u1086\u108f-\u1092])/g, "$1$2"],
    [/([\u1000-\u1021])\u200B([\u1000-\u1021\u1031\u103b\u107e-\u1084])/g, "$1$2"]
  ],
  unicode: [
    [/(\u103A)(\u1037)/g, "$2$1"],
    [/([\u1000-\u1021\u1023-\u1027\u1029\u102a\u103f\u104c-\u104f])/g, "\u200B$1"],
    [/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014]|\u1039)\u200B([\u1000-\u1021])/g, "$1$2"],
    [/\u200B(\u1004\u103A\u1039\u1037)/g, "$1"],
    [/\u200B([\u1000-\u1021]\u103A)/g, "$1"],
    [/(\s|\n)\u200B([\u1000-\u1021\u1023-\u1027\u1029\u102a\u103f\u104c-\u104f])/g, "$1$2"],
    [/([\u1000-\u1021])\u200B([\u1000-\u1021])/g, "$1$2"]
  ]
};

function breakParts(content, fontType) {
  var rules = BREAK_RULES[fontType];
  var text = content;
  for (var i = 0; i < rules.length; i++) {
    text = text.replace(rules[i][0], rules[i][1]);
  }
  text = text.replace(/^\u200B/, "");
  return text.split(/[\u200B\u200C]/);
}

function joinParts(parts, breakpoint) {
  var breakChar = breakpoint && breakpoint !== "\u200B" ? breakpoint : "\u200B";
  return parts.join(breakChar);
}

function fresh(rule) {
  return new RegExp(rule.source, rule.flags);
}

function replaceRepeated(content, rule) {
  var guard = 0;
  while (guard < 40) {
    guard += 1;
    if (!fresh(rule[0]).test(content)) break;
    var next = content.replace(fresh(rule[0]), rule[1]);
    if (next === content) break;
    content = next;
  }
  return content;
}

function convertText(content, from, to, debug) {
  var refLib = convertRules[from][to];
  var logs = debug ? { to: to, from: from, matched_patterns: [], steps: [] } : null;

  function record(rule, current) {
    if (!logs) return;
    if (!fresh(rule[0]).test(current)) return;
    logs.matched_patterns.push(rule[0].source);
    logs.steps.push(current);
  }

  for (var i = 0; i < refLib.oneTime.length; i++) {
    record(refLib.oneTime[i], content);
    content = content.replace(fresh(refLib.oneTime[i][0]), refLib.oneTime[i][1]);
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
  parseUnicode: parseUnicode,
  serializeUnicode: serializeUnicode,
  normalizeText: normalizeText,
  collapseMarks: collapseMarks,
  breakParts: breakParts,
  joinParts: joinParts,
  convertText: convertText
};
