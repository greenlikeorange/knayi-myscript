var globalOptions = require('../library/globalOptions');
var chai = require('chai');
var should = chai.should();

describe('globalOptions',()=>{
	describe('globalOptions Slient Mode',()=>{
    before(() => {
      globalOptions.setOptions({silent_mode: true})
    })
    after(() => {
      globalOptions.setOptions({
        silent_mode: false,
        detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
      })
    })
		it('should syllBreak for unicode', () => {
      var silent_mode = globalOptions.isSilentMode()
      silent_mode.should.be.true;
		})
	})

	describe('detector threshold', () => {
		after(() => {
			globalOptions.setOptions({
				silent_mode: false,
				detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
			})
		})

		it('keeps a stored threshold when a later call only sets the adapter flag', () => {
			globalOptions.setOptions({
				detector: { use_myanmartools: true, myanmartools_zg_threshold: [0.2, 0.8] }
			})
			var resolved = globalOptions.detector({ use_myanmartools: true })
			resolved.use_myanmartools.should.equal(true)
			resolved.myanmartools_zg_threshold.should.deep.equal([0.2, 0.8])
		})
	})
})
