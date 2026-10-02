const fontDetect = require('./detector');
const globalOptions = require('./globalOptions');
const gate = require('./contentGate');
const syllable = require('./syllable');

function syllBreak(content, fontType, breakpoint){
  if (gate.isMissing(content)) {
    if (!globalOptions.isSilentMode()) console.warn('Content must be specified on knayi.syllBreak.');
    return '';
  }

  if (!gate.hasMyanmar(content))
    return content;

  content = gate.cleanText(content, true);

  if (!fontType)
    fontType = fontDetect(content);
  else
    fontType = gate.resolveFont(fontType) || fontType;

  return syllable.joinParts(syllable.breakParts(content, fontType), breakpoint);
}

module.exports = syllBreak;
