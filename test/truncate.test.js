const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
// The 2.x API: compat, on the 3.0 core.
var knayi = require('../src/compat/index.js').default;
var pangram = 'အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။';

describe('truncate', () => {
  it('matches the pangram cut of MIGRATION.md', () => {
    assert.equal(
      knayi.truncate(pangram, { length: 30, omission: '...' }),
      'အာယုဝဍ်ဎနဆေးညွှန်းစာကို...'
    );
    assert.equal(knayi.truncate(pangram, { length: 35 }), 'အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေး...');
  })

  // 2.10 went on after the first syllable that did not fit, and added the later ones that did: at 30, it left out
  // ဇလွန်, which did not fit, and kept ဈေး after it, 'အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဈေး...' (refactor plan, section 7
  // item 5).
  it('returns a start of the text at every length', () => {
    for (let length = 1; length <= pangram.length + 4; length++) {
      const result = knayi.truncate(pangram, { length: length });
      assert.ok(result.endsWith('...'), String(length));
      assert.ok(pangram.startsWith(result.slice(0, -3)), length + ': ' + result);
      assert.ok(result.length <= Math.max(length, 3), length + ': ' + result);
    }
  })

  // Of the first syllable that does not fit, the words that fit with the whitespace after them are kept, and the
  // whitespace stays as typed: 2.10 wrote a space for it.
  it('cuts the syllable that does not fit after whitespace, as typed', () => {
    assert.equal(knayi.truncate('ရန်ကုန်\tမြို့ နယ်', { length: 17 }), 'ရန်ကုန်\tမြို့...');
    assert.equal(knayi.truncate('ရန်ကုန်\nမြို့ နယ်', { length: 17 }), 'ရန်ကုန်\nမြို့...');
    assert.equal(knayi.truncate('ရန်ကုန်\tမြို့ နယ်', { length: 16 }), 'ရန်ကုန်...');
    assert.equal(knayi.truncate('ကကကကကကကကကက ခ', { length: 8 }), 'ကကကက...');
  })

  // truncate breaks only the start of the text (syllable.breakStart), up to the first whitespace at an index above
  // length minus the omission's length, but the switch of the Zawgyi kinzi rule reads the whole text: S'gaw Karen ၢ်
  // (U+1062 U+103A) at the end turns the rule off, so ပိ and ဂၤ are two syllables, as syllBreak breaks them.
  it('breaks the start of the text as the whole text breaks', () => {
    const word = '\u1015\u102d\u1002\u1064\u101c\u102c';
    const text = word + ' ' + '\u1000\u1000 '.repeat(20);
    const karen = text + '\u1062\u103a';
    assert.equal(knayi.syllBreak(karen, 'zawgyi', '|').slice(0, 9), '\u1015\u102d|\u1002\u1064|\u101c\u102c ');
    assert.equal(knayi.truncate(karen, { fontType: 'zawgyi', length: 3, omission: '\u2026' }), '\u1015\u102d\u2026');
    assert.equal(knayi.truncate(text, { fontType: 'zawgyi', length: 3, omission: '\u2026' }), '\u2026');
    assert.equal(knayi.truncate(text, { fontType: 'zawgyi', length: 5, omission: '\u2026' }), word.slice(0, 4) + '\u2026');
  })

  it('still appends the omission when the text is shorter than length', () => {
    assert.equal(knayi.truncate('က'), 'က...');
  })

  it('appends the omission to empty and non-Myanmar text', () => {
    assert.equal(knayi.truncate(''), '...');
    assert.equal(knayi.truncate('hi'), 'hi...');
  })

  it('returns empty when content is null', () => {
    assert.equal(knayi.truncate(null), '');
  })
})

after(function () {
  knayi.setGlobalOptions({
    silent_mode: false,
    detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
  });
});
