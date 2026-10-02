const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
var knayi = require('../main');
describe('normalization', () => {
	describe('normalization test 1', () => {
		it('should fix to correct words', () => {
assert.equal(			knayi.normalize('မင်္ဂလာာပါါ'), 'မင်္ဂလာပါ');
		})
  });

  describe('normalization test 2', () => {
		it('should fix to correct words', () => {
assert.equal(			knayi.normalize('မိြုင်မိြုင်'), 'မြိုင်မြိုင်');
		})
  });

  describe('normalization test 3', () => {
		it('should fix to correct words', () => {
assert.equal(			knayi.normalize('မိြုင်မိြုင်\nဆိုင်ဆုိင်'), 'မြိုင်မြိုင်\nဆိုင်ဆိုင်');
		});
	});
	
	describe('Extended values', () => {
		it('should change correct words', () => {
assert.equal(			knayi.normalize('၀ိုင်းဩာေ်ဥးူိီစျေမန ္တလေး'), 'ဝိုင်းဪဦူးဈေမန္တလေး');
		})
	});

	describe('General', () => {
		it('should get reult', () => {
			assert.equal(
				knayi.normalize('သီဟိုဠ်မှ ဉာဏ်ကြီးရှင်သည် အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။ယေဓမ္မာ ဟေတုပ္ပဘဝါ တေသံ ဟေတုံ တထာဂတော အာဟ တေသဉ္စ ယောနိရောဓေါ ဧဝံ ဝါဒီ မဟာသမဏော။(မြန်မာပြန်)မြတ်စွာဘုရားရှင်သည် ရှေးကပြုခဲ့ဖူးသော အကြောင်းတရားကြောင့် ဖြစ်ပေါ်လာကြသော အကျိုးတရားကို ဟောကြားတော်မူသည်။ထိုအကြောင်းတရားတို့၏ ချုပ်ငြိမ်းရာတရားတို့ကိုလည်း ဟောတော်မူ၏။ရဟန်းကြီးဖြစ်သော ဗုဒ္ဓမြတ်စွာဘု၇ားသည် ဤသို့သောအယူရှိတော်မူ၏။'),
				'သီဟိုဠ်မှ ဉာဏ်ကြီးရှင်သည် အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။ယေဓမ္မာ ဟေတုပ္ပဘဝါ တေသံ ဟေတုံ တထာဂတော အာဟ တေသဉ္စ ယောနိရောဓေါ ဧဝံ ဝါဒီ မဟာသမဏော။(မြန်မာပြန်)မြတ်စွာဘုရားရှင်သည် ရှေးကပြုခဲ့ဖူးသော အကြောင်းတရားကြောင့် ဖြစ်ပေါ်လာကြသော အကျိုးတရားကို ဟောကြားတော်မူသည်။ထိုအကြောင်းတရားတို့၏ ချုပ်ငြိမ်းရာတရားတို့ကိုလည်း ဟောတော်မူ၏။ရဟန်းကြီးဖြစ်သော ဗုဒ္ဓမြတ်စွာဘုရားသည် ဤသို့သောအယူရှိတော်မူ၏။'
			);
		});
	});

	describe('Wa and Ya', () => {
		it('should get reult', () => {
			assert.equal(
				knayi.normalize('၁၀၇က်၁၀ လ ၂၀၁၀ နှစ်။ ဝါး ၁၀၇ ချောင်း ကို ၀င်္ကမ္ဘာထဲမှာ ၀င်း၀င်းနဲ့ ၀မ်းပြည့်အောင်ဝါး။ ၀၁-၅၀၀၀၀၇၅ရ ကိုခေါ် ၀မ်းနည်းပါတယ်လို့ ၀င်္ကဝုတ္တိတွေပြော ၇္က ဝ္က။'),
				'၁၀ရက်၁၀ လ ၂၀၁၀ နှစ်။ ဝါး ၁၀၇ ချောင်း ကို ဝင်္ကမ္ဘာထဲမှာ ဝင်းဝင်းနဲ့ ဝမ်းပြည့်အောင်ဝါး။ ၀၁-၅၀၀၀၀၇၅၇ ကိုခေါ် ဝမ်းနည်းပါတယ်လို့ ဝင်္ကဝုတ္တိတွေပြော ရ္က ဝ္က။'
			);
		});
	});

	describe('canonical marks', () => {
		it('collapses mixed lone-gyi-tin', () => {
assert.equal(			knayi.normalize('ကိီ'), 'ကီ');
		})

		it('turns a lone wa into digit zero', () => {
assert.equal(			knayi.normalize('ဝ'), '၀');
		})

		it('keeps surrounding spaces', () => {
assert.equal(			knayi.normalize(' မိြုင် '), ' မြိုင် ');
		})

		it('keeps a zero digit before a space and a marked syllable', () => {
assert.equal(			knayi.normalize('လူ ၂၀ ခံရသည်'), 'လူ ၂၀ ခံရသည်');
assert.equal(			knayi.normalize('အမှတ် ၁၀ စံချိန်'), 'အမှတ် ၁၀ စံချိန်');
assert.equal(			knayi.normalize('၂၀ ခံ'), '၂၀ ခံ');
		})
	})
});

after(function () {
	knayi.setGlobalOptions({
		silent_mode: false,
		detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
	});
});
