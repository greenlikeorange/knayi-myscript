var knayi = require('../main');
var chai = require('chai');
var should = chai.should();

describe('Converter',()=>{
	describe('Zawgyi to Unicode',()=>{
		it('should become unicode',done=>{
			knayi.fontConvert('မဂၤလာပါ','unicode','zawgyi').should.equal('မင်္ဂလာပါ');
			knayi.fontConvert('မဂၤလာပါ','unicode').should.equal('မင်္ဂလာပါ');
			knayi.fontConvert('ၿမိဳ ့','unicode').should.equal('မြို့');
			done();
		})
	})

	describe('Unicode to Zawgyi',()=>{
		it('should become zawgyi',done=>{
			knayi.fontConvert('မင်္ဂလာပါ','zawgyi','unicode').should.equal('မဂၤလာပါ');
			knayi.fontConvert('မင်္ဂလာပါ','zawgyi').should.equal('မဂၤလာပါ');
			knayi.fontConvert('က္ကြွှေိာ်','zawgyi').should.equal('ေၾကၠႊိာ္')
			done();
		})
	})
})
