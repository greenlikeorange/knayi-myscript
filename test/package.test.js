const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const knayi = require('../main');
const pkg = require('../package.json');
const { builtDist } = require('../scripts/build');

async function importBuild(file) {
  return import(pathToFileURL(path.join(builtDist(), file)).href);
}

// The ES module sources the module builds are made from, imported (a require of them would add __esModule).
async function importSource(file) {
  return import(pathToFileURL(path.join(__dirname, '..', 'src', file)).href);
}

describe('package', () => {
  it('reports the same version as package.json', () => {
    assert.equal(knayi.version, pkg.version);
  });

  it('gives the compat module build every named export of compat, and its default', async () => {
    const esm = await importBuild('knayi-myscript-compat.min.mjs');
    const compat = await importSource('compat/index.js');
    assert.deepEqual(Object.keys(esm).sort(), Object.keys(compat).sort());
    for (const name of Object.keys(compat.default)) {
      assert.equal(typeof esm[name], typeof compat[name], 'knayi-myscript-compat.min.mjs is missing ' + name);
      assert.equal(esm[name], esm.default[name], name + ' differs from the default export');
    }
    assert.equal(esm.default.default, esm.default);
    assert.equal(esm.syllBreak('မင်္ဂလာပါ', null, '|'), 'မင်္ဂလာ|ပါ');
  });

  it('gives the 3.0 module build every export of the 3.0 API', async () => {
    const esm = await importBuild('knayi-myscript.min.mjs');
    const api = await importSource('index.js');
    assert.deepEqual(Object.keys(esm).sort(), Object.keys(api).sort());
    assert.equal(esm.toUnicode('မဂၤလာပါ', { from: 'zawgyi' }), 'မင်္ဂလာပါ');
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
