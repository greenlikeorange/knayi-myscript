const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const knayi = require('../main');

// Zawgyi strings are written in the order Zawgyi text is typed. Most come from real web text.
const toUnicode = (zawgyi) => knayi.fontConvert(zawgyi, 'unicode', 'zawgyi');
const ZWSP = '\u200B';

describe('Zawgyi', () => {
  describe('Zawgyi to Unicode', () => {
    it('moves e and medial ra, typed before the consonant, after it', () => {
      assert.equal(toUnicode('ေရးျမန္'), 'ရေးမြန်');
      assert.equal(toUnicode('ႀကီး'), 'ကြီး');
      assert.equal(toUnicode('ေရြႊ'), 'ရွှေ');
    });

    it('moves kinzi, typed after the consonant, before it', () => {
      assert.equal(toUnicode('သေဘၤာ'), 'သင်္ဘော');
      assert.equal(toUnicode('သခ်ၤာ'), 'သင်္ချာ');
      assert.equal(toUnicode('ေယာကၤ်ား'), 'ယောင်္ကျား');
      assert.equal(toUnicode('သခ်ႋဳင္း'), 'သင်္ချိုင်း');
    });

    it('reads stacked consonants, including stacked ta with wa', () => {
      assert.equal(toUnicode('ဗုဒၶ'), 'ဗုဒ္ဓ');
      assert.equal(toUnicode('ပန႖'), 'ပန္တွ');
      assert.equal(toUnicode('အိျႏၵာ'), 'အိန္ဒြာ');
    });

    it('writes each syllable in Unicode order', () => {
      assert.equal(toUnicode('ေကာငး္'), 'ကောင်း');
      assert.equal(toUnicode('ဖြ့ံ'), 'ဖွံ့');
      assert.equal(toUnicode('ေပ့ါ'), 'ပေါ့');
    });

    it('counts a mark typed twice once', () => {
      assert.equal(toUnicode('အမႈုိက္'), 'အမှိုက်');
      assert.equal(toUnicode('ဒီျမိဳ႔ဳ'), 'ဒီမြို့');
    });
  });

  describe('asat', () => {
    it('stores an asat on a consonant right after it, as Unicode Technical Note #11 does', () => {
      assert.equal(toUnicode('ေယာက္်ား'), 'ယောက်ျား');
      assert.equal(toUnicode('ေယာက်္ား'), 'ယောက်ျား');
      assert.equal(toUnicode('ကၽြႏ္ုပ္'), 'ကျွန်ုပ်');
      assert.equal(toUnicode('ကၽြႏု္ပ္'), 'ကျွန်ုပ်');
      assert.equal(toUnicode('ေပ့ခ်္'), 'ပေ့ခ်ျ');
    });

    it('stores an asat after medial ha, aa and a dot below last', () => {
      assert.equal(toUnicode('ေဒ့ရွ္'), 'ဒေ့ရှ်');
      assert.equal(toUnicode('ေက်ာ္'), 'ကျော်');
      assert.equal(toUnicode('ေပၚ'), 'ပေါ်');
      assert.equal(toUnicode('ယာဥ္'), 'ယာဉ်');
      assert.equal(knayi.fontConvert('ေကာင့္', 'unicode', 'zawgyi'), '\u1000\u1031\u102C\u1004\u1037\u103A');
    });

    it('stores the asat of aw typed before aa last', () => {
      assert.equal(toUnicode('ေက္ာဖီ'), 'ကော်ဖီ');
      assert.equal(toUnicode('ကၽြန္ေတ္ာ'), 'ကျွန်တော်');
    });

    it('drops an asat typed with i or on a stacked consonant', () => {
      assert.equal(toUnicode('ႏို္င္ငံ'), 'နိုင်ငံ');
      assert.equal(toUnicode('အိ္မ္'), 'အိမ်');
      assert.equal(toUnicode('ႏြားႏိုု့္'), 'နွားနို့');
      assert.equal(toUnicode('ကုလသမဂၢ္'), 'ကုလသမဂ္ဂ');
      assert.equal(toUnicode('ဓမၼ္တာ'), 'ဓမ္မတာ');
    });
  });

  describe('letters Zawgyi draws alike', () => {
    it('reads ca with medial ya as jha', () => {
      assert.equal(toUnicode('ေစ်း'), 'ဈေး');
      assert.equal(toUnicode('မဇၥ်'), 'မဇ္ဈ');
      assert.equal(toUnicode('မဇၩ'), 'မဇ္ဈ');
    });

    it('reads the digit four typed for lagaung as lagaung', () => {
      assert.equal(toUnicode('၄င္း၏'), '၎င်း၏');
      assert.equal(toUnicode('၎င္းတို႔'), '၎င်းတို့');
      assert.equal(toUnicode('၎တို႔'), '၎င်းတို့');
      assert.equal(toUnicode('၁၄ ရက္'), '၁၄ ရက်');
      // A four after any digit, zero to nine, stays a digit; after any other character it is lagaung.
      assert.equal(toUnicode('၀၄င္း'), '၀၄င်း');
      assert.equal(toUnicode('၉၄င္း'), '၉၄င်း');
      assert.equal(toUnicode('၊၄င္း'), '၊၎င်း');
    });

    it('reads u with a stacked consonant, asat or aa as nya', () => {
      assert.equal(toUnicode('ပဥၥ'), 'ပဉ္စ');
      assert.equal(toUnicode('ဥာဏ္'), 'ဉာဏ်');
      assert.equal(toUnicode('ညဥ့္'), 'ညဉ့်');
      assert.equal(toUnicode('ဥံဳ'), 'ဥုံ');
      assert.equal(toUnicode('ဦး'), 'ဦး');
    });

    it('reads seven with a vowel sign or medial as ra', () => {
      assert.equal(toUnicode('ေ၇း'), 'ရေး');
      assert.equal(toUnicode('၁၇း၂၁'), '၁၇း၂၁');
    });

    it('reads zero as wa unless it is part of a number', () => {
      assert.equal(toUnicode('ေ၀၀ါး'), 'ဝေဝါး');
      assert.equal(toUnicode('၅.၀'), '၅.၀');
      assert.equal(toUnicode('၀.၅'), '၀.၅');
    });
  });

  describe('spaces and zero-width characters', () => {
    it('drops a space typed before a mark, which only moved the mark', () => {
      assert.equal(toUnicode('ေအာက္ေမ ႔မိပါတယ္'), 'အောက်မေ့မိပါတယ်');
      assert.equal(toUnicode('တဲ ႔ အၿဖစ္'), 'တဲ့ အဖြစ်');
      assert.equal(toUnicode('တစ္ခ ု ရွိ'), 'တစ်ခု ရှိ');
      assert.equal(toUnicode('လို\n့'), 'လို\n့');
    });

    it('keeps zero-width spaces, after the syllable they were typed in', () => {
      assert.equal(toUnicode('တစ္' + ZWSP + 'ခု'), 'တစ်' + ZWSP + 'ခု');
      assert.equal(toUnicode('က်င္' + ZWSP + 'းပ'), 'ကျင်း' + ZWSP + 'ပ');
      assert.equal(toUnicode('ေ' + ZWSP + 'က'), ZWSP + 'ကေ');
      assert.equal(toUnicode('အ\u200Cေန'), 'အ\u200Cနေ');
    });
  });

  describe('debugging', () => {
    it('names each stage and ends with the converted text', () => {
      const log = knayi.fontConvert.debugging('ေက်ာ္', 'unicode', 'zawgyi');
      assert.equal(log.from, 'zawgyi');
      assert.equal(log.to, 'unicode');
      assert.deepEqual(log.matched_patterns, ['glyphs', 'syllables']);
      assert.equal(log.steps[0], 'ေက်ာ္');
      assert.equal(log.steps[log.steps.length - 1], 'ကျော်');
    });

    // The stage names and their order are 2.x API (ARCHITECTURE.md, Stable surfaces): one input that goes through
    // all seven.
    it('names all seven stages in their order', () => {
      const c = (...codes) => String.fromCharCode(...codes);
      const input = [
        c(0x1044, 0x1004, 0x1039, 0x1038), // sequences: the digit four typed for lagaung
        c(0x1031, 0x1000), // syllables: e typed before ka
        c(0x1000, 0x1040, 0x1004, 0x103A), // zero as wa: a zero inside a word
        c(0x1000, 0x102D, 0x102E), // typos: i with ii
        c(0x1041, 0x101B, 0x1041), // look-alikes: ra between digits
        c(0x1025, 0x102E) // NFC: u and ii compose to U+1026
      ].join(' ');
      const log = knayi.fontConvert.debugging(input, 'unicode', 'zawgyi');
      assert.deepEqual(log.matched_patterns, ['sequences', 'glyphs', 'syllables', 'zero as wa', 'typos', 'look-alikes', 'NFC']);
      assert.equal(log.steps.length, 8);
      assert.equal(log.steps[7], [
        c(0x104E, 0x1004, 0x103A, 0x1038), c(0x1000, 0x1031), c(0x1000, 0x101D, 0x1004, 0x103B),
        c(0x1000, 0x102E), c(0x1041, 0x1047, 0x1041), c(0x1026)
      ].join(' '));
    });

    // Conversion makes the typos first, then the look-alikes, as normalize does (ARCHITECTURE.md, Typing fixes
    // and their order).
    it('makes the typing fixes in the order normalize makes them', () => {
      const c = (...codes) => String.fromCharCode(...codes);
      // Ra, the digit four and nga, with the visarga typed before the asat: no sequence matches, so the four is
      // still a digit when the syllables are in order. It is lagaung, and the ra, next to no digit, stays ra.
      const zawgyi = c(0x101B, 0x1044, 0x1004, 0x1038, 0x1039);
      const lagaung = c(0x101B, 0x104E, 0x1004, 0x103A, 0x1038);
      assert.equal(toUnicode(zawgyi), lagaung);
      assert.equal(knayi.normalize(c(0x101B, 0x1044, 0x1004, 0x103A, 0x1038)), lagaung);
      assert.deepEqual(knayi.fontConvert.debugging(zawgyi, 'unicode', 'zawgyi').matched_patterns,
        ['glyphs', 'syllables', 'typos']);
      // Where both change the text, the typos come first: kinzi drawn with ii, then i, seven and a short ra. ii
      // with i is ii, then ra next to seven is seven.
      const both = knayi.fontConvert.debugging(c(0x108C, 0x102D, 0x1047, 0x1090), 'unicode', 'zawgyi');
      assert.deepEqual(both.matched_patterns, ['glyphs', 'typos', 'look-alikes']);
      assert.deepEqual(both.steps.slice(2), [
        c(0x1004, 0x103A, 0x1039, 0x102E, 0x1047, 0x101B),
        c(0x1004, 0x103A, 0x1039, 0x102E, 0x1047, 0x1047)
      ]);
    });
  });
});
