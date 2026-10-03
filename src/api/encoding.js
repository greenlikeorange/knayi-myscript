// @ts-check
// detectEncoding, 3.0 (DESIGN.md §11.5). Layer L4.
//
// The rule evidence is the core's: the matches of the 29 detector signatures, Unicode against Zawgyi
// (rules/detect.js countEvidence), on the text trimmed and without U+200B and U+200C, which is how 2.x cleaned it.
// myanmar-tools' ZawgyiDetector, when the caller passes one, decides instead; the core never loads it.

import { DEFAULTS } from '../core/options.js';
import { stripZeroWidthBreaks } from '../core/input.js';
import { detectEncoding as detectByRules, decideByProbability } from '../rules/detect.js';
import { requireString, readOptions, readZawgyiDetector, readThresholds } from './args.js';

/** @typedef {import('../index.js').EncodingEvidence} EncodingEvidence */
/** @typedef {import('../index.js').Encoding} Encoding */
/** @typedef {import('../index.js').DetectorOptions} DetectorOptions */
/** @typedef {import('./args.js').Options} Options */
/** @typedef {import('../index.js').ZawgyiDetector} ZawgyiDetector */
/** @typedef {{ zawgyiDetector: ZawgyiDetector | null, thresholds: readonly number[] }} Detector */

// detectEncoding(text, options?): { encoding, unicode, zawgyi }. encoding is 'none' when the text has no character
// of U+1000-U+109F, 'unknown' when the evidence ties (or the detector's probability lies between the thresholds),
// else 'unicode' or 'zawgyi'. unicode and zawgyi count the matches of the rule signatures for each side. With
// options.zawgyiDetector, the result also has zawgyiProbability, and the detector decides: below thresholds[0] is
// Unicode, above thresholds[1] Zawgyi (default [0.05, 0.95]).
/**
 * @param {string} text
 * @param {DetectorOptions | number | null} [options]
 * @returns {EncodingEvidence}
 */
export function detectEncoding(text, options) {
  requireString('detectEncoding', 'text', text);
  const detector = readDetector('detectEncoding', readOptions('detectEncoding', options));
  return encodingOf(text, detector);
}

// The detector settings of a call's options (from readOptions): { zawgyiDetector, thresholds }, checked.
/**
 * @param {string} api
 * @param {Options} settings
 * @returns {Detector}
 */
export function readDetector(api, settings) {
  return {
    zawgyiDetector: readZawgyiDetector(api, settings),
    thresholds: readThresholds(api, settings, DEFAULTS.detector.thresholds)
  };
}

// What the text is, for a detector from readDetector: the rule evidence, and the detector's decision when there is
// one. The detector is not asked about text with no Myanmar-block character.
/**
 * @param {string} text
 * @param {Detector} detector
 * @returns {EncodingEvidence}
 */
export function encodingOf(text, detector) {
  const cleaned = stripZeroWidthBreaks(text.trim());
  const evidence = /** @type {EncodingEvidence} */ (detectByRules(cleaned));
  if (detector.zawgyiDetector === null || evidence.encoding === 'none') return evidence;
  const probability = detector.zawgyiDetector.getZawgyiProbability(cleaned);
  return {
    encoding: /** @type {Encoding} */ (decideByProbability(probability, detector.thresholds, 'unknown')),
    unicode: evidence.unicode,
    zawgyi: evidence.zawgyi,
    zawgyiProbability: probability
  };
}
