const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
// The 2.x API: compat, on the 3.0 core.
var knayi = require('../src/compat/index.js').default;
var myanmarToolsWarnings = [];
describe('Detector default mode',()=>{
  describe('Detect Zawgyi',()=>{
    it('should detect zawgyi',()=>{
      assert.equal(knayi.fontDetect('မဂၤလာပါ', null, { adapter: 'rules' }), 'zawgyi');
    })
  })

  describe('Detect Unicode',()=>{
    it('should detect unicode',()=>{
      assert.equal(knayi.fontDetect('မင်္ဂလာပါ', null, { adapter: 'rules' }), 'unicode');
    })
  })
})

describe('Detector with myanmartools',()=>{
  var originalWarn;
  before(function () {
    originalWarn = console.warn;
    console.warn = function (message) { myanmarToolsWarnings.push(message); };
  });
  after(function () {
    console.warn = originalWarn;
  });

  describe('Detect Zawgyi',()=>{
    it('should detect zawgyi',()=>{
      assert.equal(knayi.fontDetect('မဂၤလာပါ', null, { adapter: 'myanmartools' }), 'zawgyi');
    })
  })

  describe('Detect Unicode',()=>{
    it('should detect unicode',()=>{
      assert.equal(knayi.fontDetect('မင်္ဂလာပါ', null, { adapter: 'myanmartools' }), 'unicode');
    })
  })
})

describe('detector content and ties', () => {
  it('returns en when content is missing or not Myanmar', () => {
    assert.equal(knayi.fontDetect(null), 'en');
    assert.equal(knayi.fontDetect(''), 'en');
    assert.equal(knayi.fontDetect('abc'), 'en');
  })

  it('uses the fallback when a single consonant ties', () => {
    assert.equal(knayi.fontDetect('က'), 'zawgyi');
    assert.equal(knayi.fontDetect('က', 'unicode'), 'unicode');
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

    var toolsOptions = { adapter: 'myanmartools', myanmartools_zg_threshold: [0.05, 0.9] };

    assert.equal(knayi.fontDetect('က္က', 'unicode', { adapter: 'rules' }), 'unicode');
    if (tools) {
      assert.equal(knayi.fontDetect('က္က', 'unicode', toolsOptions), 'zawgyi');
    } else {
      assert.equal(knayi.fontDetect('က္က', 'unicode', toolsOptions), 'unicode');
      assert.ok(myanmarToolsWarnings.some(function (message) {
        return /myanmar-tools is not installed/.test(String(message));
      }));
    }
  });
});

describe('unicode signatures', () => {
  it('scores Unicode ya as unicode', () => {
    assert.equal(knayi.fontDetect('ကျ'), 'unicode');
  })

  it('scores a virama stack as unicode when other Unicode signs are present', () => {
    assert.equal(knayi.fontDetect('ရန်ကုန်တက္ကသိုလ်'), 'unicode');
  })
})

describe('zawgyi asat before a consonant', () => {
  it('does not read consonant + U+1039 + consonant as a Unicode stack', () => {
    assert.equal(knayi.fontDetect('ကပ္ကေတာ့'), 'zawgyi');
    assert.equal(knayi.fontDetect('ျမန္မာနိုင္ငံ'), 'zawgyi');
    assert.equal(knayi.fontDetect('အင္တာနက္ ဆက္သြယ္မႈ'), 'zawgyi');
  })

  it('converts it when the source font is detected', () => {
    assert.equal(knayi.fontConvert('ျမန္မာနိုင္ငံ', 'unicode'), 'မြန်မာနိုင်ငံ');
  })

  it('leaves a bare stack to the fallback', () => {
    assert.equal(knayi.fontDetect('က္က'), 'zawgyi');
    assert.equal(knayi.fontDetect('က္က', 'unicode'), 'unicode');
  })
})

after(function () {
  knayi.setGlobalOptions({
    silent_mode: false,
    detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
  });
});
