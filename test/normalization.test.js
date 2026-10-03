const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
var knayi = require('../main');
describe('normalization', () => {
  describe('normalization test 1', () => {
    it('should fix to correct words', () => {
      assert.equal(knayi.normalize('မင်္ဂလာာပါါ'), 'မင်္ဂလာပါ');
    })
  });

  describe('normalization test 2', () => {
    it('should fix to correct words', () => {
      assert.equal(knayi.normalize('မိြုင်မိြုင်'), 'မြိုင်မြိုင်');
    })
  });

  describe('normalization test 3', () => {
    it('should fix to correct words', () => {
      assert.equal(knayi.normalize('မိြုင်မိြုင်\nဆိုင်ဆုိင်'), 'မြိုင်မြိုင်\nဆိုင်ဆိုင်');
    });
  });

  describe('Extended values', () => {
    it('should change correct words', () => {
      assert.equal(knayi.normalize('၀ိုင်းဩာေ်ဥးူိီစျေမန ္တလေး'), 'ဝိုင်းဪဦူးဈေမန္တလေး');
    })
  });

  describe('General', () => {
    it('should get reult', () => {
      assert.equal(
        knayi.normalize('သီဟိုဠ်မှ ဉာဏ်ကြီးရှင်သည် အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။ယေဓမ္မာ ဟေတုပ္ပဘဝါ တေသံ ဟေတုံ တထာဂတော အာဟ တေသဉ္စ ယောနိရောဓေါ ဧဝံ ဝါဒီ မဟာသမဏော။(မြန်မာပြန်)မြတ်စွာဘုရားရှင်သည် ရှေးကပြုခဲ့ဖူးသော အကြောင်းတရားကြောင့် ဖြစ်ပေါ်လာကြသော အကျိုးတရားကို ဟောကြားတော်မူသည်။ထိုအကြောင်းတရားတို့၏ ချုပ်ငြိမ်းရာတရားတို့ကိုလည်း ဟောတော်မူ၏။ရဟန်းကြီးဖြစ်သော ဗုဒ္ဓမြတ်စွာဘု၇ားသည် ဤသို့သောအယူရှိတော်မူ၏။'),
        'သီဟိုဠ်မှ ဉာဏ်ကြီးရှင်သည် အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။ယေဓမ္မာ ဟေတုပ္ပဘဝါ တေသံ ဟေတုံ တထာဂတော အာဟ တေသဉ္စ ယောနိရောဓေါ ဧဝံ ဝါဒီ မဟာသမဏော။(မြန်မာပြန်)မြတ်စွာဘုရားရှင်သည် ရှေးကပြုခဲ့ဖူးသော အကြောင်းတရားကြောင့် ဖြစ်ပေါ်လာကြသော အကျိုးတရားကို ဟောကြားတော်မူသည်။ထိုအကြောင်းတရားတို့၏ ချုပ်ငြိမ်းရာတရားတို့ကိုလည်း ဟောတော်မူ၏။ရဟန်းကြီးဖြစ်သော ဗုဒ္ဓမြတ်စွာဘုရားသည် ဤသို့သောအယူရှိတော်မူ၏။'
      );
    });
  });

  describe('Wa and Ya', () => {
    it('should get reult', () => {
      assert.equal(
        knayi.normalize('၁၀၇က်၁၀ လ ၂၀၁၀ နှစ်။ ဝါး ၁၀၇ ချောင်း ကို ၀င်္ကမ္ဘာထဲမှာ ၀င်း၀င်းနဲ့ ၀မ်းပြည့်အောင်ဝါး။ ၀၁-၅၀၀၀၀၇၅ရ ကိုခေါ် ၀မ်းနည်းပါတယ်လို့ ၀င်္ကဝုတ္တိတွေပြော ၇္က ဝ္က။'),
        '၁၀ရက်၁၀ လ ၂၀၁၀ နှစ်။ ဝါး ၁၀၇ ချောင်း ကို ဝင်္ကမ္ဘာထဲမှာ ဝင်းဝင်းနဲ့ ဝမ်းပြည့်အောင်ဝါး။ ၀၁-၅၀၀၀၀၇၅၇ ကိုခေါ် ဝမ်းနည်းပါတယ်လို့ ဝင်္ကဝုတ္တိတွေပြော ရ္က ဝ္က။'
      );
    });
  });

  describe('canonical marks', () => {
    it('collapses mixed lone-gyi-tin', () => {
      assert.equal(knayi.normalize('ကိီ'), 'ကီ');
    })

    it('keeps a lone wa a letter', () => {
      assert.equal(knayi.normalize('ဝ'), 'ဝ');
    })

    it('keeps surrounding spaces', () => {
      assert.equal(knayi.normalize(' မိြုင် '), ' မြိုင် ');
    })

    it('keeps a zero digit before a space and a marked syllable', () => {
      assert.equal(knayi.normalize('လူ ၂၀ ခံရသည်'), 'လူ ၂၀ ခံရသည်');
      assert.equal(knayi.normalize('အမှတ် ၁၀ စံချိန်'), 'အမှတ် ၁၀ စံချိန်');
      assert.equal(knayi.normalize('၂၀ ခံ'), '၂၀ ခံ');
    })
  })

  describe('Unicode storage order', () => {
    it('puts asat where Unicode Technical Note #11 puts it', () => {
      assert.equal(knayi.normalize('ယောကျ်ား'), 'ယောက်ျား');
      assert.equal(knayi.normalize('ကျွနု်ပ်'), 'ကျွန်ုပ်');
      assert.equal(knayi.normalize('ပေ့ချ်'), 'ပေ့ခ်ျ');
      assert.equal(knayi.normalize('ဒေ့ရှ်'), 'ဒေ့ရှ်');
      assert.equal(knayi.normalize('ကျော်'), 'ကျော်');
    });

    it('returns NFC, with the dot below before asat', () => {
      assert.equal(knayi.normalize('ကြောင\u103A\u1037'), 'ကြောင\u1037\u103A');
    });

    it('puts medial ra after a stacked consonant', () => {
      assert.equal(knayi.normalize('အိနြ္ဒာ'), 'အိန္ဒြာ');
    });

    it('leaves text that is already in order as it is', () => {
      const text = 'မင်္ဂလာပါ။ ယောက်ျားလေး ကျွန်ုပ်တို့ ဗုဒ္ဓ တက္ကသိုလ်';
      assert.equal(knayi.normalize(text), text);
    });

    it('gives the same text when run twice', () => {
      for (const text of ['ချ်', 'ခေ်ရ', 'ဖြ်စ', 'ကယ္ြန်', 'ခြသေင့်္ကို', 'လည်းေကာင်း']) {
        const once = knayi.normalize(text);
        assert.equal(knayi.normalize(once), once);
      }
    });

    it('leaves the output of fontConvert as it is', () => {
      for (const zawgyi of ['ေယာက္်ား', 'ႏို္င္ငံ', '၂ဝ၁၉ ခုႏွစ္', 'ေက်ာ္']) {
        const unicode = knayi.fontConvert(zawgyi, 'unicode', 'zawgyi');
        assert.equal(knayi.normalize(unicode), unicode);
      }
    });
  });

  describe('Zawgyi typing habits in Unicode text', () => {
    it('moves e and medial ra typed before their consonant', () => {
      assert.equal(knayi.normalize('လည်းေကာင်း'), 'လည်းကောင်း');
      assert.equal(knayi.normalize('မြင့်ြမတ်'), 'မြင့်မြတ်');
      assert.equal(knayi.normalize('သူ ေကာင်း'), 'သူ ကောင်း');
    });

    it('leaves an e that has no consonant to go to', () => {
      assert.equal(knayi.normalize('ကို ေ('), 'ကို ေ(');
    });

    it('drops a space typed before a mark, but not a line break', () => {
      assert.equal(knayi.normalize('သုံ း'), 'သုံး');
      assert.equal(knayi.normalize('လို\n့'), 'လို\n့');
    });

    it('keeps zero-width spaces, and leaves joiners where they are', () => {
      assert.equal(knayi.normalize('တစ်\u200Bခု'), 'တစ်\u200Bခု');
      assert.equal(knayi.normalize('များစွာ\u200Cသော'), 'များစွာ\u200Cသော');
    });
  });

  describe('look-alike letters and digits', () => {
    it('keeps words and numbers that are already right', () => {
      for (const text of ['လုံးဝ', 'ဘဝ', 'ထာဝရ', 'ခံရသူ ၃ ဦး', '၁၉၇၇ ခုနှစ်', 'အောက်တိုဘာလ ၇ ရက်', '၂ရတယ်', 'ဝ']) {
        assert.equal(knayi.normalize(text), text);
      }
    });

    it('reads wa and ra typed in a number as digits', () => {
      assert.equal(knayi.normalize('၄ဝဝ'), '၄၀၀');
      assert.equal(knayi.normalize('၉,ဝဝဝ'), '၉,၀၀၀');
      assert.equal(knayi.normalize('၂၀၁ရ'), '၂၀၁၇');
    });

    it('reads zero and seven used as letters as wa and ra', () => {
      assert.equal(knayi.normalize('ဘ၀'), 'ဘဝ');
      assert.equal(knayi.normalize('၀င်'), 'ဝင်');
      assert.equal(knayi.normalize('ဆို၇င်'), 'ဆိုရင်');
    });

    it('reads u with asat or aa as nya, ca with medial ya as jha, and four before nga as lagaung', () => {
      assert.equal(knayi.normalize('ညဥ့်'), 'ညဉ့်');
      assert.equal(knayi.normalize('ဥာဏ်'), 'ဉာဏ်');
      assert.equal(knayi.normalize('စျေး'), 'ဈေး');
      assert.equal(knayi.normalize('၄င်း'), '၎င်း');
    });
  });
  describe('other languages in the script', () => {
    it('keeps Mon, Karen and Pa\'o spellings that would be mistakes in Burmese', () => {
      // ai and anusvara with u or aa (Mon, Karen), e after a Mon medial or Mon nga, Mon final h with e,
      // and Pa'o u with asat after a vowel.
      for (const text of ['တုဲ', 'လှာဲ', 'ဗ္ဒဲါ', 'ခရံာ်', 'တၟေင်', 'ပေါတ်ၚေက်', 'စှ်ေနူ', 'လဲဥ်း']) {
        assert.equal(knayi.normalize(text), text);
      }
    });

    it('reads zero with a Shan or Karen mark as wa, and seven as ra (issue #43)', () => {
      // Zero before a Shan vowel, medial wa or asat, or before a Shan consonant with asat.
      for (const text of ['၀ႆ', '၀ၢ', '၀ႃ', '၀်', '၀ႂ', '၀ႂ်', '၀ၼ်း']) {
        assert.equal(knayi.normalize(text), 'ဝ' + text.slice(1));
      }
      assert.equal(knayi.normalize('သ၇ၣ်'), 'သရၣ်');
      assert.equal(knayi.normalize('က၇ၢ'), 'ကရၢ');
    });

    it('keeps a number followed by a tone mark typed as a comma', () => {
      assert.equal(knayi.normalize('၁၄း၁၅ႇ ၁၆'), '၁၄း၁၅ႇ ၁၆');
      assert.equal(knayi.normalize('၆- ၇ႇ ၂၀ႇ'), '၆- ၇ႇ ၂၀ႇ');
      assert.equal(knayi.normalize('၂ဝႇ'), '၂၀ႇ');
    });
  });});

after(function () {
  knayi.setGlobalOptions({
    silent_mode: false,
    detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
  });
});
