const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
// The 2.x API: compat, on the 3.0 core.
const knayi = require('../src/compat/index.js').default;
const { pendingPort } = require('../scripts/testing/pending-port');

const missing = [0, false, NaN];
const others = [123, true, {}, []];
const transforms = {
  fontConvert: (x) => knayi.fontConvert(x, 'unicode'),
  fontConvertFromWin: (x) => knayi.fontConvert(x, 'unicode', 'win'),
  syllBreak: (x) => knayi.syllBreak(x),
  spellingFix: (x) => knayi.spellingFix(x),
  normalize: (x) => knayi.normalize(x),
};

describe('non-string input', () => {
  let warnings;
  const warn = console.warn;

  before(() => {
    console.warn = (message) => { warnings.push(String(message)); };
  });

  after(() => {
    console.warn = warn;
  });

  it('treats 0, false, and NaN as missing content, as 2.8.3 did', () => {
    for (const x of missing) {
      for (const [name, call] of Object.entries(transforms)) {
        warnings = [];
        assert.equal(call(x), '', name + '(' + String(x) + ')');
        assert.equal(warnings.length, 1, name + '(' + String(x) + ') warns');
      }
      warnings = [];
      assert.equal(knayi.fontDetect(x), 'en');
      assert.equal(knayi.truncate(x), '');
      assert.equal(warnings.length, 2);
    }
  });

  it('returns other values unchanged and never throws', () => {
    for (const x of others) {
      for (const [name, call] of Object.entries(transforms)) {
        assert.equal(call(x), x, name + '(' + JSON.stringify(x) + ')');
      }
      assert.equal(knayi.fontDetect(x), 'en');
    }
  });

  it('truncates other values as strings, like lodash.truncate', () => {
    assert.equal(knayi.truncate(123), '123...');
    assert.equal(knayi.truncate(true), 'true...');
  });

  it('keeps an empty string distinct for truncate', () => {
    assert.equal(knayi.truncate(''), '...');
  });

  it('treats String objects as strings', () => {
    const text = new String('ျမန္မာ');
    assert.equal(knayi.fontDetect(text), 'zawgyi');
    assert.equal(knayi.fontConvert(text, 'unicode'), 'မြန်မာ');
    assert.equal(knayi.fontConvert(new String('jrefrm'), 'unicode', 'win'), 'မြန်မာ');
    assert.equal(knayi.syllBreak(new String('မြန်မာ'), 'unicode', '|'), 'မြန်|မာ');
    assert.equal(knayi.spellingFix(new String('ကာာ'), 'unicode'), 'ကာ');
    assert.equal(knayi.normalize(new String('မိြုင်')), 'မြိုင်');
    assert.equal(knayi.truncate(new String('မြန်မာ')), 'မြန်မာ...');
  });
});

// Array#map calls a function with the line, its index and the array. index.d.ts types fontDetect, detectEncoding,
// spellingFix, truncate and normalize as map callbacks (typecheck/map-callbacks.ts), because each reads that index
// and array as setting nothing: every line gives what the function gives the line alone, with the same console
// output. syllBreak and fontConvert read them, and their types refuse map.
describe('Array#map callbacks', () => {
  const lines = ['မြန်မာ', 'ျမန္မာ', 'က', ' ကာာ ', 'ကဳဳ', '၂ဝ၁၉', 'jrefrm', 'abc', '', null, 5];

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

  afterEach(() => {
    knayi.setGlobalOptions({ silent_mode: false });
  });

  // Each waits for the 2.x change that makes it read map's index and array as setting nothing
  // (scripts/testing/pending-port.js).
  const PENDING = { fontDetect: '86f0040', detectEncoding: '31eb6b1', spellingFix: '24f81c6' };
  for (const name of ['fontDetect', 'detectEncoding', 'spellingFix', 'truncate', 'normalize']) {
    const test = () => {
      for (const silent of [false, true]) {
        knayi.setGlobalOptions({ silent_mode: silent });
        const mapped = capture(() => lines.map(knayi[name]));
        const alone = capture(() => lines.map((line) => knayi[name](line)));
        assert.deepEqual(mapped, alone, 'silent_mode: ' + silent);
        if (!silent) assert.ok(alone.messages.length > 0, 'the missing lines warn');
      }
    };
    it('gives each line of lines.map(' + name + ') what ' + name + '(line) gives',
      PENDING[name] ? pendingPort(PENDING[name], test) : test);
  }

  it('changes what syllBreak and fontConvert give', pendingPort('24f81c6', () => {
    knayi.setGlobalOptions({ silent_mode: true });
    const two = ['မြန်မာ', 'ျမန္မာ'];
    // The array is syllBreak's break point.
    assert.deepEqual(two.map(knayi.syllBreak), ['မြန်မြန်မာ,ျမန္မာမာ', 'ျမန္မြန်မာ,ျမန္မာမာ']);
    // The index is fontConvert's target, which is no font, so nothing is converted.
    assert.deepEqual(two.map(knayi.fontConvert), two);
  }));
});
