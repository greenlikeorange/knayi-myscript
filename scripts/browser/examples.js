'use strict';
// One list of calls for every place that runs a build outside Node's ES module sources: the browsers
// (scripts/browser/smoke.spec.js), the floor emulation (test/dist-floor.test.js) and the RegExp check
// (test/regex-floor.test.js). allCalls() calls the 2.x API (compat, knayi.compat in knayi.min.js, and knayi in
// knayi-myscript.min.js): the examples of README.md and MIGRATION.md, a few more call forms, and generated inputs
// over the Myanmar block and Latin-1, and runs of marks (synthetic only, decision 22). apiCalls() calls the 3.0 API
// on the same generated inputs.

const fs = require('fs');
const path = require('path');
const { readExamples } = require('../testing/readme-examples');

// The documents whose examples run in the builds: README.md, which documents the 3.0 API, and MIGRATION.md, which
// documents the 2.x API call by call beside its 3.0 equivalent.
const DOCUMENTS = ['README.md', 'MIGRATION.md'];

// The calls in the code blocks of the documents (or of `text`) of one API, 'compat' (the 2.x API) or 'knayi' (the
// 3.0 API), as source text: the examples test/readme.test.js runs, read by the same reader
// (scripts/testing/readme-examples.js). runCalls evaluates them with both names bound to the library it runs.
function readmeExamples(api, text) {
  const documents = text === undefined
    ? DOCUMENTS.map((name) => [fs.readFileSync(path.join(__dirname, '..', '..', name), 'utf8'), name])
    : [[text, 'README.md']];
  return documents.flatMap(([body, name]) => readExamples(body, name))
    .filter((example) => example.api === api).map((example) => example.code);
}

// Call forms the documents show only in prose: the three debugging sources, the rule adapter, the myanmar-tools
// adapter with no detector (which warns once, in Node and in the builds), options objects, non-string input, and
// font names that throw (decision 9: compared by error class only).
const EXTRA = [
  'knayi.version',
  "knayi.fontDetect('မဂၤလာပါ', null, { adapter: 'myanmartools' })",
  "knayi.fontConvert.debugging('မဂၤလာပါ', 'unicode', 'zawgyi')",
  "knayi.fontConvert.debugging('မြန်မာ', 'zawgyi', 'unicode')",
  "knayi.fontConvert.debugging('jrefrm', 'unicode', 'win')",
  "knayi.fontConvert.debugging('ကျ', 'unicode')",
  "knayi.fontDetect('ႏို္င္ငံ', null, { adapter: 'rules' })",
  "knayi.fontDetect('ရန်ကုန်တက္ကသိုလ်', 'zawgyi')",
  "knayi.detectEncoding(' ႏို္င္ငံ ')",
  "knayi.detectEncoding(null)",
  "knayi.fontConvert('ၿမိဳ ့\\nတစ္ခ ု', 'unicode', 'zawgyi')",
  "knayi.fontConvert(' မြန်မာ ', 'zawgyi')",
  "knayi.syllBreak('ၿမိဳ ့ေတာ္', 'zawgyi', '|')",
  "knayi.syllBreak('မင်္ဂလာပါ မြန်မာ', 'detect', '|')",
  "knayi.truncate('မင်္ဂလာပါ မြန်မာ နိုင်ငံ', { length: 10, omission: '…', fontType: 'unicode' })",
  "knayi.truncate('ျမန္မာ ႏိုင္ငံ', { length: 4, fontType: 'zawgyi' })",
  "knayi.normalize(knayi.fontConvert('ေယာက္်ား', 'unicode', 'zawgyi'))",
  "knayi.normalize('ဘ၀ ၄ဝဝ ၁၉၇၇')",
  'knayi.normalize(123)',
  "knayi.fontConvert({ a: 1 }, 'unicode')",
  "knayi.syllBreak('က', 'win')",
  "knayi.spellingFix('ကိုု', 'uni')"
];

// Generated text: every character of the Myanmar block alone, after and before ka, and doubled after ka, and a
// few strings with zero-width characters, spaces, a line break and Latin.
function generatedTexts() {
  const texts = [];
  for (let cp = 0x1000; cp <= 0x109f; cp++) {
    const c = String.fromCharCode(cp);
    texts.push(c, '\u1000' + c, c + '\u1000', '\u1000' + c + c);
  }
  texts.push('\u1000\u200b\u1001', '\u1000\u200c\u1001', ' \u1000 ', '\u1000\n\u1001', 'abc');
  return texts;
}

// [functionName, ...args] calls of the 2.x API over generated text.
function generatedCalls() {
  const calls = [];
  for (const t of generatedTexts()) {
    calls.push(
      ['normalize', t],
      ['fontConvert', t, 'unicode', 'zawgyi'],
      ['fontConvert', t, 'zawgyi', 'unicode'],
      ['fontConvert', t, 'unicode'],
      ['fontDetect', t],
      ['fontDetect', t, 'unicode'],
      ['detectEncoding', t],
      ['syllBreak', t, 'unicode', '|'],
      ['syllBreak', t, 'zawgyi', '|'],
      ['spellingFix', t, 'unicode'],
      ['truncate', t, { length: 2, fontType: 'unicode' }]
    );
  }
  // Runs of marks of two classes, longer than the 30 code units src/core/nfc.js leaves to the runtime's NFC, so the
  // build puts them in order itself, with the classes it reads from the runtime: Myanmar, Latin, Hebrew, Arabic,
  // Tibetan and astral marks.
  const runs = [[0x1000, 0x1037, 0x1039], [0x1000, 0x103a, 0x1037], [0x61, 0x301, 0x323], [0x5d1, 0x5bc, 0x5b8],
    [0x628, 0x651, 0x64e], [0xf40, 0xf73, 0xf39], [0x78, 0x1d16d, 0x1d165]];
  for (const [base, a, b] of runs) {
    const run = String.fromCodePoint(a, b).repeat(20);
    const t = String.fromCodePoint(base) + run + ' ' + run;
    calls.push(['normalize', t], ['fontConvert', t, 'unicode', 'zawgyi'], ['fontConvert', t, 'unicode', 'win']);
  }
  // Win text is ASCII and Latin-1; 0x75 is u, which Win Innwa draws as က.
  for (let b = 0x20; b <= 0xff; b++) {
    const c = String.fromCharCode(b);
    calls.push(['fontConvert', c, 'unicode', 'win'], ['fontConvert', 'u' + c, 'unicode', 'win']);
  }
  return calls;
}

// The calls of the 2.x API. Strings are source text to evaluate with `knayi` and `compat` in scope; arrays are
// [functionName, ...args].
function allCalls() {
  return readmeExamples('compat').concat(EXTRA, generatedCalls());
}

// The examples of the 3.0 API in the documents, then [functionName, ...args] calls of it over generated text, and
// calls that it refuses (a thrown error is kept by class, as everywhere here). Win text converts only when named.
function apiCalls() {
  const calls = readmeExamples('knayi').concat([['createTrace'], ['normalize', 42], ['toUnicode', 'x', { from: 'Zawgyi' }],
    ['truncate', 'abc', { length: 1 }]]);
  for (const t of generatedTexts()) {
    calls.push(
      ['normalize', t],
      ['normalize', t, { report: true }],
      ['isNormalized', t],
      ['explain', t],
      ['detectEncoding', t],
      ['toUnicode', t],
      ['toUnicode', t, { from: 'zawgyi', offsets: true }],
      ['toUnicode', t, { tie: 'zawgyi' }],
      ['toZawgyi', t],
      ['segmentSyllables', t],
      ['segmentSyllables', t, { from: 'zawgyi', bareConsonants: 'pairs' }],
      ['syllableBoundaries', t],
      ['truncate', t, { length: 2 }],
      ['collapseRepeatedMarks', t]
    );
  }
  for (let b = 0x20; b <= 0xff; b++) calls.push(['toUnicode', 'u' + String.fromCharCode(b), { from: 'win' }]);
  return calls;
}

// Runs the calls against one copy of the library and returns the results as a JSON string. The function is
// self-contained ES5, because it is also sent into browsers (page.evaluate) and into the floor emulation, where
// it must not use a built-in the floor lacks. Thrown errors are kept by class only (decision 9); console.warn
// and console.error lines are kept with the call that wrote them.
function runCalls(knayi, calls) {
  var results = [];
  var lines = [];
  var con = typeof console !== 'undefined' ? console : null;
  var saved = con ? { warn: con.warn, error: con.error } : null;
  if (con) {
    con.warn = function () { lines.push('warn: ' + Array.prototype.join.call(arguments, ' ')); };
    con.error = function () { lines.push('error: ' + Array.prototype.join.call(arguments, ' ')); };
  }
  try {
    for (var i = 0; i < calls.length; i++) {
      var call = calls[i];
      var entry = {};
      lines = [];
      try {
        var value = typeof call === 'string' ?
          Function('knayi', 'compat', 'return (' + call + ');')(knayi, knayi) :
          knayi[call[0]].apply(knayi, call.slice(1));
        entry.type = typeof value;
        if (value !== undefined) entry.value = value;
      } catch (error) {
        entry.type = 'throw';
        entry.error = error && error.name;
      }
      if (lines.length) entry.console = lines;
      results.push(entry);
    }
  } finally {
    if (con) {
      con.warn = saved.warn;
      con.error = saved.error;
    }
  }
  return JSON.stringify(results);
}

// A readable name for call i, for failure messages.
function describeCall(call) {
  if (typeof call === 'string') return call.replace(/\s+/g, ' ');
  return 'knayi.' + call[0] + '(' + call.slice(1).map((a) => JSON.stringify(a)).join(', ') + ')';
}

// JSON with every non-ASCII character escaped, so that NFC and NFD, or a moved mark, look different.
function escaped(value) {
  return JSON.stringify(value).replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

// The first `limit` calls whose results differ, as text. `same(i, a, b)` may accept known differences.
function differences(calls, actual, expected, options) {
  const opts = options || {};
  const limit = opts.limit || 10;
  const same = opts.same || (() => false);
  const out = [];
  if (actual.length !== expected.length) out.push('result counts differ: ' + actual.length + ' against ' + expected.length);
  for (let i = 0; i < Math.min(actual.length, expected.length) && out.length < limit; i++) {
    const a = JSON.stringify(actual[i]);
    const b = JSON.stringify(expected[i]);
    if (a !== b && !same(i, actual[i], expected[i])) {
      out.push(describeCall(calls[i]) + '\n    got      ' + escaped(actual[i]) + '\n    expected ' + escaped(expected[i]));
    }
  }
  return out;
}

module.exports = { readmeExamples, generatedCalls, allCalls, apiCalls, runCalls, describeCall, differences, EXTRA };
