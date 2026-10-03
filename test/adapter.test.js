const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
// The 2.x API: compat, on the 3.0 core.
const knayi = require('../src/compat/index.js').default;
const { ZawgyiDetector } = require('myanmar-tools');

// The optional myanmar-tools adapter of fontDetect, through compat (src/compat/fontDetect.js and zawgyiModel.js): the
// probability thresholds and the options that choose it, with the real package. myanmar-tools 1.1.3 is a dev
// dependency, and compat finds it from the working directory, the package root when the tests run. What happens
// when the package cannot be loaded, and where it is looked up from, is checked with stub loaders in
// test/next/compat-fontDetect.test.mjs, where the cases this file ran on 2.x's loader moved.

const ZAWGYI = 'မဂၤလာပါ';
const UNICODE = 'မင်္ဂလာပါ';
const DEFAULTS = { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] };

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
});
