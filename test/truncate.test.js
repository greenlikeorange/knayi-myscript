var knayi = require('../main');
var chai = require('chai');
chai.should();

var pangram = 'အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။';

describe('truncate', () => {
	it('matches the README pangram cut', () => {
		knayi.truncate(pangram, { length: 30, omission: '...' })
			.should.equal('အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဈေး...');
	})

	it('still appends the omission when the text is shorter than length', () => {
		knayi.truncate('က').should.equal('က...');
	})

	it('appends the omission to empty and non-Myanmar text', () => {
		knayi.truncate('').should.equal('...');
		knayi.truncate('hi').should.equal('hi...');
	})

	it('returns empty when content is null', () => {
		knayi.truncate(null).should.equal('');
	})
})

after(function () {
	knayi.setGlobalOptions({
		silent_mode: false,
		detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
	});
});
