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
import { enter, cleanText, chooseFontLegacy } from './input.js';
import { legacyBreakFont, legacyCollapseFont, NO_RULES, toJoinSeparator } from './legacy.js';

// normalize(content) (normalization.js:9-24, C24): Unicode text in the storage order of UTN #11, with the typing
// fixes, as NFC. There is no Myanmar gate: text with no Myanmar still gets NFC (decision 16).
export function normalize(content) {
  const input = enter('normalize', content);
  return input.kind === 'text' ? normalizeText(input.value) : input.value;
}

// syllBreak(content, fontType, breakpoint) (syllBreak.js:6-23, C21): the text with the separator between its
// syllables. It cleans the text first and detects a missing font on the cleaned text. The rule table is looked up
// before the separator is converted, as 2.x's joinParts(breakParts(...)) does (C12, C20).
export function syllBreak(content, fontType, breakpoint) {
  const input = enter('syllBreak', content);
  if (input.kind !== 'text' || !hasMyanmarBlockChar(input.value)) return input.value;
  const text = cleanText(input.value);
  const font = legacyBreakFont(chooseFontLegacy(fontType, text, detectForRouting));
  const separator = breakSeparator(breakpoint);
  if (font === NO_RULES) return text;
  // An empty separator joins the pieces, which gives back the prepared text (row U1 applied).
  return separator === '' ? prepareBreakText(text, font) : breakString(text, font, separator);
}

// 2.x joinParts's separator (syllable.js:272-275): a falsy separator, or U+200B, is U+200B; anything else is
// converted as Array#join converts it.
function breakSeparator(breakpoint) {
  return breakpoint && breakpoint !== DEFAULTS.breakSeparator ? toJoinSeparator(breakpoint) : DEFAULTS.breakSeparator;
}

// spellingFix(content, fontType) (spellingCheck.js:6-22, C22): each run of one repeated mark as one mark. It
// detects a missing font on the text as given, then cleans it, then collapses with the font's set of marks.
export function spellingFix(content, fontType) {
  const input = enter('spellingFix', content);
  if (input.kind !== 'text' || !hasMyanmarBlockChar(input.value)) return input.value;
  const font = chooseFontLegacy(fontType, input.value, detectForRouting);
  const text = cleanText(input.value);
  const marks = legacyCollapseFont(font);
  return marks === NO_RULES ? text : collapseRepeatedMarks(text, marks);
}

// truncate(content, options) (truncate.js:6-52, C23): at most `length` units, the omission included, cut at a
// syllable break. It reads every option before it looks at the content, and detects a missing font on the content
// as given (before trim and zero-width removal), then breaks the cleaned text (§5.1). Not always a prefix: a part
// that does not fit adds the words of it that do (§7 #5 of the plan).
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
  const font = chooseFontLegacy(fontType, text, detectForRouting);
  const cleaned = cleanText(text);
  const breakFont = legacyBreakFont(font);
  const parts = breakFont === NO_RULES ? [cleaned] : breakParts(cleaned, breakFont);
  return fitParts(parts, budget).trim() + omission;
}

// 2.x truncate's reduce (truncate.js:34-51): whole parts while they fit in the budget; a part that does not fit
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
