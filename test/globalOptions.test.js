const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
var globalOptions = require('../library/globalOptions');
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
      assert.equal(globalOptions.isSilentMode(), true);
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
      assert.equal(resolved.use_myanmartools, true)
      assert.deepEqual(resolved.myanmartools_zg_threshold, [0.2, 0.8])
    })
  })
})
