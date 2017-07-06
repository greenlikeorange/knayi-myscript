var kanayi = require('../main');
var chai = require('chai');
var should = chai.should();

describe('Detector',()=>{
	describe('Detect Zawgyi',()=>{
		it('should detect zawgyi',done=>{
			kanayi.fontDetect('မဂၤလာပါ').should.equal('zawgyi');
			done();
		})
	})

	describe('Detect Unicode',()=>{
		it('should detect unicode',done=>{
			kanayi.fontDetect('မင်္ဂလာပါ').should.equal('unicode');
			done();
		})
	})
})
