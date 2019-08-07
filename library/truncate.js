const fontDetect = require('./detector');
const syllBreak = require('./syllBreak');
const globalOptions = require('./globalOptions');

const mmCharacterRange = /[\u1000-\u109F]/;

function truncate(content, options) {
  options = options || {};
  var fontType = options.fontType;
  var length = options.length || 30;
  var omission = options.omission || '...';
  
  var absoulteLength = length - omission.length;

  if (content === '' || !mmCharacterRange.test(content))
    return content.substr(0, absoulteLength) + omission;

  if (!fontType)
    fontType = fontDetect(content);

  var syllables = syllBreak(content, fontType).split(/[\u200B\u200C]/);

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
