const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { inspect } = require('util');
// The 2.x API: compat, on the 3.0 core.
const knayi = require('../src/compat/index.js').default;
const { storedDetectorOptions } = require('../src/compat/globalOptions.js');
const { fontDetectCore } = require('../src/compat/fontDetect.js');
const { createZawgyiModelLoader } = require('../src/compat/zawgyiModel.js');
const { ZawgyiDetector } = require('myanmar-tools');
const { pendingPort } = require('../scripts/testing/pending-port');

// The optional myanmar-tools adapter of fontDetect, through compat (src/compat/fontDetect.js and zawgyiModel.js): the
// probability thresholds, the options that choose it, a detector passed as zawgyiDetector, and what loads the
// package, with the real package. myanmar-tools 1.1.3 is a dev dependency. What happens when the package cannot be
// loaded is checked with stub loaders in test/next/compat-fontDetect.test.mjs, where the cases this file ran on 2.x's
// loader moved; the cases below that need a loader of their own build one the same way.

const ZAWGYI = 'မဂၤလာပါ';
const UNICODE = 'မင်္ဂလာပါ';
const DEFAULTS = { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95], zawgyiDetector: null };
const NOT_INSTALLED = 'myanmar-tools is not installed; fontDetect used the rule scorer. Install myanmar-tools@1.1.3 to use it.';
const NOT_AVAILABLE = 'myanmar-tools is not available in this environment; fontDetect used the rule scorer.';
const DETECTOR_ERROR = '[ERR_KNAYI_INVALID_DETECTOR] zawgyiDetector must have a getZawgyiProbability method.';

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

    // Not two finite numbers in order: not a pair, a string, NaN, an infinity, or the higher number first.
    const INVALID = ['0.5', [0.05], [0.05, '0.9'], null, [NaN, NaN], [0.05, NaN], [-Infinity, 0.95], [0.05, Infinity],
      [0.95, 0.05], [0.5, 0.4999]];
    // The error starts with its code, which is API; the words after it may change.
    const THRESHOLD_ERROR = '[ERR_KNAYI_INVALID_THRESHOLD] myanmartools_zg_threshold must be two finite numbers in order.';

    it('uses the stored pair, with an error, when a threshold is not two finite numbers in order', pendingPort('fb6594d', () => {
      for (const threshold of INVALID) {
        const label = inspect(threshold);
        const run = capture(() => knayi.fontDetect('က္က', 'en', { adapter: 'myanmartools', myanmartools_zg_threshold: threshold }));
        assert.equal(run.value, 'en', label);
        assert.deepEqual(run.messages, [['error', THRESHOLD_ERROR]], label);
      }
      const p = probability('က္က');
      knayi.setGlobalOptions({ detector: { myanmartools_zg_threshold: [0.05, 0.9] } });
      const run = capture(() => knayi.fontDetect('က္က', 'en', { adapter: 'myanmartools', myanmartools_zg_threshold: [0.95, 0.05] }));
      assert.ok(p > 0.9);
      assert.equal(run.value, 'zawgyi');
      assert.deepEqual(run.messages, [['error', THRESHOLD_ERROR]]);
    }));

    it('keeps the stored pair, with an error, when setGlobalOptions gets an invalid threshold', pendingPort('fb6594d', () => {
      knayi.setGlobalOptions({ detector: { myanmartools_zg_threshold: [0.05, 0.9] } });
      for (const threshold of INVALID) {
        const run = capture(() => knayi.setGlobalOptions({ detector: { use_myanmartools: true, myanmartools_zg_threshold: threshold } }));
        assert.deepEqual(run.messages, [['error', THRESHOLD_ERROR]], inspect(threshold));
        assert.deepEqual(storedDetectorOptions().myanmartools_zg_threshold, [0.05, 0.9]);
        // The rest of the detector options are stored.
        assert.equal(knayi.fontDetect('က္က', 'en'), 'zawgyi');
        knayi.setGlobalOptions({ detector: { use_myanmartools: false } });
        assert.equal(knayi.fontDetect('က္က', 'en'), 'en');
      }
    }));

    it('accepts equal numbers, and any finite numbers in order', () => {
      for (const threshold of [[0.5, 0.5], [0, 1], [-1, 2], [0.05, 0.95]]) {
        const run = capture(() => knayi.setGlobalOptions({ detector: { myanmartools_zg_threshold: threshold } }));
        assert.deepEqual(run.messages, [], JSON.stringify(threshold));
        assert.deepEqual(storedDetectorOptions().myanmartools_zg_threshold, threshold);
      }
    });

    it('writes the threshold error only when not silent', pendingPort('fb6594d', () => {
      knayi.setGlobalOptions({ silent_mode: true });
      const run = capture(() => [
        knayi.fontDetect('က္က', 'en', { adapter: 'myanmartools', myanmartools_zg_threshold: [0.95, 0.05] }),
        knayi.setGlobalOptions({ detector: { myanmartools_zg_threshold: [NaN, NaN] } }),
        knayi.setGlobalOptions({ silent_mode: false, detector: { myanmartools_zg_threshold: 'x' } })
      ]);
      assert.deepEqual(run.value, ['en', undefined, undefined]);
      assert.deepEqual(run.messages, [['error', THRESHOLD_ERROR]]);
    }));
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

    it('falls back to use_myanmartools for an unknown adapter name, with a warning', pendingPort('fb6594d', () => {
      const run = capture(() => [
        knayi.fontDetect('က္က', 'unicode', Object.assign({ adapter: 'other' }, tools)),
        knayi.fontDetect('က္က', 'unicode', Object.assign({ adapter: 'other', use_myanmartools: true }, tools)),
        knayi.fontDetect('က္က', 'unicode', Object.assign({ adapter: 'Rules' }, tools)),
        knayi.fontDetect('က္က', 'unicode', Object.assign({ adapter: new String('tools'), use_myanmartools: true }, tools))
      ]);
      assert.deepEqual(run.value, ['unicode', 'zawgyi', 'unicode', 'zawgyi']);
      assert.deepEqual(run.messages, [
        ['warn', 'Unknown adapter "other" on knayi.fontDetect.'],
        ['warn', 'Unknown adapter "other" on knayi.fontDetect.'],
        ['warn', 'Unknown adapter "Rules" on knayi.fontDetect.'],
        ['warn', 'Unknown adapter "tools" on knayi.fontDetect.']
      ]);
    }));

    it('warns about an unknown adapter only when not silent, and only for text it detects', () => {
      const options = Object.assign({ adapter: 'other' }, tools);
      knayi.setGlobalOptions({ silent_mode: true });
      const silent = capture(() => knayi.fontDetect('က္က', 'unicode', options));
      assert.deepEqual(silent, { value: 'unicode', messages: [] });
      knayi.setGlobalOptions({ silent_mode: false });
      const loud = capture(() => [knayi.fontDetect('abc', undefined, options), knayi.fontDetect(123, undefined, options)]);
      assert.deepEqual(loud, { value: ['en', 'en'], messages: [] });
    });

    // An adapter name is read like a font name: a string other than '', or a String object's string.
    it('reads no adapter, and no warning, from a value that is not a string or is empty', pendingPort('fb6594d', () => {
      knayi.setGlobalOptions({ detector: { use_myanmartools: true } });
      const values = [undefined, null, '', 0, 1, false, true, NaN, {}, [], ['rules'], new String('')];
      const run = capture(() => values.map((adapter) =>
        knayi.fontDetect('က္က', 'unicode', Object.assign({ adapter: adapter }, tools))));
      assert.deepEqual(run, { value: values.map(() => 'zawgyi'), messages: [] });
      const named = capture(() => [
        knayi.fontDetect('က္က', 'unicode', Object.assign({ adapter: new String('rules') }, tools)),
        knayi.fontDetect('က္က', 'unicode', Object.assign({ adapter: new String('myanmartools'), use_myanmartools: false }, tools))
      ]);
      assert.deepEqual(named, { value: ['unicode', 'zawgyi'], messages: [] });
    }));

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

  // A detector passed as zawgyiDetector, for one call or stored with setGlobalOptions. The adapter calls its
  // getZawgyiProbability instead of loading the package, so it also works where knayi cannot load the package
  // itself (refactor plan, decision 17).
  describe('a detector passed as zawgyiDetector', () => {
    const detector = new ZawgyiDetector();
    const tools = { adapter: 'myanmartools', myanmartools_zg_threshold: [0.05, 0.9] };
    // 'ဗုဒ္ဓ' is a tie for the rule scorer, so Zawgyi with no fallback, and Unicode for myanmar-tools (p = 0.02).
    const TIE = 'ဗုဒ္ဓ';
    // Probes and fallbacks, with what the package that knayi loads gives for them.
    const probes = [[ZAWGYI, undefined], [UNICODE, undefined], ['က္က', 'unicode'], ['က', undefined], ['က', 'en'],
      [TIE, undefined], [' \u200b' + ZAWGYI + ' ', 'en']];
    const loaded = () => probes.map(([text, fallback]) => knayi.fontDetect(text, fallback, tools));

    // A detector that answers one probability, and records the text it was asked about.
    function fixed(p) {
      const asked = [];
      return { asked: asked, getZawgyiProbability: (text) => { asked.push(text); return p; } };
    }

    it('gives what the package knayi loads gives, with every threshold', pendingPort(['840c8c5', 'fb6594d'], () => {
      const thresholds = [null, [0.05, 0.95], [0.05, 0.9], [0.5, 0.5], [0, 1], [0.95, 0.05]];
      const answers = new Set();
      const run = capture(() => {
        for (const [text, fallback] of probes) {
          for (const threshold of thresholds) {
            const options = { adapter: 'myanmartools' };
            if (threshold) options.myanmartools_zg_threshold = threshold;
            const passed = knayi.fontDetect(text, fallback, Object.assign({ zawgyiDetector: detector }, options));
            assert.equal(passed, knayi.fontDetect(text, fallback, options), inspect([text, fallback, threshold]));
            answers.add(passed);
          }
        }
      });
      assert.deepEqual([...answers].sort(), ['en', 'unicode', 'zawgyi']);
      // The only messages are the threshold errors for [0.95, 0.05], once for each of the two calls.
      assert.equal(run.messages.length, probes.length * 2);
      assert.ok(run.messages.every((message) => /^\[ERR_KNAYI_INVALID_THRESHOLD\]/.test(message[1])));
    }));

    it('asks it about the text fontDetect scores, once a call, and only for the adapter', pendingPort(['840c8c5', '31eb6b1'], () => {
      const unicode = fixed(0);
      assert.equal(knayi.fontDetect(' \u200b' + ZAWGYI + '\u200c ', null, { adapter: 'myanmartools', zawgyiDetector: unicode }), 'unicode');
      assert.deepEqual(unicode.asked, [ZAWGYI]);
      // The detector does not choose the adapter: adapter and use_myanmartools do.
      assert.equal(knayi.fontDetect(ZAWGYI, null, { zawgyiDetector: unicode }), 'zawgyi');
      assert.equal(knayi.fontDetect(ZAWGYI, null, { adapter: 'rules', use_myanmartools: true, zawgyiDetector: unicode }), 'zawgyi');
      assert.equal(knayi.fontDetect('abc', 'en', { adapter: 'myanmartools', zawgyiDetector: unicode }), 'en');
      knayi.setGlobalOptions({ silent_mode: true, detector: { use_myanmartools: true, zawgyiDetector: unicode } });
      assert.equal(knayi.fontDetect(null), 'en');
      assert.deepEqual(knayi.detectEncoding(ZAWGYI), { encoding: 'zawgyi', unicode: 0, zawgyi: 1 });
      assert.deepEqual(unicode.asked, [ZAWGYI]);
    }));

    it('is stored by setGlobalOptions for every function that detects a font', pendingPort('840c8c5', () => {
      const unicode = fixed(0);
      knayi.setGlobalOptions({ detector: { use_myanmartools: true, zawgyiDetector: unicode } });
      const zawgyi = 'ျမန္မာ'; // Zawgyi for the rule scorer and for myanmar-tools
      assert.equal(knayi.fontDetect(zawgyi), 'unicode');
      assert.equal(knayi.fontConvert(zawgyi, 'unicode'), zawgyi);
      assert.equal(knayi.syllBreak(zawgyi, null, '|'), knayi.syllBreak(zawgyi, 'unicode', '|'));
      assert.equal(knayi.spellingFix('ကဳဳ'), 'ကဳဳ'); // the Unicode marks; the Zawgyi marks give 'ကဳ'
      assert.equal(knayi.truncate(zawgyi, { length: 5 }), knayi.truncate(zawgyi, { length: 5, fontType: 'unicode' }));
      assert.equal(unicode.asked.length, 5);
      // A later call that leaves it out keeps it, and a call may pass another.
      knayi.setGlobalOptions({ detector: { myanmartools_zg_threshold: [0.05, 0.9] } });
      assert.equal(knayi.fontDetect(zawgyi), 'unicode');
      assert.equal(knayi.fontDetect(UNICODE, null, { zawgyiDetector: fixed(1) }), 'zawgyi');
      // null for the call, or stored, is no detector: main.js loads the package. So is undefined where the key is
      // there, as in a spread of options that holds it; only a key left out keeps the stored detector.
      assert.equal(knayi.fontDetect(zawgyi, null, { zawgyiDetector: null }), 'zawgyi');
      assert.equal(knayi.fontDetect(zawgyi, null, { zawgyiDetector: undefined }), 'zawgyi');
      assert.equal(knayi.fontDetect(zawgyi, null, {}), 'unicode');
      assert.equal(unicode.asked.length, 7);
      knayi.setGlobalOptions({ detector: { zawgyiDetector: null } });
      assert.equal(knayi.fontDetect(zawgyi), 'zawgyi');
      knayi.setGlobalOptions({ detector: { zawgyiDetector: unicode } });
      knayi.setGlobalOptions({ detector: { zawgyiDetector: undefined } });
      assert.equal(knayi.fontDetect(zawgyi), 'zawgyi');
      assert.equal(unicode.asked.length, 7);
      // With myanmar-tools, a short Unicode word that the rule scorer ties on converts as Unicode.
      knayi.setGlobalOptions({ detector: { zawgyiDetector: detector } });
      assert.equal(knayi.fontConvert(TIE, 'unicode'), TIE);
      knayi.setGlobalOptions({ detector: { use_myanmartools: false } });
      assert.equal(knayi.fontConvert(TIE, 'unicode'), 'ဗုဒ်ဓ');
    }));

    it('takes no value without a getZawgyiProbability method, with an error unless silent', pendingPort(['840c8c5', 'fb6594d'], () => {
      const values = [{}, [], 0, 1, '', 'x', true, false, NaN, Object.create(null), { getZawgyiProbability: 0.5 },
        ZawgyiDetector, require('myanmar-tools')];
      const stored = fixed(1);
      knayi.setGlobalOptions({ detector: { use_myanmartools: true, zawgyiDetector: stored } });
      for (const value of values) {
        const label = inspect(value);
        // The call uses the stored detector, and setGlobalOptions keeps it.
        const call = capture(() => knayi.fontDetect(UNICODE, null, { zawgyiDetector: value }));
        assert.deepEqual(call, { value: 'zawgyi', messages: [['error', DETECTOR_ERROR]] }, label);
        const set = capture(() => knayi.setGlobalOptions({ detector: { zawgyiDetector: value } }));
        assert.deepEqual(set, { value: undefined, messages: [['error', DETECTOR_ERROR]] }, label);
        assert.equal(storedDetectorOptions().zawgyiDetector, stored, label);
      }
      assert.equal(stored.asked.length, values.length);
      // The options are read only for text with a Myanmar letter; a bad threshold comes first.
      const loud = capture(() => [
        knayi.fontDetect('abc', null, { zawgyiDetector: {} }),
        knayi.fontDetect(UNICODE, null, { adapter: 'rules', myanmartools_zg_threshold: 'x', zawgyiDetector: {} })
      ]);
      assert.deepEqual(loud.value, ['en', 'unicode']);
      assert.deepEqual(loud.messages.map((message) => message[0] + ' ' + message[1].split(' ')[0]),
        ['error [ERR_KNAYI_INVALID_THRESHOLD]', 'error [ERR_KNAYI_INVALID_DETECTOR]']);
      knayi.setGlobalOptions({ silent_mode: true });
      const silent = capture(() => [
        knayi.fontDetect(UNICODE, null, { zawgyiDetector: {} }),
        knayi.setGlobalOptions({ detector: { zawgyiDetector: 1 } })
      ]);
      assert.deepEqual(silent, { value: ['zawgyi', undefined], messages: [] });
    }));

    // A loader of its own (test/next/compat-fontDetect.test.mjs), whose require counts the loads and fails.
    it('loads nothing when it has a detector, and loads the package once it has none', pendingPort('840c8c5', () => {
      let loads = 0;
      const loader = createZawgyiModelLoader(() => { loads++; throw new Error('unexpected load'); });
      const fontDetect = (text, fallback, options) => fontDetectCore(text, fallback || 'zawgyi', options || {}, loader);
      const passed = capture(() => probes.map(([text, fallback]) => fontDetect(text, fallback,
        Object.assign({ zawgyiDetector: detector }, tools))));
      assert.deepEqual(passed, { value: loaded(), messages: [] });
      knayi.setGlobalOptions({ detector: { use_myanmartools: true, zawgyiDetector: detector } });
      assert.equal(fontDetect(TIE), 'unicode');
      assert.equal(loads, 0);
      const missing = capture(() => fontDetect(TIE, null, { zawgyiDetector: null }));
      assert.equal(loads, 1);
      assert.deepEqual(missing, { value: 'zawgyi', messages: [['warn', 'myanmar-tools could not be loaded (unexpected load); ' +
        'fontDetect used the rule scorer. Install myanmar-tools@1.1.3.']] });
    }));

    // A browser has no require: a loader whose require finds nothing, as compat's does where there is no Node-style
    // require (src/compat/zawgyiModel.js), and the two script builds, run as a browser runs them, as classic scripts
    // in a global object of their own.
    it('works where knayi cannot load the package', pendingPort('840c8c5', () => {
      const expected = loaded();
      for (const where of ['no Node', 'knayi-myscript.min.js', 'knayi.min.js']) {
        const messages = [];
        const record = { warn: (m) => messages.push(['warn', m]), error: (m) => messages.push(['error', m]) };
        let fontDetect;
        if (where === 'no Node') {
          const loader = createZawgyiModelLoader(() => null);
          const detect = (text, fallback, options) => fontDetectCore(text, fallback || 'zawgyi', options, loader);
          fontDetect = (text, fallback, options) => {
            const run = capture(() => detect(text, fallback, options));
            messages.push(...run.messages);
            return run.value;
          };
        } else {
          const context = vm.createContext({ console: record });
          const dist = require('../scripts/build').builtDist();
          vm.runInContext(fs.readFileSync(path.join(dist, where), 'utf8'), context);
          fontDetect = (where === 'knayi.min.js' ? context.knayi.compat : context.knayi).fontDetect;
        }
        const actual = probes.map(([text, fallback]) => fontDetect(text, fallback, Object.assign({ zawgyiDetector: detector }, tools)));
        assert.deepEqual({ actual: actual, messages: messages }, { actual: expected, messages: [] }, where);
        assert.equal(fontDetect(TIE, null, tools), 'zawgyi', where);
        assert.deepEqual(messages, [['warn', NOT_AVAILABLE]], where);
      }
    }));

    // The compat module build run from a working directory with no myanmar-tools (refactor plan, section 7 item 15):
    // a detector passed as zawgyiDetector needs none, and without one the build loads nothing (below). Under Bun the
    // run has --no-install, so that no lookup could fetch the package from npm.
    it('works in the compat module build run from another working directory', pendingPort(['840c8c5', '649b2b4'], () => {
      const dist = require('../scripts/build').builtDist();
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knayi-elsewhere-'));
      try {
        fs.writeFileSync(path.join(dir, 'run.mjs'), [
          "import { createRequire } from 'node:module';",
          'const [build, tools] = process.argv.slice(2);',
          'const messages = [];',
          "console.warn = (m) => messages.push(['warn', m]);",
          "console.error = (m) => messages.push(['error', m]);",
          'const knayi = (await import(build)).default;',
          'const { ZawgyiDetector } = createRequire(import.meta.url)(tools);',
          'function run(options) {',
          '  messages.length = 0;',
          "  const value = knayi.fontDetect('က္က', 'unicode', Object.assign({ adapter: 'myanmartools', myanmartools_zg_threshold: [0.05, 0.9] }, options));",
          '  return { value: value, messages: messages.slice() };',
          '}',
          'const passed = run({ zawgyiDetector: new ZawgyiDetector() });',
          'const lookup = run({});',
          'process.stdout.write(JSON.stringify({ passed: passed, lookup: lookup }));'
        ].join('\n') + '\n');
        const args = (typeof Bun !== 'undefined' ? ['--no-install'] : []).concat('run.mjs',
          pathToFileURL(path.join(dist, 'knayi-myscript-compat.min.mjs')).href, require.resolve('myanmar-tools'));
        const out = JSON.parse(execFileSync(process.execPath, args, { cwd: dir, encoding: 'utf8' }));
        assert.deepEqual(out.passed, { value: 'zawgyi', messages: [] });
        assert.deepEqual(out.lookup, { value: 'unicode', messages: [['warn', NOT_AVAILABLE]] });
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }));

    // MIGRATION.md's example of the 2.x API, as written: its imports become requires, and each call with a comment
    // after it must return the value in the comment.
    it('runs the example in MIGRATION.md', () => {
      const migration = fs.readFileSync(path.join(__dirname, '..', 'MIGRATION.md'), 'utf8');
      const blocks = migration.split('```').filter((block, i) => i % 2 === 1 &&
        block.indexOf("from 'myanmar-tools'") !== -1 && block.indexOf("from 'knayi-myscript/compat'") !== -1);
      assert.equal(blocks.length, 1);
      const body = [];
      const expected = [];
      for (const line of blocks[0].split('\n').slice(1)) {
        const imported = /^import \{ ([\w, ]+) \} from '([\w/-]+)'$/.exec(line);
        const call = /^(\w.*\))\s*\/\/ (.*?)(\s+\([^()]*\))?$/.exec(line);
        if (imported) {
          body.push('const { ' + imported[1] + ' } = load(' + JSON.stringify(imported[2]) + ');');
        } else if (call) {
          body.push('results.push(' + call[1] + ');');
          expected.push(call[2]);
        } else {
          body.push(line);
        }
      }
      const results = [];
      const load = (id) => (id === 'knayi-myscript/compat' ? knayi : require(id));
      const run = capture(() => new Function('load', 'results', body.join('\n'))(load, results));
      assert.ok(expected.length >= 3, 'the example has ' + expected.length + ' checked calls');
      assert.deepEqual(results, expected.map((value) => new Function('return (' + value + ');')()));
      assert.deepEqual(run.messages, []);
    });
  });

  // On the 2.x line only main.js and the files in library/ load myanmar-tools themselves, with module.require, so
  // Node and Bun resolve it from knayi's own folder; the builds in dist/ load nothing by name (649b2b4). 3.0 has no
  // main.js: compat is an ES module with no module.require, like 2.x's module build, and it and the builds that hold
  // it load nothing by name: not from the working directory, and not from next to the build file (refactor plan,
  // decision 17). There the adapter needs a detector passed as zawgyiDetector. Each script runs, under the runtime of
  // the test (Bun with --no-install), in a directory whose node_modules holds a stub myanmar-tools that records that
  // it was loaded and gives every text the probability 1, with copies of the three builds next to it.
  describe('what loads the package', () => {
    let dir;
    before(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knayi-stub-'));
      const stub = path.join(dir, 'node_modules', 'myanmar-tools');
      fs.mkdirSync(stub, { recursive: true });
      fs.writeFileSync(path.join(stub, 'package.json'), JSON.stringify({ name: 'myanmar-tools', version: '1.1.3', main: 'index.js' }));
      fs.writeFileSync(path.join(stub, 'index.js'), [
        'globalThis.stubLoaded = true;',
        'function ZawgyiDetector() {}',
        'ZawgyiDetector.prototype.getZawgyiProbability = function () { return 1; };',
        'exports.ZawgyiDetector = ZawgyiDetector;'
      ].join('\n') + '\n');
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'app', private: true }));
      const dist = require('../scripts/build').builtDist();
      for (const file of ['knayi-myscript-compat.min.mjs', 'knayi-myscript.min.js', 'knayi.min.js']) {
        fs.copyFileSync(path.join(dist, file), path.join(dir, file));
      }
      // 'က္က' is a tie for the rule scorer, so the fallback 'unicode'; myanmar-tools 1.1.3 gives it 0.93, and the
      // stub 1, both Zawgyi above 0.9.
      const call = "knayi.fontDetect('က္က', 'unicode', { adapter: 'myanmartools', myanmartools_zg_threshold: [0.05, 0.9] })";
      const report = 'process.stdout.write(JSON.stringify({ value: value, messages: messages, stubLoaded: Boolean(globalThis.stubLoaded) }));';
      const consoleCapture = "const messages = [];\nconsole.warn = (m) => messages.push(['warn', m]);\nconsole.error = (m) => messages.push(['error', m]);";
      // run.mjs imports the module it is given: compat itself, or the compat module build.
      fs.writeFileSync(path.join(dir, 'run.mjs'), [
        consoleCapture,
        'const knayi = (await import(process.argv[2])).default;',
        'const value = ' + call + ';',
        report
      ].join('\n') + '\n');
      // run.cjs requires a script build: the 2.x API is its global knayi, or knayi.compat in knayi.min.js.
      fs.writeFileSync(path.join(dir, 'run.cjs'), [
        consoleCapture,
        "require('./' + process.argv[2]);",
        "const knayi = process.argv[2] === 'knayi.min.js' ? globalThis.knayi.compat : globalThis.knayi;",
        'const value = ' + call + ';',
        report
      ].join('\n') + '\n');
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    function run(script, arg) {
      const args = (typeof Bun !== 'undefined' ? ['--no-install'] : []).concat(script, arg);
      return JSON.parse(execFileSync(process.execPath, args, { cwd: dir, encoding: 'utf8' }));
    }

    const LOADS_NOTHING = { value: 'unicode', messages: [['warn', NOT_AVAILABLE]], stubLoaded: false };

    it('compat loads nothing', pendingPort('649b2b4', () => {
      const compat = pathToFileURL(path.join(__dirname, '..', 'src', 'compat', 'index.js')).href;
      assert.deepEqual(run('run.mjs', compat), LOADS_NOTHING);
    }));

    it('the compat module build loads nothing', pendingPort('649b2b4', () => {
      assert.deepEqual(run('run.mjs', './knayi-myscript-compat.min.mjs'), LOADS_NOTHING);
    }));

    it('the script builds load nothing, also when Node or Bun loads them with require', pendingPort('649b2b4', () => {
      assert.deepEqual(run('run.cjs', 'knayi-myscript.min.js'), LOADS_NOTHING);
      assert.deepEqual(run('run.cjs', 'knayi.min.js'), LOADS_NOTHING);
    }));
  });
});
