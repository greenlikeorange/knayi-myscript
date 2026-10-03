const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { inspect } = require('util');
var knayi = require('../main');
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

// The fallback is a string other than '', returned as given; a String object counts as its string. Any other value
// is no fallback, so the index that Array#map passes as the second argument never comes back as the result.
describe('detector fallback', () => {
  const TIE = 'ဗုဒ္ဓ';
  const NOT_FALLBACKS = [undefined, null, '', 0, 1, 2, -1, NaN, true, false, {}, [], ['unicode'], new String('')];

  afterEach(() => {
    knayi.setGlobalOptions({
      silent_mode: false,
      detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
    });
  });

  it('ignores a fallback that is not a string, or is empty', () => {
    knayi.setGlobalOptions({ silent_mode: true });
    for (const fallback of NOT_FALLBACKS) {
      const label = inspect(fallback);
      assert.equal(knayi.fontDetect(null, fallback), 'en', label);
      assert.equal(knayi.fontDetect(123, fallback), 'en', label);
      assert.equal(knayi.fontDetect('abc', fallback), 'en', label);
      assert.equal(knayi.fontDetect(TIE, fallback), 'zawgyi', label);
      // myanmar-tools gives က a probability of about 0.48, between the default thresholds.
      assert.equal(knayi.fontDetect('က', fallback, { adapter: 'myanmartools' }), 'zawgyi', label);
    }
  });

  it('gives a font or en for every line of lines.map(fontDetect)', () => {
    knayi.setGlobalOptions({ silent_mode: true });
    assert.deepEqual(['မြန်မာ', 'ျမန္မာ', TIE, 'abc', '', 'jrefrm', 'က'].map(knayi.fontDetect),
      ['unicode', 'zawgyi', 'zawgyi', 'en', 'en', 'en', 'zawgyi']);
  });

  it('returns a string fallback as given, and a String object as its string', () => {
    assert.equal(knayi.fontDetect('abc', 'tie'), 'tie');
    assert.equal(knayi.fontDetect(TIE, 'Unicode'), 'Unicode');
    assert.equal(knayi.fontDetect('abc', new String('unicode')), 'unicode');
    assert.equal(knayi.fontDetect(TIE, new String('en')), 'en');
    assert.equal(knayi.fontDetect('က', new String('unicode'), { adapter: 'myanmartools' }), 'unicode');
  });
})

// undefined and null are no options: the call uses the stored detector options, as with {}.
describe('detector options', () => {
  afterEach(() => {
    knayi.setGlobalOptions({
      silent_mode: false,
      detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
    });
  });

  it('takes null as no options', () => {
    const texts = ['ျမန္မာ', 'မြန်မာ', 'ဗုဒ္ဓ', ' မြန်\u200Bမာ ', 'ျမန္မာ\nမြန်မာ', 'abc', 123];
    for (const text of texts) {
      for (const fallback of [undefined, null, 'unicode', 1]) {
        const label = inspect([text, fallback]);
        assert.equal(knayi.fontDetect(text, fallback, null), knayi.fontDetect(text, fallback, {}), label);
        assert.equal(knayi.fontDetect(text, fallback, null), knayi.fontDetect(text, fallback), label);
      }
    }
    assert.deepEqual(['ျမန္မာ', 'ဗုဒ္ဓ'].map((text) => knayi.fontDetect(text, null, null)), ['zawgyi', 'zawgyi']);
  });

  it('uses the stored adapter and threshold with null options', () => {
    // myanmar-tools gives က္က a probability of about 0.93: Zawgyi above 0.9, and a rule-score tie.
    knayi.setGlobalOptions({ detector: { use_myanmartools: true, myanmartools_zg_threshold: [0.05, 0.9] } });
    assert.equal(knayi.fontDetect('က္က', 'unicode', null), 'zawgyi');
    knayi.setGlobalOptions(null);
    assert.equal(knayi.fontDetect('က္က', 'unicode', null), 'zawgyi');
    knayi.setGlobalOptions({ detector: null });
    assert.equal(knayi.fontDetect('က္က', 'unicode', null), 'zawgyi');
    knayi.setGlobalOptions({ detector: { use_myanmartools: false } });
    assert.equal(knayi.fontDetect('က္က', 'unicode', null), 'unicode');
  });
})

after(function () {
  knayi.setGlobalOptions({
    silent_mode: false,
    detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
  });
});
