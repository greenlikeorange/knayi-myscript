var knayi = require('../main');
var chai = require('chai');
var should = chai.should();

knayi.setGlobalOptions({ detector: { use_myanmartools: true } })

describe('Detector default mode',()=>{
	describe('Detect Zawgyi',()=>{
		it('should detect zawgyi',()=>{
			knayi.fontDetect('မဂၤလာပါ').should.equal('zawgyi');
		})
	})

	describe('Detect Unicode',()=>{
		it('should detect unicode',()=>{
			knayi.fontDetect('မင်္ဂလာပါ').should.equal('unicode');
		})
	})
})

describe('Detector with myanmartools',()=>{

	describe('Detect Zawgyi',()=>{
		it('should detect zawgyi',()=>{
			knayi.fontDetect('မဂၤလာပါ', null, {use_myanmartools: true}).should.equal('zawgyi');
		})
	})

	describe('Detect Unicode',()=>{
		it('should detect unicode',()=>{
			knayi.fontDetect('မင်္ဂလာပါ', null, {use_myanmartools: true}).should.equal('unicode');
		})
	})
})
