const globalOptions = require('./globalOptions');
const gate = require('./contentGate');
const storageOrder = require('./storageOrder');
const typingFixes = require('./typingFixes');
const nfc = require('./nfc');

// Unicode text -> the same text in Unicode storage order (Unicode Technical Note #11), with a few typing fixes,
// as NFC. The syllables are put in order, and the typing fixes made, by the same rules as Zawgyi and Win
// conversion (storageOrder.js, typingFixes.js), so their output comes back unchanged.

function normalize(content) {
  content = gate.toText(content);
  if (gate.isMissing(content)) {
    if (!globalOptions.isSilentMode()) console.warn('Content must be specified on knayi.normalize.');
    return '';
  }

  if (typeof content !== 'string')
    return content;

  // NFC first as well as last: it can move a dot below in front of an asat or virama, which changes what
  // they attach to, so the syllables are read from NFC text. nfc is String.prototype.normalize('NFC') in linear
  // time (nfc.js).
  var text = storageOrder.arrangeUnicode(nfc(content));
  return nfc(typingFixes.lookAlikes(typingFixes.typos(text)));
}

module.exports = normalize;
