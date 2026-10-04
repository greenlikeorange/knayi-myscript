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

    it('takes undefined and null as no options', () => {
      globalOptions.setGlobalOptions({
        silent_mode: true,
        detector: { use_myanmartools: true, myanmartools_zg_threshold: [0.2, 0.8] }
      })
      assert.equal(globalOptions.setGlobalOptions(null), undefined)
      assert.equal(globalOptions.setGlobalOptions(undefined), undefined)
      assert.equal(globalOptions.setGlobalOptions(), undefined)
      assert.equal(globalOptions.isSilentMode(), true)
      assert.deepEqual(globalOptions.mergeDetectorOptions(null), { use_myanmartools: true, myanmartools_zg_threshold: [0.2, 0.8], zawgyiDetector: null })
      assert.deepEqual(globalOptions.mergeDetectorOptions(undefined), { use_myanmartools: true, myanmartools_zg_threshold: [0.2, 0.8], zawgyiDetector: null })
      globalOptions.setGlobalOptions({ detector: null })
      assert.deepEqual(globalOptions.mergeDetectorOptions({}), { use_myanmartools: true, myanmartools_zg_threshold: [0.2, 0.8], zawgyiDetector: null })
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

  // test/adapter.test.js checks how fontDetect uses the detector; this is the merge alone (2.x globalOptions.detector,
  // compat's mergeDetectorOptions).
  describe('detector zawgyiDetector', () => {
    const first = { getZawgyiProbability: () => 0 }
    const second = { getZawgyiProbability: () => 1 }

    after(() => {
      globalOptions.setGlobalOptions({
        silent_mode: false,
        detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95], zawgyiDetector: null }
      })
    })

    it('stores a detector, keeps it when a later call leaves it out, and lets a call use another', () => {
      assert.equal(globalOptions.mergeDetectorOptions({}).zawgyiDetector, null)
      globalOptions.setGlobalOptions({ detector: { zawgyiDetector: first } })
      assert.equal(globalOptions.mergeDetectorOptions({}).zawgyiDetector, first)
      globalOptions.setGlobalOptions({ detector: { use_myanmartools: true, myanmartools_zg_threshold: [0.2, 0.8] } })
      assert.equal(globalOptions.mergeDetectorOptions(null).zawgyiDetector, first)
      assert.equal(globalOptions.mergeDetectorOptions({ zawgyiDetector: second }).zawgyiDetector, second)
      assert.equal(globalOptions.mergeDetectorOptions({}).zawgyiDetector, first)
    })

    it('reads undefined and null as no detector', () => {
      globalOptions.setGlobalOptions({ detector: { zawgyiDetector: first } })
      assert.equal(globalOptions.mergeDetectorOptions({ zawgyiDetector: null }).zawgyiDetector, null)
      assert.equal(globalOptions.mergeDetectorOptions({ zawgyiDetector: undefined }).zawgyiDetector, undefined)
      globalOptions.setGlobalOptions({ detector: { zawgyiDetector: null } })
      assert.equal(globalOptions.mergeDetectorOptions({}).zawgyiDetector, null)
    })
  })
})
