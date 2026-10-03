const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const knayi = require('../main');

// Font names (README, "Font names"). A name is a string other than '': 'unicode', 'zawgyi', their aliases 'uni'
// and 'zaw', and 'win'. A font that is not a string, or '', means "detect the font". syllBreak and truncate break
// Unicode and Zawgyi text only, so they throw a TypeError with the code ERR_KNAYI_INVALID_FONT for 'win' and for
// unknown names; spellingFix uses the Unicode marks for them; fontConvert detects an unknown source and warns.

const UNICODE = 'မြန်မာ';
const ZAWGYI = 'ျမန္မာ';
const UNKNOWN = ['foo', 'Unicode', 'ZAWGYI', ' unicode', 'constructor', '__proto__', 'toString', 'valueOf',
  'hasOwnProperty'];
const NOT_NAMES = [undefined, null, '', 0, 1, NaN, true, false, {}, []];

// Runs fn with console.warn and console.error recorded instead of printed.
function capture(fn) {
  const messages = [];
  const warn = console.warn;
  const error = console.error;
  console.warn = (...args) => messages.push('warn: ' + args.join(' '));
  console.error = (...args) => messages.push('error: ' + args.join(' '));
  try {
    return { value: fn(), messages: messages };
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

// The error syllBreak and truncate throw for a font they do not break. Callers test the code; the message is
// pinned here and in the contract matrix so that a change to it is seen.
function invalidFont(name, api) {
  return {
    name: 'TypeError',
    code: 'ERR_KNAYI_INVALID_FONT',
    message: 'knayi.' + api + " takes the font 'unicode' or 'zawgyi', not " + JSON.stringify(name) + '.'
  };
}

afterEach(() => {
  knayi.setGlobalOptions({
    silent_mode: false,
    detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
  });
});

describe('font names', () => {
  describe('syllBreak and truncate', () => {
    it('throw a TypeError with a code for win', () => {
      assert.throws(() => knayi.syllBreak(UNICODE, 'win', '|'), invalidFont('win', 'syllBreak'));
      assert.throws(() => knayi.syllBreak('jrefrm' + UNICODE, 'win'), invalidFont('win', 'syllBreak'));
      assert.throws(() => knayi.truncate(UNICODE, { fontType: 'win' }), invalidFont('win', 'truncate'));
    });

    it('throw a TypeError with a code for an unknown name, names of Object.prototype included', () => {
      for (const name of UNKNOWN) {
        assert.throws(() => knayi.syllBreak(UNICODE, name, '|'), invalidFont(name, 'syllBreak'), name);
        assert.throws(() => knayi.truncate(UNICODE, { fontType: name }), invalidFont(name, 'truncate'), name);
      }
    });

    it('throw in silent mode too', () => {
      knayi.setGlobalOptions({ silent_mode: true });
      assert.throws(() => knayi.syllBreak(UNICODE, 'win'), invalidFont('win', 'syllBreak'));
      assert.throws(() => knayi.truncate(UNICODE, { fontType: 'foo' }), invalidFont('foo', 'truncate'));
    });

    it('throw only for text they would break', () => {
      knayi.setGlobalOptions({ silent_mode: true });
      assert.equal(knayi.syllBreak('jrefrm', 'win'), 'jrefrm');
      assert.equal(knayi.syllBreak(null, 'foo'), '');
      assert.equal(knayi.syllBreak(123, 'foo'), 123);
      assert.equal(knayi.truncate('jrefrm', { fontType: 'win' }), 'jrefrm...');
      assert.equal(knayi.truncate('', { fontType: 'foo' }), '...');
      assert.equal(knayi.truncate(null, { fontType: 'foo' }), '');
    });

    it('detect the font when it is not a string, or is empty', () => {
      for (const font of NOT_NAMES) {
        assert.equal(knayi.syllBreak(UNICODE, font, '|'), 'မြန်|မာ', String(font));
        assert.equal(knayi.syllBreak(ZAWGYI, font, '|'), 'ျမန္|မာ', String(font));
        assert.equal(knayi.truncate(UNICODE, { fontType: font }), UNICODE + '...', String(font));
      }
    });

    it('take the names and aliases of Unicode and Zawgyi, and String objects that hold them', () => {
      assert.equal(knayi.syllBreak('က္က', 'unicode', '|'), 'က္က');
      assert.equal(knayi.syllBreak('က္က', 'uni', '|'), 'က္က');
      assert.equal(knayi.syllBreak('က္က', new String('uni'), '|'), 'က္က');
      assert.equal(knayi.syllBreak('က္က', 'zawgyi', '|'), 'က္|က');
      assert.equal(knayi.syllBreak('က္က', 'zaw', '|'), 'က္|က');
      assert.equal(knayi.syllBreak('က္က', new String('zawgyi'), '|'), 'က္|က');
      assert.equal(knayi.truncate('က္က', { fontType: 'zaw', length: 5 }), 'က္...');
    });

    it('work as Array#map callbacks, where the index arrives as the font', () => {
      assert.deepEqual([UNICODE, ZAWGYI].map((text, i) => knayi.syllBreak(text, i, '|')), ['မြန်|မာ', 'ျမန္|မာ']);
      assert.deepEqual([UNICODE, ZAWGYI].map(knayi.truncate), [UNICODE + '...', ZAWGYI + '...']);
    });
  });

  describe('spellingFix', () => {
    it('collapses the Unicode marks for win and unknown names, names of Object.prototype included', () => {
      for (const name of ['win'].concat(UNKNOWN)) {
        assert.equal(knayi.spellingFix('ကာာ', name), 'ကာ', name);
        // U+1033 is a Zawgyi mark, which the Unicode list leaves alone.
        assert.equal(knayi.spellingFix('ကဳဳ', name), 'ကဳဳ', name);
      }
    });

    it('detects the font when it is not a string, or is empty', () => {
      for (const font of NOT_NAMES) {
        // fontDetect reads U+1000 U+1033 U+1033 as Zawgyi, so the Zawgyi marks collapse.
        assert.equal(knayi.spellingFix('ကဳဳ', font), 'ကဳ', String(font));
      }
    });
  });

  describe('fontConvert', () => {
    it('detects an unknown source font, and warns', () => {
      for (const name of UNKNOWN) {
        const run = capture(() => knayi.fontConvert(ZAWGYI, 'unicode', name));
        assert.equal(run.value, UNICODE, name);
        assert.deepEqual(run.messages, ['warn: Unknown source font ' + JSON.stringify(name) +
          ' on knayi.fontConvert; detecting it.'], name);
      }
      const debug = capture(() => knayi.fontConvert.debugging(ZAWGYI, 'unicode', 'foo'));
      assert.equal(debug.value.from, 'zawgyi');
      assert.equal(debug.messages.length, 1);
    });

    it('does not warn in silent mode', () => {
      knayi.setGlobalOptions({ silent_mode: true });
      const run = capture(() => knayi.fontConvert(ZAWGYI, 'unicode', 'foo'));
      assert.deepEqual(run, { value: UNICODE, messages: [] });
    });

    it('detects a source that is not a string, or is empty, without a warning', () => {
      for (const font of NOT_NAMES) {
        assert.deepEqual(capture(() => knayi.fontConvert(ZAWGYI, 'unicode', font)), { value: UNICODE, messages: [] },
          String(font));
      }
    });

    it('warns only when it converts', () => {
      assert.deepEqual(capture(() => knayi.fontConvert('abc', 'unicode', 'foo')), { value: 'abc', messages: [] });
      assert.deepEqual(capture(() => knayi.fontConvert(ZAWGYI, 'foo', 'bar')),
        { value: ZAWGYI, messages: ["error: Convert library doesn't have this fontType."] });
    });
  });
});
