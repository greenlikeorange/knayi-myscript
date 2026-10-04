// The browser builds in Chromium, Firefox and WebKit: README.md's examples, more call forms and generated inputs
// (scripts/browser/examples.js) must give the results of the ES module sources under Node, the 2.x calls on the 2.x
// API and the 3.0 calls on the 3.0 API. Run with `npm run test:browser`.
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const examples = require('./examples');

const calls = { compat: examples.allCalls(), api: examples.apiCalls() };
let nodeResults = null;
let pageErrors = [];

function expected() {
  if (!nodeResults) {
    nodeResults = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, 'node-results.js')], { maxBuffer: 1 << 27 }));
  }
  return nodeResults;
}

// A browser has no `process`, so compat's adapter examples warn this where Node with myanmar-tools missing says
// "is not installed". The return values are the same.
const BROWSER_ADAPTER_WARNING = 'warn: myanmar-tools is not available in this environment; fontDetect used the rule scorer.';
const NODE_ADAPTER_WARNING = /^warn: myanmar-tools is not installed;/;

function compareCompat(actual) {
  let adapterWarnings = 0;
  const diffs = examples.differences(calls.compat, actual, expected().compat, {
    same(i, a, b) {
      const browser = (a.console || []).map((line) => line === BROWSER_ADAPTER_WARNING ? 'adapter warning' : line);
      const node = (b.console || []).map((line) => NODE_ADAPTER_WARNING.test(line) ? 'adapter warning' : line);
      if (browser.indexOf('adapter warning') !== -1) adapterWarnings++;
      return JSON.stringify(Object.assign({}, a, { console: browser })) === JSON.stringify(Object.assign({}, b, { console: node }));
    }
  });
  expect(diffs, diffs.join('\n')).toEqual([]);
  expect(adapterWarnings, 'the adapter warning appears once').toBe(1);
}

function compareApi(actual) {
  const diffs = examples.differences(calls.api, actual, expected().api);
  expect(diffs, diffs.join('\n')).toEqual([]);
}

// Runs a call list in the page against `target`: 'knayi' or 'knayi.compat' for a script build's global, or
// { module, part } for a module build's namespace ('*') or default export ('default').
function runInPage(page, target, list) {
  return page.evaluate(async ({ source, list, target }) => {
    const run = new Function('return ' + source)();
    let lib;
    if (target === 'knayi') lib = window.knayi;
    else if (target === 'knayi.compat') lib = window.knayi.compat;
    else {
      const namespace = await import(target.module);
      lib = target.part === 'default' ? namespace.default : namespace;
    }
    return run(lib, list);
  }, { source: examples.runCalls.toString(), list, target });
}

test.beforeEach(async ({ page, browser }, testInfo) => {
  testInfo.annotations.push({ type: 'browser', description: testInfo.project.name + ' ' + browser.version() });
  pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/scripts/browser/page.html');
});

test.afterEach(() => {
  expect(pageErrors, 'uncaught errors in the page').toEqual([]);
});

test('knayi.min.js sets knayi to the 3.0 API, with the 2.x API as knayi.compat', async ({ page }) => {
  const names = await page.evaluate(async () => ({
    global: Object.keys(window.knayi).sort(),
    api: Object.keys(await import('/dist/knayi-myscript.min.mjs')).sort(),
    compat: Object.keys(window.knayi.compat)
  }));
  expect(names.global).toEqual(names.api.concat('compat').sort());
  expect(names.compat).toEqual(['version', 'setGlobalOptions', 'fontDetect', 'fontConvert', 'syllBreak', 'spellingFix',
    'truncate', 'normalize']);
  expect(await page.evaluate(() => window.knayi.compat.fontConvert('မဂၤလာပါ', 'unicode', 'zawgyi'))).toBe('မင်္ဂလာပါ');
});

test('knayi.min.js gives the results of the sources', async ({ page }) => {
  compareCompat(JSON.parse(await runInPage(page, 'knayi.compat', calls.compat)));
  compareApi(JSON.parse(await runInPage(page, 'knayi', calls.api)));
});

test('knayi-myscript.min.js, 2.x\'s file name, sets knayi to the 2.x API and gives its results', async ({ page }) => {
  await page.goto('/scripts/browser/page-2x.html');
  expect(await page.evaluate(() => Object.keys(window.knayi))).toEqual(['version', 'setGlobalOptions', 'fontDetect',
    'fontConvert', 'syllBreak', 'spellingFix', 'truncate', 'normalize']);
  compareCompat(JSON.parse(await runInPage(page, 'knayi', calls.compat)));
});

test('the module builds give the results of the sources', async ({ page }) => {
  compareCompat(JSON.parse(await runInPage(page, { module: '/dist/knayi-myscript-compat.min.mjs', part: 'default' }, calls.compat)));
  compareApi(JSON.parse(await runInPage(page, { module: '/dist/knayi-myscript.min.mjs', part: '*' }, calls.api)));
});
