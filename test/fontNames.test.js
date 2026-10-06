const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const knayi = require('../main');

// Font names (README, "Font names"). A name is a string other than '': 'unicode', 'zawgyi', their aliases 'uni'
// and 'zaw', and 'win', in any case. A font that is not a string, or '', means "detect the font". syllBreak and
// truncate break Unicode and Zawgyi text only, so they throw a TypeError with the code ERR_KNAYI_INVALID_FONT for
// 'win' and for unknown names; spellingFix uses the Unicode marks for them; fontConvert detects an unknown source
// and warns.

const UNICODE = 'မြန်မာ';
const ZAWGYI = 'ျမန္မာ';
// U+0130, capital I with a dot, lowercases to i and a combining dot above: not a letter of 'unicode'.
const DOTTED_UNICODE = 'UN' + String.fromCharCode(0x130) + 'CODE';
const UNKNOWN = ['foo', 'zg', ' unicode', DOTTED_UNICODE, 'constructor', '__proto__', 'toString', 'valueOf',
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

  // Names are case-insensitive. Only the ASCII letters of a name fold: no other character lowercases to one of its
  // letters (DOTTED_UNICODE, in UNKNOWN, stays unknown).
  describe('letter case', () => {
    const UNICODE_NAMES = ['Unicode', 'UNICODE', 'uNiCoDe', 'Uni', 'UNI', new String('UNICODE')];
    const ZAWGYI_NAMES = ['Zawgyi', 'ZAWGYI', 'zAwGyI', 'Zaw', 'ZAW', new String('Zawgyi')];
    const WIN_NAMES = ['Win', 'WIN', 'wIN', new String('WIN')];

    it('syllBreak and truncate take the names of Unicode and Zawgyi in any case', () => {
      // Unicode reads U+1039 as a virama, so 'က္က' is one syllable; Zawgyi reads it as an asat, which ends one.
      for (const name of UNICODE_NAMES) {
        assert.equal(knayi.syllBreak('က္က', name, '|'), 'က္က', String(name));
        assert.equal(knayi.truncate('က္က', { fontType: name, length: 5 }), '...', String(name));
      }
      for (const name of ZAWGYI_NAMES) {
        assert.equal(knayi.syllBreak('က္က', name, '|'), 'က္|က', String(name));
        assert.equal(knayi.truncate('က္က', { fontType: name, length: 5 }), 'က္...', String(name));
      }
    });

    it('syllBreak and truncate throw for win in any case, and name it as given', () => {
      for (const name of WIN_NAMES) {
        assert.throws(() => knayi.syllBreak(UNICODE, name, '|'), invalidFont(String(name), 'syllBreak'), String(name));
        assert.throws(() => knayi.truncate(UNICODE, { fontType: name }), invalidFont(String(name), 'truncate'),
          String(name));
      }
    });

    it('spellingFix collapses the Zawgyi marks for the names of Zawgyi in any case, and the Unicode marks else', () => {
      for (const name of ZAWGYI_NAMES) {
        assert.equal(knayi.spellingFix('ကဳဳ', name), 'ကဳ', String(name));
      }
      for (const name of UNICODE_NAMES.concat(WIN_NAMES)) {
        assert.equal(knayi.spellingFix('ကဳဳ', name), 'ကဳဳ', String(name));
        assert.equal(knayi.spellingFix('ကာာ', name), 'ကာ', String(name));
      }
    });

    it('fontConvert takes source and target names in any case, without a warning', () => {
      for (const zawgyi of ZAWGYI_NAMES) {
        for (const unicode of UNICODE_NAMES) {
          const label = String(zawgyi) + ' ' + String(unicode);
          assert.deepEqual(capture(() => knayi.fontConvert(ZAWGYI, unicode, zawgyi)), { value: UNICODE, messages: [] },
            label);
          assert.deepEqual(capture(() => knayi.fontConvert(UNICODE, zawgyi, unicode)), { value: ZAWGYI, messages: [] },
            label);
        }
      }
      const debug = capture(() => knayi.fontConvert.debugging(ZAWGYI, 'UNICODE', 'Zawgyi'));
      assert.deepEqual([debug.value.to, debug.value.from, debug.messages], ['unicode', 'zawgyi', []]);
    });

    it('fontConvert reads Win text from win in any case, and writes none', () => {
      for (const name of WIN_NAMES) {
        // Win text has no Myanmar letters; a Win source is converted all the same.
        assert.deepEqual(capture(() => knayi.fontConvert('jrefrm', 'Unicode', name)), { value: UNICODE, messages: [] },
          String(name));
        assert.deepEqual(capture(() => knayi.fontConvert(UNICODE, name, 'unicode')),
          { value: UNICODE, messages: ['error: knayi.fontConvert converts Win text to Unicode only.'] }, String(name));
      }
    });

    it('fontDetect returns its fallback as given: a value to return, not a font name it reads', () => {
      assert.equal(knayi.fontDetect('abc', 'Unicode'), 'Unicode');
      assert.equal(knayi.fontDetect('ဗုဒ္ဓ', 'ZAWGYI'), 'ZAWGYI');
    });
  });
});
