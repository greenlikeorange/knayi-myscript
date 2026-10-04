// The browser builds in Chromium, Firefox and WebKit: README.md's examples, more call forms and generated inputs
// (scripts/browser/examples.js) must give the results of the ES module sources under Node, the 2.x calls on the 2.x
// API and the 3.0 calls on the 3.0 API. Run with `npm run test:browser`.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const examples = require('./examples');
const { pendingPort } = require('../testing/pending-port');

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

// A page cannot make knayi load myanmar-tools, but it can pass a detector it made itself as zawgyiDetector. Here the
// page runs myanmar-tools 1.1.3's own detector file (the dev dependency), with the `exports` object it writes to and
// a Buffer for the base64 model it reads, which a browser decodes with atob.
const DETECTOR_SOURCE = fs.readFileSync(require.resolve('myanmar-tools/build_node/zawgyi_detector.js'), 'utf8');
const DETECTOR_PROBES = [['မဂၤလာပါ', null], ['မင်္ဂလာပါ', null], ['က္က', 'unicode'], ['က', 'en'], ['ဗုဒ္ဓ', null]];

function detectWith(lib, ZawgyiDetector, probes) {
  const zawgyiDetector = new ZawgyiDetector();
  const results = probes.map(([text, fallback]) => lib.fontDetect(text, fallback, { adapter: 'myanmartools', zawgyiDetector }));
  lib.setGlobalOptions({ detector: { use_myanmartools: true, zawgyiDetector } });
  results.push(lib.fontConvert('ဗုဒ္ဓ', 'unicode'));
  lib.setGlobalOptions({ detector: { use_myanmartools: false, zawgyiDetector: null } });
  return results;
}

// The 2.x API's builds: knayi.compat of knayi.min.js (page.html), knayi of knayi-myscript.min.js (page-2x.html), and
// the default export of the compat module build. Node's results come from compat with myanmar-tools 1.1.3. The test
// waits for the port of the zawgyiDetector option (scripts/testing/pending-port.js).
test('the script and module builds use a ZawgyiDetector passed as zawgyiDetector', async ({ page }) => {
  await pendingPort('840c8c5', async () => {
    await detectorInBuilds(page);
  })();
});

async function detectorInBuilds(page) {
  const compat = require('../../src/compat/index.js').default;
  const expected = detectWith(compat, require('myanmar-tools').ZawgyiDetector, DETECTOR_PROBES);
  expect(expected).toEqual(['zawgyi', 'unicode', 'unicode', 'en', 'unicode', 'ဗုဒ္ဓ']);
  const targets = [['/scripts/browser/page.html', 'knayi.compat'], ['/scripts/browser/page-2x.html', 'knayi'],
    ['/scripts/browser/page.html', '/dist/knayi-myscript-compat.min.mjs']];
  for (const [url, target] of targets) {
    await page.goto(url);
    const actual = await page.evaluate(async ({ source, run, probes, target }) => {
      function Buffer(base64) {
        const text = atob(base64);
        const bytes = new Uint8Array(text.length);
        for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
        return bytes;
      }
      const tools = {};
      new Function('exports', 'Buffer', source)(tools, Buffer);
      const lib = target === 'knayi' ? window.knayi : target === 'knayi.compat' ? window.knayi.compat
        : (await import(target)).default;
      const messages = [];
      const { warn, error } = console;
      console.warn = (message) => messages.push('warn: ' + message);
      console.error = (message) => messages.push('error: ' + message);
      try {
        return { results: new Function('return ' + run)()(lib, tools.ZawgyiDetector, probes), messages };
      } finally {
        Object.assign(console, { warn, error });
      }
    }, { source: DETECTOR_SOURCE, run: detectWith.toString(), probes: DETECTOR_PROBES, target });
    expect(actual, target).toEqual({ results: expected, messages: [] });
  }
}
