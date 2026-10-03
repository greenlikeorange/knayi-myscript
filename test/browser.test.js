const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { builtDist } = require('../scripts/build');

// The script build, dist/knayi-myscript.min.js, as a <script> tag runs it: the global `knayi` is the 3.0 API, and
// knayi.compat the 2.x API, the object 2.x's script build set as `knayi` (scripts/build.js).
const api = require('../src/index.js');
const compat = require('../src/compat/index.js').default;

const ZAWGYI_GREETING = 'မဂၤလာပါ';
const UNICODE_GREETING = 'မင်္ဂလာပါ';

function runScript(wrap) {
  const source = fs.readFileSync(path.join(builtDist(), 'knayi-myscript.min.js'), 'utf8');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(wrap ? wrap(source) : source, sandbox);
  return sandbox;
}

describe('browser file', () => {
  it('sets knayi to the 3.0 API, with the 2.x API as knayi.compat', () => {
    const { knayi } = runScript();
    assert.deepEqual(Object.keys(knayi).sort(), Object.keys(api).concat('compat').sort());
    assert.equal(knayi.toUnicode(ZAWGYI_GREETING, { from: 'zawgyi' }), UNICODE_GREETING);
    assert.equal(knayi.VERSION, api.VERSION);
    assert.deepEqual(Object.keys(knayi.compat), Object.keys(compat));
    assert.equal(knayi.compat.default, knayi.compat);
    assert.equal(knayi.compat.fontConvert(ZAWGYI_GREETING, 'unicode', 'zawgyi'), UNICODE_GREETING);
    assert.equal(knayi.compat.syllBreak(UNICODE_GREETING, null, '|'), 'မင်္ဂလာ|ပါ');
  });

  it('runs as strict code, as the ES module sources do', () => {
    const source = fs.readFileSync(path.join(builtDist(), 'knayi-myscript.min.js'), 'utf8');
    assert.ok(source.startsWith('"use strict";'));
    // So a detached fontConvert never reads a global `debug` (docs/next/DESIGN.md §5.4).
    const sandbox = runScript();
    sandbox.debug = true;
    const detached = sandbox.knayi.compat.fontConvert;
    assert.equal(detached(ZAWGYI_GREETING, 'unicode', 'zawgyi'), UNICODE_GREETING);
  });

  it('sets the global when a bundler wraps the file in a module scope', () => {
    const sandbox = runScript((source) => '(function () {\n' + source + '\n})();');
    assert.equal(typeof sandbox.knayi, 'object');
    assert.equal(sandbox.knayi.compat.fontConvert(ZAWGYI_GREETING, 'unicode', 'zawgyi'), UNICODE_GREETING);
  });
});
