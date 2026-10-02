const globalOptions = require('./globalOptions');
const gate = require('./contentGate');
const syllable = require('./syllable');

function normalize(content) {
  content = gate.toText(content);
  if (gate.isMissing(content)) {
    if (!globalOptions.isSilentMode()) console.warn('Content must be specified on knayi.normalize.');
    return '';
  }

  if (typeof content !== 'string')
    return content;

  return syllable.normalizeText(gate.cleanText(content, false));
}

module.exports = normalize;
