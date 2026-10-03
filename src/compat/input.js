// compat: the 2.x preamble of every public function: input policy, cleaning and font names (DESIGN.md §5.1,
// C5-C11, D1). Layer L4. Owner: W8 (compat).
//
// The core trusts its callers to pass strings and known font names (§4 rule 4). These are the 2.x checks that
// stand in front of it, with 2.x's lenient answers: 2.x never throws on purpose, it warns and returns.

import { deepFreeze } from '../freeze.js';
import { FONT_ALIASES, stripZeroWidthBreaks } from '../core/input.js';
import { report, MESSAGES } from './globalOptions.js';

// The fallback of the 2.x routing detection: a tie means Zawgyi (decision 13; 2.x fontDetect's fallback).
export const ON_TIE_ASSUME_ZAWGYI = 'zawgyi';

// Per public function (C6, C7):
// - emptyIsMissing: '' counts as missing content, with null, undefined, 0, false and NaN (contentGate.js:11-14).
//   truncate alone takes '' as text (2.x truncate);
// - stringifyOther: a value that is not a string is read as String(value), like lodash.truncate (2.x truncate).
//   Every other function returns such a value as it is (fontDetect returns its fallback instead).
export const INPUT_POLICY = /* @__PURE__ */ deepFreeze({
  fontDetect: { emptyIsMissing: true, stringifyOther: false },
  fontConvert: { emptyIsMissing: true, stringifyOther: false },
  syllBreak: { emptyIsMissing: true, stringifyOther: false },
  spellingFix: { emptyIsMissing: true, stringifyOther: false },
  truncate: { emptyIsMissing: false, stringifyOther: true },
  normalize: { emptyIsMissing: true, stringifyOther: false }
});

// The first step of every 2.x public function. Returns { kind, value }:
// - 'missing', value '': missing content, after the silent-aware warning;
// - 'other', value: a value that is not a string, unwrapped from a String object if it was one;
// - 'text', value: a string, or what stringifyOther made of another value.
export function enter(apiName, content) {
  const policy = INPUT_POLICY[apiName];
  const value = unboxString(content);
  if (!value && (policy.emptyIsMissing || value !== '')) {
    report('warn', MESSAGES.missingContent(apiName));
    return { kind: 'missing', value: '' };
  }
  if (typeof value === 'string') return { kind: 'text', value: value };
  if (policy.stringifyOther) return { kind: 'text', value: String(value) };
  return { kind: 'other', value: value };
}

// A String object as the string it wraps, found by its [object String] tag; any other value as it is
// (contentGate.js:17-19, C5).
export function unboxString(content) {
  return Object.prototype.toString.call(content) === '[object String]' ? String(content) : content;
}

// Trimmed, without U+200B and U+200C: what 2.x reads breaks and evidence from (contentGate.js:33-36, C9).
export function cleanText(text) {
  return stripZeroWidthBreaks(text.trim());
}

// The font a 2.x name stands for, or null (contentGate.js:25-31, C10). null, undefined and '' are no name. Any
// other value is looked up as a property key, as hasOwnProperty converts it: ['zawgyi'] resolves, and a value whose
// toString throws, throws. Names are case-sensitive. FONT_ALIASES has 2.x's own keys and no prototype.
export function resolveFont(name) {
  if (name == null || name === '') return null;
  if (Object.prototype.hasOwnProperty.call(FONT_ALIASES, name)) return FONT_ALIASES[name];
  return null;
}

// The font syllBreak, spellingFix and truncate read text in (C11): a falsy name means detect(text); any other name
// is its font, or the name itself, kept as given, when it names none. The caller passes the detector and the text
// to detect on, which differs per function (DESIGN.md §5.1).
export function chooseFontLegacy(name, text, detect) {
  if (!name) return detect(text);
  return resolveFont(name) || name;
}
