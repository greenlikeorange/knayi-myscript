// core/options.js (docs/next/DESIGN.md §2.3, §4 rule 3, §7.3): the 2.x defaults, frozen, and map-safe option
// reading.
//
// DEFAULTS is checked against the 2.x reference where 2.x shows it: the detector defaults through a fresh copy of
// library/globalOptions.js (so no other test's setGlobalOptions shows), the truncate defaults through truncate's
// output with no options, and the break separator through joinParts in scripts/oracle/syllable.js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DEFAULTS, NO_OPTIONS, optionsObject } from '../../src/core/options.js';
import { internals, library } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { loadWithInternals } = require('../../scripts/testing/internals.js');

describe('core/options.js DEFAULTS', () => {
  it('holds the 2.x defaults, in the core\'s names', () => {
    assert.deepEqual(DEFAULTS, {
      detector: { useZawgyiModel: false, thresholds: [0.05, 0.95] },
      truncate: { length: 30, omission: '...' },
      breakSeparator: '\u200B'
    });
  });

  it('detector: the option store 2.x starts with (globalOptions.js:1-7)', () => {
    const store = loadWithInternals('globalOptions.js').detector({});
    assert.deepEqual(store, {
      use_myanmartools: DEFAULTS.detector.useZawgyiModel,
      myanmartools_zg_threshold: DEFAULTS.detector.thresholds
    });
  });

  it('truncate: what 2.x truncate does with no options (truncate.js:9-10)', () => {
    const truncate = library('truncate.js');
    const text = 'x'.repeat(100);
    const { length, omission } = DEFAULTS.truncate;
    assert.equal(truncate(text), text.slice(0, length - omission.length) + omission);
    assert.equal(truncate(text, {}), truncate(text, { length, omission }));
  });

  it('breakSeparator: what 2.x joins syllables with when given none (syllable.js:273)', () => {
    const { joinParts } = internals('syllable.js', ['joinParts']);
    assert.equal(joinParts(['a', 'b'], undefined), 'a' + DEFAULTS.breakSeparator + 'b');
    assert.equal(joinParts(['a', 'b'], ''), 'a' + DEFAULTS.breakSeparator + 'b');
  });

  it('is frozen all the way down, and so is NO_OPTIONS, which is empty', () => {
    for (const value of [DEFAULTS, DEFAULTS.detector, DEFAULTS.detector.thresholds, DEFAULTS.truncate, NO_OPTIONS]) {
      assert.ok(Object.isFrozen(value));
    }
    assert.deepEqual(Object.keys(NO_OPTIONS), []);
    assert.throws(() => { DEFAULTS.truncate.length = 10; }, TypeError); // modules are strict
    assert.equal(DEFAULTS.truncate.length, 30);
  });
});

describe('core/options.js optionsObject', () => {
  it('returns an options object as it is, never a copy', () => {
    const options = { length: 5 };
    assert.equal(optionsObject(options), options);
    const bare = Object.create(null);
    assert.equal(optionsObject(bare), bare);
    const frozen = Object.freeze({ a: 1 });
    assert.equal(optionsObject(frozen), frozen);
  });

  it('returns NO_OPTIONS for anything that is not options', () => {
    for (const value of [undefined, null, 0, 1, NaN, '', 'unicode', true, false, Symbol('x'), [], [{}],
      () => ({}), function named() {}]) {
      assert.equal(optionsObject(value), NO_OPTIONS, String(typeof value === 'symbol' ? 'a symbol' : value));
    }
  });

  it('is map-safe: Array#map passes an index and the array where the options go', () => {
    const lines = ['a', 'b', 'c'];
    const seen = lines.map((line, index, array) => [optionsObject(index), optionsObject(array)]);
    for (const [fromIndex, fromArray] of seen) {
      assert.equal(fromIndex, NO_OPTIONS);
      assert.equal(fromArray, NO_OPTIONS);
    }
  });

  it('reads nothing and writes nothing on the value', () => {
    const touched = [];
    const watched = new Proxy({}, {
      get(target, key) { touched.push('get ' + String(key)); return target[key]; },
      set(target, key, value) { touched.push('set ' + String(key)); target[key] = value; return true; },
      has(target, key) { touched.push('has ' + String(key)); return key in target; }
    });
    optionsObject(watched);
    assert.deepEqual(touched, []);
  });
});
