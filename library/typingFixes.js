'use strict';
// Typing fixes for Unicode text whose syllables are already in storage order (storageOrder.js): letters and
// digits that look alike and are typed for each other, and a few misspellings. normalize applies them, and so
// does Zawgyi and Win conversion, so the two agree.

const ZERO = '\u1040';
const SEVEN = '\u1047';
const WA = '\u101D';
const RA = '\u101B';
const VISARGA = '\u1038';

// Typing fixes, once the marks are in order.
const TYPOS = [
  [/\u102D\u102E|\u102E\u102D/g, '\u102E'], // i with ii is ii
  [/\u102F\u1030|\u1030\u102F/g, '\u1030'], // u with uu is uu
  [/\u1029\u1031\u102C\u103A/g, '\u102A'], // o with e, aa and asat is au (UTN #11)
  [/(^|[^\u1040-\u1049])\u1044(?=\u1004\u103A\u1038)/g, '$1\u104E'] // the digit four typed for lagaung
];

// The look-alikes work on every language written in the Myanmar blocks, not only Burmese: Shan text has zero
// typed for wa too (issue #43).
// Combining marks: medials, vowel signs, asat and virama, of Burmese, Mon, Shan, Karen and the rest, and the
// Burmese tone marks.
const MARKS = '\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062\u1067\u1068\u1071-\u1074\u1082-\u1086\u109C\u109D' +
  '\uA9E5';
// The tone marks of the other languages. A tone alone doesn't make a zero or seven a letter, nor a wa or ra a
// letter in a number: Karen text types the Shan tone-2 (U+1087) after numbers as a comma.
const TONES = '\u1063\u1064\u1069-\u106D\u1087-\u108D\u108F\u109A\u109B\uAA7B-\uAA7D';
// Consonants, of Burmese and the other languages (Shan ka to ha is U+1075-U+1081).
const CONSONANTS = '\u1000-\u1021\u103F\u1050\u1051\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E' +
  '\uA9E0-\uA9E4\uA9E7-\uA9EF\uA9FA-\uA9FE\uAA60-\uAA76\uAA7A\uAA7E\uAA7F';
const MARK = new RegExp('[' + MARKS + ']');
const TONE = new RegExp('[' + TONES + ']');
const CONSONANT = new RegExp('[' + CONSONANTS + ']');
// A letter or mark of a word: anything in the blocks but digits and the section marks.
const WORD_CHAR = /[\u1000-\u103F\u104C-\u108F\u109A-\u109F\uA9E0-\uA9EF\uA9FA-\uA9FE\uAA60-\uAA7F]/;
// Burmese, Shan and Tai Laing digits.
const ANY_DIGIT = /[\u1040-\u1049\u1090-\u1099\uA9F0-\uA9F9]/;

function isDigit(ch) {
  return ch >= '\u1040' && ch <= '\u1049';
}

// A mark, medial, asat or virama: something that follows a base.
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
  return ch === '.' || ch === ',';
}

// The character at i is followed by a consonant with asat or virama, so it starts a closed syllable, as wa
// does in wa-ng (enter) and ra in ra-k (day).
function startsClosedSyllable(text, i) {
  if (!isConsonant(text.charAt(i + 1))) return false;
  var j = i + 2;
  while (text.charAt(j) === '\u1037' || text.charAt(j) === VISARGA) j++;
  return text.charAt(j) === '\u103A' || text.charAt(j) === '\u1039';
}

// A digit next to i, or across a decimal point or thousands separator.
function nextToDigit(text, i) {
  return ANY_DIGIT.test(text.charAt(i - 1)) || ANY_DIGIT.test(text.charAt(i + 1)) ||
    (isSeparator(text.charAt(i - 1)) && ANY_DIGIT.test(text.charAt(i - 2))) ||
    (isSeparator(text.charAt(i + 1)) && ANY_DIGIT.test(text.charAt(i + 2)));
}

// A bare wa or ra: no mark after it, tones aside, and not starting a closed syllable.
const BARE = '[\u101D\u101B](?![' + TONES + ']*[' + MARKS + ']|[' + CONSONANTS + '][\u1037\u1038]*[\u103A\u1039])';
// A run of digits and bare wa or ra, with at most one decimal point or thousands separator between two of
// them. (Requiring a digit in the pattern itself would backtrack over long runs of wa.)
const PART = '(?:[\u1040-\u1049]|' + BARE + ')';
const RUN = new RegExp(PART + '(?:[.,]?' + PART + ')*', 'g');
const HAS_DIGIT = /[\u1040-\u1049]/;

// Zero and seven look like wa and ra, and each is typed for the other. Only clear cases change.
function lookAlikes(text) {
  // A zero or seven is a letter when it carries a mark or starts a closed syllable. A visarga or tone alone
  // isn't enough: after digits the visarga is a colon (7:30) and a tone can be a comma. A zero inside a word
  // with no digit next to it is a letter too.
  text = text.replace(/[\u1040\u1047]/g, function (ch, i) {
    var j = i + 1;
    while (TONE.test(text.charAt(j))) j++;
    var next = text.charAt(j);
    var letter = (isMark(next) && next !== VISARGA) || startsClosedSyllable(text, i) ||
      (ch === ZERO && isWordChar(text.charAt(i - 1)) && !nextToDigit(text, i));
    return letter ? (ch === ZERO ? WA : RA) : ch;
  });

  // A bare wa or ra in a number is a digit. Wa or ra glued to the word before the number stays a letter, and
  // so does ra glued to the word after it.
  return text.replace(RUN, function (run, start) {
    if (!HAS_DIGIT.test(run)) return run;
    var glued = isWordChar(text.charAt(start - 1));
    var after = text.charAt(start + run.length);
    var out = '';
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
  lookAlikes: lookAlikes,
  typos: fixTypos
};
