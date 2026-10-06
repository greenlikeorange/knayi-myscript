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

    it('takes undefined and null as no options', () => {
      globalOptions.setOptions({
        silent_mode: true,
        detector: { use_myanmartools: true, myanmartools_zg_threshold: [0.2, 0.8] }
      })
      assert.equal(globalOptions.setOptions(null), undefined)
      assert.equal(globalOptions.setOptions(undefined), undefined)
      assert.equal(globalOptions.setOptions(), undefined)
      assert.equal(globalOptions.isSilentMode(), true)
      assert.deepEqual(globalOptions.detector(null), { use_myanmartools: true, myanmartools_zg_threshold: [0.2, 0.8], zawgyiDetector: null })
      assert.deepEqual(globalOptions.detector(undefined), { use_myanmartools: true, myanmartools_zg_threshold: [0.2, 0.8], zawgyiDetector: null })
      globalOptions.setOptions({ detector: null })
      assert.deepEqual(globalOptions.detector({}), { use_myanmartools: true, myanmartools_zg_threshold: [0.2, 0.8], zawgyiDetector: null })
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

  // test/adapter.test.js checks how fontDetect uses the detector; this is the merge alone.
  describe('detector zawgyiDetector', () => {
    const first = { getZawgyiProbability: () => 0 }
    const second = { getZawgyiProbability: () => 1 }

    after(() => {
      globalOptions.setOptions({
        silent_mode: false,
        detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95], zawgyiDetector: null }
      })
    })

    it('stores a detector, keeps it when a later call leaves it out, and lets a call use another', () => {
      assert.equal(globalOptions.detector({}).zawgyiDetector, null)
      globalOptions.setOptions({ detector: { zawgyiDetector: first } })
      assert.equal(globalOptions.detector({}).zawgyiDetector, first)
      globalOptions.setOptions({ detector: { use_myanmartools: true, myanmartools_zg_threshold: [0.2, 0.8] } })
      assert.equal(globalOptions.detector(null).zawgyiDetector, first)
      assert.equal(globalOptions.detector({ zawgyiDetector: second }).zawgyiDetector, second)
      assert.equal(globalOptions.detector({}).zawgyiDetector, first)
    })

    it('reads undefined and null as no detector', () => {
      globalOptions.setOptions({ detector: { zawgyiDetector: first } })
      assert.equal(globalOptions.detector({ zawgyiDetector: null }).zawgyiDetector, null)
      assert.equal(globalOptions.detector({ zawgyiDetector: undefined }).zawgyiDetector, undefined)
      globalOptions.setOptions({ detector: { zawgyiDetector: null } })
      assert.equal(globalOptions.detector({}).zawgyiDetector, null)
    })
  })
})
