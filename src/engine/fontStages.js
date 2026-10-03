// The font pipeline of Zawgyi and Win to Unicode, and the compiled fonts (DESIGN.md §2.3, §3.8, §3.10). Layer L3
// stages. Owner: W6 (engine-fonts). It replaces 2.x toUnicode(content, font, debug) (storageOrder.js:459-485).
//
// FONT_STAGES is the one stage list of both paths (D10): fontToUnicode runs it through core/rules.js runStages with
// no trace, and traceFontToUnicode with one. The stage ids and labels are the 2.x stage names, in the 2.x order
// (README.md, fontConvert.debugging; decision 8). No font stage has a gate (decision 28: Zawgyi and Win stay
// ungated), so the two paths run the same stages, apart from the trace-only 'glyphs'.

import { deepFreeze } from '../freeze.js';
import { ERR, libraryError } from '../core/errors.js';
import { applyRuleRows, runStages, startTrace } from '../core/rules.js';
import { toNfc } from '../core/nfc.js';
import { ZAWGYI_FONT } from '../fonts/zawgyi.js';
import { WIN_FONT } from '../fonts/win.js';
import { compileFont, readFont, glyphsInTypedOrder } from './fontReader.js';
import { zeroAsWa, fixLookAlikes, fixTypos } from './typingFixes.js';

// The compiled fonts (§3.8), checked and built once, at load. A bundle that never converts drops both the calls and
// the tables (§2.4).
const ZAWGYI = /* @__PURE__ */ compileFont(ZAWGYI_FONT);
const WIN = /* @__PURE__ */ compileFont(WIN_FONT);

// The context each font's run passes to the stages. openAllGates is false, and no font stage reads it.
const ZAWGYI_CONTEXT = /* @__PURE__ */ deepFreeze({ openAllGates: false, font: ZAWGYI });
const WIN_CONTEXT = /* @__PURE__ */ deepFreeze({ openAllGates: false, font: WIN });

// The stages, in 2.x order. Each run takes (text, ctx) and returns the text after it. The last four read only the
// text, so they are the typing-fix and NFC functions themselves, as in NORMALIZE_STAGES:
// - 'zero as wa': Zawgyi and Win have no glyph for wa and type it as zero, so a zero that is not part of a number
//   is wa (research/zawgyi-to-unicode.md §2; research/win-fonts.md §5, "Zero").
// - 'look-alikes', then 'typos': the typing fixes normalize makes too, look-alikes first in this pipeline and typos
//   first in normalize's (research/normalize.md §4; ARCHITECTURE.md, "Typing fixes and their two orders").
// - 'NFC': the result is NFC (research/zawgyi-to-unicode.md §2).
export const FONT_STAGES = /* @__PURE__ */ deepFreeze([
  { id: 'sequences', label: 'sequences', run: replaceSequences },
  { id: 'glyphs', label: 'glyphs', run: showGlyphs, traceOnly: true },
  { id: 'syllables', label: 'syllables', run: readSyllables },
  { id: 'zero as wa', label: 'zero as wa', run: zeroAsWa },
  { id: 'look-alikes', label: 'look-alikes', run: fixLookAlikes },
  { id: 'typos', label: 'typos', run: fixTypos },
  { id: 'NFC', label: 'NFC', run: toNfc }
]);

// 'sequences': letters the font types as look-alike sequences become the letter, before any glyph is read: Win's
// aMomf, Mo, ps and OD (research/win-fonts.md §2, "No glyph of their own"), and Zawgyi's lagaung
// (research/zawgyi-to-unicode.md §3, "Letters Zawgyi draws alike"). Each row applies once, in order.
function replaceSequences(text, ctx) {
  return applyRuleRows(text, ctx.font.sequences);
}

// 'glyphs', trace only: each glyph as Unicode, still in typed order. Its output is recorded, not passed on.
function showGlyphs(text, ctx) {
  return glyphsInTypedOrder(text, ctx.font);
}

// 'syllables': each syllable in the storage order of UTN #11 (engine/fontReader.js).
function readSyllables(text, ctx) {
  return readFont(text, ctx.font);
}

// Zawgyi or Win text in Unicode (2.x zawgyi.toUnicode, win.toUnicode). fontName is 'zawgyi' or 'win' (D5): the
// caller has resolved it, as compat does with resolveFont.
export function fontToUnicode(text, fontName) {
  return runStages(text, FONT_STAGES, fontContext(fontName), null);
}

// fontToUnicode, recording the stages in trace (D4; 2.x toUnicode(content, font, true)): trace.start is the input,
// and each stage whose output differs from the last text recorded adds a record with its id, its label and that
// output. 2.x's matched_patterns are the records' labels, and its steps are [start, ...the records' texts].
// Returns the result, which equals fontToUnicode(text, fontName).
export function traceFontToUnicode(text, fontName, trace) {
  const ctx = fontContext(fontName);
  startTrace(trace, text);
  return runStages(text, FONT_STAGES, ctx, trace);
}

function fontContext(fontName) {
  if (fontName === 'zawgyi') return ZAWGYI_CONTEXT;
  if (fontName === 'win') return WIN_CONTEXT;
  throw libraryError(ERR.INVALID_ARG_VALUE, 'knayi.fontToUnicode: the font must be \'zawgyi\' or \'win\'', RangeError);
}
