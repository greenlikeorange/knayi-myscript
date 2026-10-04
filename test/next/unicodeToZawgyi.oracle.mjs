// The 2.x side of the Unicode to Zawgyi tests (unicodeToZawgyi.test.mjs, unicodeToZawgyi.fuzz.test.mjs), and the
// new trace read back as 2.x's debug log. Owner: W7 (unicode-to-zawgyi).
//
// 2.x is the frozen copy of library/syllable.js at the reference, scripts/oracle/syllable.js (DESIGN.md D19): its
// convertRules, collapseMarks and convertText, with the one change the 2.x line has made to the rules since: 2.11's
// row for stacked jha (2.x 05de555), which this loads into its own copy of the rules, so the frozen file stays as it
// is (DESIGN.md §8, "Module tests after a port"). Not a test file: the test globs do not match it.

import { internals } from './helpers.mjs';
import { traceUnicodeToZawgyi } from '../../src/rules/unicodeToZawgyi.js';
import { createTrace } from '../../src/core/rules.js';

const syllable = internals('syllable.js', ['convertRules', 'collapseMarks', 'convertText']);
const TWO_X_RULES = syllable.convertRules.unicode.zawgyi;

// 2.11 writes stacked jha as U+1069, with a rule right after the one for stacked ca with medial ya, which 2.10 had
// alone (05de555; CHANGELOG.md, 2.11.0). Spliced into this copy's rules, which its convertText reads at each call.
const STACKED_CA_WITH_YA = TWO_X_RULES.oneTime.findIndex((rule) => rule[0].source === '\\u1039\\u1005\\u103b');
if (STACKED_CA_WITH_YA !== 40) throw new Error('scripts/oracle/syllable.js: stacked ca with medial ya is not rule 40');
TWO_X_RULES.oneTime.splice(STACKED_CA_WITH_YA + 1, 0, [/\u1039\u1008/g, '\u1069']);

// 2.x's rules in the order it applies them: { rule: [regex, replacement], repeat }. The 58 oneTime rules apply
// once each; the 8 asLongAsMatch rules repeat while they match.
export const TWO_X_ROWS = TWO_X_RULES.oneTime.map((rule) => ({ rule, repeat: false }))
  .concat(TWO_X_RULES.asLongAsMatch.map((rule) => ({ rule, repeat: true })));

// The id of tables.json's probe for each 2.x rule: 'unicode-to-zawgyi oneTime 0', ..., 'unicode-to-zawgyi
// asLongAsMatch 7' (scripts/testing/rows.js), numbered as 2.11 numbers them: stacked jha is 'oneTime 41'.
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
