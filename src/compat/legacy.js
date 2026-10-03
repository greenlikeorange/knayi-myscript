// compat: 2.x's property-lookup quirks, and its accidental TypeErrors (DESIGN.md §5.1, C12, C20, D13). Layer L4.
// Owner: W8 (compat).
//
// 2.x found its break rules and its repeated-mark sets as properties of plain objects keyed by font name
// (library/syllable.js BREAK_RULES and COLLAPSE), and read the result as a list of rules. A name the objects do
// not have as their own key still finds what Object.prototype has under it, and 2.x then failed, or ran no rule,
// depending on that value. The lookups here are made on plain objects with 2.x's own keys, so they find the same
// values, and they answer as 2.x's loops did.
//
// legacyTypeError() is the one way src/ throws an error with no code; test/next/guards/errors.test.mjs allows it
// in this file only.

import { deepFreeze } from '../freeze.js';

// What a rule-table lookup returns for a name with no rules: the text is read with none (C12).
export const NO_RULES = /* @__PURE__ */ deepFreeze({ font: null });

// 2.x's two tables, with their own keys only; each value names the font whose rules the core runs. Freezing keeps
// Object.prototype as their prototype, so an inherited name finds what it found in 2.x.
const BREAK_RULE_FONTS = /* @__PURE__ */ fontTable();
const COLLAPSE_FONTS = /* @__PURE__ */ fontTable();

function fontTable() {
  return deepFreeze({ zawgyi: 'zawgyi', unicode: 'unicode' });
}

// 2.x BREAK_RULES[name], then its loop over the rules (syllable.js:259-270): 'unicode', 'zawgyi', NO_RULES, or a
// TypeError where 2.x threw one. Unknown names ('win', 'Unicode', 1) find undefined, whose length 2.x read.
export function legacyBreakFont(name) {
  const rules = BREAK_RULE_FONTS[name];
  if (rules === undefined || rules === null) throw legacyTypeError();
  return ownFontOr(rules);
}

// 2.x COLLAPSE[name] || COLLAPSE.unicode, then its loop (syllable.js:215-222): unknown names use the Unicode marks.
export function legacyCollapseFont(name) {
  return ownFontOr(COLLAPSE_FONTS[name] || COLLAPSE_FONTS.unicode);
}

// The font of an own key, or what 2.x's loop made of an inherited value. Every member of Object.prototype is a
// function or Object.prototype itself, with no element 0: one with a length above 0 (constructor, hasOwnProperty,
// isPrototypeOf, __defineGetter__ and the rest) made 2.x read a property of rules[0], which is undefined; one with a
// length of 0 or none (toString, valueOf, toLocaleString, __proto__) ran no rule.
function ownFontOr(rules) {
  if (rules === 'zawgyi' || rules === 'unicode') return rules;
  if (rules.length > 0) throw legacyTypeError();
  return NO_RULES;
}

// A TypeError with no code, where 2.x threw one by accident (decision 9: such errors count by class only).
export function legacyTypeError() {
  return new TypeError('knayi: this font name has no rules (a TypeError, as in 2.x)');
}

// The separator as 2.x's parts.join(separator) converted it (syllable.js:272-275, C20): toString before valueOf,
// and a Symbol throws a TypeError. The caller has already turned a falsy separator into U+200B.
export function toJoinSeparator(value) {
  return ['', ''].join(value);
}
