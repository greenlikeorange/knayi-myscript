// compat: 2.x fontConvert and fontConvert.debugging on the core (DESIGN.md §5.1, C15-C19). Layer L4. Owner: W8
// (compat).
//
// 2.x converter.js checks its input, trims it, resolves both font names, detects a missing source, and then
// converts in one of two directions: a font stored in drawing order (Zawgyi, Win) to Unicode through the font
// reader (stages/fonts.js), or Unicode to Zawgyi through the rule rows (rules/unicodeToZawgyi.js). Every early exit
// returns text, also when debugging (C19).

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
// The debug flag is `this && this.debug`, read after the early exits (C16). A function, not an arrow, so that
// `this` is the receiver; compat is a strict module, so a detached call has none (§5.4).
export const fontConvert = /* @__PURE__ */ withDebugging(function fontConvert(content, to, from) {
  const input = enter('fontConvert', content);
  if (input.kind !== 'text') return input.value;
  let text = input.value;
  if (!drawsOnAscii(resolveFont(from)) && !hasMyanmarBlockChar(text)) return text;
  if (!to) {
    report('error', MESSAGES.noTarget);
    return text;
  }
  text = text.trim();
  const sourceName = givenName(from);
  const target = resolveFont(to);
  let source = resolveFont(from);
  if (!target) {
    report('error', MESSAGES.unknownTarget);
    return text;
  }
  if (!source) {
    if (sourceName !== null) report('warn', MESSAGES.unknownSource(sourceName));
    source = detectForRouting(text);
  }
  if (target === source) return text;
  if (FONTS[target].sourceOnly || (FONTS[source].sourceOnly && target !== 'unicode')) {
    report('error', MESSAGES.winSourceOnly);
    return text;
  }
  return convertText(text, source, this && this.debug);
});

// 2.x fontConvert.debugging (converter.js): the same call with { debug: true } as its receiver.
function withDebugging(convert) {
  convert.debugging = function (content, to, from) {
    return convert.apply({ debug: true }, [content, to, from]);
  };
  return convert;
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
