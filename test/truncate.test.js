const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
var knayi = require('../main');
var pangram = 'အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။';

describe('truncate', () => {
	it('matches the README pangram cut', () => {
		assert.equal(
			knayi.truncate(pangram, { length: 30, omission: '...' }),
			'အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဈေး...'
		);
	})

	it('still appends the omission when the text is shorter than length', () => {
assert.equal(		knayi.truncate('က'), 'က...');
	})

	it('appends the omission to empty and non-Myanmar text', () => {
assert.equal(		knayi.truncate(''), '...');
assert.equal(		knayi.truncate('hi'), 'hi...');
	})

	it('returns empty when content is null', () => {
assert.equal(		knayi.truncate(null), '');
	})
})

after(function () {
	knayi.setGlobalOptions({
		silent_mode: false,
		detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
	});
});
