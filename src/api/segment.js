// @ts-check
// segmentSyllables, syllableBoundaries, truncate and collapseRepeatedMarks, 3.0 (DESIGN.md §11.6, §11.7; decision 34).
// Layer L4.
//
// All four take the text as it is: nothing is trimmed, no zero-width character is removed, and the pieces of
// segmentSyllables join back to the text. The breaks are the core's scanners (rules/segment.js), the ones 2.x
// syllBreak used, read on the text as given.

import { deepFreeze } from '../freeze.js';
import { isMyanmarScript } from '../script/codes.js';
import { DEFAULTS } from '../core/options.js';
import {
  prepareBreakText, forEachBreak, segmentSyllables as coreSegments,
  syllableBoundaries as coreBoundaries, collapseRepeatedMarks as coreCollapse
} from '../rules/segment.js';
import { ERR, libraryError } from '../core/errors.js';
import { requireString, readOptions, readChoice, readCount, readText, where } from './args.js';

/** @typedef {import('../index.js').SyllableOptions} SyllableOptions */
/** @typedef {import('../index.js').TruncateOptions} TruncateOptions */
/** @typedef {import('../index.js').CollapseOptions} CollapseOptions */
/** @typedef {import('../index.js').BreakFont} BreakFont */
/** @typedef {import('../index.js').BareConsonantPolicy} BareConsonantPolicy */
/** @typedef {{ policy: BareConsonantPolicy, font: BreakFont }} BreakSettings */

// The fonts the break scanners read, and the bare-consonant policies (rules/segment.js BARE_CONSONANTS).
/** @type {readonly BreakFont[]} */
const FONTS = /* @__PURE__ */ deepFreeze(['unicode', 'zawgyi']);
/** @type {readonly BareConsonantPolicy[]} */
const POLICIES = /* @__PURE__ */ deepFreeze(['separate', 'chains', 'pairs']);

// How a bare consonant, one with no mark, is read by default: as a syllable of its own, with its inherent vowel
// (decision 34; DESIGN.md §11.6). It is the only policy whose pieces are the syllables of UTN #11 (ပ|ထ|မ|ဆုံး),
// whatever the consonants around it; 'chains' joins a run of bare consonants to the syllable after it (ပထမဆုံး), and
// 'pairs', 2.x syllBreak's reading (DESIGN.md §10 Q11), joins them two by two (ပထ|မဆုံး).
/** @type {BareConsonantPolicy} */
const DEFAULT_POLICY = 'separate'; // BARE_CONSONANTS.SEPARATE

// segmentSyllables(text, options?): the syllables, in order; [] for ''. They join back to the text: every unit
// stays, in its place, with zero-width characters and spaces at the end of the syllable before them.
//   policy  how a bare consonant is read: 'separate' (the default), 'chains' or 'pairs'.
//   font    'unicode' (the default) or 'zawgyi', the encoding whose syllables are read.
/**
 * @param {string} text
 * @param {SyllableOptions | number | null} [options]
 * @returns {string[]}
 */
export function segmentSyllables(text, options) {
  requireString('segmentSyllables', 'text', text);
  const settings = readBreakSettings('segmentSyllables', options);
  return coreSegments(text, settings.font, settings.policy);
}

// syllableBoundaries(text, options?): where each syllable after the first starts, in increasing order; [] for a
// text of one syllable or none. Syllable k is text.slice(boundaries[k - 1], boundaries[k]). The options are those of
// segmentSyllables.
/**
 * @param {string} text
 * @param {SyllableOptions | number | null} [options]
 * @returns {number[]}
 */
export function syllableBoundaries(text, options) {
  requireString('syllableBoundaries', 'text', text);
  const settings = readBreakSettings('syllableBoundaries', options);
  return coreBoundaries(text, settings.font, settings.policy);
}

// collapseRepeatedMarks(text, options?): each run of one mark typed several times in a row, as one (2.x spellingFix,
// with neither its trim nor its removal of zero-width characters). options.font: 'unicode' (the default) or
// 'zawgyi', whose marks are collapsed.
/**
 * @param {string} text
 * @param {CollapseOptions | number | null} [options]
 * @returns {string}
 */
export function collapseRepeatedMarks(text, options) {
  requireString('collapseRepeatedMarks', 'text', text);
  const font = readChoice('collapseRepeatedMarks', readOptions('collapseRepeatedMarks', options), 'font', FONTS,
    'unicode');
  return coreCollapse(text, font);
}

// truncate(text, options?): the text, when it is at most `length` units long; else its longest prefix that ends at
// a syllable break and leaves room for the omission, with no white space at its end, then the omission. The result
// always starts with a prefix of the text, and is at most `length` units long.
//   length    the most units of the result, the omission included; undefined or null for the default, 30.
//   omission  what marks the cut; undefined or null for the default, '...'. It must fit in `length`.
//   policy, font  as for segmentSyllables.
// A cut falls at a syllable break of the font's scanner, or between two units outside the Myanmar blocks, but never
// before a combining mark, a joiner or variation selector, or inside a surrogate pair. The scan stops at the cut.
/**
 * @param {string} text
 * @param {TruncateOptions | number | null} [options]
 * @returns {string}
 */
export function truncate(text, options) {
  requireString('truncate', 'text', text);
  const settings = readOptions('truncate', options);
  const length = readCount('truncate', settings, 'length', DEFAULTS.truncate.length);
  const omission = readText('truncate', settings, 'omission', DEFAULTS.truncate.omission);
  const breaks = readBreakSettings('truncate', settings);
  if (omission.length > length) {
    throw libraryError(ERR.INVALID_ARG_VALUE, where('truncate', 'options.length must leave room for the omission'),
      RangeError);
  }
  if (text.length <= length) return text;
  const cut = lastCutAtOrBefore(text, length - omission.length, breaks);
  return withoutTrailingSpace(text.slice(0, cut)) + omission;
}

// The policy and font of a call's options.
/**
 * @param {string} api
 * @param {unknown} options
 * @returns {BreakSettings}
 */
function readBreakSettings(api, options) {
  const settings = readOptions(api, options);
  return {
    policy: readChoice(api, settings, 'policy', POLICIES, DEFAULT_POLICY),
    font: readChoice(api, settings, 'font', FONTS, 'unicode')
  };
}

// The last place at or before `budget` where the text may be cut (truncate). The syllable breaks up to the budget
// come from the scanner, which stops past it; between two units outside the Myanmar blocks any place will do, unless
// the unit after it joins the one before (joinsUnitBefore).
/**
 * @param {string} text
 * @param {number} budget
 * @param {BreakSettings} breaks
 * @returns {number}
 */
function lastCutAtOrBefore(text, budget, breaks) {
  const isBreak = new Uint8Array(budget + 1);
  forEachBreak(prepareBreakText(text, breaks.font), breaks.font, (/** @type {number} */ index) => {
    if (index > budget) return false;
    isBreak[index] = 1;
    return true;
  }, breaks.policy);
  for (let cut = budget; cut > 0; cut--) {
    if (isBreak[cut] === 1 || isCutOutsideMyanmar(text, cut)) return cut;
  }
  return 0;
}

// Whether text may be cut before unit i outside a Myanmar syllable: the unit after the cut is not of the Myanmar
// blocks, so it starts nothing the scanner reads, and does not join the unit before it.
/**
 * @param {string} text
 * @param {number} i
 * @returns {boolean}
 */
function isCutOutsideMyanmar(text, i) {
  const code = text.charCodeAt(i);
  return !isMyanmarScript(code) && !joinsUnitBefore(code);
}

// A unit that belongs with the one before it: a low surrogate; a combining mark of the blocks most text uses
// (U+0300-U+036F, U+1AB0-U+1AFF, U+1DC0-U+1DFF, U+20D0-U+20FF, U+FE20-U+FE2F); ZWNJ or ZWJ; or a variation selector
// (U+FE00-U+FE0F). Combining marks of other scripts are not listed: truncate may cut before one.
/** @param {number} code */
function joinsUnitBefore(code) {
  return (code >= 0xDC00 && code <= 0xDFFF) || (code >= 0x300 && code <= 0x36F) || (code >= 0x1AB0 && code <= 0x1AFF) ||
    (code >= 0x1DC0 && code <= 0x1DFF) || (code >= 0x20D0 && code <= 0x20FF) || (code >= 0xFE20 && code <= 0xFE2F) ||
    code === 0x200C || code === 0x200D || (code >= 0xFE00 && code <= 0xFE0F);
}

// The text without the white space at its end: spaces, tabs and line breaks, which a cut leaves dangling.
/** @param {string} text */
function withoutTrailingSpace(text) {
  let end = text.length;
  while (end > 0 && isWhiteSpace(text.charCodeAt(end - 1))) end--;
  return text.slice(0, end);
}

// JavaScript's white space and line terminators below U+FEFF.
/** @param {number} code */
function isWhiteSpace(code) {
  return code === 0x20 || code === 0xA0 || (code >= 0x09 && code <= 0x0D) || code === 0x3000 ||
    (code >= 0x2000 && code <= 0x200A) || code === 0x2028 || code === 0x2029 || code === 0x202F;
}
