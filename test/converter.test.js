var kanayi = require('../main');
var chai = require('chai');
var should = chai.should();

describe('Converter',()=>{
	describe('Zawgyi to Unicode',()=>{
		it('Convert to Unicode',done=>{
			kanayi.fontConvert('မဂၤလာပါ','unicode','zawgyi').should.equal('မင်္ဂလာပါ');
			kanayi.fontConvert('မဂၤလာပါ','unicode').should.equal('မင်္ဂလာပါ');
			done();
		})
	})

	describe('Unicode to Zawgyi',()=>{
		it('Convert to Unicode',done=>{
			kanayi.fontConvert('မင်္ဂလာပါ','zawgyi','unicode').should.equal('မင္ၢလာပါ');
			kanayi.fontConvert('မင်္ဂလာပါ','zawgyi').should.equal('မင္ၢလာပါ');
			done();
		})
	})
})
