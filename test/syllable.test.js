var syllable = require('../library/syllable');
var chai = require('chai');
chai.should();

describe('syllable', function () {
	it('parses an onset, a medial, and an asat coda', function () {
		var parsed = syllable.parseUnicode('မြန်');
		parsed.should.have.length(1);
		parsed[0].onset.should.equal('မ');
		parsed[0].medials.should.equal('ြ');
		parsed[0].coda.should.equal('န်');
		syllable.serializeUnicode(parsed).should.equal('မြန်');
	});

	it('parses kinzi onto the following onset', function () {
		var parsed = syllable.parseUnicode('င်္ဂ');
		parsed.should.have.length(1);
		parsed[0].kinzi.should.equal(true);
		parsed[0].onset.should.equal('ဂ');
		syllable.serializeUnicode(parsed).should.equal('င်္ဂ');
	});

	it('keeps normalize and spelling collapse as two policies', function () {
		syllable.normalizeText('ကိီ').should.equal('ကီ');
		syllable.collapseMarks('ကိီ', 'unicode').should.equal('ကိီ');
	});

	it('segments orthographic syllables without changing the public break', function () {
		syllable.parseUnicode('ကက').should.have.length(2);
		syllable.breakParts('ကက', 'unicode').should.deep.equal(['ကက']);
	});
});
