const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
// The 2.x API: compat, on the 3.0 core.
var knayi = require('../src/compat/index.js').default;
describe('spellingFix',()=>{
  describe('spellingFix Unicode',()=>{
    it('should fix for unicode',()=>{
      assert.equal(knayi.spellingFix('မင်္ဂလာာပါါ','unicode'), 'မင်္ဂလာပါ');
    })
  })

  describe('spellingFix Zawgyi',()=>{
    it('should fix for zawgyi',()=>{
      assert.equal(knayi.spellingFix('မဂၤလာပါါ'), 'မဂၤလာပါ');
    })

    it('collapses a repeated zawgyi mark', () => {
      assert.equal(knayi.spellingFix('\u1033\u1033', 'zawgyi'), '\u1033');
    })
  })

  describe('spelling policies', () => {
    it('leaves mixed unicode vowels for spellingFix', () => {
      assert.equal(knayi.spellingFix('ကိီ', 'unicode'), 'ကိီ');
    })
  })

  describe('font aliases', () => {
    it('treats zaw as zawgyi', () => {
      assert.equal(knayi.spellingFix('\u1033\u1033', 'zaw'), '\u1033');
    })

    it('treats uni as the unicode mark list', () => {
      assert.equal(knayi.spellingFix('\u1033\u1033', 'uni'), '\u1033\u1033');
    })
  })
})

after(function () {
  knayi.setGlobalOptions({
    silent_mode: false,
    detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
  });
});
