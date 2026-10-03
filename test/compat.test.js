const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const knayi = require('../main');
const converter = require('../library/converter');
const { builtDist } = require('../scripts/build');

const zawgyiGreeting = 'မဂၤလာပါ';
const unicodeGreeting = 'မင်္ဂလာပါ';

describe('runtime contract', () => {
  it('exposes the public functions and the package version', () => {
    assert.equal(knayi.version, '2.10.0');
    assert.equal(typeof knayi.setGlobalOptions, 'function');
    assert.equal(typeof knayi.fontDetect, 'function');
    assert.equal(typeof knayi.fontConvert, 'function');
    assert.equal(typeof knayi.fontConvert.debugging, 'function');
    assert.equal(typeof knayi.syllBreak, 'function');
    assert.equal(typeof knayi.spellingFix, 'function');
    assert.equal(typeof knayi.truncate, 'function');
    assert.equal(typeof knayi.normalize, 'function');
  });

  it('converts the published Zawgyi greeting from the package and from the deep import', () => {
    assert.equal(knayi.fontConvert(zawgyiGreeting, 'unicode', 'zawgyi'), unicodeGreeting);
    assert.equal(converter(zawgyiGreeting, 'unicode', 'zawgyi'), unicodeGreeting);
  });

  it('keeps the current public syllable break', () => {
    assert.equal(knayi.syllBreak(unicodeGreeting, null, '|'), 'မင်္ဂလာ|ပါ');
  });

  it('keeps the name of the script build, and names the module builds for what they hold', () => {
    const dist = builtDist();
    assert.deepEqual(fs.readdirSync(dist).sort(),
      ['knayi-myscript-compat.min.mjs', 'knayi-myscript.min.js', 'knayi-myscript.min.mjs']);
  });
});
