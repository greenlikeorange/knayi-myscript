var globalOptions = require('../library/globalOptions');
var chai = require('chai');
var should = chai.should();

describe('globalOptions',()=>{
	describe('globalOptions Slient Mode',()=>{
    before(() => {
      globalOptions.setOptions({silent_mode: true})
    })
		it('should syllBreak for unicode', () => {
      var silent_mode = globalOptions.isSilentMode()
      silent_mode.should.be.true;
		})
	})
})
