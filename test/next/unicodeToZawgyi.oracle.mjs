// The 2.x side of the Unicode to Zawgyi tests (unicodeToZawgyi.test.mjs, unicodeToZawgyi.fuzz.test.mjs), and the
// new trace read back as 2.x's debug log. Owner: W7 (unicode-to-zawgyi).
//
// 2.x is the frozen copy of library/syllable.js at the reference, scripts/oracle/syllable.js (DESIGN.md D19): its
// convertRules, collapseMarks and convertText. Not a test file: the test globs do not match it.

import { internals } from './helpers.mjs';
import { traceUnicodeToZawgyi } from '../../src/unicodeToZawgyi.js';
import { createTrace } from '../../src/core/rules.js';

const syllable = internals('syllable.js', ['convertRules', 'collapseMarks', 'convertText']);
const TWO_X_RULES = syllable.convertRules.unicode.zawgyi;

// 2.x's rules in the order it applies them: { rule: [regex, replacement], repeat }. The 57 oneTime rules apply
// once each; the 8 asLongAsMatch rules repeat while they match.
export const TWO_X_ROWS = TWO_X_RULES.oneTime.map((rule) => ({ rule, repeat: false }))
  .concat(TWO_X_RULES.asLongAsMatch.map((rule) => ({ rule, repeat: true })));

// The id of tables.json's probe for each 2.x rule: 'unicode-to-zawgyi oneTime 0', ..., 'unicode-to-zawgyi
// asLongAsMatch 7' (scripts/testing/rows.js).
export const TWO_X_PROBE_IDS = TWO_X_RULES.oneTime.map((rule, i) => 'unicode-to-zawgyi oneTime ' + i)
  .concat(TWO_X_RULES.asLongAsMatch.map((rule, i) => 'unicode-to-zawgyi asLongAsMatch ' + i));

// 2.x convertText(collapseMarks(text, 'unicode'), 'unicode', 'zawgyi'): what unicodeToZawgyi replaces.
export function twoXUnicodeToZawgyi(text) {
  return syllable.convertText(syllable.collapseMarks(text, 'unicode'), 'unicode', 'zawgyi');
}

// The same with 2.x's debug log: { to, from, matched_patterns, steps }.
export function twoXDebugLog(text) {
  return syllable.convertText(syllable.collapseMarks(text, 'unicode'), 'unicode', 'zawgyi', true);
}

// traceUnicodeToZawgyi read back as 2.x's debug log (DESIGN.md §3.9, D4): matched_patterns are the records'
// labels, and steps are the trace's start followed by the records' texts. `result` is what the call returned.
export function traceAsDebugLog(text) {
  const trace = createTrace();
  const result = traceUnicodeToZawgyi(text, trace);
  return {
    log: {
      to: 'zawgyi',
      from: 'unicode',
      matched_patterns: trace.records.map((record) => record.label),
      steps: [trace.start].concat(trace.records.map((record) => record.text))
    },
    trace,
    result
  };
}

// 2.x fontConvert(text, 'zawgyi', 'unicode'), or fontConvert.debugging with the same arguments, for a string
// (library/converter.js at the reference): '' for an empty text, the text itself when it has no unit of
// U+1000-U+109F, and otherwise the trimmed text through `convert`. The preamble is compat's (W8); the tests
// restate it so that the core runs on exactly the text 2.x's public call converts.
export function asFontConvert(text, convert) {
  if (!text) return '';
  if (!/[\u1000-\u109F]/.test(text)) return text;
  return convert(text.trim());
}
