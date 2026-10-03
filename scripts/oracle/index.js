// The 2.10 engine, frozen: the oracle for the differential fuzz test (test/fuzz.test.js) while the library's
// engine is rewritten. A rewrite must give the same output as these copies on every input.
//
// storageOrder.js, typingFixes.js, zawgyi.js and win.js are byte-for-byte copies of library/ at 2.10 with the
// linear-time fix (commit 2eb0988); they load each other by the same relative paths, so nothing in them was
// changed. signatures.js holds the 29 detector signatures and the rule scorer of library/detector.js. Do not
// edit these files to make a test pass: a difference from the library is what the fuzz test is for.
//
// The functions below add the public preamble of 2.10 (library/contentGate.js, converter.js, detector.js and
// normalization.js) for string input, so the fuzz test can compare them with the public API directly.

const storageOrder = require('./storageOrder');
const typingFixes = require('./typingFixes');
const zawgyi = require('./zawgyi');
const win = require('./win');
const signatures = require('./signatures');

const MYANMAR = /[\u1000-\u109F]/;

// knayi.normalize(text) for a non-empty string.
function normalize(text) {
  var arranged = storageOrder.arrangeUnicode(text.normalize('NFC'));
  return typingFixes.lookAlikes(typingFixes.typos(arranged)).normalize('NFC');
}

// knayi.fontConvert(text, 'unicode', from) for a non-empty string, with from 'zawgyi' or 'win'.
function toUnicode(text, from) {
  if (from !== 'win' && !MYANMAR.test(text)) return text;
  return (from === 'win' ? win : zawgyi).toUnicode(text.trim());
}

// knayi.fontDetect(text, fallback, { adapter: 'rules' }) for a non-empty string.
function fontDetect(text, fallback) {
  if (!MYANMAR.test(text)) return fallback || 'en';
  return signatures.scoreWithRules(text.trim().replace(/[\u200B\u200C]/g, ''), fallback || 'zawgyi');
}

module.exports = {
  storageOrder: storageOrder,
  typingFixes: typingFixes,
  signatures: signatures,
  normalize: normalize,
  toUnicode: toUnicode,
  fontDetect: fontDetect
};
