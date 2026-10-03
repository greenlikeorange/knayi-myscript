'use strict';
// One list of calls for every place that runs a build outside Node's main.js: the browsers
// (scripts/browser/smoke.spec.js), the floor emulation (test/dist-floor.test.js) and the RegExp check
// (test/regex-floor.test.js). It holds the README examples, a few more call forms, and generated inputs over
// the Myanmar block and Latin-1 (synthetic only, decision 22).

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = path.join(__dirname, '..', '..');

function isKnayiCall(node) {
  if (!node || node.type !== 'CallExpression') return false;
  let callee = node.callee;
  while (callee.type === 'MemberExpression') callee = callee.object;
  return callee.type === 'Identifier' && callee.name === 'knayi';
}

// Every `knayi.…(…)` statement in the javascript blocks of README.md, as source text.
function readmeExamples(text) {
  const readme = text === undefined ? fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8') : text;
  const examples = [];
  const fence = /^```javascript\n([\s\S]*?)^```/gm;
  let match;
  while ((match = fence.exec(readme))) {
    const block = match[1];
    const ast = acorn.parse(block, { ecmaVersion: 'latest', sourceType: 'module' });
    for (const statement of ast.body) {
      if (statement.type === 'ExpressionStatement' && isKnayiCall(statement.expression)) {
        examples.push(block.slice(statement.expression.start, statement.expression.end));
      }
    }
  }
  return examples;
}

// Call forms the README shows only in prose: the three debugging sources, the rule adapter, options objects,
// non-string input, and font names that throw (decision 9: compared by error class only).
const EXTRA = [
  'knayi.version',
  "knayi.fontConvert.debugging('မဂၤလာပါ', 'unicode', 'zawgyi')",
  "knayi.fontConvert.debugging('မြန်မာ', 'zawgyi', 'unicode')",
  "knayi.fontConvert.debugging('jrefrm', 'unicode', 'win')",
  "knayi.fontConvert.debugging('ကျ', 'unicode')",
  "knayi.fontDetect('ႏို္င္ငံ', null, { adapter: 'rules' })",
  "knayi.fontDetect('ရန်ကုန်တက္ကသိုလ်', 'zawgyi')",
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

// [functionName, ...args] calls over generated text.
function generatedCalls() {
  const texts = [];
  for (let cp = 0x1000; cp <= 0x109f; cp++) {
    const c = String.fromCharCode(cp);
    texts.push(c, '\u1000' + c, c + '\u1000', '\u1000' + c + c);
  }
  texts.push('\u1000\u200b\u1001', '\u1000\u200c\u1001', ' \u1000 ', '\u1000\n\u1001', 'abc');
  const calls = [];
  for (const t of texts) {
    calls.push(
      ['normalize', t],
      ['fontConvert', t, 'unicode', 'zawgyi'],
      ['fontConvert', t, 'zawgyi', 'unicode'],
      ['fontConvert', t, 'unicode'],
      ['fontDetect', t],
      ['fontDetect', t, 'unicode'],
      ['syllBreak', t, 'unicode', '|'],
      ['syllBreak', t, 'zawgyi', '|'],
      ['spellingFix', t, 'unicode'],
      ['truncate', t, { length: 2, fontType: 'unicode' }]
    );
  }
  // Win text is ASCII and Latin-1; 0x75 is u, which Win Innwa draws as က.
  for (let b = 0x20; b <= 0xff; b++) {
    const c = String.fromCharCode(b);
    calls.push(['fontConvert', c, 'unicode', 'win'], ['fontConvert', 'u' + c, 'unicode', 'win']);
  }
  return calls;
}

// Strings are source text to evaluate with `knayi` in scope; arrays are [functionName, ...args].
function allCalls() {
  return readmeExamples().concat(EXTRA, generatedCalls());
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
          Function('knayi', 'return (' + call + ');')(knayi) :
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
    if (a !== b && !same(i, actual[i], expected[i])) out.push(describeCall(calls[i]) + '\n    got      ' + a + '\n    expected ' + b);
  }
  return out;
}

module.exports = { readmeExamples, generatedCalls, allCalls, runCalls, describeCall, differences, EXTRA };
