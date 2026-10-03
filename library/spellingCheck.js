'use strict';

const fontDetect = require('./detector');
const globalOptions = require('./globalOptions');
const gate = require('./contentGate');
const syllable = require('./syllableRules');

function spellingFix(content, fontType){
  content = gate.toText(content);
  if (gate.isMissing(content)) {
    if (!globalOptions.isSilentMode()) console.warn('Content must be specified on knayi.spellingFix.');
    return '';
  }

  if (!gate.hasMyanmar(content))
    return content;

  // A font name that is not a string, or '', detects the font. 'zawgyi' collapses the Zawgyi marks, and any other
  // name the Unicode marks, 'win' and unknown names included (collapseMarks).
  var name = gate.givenName(fontType);
  fontType = name === null ? fontDetect(content) : gate.resolveFont(name) || name;

  content = gate.cleanText(content, true);
  return syllable.collapseMarks(content, fontType);
}

module.exports = spellingFix;
