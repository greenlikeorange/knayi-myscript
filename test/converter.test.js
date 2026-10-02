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
			knayi.fontConvert('\u1021\u1000\u103a\u108c', 'unicode', 'zawgyi').should.equal('အင်္ကျီ');
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

	describe('content gate', () => {
		it('returns empty when content is missing', () => {
			knayi.fontConvert(null, 'unicode').should.equal('');
		})

		it('returns non-Myanmar text unchanged', () => {
			knayi.fontConvert('abc', 'unicode').should.equal('abc');
		})

		it('returns the original text when the target font is missing', () => {
			knayi.fontConvert('က').should.equal('က');
		})

		it('trims and strips zero-width before rejecting an unknown font', () => {
			knayi.fontConvert(' က \u200B', 'nope').should.equal('က ');
		})

		it('skips spelling fix when the source and target fonts match', () => {
			knayi.fontConvert(' ကာာ ', 'unicode', 'unicode').should.equal('ကာာ');
		})

		it('accepts uni and zaw aliases when the source is named', () => {
			knayi.fontConvert('မဂၤလာပါ', 'uni', 'zaw').should.equal('မင်္ဂလာပါ');
		})
	})

	describe('unicode ya', () => {
		it('keeps Unicode ya when the source font is omitted', () => {
			knayi.fontConvert('ကျ', 'unicode').should.equal('ကျ');
		})

		it('keeps Unicode ya when the source font is unicode', () => {
			knayi.fontConvert('ကျ', 'unicode', 'unicode').should.equal('ကျ');
		})
	})

	describe('debugging', () => {
		it('debugging last step matches fontConvert', () => {
			var input = 'က္ကြွှေိာ်';
			var plain = knayi.fontConvert(input, 'zawgyi', 'unicode');
			var debug = knayi.fontConvert.debugging(input, 'zawgyi', 'unicode');
			plain.should.equal('ေၾကၠႊိာ္');
			debug.should.be.an('object');
			debug.steps[debug.steps.length - 1].should.equal(plain);
			debug.matched_patterns.forEach(function (pattern) {
				pattern.should.be.a('string');
			});
		})
	})
})

after(function () {
	knayi.setGlobalOptions({
		silent_mode: false,
		detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
	});
});
