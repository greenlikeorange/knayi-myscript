// @ts-check
// segmentSyllables and syllableBoundaries, 3.0 (DESIGN.md §11.6; decision 34). Layer L4.
//
// Both take the text as it is: nothing is trimmed, no zero-width character is removed, and the pieces of
// segmentSyllables join back to the text. The breaks are the core's scanners (rules/segment.js), the ones 2.x
// syllBreak used, read on the text as given.

import { deepFreeze } from '../freeze.js';
import { segmentSyllables as coreSegments, syllableBoundaries as coreBoundaries } from '../rules/segment.js';
import { requireString, readOptions, readChoice } from './args.js';

/** @typedef {import('../index.js').SyllableOptions} SyllableOptions */
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
