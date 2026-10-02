const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const knayi = require('../main');
const pkg = require('../package.json');

describe('package', () => {
  it('reports the same version as package.json', () => {
    assert.equal(knayi.version, pkg.version);
  });
});
