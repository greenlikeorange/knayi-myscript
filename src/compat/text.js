// compat: 2.x normalize, syllBreak, spellingFix and truncate on the core (DESIGN.md §5.1, C20-C24). Layer L4.
// Owner: W8 (compat).
//
// Each function keeps 2.x's preamble and its order of calls. syllBreak, spellingFix and truncate each detect the
// font on a different text (§5.1), so each writes its own preamble rather than sharing one "clean, then choose the
// font" helper.

import { hasMyanmarBlockChar } from '../core/input.js';
import { DEFAULTS } from '../core/options.js';
import { normalizeText } from '../stages/normalize.js';
import { prepareBreakText, forEachBreak, breakString, collapseRepeatedMarks } from '../rules/segment.js';
import { detectForRouting } from './fontDetect.js';
import { enter, cleanText, resolveFont, givenName, breakFont } from './input.js';
import { toJoinSeparator } from './legacy.js';

// normalize(content) (2.x normalization.js, C24): Unicode text in the storage order of UTN #11, with the typing
// fixes, as NFC. There is no Myanmar gate: text with no Myanmar still gets NFC (decision 16).
export function normalize(content) {
  const input = enter('normalize', content);
  return input.kind === 'text' ? normalizeText(input.value) : input.value;
}

// syllBreak(content, fontType, breakpoint) (2.x syllBreak.js, C21): the text with the separator between its
// syllables. It cleans the text first and detects a missing font on the cleaned text; 'win' and an unknown font
// throw (breakFont). The font is read before the separator is converted, as 2.x's breakText does (C20).
export function syllBreak(content, fontType, breakpoint) {
  const input = enter('syllBreak', content);
  if (input.kind !== 'text' || !hasMyanmarBlockChar(input.value)) return input.value;
  const text = cleanText(input.value);
  const font = breakFont(fontType, 'syllBreak') || detectForRouting(text);
  const separator = breakSeparator(breakpoint);
  // An empty separator joins the pieces, which gives back the prepared text (row U1 applied).
  return separator === '' ? prepareBreakText(text, font) : breakString(text, font, separator);
}

// 2.x joinParts's separator (syllable.js:272-275): a falsy separator, or U+200B, is U+200B; anything else is
// converted as Array#join converts it.
function breakSeparator(breakpoint) {
  return breakpoint && breakpoint !== DEFAULTS.breakSeparator ? toJoinSeparator(breakpoint) : DEFAULTS.breakSeparator;
}

// spellingFix(content, fontType) (2.x spellingCheck.js, C22): each run of one repeated mark as one mark. A font
// that is not a string, or '', is detected on the text as given; then the text is cleaned and collapsed with the
// Zawgyi marks for a name of Zawgyi, and with the Unicode marks for any other name, 'win' and unknown names
// included (2.x 24f81c6).
export function spellingFix(content, fontType) {
  const input = enter('spellingFix', content);
  if (input.kind !== 'text' || !hasMyanmarBlockChar(input.value)) return input.value;
  const name = givenName(fontType);
  const font = name === null ? detectForRouting(input.value) : resolveFont(name);
  return collapseRepeatedMarks(cleanText(input.value), font === 'zawgyi' ? 'zawgyi' : 'unicode');
}

// truncate(content, options) (2.x truncate.js, C23): at most `length` units, the omission included: the start of the
// cleaned text that fits, trimmed, then the omission (2.11, 41984eb). It reads every option before it looks at the
// content, and detects a missing font on the content as given (before trim and zero-width removal), then breaks the
// cleaned text (§5.1); 'win' and an unknown font throw (breakFont).
export function truncate(content, options) {
  const settings = options || {};
  const fontType = settings.fontType;
  const length = settings.length || DEFAULTS.truncate.length;
  const omission = settings.omission || DEFAULTS.truncate.omission;
  const budget = length - omission.length;
  const input = enter('truncate', content);
  if (input.kind === 'missing') return '';
  const text = input.value;
  if (text === '' || !hasMyanmarBlockChar(text)) return text.substr(0, budget) + omission;
  const font = breakFont(fontType, 'truncate') || detectForRouting(text);
  return startThatFits(prepareBreakText(cleanText(text), font), font, budget).trim() + omission;
}

// The last white space of a text, and the units after it, which are not white space: JavaScript's \s, as 2.x reads it.
const LAST_WHITE_SPACE = /\s\S*$/;

// 2.11 truncate's fitParts over the syllables of the prepared text (2.x truncate.js fitParts, syllableRules.js
// breakStart): the syllables while they fit in the budget, then, of the first syllable that does not fit, the longest
// start that ends in white space and fits, so the words of it that fit with the white space after them. That is the
// longest start within the budget that ends at a syllable break or after white space. The breaks are read only up to
// the first one past the budget (forEachBreak stops there), as 2.11 breaks only the start of the text. Written so that
// a budget that is not a number (NaN) keeps nothing, as 2.x's comparisons do.
function startThatFits(prepared, font, budget) {
  if (prepared.length <= budget) return prepared;
  let kept = 0;
  forEachBreak(prepared, font, (index) => {
    if (!(index <= budget)) return false;
    kept = index;
    return true;
  });
  if (!(budget - kept > 0)) return prepared.slice(0, kept);
  return prepared.slice(0, kept + prepared.slice(kept, budget).search(LAST_WHITE_SPACE) + 1);
}
