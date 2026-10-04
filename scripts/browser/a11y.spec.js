// axe-core accessibility check of the demo (docs/index.html) and the benchmark page (docs/benchmark.html), in
// light and dark mode, in Chromium only (scripts/browser/playwright.config.js). Every violation is printed and
// attached; only a serious or critical one that KNOWN does not list fails the test, and an entry of KNOWN that no
// page shows any more fails the file (remove it once the page is fixed).
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

// Serious and critical violations on today's pages, as rule id and element. docs/ is left to a later demo PR, so
// they are recorded here instead of fixed.
//
// - scrollable-region-focusable: the Input and Output code point lists (docs/index.html:1263, `.cp-body`, shown by
//   default) scroll but cannot take focus, so a keyboard cannot scroll them. The stylesheet already styles
//   `.cp-body:focus-visible` (docs/index.html:180), so tabindex="0" with a label looks intended.
const KNOWN = {
  'scrollable-region-focusable': ['.cp-col:nth-child(1) > .cp-body', '.cp-col:nth-child(2) > .cp-body']
};

// The demo loads a pinned knayi from jsDelivr with an integrity hash. The tests run offline, so the page gets
// the local build in its place; the hash pins the CDN bytes, so the tag loses it. The demo is written for the 2.x
// global, which 3.0's dist/knayi-myscript.min.js keeps under its 2.x name. Nothing else in the page changes.
const CDN_TAG = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/knayi-myscript@[^"]+\/dist\/knayi-myscript\.min\.js"[^>]*><\/script>/g;
const LOCAL_TAGS = '<script src="/dist/knayi-myscript.min.js"></script>';

const PAGES = [
  { name: 'demo', path: '/docs/index.html', scheme: 'light' },
  { name: 'demo, dark', path: '/docs/index.html', scheme: 'dark' },
  { name: 'demo, rule steps', path: '/docs/index.html#debug-mode', scheme: 'light' },
  { name: 'demo, install panel', path: '/docs/index.html', scheme: 'light', open: '#install-toggle' },
  { name: 'benchmark', path: '/docs/benchmark.html', scheme: 'light' },
  { name: 'benchmark, dark', path: '/docs/benchmark.html', scheme: 'dark' }
];

let cdnTags = null;
// The KNOWN violations seen, and how many pages ran to the end of their check in this worker.
const seen = new Set();
let pagesChecked = 0;

test.beforeEach(async ({ page, baseURL }) => {
  // Fonts and every other outside request fail, as on a machine with no network.
  await page.route((url) => url.origin !== new URL(baseURL).origin, (route) => route.abort());
  cdnTags = null;
  await page.route('**/docs/index.html', async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    cdnTags = (html.match(CDN_TAG) || []).length;
    await route.fulfill({ response, body: html.replace(CDN_TAG, LOCAL_TAGS) });
  });
});

for (const target of PAGES) {
  test('axe: ' + target.name, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: target.scheme });
    await page.goto(target.path);
    if (target.path.startsWith('/docs/index.html')) {
      expect(cdnTags, 'jsDelivr knayi script tags in docs/index.html').toBe(1);
      await expect(page.locator('#version')).toHaveText(/^v\d/);
      await expect(page.locator('#call')).not.toBeEmpty();
      await expect(page.locator('#load-error')).toBeHidden();
    }
    if (target.open) {
      await page.click(target.open);
      await expect(page.locator('#install-panel')).toBeVisible();
    }

    const results = await new AxeBuilder({ page }).analyze();
    await testInfo.attach('axe violations', { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
    for (const v of results.violations) {
      console.log('[' + target.name + '] ' + v.impact + ' ' + v.id + ' (' + v.nodes.length + '): ' + v.help + '\n  ' +
        v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n  '));
    }

    const blocking = [];
    for (const v of results.violations) {
      if (v.impact !== 'serious' && v.impact !== 'critical') continue;
      for (const node of v.nodes) {
        const where = node.target.join(' ');
        if ((KNOWN[v.id] || []).indexOf(where) === -1) blocking.push(v.impact + ' ' + v.id + ': ' + where);
        else {
          seen.add(v.id + ': ' + where);
          testInfo.annotations.push({ type: 'known axe violation', description: v.id + ': ' + where });
        }
      }
    }
    pagesChecked++;
    expect(blocking, 'serious and critical axe violations; see the log above').toEqual([]);
  });
}

// The tests of this file run in order in one worker. After a failure Playwright starts a new worker for the rest,
// which then sees only some of the pages; that run has failed already, so the check is left out.
test.afterAll(() => {
  if (pagesChecked < PAGES.length) return;
  const stale = [];
  for (const id of Object.keys(KNOWN)) {
    for (const where of KNOWN[id]) if (!seen.has(id + ': ' + where)) stale.push(id + ': ' + where);
  }
  expect(stale, 'KNOWN lists axe violations that no page shows any more; remove them').toEqual([]);
});
