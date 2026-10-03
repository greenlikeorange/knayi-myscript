const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
var knayi = require('../main');
function toCharCode(letter) {
	return [].map
		.call(letter, (character) => `\\u${character.charCodeAt(0).toString(16)}`)
		.join('');
}

describe('Converter',()=>{
	describe('Zawgyi to Unicode',()=>{
		it('should become unicode', () =>{
assert.equal(			knayi.fontConvert('မဂၤလာပါ','unicode','zawgyi'), 'မင်္ဂလာပါ');
assert.equal(			knayi.fontConvert('မဂၤလာပါ','unicode'), 'မင်္ဂလာပါ');
assert.equal(			knayi.fontConvert('ၿမိဳ ့','unicode'), 'မြို့');
		})

		it('should convert kinzi', () => {
assert.equal(			knayi.fontConvert('\u1000\u103a\u108b', 'unicode', 'zawgyi'), 'င်္ကျိ');
assert.equal(			knayi.fontConvert('\u1021\u1000\u103a\u108c', 'unicode', 'zawgyi'), 'အင်္ကျီ');
assert.equal(			knayi.fontConvert('\u1000\u103a\u108d', 'unicode', 'zawgyi'), 'င်္ကျံ');
		})

		it('reads the dda and ddha ligature as dda over ddha', () => {
			assert.equal(knayi.fontConvert('\u106f', 'unicode', 'zawgyi'), '\u100d\u1039\u100e');
			assert.equal(knayi.fontConvert('\u101d\u106f\u1014', 'unicode', 'zawgyi'), '\u101d\u100d\u1039\u100e\u1014');
			assert.equal(knayi.fontConvert('\u101d\u100d\u1039\u100e\u1014', 'zawgyi', 'unicode'), '\u101d\u106f\u1014');
		})
	})

	describe('Unicode to Zawgyi',()=>{
		it('should become zawgyi', () =>{
assert.equal(			knayi.fontConvert('မင်္ဂလာပါ','zawgyi','unicode'), 'မဂၤလာပါ');
assert.equal(			knayi.fontConvert('မင်္ဂလာပါ','zawgyi'), 'မဂၤလာပါ');
assert.equal(			knayi.fontConvert('က္ကြွှေိာ်','zawgyi'), 'ေၾကၠႊိာ္')
		})

		it('should convert kinzi', () => {
assert.equal(			knayi.fontConvert('င်္ကျိ', 'zawgyi', 'unicode'), '\u1000\u108b\u103a');
assert.equal(			knayi.fontConvert('င်္ကျီ', 'zawgyi', 'unicode'), '\u1000\u108c\u103a');
assert.equal(			knayi.fontConvert('င်္ကျံ', 'zawgyi', 'unicode'), '\u1000\u108d\u103a');
		})
		it('keeps zero-width spaces', () => {
assert.equal(			knayi.fontConvert('မြန်\u200Bမာ', 'zawgyi', 'unicode'), 'ျမန္\u200Bမာ');
		})
		it('picks the medial ra shape from its own consonant, not the next syllable', () => {
			// The next syllable has a mark below (သူ, ဂု) or a stacked consonant (ဟ္မ): the ra stays whole.
assert.equal(			knayi.fontConvert('ဆန္ဒပြသူ', 'zawgyi', 'unicode'), 'ဆႏၵျပသူ');
assert.equal(			knayi.fontConvert('သြဂုတ်', 'zawgyi', 'unicode'), 'ၾသဂုတ္');
assert.equal(			knayi.fontConvert('ဗြဟ္မာ', 'zawgyi', 'unicode'), 'ျဗဟၼာ');
			// Its own consonant has medial wa below: the ra is cut.
assert.equal(			knayi.fontConvert('ကြွ', 'zawgyi', 'unicode'), 'ႂကြ');
assert.equal(			knayi.fontConvert('ပြွတ်', 'zawgyi', 'unicode'), 'ႁပြတ္');
		})
	})

	describe('content gate', () => {
		it('returns empty when content is missing', () => {
assert.equal(			knayi.fontConvert(null, 'unicode'), '');
		})

		it('returns non-Myanmar text unchanged', () => {
assert.equal(			knayi.fontConvert('abc', 'unicode'), 'abc');
		})

		it('returns the original text when the target font is missing', () => {
assert.equal(			knayi.fontConvert('က'), 'က');
		})

		it('trims, and keeps zero-width spaces, before rejecting an unknown font', () => {
assert.equal(			knayi.fontConvert(' က \u200B', 'nope'), 'က \u200B');
		})

		it('skips spelling fix when the source and target fonts match', () => {
assert.equal(			knayi.fontConvert(' ကာာ ', 'unicode', 'unicode'), 'ကာာ');
		})

		it('accepts uni and zaw aliases when the source is named', () => {
assert.equal(			knayi.fontConvert('မဂၤလာပါ', 'uni', 'zaw'), 'မင်္ဂလာပါ');
		})
	})

	describe('unicode ya', () => {
		it('keeps Unicode ya when the source font is omitted', () => {
assert.equal(			knayi.fontConvert('ကျ', 'unicode'), 'ကျ');
		})

		it('keeps Unicode ya when the source font is unicode', () => {
assert.equal(			knayi.fontConvert('ကျ', 'unicode', 'unicode'), 'ကျ');
		})
	})

	describe('debugging', () => {
		it('debugging last step matches fontConvert', () => {
			var input = 'က္ကြွှေိာ်';
			var plain = knayi.fontConvert(input, 'zawgyi', 'unicode');
			var debug = knayi.fontConvert.debugging(input, 'zawgyi', 'unicode');
assert.equal(			plain, 'ေၾကၠႊိာ္');
			assert.equal(typeof debug, 'object');
assert.equal(			debug.steps[debug.steps.length - 1], plain);
			debug.matched_patterns.forEach(function (pattern) {
				assert.equal(typeof pattern, 'string');
			});
		})
	})

	describe('digit zero from Zawgyi', () => {
		it('keeps zeros inside numbers', () => {
assert.equal(			knayi.fontConvert('(၂၀၂၄)ခုႏွစ္', 'unicode', 'zawgyi'), '(၂၀၂၄)ခုနှစ်');
assert.equal(			knayi.fontConvert('၁၀၀ က်ပ္', 'unicode', 'zawgyi'), '၁၀၀ ကျပ်');
assert.equal(			knayi.fontConvert('၁,၀၀၀', 'unicode', 'zawgyi'), '၁,၀၀၀');
assert.equal(			knayi.fontConvert('၂၀-၃၀', 'unicode', 'zawgyi'), '၂၀-၃၀');
		})

		it('still reads a zero typed for wa as wa', () => {
assert.equal(			knayi.fontConvert('၀မ္းသာ', 'unicode', 'zawgyi'), 'ဝမ်းသာ');
assert.equal(			knayi.fontConvert('ေ၀', 'unicode', 'zawgyi'), 'ဝေ');
assert.equal(			knayi.fontConvert('အ၀တ္', 'unicode', 'zawgyi'), 'အဝတ်');
		})
	})
})

after(function () {
	knayi.setGlobalOptions({
		silent_mode: false,
		detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
	});
});
