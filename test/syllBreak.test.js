var knayi = require('../main');
var chai = require('chai');
var should = chai.should();

describe('syllBreak',()=>{
	describe('syllBreak Unicode',()=>{
		it('should syllBreak for unicode',()=>{
			knayi.syllBreak('မင်္ဂလာပါ', null, '**').should.equal('မင်္ဂလာ**ပါ');
		})

		it('keeps a virama stack together when the font is unicode', () => {
			knayi.syllBreak('က္က', 'unicode', '|').should.equal('က္က');
		})

		it('splits a virama stack on the zawgyi table', () => {
			knayi.syllBreak('က္က', 'zawgyi', '|').should.equal('က္|က');
		})
	})

	describe('font aliases', () => {
		it('accepts uni as unicode', () => {
			knayi.syllBreak('က', 'uni').should.equal('က');
			knayi.syllBreak('က္က', 'uni', '|').should.equal('က္က');
		})
	})

	describe('detected font', () => {
		it('keeps a virama stack together when detection runs', () => {
			knayi.syllBreak('က္က', null, '|').should.equal('က္က');
		})
	})
})

after(function () {
	knayi.setGlobalOptions({
		silent_mode: false,
		detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
	});
});
