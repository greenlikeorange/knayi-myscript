var knayi = require('../main');
var chai = require('chai');
var should = chai.should();

describe('spellingFix',()=>{
	describe('spellingFix Unicode',()=>{
		it('should fix for unicode',()=>{
			knayi.spellingFix('မင်္ဂလာာပါါ','unicode').should.equal('မင်္ဂလာပါ');
		})
	})

	describe('spellingFix Zawgyi',()=>{
		it('should fix for zawgyi',()=>{
			knayi.spellingFix('မဂၤလာပါါ').should.equal('မဂၤလာပါ');
		})

		it('collapses a repeated zawgyi mark', () => {
			knayi.spellingFix('\u1033\u1033', 'zawgyi').should.equal('\u1033');
		})
	})

	describe('spelling policies', () => {
		it('leaves mixed unicode vowels for spellingFix', () => {
			knayi.spellingFix('ကိီ', 'unicode').should.equal('ကိီ');
		})
	})

	describe('font aliases', () => {
		it('treats zaw as zawgyi', () => {
			knayi.spellingFix('\u1033\u1033', 'zaw').should.equal('\u1033');
		})

		it('treats uni as the unicode mark list', () => {
			knayi.spellingFix('\u1033\u1033', 'uni').should.equal('\u1033\u1033');
		})
	})
})

after(function () {
	knayi.setGlobalOptions({
		silent_mode: false,
		detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
	});
});
