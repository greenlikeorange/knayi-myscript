// Font detection: the evidence of the 29 detector signatures in one pass, and the decision (DESIGN.md §2.3).
// Layer L3 rules. Owner: W4 (detect).
//
// Skeleton (W0): the exports have their final names and signatures, and each function throws ERR.NOT_BUILT until
// W4 builds it.

import {
  CP, isBurmeseConsonant, isZawgyiPrebase, isZawgyiMedialRa, isZawgyiKinzi
} from './script/codes.js';
import { ERR, libraryError } from './core/errors.js';
import { DEFAULTS, optionsObject } from './core/options.js';

// { unicode, zawgyi }: the String#match counts of spec/detectorSignatures.js over text, summed per side.
export function countEvidence(text) {
  throw libraryError(ERR.NOT_BUILT, 'src/detect.js countEvidence is not built yet');
}

// 'unicode' when unicode > zawgyi, 'zawgyi' when less, else fallback.
export function decide(evidence, fallback) {
  throw libraryError(ERR.NOT_BUILT, 'src/detect.js decide is not built yet');
}

// probability < thresholds[0]: 'unicode'; > thresholds[1]: 'zawgyi'; else fallback.
export function scoreByZawgyiModel(text, model, thresholds, fallback) {
  throw libraryError(ERR.NOT_BUILT, 'src/detect.js scoreByZawgyiModel is not built yet');
}

// options: { fallback = 'zawgyi', zawgyiModel = null, thresholds = DEFAULTS.detector.thresholds }.
export function detectFont(text, options) {
  throw libraryError(ERR.NOT_BUILT, 'src/detect.js detectFont is not built yet');
}
