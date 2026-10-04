// The options of the 3.0 API (docs/next/DESIGN.md §11.1): a key a function does not take is a RangeError.
//
// - Each function takes its own keys and refuses every other own key, with ERR_KNAYI_INVALID_ARG_VALUE and a
//   message that names the key, the function, and what the caller most likely meant.
// - 2.x's option names, and the names 3.0 changed, point to the 3.0 name: one case per 2.x key.
// - undefined, null and a number are no options, so lines.map(f) still works; keys a prototype gives, symbols and
//   non-enumerable keys are not read.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as knayi from '../../../src/index.js';
import { createNormalizer, createConverter, lineTransform, mapLines } from '../../../src/stream.js';

const KA = '\u1000\u102C';
const same = (line) => line;

// Each function of the API and of the streams, called with an options object, and the keys it takes.
const CALLS = {
  normalize: [(options) => knayi.normalize(KA, options), ['report', 'trace']],
  explain: [(options) => knayi.explain(KA, options), ['zawgyiDetector', 'thresholds']],
  detectEncoding: [(options) => knayi.detectEncoding(KA, options), ['zawgyiDetector', 'thresholds']],
  toUnicode: [(options) => knayi.toUnicode(KA, options),
    ['from', 'tie', 'trace', 'offsets', 'zawgyiDetector', 'thresholds']],
  toZawgyi: [(options) => knayi.toZawgyi(KA, options), ['trace']],
  segmentSyllables: [(options) => knayi.segmentSyllables(KA, options), ['bareConsonants', 'from']],
  syllableBoundaries: [(options) => knayi.syllableBoundaries(KA, options), ['bareConsonants', 'from']],
  truncate: [(options) => knayi.truncate(KA, options), ['length', 'omission', 'bareConsonants', 'from']],
  collapseRepeatedMarks: [(options) => knayi.collapseRepeatedMarks(KA, options), ['from']],
  mapLines: [(options) => mapLines(same, options), ['maxLineLength']],
  lineTransform: [(options) => lineTransform(same, options), ['maxLineLength']],
  createNormalizer: [(options) => createNormalizer(options), ['maxLineLength']],
  createConverter: [(options) => createConverter(options),
    ['from', 'to', 'tie', 'zawgyiDetector', 'thresholds', 'maxLineLength']]
};

// A RangeError with the code ERR_KNAYI_INVALID_ARG_VALUE and exactly this message.
const refused = (message) => (error) => error instanceof RangeError && error.code === 'ERR_KNAYI_INVALID_ARG_VALUE' &&
  error.message === message;

// 'a', 'a and b', 'a, b and c'.
const namesOf = (keys) => keys.length === 1 ? keys[0] : keys.slice(0, -1).join(', ') + ' and ' + keys[keys.length - 1];

describe('a key a function does not take is a RangeError (DESIGN.md §11.1)', () => {
  for (const [name, [call, keys]] of Object.entries(CALLS)) {
    it(name + ' takes ' + namesOf(keys) + ', and refuses any other key', () => {
      const all = {};
      for (const key of keys) all[key] = undefined;
      call(all); // every key it takes, each left to its default
      call(undefined);
      call(null);
      call(0);
      assert.throws(() => call({ fooBar: 1 }), refused('knayi.' + name + ': options.fooBar is not an option of ' + name +
        ', which takes ' + namesOf(keys)));
      assert.throws(() => call(Object.assign({}, all, { fooBar: undefined })), { code: 'ERR_KNAYI_INVALID_ARG_VALUE' },
        'a key it does not take, even undefined');
    });
  }

  it('reads own enumerable string keys only: not a prototype\'s, a symbol or a non-enumerable key', () => {
    const inherited = Object.create({ fooBar: 1, font: 'zawgyi' });
    inherited.report = false;
    assert.equal(knayi.normalize(KA, inherited), KA);
    const hidden = { [Symbol('fooBar')]: 1 };
    Object.defineProperty(hidden, 'fooBar', { value: 1, enumerable: false });
    assert.equal(knayi.normalize(KA, hidden), KA);
  });

  it('keeps every function map-safe: an index from Array#map is no options', () => {
    const lines = [KA, '\u1000\u1001\u1002'];
    assert.deepEqual(lines.map(knayi.normalize), lines.map((line) => knayi.normalize(line)));
    assert.deepEqual(lines.map(knayi.toUnicode), lines.map((line) => knayi.toUnicode(line)));
    assert.deepEqual(lines.map(knayi.segmentSyllables), lines.map((line) => knayi.segmentSyllables(line)));
    assert.deepEqual(lines.map(knayi.truncate), lines.map((line) => knayi.truncate(line)));
  });
});

describe('the 2.x options, and the names 3.0 changed, point to the 3.0 name', () => {
  it('fontType, 2.x truncate\'s: options.from', () => {
    assert.throws(() => knayi.truncate(KA, { fontType: 'zawgyi' }), refused('knayi.truncate: options.fontType is ' +
      'not an option of truncate; did you mean options.from?'));
  });

  it('font, the first 3.0 name of the text\'s encoding: options.from', () => {
    assert.throws(() => knayi.segmentSyllables('\u107E\u1000\u1015\u102B', { font: 'zawgyi' }),
      refused('knayi.segmentSyllables: options.font is not an option of segmentSyllables; did you mean options.from?'));
    assert.throws(() => knayi.collapseRepeatedMarks(KA, { font: 'zawgyi' }), { message: /did you mean options\.from\?/ });
    assert.throws(() => createConverter({ font: 'zawgyi' }), { message: /did you mean options\.from\?/ });
  });

  it('policy, the first 3.0 name of the bare-consonant policy: options.bareConsonants', () => {
    assert.throws(() => knayi.syllableBoundaries(KA, { policy: 'pairs' }), refused('knayi.syllableBoundaries: ' +
      'options.policy is not an option of syllableBoundaries; did you mean options.bareConsonants?'));
  });

  it('use_myanmartools and adapter, 2.x\'s detector switches: options.zawgyiDetector', () => {
    const hint = '; did you mean options.zawgyiDetector?';
    assert.throws(() => knayi.detectEncoding(KA, { use_myanmartools: true }),
      refused('knayi.detectEncoding: options.use_myanmartools is not an option of detectEncoding' + hint));
    assert.throws(() => knayi.toUnicode(KA, { adapter: 'myanmartools' }),
      refused('knayi.toUnicode: options.adapter is not an option of toUnicode' + hint));
  });

  it('myanmartools_zg_threshold, 2.x\'s thresholds: options.thresholds', () => {
    assert.throws(() => knayi.explain(KA, { myanmartools_zg_threshold: [0.1, 0.9] }), refused('knayi.explain: ' +
      'options.myanmartools_zg_threshold is not an option of explain; did you mean options.thresholds?'));
  });

  it('silent_mode, 2.x\'s global option: nothing to silence', () => {
    assert.throws(() => knayi.normalize(KA, { silent_mode: true }), refused('knayi.normalize: options.silent_mode ' +
      'is not an option of normalize: the 3.0 API writes nothing to the console'));
  });

  it('a hint only names an option the function takes; otherwise the message lists them', () => {
    assert.throws(() => knayi.normalize(KA, { use_myanmartools: true }),
      refused('knayi.normalize: options.use_myanmartools is not an option of normalize, which takes report and trace'));
    assert.throws(() => knayi.toZawgyi(KA, { from: 'zawgyi' }),
      refused('knayi.toZawgyi: options.from is not an option of toZawgyi, which takes trace'));
    assert.throws(() => knayi.toUnicode(KA, { to: 'zawgyi' }), refused('knayi.toUnicode: options.to is not an ' +
      'option of toUnicode, which takes from, tie, trace, offsets, zawgyiDetector and thresholds'));
  });
});
