var knayi = require('../main');
var chai = require('chai');
chai.should();

describe('normalization',()=>{
	describe('normalization test 1',()=>{
		it('should fix to correct words',done=>{
			knayi.normalize('မင်္ဂလာာပါါ','unicode').should.equal('မင်္ဂလာပါ');
			done();
		})
  })

  describe('normalization test 2',()=>{
		it('should fix to correct words',done=>{
			knayi.normalize('မိြုင်မိြုင်','unicode').should.equal('မြိုင်မြိုင်');
			done();
		})
  })

  describe('normalization test 3',()=>{
		it('should fix to correct words',done=>{
			knayi.normalize('မိြုင်မိြုင်\nဆိုင်ဆုိင်','unicode').should.equal('မြိုင်မြိုင်\nဆိုင်ဆိုင်');
			done();
		})
  })
})
