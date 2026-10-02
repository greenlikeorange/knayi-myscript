const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const knayi = require('../main');
const pkg = require('../package.json');

describe('package', () => {
  it('reports the same version as package.json', () => {
    assert.equal(knayi.version, pkg.version);
  });

  it('gives the ESM builds a named export for every main.js export', async () => {
    for (const file of [pkg.module, './dist/knayi-myscript.mjs']) {
      const esm = await import(pathToFileURL(path.join(__dirname, '..', file)).href);
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

  it('does not set a Node engine range', () => {
    assert.equal(pkg.engines, undefined);
  });
});
