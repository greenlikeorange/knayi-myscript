const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const acorn = require('acorn');

// test/syntax.test.js checks the regex literals in the builds, because acorn validates them at ES2015. A RegExp
// built from a string at run time is invisible to it, so this records every one the library builds and checks
// it the same way: no lookbehind, named groups, \p{} or s flag, and no u flag below the README floor.

const ROOT = path.join(__dirname, '..');
const LIBRARY = path.join(ROOT, 'library') + path.sep;
const MAIN = path.join(ROOT, 'main.js');

// Hooks go in before anything loads the library.
const NativeRegExp = RegExp;
const records = [];

function librarySite() {
  const prepare = Error.prepareStackTrace;
  Error.prepareStackTrace = (error, frames) => frames;
  const frames = new Error().stack;
  Error.prepareStackTrace = prepare;
  for (const frame of frames) {
    const file = frame.getFileName();
    if (file && (file.startsWith(LIBRARY) || file === MAIN)) {
      return path.relative(ROOT, file).split(path.sep).join('/') + ':' + frame.getLineNumber();
    }
  }
  return null;
}

function record(via, pattern, flags) {
  const site = librarySite();
  if (site) records.push({ via, site, pattern, flags: flags === undefined ? '' : String(flags) });
}

global.RegExp = new Proxy(NativeRegExp, {
  construct(target, args, newTarget) {
    record('new RegExp', args[0], args[1]);
    return Reflect.construct(target, args, newTarget === global.RegExp ? target : newTarget);
  },
  apply(target, thisArg, args) {
    record('RegExp()', args[0], args[1]);
    return Reflect.apply(target, thisArg, args);
  }
});

// match, search and matchAll turn a string argument into a RegExp inside the engine.
for (const name of ['match', 'search', 'matchAll']) {
  const original = String.prototype[name];
  Object.defineProperty(String.prototype, name, {
    configurable: true,
    writable: true,
    value: function (pattern) {
      if (!(pattern instanceof NativeRegExp)) {
        record('.' + name, pattern === undefined ? '' : String(pattern), name === 'matchAll' ? 'g' : '');
      }
      return original.apply(this, arguments);
    }
  });
}

const knayi = require('../main');
const floor = require('../scripts/browser/floor');
const examples = require('../scripts/browser/examples');

examples.runCalls(knayi, examples.allCalls());

// Every `new RegExp(...)` and `RegExp(...)` in library/ and main.js, as 'file:line'.
function constructorSites() {
  const files = fs.readdirSync(path.join(ROOT, 'library')).filter((f) => f.endsWith('.js')).map((f) => path.join('library', f));
  const sites = [];
  for (const file of files.concat('main.js')) {
    const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
    (function visit(node) {
      if ((node.type === 'NewExpression' || node.type === 'CallExpression') &&
        node.callee.type === 'Identifier' && node.callee.name === 'RegExp') {
        sites.push(file.split(path.sep).join('/') + ':' + node.loc.start.line);
      }
      for (const key of Object.keys(node)) {
        const value = node[key];
        for (const child of Array.isArray(value) ? value : [value]) {
          if (child && typeof child.type === 'string') visit(child);
        }
      }
    })(ast);
  }
  return sites;
}

function unique(list) {
  const seen = new Map();
  for (const r of list) seen.set(String(r.pattern) + '/' + r.flags, r);
  return [...seen.values()];
}

describe('RegExps built from strings', () => {
  it('records every RegExp constructor call site in library/ and main.js', (t) => {
    const sites = constructorSites();
    t.diagnostic(sites.length + ' call sites: ' + sites.join(', '));
    const seen = new Set(records.map((r) => r.site));
    const missed = sites.filter((site) => !seen.has(site));
    assert.ok(sites.length > 0);
    assert.deepEqual(missed, [], 'never reached, so never checked; add a call form to scripts/browser/examples.js');
  });

  it('compiles every one under ES2015 rules at the README floor', (t) => {
    const at = floor.readmeFloor();
    t.diagnostic(unique(records).length + ' distinct patterns from ' + records.length + ' constructions');
    const problems = [];
    for (const r of unique(records)) {
      if (r.pattern instanceof NativeRegExp) continue;
      for (const problem of floor.regexpProblems(String(r.pattern), r.flags, { floor: at })) {
        problems.push(r.site + ' ' + r.via + ' /' + r.pattern + '/' + r.flags + ': ' + problem);
      }
    }
    assert.ok(unique(records).length > 0);
    assert.deepEqual(problems, [], problems.join('\n'));
  });

  it('never builds a RegExp from another RegExp with new flags', () => {
    // ES2015 allows new RegExp(regexp, flags); ES5 engines throw a TypeError. Which floor browsers still
    // followed ES5 here is not in browser-compat-data, so the library simply does not do it.
    const found = records.filter((r) => r.pattern instanceof NativeRegExp && r.flags !== '');
    assert.deepEqual(found.map((r) => r.site), []);
  });

  it('builds the same RegExps in the min.js build', () => {
    // The browsers get min.js, so check that it builds exactly the patterns checked above.
    const context = vm.createContext({});
    vm.runInContext([
      'var console = { log: function () {}, warn: function () {}, error: function () {} };',
      'var built = [];',
      'RegExp = new Proxy(RegExp, {',
      '  construct: function (t, a) { built.push(String(a[0]) + "/" + (a[1] === undefined ? "" : String(a[1]))); return Reflect.construct(t, a); },',
      '  apply: function (t, self, a) { built.push(String(a[0]) + "/" + (a[1] === undefined ? "" : String(a[1]))); return Reflect.apply(t, self, a); }',
      '});'
    ].join('\n'), context);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'dist', 'knayi-myscript.min.js'), 'utf8'), context);
    vm.runInContext('(' + examples.runCalls + ')(knayi, JSON.parse(' + JSON.stringify(JSON.stringify(examples.allCalls())) + '))', context);
    const fromMin = [...new Set(vm.runInContext('built', context))].sort();
    const fromMain = [...new Set(records.filter((r) => r.via === 'new RegExp' || r.via === 'RegExp()')
      .map((r) => String(r.pattern) + '/' + r.flags))].sort();
    assert.deepEqual(fromMin, fromMain);
  });
});
