// Typing fixes on Unicode text whose syllables are already in storage order: typos, the digits and letters that
// look alike, and zero typed as wa (DESIGN.md §2.3, §3.9; research/normalize.md §2-3). Layer L3 rules: imports
// only L0. Owner: W2 (typing-fixes).
//
// The two pipelines run the fixes in different orders, on purpose until 3.0 decides (DESIGN.md §10 Q8):
// normalize runs typos, then look-alikes; Zawgyi and Win conversion run zero as wa, then look-alikes, then typos.
// The stage lists own that order (DESIGN.md §7.4). This module only provides the functions.
//
// How the functions read:
// - Each pass finds its candidates with one regex scan from left to right, or indexOf, and decides by char code.
//   Around a candidate it reads only that candidate's own tones, closed syllable or number, so the time is linear
//   (DESIGN.md §1.2 rule 6).
// - Each returns its input string when nothing changes (copy-through). Those that 3.0's pipelines run with an edit
//   log have a twin, named ...Logged, that takes an EditLog (core/edits.js) and records there every span it
//   replaced, at the one place it writes the replacement (DESIGN.md §11.3). The plain functions take the text alone,
//   so a stage list can name them as its run(text, ctx), as 2.x's did.
// - charCodeAt before the start or past the end is NaN, which no predicate accepts, so the edges of the text need
//   no case of their own.
// - The global regexes are this module's own. Each exec loop sets lastIndex to 0 first and runs until exec
//   returns null, which leaves lastIndex at 0 again (DESIGN.md §4 rule 1).
// - The script-wide classes (isScript*) cover every language of the three Myanmar blocks, not only Burmese
//   (issue #43).

import { deepFreeze } from '../freeze.js';
import { EditLog, composeEdits } from '../core/edits.js';
import {
  CP, isBurmeseDigit, isScriptDigit, isScriptMark, isScriptTone, isScriptConsonant, isScriptWordChar
} from '../script/codes.js';

// The units the fixes write, as strings.
const ZERO_TEXT = '\u1040';
const SEVEN_TEXT = '\u1047';
const WA_TEXT = '\u101D';
const RA_TEXT = '\u101B';
const II_TEXT = '\u102E';
const UU_TEXT = '\u1030';
const LETTER_AU_TEXT = '\u102A';
const LAGAUNG_TEXT = '\u104E';

// ---------------------------------------------------------------------------------------------------------------
// Typos (spec/typoRows.js)

// The rows of spec/typoRows.js as one alternation, in row order: typo.ii, typo.uu, typo.au, typo.lagaung. Each
// row starts with its own units, no two rows' matches overlap, and no replacement makes or unmakes a match of
// another row, so one scan from left to right equals 2.x's four passes (DESIGN.md §3.9). typo.lagaung's
// lookahead is ES2015; its "no digit before the four" is checked by typoFix.
const TYPOS = /\u102D\u102E|\u102E\u102D|\u102F\u1030|\u1030\u102F|\u1029\u1031\u102C\u103A|\u1044(?=\u1004\u103A\u1038)/g;

// The 4 rules of spec/typoRows.js in one scan (2.x typos, typingFixes.js:116-121). An exec loop rather than
// String#replace with a function: the same scan, without replace's cost per call, which dominates on short text.
// scanTypos is this loop with what 3.0 adds (whole runs, edit logs); this one stays as it is, so that a bundle of
// 2.x's API (compat) carries none of that.
export function fixTypos(text) {
  let out = '';
  let copied = 0;
  TYPOS.lastIndex = 0;
  let found;
  while ((found = TYPOS.exec(text)) !== null) {
    const at = found.index;
    const fixed = typoFix(text, at);
    if (fixed === null) continue;
    out += text.slice(copied, at) + fixed;
    copied = at + found[0].length;
  }
  return copied === 0 ? text : out + text.slice(copied);
}

// The typo rows applied until they change nothing, in one scan: 3.0's normalize (decision 36; DESIGN.md §11.2).
// typo.ii and typo.uu join two signs of one run of i and ii (or u and uu) into one ii, so a longer run needs one
// pass per i: fixTypos turns ိိီ into ိီ, and a second pass into ီ. Here each run is read whole: a run that holds
// both signs becomes its count of ii (or uu), which is what repeating the row ends with, since joining an i to an
// ii keeps the ii, and two ii never join. The other two rows make nothing another pass would change.
export function settleTypos(text) {
  return scanTypos(text, true, null);
}

// settleTypos, recording its edits in `log`.
export function settleTyposLogged(text, log) {
  return scanTypos(text, true, log);
}

// fixTypos, or settleTypos when `wholeRuns`, recording the edits in `log` when it is not null.
function scanTypos(text, wholeRuns, log) {
  let out = '';
  let copied = 0;
  TYPOS.lastIndex = 0;
  let found;
  while ((found = TYPOS.exec(text)) !== null) {
    let start = found.index;
    let end = start + found[0].length;
    let fixed = typoFix(text, start);
    if (fixed === null) continue;
    if (wholeRuns && (fixed === II_TEXT || fixed === UU_TEXT)) {
      start = vowelRunStart(text, start, copied);
      end = vowelRunEnd(text, end);
      fixed = joinedVowelRun(text, start, end, fixed);
      TYPOS.lastIndex = end;
    }
    out += text.slice(copied, start);
    if (log !== null) log.add(start, end, out.length, out.length + fixed.length);
    out += fixed;
    copied = end;
  }
  return copied === 0 ? text : out + text.slice(copied);
}

// The two signs of the run the pair at `at` belongs to: i and ii, or u and uu.
function isSignOfRun(code, first) {
  if (first === CP.I || first === CP.II) return code === CP.I || code === CP.II;
  return code === CP.U || code === CP.UU;
}

// The run reaches back over the signs before the pair, but not into text an earlier fix wrote.
function vowelRunStart(text, at, copied) {
  const first = text.charCodeAt(at);
  let start = at;
  while (start > copied && isSignOfRun(text.charCodeAt(start - 1), first)) start--;
  return start;
}

function vowelRunEnd(text, end) {
  const first = text.charCodeAt(end - 1);
  while (isSignOfRun(text.charCodeAt(end), first)) end++;
  return end;
}

// The run text[start, end) joined: one long sign for each long sign in it.
function joinedVowelRun(text, start, end, longSign) {
  const longCode = longSign.charCodeAt(0);
  let joined = '';
  for (let k = start; k < end; k++) {
    if (text.charCodeAt(k) === longCode) joined += longSign;
  }
  return joined;
}

// What the typo TYPOS found at `at` becomes, or null when it stays as typed.
function typoFix(text, at) {
  switch (text.charCodeAt(at)) {
    case CP.I:
    case CP.II:
      return II_TEXT; // typo.ii: i with ii, in either order, is ii
    case CP.U:
    case CP.UU:
      return UU_TEXT; // typo.uu: u with uu, in either order, is uu
    case CP.LETTER_O:
      return LETTER_AU_TEXT; // typo.au: o, e, aa and asat is au (UTN #11)
    default:
      // typo.lagaung: four before nga, asat and visarga is lagaung, unless a digit comes before it. The unit
      // before is read here, because lookbehind is outside ES2015. No other row writes or removes a digit, so it
      // is the unit 2.x's own pass sees.
      return isBurmeseDigit(text.charCodeAt(at - 1)) ? null : LAGAUNG_TEXT;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Numbers

// Two 2.x rules decide whether a unit sits in a number. They differ, and each is kept as it is (DESIGN.md
// §10 Q20, §2.3): each caller passes its own context to isInNumber.
export const NUMBER_CONTEXT = /* @__PURE__ */ deepFreeze({
  // zeroAsWa (storageOrder.js:59-61, :448-457): Burmese digits, and + - * / as signs.
  ZERO_AS_WA: { isDigit: isBurmeseDigit, isSign: isArithmeticSign },
  // The look-alikes (typingFixes.js:36-37, :69-74): Burmese, Shan and Tai Laing digits, and no signs.
  LOOK_ALIKES: { isDigit: isScriptDigit, isSign: isNoSign }
});

// Whether the unit at i sits in a number of the context: the unit before or after it is a digit or a sign, or a
// decimal point or thousands separator next to it has a digit beyond it.
export function isInNumber(text, i, context) {
  const before = text.charCodeAt(i - 1);
  const after = text.charCodeAt(i + 1);
  if (context.isDigit(before) || context.isDigit(after) || context.isSign(before) || context.isSign(after)) {
    return true;
  }
  return (isNumberSeparator(before) && context.isDigit(text.charCodeAt(i - 2))) ||
    (isNumberSeparator(after) && context.isDigit(text.charCodeAt(i + 2)));
}

// A decimal point or thousands separator: '.' or ','.
function isNumberSeparator(code) {
  return code === 0x2E || code === 0x2C;
}

// + - * /: a zero next to one is a digit in a sum (storageOrder.js:60).
function isArithmeticSign(code) {
  return code === 0x2B || code === 0x2D || code === 0x2A || code === 0x2F;
}

// The look-alikes count no signs (typingFixes.js:70-74).
function isNoSign() {
  return false;
}

// ---------------------------------------------------------------------------------------------------------------
// Zero as wa

// The font pipeline's 'zero as wa' stage (2.x zeroAsWa, storageOrder.js:446-457). The fonts type wa as zero, so
// a zero is wa unless it sits in a number: research/zawgyi-to-unicode.md §2, and §1 bug K for a zero after a
// decimal point. Each decision reads the text as it came in.
export function zeroAsWa(text) {
  let out = '';
  let copied = 0;
  for (let i = text.indexOf(ZERO_TEXT); i !== -1; i = text.indexOf(ZERO_TEXT, i + 1)) {
    if (isInNumber(text, i, NUMBER_CONTEXT.ZERO_AS_WA)) continue;
    out += text.slice(copied, i) + WA_TEXT;
    copied = i + 1;
  }
  return copied === 0 ? text : out + text.slice(copied);
}

// ---------------------------------------------------------------------------------------------------------------
// Look-alikes (research/normalize.md §3, "Look-alikes"): zero and seven look like wa and ra, and each is typed for
// the other. Only clear cases change.

// A zero or seven: what the first pass looks at.
const ZERO_OR_SEVEN = /[\u1040\u1047]/g;

// A Burmese digit: the anchor of each number the second pass reads.
const BURMESE_DIGIT = /[\u1040-\u1049]/g;

// readLettersAsDigits(readDigitsAsLetters(text)): 2.x lookAlikes (typingFixes.js:84-114). Text with no Burmese
// digit comes back at once: the first pass reads only zero and seven, and the second only numbers, which hold a
// digit. That one scan, instead of the two passes' two, is most of the time on words, which seldom hold a digit.
export function fixLookAlikes(text) {
  if (text.search(BURMESE_DIGIT) === -1) return text;
  return readLettersAsDigits(readDigitsAsLetters(text));
}

// fixLookAlikes, recording in `log` the edits of its two passes together.
export function fixLookAlikesLogged(text, log) {
  if (text.search(BURMESE_DIGIT) === -1) return text;
  const first = new EditLog(log.rule);
  const second = new EditLog(log.rule);
  const out = readLettersAsDigits(readDigitsAsLetters(text, first), second);
  log.addAll(composeEdits(first.edits, second.edits));
  return out;
}

// 2.x lookAlikes, first pass (typingFixes.js:86-96): a zero or seven that reads as a letter becomes wa or ra.
// Each decision reads the text as it came in. log: an EditLog that records the edits, or none.
export function readDigitsAsLetters(text, log) {
  let out = '';
  let copied = 0;
  ZERO_OR_SEVEN.lastIndex = 0;
  let found;
  while ((found = ZERO_OR_SEVEN.exec(text)) !== null) {
    const i = found.index;
    const code = text.charCodeAt(i);
    if (!readsAsLetter(text, i, code)) continue;
    out += text.slice(copied, i);
    if (log) log.add(i, i + 1, out.length, out.length + 1);
    out += code === CP.DIGIT_ZERO ? WA_TEXT : RA_TEXT;
    copied = i + 1;
  }
  return copied === 0 ? text : out + text.slice(copied);
}

// research/normalize.md §3, "zero and seven as letters" (and issue #43 for the marks of the other languages). A
// zero or seven at i is a letter when:
// - it carries a mark other than visarga, tones skipped: after digits a visarga is a colon (၁၇း၂၁), and a tone
//   alone can be a comma (S'gaw Karen types the Shan tone-2 after numbers, ၁၄း၁၅ႇ);
// - or it starts a closed syllable (၀င်, ဆို၇င်);
// - or, for zero, it follows a letter or mark of a word and has no digit next to it (ဘ၀).
function readsAsLetter(text, i, code) {
  const next = text.charCodeAt(skipTones(text, i + 1));
  if (isScriptMark(next) && next !== CP.VISARGA) return true;
  if (startsClosedSyllable(text, i)) return true;
  return code === CP.DIGIT_ZERO && isScriptWordChar(text.charCodeAt(i - 1)) &&
    !isInNumber(text, i, NUMBER_CONTEXT.LOOK_ALIKES);
}

// The index of the first unit at or after i that is not a tone mark of the other languages.
function skipTones(text, i) {
  while (isScriptTone(text.charCodeAt(i))) i++;
  return i;
}

// Whether a consonant with asat or virama follows the unit at i, dot below and visarga allowed between: the unit
// then starts a closed syllable, as wa does in ဝင် (enter) and ra in ရက် (day) (typingFixes.js:60-67).
function startsClosedSyllable(text, i) {
  if (!isScriptConsonant(text.charCodeAt(i + 1))) return false;
  let j = i + 2;
  while (text.charCodeAt(j) === CP.DOT_BELOW || text.charCodeAt(j) === CP.VISARGA) j++;
  const code = text.charCodeAt(j);
  return code === CP.ASAT || code === CP.VIRAMA;
}

// 2.x lookAlikes, second pass (typingFixes.js:98-113): a bare wa or ra in a number is a digit, zero or seven
// (၄ဝဝ, ၂၉,ဝ၂၈, ၂၀၁ရ; research/normalize.md §3).
// A number is a run of Burmese digits and bare wa and ra, with at most one decimal point or thousands separator
// between two of them, that holds a digit (2.x RUN and HAS_DIGIT). Each number is found from one of its digits,
// out to both ends, and read once; 2.x's regex found the same runs from their first unit, but a pattern that
// required the digit would backtrack over long runs of wa. log: an EditLog that records the edits, or none.
export function readLettersAsDigits(text, log) {
  let out = '';
  let copied = 0;
  BURMESE_DIGIT.lastIndex = 0;
  let found;
  while ((found = BURMESE_DIGIT.exec(text)) !== null) {
    const start = numberStart(text, found.index);
    const end = numberEnd(text, found.index + 1);
    BURMESE_DIGIT.lastIndex = end;
    // Wa or ra glued to the word before the number stays a letter, up to the number's first digit.
    let glued = isScriptWordChar(text.charCodeAt(start - 1));
    // Ra glued to the word after the number stays a letter too (၂ရတယ်, research/normalize.md §3).
    const raEndsWordAfter = isScriptWordChar(text.charCodeAt(end));
    for (let k = start; k < end; k++) {
      const code = text.charCodeAt(k);
      if (isBurmeseDigit(code)) glued = false;
      const digit = glued ? null : digitForLetter(code, k + 1 === end && raEndsWordAfter);
      if (digit === null) continue;
      out += text.slice(copied, k);
      if (log) log.add(k, k + 1, out.length, out.length + 1);
      out += digit;
      copied = k + 1;
    }
  }
  return copied === 0 ? text : out + text.slice(copied);
}

// The digit a wa or ra of a number reads as, or null: wa is zero, and ra is seven unless it is glued to the word
// after the number. Digits and separators stay as they are.
function digitForLetter(code, gluedToWordAfter) {
  if (code === CP.WA) return ZERO_TEXT;
  if (code === CP.RA && !gluedToWordAfter) return SEVEN_TEXT;
  return null;
}

// The first unit of the number that holds the part at i: back over parts, and over one separator between two
// parts.
function numberStart(text, i) {
  for (;;) {
    if (isNumberPart(text, i - 1)) i -= 1;
    else if (isNumberSeparator(text.charCodeAt(i - 1)) && isNumberPart(text, i - 2)) i -= 2;
    else return i;
  }
}

// The end of the number whose parts reach up to end, exclusive: on over parts, and over one separator between two
// parts.
function numberEnd(text, end) {
  for (;;) {
    if (isNumberPart(text, end)) end += 1;
    else if (isNumberSeparator(text.charCodeAt(end)) && isNumberPart(text, end + 1)) end += 2;
    else return end;
  }
}

// A part of a number: a Burmese digit, or a bare wa or ra (2.x PART, typingFixes.js:80).
function isNumberPart(text, i) {
  const code = text.charCodeAt(i);
  if (isBurmeseDigit(code)) return true;
  return (code === CP.WA || code === CP.RA) && isBareWaOrRa(text, i);
}

// A wa or ra with no mark after it, tones skipped, that starts no closed syllable (2.x BARE, typingFixes.js:77).
// The tone and mark classes are disjoint, so skipping every tone first is what the 2.x lookahead's backtracking
// tries.
function isBareWaOrRa(text, i) {
  return !isScriptMark(text.charCodeAt(skipTones(text, i + 1))) && !startsClosedSyllable(text, i);
}
