const spellingFix = require('./spellingCheck');
const fontDetect = require('./detector');
const globalOptions = require('./globalOptions');
const gate = require('./contentGate');
const syllable = require('./syllable');

function fontConvert(content, to, from) {
  content = gate.toText(content);
  if (gate.isMissing(content)) {
    if (!globalOptions.isSilentMode()) console.warn('Content must be specified on knayi.fontConvert.');
    return '';
  }

  if (!gate.hasMyanmar(content))
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

  content = spellingFix(content, from);
  return syllable.convertText(content, from, to, this && this.debug);
}

fontConvert.debugging = function (param1, param2, param3) {
  return fontConvert.apply({debug: true}, [param1, param2, param3])
}

module.exports = fontConvert;
