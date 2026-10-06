const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const knayi = require('../main');

// Win strings are written by hand from the font's glyphs, in the order Win text is typed.
const toUnicode = (win) => knayi.fontConvert(win, 'unicode', 'win');

describe('Win', () => {
  describe('Win to Unicode', () => {
    it('converts letters, vowels and asat', () => {
      assert.equal(toUnicode('jrefrm'), 'မြန်မာ');
      assert.equal(toUnicode('vkHjckH'), 'လုံခြုံ');
      assert.equal(toUnicode('usm;'), 'ကျား');
      assert.equal(toUnicode('rIef'), 'မှုန်');
      assert.equal(toUnicode('vQyfppf'), 'လျှပ်စစ်');
      assert.equal(toUnicode('a&GS'), 'ရွှေ');
      assert.equal(toUnicode('vufatmufrS'), 'လက်အောက်မှ');
    });

    it('moves e and medial ra, typed before the consonant, after it', () => {
      assert.equal(toUnicode('ajumifh'), 'ကြောင့်');
      assert.equal(toUnicode('oDv'), 'သီလ');
    });

    it('moves kinzi, typed after the consonant, before it', () => {
      assert.equal(toUnicode('t*Fvdyf'), 'အင်္ဂလိပ်');
    });

    it('reads stacked consonants and ligatures', () => {
      assert.equal(toUnicode("Ak'¨"), 'ဗုဒ္ဓ');
      assert.equal(toUnicode('ypönf;'), 'ပစ္စည်း');
      assert.equal(toUnicode('arwÅm'), 'မေတ္တာ');
      assert.equal(toUnicode('odu©m'), 'သိက္ခာ');
      assert.equal(toUnicode('ÚmPf'), 'ဉာဏ်');
      assert.equal(toUnicode('ÓPf'), 'ဉာဏ်');
    });

    it('reads letters Win types as look-alike sequences', () => {
      assert.equal(toUnicode('ZvGefaps;'), 'ဇလွန်ဈေး');
      assert.equal(toUnicode('¤if;'), '၎င်း');
      assert.equal(toUnicode('aMomf'), 'ဪ');
      assert.equal(toUnicode('Mo*kwf'), 'ဩဂုတ်');
      assert.equal(toUnicode('OD;'), 'ဦး');
    });

    it('puts the mark of a medial ra drawn with wa or u after the consonant', () => {
      assert.equal(toUnicode('<u'), 'ကြွ');
      assert.equal(toUnicode('~uG'), 'ကြွ');
      assert.equal(toUnicode('>ywf'), 'ပြွတ်');
      assert.equal(toUnicode('êu'), 'ကြု');
    });

    it('reads zero as wa unless it is part of a number', () => {
      assert.equal(toUnicode('0if;'), 'ဝင်း');
      assert.equal(toUnicode('1000'), '၁၀၀၀');
      assert.equal(toUnicode('5.0'), '၅.၀');
    });

    it('reads seven with a vowel sign or medial as ra', () => {
      assert.equal(toUnicode('a7;'), 'ရေး');
      assert.equal(toUnicode('7;30'), '၇း၃၀');
    });

    it('reads the digit four after ra as lagaung, as normalize does', () => {
      // The typos come before the look-alikes, in both pipelines (ARCHITECTURE.md, Typing fixes and their order):
      // once the four is lagaung, the ra is next to no digit and stays ra.
      assert.equal(toUnicode('&4if;'), 'ရ၎င်း');
      assert.equal(knayi.normalize('ရ၄င်း'), 'ရ၎င်း');
      assert.deepEqual(knayi.fontConvert.debugging('&4if;', 'unicode', 'win').matched_patterns, ['glyphs', 'typos']);
    });

    it('returns marks in Unicode order, dot below before asat', () => {
      // Win types asat (f) before the dot below (h).
      assert.equal(toUnicode('ajumifh'), '\u1000\u103C\u1031\u102C\u1004\u1037\u103A');
    });

    it('stores asat where Unicode Technical Note #11 puts it', () => {
      // On the consonant: right after it, before the medials and vowels.
      assert.equal(toUnicode('a,musfm;'), 'ယောက်ျား');
      assert.equal(toUnicode('a,mufsm;'), 'ယောက်ျား');
      assert.equal(toUnicode('usGefkyf'), 'ကျွန်ုပ်');
      assert.equal(toUnicode('usGekfyf'), 'ကျွန်ုပ်');
      assert.equal(toUnicode('csf'), 'ခ်ျ');
      // Last: after aa, even typed before it without a medial, and after a visarga typed first.
      assert.equal(toUnicode('ausmf'), 'ကျော်');
      assert.equal(toUnicode('aufm'), 'ကော်');
      assert.equal(toUnicode('vn;f'), 'လည်း');
    });

    it('builds each syllable in Unicode order', () => {
      assert.equal(toUnicode('oabFm'), 'သင်္ဘော');
      assert.equal(toUnicode('urÇm'), 'ကမ္ဘာ');
      assert.equal(toUnicode('ukk'), 'ကု');
    });
    it('accepts text read as Windows-1252 or as ISO-8859-1', () => {
      // Byte 0x92 (stacked la) is U+2019 in Windows-1252 and U+0092 in ISO-8859-1.
      const la = 'oy' + String.fromCharCode(0x2019);
      assert.equal(toUnicode(la), 'သပ္လ');
      assert.equal(toUnicode('oy' + String.fromCharCode(0x92)), 'သပ္လ');
    });

    it('converts fractions and moved punctuation', () => {
      assert.equal(toUnicode('ƒ'), '၁/၂');
      assert.equal(toUnicode('[kwfvm;µ'), 'ဟုတ်လား!');
      assert.equal(toUnicode('a&ç rD;¿'), 'ရေ, မီး?');
    });

    it('needs the source font named, because Win text is plain ASCII', () => {
      assert.equal(knayi.fontConvert('jrefrm', 'unicode'), 'jrefrm');
      assert.equal(knayi.fontConvert('jrefrm', 'unicode', 'unicode'), 'jrefrm');
    });

    it('converts Win only to Unicode', () => {
      knayi.setGlobalOptions({ silent_mode: true });
      try {
        assert.equal(knayi.fontConvert('jrefrm', 'zawgyi', 'win'), 'jrefrm');
        assert.equal(knayi.fontConvert('မြန်မာ', 'win', 'unicode'), 'မြန်မာ');
        assert.equal(knayi.fontConvert('မြန်မာ', 'win'), 'မြန်မာ');
      } finally {
        knayi.setGlobalOptions({ silent_mode: false });
      }
    });
  });

  describe('debugging', () => {
    it('ends with the converted text', () => {
      const fromWin = knayi.fontConvert.debugging('ajumifh', 'unicode', 'win');
      assert.equal(fromWin.from, 'win');
      assert.equal(fromWin.steps[0], 'ajumifh');
      assert.equal(fromWin.steps[fromWin.steps.length - 1], toUnicode('ajumifh'));
      assert.equal(fromWin.matched_patterns.length, fromWin.steps.length - 1);
    });
  });
});
