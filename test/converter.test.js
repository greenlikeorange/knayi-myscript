var knayi = require('../main');
var chai = require('chai');
var should = chai.should();

describe('Converter',()=>{
	describe('Zawgyi to Unicode',()=>{
		it('Convert to Unicode',done=>{
			knayi.fontConvert('မဂၤလာပါ','unicode','zawgyi').should.equal('မင်္ဂလာပါ');
			knayi.fontConvert('မဂၤလာပါ','unicode').should.equal('မင်္ဂလာပါ');
			done();
		})
	})

	describe('Unicode to Zawgyi',()=>{
		it('Convert to Unicode',done=>{
			knayi.fontConvert('မင်္ဂလာပါ','zawgyi','unicode').should.equal('မင္ၢလာပါ');
			knayi.fontConvert('မင်္ဂလာပါ','zawgyi').should.equal('မင္ၢလာပါ');
			done();
		})
	})
})
