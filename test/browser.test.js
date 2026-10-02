const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('browser file', () => {
  it('exposes knayi and converts the Zawgyi greeting', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'dist', 'knayi-myscript.min.js'), 'utf8');
    const sandbox = { console };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    assert.equal(typeof sandbox.knayi.fontConvert, 'function');
    assert.equal(sandbox.knayi.fontConvert('မဂၤလာပါ', 'unicode', 'zawgyi'), 'မင်္ဂလာပါ');
    assert.equal(sandbox.knayi.syllBreak('မင်္ဂလာပါ', null, '|'), 'မင်္ဂလာ|ပါ');
  });

  it('sets the global when a bundler wraps the file in a module scope', () => {
    for (const file of ['knayi-myscript.js', 'knayi-myscript.min.js']) {
      const source = fs.readFileSync(path.join(__dirname, '..', 'dist', file), 'utf8');
      const sandbox = { console };
      vm.createContext(sandbox);
      vm.runInContext('(function () {\n' + source + '\n})();', sandbox);
      assert.equal(typeof sandbox.knayi, 'object', file);
      assert.equal(sandbox.knayi.fontConvert('မဂၤလာပါ', 'unicode', 'zawgyi'), 'မင်္ဂလာပါ');
    }
  });

  it('marks the script builds as side effects so bundlers keep `import "…/knayi-myscript.min.js"`', () => {
    const pkg = require('../package.json');
    assert.deepEqual(pkg.sideEffects, ['./dist/knayi-myscript.js', './dist/knayi-myscript.min.js']);
  });
});
