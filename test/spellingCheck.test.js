var knayi = require('../main');
var chai = require('chai');
var should = chai.should();

describe('spellingFix',()=>{
	describe('spellingFix Unicode',()=>{
		it('should fix for unicode',done=>{
			knayi.spellingFix('မင်္ဂလာာပါါ','unicode').should.equal('မင်္ဂလာပါ');
			done();
		})
	})

	describe('spellingFix Zawgyi',()=>{
		it('should fix for zawgyi',done=>{
			knayi.spellingFix('မဂၤလာပါါ').should.equal('မဂၤလာပါ');
			done();
		})
	})
})
