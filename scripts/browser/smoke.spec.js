// The browser builds in Chromium, Firefox and WebKit: README.md's examples, more call forms and generated inputs
// (scripts/browser/examples.js) must give main.js's results under Node. Run with `npm run test:browser`.
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const examples = require('./examples');
const knayi = require('../../main.js');

const calls = examples.allCalls();
let nodeResults = null;
let pageErrors = [];

function expected() {
  if (!nodeResults) {
    nodeResults = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, 'node-results.js')], { maxBuffer: 1 << 26 }));
  }
  return nodeResults;
}

// A browser has no require, so the adapter examples warn this where Node with myanmar-tools missing says
// "is not installed". The return values are the same.
const BROWSER_ADAPTER_WARNING = 'warn: myanmar-tools is not available in this environment; fontDetect used the rule scorer.';
const NODE_ADAPTER_WARNING = /^warn: myanmar-tools is not installed;/;

function compare(actual) {
  let adapterWarnings = 0;
  const diffs = examples.differences(calls, actual, expected(), {
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

// Runs the shared call list in the page against `target`: 'global' for window.knayi, or a module URL.
function runInPage(page, target) {
  return page.evaluate(async ({ source, list, target }) => {
    const run = new Function('return ' + source)();
    const lib = target === 'global' ? window.knayi : (await import(target)).default;
    return run(lib, list);
  }, { source: examples.runCalls.toString(), list: calls, target });
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

test('the script build sets the knayi global with every main.js export', async ({ page }) => {
  const keys = await page.evaluate(() => typeof window.knayi === 'object' ? Object.keys(window.knayi) : null);
  expect(keys).toEqual(Object.keys(knayi));
  expect(await page.evaluate(() => window.knayi.fontConvert('မဂၤလာပါ', 'unicode', 'zawgyi'))).toBe('မင်္ဂလာပါ');
});

test('the script build gives main.js results', async ({ page }) => {
  compare(JSON.parse(await runInPage(page, 'global')));
});

test('the module build has every main.js export by name and gives main.js results', async ({ page }) => {
  const names = await page.evaluate(async () => Object.keys(await import('/dist/knayi-myscript.mjs')).sort());
  expect(names).toEqual(Object.keys(knayi).concat('default').sort());
  compare(JSON.parse(await runInPage(page, '/dist/knayi-myscript.mjs')));
});
