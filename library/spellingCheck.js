const fontDetect = require('./detector');
const globalOptions = require('./globalOptions');
const gate = require('./contentGate');
const syllable = require('./syllable');

function spellingFix(content, fontType){
  content = gate.toText(content);
  if (gate.isMissing(content)) {
    if (!globalOptions.isSilentMode()) console.warn('Content must be specified on knayi.spellingFix.');
    return '';
  }

  if (!gate.hasMyanmar(content))
    return content;

  if (!fontType)
    fontType = fontDetect(content);
  else
    fontType = gate.resolveFont(fontType) || fontType;

  content = gate.cleanText(content, true);
  return syllable.collapseMarks(content, fontType);
}

module.exports = spellingFix;
