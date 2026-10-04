const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { inspect } = require('util');
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
      detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95], zawgyiDetector: null }
    });
  });

  // compat loads no package by name (2.x 649b2b4), so the test passes it a detector of the package, as an app does;
  // 2.x's main.js loads the package itself.
  it('lets the passed adapter win over the global flag', function () {
    var tools;
    try {
      tools = require('myanmar-tools');
    } catch (e) {}
    knayi.setGlobalOptions({ detector: { use_myanmartools: true, zawgyiDetector: tools ? new tools.ZawgyiDetector() : null } });

    var toolsOptions = { adapter: 'myanmartools', myanmartools_zg_threshold: [0.05, 0.9] };

    assert.equal(knayi.fontDetect('က္က', 'unicode', { adapter: 'rules' }), 'unicode');
    if (tools) {
      assert.equal(knayi.fontDetect('က္က', 'unicode', toolsOptions), 'zawgyi');
    } else {
      assert.equal(knayi.fontDetect('က္က', 'unicode', toolsOptions), 'unicode');
      assert.ok(myanmarToolsWarnings.some(function (message) {
        return /myanmar-tools is not available/.test(String(message));
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
      detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95], zawgyiDetector: null }
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
    // myanmar-tools gives က္က a probability of about 0.93: Zawgyi above 0.9, and a rule-score tie. compat scores with
    // a stored detector of the package, which 2.x's main.js loads itself.
    const zawgyiDetector = new (require('myanmar-tools').ZawgyiDetector)();
    knayi.setGlobalOptions({ detector: { use_myanmartools: true, myanmartools_zg_threshold: [0.05, 0.9], zawgyiDetector } });
    assert.equal(knayi.fontDetect('က္က', 'unicode', null), 'zawgyi');
    knayi.setGlobalOptions(null);
    assert.equal(knayi.fontDetect('က္က', 'unicode', null), 'zawgyi');
    knayi.setGlobalOptions({ detector: null });
    assert.equal(knayi.fontDetect('က္က', 'unicode', null), 'zawgyi');
    knayi.setGlobalOptions({ detector: { use_myanmartools: false } });
    assert.equal(knayi.fontDetect('က္က', 'unicode', null), 'unicode');
  });
})

// detectEncoding returns the rule scorer's evidence, { encoding, unicode, zawgyi }, and fontDetect reads the same
// result through its fallback.
describe('detectEncoding', () => {
  const ZWSP = String.fromCharCode(0x200B);
  const result = (encoding, unicode, zawgyi) => ({ encoding, unicode, zawgyi });

  afterEach(() => {
    knayi.setGlobalOptions({
      silent_mode: false,
      detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
    });
  });

  it('counts the matches of each side\'s signatures', () => {
    assert.deepEqual(knayi.detectEncoding('မဂၤလာပါ'), result('zawgyi', 0, 1));
    assert.deepEqual(knayi.detectEncoding('မြန်မာ'), result('unicode', 2, 0));
    assert.deepEqual(knayi.detectEncoding('ကျ'), result('unicode', 1, 0));
    assert.deepEqual(knayi.detectEncoding('ျမန္မာ'), result('zawgyi', 0, 1));
  });

  it('reads the text as fontDetect does: trimmed, without zero-width spaces and non-joiners', () => {
    // Cleaned, the text starts with a consonant and medial ra, which a Unicode signature anchored at the start counts.
    assert.deepEqual(knayi.detectEncoding(' ' + ZWSP + 'မြန်မာ '), result('unicode', 2, 0));
    assert.deepEqual(knayi.detectEncoding(new String('ျမန္မာ')), result('zawgyi', 0, 1));
  });

  it('tells a tie apart from text with no Myanmar letters', () => {
    assert.deepEqual(knayi.detectEncoding('က'), result('unknown', 0, 0));
    assert.deepEqual(knayi.detectEncoding('ဗုဒ္ဓ'), result('unknown', 0, 0));
    assert.deepEqual(knayi.detectEncoding('ျမန္မာ မြန်မာ'), result('unknown', 1, 1));
    assert.deepEqual(knayi.detectEncoding('abc'), result('none', 0, 0));
    assert.deepEqual(knayi.detectEncoding('jrefrm'), result('none', 0, 0));
  });

  it('gives none for missing content, with a warning unless silent, and for other values', () => {
    const warnings = [];
    const warn = console.warn;
    console.warn = (message) => warnings.push(message);
    try {
      for (const missing of [undefined, null, '', 0, false, NaN]) {
        assert.deepEqual(knayi.detectEncoding(missing), result('none', 0, 0), inspect(missing));
      }
      for (const other of [123, true, {}, [], ['မြန်မာ']]) {
        assert.deepEqual(knayi.detectEncoding(other), result('none', 0, 0), inspect(other));
      }
      knayi.setGlobalOptions({ silent_mode: true });
      assert.deepEqual(knayi.detectEncoding(null), result('none', 0, 0));
    } finally {
      console.warn = warn;
    }
    assert.deepEqual(warnings, Array(6).fill('Content must be specified on knayi.detectEncoding.'));
  });

  it('scores with the rules whatever the detector settings, and reads one argument', () => {
    const texts = ['မဂၤလာပါ', 'မြန်မာ', 'က္က', 'abc'];
    const expected = texts.map((text) => knayi.detectEncoding(text));
    knayi.setGlobalOptions({ detector: { use_myanmartools: true, myanmartools_zg_threshold: [0.05, 0.9] } });
    assert.deepEqual(texts.map((text) => knayi.detectEncoding(text)), expected);
    assert.deepEqual(texts.map((text) => knayi.detectEncoding(text, 'unicode', { adapter: 'myanmartools' })), expected);
    assert.deepEqual(texts.map(knayi.detectEncoding), expected);
  });

  it('returns a new object from each call', () => {
    for (const text of ['abc', 'မြန်မာ']) {
      const first = knayi.detectEncoding(text);
      first.encoding = 'changed';
      first.unicode = -1;
      assert.notEqual(knayi.detectEncoding(text).encoding, 'changed');
      assert.notEqual(knayi.detectEncoding(text), knayi.detectEncoding(text));
    }
  });

  it('gives fontDetect\'s answer, read through the fallback', () => {
    const answer = (found, fallback) => (found.encoding === 'unicode' || found.encoding === 'zawgyi' ? found.encoding
      : fallback || (found.encoding === 'none' ? 'en' : 'zawgyi'));
    knayi.setGlobalOptions({ silent_mode: true });
    const texts = ['မဂၤလာပါ', 'မြန်မာ', 'က', 'ဗုဒ္ဓ', 'ျမန္မာ မြန်မာ', 'abc', '', null, 123, new String('ကျ')];
    for (const text of texts) {
      for (const fallback of [undefined, 'unicode', 'tie', 1, '']) {
        const given = typeof fallback === 'string' && fallback !== '' ? fallback : undefined;
        assert.equal(knayi.fontDetect(text, fallback, { adapter: 'rules' }), answer(knayi.detectEncoding(text), given),
          inspect([text, fallback]));
      }
    }
  });
});

after(function () {
  knayi.setGlobalOptions({
    silent_mode: false,
    detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
  });
});
