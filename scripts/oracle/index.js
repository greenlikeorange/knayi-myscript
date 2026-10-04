// The 2.10 engine, frozen: the oracle for the differential fuzz test (test/fuzz.test.js) while the library's
// engine is rewritten. A rewrite must give the same output as these copies, with the deliberate changes below,
// on every input.
//
// storageOrder.js, typingFixes.js, zawgyi.js and win.js are byte-for-byte copies of library/ at 2.10 with the
// linear-time fix (commit 2eb0988); they load each other by the same relative paths, so nothing in them was
// changed. signatures.js holds the 29 detector signatures and the rule scorer of 2.10's library/detector.js,
// which the 2.x line's library/detection.js holds now. Do not edit these files to make a test pass: a difference
// from the library is what the fuzz test is for.
//
// The other files make this directory the whole 2.x library at e5f6e24, 2.10.0's code and the 2.x reference the 3.0
// core was built against (docs/next/DESIGN.md D18, D19): syllable.js, contentGate.js, converter.js, detector.js,
// globalOptions.js, normalization.js, spellingCheck.js, syllBreak.js and truncate.js are byte-for-byte copies of
// library/ there, and main.js is that commit's main.js with its requires pointed at the copies next to it. The
// module tests of test/next reach their private code through test/next/helpers.mjs `internals`, so a later 2.x
// change cannot quietly change what those tests compare with. compat's tests compare with the 2.x reference itself,
// main.js and library/ of the 2.x line's latest release in scripts/reference/. The four copies above are identical
// to library/ at e5f6e24 too, and test/next/guards/oracle.test.mjs checks all thirteen, and main.js, against the
// blob ids of e5f6e24.
//
// The functions below add the public preamble of 2.10 (library/contentGate.js, converter.js, detector.js and
// normalization.js) for string input, so the fuzz test can compare them with the public API directly. They also
// make each deliberate change to the engine's output since 2.10 (CHANGELOG.md, "Output changes"), named after
// its pull request, to the frozen engine's results, so the copies themselves never change.

const storageOrder = require('./storageOrder');
const typingFixes = require('./typingFixes');
const zawgyi = require('./zawgyi');
const win = require('./win');
const signatures = require('./signatures');

const MYANMAR = /[\u1000-\u109F]/;

// Refactor plan PR 4.7: the font pipeline makes the typing fixes in normalize's order, typos and then
// look-alikes, where 2.10 made the look-alikes first. `log` is what the frozen storageOrder.toUnicode returns
// with debug, { matched_patterns, steps }. Each step is the text after a stage that changed it, so the text
// before the typing fixes is the step after the last stage before them. Returns the same with the typing fixes
// made in the new order, or with no debug only the text.
const TYPING_FIX_STAGES = ['look-alikes', 'typos', 'NFC'];

function typosFirst(log, debug) {
  var patterns = [];
  var steps = [log.steps[0]];
  for (var i = 0; i < log.matched_patterns.length; i++) {
    if (TYPING_FIX_STAGES.indexOf(log.matched_patterns[i]) !== -1) break;
    patterns.push(log.matched_patterns[i]);
    steps.push(log.steps[i + 1]);
  }
  function step(name, text) {
    if (text !== steps[steps.length - 1]) {
      patterns.push(name);
      steps.push(text);
    }
    return text;
  }

  var text = steps[steps.length - 1];
  text = step('typos', typingFixes.typos(text));
  text = step('look-alikes', typingFixes.lookAlikes(text));
  text = step('NFC', text.normalize('NFC'));
  return debug ? { matched_patterns: patterns, steps: steps } : text;
}

// storageOrder.toUnicode(content, font, debug) with a font compiled by storageOrder.font, and the toUnicode
// (content, debug) of the Zawgyi and Win fonts, with the changes above.
function fontToUnicode(content, font, debug) {
  return typosFirst(storageOrder.toUnicode(content, font, true), debug);
}

const fonts = {
  zawgyi: {
    toUnicode: function (content, debug) {
      return typosFirst(zawgyi.toUnicode(content, true), debug);
    }
  },
  win: {
    toUnicode: function (content, debug) {
      return typosFirst(win.toUnicode(content, true), debug);
    }
  }
};

// knayi.normalize(text) for a non-empty string.
function normalize(text) {
  var arranged = storageOrder.arrangeUnicode(text.normalize('NFC'));
  return typingFixes.lookAlikes(typingFixes.typos(arranged)).normalize('NFC');
}

// knayi.fontConvert(text, 'unicode', from) for a non-empty string, with from 'zawgyi' or 'win'.
function toUnicode(text, from) {
  if (from !== 'win' && !MYANMAR.test(text)) return text;
  return fonts[from === 'win' ? 'win' : 'zawgyi'].toUnicode(text.trim());
}

// knayi.fontDetect(text, fallback, { adapter: 'rules' }) for a non-empty string.
function fontDetect(text, fallback) {
  if (!MYANMAR.test(text)) return fallback || 'en';
  return signatures.scoreWithRules(text.trim().replace(/[\u200B\u200C]/g, ''), fallback || 'zawgyi');
}

// knayi.detectEncoding(text) for a string, which 2.10 did not have: the number of matches of each side's signatures
// in the text fontDetect scores, and the side with more, or 'unknown' when they tie; 'none' and two zeros for text
// with no Myanmar letter. signatures.scoreWithRules adds up the same counts.
function detectEncoding(text) {
  var result = { encoding: 'none', unicode: 0, zawgyi: 0 };
  if (!MYANMAR.test(text)) return result;
  var content = text.trim().replace(/[\u200B\u200C]/g, '');
  for (var type in signatures.detect) {
    for (var i = 0; i < signatures.detect[type].length; i++) {
      var found = content.match(signatures.detect[type][i]);
      result[type] += (found && found.length) || 0;
    }
  }
  result.encoding = result.unicode > result.zawgyi ? 'unicode' : result.unicode < result.zawgyi ? 'zawgyi' : 'unknown';
  return result;
}

module.exports = {
  storageOrder: storageOrder,
  typingFixes: typingFixes,
  signatures: signatures,
  fonts: fonts,
  fontToUnicode: fontToUnicode,
  normalize: normalize,
  toUnicode: toUnicode,
  fontDetect: fontDetect,
  detectEncoding: detectEncoding
};
