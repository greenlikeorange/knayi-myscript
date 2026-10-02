const assert = require('node:assert/strict');
const knayi = require('../main');

const converted = knayi.fontConvert('မဂၤလာပါ', 'unicode', 'zawgyi');
assert.equal(converted, 'မင်္ဂလာပါ');
assert.equal(knayi.syllBreak('မင်္ဂလာပါ', null, '|'), 'မင်္ဂလာ|ပါ');
assert.equal(typeof knayi.fontDetect, 'function');
console.log('bun cjs contract ok', knayi.version);
