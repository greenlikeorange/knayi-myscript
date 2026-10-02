const globalOptions = require('./globalOptions');
const gate = require('./contentGate');
const syllable = require('./syllable');

function normalize(content) {
  if (gate.isMissing(content)) {
    if (!globalOptions.isSilentMode()) console.warn('Content must be specified on knayi.normalize.');
    return '';
  }

  return syllable.normalizeText(gate.cleanText(content, false));
}

module.exports = normalize;
