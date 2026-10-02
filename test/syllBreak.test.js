const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
var knayi = require('../main');
describe('syllBreak',()=>{
	describe('syllBreak Unicode',()=>{
		it('should syllBreak for unicode',()=>{
assert.equal(			knayi.syllBreak('မင်္ဂလာပါ', null, '**'), 'မင်္ဂလာ**ပါ');
		})

		it('keeps a virama stack together when the font is unicode', () => {
assert.equal(			knayi.syllBreak('က္က', 'unicode', '|'), 'က္က');
		})

		it('splits a virama stack on the zawgyi table', () => {
assert.equal(			knayi.syllBreak('က္က', 'zawgyi', '|'), 'က္|က');
		})
	})

	describe('font aliases', () => {
		it('accepts uni as unicode', () => {
assert.equal(			knayi.syllBreak('က', 'uni'), 'က');
assert.equal(			knayi.syllBreak('က္က', 'uni', '|'), 'က္က');
		})
	})

	describe('detected font', () => {
		it('keeps a virama stack together when detection runs', () => {
assert.equal(			knayi.syllBreak('က္က', null, '|'), 'က္က');
		})
	})
})

after(function () {
	knayi.setGlobalOptions({
		silent_mode: false,
		detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
	});
});
