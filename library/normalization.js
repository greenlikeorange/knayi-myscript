const globalOptions = require('./globalOptions');
const gate = require('./contentGate');
const storageOrder = require('./storageOrder');
const typingFixes = require('./typingFixes');
const nfc = require('./nfc');

// Unicode text -> the same text in Unicode storage order (Unicode Technical Note #11), with a few typing fixes,
// as NFC. The syllables are put in order, and the typing fixes made, by the same rules as Zawgyi and Win
// conversion (storageOrder.js, typingFixes.js), so their output comes back unchanged.

// A character of the Myanmar blocks: Myanmar, Extended-B and Extended-A. Text with none is only put in NFC.
const MYANMAR_BLOCKS = /[\u1000-\u109F\uA9E0-\uA9FF\uAA60-\uAA7F]/;

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
  var text = nfc(content);
  // Text with no character of the Myanmar blocks is done: arrangeUnicode opens a syllable only at a character
  // of U+1000-U+109F and writes every other character as it is, each typing fix matches only at one of those
  // characters, and NFC of NFC text is the same text. The extended blocks count too: those steps read their
  // letters and marks, so a rule for one of them needs no change here.
  if (!MYANMAR_BLOCKS.test(text)) return text;
  text = storageOrder.arrangeUnicode(text);
  return nfc(typingFixes.lookAlikes(typingFixes.typos(text)));
}

module.exports = normalize;
