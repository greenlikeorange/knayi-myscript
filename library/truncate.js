const fontDetect = require('./detector');
const globalOptions = require('./globalOptions');
const gate = require('./contentGate');
const syllable = require('./syllable');

function truncate(content, options) {
  options = options || {};
  var fontType = options.fontType;
  var length = options.length || 30;
  var omission = options.omission || '...';
  
  var absoulteLength = length - omission.length;

  content = gate.toText(content);
  if (content !== '' && gate.isMissing(content)) {
    if (!globalOptions.isSilentMode()) console.warn('Content must be specified on knayi.truncate.');
    return '';
  }

  // Like lodash.truncate, other values are truncated as strings.
  if (typeof content !== 'string')
    content = String(content);

  if (content === '' || !gate.hasMyanmar(content))
    return content.substr(0, absoulteLength) + omission;

  if (!fontType)
    fontType = fontDetect(content);
  else
    fontType = gate.resolveFont(fontType) || fontType;

  var syllables = syllable.breakParts(gate.cleanText(content, true), fontType);

  return syllables.reduce(function (curr, syll) {
    var left = absoulteLength - curr.length;
    if (left > 0) {
      if (syll.length <= left) {
        curr += syll;
      } else {
        var spaceBreak = syll.split(/\s/);
        
        curr += spaceBreak.reduce(function (_curr, word) {
          if (word.length + 1 <= left - _curr.length) {
            _curr += word + ' ';
          }
          return _curr;
        }, '')
      }
    }
    return curr;
  }, '').trim() + omission;
}

module.exports = truncate;
