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

  it('ships the browser file and the module file under the 2.8 names', () => {
    const dist = builtDist();
    const es = fs.readFileSync(path.join(dist, 'knayi-myscript.es.js'));
    const mjs = fs.readFileSync(path.join(dist, 'knayi-myscript.mjs'));
    assert.ok(fs.existsSync(path.join(dist, 'knayi-myscript.min.js')));
    assert.deepEqual(es, mjs);
  });
});
