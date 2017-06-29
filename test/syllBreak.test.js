var kanayi = require('../main');
var chai = require('chai');
var should = chai.should();

describe('syllBreak',()=>{
	describe('syllBreak Unicode',()=>{
		it('should syllBreak for unicode',done=>{
			kanayi.syllBreak('မင်္ဂလာပါ', null, '$$').should.equal('မင်္ဂ$$လာ$$ပါ');
			done();
		})
	})
})
