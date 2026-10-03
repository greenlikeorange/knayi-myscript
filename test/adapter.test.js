const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const { pathToFileURL } = require('url');
const knayi = require('../main');
const { ZawgyiDetector } = require('myanmar-tools');
const { loadWithInternals } = require('../scripts/testing/internals');

// The optional myanmar-tools adapter of fontDetect (library/detector.js): the probability thresholds, the
// options that choose it, and what happens when the package cannot be loaded. myanmar-tools 1.1.3 is a dev
// dependency; the failures are made with fresh copies of detector.js that load it from a place where it is
// missing or broken.

const ZAWGYI = 'မဂၤလာပါ';
const UNICODE = 'မင်္ဂလာပါ';
const DEFAULTS = { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] };
const NOT_INSTALLED = 'myanmar-tools is not installed; fontDetect used the rule scorer. Install myanmar-tools@1.1.3 to use it.';
const NOT_AVAILABLE = 'myanmar-tools is not available in this environment; fontDetect used the rule scorer.';

const probability = (text) => new ZawgyiDetector().getZawgyiProbability(text);

// Runs fn with console.warn and console.error recorded instead of printed.
function capture(fn) {
  const messages = [];
  const warn = console.warn;
  const error = console.error;
  console.warn = (...args) => messages.push(['warn', args.join(' ')]);
  console.error = (...args) => messages.push(['error', args.join(' ')]);
  try {
    return { value: fn(), messages: messages };
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

afterEach(() => knayi.setGlobalOptions({ silent_mode: false, detector: DEFAULTS }));

describe('myanmar-tools adapter', () => {
  it('loads myanmar-tools 1.1.3', () => {
    assert.equal(require('myanmar-tools/package.json').version, '1.1.3');
    const run = capture(() => knayi.fontDetect(ZAWGYI, null, { adapter: 'myanmartools' }));
    assert.equal(run.value, 'zawgyi');
    assert.deepEqual(run.messages, []);
  });

  describe('thresholds', () => {
    // Probes from clearly Unicode to clearly Zawgyi; the detector is scored on the trimmed text.
    const probes = [UNICODE, 'က', 'ကာ', 'က္က', ZAWGYI];
    const EPSILON = 1e-9;

    it('reads Unicode below the first threshold, Zawgyi above the second, and the fallback between', () => {
      for (const text of probes) {
        const p = probability(text);
        const detect = (threshold, fallback) => knayi.fontDetect(' ' + text + ' ', fallback, {
          adapter: 'myanmartools',
          myanmartools_zg_threshold: threshold
        });
        assert.equal(detect([p + EPSILON, 1], 'en'), 'unicode', text);
        assert.equal(detect([0, p - EPSILON], 'en'), 'zawgyi', text);
        assert.equal(detect([p - EPSILON, p + EPSILON], 'en'), 'en', text);
        // Both comparisons are strict: a probability equal to a threshold is between them.
        assert.equal(detect([p, p], 'unicode'), 'unicode', text);
        assert.equal(detect([p, p], undefined), 'zawgyi', text);
      }
    });

    it('defaults to [0.05, 0.95]', () => {
      assert.equal(knayi.fontDetect('က', 'en', { adapter: 'myanmartools' }), 'en'); // p = 0.48
      assert.equal(knayi.fontDetect('ကျ', 'en', { adapter: 'myanmartools' }), 'unicode'); // p = 0.0006
      assert.equal(knayi.fontDetect(ZAWGYI, 'en', { adapter: 'myanmartools' }), 'zawgyi'); // p = 0.99998
      assert.equal(knayi.fontDetect('က္က', 'en', { adapter: 'myanmartools' }), 'en'); // p = 0.93
    });

    it('takes thresholds from the call, then from setGlobalOptions', () => {
      const p = probability('က္က');
      knayi.setGlobalOptions({ detector: { myanmartools_zg_threshold: [0.05, p - EPSILON] } });
      assert.equal(knayi.fontDetect('က္က', 'en', { adapter: 'myanmartools' }), 'zawgyi');
      assert.equal(knayi.fontDetect('က္က', 'en', { adapter: 'myanmartools', myanmartools_zg_threshold: [0.05, 0.95] }), 'en');
      // A later call that only sets use_myanmartools keeps the stored threshold.
      knayi.setGlobalOptions({ detector: { use_myanmartools: true } });
      assert.equal(knayi.fontDetect('က္က', 'en'), 'zawgyi');
    });

    it('uses the default pair, with an error, when a threshold is not [number, number]', () => {
      for (const threshold of ['0.5', [0.05], [0.05, '0.9'], null]) {
        const run = capture(() => knayi.fontDetect('က္က', 'en', { adapter: 'myanmartools', myanmartools_zg_threshold: threshold }));
        assert.equal(run.value, 'en', JSON.stringify(threshold));
        assert.deepEqual(run.messages, [['error', 'myanmartools_zg_threshold must be [number, number]']]);
      }
    });
  });

  describe('choosing the adapter', () => {
    // 'က္က' is a tie for the rule scorer (the fallback) and Zawgyi for myanmar-tools above p = 0.93.
    const tools = { myanmartools_zg_threshold: [0.05, 0.9] };

    it('uses the rule scorer by default', () => {
      assert.equal(knayi.fontDetect('က္က', 'unicode'), 'unicode');
      assert.equal(knayi.fontDetect('က္က', 'unicode', tools), 'unicode');
    });

    it('uses myanmar-tools for adapter myanmartools or use_myanmartools', () => {
      assert.equal(knayi.fontDetect('က္က', 'unicode', Object.assign({ adapter: 'myanmartools' }, tools)), 'zawgyi');
      assert.equal(knayi.fontDetect('က္က', 'unicode', Object.assign({ use_myanmartools: true }, tools)), 'zawgyi');
      knayi.setGlobalOptions({ detector: { use_myanmartools: true, myanmartools_zg_threshold: [0.05, 0.9] } });
      assert.equal(knayi.fontDetect('က္က', 'unicode'), 'zawgyi');
    });

    it('lets an explicit adapter win over use_myanmartools', () => {
      knayi.setGlobalOptions({ detector: { use_myanmartools: true } });
      assert.equal(knayi.fontDetect('က္က', 'unicode', Object.assign({ adapter: 'rules' }, tools)), 'unicode');
      assert.equal(knayi.fontDetect('က္က', 'unicode', Object.assign({ adapter: 'rules', use_myanmartools: true }, tools)), 'unicode');
    });

    it('falls back to use_myanmartools for an unknown adapter name', () => {
      assert.equal(knayi.fontDetect('က္က', 'unicode', Object.assign({ adapter: 'other' }, tools)), 'unicode');
      assert.equal(knayi.fontDetect('က္က', 'unicode', Object.assign({ adapter: 'other', use_myanmartools: true }, tools)), 'zawgyi');
    });

    it('skips the adapter for missing content and text with no Myanmar character', () => {
      const options = Object.assign({ adapter: 'myanmartools' }, tools);
      assert.equal(knayi.fontDetect('abc', undefined, options), 'en');
      assert.equal(knayi.fontDetect('abc', 'zawgyi', options), 'zawgyi');
      knayi.setGlobalOptions({ silent_mode: true });
      assert.equal(knayi.fontDetect('', 'zawgyi', options), 'zawgyi');
    });

    it('reads Myanmar digits alone as Unicode: myanmar-tools gives them probability -Infinity', () => {
      assert.equal(probability('၁၂၃'), -Infinity);
      assert.equal(knayi.fontDetect('၁၂၃ abc', 'zawgyi', Object.assign({ adapter: 'myanmartools' }, tools)), 'unicode');
      assert.equal(knayi.fontDetect('၁၂၃ abc', 'zawgyi', { adapter: 'rules' }), 'zawgyi');
    });
  });

  describe('when myanmar-tools cannot be loaded', () => {
    let root;
    before(() => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'knayi-adapter-'));
      // 1.2.0 on npm was published without build_node/, so require() fails inside the package.
      const broken = path.join(root, 'broken', 'node_modules', 'myanmar-tools');
      fs.mkdirSync(broken, { recursive: true });
      fs.writeFileSync(path.join(broken, 'package.json'), JSON.stringify({ name: 'myanmar-tools', version: '1.2.0', main: 'index.js' }));
      fs.writeFileSync(path.join(broken, 'index.js'), "module.exports = require('./build_node/zawgyi_detector.js');\n");
      const empty = path.join(root, 'empty', 'node_modules', 'myanmar-tools');
      fs.mkdirSync(empty, { recursive: true });
      fs.writeFileSync(path.join(empty, 'package.json'), JSON.stringify({ name: 'myanmar-tools', version: '1.1.3', main: 'index.js' }));
      fs.writeFileSync(path.join(empty, 'index.js'), 'module.exports = {};\n');
      fs.mkdirSync(path.join(root, 'missing'));
    });
    after(() => fs.rmSync(root, { recursive: true, force: true }));

    // A fresh detector.js whose module.require loads packages as a file in root/<place> would.
    function detectorIn(place) {
      const requireFrom = Module.createRequire(path.join(root, place, 'app.js'));
      return loadWithInternals('detector.js', [], { moduleRequire: (id) => requireFrom(id) });
    }

    // Probes and fallbacks for which the rule scorer decides, and ties.
    const probes = [[ZAWGYI, undefined], [UNICODE, undefined], ['က္က', 'unicode'], ['က', undefined], ['ကျ', 'zawgyi']];

    function assertRuleScorer(fontDetect) {
      for (const [text, fallback] of probes) {
        assert.equal(fontDetect(text, fallback, { adapter: 'myanmartools' }), knayi.fontDetect(text, fallback, { adapter: 'rules' }), text);
      }
    }

    it('says it is not installed when the package is missing', () => {
      assert.throws(() => Module.createRequire(path.join(root, 'missing', 'app.js'))('myanmar-tools'),
        (error) => /MODULE_NOT_FOUND$/.test(String(error.code)), 'myanmar-tools must not resolve from ' + root);
      const fontDetect = detectorIn('missing');
      const run = capture(() => assertRuleScorer(fontDetect));
      assert.deepEqual(run.messages, [['warn', NOT_INSTALLED]]);
    });

    it('names the error when the package fails inside', () => {
      const run = capture(() => assertRuleScorer(detectorIn('broken')));
      assert.equal(run.messages.length, 1);
      assert.equal(run.messages[0][0], 'warn');
      assert.match(run.messages[0][1], /^myanmar-tools could not be loaded \([^\n]*build_node[^\n]*\); fontDetect used the rule scorer\. Install myanmar-tools@1\.1\.3\.$/);
    });

    it('says the package has no ZawgyiDetector export', () => {
      const run = capture(() => assertRuleScorer(detectorIn('empty')));
      assert.deepEqual(run.messages, [['warn', 'myanmar-tools could not be loaded (the package has no ZawgyiDetector export); ' +
        'fontDetect used the rule scorer. Install myanmar-tools@1.1.3.']]);
    });

    it('says it is not available outside Node', () => {
      const messages = [];
      const context = vm.createContext({ console: { warn: (m) => messages.push(['warn', m]), error: (m) => messages.push(['error', m]) } });
      const fontDetect = loadWithInternals('detector.js', [], { context: context });
      assertRuleScorer(fontDetect);
      assert.deepEqual(messages, [['warn', NOT_AVAILABLE]]);
    });

    it('tries to load it once, and warns once', () => {
      let loads = 0;
      const requireFrom = Module.createRequire(path.join(root, 'missing', 'app.js'));
      const fontDetect = loadWithInternals('detector.js', [], { moduleRequire: (id) => { loads++; return requireFrom(id); } });
      const run = capture(() => {
        for (let i = 0; i < 3; i++) fontDetect(ZAWGYI, null, { adapter: 'myanmartools' });
      });
      assert.equal(loads, 1);
      assert.deepEqual(run.messages, [['warn', NOT_INSTALLED]]);
    });

    it('warns after silent mode ends if it has not warned yet', () => {
      const fontDetect = detectorIn('missing');
      knayi.setGlobalOptions({ silent_mode: true });
      const silent = capture(() => fontDetect(ZAWGYI, null, { adapter: 'myanmartools' }));
      assert.equal(silent.value, 'zawgyi');
      assert.deepEqual(silent.messages, []);
      knayi.setGlobalOptions({ silent_mode: false });
      const loud = capture(() => fontDetect(UNICODE, null, { adapter: 'myanmartools' }));
      assert.equal(loud.value, 'unicode');
      assert.deepEqual(loud.messages, [['warn', NOT_INSTALLED]]);
    });

    it('does not load it for the rule scorer', () => {
      let loads = 0;
      const fontDetect = loadWithInternals('detector.js', [], { moduleRequire: () => { loads++; throw new Error('unexpected'); } });
      assert.equal(fontDetect(ZAWGYI, null, { adapter: 'rules' }), 'zawgyi');
      assert.equal(fontDetect(ZAWGYI), 'zawgyi');
      assert.equal(loads, 0);
    });
  });

  // The ESM build has no module.require, so it loads myanmar-tools with process.getBuiltinModule from the
  // working directory (refactor plan, section 7 item 15). Run from the package root, it finds the dev
  // dependency. Node before 20.16 and 22.3 has no process.getBuiltinModule: there the ESM build cannot load
  // the package and uses the rule scorer.
  it('loads it in the ESM build from the working directory', async (t) => {
    if (!fs.existsSync(path.join(process.cwd(), 'node_modules', 'myanmar-tools', 'package.json'))) {
      t.skip('myanmar-tools is not installed in the working directory');
      return;
    }
    const dist = require('../scripts/build').builtDist();
    const esm = await import(pathToFileURL(path.join(dist, 'knayi-myscript.mjs')).href);
    const run = capture(() => esm.fontDetect('က္က', 'unicode', { adapter: 'myanmartools', myanmartools_zg_threshold: [0.05, 0.9] }));
    if (typeof process.getBuiltinModule === 'function') {
      assert.equal(run.value, 'zawgyi');
      assert.deepEqual(run.messages, []);
    } else {
      assert.equal(run.value, 'unicode');
      assert.deepEqual(run.messages, [['warn', NOT_AVAILABLE]]);
    }
  });
});
