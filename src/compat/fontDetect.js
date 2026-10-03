// compat: 2.x fontDetect on the core (DESIGN.md §5.1, C13, C14). Layer L4. Owner: W8 (compat).
//
// 2.x fontDetect (library/detector.js:126-156) counts the matches of 29 signature regexes per side and calls the
// side with more; the core's countEvidence finds the same counts in one pass (detect.js). With myanmar-tools asked
// for, the model's Zawgyi probability decides instead, against the thresholds.

import { hasMyanmarBlockChar } from '../core/input.js';
import { NO_OPTIONS } from '../core/options.js';
import { countEvidence, decide, scoreByZawgyiModel } from '../detect.js';
import { enter, cleanText, ON_TIE_ASSUME_ZAWGYI } from './input.js';
import { report, mergeDetectorOptions } from './globalOptions.js';
import { zawgyiModelLoader } from './zawgyiModel.js';

// fontDetect(content, fallback, options): 'unicode' or 'zawgyi', or the fallback (C13):
// - missing content, a value that is not a string, and text with no unit of U+1000-U+109F answer fallback || 'en'
//   (C6-C8);
// - a tie answers fallback || 'zawgyi', and a given fallback comes back as given, of any type.
// options defaults to {} for undefined only, so null throws a TypeError where 2.x read options.adapter.
export function fontDetect(content, fallback, options = {}) {
  const input = enter('fontDetect', content);
  if (input.kind !== 'text' || !hasMyanmarBlockChar(input.value)) return fallback || 'en';
  return fontDetectCore(input.value, fallback || ON_TIE_ASSUME_ZAWGYI, options);
}

// The detection itself, on text with a Myanmar-block unit (detector.js:136-155). The adapter is read before the
// merge, and the merge may print the threshold message. compat never passes loader; tests pass their own (D21).
export function fontDetectCore(text, fallback, options, loader = zawgyiModelLoader) {
  const cleaned = cleanText(text);
  const requested = options.adapter;
  const merged = mergeDetectorOptions(options);
  if (pickAdapter(requested, merged) === 'rules') return decide(countEvidence(cleaned), fallback);
  const model = loader.load();
  if (!model) {
    loader.warnOnce(warnUnlessSilent);
    return decide(countEvidence(cleaned), fallback);
  }
  return scoreByZawgyiModel(cleaned, model, merged.myanmartools_zg_threshold, fallback);
}

// 2.x chooseAdapter (detector.js:112-119): the requested adapter when it is 'rules' or 'myanmartools'; otherwise
// myanmar-tools when the merged use_myanmartools is truthy, else the rules. So { adapter: 'foo' } falls through.
function pickAdapter(requested, merged) {
  if (requested === 'rules' || requested === 'myanmartools') return requested;
  return merged.use_myanmartools ? 'myanmartools' : 'rules';
}

// The loader's warning goes through the silent-aware writer, which says whether it printed (C26).
function warnUnlessSilent(message) {
  return report('warn', message);
}

// 2.x fontDetect(text) as fontConvert, syllBreak, spellingFix and truncate call it: on a string with a Myanmar-block
// unit, with no fallback (a tie is Zawgyi) and no options (the global detector options apply).
export function detectForRouting(text) {
  return fontDetectCore(text, ON_TIE_ASSUME_ZAWGYI, NO_OPTIONS);
}
