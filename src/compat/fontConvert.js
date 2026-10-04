// compat: 2.x fontConvert and fontConvert.debugging on the core (DESIGN.md §5.1, C15-C19). Layer L4. Owner: W8
// (compat).
//
// 2.x converter.js checks its input, trims it, resolves both font names, detects a missing source, and then
// converts in one of two directions: a font stored in drawing order (Zawgyi, Win) to Unicode through the font
// reader (stages/fonts.js), or Unicode to Zawgyi through the rule rows (rules/unicodeToZawgyi.js). Every early exit
// returns text, and debugging a report with that text as its one step (C19; 2.x b6cbfca).

import { FONTS, hasMyanmarBlockChar } from '../core/input.js';
import { createTrace } from '../core/rules.js';
import { fontToUnicode, traceFontToUnicode } from '../stages/fonts.js';
import { unicodeToZawgyi, traceUnicodeToZawgyi } from '../rules/unicodeToZawgyi.js';
import { detectForRouting } from './fontDetect.js';
import { enter, resolveFont, givenName } from './input.js';
import { report, MESSAGES } from './globalOptions.js';

// fontConvert(content, to, from), in 2.x's order of checks (converter.js fontConvert, C15):
// 1. missing content warns and returns ''; a value that is not a string comes back as it is;
// 2. text with no unit of U+1000-U+109F comes back unchanged, unless the source is Win, whose text is ASCII;
// 3. no target prints an error and returns the text, untrimmed;
// 4. the text is trimmed (zero-width spaces stay: they mark word breaks); an unknown target prints an error;
// 5. a missing source is detected on the trimmed text, with the global detector options, and so is an unknown one,
//    after a warning (2.x 24f81c6). Font names are read in any letter case (resolveFont);
// 6. the same font returns the trimmed text; Win as a target, or Win to anything but Unicode, prints an error.
// Only fontConvert.debugging debugs: the debug flag is an argument, not `this.debug` (C16; 2.x d20027a), so a call
// with any receiver, or none, returns text.
export const fontConvert = /* @__PURE__ */ withDebugging(function fontConvert(content, to, from) {
  return convert(content, to, from, false);
});

// 2.x fontConvert.debugging (converter.js): the same checks, with a report for every text it returns.
function withDebugging(fontConvert) {
  fontConvert.debugging = function (content, to, from) {
    return convert(content, to, from, true);
  };
  return fontConvert;
}

// fontConvert and fontConvert.debugging (2.x converter.js convert). A value that is not a string comes back as it
// is, from debugging too.
function convert(content, to, from, debug) {
  const input = enter('fontConvert', content);
  if (input.kind === 'missing') return unconverted('', to, from, debug);
  if (input.kind === 'other') return input.value;
  let text = input.value;
  if (!drawsOnAscii(resolveFont(from)) && !hasMyanmarBlockChar(text)) return unconverted(text, to, from, debug);
  if (!to) {
    report('error', MESSAGES.noTarget);
    return unconverted(text, to, from, debug);
  }
  text = text.trim();
  const sourceName = givenName(from);
  const target = resolveFont(to);
  let source = resolveFont(from);
  if (!target) {
    report('error', MESSAGES.unknownTarget);
    return unconverted(text, target, source, debug);
  }
  if (!source) {
    if (sourceName !== null) report('warn', MESSAGES.unknownSource(sourceName));
    source = detectForRouting(text);
  }
  if (target === source) return unconverted(text, target, source, debug);
  if (FONTS[target].sourceOnly || (FONTS[source].sourceOnly && target !== 'unicode')) {
    report('error', MESSAGES.winSourceOnly);
    return unconverted(text, target, source, debug);
  }
  return convertText(text, source, debug);
}

// What an exit before the conversion returns (2.x converter.js unconverted): the text, or with debug the report of
// a conversion in which nothing matched, its one step the text. to and from are what the call has read so far: the
// arguments before resolveFont reads them, the resolved names after; each is reported as a font name ('unicode',
// 'zawgyi' or 'win') or '' (givenName, then resolveFont), so a value that is not a string is never converted.
function unconverted(text, to, from, debug) {
  if (!debug) return text;
  return { to: reportedFont(to), from: reportedFont(from), matched_patterns: [], steps: [text] };
}

function reportedFont(font) {
  return resolveFont(givenName(font)) || '';
}

// Whether a font draws on ASCII and Windows-1252 code points (Win), so that its text has no Myanmar-block unit to
// find. fontName is a resolved name, or null.
function drawsOnAscii(fontName) {
  return fontName !== null && FONTS[fontName].ascii;
}

// The conversion itself. Past the checks, a source stored in drawing order has a Unicode target, and a Unicode
// source a Zawgyi target (the end of 2.x converter.js fontConvert).
function convertText(text, source, debug) {
  if (FONTS[source].visualOrder) return debug ? fontDebugLog(text, source) : fontToUnicode(text, source);
  return debug ? zawgyiDebugLog(text) : unicodeToZawgyi(text);
}

// 2.x's log of a font conversion (converter.js drawingOrderToUnicode; storageOrder.js:461-485): the input, then the
// text after each stage that changed it, with the stage names.
function fontDebugLog(text, source) {
  const trace = createTrace();
  traceFontToUnicode(text, source, trace);
  return debugLog('unicode', source, trace);
}

// 2.x's log of Unicode to Zawgyi (syllable.js:301-327): the collapsed text, then the text after each rule that
// changed it, with the rules' 2.x regex sources (§3.9, D4).
function zawgyiDebugLog(text) {
  const trace = createTrace();
  traceUnicodeToZawgyi(text, trace);
  return debugLog('zawgyi', 'unicode', trace);
}

// { to, from, matched_patterns, steps }, in 2.x's key order: steps is [start, ...the records' texts], and
// matched_patterns the records' labels (D4).
function debugLog(to, from, trace) {
  const labels = [];
  const steps = [trace.start];
  for (let i = 0; i < trace.records.length; i++) {
    labels.push(trace.records[i].label);
    steps.push(trace.records[i].text);
  }
  return { to: to, from: from, matched_patterns: labels, steps: steps };
}
