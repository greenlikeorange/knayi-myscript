var knayi = require('../main');
var chai = require('chai');
var should = chai.should();

describe('syllBreak',()=>{
	describe('syllBreak Unicode',()=>{
		it('should syllBreak for unicode',done=>{
			knayi.syllBreak('မင်္ဂလာပါ', null, '**').should.equal('မင်္ဂလာ**ပါ');
			done();
		})
	})
})
