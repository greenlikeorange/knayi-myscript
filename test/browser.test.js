const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { builtDist } = require('../scripts/build');

// The script builds as a <script> tag runs them (scripts/build.js): dist/knayi.min.js sets the global `knayi` to the
// 3.0 API, with the 2.x API as knayi.compat; dist/knayi-myscript.min.js, 2.x's file name, sets it to the 2.x API, as
// 2.x's did, for the pages that load it from @master or an unversioned CDN link (docs/next/DESIGN.md §14.3).
const api = require('../src/index.js');
const compat = require('../src/compat/index.js').default;

const ZAWGYI_GREETING = 'မဂၤလာပါ';
const UNICODE_GREETING = 'မင်္ဂလာပါ';

function sourceOf(file) {
  return fs.readFileSync(path.join(builtDist(), file), 'utf8');
}

// The sandbox of a vm context in which the file ran as one classic script, wrapped as `wrap` says.
function runScript(file, wrap) {
  const source = sourceOf(file);
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(wrap ? wrap(source) : source, sandbox);
  return sandbox;
}

// Each script build, and the 2.x API in its global.
const SCRIPTS = {
  'knayi.min.js': (knayi) => knayi.compat,
  'knayi-myscript.min.js': (knayi) => knayi
};

describe('browser files', () => {
  it('knayi.min.js sets knayi to the 3.0 API, with the 2.x API as knayi.compat', () => {
    const { knayi } = runScript('knayi.min.js');
    assert.deepEqual(Object.keys(knayi).sort(), Object.keys(api).concat('compat').sort());
    assert.equal(knayi.toUnicode(ZAWGYI_GREETING, { from: 'zawgyi' }), UNICODE_GREETING);
    assert.equal(knayi.VERSION, api.VERSION);
    assert.deepEqual(Object.keys(knayi.compat), Object.keys(compat));
    assert.equal(knayi.compat.default, knayi.compat);
    assert.equal(knayi.compat.fontConvert(ZAWGYI_GREETING, 'unicode', 'zawgyi'), UNICODE_GREETING);
    assert.equal(knayi.compat.syllBreak(UNICODE_GREETING, null, '|'), 'မင်္ဂလာ|ပါ');
  });

  it('knayi-myscript.min.js sets knayi to the 2.x API, as 2.x\'s script build of that name did', () => {
    const { knayi } = runScript('knayi-myscript.min.js');
    assert.deepEqual(Object.keys(knayi), Object.keys(compat));
    assert.equal(knayi.default, knayi);
    assert.equal(knayi.version, compat.version);
    assert.equal(knayi.fontConvert(ZAWGYI_GREETING, 'unicode', 'zawgyi'), UNICODE_GREETING);
    assert.equal(knayi.syllBreak(UNICODE_GREETING, null, '|'), 'မင်္ဂလာ|ပါ');
    assert.equal(knayi.normalize(null), '', '2.x\'s input policy, not the 3.0 API\'s TypeError');
    assert.equal(knayi.truncate('abc', { length: 2 }), '...');
  });

  for (const [file, compatOf] of Object.entries(SCRIPTS)) {
    it(file + ' runs its own code as strict code, as the ES module sources do', () => {
      // So a detached fontConvert never reads a global `debug` (docs/next/DESIGN.md §5.4).
      const sandbox = runScript(file);
      sandbox.debug = true;
      const detached = compatOf(sandbox.knayi).fontConvert;
      assert.equal(detached(ZAWGYI_GREETING, 'unicode', 'zawgyi'), UNICODE_GREETING);
    });

    it(file + ' leaves a script concatenated after it sloppy, as an asset pipeline joins them', () => {
      // A directive at the start of a classic script would make the whole script strict, and this assignment to an
      // undeclared variable a ReferenceError.
      assert.ok(!sourceOf(file).startsWith('"use strict"'));
      const sandbox = runScript(file, (source) => source + '\nlegacyCounter = 1;\n');
      assert.equal(sandbox.legacyCounter, 1);
      assert.equal(typeof compatOf(sandbox.knayi).fontConvert, 'function');
    });

    it(file + ' sets the global when a bundler wraps the file in a module scope', () => {
      const sandbox = runScript(file, (source) => '(function () {\n' + source + '\n})();');
      assert.equal(typeof sandbox.knayi, 'object');
      assert.equal(compatOf(sandbox.knayi).fontConvert(ZAWGYI_GREETING, 'unicode', 'zawgyi'), UNICODE_GREETING);
    });
  }
});
