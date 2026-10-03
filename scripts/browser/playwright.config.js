// `npm run test:browser`: the script and module builds in Chromium, Firefox and WebKit. Browsers come from
// `npx playwright install chromium firefox webkit`.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const root = path.join(__dirname, '..', '..');
const port = Number(process.env.KNAYI_BROWSER_PORT || 4317);
const baseURL = 'http://127.0.0.1:' + port;

// macOS 27 protects ~/Library/Application Support/Firefox, which Playwright's Firefox also reads, so a launch
// from a terminal fails with "Could not find profile folder" (microsoft/playwright#42768, fixed in Firefox 158).
// A separate CoreFoundation home works around it. It lives in the temp directory, not the repo, because macOS
// puts a deny-delete ACL on the Library and Downloads folders created in it.
function firefoxLaunchOptions() {
  if (process.platform !== 'darwin') return {};
  const home = path.join(os.tmpdir(), 'knayi-playwright-firefox-home');
  fs.mkdirSync(home, { recursive: true });
  return { env: Object.assign({}, process.env, { CFFIXED_USER_HOME: home }) };
}

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.js',
  outputDir: path.join(root, 'test-results', 'browser'),
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: Object.assign({}, devices['Desktop Firefox'], { launchOptions: firefoxLaunchOptions() }) },
    { name: 'webkit', use: devices['Desktop Safari'] }
  ],
  webServer: {
    command: 'node scripts/browser/serve.js',
    cwd: root,
    url: baseURL + '/scripts/browser/page.html',
    env: { KNAYI_BROWSER_PORT: String(port) },
    reuseExistingServer: false,
    timeout: 15000
  }
});
