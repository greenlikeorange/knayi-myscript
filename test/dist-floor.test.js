const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const esbuild = require('esbuild');
const floor = require('../scripts/browser/floor');
const examples = require('../scripts/browser/examples');
const { FILES, SOURCE_TYPES, builtDist } = require('../scripts/build');

// README.md promises the dist builds run in Chrome 51, Edge 15, Firefox 54 and Safari 10.1, the first versions with
// all of ES2015 (decision 18, option b for 3.0). test/syntax.test.js checks ES2015 syntax; this checks that the
// builds use no syntax or built-in those browsers lack. The rules and their browser versions are in
// scripts/browser/floor.js.

// A fresh build of this checkout in a temporary directory, or KNAYI_DIST (scripts/build.js).
const DIST = builtDist();

function tally(uses) {
  const counts = {};
  for (const use of uses) counts[use.id] = (counts[use.id] || 0) + 1;
  return counts;
}

// The rule ids check() reports for a snippet. The snippets below use undeclared names such as `x` and `f`, so the
// allowlist ids ('unlisted global', 'unlisted static') are left out unless `unlisted` is set.
const UNLISTED = ['unlisted global', 'unlisted static'];
function ids(code, sourceType, at, unlisted) {
  const found = floor.check(code, { sourceType: sourceType || 'script', floor: at }).map((v) => v.id);
  return [...new Set(found)].filter((id) => unlisted || UNLISTED.indexOf(id) === -1).sort();
}

describe('dist builds and the README browser floor', () => {
  const at = floor.readmeFloor();

  it('README.md states 3.0\'s floor', () => {
    assert.deepEqual(at, { chrome: 51, edge: 15, firefox: 54, safari: 10.1 });
  });

  for (const file of FILES) {
    it(file + ' uses nothing the floor lacks', () => {
      const code = fs.readFileSync(path.join(DIST, file), 'utf8');
      const violations = floor.check(code, { sourceType: SOURCE_TYPES[file], floor: at });
      const list = violations.map((v) => '  ' + v.id + ' at ' + v.line + ':' + v.column + ' (' + v.blocked.join(', ') +
        ')  ' + v.text).join('\n');
      assert.deepEqual(tally(violations), {}, file + ' below the floor:\n' + list);
    });
  }
});

describe('floor checker', () => {
  // The 2.x floor, fixed here so these cases do not move with README.md.
  const at = { chrome: 49, edge: 14, firefox: 34, safari: 10 };

  it('rejects what the floor lacks', () => {
    const cases = [
      ['let a = 1;', ['let']],
      ['const a = 1;', ['const']],
      ['class A {}', ['class']],
      ['var A = class {};', ['class']],
      ['for (var x of y) f(x);', ['for-of']],
      ['var { a } = b; var [c] = d;', ['destructuring']],
      ['function F() { return new.target; }', ['new.target']],
      ['var o = { m() { return super.m(); } };', ['super']],
      ["var s = '\\u{1F600}';", ['code-point-escape']],
      ['var t = `\\u{1F600}`;', ['code-point-escape']],
      ['var r = /a/u;', ['regexp-u-flag']],
      ['if (x) { function f() {} }', ['block-function']],
      ['function g() { return () => arguments; }', ['arrow-arguments']],
      ['globalThis.x = 1;', ['globalThis']],
      ["typeof globalThis.process === 'object';", ['globalThis']],
      ['var s = Symbol("x");', ['Symbol']],
      ['Reflect.ownKeys(o);', ['Reflect']],
      ['window.Symbol;', ['Symbol']],
      ['Object.entries(o); Object.values(o);', ['Object.entries', 'Object.values']],
      ["'abc'.includes('a'); [1].includes(1);", ['.includes']],
      ["s.padStart(2, '0');", ['.padStart']],
      ['p.finally(f);', ['.finally']],
      ['re.flags;', ['.flags']],
      ['var t = new Uint8Array(160).fill(1);', ['TypedArray method']],
      ['var t = new Uint16Array(4); t.map(f);', ['TypedArray method']],
      ['var t; t = new Int32Array(4); t.sort();', ['TypedArray method']],
      ['Uint8Array.prototype.fill;', ['TypedArray method']],
      ['Uint8Array.from(a);', ['TypedArray.from/of']],
      ['var t = new Uint8Array();', ['new TypedArray()']]
    ];
    for (const [code, expected] of cases) assert.deepEqual(ids(code, 'script', at), expected, code);
  });

  it('allows what the floor has', () => {
    const cases = [
      'var f = (a, b = 1, ...c) => a + b + c.length;',
      'var t = `x${y}`; var u = String.raw`a`;',
      "var o = { a, b() {}, ['c' + 1]: 2, get d() { return 1; } };",
      'function* g() { yield 1; }',
      'var n = 0b11 + 0o7;',
      'var r = /a/y; var q = /[\\u1000-\\u1021]/g;',
      'f(...a); var b = [...a];',
      "var s = '\\u1000\\\\u{1000}';",
      '(typeof globalThis !== "undefined" ? globalThis : window).x = 1;',
      '(typeof globalThis<"u"?globalThis:typeof self<"u"?self:window).x=1;',
      "if (typeof Symbol === 'function') Symbol.iterator;",
      "var r = typeof Reflect === 'undefined' ? null : Reflect;",
      "typeof Object.entries === 'function' && Object.entries(o);",
      'function h(Symbol) { return Symbol; }',
      "[1].fill(0); 'a'.normalize('NFC'); 'ab'.startsWith('a'); Object.assign({}, a); Array.from(a); new Map();",
      'm.values(); m.keys(); [].entries();',
      'var t = new Uint8Array(4); t.set(u); t.subarray(1);',
      'function k() { if (x) { return function () {}; } }',
      'function l() { var a = arguments; return function () { return arguments; }; }'
    ];
    for (const code of cases) assert.deepEqual(ids(code, 'script', at), [], code);
  });

  it('flags a global or static member that no rule names and the floor allowlists leave out', () => {
    const cases = [
      ['var s = new Intl.Segmenter("my");', ['Intl.Segmenter']],
      ['var l = new Intl.ListFormat("my");', ['Intl.ListFormat']],
      ['var p = new Intl.PluralRules("my");', ['Intl.PluralRules']],
      ['var o = {}; var c = structuredClone(o);', ['structuredClone']],
      ['queueMicrotask(function () {});', ['queueMicrotask']],
      ['var d = new Intl.DisplayNames(["my"], { type: "language" });', ['unlisted static']],
      ['var e = new Error("x"); Error.captureStackTrace(e);', ['unlisted static']],
      ['var n = Math.sumPrecise([1, 2]);', ['unlisted static']],
      ['var i = Iterator.from([1]);', ['unlisted global']],
      ['var l = navigator.language;', ['unlisted global']],
      ['fetch("/");', ['unlisted global']]
    ];
    for (const [code, expected] of cases) assert.deepEqual(ids(code, 'script', at, true), expected, code);
    const allowed = [
      'var x = [1]; Object.keys(x); Math.max(1, 2); String.fromCharCode(65); Array.isArray(x); JSON.stringify(x);',
      'window.knayi = 1; self.knayi = 1; console.log(new Map(), new Set(), new Intl.Collator("my"), parseInt("1", 10));',
      'var u = "/"; if (typeof fetch === "function") fetch(u);',
      'typeof Intl.Segmenter === "function" && new Intl.Segmenter("my");',
      'function g() { return arguments.length; }'
    ];
    for (const code of allowed) assert.deepEqual(ids(code, 'script', at, true), [], code);
  });

  it('switches rules off when the floor rises', () => {
    const es2015 = { chrome: 51, edge: 15, firefox: 54, safari: 10.1 };
    assert.deepEqual(ids('let a = 1; for (const x of y) f(x); var { b } = c; class A {}', 'script', es2015), []);
    assert.deepEqual(ids('globalThis.x;', 'script', es2015), ['globalThis']);
    // BCD gives Safari 10.1 for classes, which the 3.0 core uses, so Safari 10 is below 3.0's floor.
    assert.deepEqual(ids('class A {}', 'script', Object.assign({}, es2015, { safari: 10 })), ['class']);
    assert.deepEqual(ids('var a = [1]; var t = Uint16Array.from(a);', 'script', es2015, true), []);
  });

  it('sees a read after a typeof guard that returns early, and through a chain of ||', () => {
    const es2015 = { chrome: 51, edge: 15, firefox: 54, safari: 10.1 };
    const guarded = [
      "function f() { if (typeof globalThis === 'undefined') return null; return globalThis.x; }",
      "function f() { if (typeof globalThis === 'undefined') { g(); return null; } return globalThis.x; }",
      "function f() { if (typeof globalThis === 'undefined' || !globalThis.x || !globalThis.x.y) throw e; return globalThis; }",
      'function f(){if(typeof globalThis>"u"||!globalThis.x)return null;let t=globalThis.x;return t}',
      "var a = typeof globalThis === 'undefined' || !globalThis.x || globalThis.x.y;"
    ];
    for (const code of guarded) assert.deepEqual(ids(code, 'script', es2015), [], code);
    const unguarded = [
      "function f() { var x = globalThis.x; if (typeof globalThis === 'undefined') return null; return x; }",
      "function f() { if (typeof globalThis === 'undefined') g(); return globalThis.x; }",
      "function f() { if (typeof globalThis === 'undefined' && h) return null; return globalThis.x; }",
      "function f() { if (typeof globalThis === 'undefined') return null; } globalThis.x;",
      "var a = typeof globalThis === 'undefined' && !globalThis.x;"
    ];
    for (const code of unguarded) assert.deepEqual(ids(code, 'script', es2015), ['globalThis'], code);
  });

  it('catches what esbuild passes through at target es2015', () => {
    // From the plan's critic probe: esbuild keeps function-level let and const, for...of and TypedArray#fill.
    const contents = [
      'const TABLE = new Uint8Array(160).fill(1);',
      'function scan(text) {',
      '  let n = 0;',
      '  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); if (TABLE[c - 0x1000]) n++; }',
      '  for (const x of [1, 2]) n += x;',
      '  return n;',
      '}',
      'module.exports = scan;'
    ].join('\n');
    for (const minify of [false, true]) {
      const out = esbuild.buildSync({
        stdin: { contents, sourcefile: 'probe.js' }, bundle: true, format: 'iife', globalName: 'probe',
        target: 'es2015', minify, write: false, logLevel: 'silent'
      }).outputFiles[0].text;
      const found = ids(out, 'script', at);
      for (const id of ['for-of', 'TypedArray method']) assert.ok(found.includes(id), 'minify ' + minify + ': ' + found);
      assert.ok(found.includes('let') || found.includes('const'), 'minify ' + minify + ': ' + found);
    }
  });

  it('catches the escape esbuild writes for an astral character', () => {
    // A Myanmar Extended-C digit (U+116D0) as a surrogate pair comes out as a code point escape at es2015.
    const backslash = String.fromCharCode(92);
    const contents = 'module.exports = "' + backslash + 'ud805' + backslash + 'uded0";';
    const out = esbuild.buildSync({
      stdin: { contents, sourcefile: 'astral.js' }, bundle: true, format: 'iife', globalName: 'probe',
      target: 'es2015', minify: true, write: false, logLevel: 'silent'
    }).outputFiles[0].text;
    assert.deepEqual(ids(out, 'script', at), ['code-point-escape'], out);
  });

  it('checks a RegExp source against ES2015 and the floor', () => {
    assert.deepEqual(floor.regexpProblems('[\\u1000-\\u1021]\\u103b(?![\\u1000-\\u1021])', 'g', { floor: at }), []);
    assert.deepEqual(floor.regexpProblems('a/b', '', { floor: at }), []);
    for (const [pattern, flags] of [['(?<=a)b', ''], ['(?<!a)b', ''], ['(?<n>a)', ''], ['\\p{L}', 'u'], ['a.b', 's']]) {
      assert.notDeepEqual(floor.regexpProblems(pattern, flags, { floor: at }), [], pattern + ' ' + flags);
    }
    assert.match(floor.regexpProblems('a', 'u', { floor: at }).join(), /firefox 34/);
  });
});

describe('floor emulation', () => {
  // Each script build runs in a vm context with every built-in the floor lacks deleted (globalThis, Object.entries,
  // String#padStart, Array#values, ...), on the README examples, more call forms and generated inputs: the 2.x calls
  // through knayi.compat of knayi.min.js and knayi of knayi-myscript.min.js, the 3.0 calls through knayi of
  // knayi.min.js. Their results must equal those of the ES module sources in
  // Node (scripts/browser/node-results.js). This catches a use the AST check cannot type, such as Array#values
  // against Map#values. The module builds hold the same code in another wrapper, so the check above covers them.
  const calls = { compat: examples.allCalls(), api: examples.apiCalls() };
  const expected = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'browser', 'node-results.js')],
    { maxBuffer: 1 << 27 }));

  // Node with myanmar-tools hidden says "not installed"; with no `process`, compat says "not available" instead.
  const NODE_ADAPTER_WARNING = /^warn: myanmar-tools is not installed;/;
  const FLOOR_ADAPTER_WARNING = 'warn: myanmar-tools is not available in this environment; fontDetect used the rule scorer.';

  // A vm context with the post-floor built-ins removed and the script build `file` run in it.
  function floorContext(file) {
    const context = vm.createContext({});
    vm.runInContext('var console = { log: function () {}, warn: function () {}, error: function () {} };', context);
    const removed = vm.runInContext(floor.removalScript(), context);
    assert.ok(removed.length > 50, 'removed ' + removed.length);
    assert.equal(vm.runInContext('typeof globalThis + typeof Object.entries + typeof "".padStart', context),
      'undefinedundefinedundefined');
    // What no rule names goes too: the allowlists leave these out.
    assert.equal(vm.runInContext('[typeof Intl.Segmenter, typeof Object.groupBy, typeof [].at, typeof Iterator, ' +
      'typeof WeakRef, typeof Error.captureStackTrace].join()', context), 'undefined,undefined,undefined,undefined,undefined,undefined');
    vm.runInContext(fs.readFileSync(path.join(DIST, file), 'utf8'), context, { filename: file });
    return context;
  }

  function runIn(context, target, list) {
    return JSON.parse(vm.runInContext('(' + examples.runCalls + ')(' + target + ', JSON.parse(' +
      JSON.stringify(JSON.stringify(list)) + '))', context));
  }

  // The 2.x API's results, the adapter warning once at the first adapter call.
  function checkCompat(actual) {
    let adapterWarnings = 0;
    const diffs = examples.differences(calls.compat, actual, expected.compat, {
      same(i, a, b) {
        const floorLines = (a.console || []).map((line) => line === FLOOR_ADAPTER_WARNING ? 'adapter warning' : line);
        const nodeLines = (b.console || []).map((line) => NODE_ADAPTER_WARNING.test(line) ? 'adapter warning' : line);
        if (floorLines.indexOf('adapter warning') !== -1) adapterWarnings++;
        return JSON.stringify(Object.assign({}, a, { console: floorLines })) ===
          JSON.stringify(Object.assign({}, b, { console: nodeLines }));
      }
    });
    assert.deepEqual(diffs, [], diffs.join('\n'));
    assert.equal(adapterWarnings, 1, 'the adapter warning appears once, at the first adapter call');
  }

  it('knayi.compat in knayi.min.js gives compat\'s results without the post-floor built-ins', () => {
    checkCompat(runIn(floorContext('knayi.min.js'), 'knayi.compat', calls.compat));
  });

  it('knayi in knayi-myscript.min.js, 2.x\'s file name, gives compat\'s results without them', () => {
    checkCompat(runIn(floorContext('knayi-myscript.min.js'), 'knayi', calls.compat));
  });

  it('knayi in knayi.min.js gives the 3.0 API\'s results without the post-floor built-ins', () => {
    const actual = runIn(floorContext('knayi.min.js'), 'knayi', calls.api);
    const diffs = examples.differences(calls.api, actual, expected.api);
    assert.deepEqual(diffs, [], diffs.join('\n'));
  });
});
