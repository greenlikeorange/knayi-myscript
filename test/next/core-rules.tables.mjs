// The 2.x rule tables and font pipelines as core/rules.js rows and stages, with their 2.x references, for
// core-rules.test.mjs and core-rules.fuzz.test.mjs (docs/next/DESIGN.md §7.3). Everything comes from the frozen
// copies of scripts/oracle/ (D19), so the core's runner is checked against 2.x's own tables and stage functions,
// independently of the new engine.

import { applyRuleRows, createTrace, startTrace, runStages } from '../../src/core/rules.js';
import { toNfc } from '../../src/core/nfc.js';
import { internals, oracle } from './helpers.mjs';

const syllable = internals('syllable.js', ['convertRules', 'convertText', 'collapseMarks']);
const storageOrder = internals('storageOrder.js', ['arrange', 'glyphsInTypedOrder', 'zeroAsWa']);
const zawgyi = internals('zawgyi.js', ['FONT']);
const win = internals('win.js', ['FONT']);
const typingFixes = internals('typingFixes.js', ['TYPOS']);

const UNICODE_TO_ZAWGYI = syllable.convertRules.unicode.zawgyi;

// Rows of a 2.x [pattern, replacement] table. Each row gets a copy of its regex, so a row and 2.x never share a
// lastIndex: 2.x's ruleMatches leaves a matched regex's lastIndex past the match.
function rowsOf(prefix, tuples, repeat) {
  return tuples.map((tuple, i) => ({
    id: prefix + '.' + (i + 1), re: new RegExp(tuple[0].source, tuple[0].flags), to: tuple[1], repeat: repeat
  }));
}

// The 2.x text after a font's sequences: the first step of its debug log, when the sequences changed the text.
function afterSequences(font) {
  return (text) => {
    const log = oracle.storageOrder.toUnicode(text, font, true);
    return log.matched_patterns[0] === 'sequences' ? log.steps[1] : text;
  };
}

// Each 2.x table as rows, with the 2.x function that applies it (`reference`) and, for the Unicode to Zawgyi
// rules, the 2.x debug log (`log`).
export const TABLES = {
  unicodeToZawgyi: {
    rows: rowsOf('uz.once', UNICODE_TO_ZAWGYI.oneTime, false)
      .concat(rowsOf('uz.repeat', UNICODE_TO_ZAWGYI.asLongAsMatch, true)),
    reference: (text) => syllable.convertText(text, 'unicode', 'zawgyi'),
    log: (text) => syllable.convertText(text, 'unicode', 'zawgyi', true)
  },
  zawgyiSequences: { rows: rowsOf('zawgyi.sequence', zawgyi.FONT.sequences, false), reference: afterSequences(zawgyi.FONT) },
  winSequences: { rows: rowsOf('win.sequence', win.FONT.sequences, false), reference: afterSequences(win.FONT) },
  typos: { rows: rowsOf('typo', typingFixes.TYPOS, false), reference: oracle.typingFixes.typos }
};

// 2.x Unicode text written in Zawgyi, as 2.x's fontConvert(text, 'zawgyi', 'unicode') writes it.
export function zawgyiOf(unicodeText) {
  return syllable.convertText(syllable.collapseMarks(unicodeText, 'unicode'), 'unicode', 'zawgyi');
}

// A 2.x font pipeline (storageOrder.js toUnicode) as a stage list, built from 2.x's own stage functions, with the
// stage names of fontConvert.debugging as ids and labels. NFC is the core's toNfc.
function fontStages(font) {
  const sequences = rowsOf('sequence', font.sequences, false);
  return Object.freeze([
    { id: 'sequences', label: 'sequences', run: (text) => applyRuleRows(text, sequences) },
    { id: 'glyphs', label: 'glyphs', traceOnly: true, run: (text) => storageOrder.glyphsInTypedOrder(text, font.glyphs) },
    { id: 'syllables', label: 'syllables', run: (text) => storageOrder.arrange(text, font.glyphs) },
    { id: 'zero as wa', label: 'zero as wa', run: (text) => storageOrder.zeroAsWa(text) },
    { id: 'look-alikes', label: 'look-alikes', run: (text) => oracle.typingFixes.lookAlikes(text) },
    { id: 'typos', label: 'typos', run: (text) => oracle.typingFixes.typos(text) },
    { id: 'NFC', label: 'NFC', run: (text) => toNfc(text) }
  ].map(Object.freeze));
}

// Each font's stage list, with 2.x's toUnicode for it: toUnicode(text, font, debug).
export const PIPELINES = {
  zawgyi: { stages: fontStages(zawgyi.FONT), toUnicode: (text, debug) => oracle.storageOrder.toUnicode(text, zawgyi.FONT, debug) },
  win: { stages: fontStages(win.FONT), toUnicode: (text, debug) => oracle.storageOrder.toUnicode(text, win.FONT, debug) }
};

// A trace as 2.x's debug log: { matched_patterns, steps } (DESIGN.md D4, §3.9).
export function asDebugLog(trace) {
  return {
    matched_patterns: trace.records.map((record) => record.label),
    steps: [trace.start].concat(trace.records.map((record) => record.text))
  };
}

// runStages over a pipeline, with a trace: { result, log }.
export function tracePipeline(text, pipeline) {
  const trace = createTrace();
  startTrace(trace, text);
  const result = runStages(text, pipeline.stages, { openAllGates: false }, trace);
  return { result: result, log: asDebugLog(trace) };
}
