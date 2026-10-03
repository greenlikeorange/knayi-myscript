// The 2.x side of the segment tests (docs/next/DESIGN.md §7.5), shared by segment.test.mjs, segment.fuzz.test.mjs
// and segment.timing.mjs. Owner: W3 (segment).
//
// The 2.x break and collapse code is read in the frozen copy scripts/oracle/syllable.js (D19). syllBreak2x and
// spellingFix2x add the public preamble of the reference (library/syllBreak.js and spellingCheck.js at e5f6e24)
// for a string and a known font, so the tests can compare with the public functions too. breakPartsByRows runs the
// 2.x algorithm over the documented rows of src/spec/breakRules.js.

import assert from 'node:assert/strict';
import { internals } from './helpers.mjs';
import { breakString, collapseRepeatedMarks } from '../../src/segment.js';

export const syllable2x = internals('syllable.js', ['BREAK_RULES', 'COLLAPSE', 'breakParts', 'joinParts', 'collapseMarks']);
const gate2x = internals('contentGate.js', ['cleanText', 'hasMyanmar']);

export const FONTS = ['unicode', 'zawgyi'];

// 2.x breakParts (syllable.js:259-270) over rows of the shape of src/spec/breakRules.js.
export function breakPartsByRows(text, rows) {
  let out = text;
  for (const row of rows) {
    if (row.offWhen && row.offWhen.test(text)) continue;
    row.pattern.lastIndex = 0;
    out = out.replace(row.pattern, row.replacement);
  }
  return out.replace(/^\u200B/, '').split(/[\u200B\u200C]/);
}

// 2.x syllBreak(content, font, separator) for a string content and the font 'unicode' or 'zawgyi'.
export function syllBreak2x(content, font, separator) {
  if (!content) return '';
  if (!gate2x.hasMyanmar(content)) return content;
  return syllable2x.joinParts(syllable2x.breakParts(gate2x.cleanText(content, true), font), separator);
}

// 2.x spellingFix(content, font) for a string content and the font 'unicode' or 'zawgyi'.
export function spellingFix2x(content, font) {
  if (!content) return '';
  if (!gate2x.hasMyanmar(content)) return content;
  return syllable2x.collapseMarks(gate2x.cleanText(content, true), font);
}

// 2.x's cleaning (contentGate.js cleanText(x, true)), which compat applies before the core break functions.
export function cleanText(text) {
  return text.trim().replace(/[\u200B\u200C]/g, '');
}

const MYANMAR_BLOCK = /[\u1000-\u109F]/;

// The same calls on src/segment.js, with the same preamble.
export function syllBreakOnCore(content, font, separator) {
  if (!content) return '';
  if (!MYANMAR_BLOCK.test(content)) return content;
  return breakString(cleanText(content), font, separator);
}

export function spellingFixOnCore(content, font) {
  if (!content) return '';
  if (!MYANMAR_BLOCK.test(content)) return content;
  return collapseRepeatedMarks(cleanText(content), font);
}

// U+XXXX U+XXXX, for messages.
export function units(text) {
  return Array.from(text, (ch) => 'U+' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
}

// Fails with the input in code points when two outputs differ.
export function assertSame(actual, expected, what, input) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;
  assert.fail(what + ' differs from 2.x on [' + units(input) + ']\n  next ' + JSON.stringify(actual) +
    '\n  2.x  ' + JSON.stringify(expected));
}
