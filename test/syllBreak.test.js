const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
// The 2.x API: compat, on the 3.0 core.
var knayi = require('../src/compat/index.js').default;
const fc = require('fast-check');
const arb = require('../scripts/testing/arbitraries');
const { check } = require('../scripts/testing/fuzz-settings');

describe('syllBreak',()=>{
  describe('syllBreak Unicode',()=>{
    it('should syllBreak for unicode',()=>{
      assert.equal(knayi.syllBreak('မင်္ဂလာပါ', null, '**'), 'မင်္ဂလာ**ပါ');
    })

    it('keeps a virama stack together when the font is unicode', () => {
      assert.equal(knayi.syllBreak('က္က', 'unicode', '|'), 'က္က');
    })

    it('keeps a consonant with dot below and asat in the syllable before it', () => {
      assert.equal(knayi.syllBreak('ဖြင့်', 'unicode', '|'), 'ဖြင့်');
      assert.equal(knayi.syllBreak('ကြောင့်', 'unicode', '|'), 'ကြောင့်');
      assert.equal(knayi.syllBreak('ထို့ကြောင့်', 'unicode', '|'), 'ထို့|ကြောင့်');
      assert.equal(knayi.syllBreak('ကြည့်ရှု', 'unicode', '|'), 'ကြည့်|ရှု');
    })

    it('reads asat typed before the dot below the same way', () => {
      assert.equal(knayi.syllBreak('\u1016\u103c\u1004\u103a\u1037', 'unicode', '|'), '\u1016\u103c\u1004\u1037\u103a');
    })

    it('keeps ဥ with asat, typed for ဉ, in the syllable before it', () => {
      assert.equal(knayi.syllBreak('ညဥ့်', 'unicode', '|'), 'ညဥ့်');
      assert.equal(knayi.syllBreak('ညဉ့်', 'unicode', '|'), 'ညဉ့်');
      assert.equal(knayi.syllBreak('ရှဥ့်', 'unicode', '|'), 'ရှဥ့်');
    })

    it("starts a syllable with ဥ and asat after a vowel sign, as in Pa'o", () => {
      assert.equal(knayi.syllBreak('ထွူလဲဥ်း', 'unicode', '|'), 'ထွူ|လဲ|ဥ်း');
    })

    it('keeps a consonant with asat whole when a visarga or a second dot below was typed before the asat', () => {
      assert.equal(knayi.syllBreak('ခြငး်', 'unicode', '|'), 'ခြငး်');
      assert.equal(knayi.syllBreak('ဖြင့့်', 'unicode', '|'), 'ဖြင့့်');
    })

    it('breaks these words where the zawgyi table does', () => {
      for (const word of ['ဖြင့်', 'ကြောင့်', 'နှင့်', 'ထို့ကြောင့်', 'ကြည့်ရှု']) {
        const pieces = knayi.syllBreak(word, 'unicode', '|').split('|').map((piece) => knayi.fontConvert(piece, 'zawgyi', 'unicode'));
        assert.equal(knayi.syllBreak(knayi.fontConvert(word, 'zawgyi', 'unicode'), 'zawgyi', '|'), pieces.join('|'));
      }
    })

    it('splits a virama stack on the zawgyi table', () => {
      assert.equal(knayi.syllBreak('က္က', 'zawgyi', '|'), 'က္|က');
    })
  })

  describe('syllBreak Zawgyi', () => {
    // Zawgyi types ေ and the medial ra before the consonant, so ၾက is a whole syllable, like ကြ in Unicode.
    it('ends a syllable after a consonant typed with ေ or a medial ra', () => {
      assert.equal(knayi.syllBreak('ၾကပါ', 'zawgyi', '|'), 'ၾက|ပါ'); // ကြ|ပါ
      assert.equal(knayi.syllBreak('ေသခ်ာ', 'zawgyi', '|'), 'ေသ|ခ်ာ'); // သေ|ချာ
      assert.equal(knayi.syllBreak('ေၾကညာ', 'zawgyi', '|'), 'ေၾက|ညာ'); // ကြေ|ညာ
      assert.equal(knayi.syllBreak('ေဆာင္ရြက္ေနၾကပါသည္', 'zawgyi', '|'), 'ေဆာင္|ရြက္|ေန|ၾက|ပါ|သည္'); // ဆောင်|ရွက်|နေ|ကြ|ပါ|သည်
    })

    it('treats every medial ra form the same way', () => {
      for (const ra of ['\u103b', '\u107e', '\u107f', '\u1080', '\u1081', '\u1082', '\u1083', '\u1084']) {
        assert.equal(knayi.syllBreak(ra + '\u1000\u1015\u102b', 'zawgyi', '|'), ra + '\u1000|\u1015\u102b');
      }
    })

    it('still joins a bare consonant to the next letter, as in Unicode', () => {
      assert.equal(knayi.syllBreak('ကက', 'zawgyi', '|'), 'ကက'); // ကက
      assert.equal(knayi.syllBreak('ကေလး', 'zawgyi', '|'), 'ကေလး'); // ကလေး
      assert.equal(knayi.syllBreak('ကၾကပါ', 'zawgyi', '|'), 'ကၾက|ပါ'); // ကကြ|ပါ
    })

    it('keeps a consonant with asat in the syllable before it, also after a dot below', () => {
      assert.equal(knayi.syllBreak('ျဖင့္', 'zawgyi', '|'), 'ျဖင့္'); // ဖြင့်
      assert.equal(knayi.syllBreak('ေၾကာင့္', 'zawgyi', '|'), 'ေၾကာင့္'); // ကြောင့်
      assert.equal(knayi.syllBreak('ႏွင့္', 'zawgyi', '|'), 'ႏွင့္'); // နှင့်
      for (const dot of ['\u1037', '\u1094', '\u1095']) {
        assert.equal(knayi.syllBreak('\u103b\u1016\u1004' + dot + '\u1039', 'zawgyi', '|'), '\u103b\u1016\u1004' + dot + '\u1039');
      }
    })

    it('keeps a consonant carrying kinzi in the syllable before it', () => {
      assert.equal(knayi.syllBreak('ျခေသၤ့', 'zawgyi', '|'), 'ျခေသၤ့'); // ခြင်္သေ့
      assert.equal(knayi.syllBreak('ေရာမလကၤာ', 'zawgyi', '|'), 'ေရာ|မလကၤာ'); // ရော|မလင်္ကာ
    })

    it('keeps a consonant with asat whole when a visarga or a second dot below was typed before the asat', () => {
      assert.equal(knayi.syllBreak('ျခငး္', 'zawgyi', '|'), 'ျခငး္');
      assert.equal(knayi.syllBreak('ျဖင့့္', 'zawgyi', '|'), 'ျဖင့့္');
    })

    it("leaves S'gaw Karen text detected as Zawgyi alone: its U+1064 is a tone mark, not kinzi", () => {
      assert.equal(knayi.fontDetect('တၢ်မၤလိ'), 'zawgyi');
      assert.equal(knayi.syllBreak('တၢ်မၤလိ', null, '|'), 'တၢ်|မၤ|လိ');
    })
  })

  describe('font aliases', () => {
    it('accepts uni as unicode', () => {
      assert.equal(knayi.syllBreak('က', 'uni'), 'က');
      assert.equal(knayi.syllBreak('က္က', 'uni', '|'), 'က္က');
    })
  })

  describe('detected font', () => {
    it('keeps a virama stack together when detection runs', () => {
      assert.equal(knayi.syllBreak('ရန်ကုန်တက္ကသိုလ်', null, '|'), 'ရန်|ကုန်|တက္ကသိုလ်');
    })
  })

  // For the default breakpoint, 2.x returns the text the break rules mark with U+200B, without splitting it into
  // parts and joining them (breakText of 2.x's syllableRules.js), and compat writes the breaks itself (breakString of
  // src/rules/segment.js). A String object holding U+200B is not the default breakpoint, so it takes the split and
  // join, and must give the same text.
  describe('the default breakpoint', () => {
    it('gives what joining the parts with U+200B gives', () => {
      const joined = new String('\u200B');
      const text = fc.oneof(arb.unicodeText(24), arb.zawgyiText(24), arb.burmeseText,
        arb.codeUnits.filter((s) => s !== ''));
      const font = fc.constantFrom('unicode', 'zawgyi', undefined);
      check(fc.property(text, font, (content, fontType) => {
        const expected = knayi.syllBreak(content, fontType, joined);
        for (const breakpoint of [undefined, null, '', 0, '\u200B']) {
          assert.equal(knayi.syllBreak(content, fontType, breakpoint), expected);
        }
      }), 10000, [['\u200C\u1000\u200C\u1000\u1031\u1001', 'unicode'], ['\u200B\u1031\u1000 \u200C\u1001', 'zawgyi']]);
    })
  })
})

after(function () {
  knayi.setGlobalOptions({
    silent_mode: false,
    detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
  });
});
