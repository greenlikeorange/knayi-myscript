var knayi = require('../main');
var chai = require('chai');
chai.should();

describe('normalization', () => {
	describe('normalization test 1', () => {
		it('should fix to correct words', () => {
			knayi.normalize('မင်္ဂလာာပါါ').should.equal('မင်္ဂလာပါ');
		})
  })

  describe('normalization test 2', () => {
		it('should fix to correct words', () => {
			knayi.normalize('မိြုင်မိြုင်').should.equal('မြိုင်မြိုင်');
		})
  })

  describe('normalization test 3', () => {
		it('should fix to correct words', () => {
			knayi.normalize('မိြုင်မိြုင်\nဆိုင်ဆုိင်').should.equal('မြိုင်မြိုင်\nဆိုင်ဆိုင်');
		})
	})
	
	describe('Extended values', () => {
		it('shoudl change correct words', () => {
			knayi.normalize('၀ိုင်းဩာေ်ဥးူိီစျေမန ္တလေး').should.equal('ဝိုင်းဪဦူးဈေမန္တလေး');
		})
	})
})
