var knayi = require('../main');
var chai = require('chai');
var should = chai.should();

describe('Detector default mode',()=>{
	describe('Detect Zawgyi',()=>{
		it('should detect zawgyi',()=>{
			knayi.fontDetect('မဂၤလာပါ', null, { adapter: 'rules' }).should.equal('zawgyi');
		})
	})

	describe('Detect Unicode',()=>{
		it('should detect unicode',()=>{
			knayi.fontDetect('မင်္ဂလာပါ', null, { adapter: 'rules' }).should.equal('unicode');
		})
	})
})

describe('Detector with myanmartools',()=>{

	describe('Detect Zawgyi',()=>{
		it('should detect zawgyi',()=>{
			knayi.fontDetect('မဂၤလာပါ', null, { adapter: 'myanmartools' }).should.equal('zawgyi');
		})
	})

	describe('Detect Unicode',()=>{
		it('should detect unicode',()=>{
			knayi.fontDetect('မင်္ဂလာပါ', null, { adapter: 'myanmartools' }).should.equal('unicode');
		})
	})
})

describe('detector content and ties', () => {
	it('returns en when content is missing or not Myanmar', () => {
		knayi.fontDetect(null).should.equal('en');
		knayi.fontDetect('').should.equal('en');
		knayi.fontDetect('abc').should.equal('en');
	})

	it('uses the fallback when a single consonant ties', () => {
		knayi.fontDetect('က').should.equal('zawgyi');
		knayi.fontDetect('က', 'unicode').should.equal('unicode');
	})
})

describe('detector adapters', () => {
	after(function () {
		knayi.setGlobalOptions({
			silent_mode: false,
			detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
		});
	});

	it('lets the passed adapter win over the global flag', function () {
		knayi.setGlobalOptions({ detector: { use_myanmartools: true } });
		var tools;
		try {
			tools = require('myanmar-tools');
		} catch (e) {}

		knayi.fontDetect('က္က', null, { adapter: 'rules' }).should.equal('unicode');
		if (tools) {
			knayi.fontDetect('က္က', null, { adapter: 'myanmartools' }).should.equal('zawgyi');
		} else {
			var warnings = [];
			var original = console.warn;
			console.warn = function (message) { warnings.push(message); };
			try {
				knayi.fontDetect('က္က', null, { adapter: 'myanmartools' }).should.equal('unicode');
			} finally {
				console.warn = original;
			}
			warnings[0].should.match(/myanmar-tools adapter is missing/);
		}
	});
});

describe('unicode signatures', () => {
	it('scores Unicode ya as unicode', () => {
		knayi.fontDetect('ကျ').should.equal('unicode');
	})

	it('scores a virama stack as unicode', () => {
		knayi.fontDetect('က္က').should.equal('unicode');
	})
})

after(function () {
	knayi.setGlobalOptions({
		silent_mode: false,
		detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
	});
});
