const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const acorn = require('acorn');
const { execFileSync } = require('child_process');
const floor = require('../scripts/browser/floor');
const examples = require('../scripts/browser/examples');

// test/syntax.test.js checks the regex literals in the builds, because acorn validates them at ES2015. A RegExp
// built from a string at run time is invisible to it, so this records every one the code of src/ builds and checks
// it the same way: no lookbehind, named groups, \p{} or s flag, and no u flag below the README floor. The records
// come from scripts/browser/built-regexps.js, in a process of its own (see there).

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const records = JSON.parse(execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'browser', 'built-regexps.js')],
  { maxBuffer: 1 << 26 }));

// Every `new RegExp(...)` and `RegExp(...)` in src/, as 'src/<file>:<line>'. spec/ is not shipped: nothing in src/
// imports it.
function constructorSites() {
  const sites = [];
  (function walkDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'spec') walkDir(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) sites.push.apply(sites, sitesIn(full));
    }
  })(SRC);
  return sites.sort();
}

function sitesIn(file) {
  const ast = acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const where = path.relative(ROOT, file).split(path.sep).join('/');
  const found = [];
  (function visit(node) {
    if ((node.type === 'NewExpression' || node.type === 'CallExpression') &&
      node.callee.type === 'Identifier' && node.callee.name === 'RegExp') {
      found.push(where + ':' + node.loc.start.line);
    }
    for (const key of Object.keys(node)) {
      const value = node[key];
      for (const child of Array.isArray(value) ? value : [value]) {
        if (child && typeof child.type === 'string') visit(child);
      }
    }
  })(ast);
  return found;
}

function isRegExpPattern(record) {
  return record.pattern !== null && typeof record.pattern === 'object';
}

function unique(list) {
  const seen = new Map();
  for (const r of list) seen.set(JSON.stringify(r.pattern) + '/' + r.flags, r);
  return [...seen.values()];
}

describe('RegExps built from strings', () => {
  it('records every RegExp constructor call site in src/', (t) => {
    const sites = constructorSites();
    t.diagnostic(sites.length + ' call sites: ' + sites.join(', '));
    const seen = new Set(records.map((r) => r.site));
    const missed = sites.filter((site) => !seen.has(site));
    assert.ok(sites.length > 0);
    assert.deepEqual(missed, [], 'never reached, so never checked; add a call to scripts/browser/built-regexps.js');
  });

  it('compiles every one under ES2015 rules at the README floor', (t) => {
    const at = floor.readmeFloor();
    t.diagnostic(unique(records).length + ' distinct patterns from ' + records.length + ' constructions');
    const problems = [];
    for (const r of unique(records)) {
      if (isRegExpPattern(r)) continue;
      for (const problem of floor.regexpProblems(r.pattern, r.flags, { floor: at })) {
        problems.push(r.site + ' ' + r.via + ' /' + r.pattern + '/' + r.flags + ': ' + problem);
      }
    }
    assert.ok(unique(records).length > 0);
    assert.deepEqual(problems, [], problems.join('\n'));
  });

  it('never builds a RegExp from another RegExp with new flags', () => {
    // ES2015 allows new RegExp(regexp, flags); ES5 engines throw a TypeError. Which floor browsers still followed
    // ES5 here is not in browser-compat-data, so the code simply does not do it.
    const found = records.filter((r) => isRegExpPattern(r) && r.flags !== '');
    assert.deepEqual(found.map((r) => r.site), []);
  });

  it('builds the same RegExps, on the same calls, in the script build', () => {
    // The browsers get the builds, so check that the script build makes exactly the patterns checked above. It holds
    // both APIs, and the module builds the same code. legacyWinTables is not in it: no API calls it.
    const context = vm.createContext({});
    vm.runInContext([
      'var console = { log: function () {}, warn: function () {}, error: function () {} };',
      'var built = [];',
      'RegExp = new Proxy(RegExp, {',
      '  construct: function (t, a) { built.push(String(a[0]) + "/" + (a[1] === undefined ? "" : String(a[1]))); return Reflect.construct(t, a); },',
      '  apply: function (t, self, a) { built.push(String(a[0]) + "/" + (a[1] === undefined ? "" : String(a[1]))); return Reflect.apply(t, self, a); }',
      '});'
    ].join('\n'), context);
    const dist = require('../scripts/build').builtDist();
    vm.runInContext(fs.readFileSync(path.join(dist, 'knayi-myscript.min.js'), 'utf8'), context);
    const run = (target, list) => vm.runInContext('(' + examples.runCalls + ')(' + target + ', JSON.parse(' +
      JSON.stringify(JSON.stringify(list)) + '))', context);
    run('knayi.compat', examples.allCalls());
    run('knayi', examples.apiCalls());
    const fromScript = [...new Set(vm.runInContext('built', context))].sort();
    const fromSources = [...new Set(records.filter((r) => (r.via === 'new RegExp' || r.via === 'RegExp()') &&
      r.site.indexOf('src/compat/legacy.js:') !== 0).map((r) => String(r.pattern) + '/' + r.flags))].sort();
    assert.deepEqual(fromScript, fromSources);
  });
});
