var kanayi = require('../main');
var chai = require('chai');
var should = chai.should();

describe('spellingFix',()=>{
	describe('spellingFix Unicode',()=>{
		it('should fix for unicode',done=>{
			kanayi.spellingFix('မင်္ဂလာာပါါ','unicode').should.equal('မင်္ဂလာပါ');
			done();
		})
	})

	describe('spellingFix Zawgyi',()=>{
		it('should fix for zawgyi',done=>{
			kanayi.spellingFix('မဂၤလာပါါ').should.equal('မဂၤလာပါ');
			done();
		})
	})
})
