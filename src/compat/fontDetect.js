// compat: 2.x fontDetect and detectEncoding on the core (DESIGN.md §5.1, C13, C14). Layer L4. Owner: W8 (compat).
//
// 2.x fontDetect (library/detection.js) counts the matches of 29 signature regexes per side and calls the
// side with more; the core's countEvidence finds the same counts in one pass (rules/detect.js). With myanmar-tools
// asked for, the Zawgyi probability of the detector passed as zawgyiDetector decides instead, against the thresholds.

import { hasMyanmarBlockChar } from '../core/input.js';
import { NO_OPTIONS } from '../core/options.js';
import { countEvidence, decide, scoreByZawgyiModel, detectEncoding as evidenceOf } from '../rules/detect.js';
import { enter, cleanText, givenName, ON_TIE_ASSUME_ZAWGYI } from './input.js';
import { report, mergeDetectorOptions, MESSAGES } from './globalOptions.js';
import { noDetectorNotice } from './zawgyiModel.js';

// fontDetect(content, fallback, options): 'unicode' or 'zawgyi', or the fallback (C13):
// - the fallback is a string other than '', or a String object's string, returned as given; any other value, such
//   as the index Array#map passes, is no fallback (2.11, 86f0040);
// - missing content, a value that is not a string, and text with no unit of U+1000-U+109F answer fallback || 'en'
//   (C6-C8);
// - a tie answers fallback || 'zawgyi'.
// undefined and null options are no options (2.11, fb6594d). Three parameters and no default, as in 2.11.
export function fontDetect(content, fallback, options) {
  const given = givenName(fallback);
  const input = enter('fontDetect', content);
  if (input.kind !== 'text' || !hasMyanmarBlockChar(input.value)) return given || 'en';
  return fontDetectCore(input.value, given || ON_TIE_ASSUME_ZAWGYI, options);
}

// detectEncoding(content) (2.11, 31eb6b1): the rule scorer's evidence, { encoding, unicode, zawgyi }, a new object
// each call. encoding is 'unicode' or 'zawgyi' for the side with more matches and 'unknown' for a tie (core
// rules/detect.js detectEncoding, on the cleaned text, as fontDetect counts); missing content (which warns, unless
// silent), a value that is not a string and text with no unit of U+1000-U+109F give 'none' and two zeros. It scores
// with the rules whatever the detector options say, and reads one argument, so lines.map(detectEncoding) works.
export function detectEncoding(content) {
  const input = enter('detectEncoding', content);
  if (input.kind !== 'text' || !hasMyanmarBlockChar(input.value)) return { encoding: 'none', unicode: 0, zawgyi: 0 };
  return evidenceOf(cleanText(input.value));
}

// The detection itself, on text with a Myanmar-block unit (2.x fontDetect past its gate). The adapter is read before
// the merge, and the merge may print the threshold and detector errors. The myanmar-tools adapter calls the detector
// of the call, or the stored one (2.11, 840c8c5); with none it uses the rule scorer and warns once, since compat
// loads no package (2.11, 649b2b4; zawgyiModel.js). compat never passes notice; tests pass their own (D21).
export function fontDetectCore(text, fallback, options, notice = noDetectorNotice) {
  const cleaned = cleanText(text);
  const requested = options && options.adapter;
  const merged = mergeDetectorOptions(options);
  if (pickAdapter(requested, merged) === 'rules') return decide(countEvidence(cleaned), fallback);
  const model = merged.zawgyiDetector;
  if (!model) {
    notice.warnOnce(warnUnlessSilent);
    return decide(countEvidence(cleaned), fallback);
  }
  return scoreByZawgyiModel(cleaned, model, merged.myanmartools_zg_threshold, fallback);
}

// 2.x chooseAdapter (detection.js): the requested adapter when it is 'rules' or 'myanmartools'; otherwise
// myanmar-tools when the merged use_myanmartools is truthy, else the rules. The name is read as givenName reads a
// font name, so a value that is not a string, or '', names none; any other name warns, unless silent, and falls
// through (2.11, fb6594d).
function pickAdapter(requested, merged) {
  const name = givenName(requested);
  if (name === 'rules' || name === 'myanmartools') return name;
  if (name !== null) report('warn', MESSAGES.unknownAdapter(name));
  return merged.use_myanmartools ? 'myanmartools' : 'rules';
}

// The notice's warning goes through the silent-aware writer, which says whether it printed (C26).
function warnUnlessSilent() {
  return report('warn', MESSAGES.noDetector);
}

// 2.x fontDetect(text) as fontConvert, syllBreak, spellingFix and truncate call it: on a string with a Myanmar-block
// unit, with no fallback (a tie is Zawgyi) and no options (the global detector options apply).
export function detectForRouting(text) {
  return fontDetectCore(text, ON_TIE_ASSUME_ZAWGYI, NO_OPTIONS);
}
