'use strict';

const fontDetect = require('./detection').fontDetect;
const globalOptions = require('./globalOptions');
const gate = require('./contentGate');
const syllable = require('./syllableRules');

// The start of the text that fits in the budget: the parts while they fit, then, of the first part that does not
// fit, the longest start that ends in whitespace and fits, so the words of that part that fit with the whitespace
// after them. That is the longest start of the text within the budget that ends at a syllable break or after
// whitespace. The parts after the first that does not fit are never read.
function fitParts(parts, budget) {
  var kept = '';
  for (var i = 0; i < parts.length; i++) {
    var left = budget - kept.length;
    // Written so that a budget that is not a number (NaN) keeps nothing.
    if (!(parts[i].length <= left)) {
      // The last whitespace in the first `left` code units of the part, and what comes before it.
      return left > 0 ? kept + parts[i].slice(0, parts[i].slice(0, left).search(/\s\S*$/) + 1) : kept;
    }
    kept += parts[i];
  }
  return kept;
}

function truncate(content, options) {
  options = options || {};
  var fontType = options.fontType;
  var length = options.length || 30;
  var omission = options.omission || '...';

  var budget = length - omission.length;

  content = gate.toText(content);
  if (content !== '' && gate.isMissing(content)) {
    if (!globalOptions.isSilentMode()) console.warn('Content must be specified on knayi.truncate.');
    return '';
  }

  // Like lodash.truncate, other values are truncated as strings.
  if (typeof content !== 'string')
    content = String(content);

  if (content === '' || !gate.hasMyanmar(content))
    return content.substr(0, budget) + omission;

  // 'unicode' or 'zawgyi'; null detects the font. 'win' and unknown names throw a TypeError.
  var font = gate.breakFont(fontType, 'truncate') || fontDetect(content);

  // Only the start of the text is broken into parts: the result is at most `budget` code units of it.
  return fitParts(syllable.breakStart(gate.cleanText(content, true), font, budget), budget).trim() + omission;
}

module.exports = truncate;
