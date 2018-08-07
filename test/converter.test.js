var knayi = require('../main');
var chai = require('chai');
var should = chai.should();

function toCharCode(letter) {
	return [].map
		.call(letter, (character) => `\\u${character.charCodeAt(0).toString(16)}`)
		.join('');
}

describe('Converter',()=>{
	describe('Zawgyi to Unicode',()=>{
		it('should become unicode', () =>{
			knayi.fontConvert('မဂၤလာပါ','unicode','zawgyi').should.equal('မင်္ဂလာပါ');
			knayi.fontConvert('မဂၤလာပါ','unicode').should.equal('မင်္ဂလာပါ');
			knayi.fontConvert('ၿမိဳ ့','unicode').should.equal('မြို့');
		})

		it('should convert kinzi', () => {
			knayi.fontConvert('\u1000\u103a\u108b', 'unicode', 'zawgyi').should.equal('င်္ကျိ');
			knayi.fontConvert('\u1000\u103a\u108c', 'unicode', 'zawgyi').should.equal('င်္ကျီ');
			knayi.fontConvert('\u1000\u103a\u108d', 'unicode', 'zawgyi').should.equal('င်္ကျံ');
		})
	})

	describe('Unicode to Zawgyi',()=>{
		it('should become zawgyi', () =>{
			knayi.fontConvert('မင်္ဂလာပါ','zawgyi','unicode').should.equal('မဂၤလာပါ');
			knayi.fontConvert('မင်္ဂလာပါ','zawgyi').should.equal('မဂၤလာပါ');
			knayi.fontConvert('က္ကြွှေိာ်','zawgyi').should.equal('ေၾကၠႊိာ္')
		})

		it('should convert kinzi', () => {
			knayi.fontConvert('င်္ကျိ', 'zawgyi', 'unicode').should.equal('\u1000\u108b\u103a');
			knayi.fontConvert('င်္ကျီ', 'zawgyi', 'unicode').should.equal('\u1000\u108c\u103a');
			knayi.fontConvert('င်္ကျံ', 'zawgyi', 'unicode').should.equal('\u1000\u108d\u103a');
		})
	})
})
