const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const knayi = require('../main');
const pkg = require('../package.json');
const { builtDist } = require('../scripts/build');

describe('package', () => {
  it('reports the same version as package.json', () => {
    assert.equal(knayi.version, pkg.version);
  });

  it('gives the ESM builds a named export for every main.js export', async () => {
    // The `module` field names a file in dist/; the test reads that file from a fresh build of this checkout.
    assert.equal(path.posix.dirname(pkg.module), './dist');
    for (const file of [path.posix.basename(pkg.module), 'knayi-myscript.mjs']) {
      const esm = await import(pathToFileURL(path.join(builtDist(), file)).href);
      for (const name of Object.keys(knayi)) {
        assert.equal(typeof esm[name], typeof knayi[name], file + ' is missing ' + name);
        assert.equal(esm[name], esm.default[name], file + ' ' + name + ' differs from the default export');
      }
      assert.equal(esm.syllBreak('မင်္ဂလာပါ', null, '|'), 'မင်္ဂလာ|ပါ');
    }
  });

  it('lets Node import every main.js export by name', async () => {
    const esm = await import(pathToFileURL(path.join(__dirname, '..', 'main.js')).href);
    for (const name of Object.keys(knayi)) {
      assert.equal(esm[name], knayi[name], 'main.js is missing named export ' + name);
    }
  });

  it('has a non-enumerable default export for TypeScript without esModuleInterop', () => {
    assert.equal(knayi.default, knayi);
    assert.equal(Object.keys(knayi).includes('default'), false);
  });

  it('does not set a Node engine range', () => {
    assert.equal(pkg.engines, undefined);
  });

  it('keeps myanmar-tools below the broken 1.2.0 release', () => {
    assert.equal(pkg.peerDependencies['myanmar-tools'], '>=1.1.2 <1.2.0');
  });
});
