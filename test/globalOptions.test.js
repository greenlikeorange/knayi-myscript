const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
// The 2.x option store: compat's, on the 3.0 core.
var globalOptions = require('../src/compat/globalOptions.js');
describe('globalOptions',()=>{
  describe('globalOptions Slient Mode',()=>{
    before(() => {
      globalOptions.setGlobalOptions({silent_mode: true})
    })
    after(() => {
      globalOptions.setGlobalOptions({
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
      globalOptions.setGlobalOptions({
        silent_mode: false,
        detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
      })
    })

    it('keeps a stored threshold when a later call only sets the adapter flag', () => {
      globalOptions.setGlobalOptions({
        detector: { use_myanmartools: true, myanmartools_zg_threshold: [0.2, 0.8] }
      })
      var resolved = globalOptions.mergeDetectorOptions({ use_myanmartools: true })
      assert.equal(resolved.use_myanmartools, true)
      assert.deepEqual(resolved.myanmartools_zg_threshold, [0.2, 0.8])
    })
  })
})
