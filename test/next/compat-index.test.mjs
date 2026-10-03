// compat's export object (docs/next/DESIGN.md §5.1, C1), and the README and ARCHITECTURE examples run against
// compat (the Phase 6 exit of the plan): each returns the value its comment gives, as test/readme.test.js checks
// for main.js.

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as named from '../../src/compat/index.js';
import { ROOT } from './helpers.mjs';
import { assertSameAsReference, compat, reference, recordConsole, resetOptions } from './compat-helpers.mjs';

const require = createRequire(import.meta.url);
const { readExamples } = require('../../scripts/testing/readme-examples.js');

const FUNCTIONS = ['setGlobalOptions', 'fontDetect', 'fontConvert', 'syllBreak', 'spellingFix', 'truncate',
  'normalize'];

afterEach(resetOptions);

describe('compat: the export object (C1)', () => {
  it('has the 8 keys of main.js, in its order', () => {
    assert.deepEqual(Object.keys(compat), Object.keys(reference));
    assert.deepEqual(Object.keys(compat), ['version'].concat(FUNCTIONS));
  });

  it('has a non-enumerable default that points back at the object', () => {
    const descriptor = Object.getOwnPropertyDescriptor(compat, 'default');
    assert.equal(descriptor.value, compat);
    assert.equal(descriptor.enumerable, false);
    assert.deepEqual(descriptor, Object.assign({}, Object.getOwnPropertyDescriptor(reference, 'default'),
      { value: compat }));
  });

  it('has the version of package.json, as main.js has', () => {
    assert.equal(compat.version, require('../../package.json').version);
    assert.equal(compat.version, reference.version);
  });

  it('gives each function the length of its 2.x function, debugging included', () => {
    for (const name of FUNCTIONS) assert.equal(compat[name].length, reference[name].length, name);
    assert.equal(typeof compat.fontConvert.debugging, 'function');
    assert.equal(compat.fontConvert.debugging.length, reference.fontConvert.debugging.length);
  });

  it('exports the same functions by name', () => {
    for (const name of FUNCTIONS) assert.equal(named[name], compat[name], name);
    assert.equal(named.version, compat.version);
    assert.equal(named.default, compat);
  });

  it('is not frozen, like the object of main.js', () => {
    assert.equal(Object.isFrozen(compat), Object.isFrozen(reference));
  });
});

// lines.map(knayi.f) passes (value, index, array): the index and the array land in the fallback, target, source,
// font, separator and options positions.
describe('compat: every function as an Array#map callback (C27)', () => {
  const LINES = ['\u1019\u103C\u1014\u103A\u1019\u102C', '\u103B\u1019\u1014\u1039\u1019\u102C', 'jrefrm', '', null, 7,
    ' \u1000\u102C\u102C\u200B '];
  for (const name of FUNCTIONS.slice(1).concat(['fontConvert.debugging'])) {
    it(name, () => {
      const pick = (k) => (name === 'fontConvert.debugging' ? k.fontConvert.debugging : k[name]);
      assertSameAsReference((k) => LINES.map(pick(k)), name);
      assertSameAsReference((k) => [LINES[0], LINES[0], LINES[0]].map(pick(k)), name + ', one line three times');
    });
  }
});

// The examples of the 2.x API (`compat.…`) in README.md and ARCHITECTURE.md, run against compat as an ES module.
// test/readme.test.js runs the same examples against compat through require, and pins how many each file has.
for (const file of ['README.md', 'ARCHITECTURE.md']) {
  describe('compat: the examples of ' + file, () => {
    const all = readExamples(fs.readFileSync(path.join(ROOT, file), 'utf8'), file);
    const examples = all.filter((example) => example.api === 'compat');

    it('finds the examples', () => assert.ok(examples.length > 0));

    for (const example of examples) {
      it(file + ':' + example.line + ' ' + example.code.replace(/\s+/g, ' '), () => {
        const call = new Function('compat', 'return (' + example.code + ');');
        const expected = new Function('return (' + example.expected + ');')();
        const run = recordConsole(() => call(compat));
        assert.equal(run.throws, undefined, run.error && run.error.message);
        assert.deepEqual(run.value, expected);
        if (example.note && /\bwarns\b/.test(example.note)) assert.ok(run.console.length > 0, 'it warns');
      });
    }
  });
}
