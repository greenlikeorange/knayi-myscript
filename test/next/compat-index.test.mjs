// compat's export object (docs/next/DESIGN.md §5.1, C1), and the examples of the 2.x API in README.md, MIGRATION.md
// and ARCHITECTURE.md run against compat (the Phase 6 exit of the plan): each returns the value its comment gives, as
// test/readme.test.js checks for main.js.

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
const { PENDING_EXAMPLES, pendingPort } = require('../../scripts/testing/pending-port.js');

// The functions of the 2.x reference, 2.11's: detectEncoding came with 31eb6b1.
const FUNCTIONS = ['setGlobalOptions', 'fontDetect', 'detectEncoding', 'fontConvert', 'syllBreak', 'spellingFix',
  'truncate', 'normalize'];

afterEach(resetOptions);

describe('compat: the export object (C1)', () => {
  it('has the 9 keys of main.js, in its order', pendingPort('31eb6b1', () => {
    assert.deepEqual(Object.keys(compat), Object.keys(reference));
    assert.deepEqual(Object.keys(compat), ['version'].concat(FUNCTIONS));
  }));

  it('has a non-enumerable default that points back at the object', () => {
    const descriptor = Object.getOwnPropertyDescriptor(compat, 'default');
    assert.equal(descriptor.value, compat);
    assert.equal(descriptor.enumerable, false);
    assert.deepEqual(descriptor, Object.assign({}, Object.getOwnPropertyDescriptor(reference, 'default'),
      { value: compat }));
  });

  // The package's version, as 2.x's main.js gave its own: 3.0's, where the reference's main.js says 2.10.0 (its
  // release commit sets 2.11.0).
  it('has the version of package.json, as main.js has', () => {
    assert.equal(compat.version, require('../../package.json').version);
    assert.equal(typeof reference.version, 'string');
  });

  // setGlobalOptions and fontDetect lost their default options with fb6594d (null options), so their lengths are 1
  // and 3; detectEncoding's is 1.
  it('gives each function the length of its 2.x function, debugging included',
    pendingPort(['fb6594d', '31eb6b1'], () => {
      for (const name of FUNCTIONS) assert.equal(compat[name].length, reference[name].length, name);
      assert.equal(typeof compat.fontConvert.debugging, 'function');
      assert.equal(compat.fontConvert.debugging.length, reference.fontConvert.debugging.length);
    }));

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
// font, separator and options positions. Where 2.11 reads them otherwise, the form waits for its port: a fallback
// that is not a string (86f0040), detectEncoding (31eb6b1), and debugging's report (b6cbfca).
const MAP_PENDING = {
  fontDetect: '86f0040',
  detectEncoding: '31eb6b1',
  'fontConvert.debugging': 'b6cbfca'
};

describe('compat: every function as an Array#map callback (C27)', () => {
  const LINES = ['\u1019\u103C\u1014\u103A\u1019\u102C', '\u103B\u1019\u1014\u1039\u1019\u102C', 'jrefrm', '', null, 7,
    ' \u1000\u102C\u102C\u200B '];
  for (const name of FUNCTIONS.slice(1).concat(['fontConvert.debugging'])) {
    const test = () => {
      const pick = (k) => (name === 'fontConvert.debugging' ? k.fontConvert.debugging : k[name]);
      assertSameAsReference((k) => LINES.map(pick(k)), name);
      assertSameAsReference((k) => [LINES[0], LINES[0], LINES[0]].map(pick(k)), name + ', one line three times');
    };
    it(name, MAP_PENDING[name] ? pendingPort(MAP_PENDING[name], test) : test);
  }
});

// The examples of the 2.x API (`compat.…`) in README.md, MIGRATION.md and ARCHITECTURE.md, run against compat as an
// ES module. test/readme.test.js runs the same examples against compat through require, and pins how many each file
// has.
for (const file of ['README.md', 'MIGRATION.md', 'ARCHITECTURE.md']) {
  describe('compat: the examples of ' + file, () => {
    const all = readExamples(fs.readFileSync(path.join(ROOT, file), 'utf8'), file);
    const examples = all.filter((example) => example.api === 'compat');

    it('finds the examples', () => assert.ok(examples.length > 0));

    for (const example of examples) {
      const test = () => {
        const call = new Function('compat', 'return (' + example.code + ');');
        const expected = new Function('return (' + example.expected + ');')();
        const run = recordConsole(() => call(compat));
        assert.equal(run.throws, undefined, run.error && run.error.message);
        assert.deepEqual(run.value, expected);
        if (example.note && /\bwarns\b|\ban error\b/.test(example.note)) {
          assert.ok(run.console.length > 0, 'it writes to the console');
        }
      };
      // An example of a 2.x change compat does not have yet waits for its port (scripts/testing/pending-port.js).
      const commit = PENDING_EXAMPLES[file + ' ' + example.code];
      it(file + ':' + example.line + ' ' + example.code.replace(/\s+/g, ' '),
        commit ? pendingPort(commit, test) : test);
    }
  });
}
