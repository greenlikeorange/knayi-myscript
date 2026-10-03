// The font pipeline of Zawgyi and Win to Unicode, and the compiled fonts (DESIGN.md §2.3, §3.8, §3.10). Layer L3
// stages. Owner: W6 (engine-fonts). It replaces 2.x toUnicode(content, font, debug) (storageOrder.js:459-485).
//
// FONT_STAGES is the one stage list of both paths (D10): fontToUnicode runs it through core/rules.js runStages with
// no trace, and traceFontToUnicode with one. The stage ids and labels are the 2.x stage names, in the 2.x order
// (README.md, fontConvert.debugging; decision 8). One stage has a gate: the final NFC runs only when the font
// reader wrote a unit that NFC may change (DESIGN.md §3.10, gate 4). The trace runner never gates, and
// `openAllGates` opens the gate for the tests.

import { deepFreeze } from '../freeze.js';
import { ERR, libraryError } from '../core/errors.js';
import { optionsObject } from '../core/options.js';
import { applyRuleRows, applyRuleRowsLogged, runStages, runStagesLogged, startTrace } from '../core/rules.js';
import { toNfc, logNfcEdits } from '../core/nfc.js';
import { ZAWGYI_FONT } from '../fonts/zawgyi.js';
import { WIN_FONT } from '../fonts/win.js';
import { compileFont, readFontNoting, readFontLogged, glyphsInTypedOrder } from '../engine/fontReader.js';
import {
  zeroAsWa, zeroAsWaLogged, fixLookAlikes, fixLookAlikesLogged, fixTypos, fixTyposLogged
} from '../rules/typingFixes.js';

// The compiled fonts (§3.8), checked and built once, at load. A bundle that never converts drops both the calls and
// the tables (§2.4).
const ZAWGYI = /* @__PURE__ */ compileFont(ZAWGYI_FONT);
const WIN = /* @__PURE__ */ compileFont(WIN_FONT);

// The stages, in 2.x order. Each run takes (text, ctx) and returns the text after it. The last four read only the
// text, so they are the typing-fix and NFC functions themselves, as in NORMALIZE_STAGES:
// - 'zero as wa': Zawgyi and Win have no glyph for wa and type it as zero, so a zero that is not part of a number
//   is wa (research/zawgyi-to-unicode.md §2; research/win-fonts.md §5, "Zero").
// - 'look-alikes', then 'typos': the typing fixes normalize makes too, look-alikes first in this pipeline and typos
//   first in normalize's (research/normalize.md §4; ARCHITECTURE.md, "Typing fixes and their two orders").
// - 'NFC': the result is NFC (research/zawgyi-to-unicode.md §2), gated (finalNfcMayChangeText).
export const FONT_STAGES = /* @__PURE__ */ deepFreeze([
  { id: 'sequences', label: 'sequences', run: replaceSequences },
  { id: 'glyphs', label: 'glyphs', run: showGlyphs, traceOnly: true },
  { id: 'syllables', label: 'syllables', run: readSyllables },
  { id: 'zero as wa', label: 'zero as wa', run: zeroAsWa },
  { id: 'look-alikes', label: 'look-alikes', run: fixLookAlikes },
  { id: 'typos', label: 'typos', run: fixTypos },
  { id: 'NFC', label: 'NFC', run: toNfc, gate: finalNfcMayChangeText }
]);

// The logged run of each stage that is not trace-only, by id, for fontToUnicodeLogged (core/rules.js
// runStagesLogged; DESIGN.md §11.3): each gives what the stage's run gives and records its edits in a log.
const FONT_LOGGED_RUNS = /* @__PURE__ */ deepFreeze({
  sequences: replaceSequencesLogged,
  syllables: readSyllablesLogged,
  'zero as wa': zeroAsWaStageLogged,
  'look-alikes': fixLookAlikesStageLogged,
  typos: fixTyposStageLogged,
  NFC: toNfcLogged
});

// 'sequences': letters the font types as look-alike sequences become the letter, before any glyph is read: Win's
// aMomf, Mo, ps and OD (research/win-fonts.md §2, "No glyph of their own"), and Zawgyi's lagaung
// (research/zawgyi-to-unicode.md §3, "Letters Zawgyi draws alike"). Each row applies once, in order.
function replaceSequences(text, ctx) {
  return applyRuleRows(text, ctx.font.sequences);
}

function replaceSequencesLogged(text, ctx, log) {
  return applyRuleRowsLogged(text, ctx.font.sequences, log);
}

// 'glyphs', trace only: each glyph as Unicode, still in typed order. Its output is recorded, not passed on.
function showGlyphs(text, ctx) {
  return glyphsInTypedOrder(text, ctx.font);
}

// 'syllables': each syllable in the storage order of UTN #11 (engine/fontReader.js). What the reader saw goes into
// the context, for the final-NFC gate, so this file owns both the reader call and the gate check.
function readSyllables(text, ctx) {
  const read = readFontNoting(text, ctx.font);
  ctx.nfcMayChange = read.nfcMayChange;
  return read.text;
}

function readSyllablesLogged(text, ctx, log) {
  const read = readFontLogged(text, ctx.font, log);
  ctx.nfcMayChange = read.nfcMayChange;
  return read.text;
}

// The logged runs of the typing fixes and NFC: the functions' logged twins, with the log in third place.
function zeroAsWaStageLogged(text, ctx, log) {
  return zeroAsWaLogged(text, log);
}

function fixLookAlikesStageLogged(text, ctx, log) {
  return fixLookAlikesLogged(text, log);
}

function fixTyposStageLogged(text, ctx, log) {
  return fixTyposLogged(text, log);
}

function toNfcLogged(text, ctx, log) {
  const normalized = toNfc(text);
  if (normalized !== text) logNfcEdits(text, log);
  return normalized;
}

// Gate 4, the final NFC of the font pipeline (DESIGN.md §3.10). Zawgyi and Win text is not NFC on the way in, but
// every unit NFC may move or compose reaches the output through the reader, which notes it (fontReader.js
// readFontNoting), or not at all: the typing fixes write and remove only units that NFC leaves alone (U+102E,
// U+1030, U+102A, U+104E, U+101D, U+101B, U+1040, U+1047), and U+1025, which composes with U+102E, is noted.
function finalNfcMayChangeText(ctx) {
  return ctx.nfcMayChange;
}

// Zawgyi or Win text in Unicode (2.x zawgyi.toUnicode, win.toUnicode). fontName is 'zawgyi' or 'win' (D5): the
// caller has resolved it, as compat does with resolveFont. engineOptions.openAllGates: tests only, as for
// normalizeText; compat never passes it, and no public API exposes it.
export function fontToUnicode(text, fontName, engineOptions) {
  const ctx = fontContext(fontName);
  ctx.openAllGates = optionsObject(engineOptions).openAllGates === true;
  return runStages(text, FONT_STAGES, ctx, null);
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

// fontToUnicode, recording in `log`, an EditLog (core/edits.js), its edits from the input to the result, each with
// the ids of the stages that made it (DESIGN.md §11.3): what toUnicode's offsets are made from.
export function fontToUnicodeLogged(text, fontName, log) {
  return runStagesLogged(text, FONT_STAGES, FONT_LOGGED_RUNS, fontContext(fontName), log);
}

// A new context for one run of the stages: the compiled font, and what the reader saw (FontContext, §2.3).
function fontContext(fontName) {
  if (fontName === 'zawgyi') return { openAllGates: false, font: ZAWGYI, nfcMayChange: true };
  if (fontName === 'win') return { openAllGates: false, font: WIN, nfcMayChange: true };
  throw libraryError(ERR.INVALID_ARG_VALUE, 'knayi.fontToUnicode: the font must be \'zawgyi\' or \'win\'', RangeError);
}
