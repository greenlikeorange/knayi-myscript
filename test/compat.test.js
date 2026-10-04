const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const pkg = require('../package.json');
const { builtDist } = require('../scripts/build');

// The package by its own name, resolved through its exports map from the root (test/package.test.js says why).
const requireFromRoot = createRequire(path.join(__dirname, '..', 'package.json'));
// The 2.x API as a 3.0 user loads it: the package's './compat' entry.
const knayi = requireFromRoot('knayi-myscript/compat').default;

const zawgyiGreeting = 'မဂၤလာပါ';
const unicodeGreeting = 'မင်္ဂလာပါ';

describe('runtime contract', () => {
  it('exposes the public functions and the package version', () => {
    assert.equal(knayi.version, pkg.version);
    assert.equal(typeof knayi.setGlobalOptions, 'function');
    assert.equal(typeof knayi.fontDetect, 'function');
    assert.equal(typeof knayi.fontConvert, 'function');
    assert.equal(typeof knayi.fontConvert.debugging, 'function');
    assert.equal(typeof knayi.syllBreak, 'function');
    assert.equal(typeof knayi.spellingFix, 'function');
    assert.equal(typeof knayi.truncate, 'function');
    assert.equal(typeof knayi.normalize, 'function');
  });

  it('converts the published Zawgyi greeting through compat and through the 3.0 API', () => {
    assert.equal(knayi.fontConvert(zawgyiGreeting, 'unicode', 'zawgyi'), unicodeGreeting);
    assert.equal(requireFromRoot('knayi-myscript').toUnicode(zawgyiGreeting, { from: 'zawgyi' }), unicodeGreeting);
  });

  it('keeps the current public syllable break', () => {
    assert.equal(knayi.syllBreak(unicodeGreeting, null, '|'), 'မင်္ဂလာ|ပါ');
  });

  it('keeps the name and the global of 2.x\'s script build, and names the others for what they hold', () => {
    const dist = builtDist();
    assert.deepEqual(fs.readdirSync(dist).sort(),
      ['knayi-myscript-compat.min.mjs', 'knayi-myscript.min.js', 'knayi-myscript.min.mjs', 'knayi.min.js']);
  });
});
