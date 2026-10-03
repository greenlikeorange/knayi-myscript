'use strict';
// Unicode to Zawgyi rules are [pattern, replacement] or [pattern, replacement, label]. Debugging output logs a
// rule that fires by its label, or by its pattern's source when it has none (convertText, record).
//
// A pattern that is a plain literal starting in U+1000-U+1010 has its first character in a class of one, as in
// /[\u1004]\u103a\u1039/. V8 finds the first character of a plain literal, as of an indexOf needle, by the
// higher of its two bytes. In that range the byte is 0x10, which every Myanmar character has, so the search
// stops at each one and takes 6 to 50 times as long on Myanmar text. Such a rule keeps the source it had before
// as its label, so debugging output does not change. Only that range: from U+1011 on, the low byte is the
// higher one and the search is fast, and a class is slower than the literal (test/unit/literal-search.test.js).
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

        [/[\u1004]\u103a\u1039/g, "\u1064", "\\u1004\\u103a\\u1039"],
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
        [/[\u100d]\u1039\u100e/g, "\u106f", "\\u100d\\u1039\\u100e"],
        [/[\u100f]\u1039\u100d/g, "\u1091", "\\u100f\\u1039\\u100d"],
        [/[\u100d]\u1039\u100d/g, "\u106e", "\\u100d\\u1039\\u100d"],
        [/[\u100b]\u1039\u100c/g, "\u1092", "\\u100b\\u1039\\u100c"],
        [/\u1039\u100c/g, "\u106d"],
        [/[\u100b]\u1039\u100b/g, "\u1097", "\\u100b\\u1039\\u100b"],
        [/\u1039\u100b/g, "\u106c"],
        // [/\u1009/g, "\u106a"],
        [/\u1039\u1005\u103b/g, "\u1069"],
        [/\u1039\u1008/g, "\u1069"], // stacked jha, which the rule above writes for stacked ca with medial ya
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
      // Rules that apply while they match. One replace is enough: each replaces the medial ra its pattern starts
      // with (U+103B or U+107E) by another glyph, and the rest of its pattern matches neither of those two nor
      // the glyphs the rule writes, so one replace finds every match and makes no new one (test/syllable.test.js).
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
  }
};

const C = "က-အ";
const M = "ျြွှ";
const V = "ါာိီုူေဲ";
const S = "္";
const A = "်";
const F = "ံ့း";
const MEDIALS = M;
const VOWELS = V;
const TONES = F;
const ASAT = A;
const VIRAMA = S;
const KINZI = "\u1004" + ASAT + VIRAMA;
const CONSONANT = new RegExp("[" + C + "]");

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

// The marks spellingFix collapses, per font: a mark typed two or more times in a row becomes one. One regex per
// font does it in one pass: its class takes a mark, \1 the same mark again and \1* any more, so a run of one mark
// becomes that mark, and two different marks stay as they are. \1\1* matches what \1+ matches, but V8 runs it
// faster on text where marks are rarely repeated: on one long Unicode string, spellingFix takes about two thirds
// of the time with it under Node.
const COLLAPSE_MARKS = {
  unicode: "\u102b\u102c\u102d\u102e\u102f\u1030\u1031\u1032\u1036\u1037\u1038\u103a\u103b\u103c\u103d\u103e\u1039",
  zawgyi: "\u102b\u102c\u102d\u102e\u102f\u1030\u1031\u1032\u1033\u1034\u1036\u1037\u1038\u1039\u103a\u103b\u103c\u103d\u105a\u1060\u1061\u1062\u1063\u1064\u1065\u1066\u1067\u1068\u1069\u106a\u106b\u106c\u106d\u1070\u1071\u1072\u1073\u1074\u1075\u1076\u1077\u1078\u1079\u107a\u107b\u107c\u107d\u107e\u107f\u1080\u1081\u1082\u1083\u1084\u1085\u1087\u1088\u1089\u108a\u108b\u108c\u108d\u108e\u1093\u1094\u1095\u1096"
};

const COLLAPSE = {
  unicode: new RegExp("([" + COLLAPSE_MARKS.unicode + "])\\1\\1*", "g"),
  zawgyi: new RegExp("([" + COLLAPSE_MARKS.zawgyi + "])\\1\\1*", "g")
};

function collapseMarks(content, fontType) {
  // Zawgyi has marks of its own. Any other name, 'win' and unknown names included, uses the Unicode marks: an own
  // property, so that a name such as 'constructor' finds no Object.prototype member.
  var re = Object.prototype.hasOwnProperty.call(COLLAPSE, fontType) ? COLLAPSE[fontType] : COLLAPSE.unicode;
  re.lastIndex = 0;
  return content.replace(re, "$1");
}

const BREAK_RULES = {
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

// The text with U+200B at each syllable break, and none at the start. `whole` is the whole text when content is
// only its start (breakStart).
function markBreaks(content, fontType, whole) {
  var rules = BREAK_RULES[fontType];
  var text = content;
  for (var i = 0; i < rules.length; i++) {
    // A third item is a pattern that turns the rule off for the whole text (see the Zawgyi kinzi rule).
    if (rules[i][2] && rules[i][2].test(whole || content)) continue;
    rules[i][0].lastIndex = 0;
    text = text.replace(rules[i][0], rules[i][1]);
  }
  return text.replace(/^\u200B/, "");
}

function breakParts(content, fontType) {
  return markBreaks(content, fontType).split(/[\u200B\u200C]/);
}

// A break rule reads whitespace only as the first character of a match: the rules that keep a syllable with the
// space or opening punctuation before it start with that character, and no other rule reads whitespace
// (test/syllable.test.js checks the patterns). So no match runs across the start of a whitespace character, and the
// rules break the text before one as they break that part of the whole text. No rule breaks before whitespace.
const WHITESPACE = /\s/g;

// The parts of the start of the text, for truncate, which keeps at most `length` code units of it. For text with no
// U+200B or U+200C (truncate removes them with cleanText), these are the parts breakParts gives for the whole text,
// up to the first whitespace character at an index above `length`, where the last part stops short, after the
// `length` code units truncate reads. With no such whitespace, the parts of the whole text.
function breakStart(content, fontType, length) {
  WHITESPACE.lastIndex = length + 1;
  var space = content.length > length && WHITESPACE.exec(content);
  if (!space) return breakParts(content, fontType);
  return markBreaks(content.slice(0, space.index), fontType, content).split(/[\u200B\u200C]/);
}

// U+200B, the break the rules write, is the default breakpoint, also for a falsy one.
function isDefaultBreakpoint(breakpoint) {
  return !breakpoint || breakpoint === "\u200B";
}

function joinParts(parts, breakpoint) {
  return parts.join(isDefaultBreakpoint(breakpoint) ? "\u200B" : breakpoint);
}

// The text with the breakpoint between its syllables, for text with no U+200B or U+200C (syllBreak removes them
// with cleanText). For the default breakpoint the marked text is the result: the rules write no U+200C, so
// splitting it into parts and joining them with U+200B would give it back.
function breakText(content, fontType, breakpoint) {
  if (isDefaultBreakpoint(breakpoint)) return markBreaks(content, fontType);
  return joinParts(breakParts(content, fontType), breakpoint);
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

function convertText(content, from, to, debug) {
  var refLib = convertRules[from][to];
  var logs = debug ? { to: to, from: from, matched_patterns: [], steps: [] } : null;

  function record(rule, current) {
    if (!logs) return;
    logs.matched_patterns.push(rule[2] || rule[0].source);
    logs.steps.push(current);
  }

  for (var i = 0; i < refLib.oneTime.length; i++) {
    var next = replaceOnce(content, refLib.oneTime[i]);
    // Rules with an optional tail match every run of marks; log only the ones that changed the text.
    if (next !== content) record(refLib.oneTime[i], content);
    content = next;
  }
  // An asLongAsMatch rule is logged when it matches, and one replace leaves no match (convertRules).
  for (var j = 0; j < refLib.asLongAsMatch.length; j++) {
    if (!ruleMatches(refLib.asLongAsMatch[j], content)) continue;
    record(refLib.asLongAsMatch[j], content);
    content = replaceOnce(content, refLib.asLongAsMatch[j]);
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
  collapseMarks: collapseMarks,
  breakParts: breakParts,
  breakStart: breakStart,
  joinParts: joinParts,
  breakText: breakText,
  convertText: convertText
};
