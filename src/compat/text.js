// compat: 2.x normalize, syllBreak, spellingFix and truncate on the core (DESIGN.md §5.1, C20-C24). Layer L4.
// Owner: W8 (compat).
//
// Each function keeps 2.x's preamble and its order of calls. syllBreak, spellingFix and truncate each detect the
// font on a different text (§5.1), so each writes its own preamble rather than sharing one "clean, then choose the
// font" helper.

import { hasMyanmarBlockChar } from '../core/input.js';
import { DEFAULTS } from '../core/options.js';
import { normalizeText } from '../stages/normalize.js';
import { prepareBreakText, breakParts, breakString, collapseRepeatedMarks } from '../rules/segment.js';
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

// truncate(content, options) (2.x truncate.js, C23): at most `length` units, the omission included, cut at a
// syllable break. It reads every option before it looks at the content, and detects a missing font on the content
// as given (before trim and zero-width removal), then breaks the cleaned text (§5.1); 'win' and an unknown font
// throw (breakFont). Not always a prefix: a part that does not fit adds the words of it that do (DESIGN.md §10 Q5).
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
  return fitParts(breakParts(cleanText(text), font), budget).trim() + omission;
}

// 2.x truncate's reduce (truncate.js): whole parts while they fit in the budget; a part that does not fit
// adds each of its words, split on \s, that still fits, with a space after it. Nothing is added once the budget is
// used up, or when it is NaN.
function fitParts(parts, budget) {
  let kept = '';
  for (let i = 0; i < parts.length; i++) {
    const left = budget - kept.length;
    if (!(left > 0)) break;
    kept += parts[i].length <= left ? parts[i] : fittingWords(parts[i], left);
  }
  return kept;
}

// The words of a part that fit in `left` units, each with a space after it, in order; a word that does not fit is
// skipped, and later ones may still fit.
function fittingWords(part, left) {
  const words = part.split(/\s/);
  let fitted = '';
  for (let i = 0; i < words.length; i++) {
    if (words[i].length + 1 <= left - fitted.length) fitted += words[i] + ' ';
  }
  return fitted;
}
