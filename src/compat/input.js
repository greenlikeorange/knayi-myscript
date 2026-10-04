// compat: the 2.x preamble of every public function: input policy, cleaning and font names (DESIGN.md §5.1,
// C5-C11, D1). Layer L4. Owner: W8 (compat).
//
// The core trusts its callers to pass strings and known font names (§4 rule 4). These are the 2.x checks that
// stand in front of it, with 2.x's lenient answers: 2.x warns and returns, and throws on purpose only for a font
// that syllBreak and truncate cannot break (breakFont).

import { deepFreeze } from '../freeze.js';
import { ERR, libraryError } from '../core/errors.js';
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
  detectEncoding: { emptyIsMissing: true, stringifyOther: false },
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

// The font a 2.x name stands for, 'unicode', 'zawgyi' or 'win', or null (2.x contentGate.js resolveFont, C10).
// null, undefined and '' are no name. A string, or a String object's string, is read in any letter case, so
// 'Unicode' and 'ZAWGYI' are fonts (2.x 579be3d, decision 11). Any other value is looked up as a property key, as
// hasOwnProperty converts it: ['zawgyi'] resolves, ['Zawgyi'] does not, and a value whose toString throws, throws.
// FONT_ALIASES has 2.x's own keys and no prototype, so 'constructor' names nothing.
export function resolveFont(name) {
  if (name == null || name === '') return null;
  let key = unboxString(name);
  if (typeof key === 'string') key = key.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(FONT_ALIASES, key)) return FONT_ALIASES[key];
  return null;
}

// The name a call was given, or null for none (2.x contentGate.js givenName): a string other than '', or a String
// object's string, as given. Any other value (undefined, null, '', or a number such as the index Array#map passes)
// names nothing. It reads a font name, fontDetect's fallback and an adapter name.
export function givenName(value) {
  const name = unboxString(value);
  return typeof name === 'string' && name !== '' ? name : null;
}

// The font syllBreak and truncate break text in (2.x contentGate.js breakFont, C11): 'unicode' or 'zawgyi', or null
// for no name, which detects the font. The break rules are for those two fonts only, so 'win' and an unknown name
// throw a TypeError with the code ERR_KNAYI_INVALID_FONT (2.x 24f81c6, decision 11); the message names the font as
// given. The caller checks the content first, so missing content and text with no Myanmar letter never throw.
export function breakFont(fontType, apiName) {
  const name = givenName(fontType);
  const font = resolveFont(name);
  if (name === null || font === 'unicode' || font === 'zawgyi') return font;
  throw libraryError(ERR.INVALID_FONT, MESSAGES.invalidFont(apiName, name), TypeError);
}
