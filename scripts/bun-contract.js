const assert = require('node:assert/strict');
// The 2.x API, compat, through a CommonJS require of its ES module source, as a CommonJS user of 3.0 loads it.
const knayi = require('../src/compat/index.js').default;
const { pendingPortNow } = require('./testing/pending-port.js');

const converted = knayi.fontConvert('မဂၤလာပါ', 'unicode', 'zawgyi');
assert.equal(converted, 'မင်္ဂလာပါ');
assert.equal(knayi.syllBreak('မင်္ဂလာပါ', null, '|'), 'မင်္ဂလာ|ပါ');
assert.equal(typeof knayi.fontDetect, 'function');
pendingPortNow('31eb6b1', () => {
  assert.deepEqual(knayi.detectEncoding('မဂၤလာပါ'), { encoding: 'zawgyi', unicode: 0, zawgyi: 1 });
});
console.log('bun cjs contract ok', knayi.version);
