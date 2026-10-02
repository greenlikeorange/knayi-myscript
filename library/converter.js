const spellingFix = require('./spellingCheck');
const fontDetect = require('./detector');
const globalOptions = require('./globalOptions');
const gate = require('./contentGate');
const syllable = require('./syllable');
const win = require('./win');

function fontConvert(content, to, from) {
  content = gate.toText(content);
  if (gate.isMissing(content)) {
    if (!globalOptions.isSilentMode()) console.warn('Content must be specified on knayi.fontConvert.');
    return '';
  }

  // Win text is ASCII, so it has no Myanmar letters to find.
  if (gate.resolveFont(from) !== 'win' && !gate.hasMyanmar(content))
    return content;

  if (!to) {
    if (!globalOptions.isSilentMode()) console.error('Convert target font must be specified on knayi.fontConvert.');
    return content;
  }

  content = gate.cleanText(content, true);
  to = gate.resolveFont(to);
  from = gate.resolveFont(from);

  if (!to) {
    if (!globalOptions.isSilentMode()) console.error('Convert library dosen\'t have this fontType.')
    return content;
  } else if (!from) {
    from = fontDetect(content);
  }

  if (to === from) {
    return content;
  }

  // Win is a source font only: knayi converts Win text to Unicode.
  if (to === 'win' || (from === 'win' && to !== 'unicode')) {
    if (!globalOptions.isSilentMode()) console.error('knayi.fontConvert converts Win text to Unicode only.');
    return content;
  }

  var debug = this && this.debug;
  if (from === 'win') return winToUnicode(content, debug);

  content = spellingFix(content, from);
  return syllable.convertText(content, from, to, debug);
}

// Win has its own rules in library/win.js. The debugging log has the same shape as the other conversions
// and ends with the converted text.
function winToUnicode(content, debug) {
  var result = win.toUnicode(content, debug);
  if (!debug) return result;
  return { to: 'unicode', from: 'win', matched_patterns: result.matched_patterns, steps: result.steps };
}

fontConvert.debugging = function (param1, param2, param3) {
  return fontConvert.apply({debug: true}, [param1, param2, param3])
}

module.exports = fontConvert;
