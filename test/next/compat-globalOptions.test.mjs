// compat's option store and console writers (src/compat/globalOptions.js; docs/next/DESIGN.md §5.2 C2-C4, C25,
// §5.3), against library/globalOptions.js of the 2.x reference (scripts/reference/, D19).

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { library } from './helpers.mjs';
import { pendingPort, recordConsole, resetOptions } from './compat-helpers.mjs';
import {
  MESSAGES, setGlobalOptions, isSilentMode, storedDetectorOptions, mergeDetectorOptions, report, reportAlways
} from '../../src/compat/globalOptions.js';

const globalOptions = library('globalOptions.js');

// Detector options as callers pass them: missing, partial, invalid thresholds of every kind, and values that are
// not objects (Array#map passes an index or an array).
const DETECTOR_OPTIONS = [undefined, null, 0, 1, '', 'abc', [], {}, { use_myanmartools: true },
  { use_myanmartools: 0 }, { use_myanmartools: undefined }, { myanmartools_zg_threshold: [0.1, 0.9] },
  { myanmartools_zg_threshold: [NaN, NaN] }, { myanmartools_zg_threshold: [1] }, { myanmartools_zg_threshold: 'x' },
  { myanmartools_zg_threshold: ['0.1', 0.9] }, { myanmartools_zg_threshold: null },
  { myanmartools_zg_threshold: undefined }, { myanmartools_zg_threshold: [0, 1, 2] },
  { use_myanmartools: 'yes', myanmartools_zg_threshold: [-1, 2] }, Object.create({ use_myanmartools: true }),
  { adapter: 'myanmartools' }];

// The stores each library starts a comparison from.
const STORES = [
  { silent_mode: false, detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] } },
  { silent_mode: true, detector: { use_myanmartools: true, myanmartools_zg_threshold: [0.2, 0.3] } }
];

function setBoth(options) {
  globalOptions.setOptions(structuredClone(options));
  setGlobalOptions(structuredClone(options));
}

afterEach(() => {
  setBoth(STORES[0]);
  resetOptions();
});

describe('compat: the 2.x option store (C2-C4)', () => {
  it('C2: starts from the 2.x defaults, read from the core', async () => {
    const fresh = await import('../../src/compat/globalOptions.js?fresh');
    assert.equal(fresh.isSilentMode(), false);
    assert.deepEqual(fresh.storedDetectorOptions(),
      { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] });
  });

  // 2.11 checks the threshold and stores zawgyiDetector with the other detector options (fb6594d, 840c8c5).
  it('C4: mergeDetectorOptions gives what globalOptions.detector gives, console included, from either store',
    pendingPort(['fb6594d', '840c8c5'], () => {
      for (const store of STORES) {
        for (const options of DETECTOR_OPTIONS) {
          setBoth(store);
          const expected = recordConsole(() => globalOptions.detector(options));
          const actual = recordConsole(() => mergeDetectorOptions(options));
          assert.deepEqual(actual, expected, JSON.stringify(store) + ' ' + String(JSON.stringify(options)));
        }
      }
    }));

  it('C4: the threshold message prints even in silent mode, and the result holds a copy of the threshold', () => {
    setGlobalOptions({ silent_mode: true });
    const run = recordConsole(() => mergeDetectorOptions({ myanmartools_zg_threshold: [1] }));
    assert.deepEqual(run.console, ['error: ' + MESSAGES.badThreshold]);
    assert.notEqual(run.value.myanmartools_zg_threshold, storedDetectorOptions().myanmartools_zg_threshold);
    const given = [0.3, 0.6];
    assert.notEqual(mergeDetectorOptions({ myanmartools_zg_threshold: given }).myanmartools_zg_threshold, given);
  });

  // 2.11 takes null as no options, checks the threshold, and stores zawgyiDetector (fb6594d, 840c8c5).
  it('C3: setGlobalOptions stores what setOptions stores, and throws where it throws',
    pendingPort(['fb6594d', '840c8c5'], () => {
      const calls = [undefined, null, {}, { silent_mode: 1 }, { silent_mode: 'false' }, { silent_mode: undefined },
        { detector: null }, { detector: { myanmartools_zg_threshold: [1] } }, { detector: { use_myanmartools: true } },
        Object.create({ silent_mode: true }), 5, 'silent_mode', []];
      for (const options of calls) {
        setBoth(STORES[0]);
        const expected = recordConsole(() => globalOptions.setOptions(options));
        const actual = recordConsole(() => setGlobalOptions(options));
        assert.deepEqual(actual, expected, String(JSON.stringify(options)));
        assert.equal(isSilentMode(), globalOptions.isSilentMode());
        assert.deepEqual(storedDetectorOptions(), globalOptions.detector({}));
      }
    }));

  it('C3: keeps silent_mode as given; any truthy value is silent', () => {
    for (const value of [1, 'false', {}, true]) {
      setGlobalOptions({ silent_mode: value });
      assert.equal(isSilentMode(), value);
      assert.deepEqual(recordConsole(() => report('warn', 'x')), { value: false, console: [] });
    }
    for (const value of [0, '', null, undefined, false, NaN]) {
      setGlobalOptions({ silent_mode: value });
      assert.deepEqual(recordConsole(() => report('warn', 'x')), { value: true, console: ['warn: x'] });
    }
  });
});

describe('compat: the console writers (C25, §5.3)', () => {
  it('report prints unless silent and says whether it printed; reportAlways prints always', () => {
    assert.deepEqual(recordConsole(() => report('error', 'e')), { value: true, console: ['error: e'] });
    setGlobalOptions({ silent_mode: true });
    assert.deepEqual(recordConsole(() => report('error', 'e')), { value: false, console: [] });
    assert.deepEqual(recordConsole(() => reportAlways('error', 'e')), { value: undefined, console: ['error: e'] });
  });

  it('looks console[level] up at each call', () => {
    const first = recordConsole(() => report('warn', 'one'));
    const second = recordConsole(() => report('warn', 'two'));
    assert.deepEqual([first.console, second.console], [['warn: one'], ['warn: two']]);
  });

  it('has the texts of §5.3, as 2.x prints them', () => {
    assert.equal(MESSAGES.missingContent('truncate'), 'Content must be specified on knayi.truncate.');
    assert.equal(MESSAGES.noTarget, 'Convert target font must be specified on knayi.fontConvert.');
    assert.equal(MESSAGES.unknownTarget, 'Convert library doesn\'t have this fontType.');
    assert.equal(MESSAGES.unknownSource('zg'), 'Unknown source font "zg" on knayi.fontConvert; detecting it.');
    assert.equal(MESSAGES.invalidFont('syllBreak', 'win'),
      'knayi.syllBreak takes the font \'unicode\' or \'zawgyi\', not "win".');
    assert.equal(MESSAGES.winSourceOnly, 'knayi.fontConvert converts Win text to Unicode only.');
    assert.equal(MESSAGES.badThreshold, 'myanmartools_zg_threshold must be [number, number]');
  });
});
