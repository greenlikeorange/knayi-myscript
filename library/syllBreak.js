const fontDetect = require('./detector');
const globalOptions = require('./globalOptions');
const gate = require('./contentGate');
const syllable = require('./syllable');

function syllBreak(content, fontType, breakpoint){
  content = gate.toText(content);
  if (gate.isMissing(content)) {
    if (!globalOptions.isSilentMode()) console.warn('Content must be specified on knayi.syllBreak.');
    return '';
  }

  if (!gate.hasMyanmar(content))
    return content;

  content = gate.cleanText(content, true);

  // 'unicode' or 'zawgyi'; null detects the font. 'win' and unknown names throw a TypeError.
  var font = gate.breakFont(fontType, 'syllBreak') || fontDetect(content);

  return syllable.joinParts(syllable.breakParts(content, font), breakpoint);
}

module.exports = syllBreak;
