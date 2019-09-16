var knayi = require('../main');
var chai = require('chai');
chai.should();

describe('normalization', () => {
	describe('normalization test 1', () => {
		it('should fix to correct words', () => {
			knayi.normalize('မင်္ဂလာာပါါ').should.equal('မင်္ဂလာပါ');
		})
  });

  describe('normalization test 2', () => {
		it('should fix to correct words', () => {
			knayi.normalize('မိြုင်မိြုင်').should.equal('မြိုင်မြိုင်');
		})
  });

  describe('normalization test 3', () => {
		it('should fix to correct words', () => {
			knayi.normalize('မိြုင်မိြုင်\nဆိုင်ဆုိင်').should.equal('မြိုင်မြိုင်\nဆိုင်ဆိုင်');
		});
	});
	
	describe('Extended values', () => {
		it('should change correct words', () => {
			knayi.normalize('၀ိုင်းဩာေ်ဥးူိီစျေမန ္တလေး').should.equal('ဝိုင်းဪဦူးဈေမန္တလေး');
		})
	});

	describe('General', () => {
		it('should get reult', () => {
			knayi.normalize('သီဟိုဠ်မှ ဉာဏ်ကြီးရှင်သည် အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။ယေဓမ္မာ ဟေတုပ္ပဘဝါ တေသံ ဟေတုံ တထာဂတော အာဟ တေသဉ္စ ယောနိရောဓေါ ဧဝံ ဝါဒီ မဟာသမဏော။(မြန်မာပြန်)မြတ်စွာဘုရားရှင်သည် ရှေးကပြုခဲ့ဖူးသော အကြောင်းတရားကြောင့် ဖြစ်ပေါ်လာကြသော အကျိုးတရားကို ဟောကြားတော်မူသည်။ထိုအကြောင်းတရားတို့၏ ချုပ်ငြိမ်းရာတရားတို့ကိုလည်း ဟောတော်မူ၏။ရဟန်းကြီးဖြစ်သော ဗုဒ္ဓမြတ်စွာဘု၇ားသည် ဤသို့သောအယူရှိတော်မူ၏။')
				.should.equal('သီဟိုဠ်မှ ဉာဏ်ကြီးရှင်သည် အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။ယေဓမ္မာ ဟေတုပ္ပဘဝါ တေသံ ဟေတုံ တထာဂတော အာဟ တေသဉ္စ ယောနိရောဓေါ ဧဝံ ဝါဒီ မဟာသမဏော။(မြန်မာပြန်)မြတ်စွာဘုရားရှင်သည် ရှေးကပြုခဲ့ဖူးသော အကြောင်းတရားကြောင့် ဖြစ်ပေါ်လာကြသော အကျိုးတရားကို ဟောကြားတော်မူသည်။ထိုအကြောင်းတရားတို့၏ ချုပ်ငြိမ်းရာတရားတို့ကိုလည်း ဟောတော်မူ၏။ရဟန်းကြီးဖြစ်သော ဗုဒ္ဓမြတ်စွာဘုရားသည် ဤသို့သောအယူရှိတော်မူ၏။');
		});
	});

	describe('Wa and Ya', () => {
		it('should get reult', () => {
			knayi.normalize('၁၀၇က်၁၀ လ ၂၀၁၀ နှစ်။ ဝါး ၁၀၇ ချောင်း ကို ၀င်္ကမ္ဘာထဲမှာ ၀င်း၀င်းနဲ့ ၀မ်းပြည့်အောင်ဝါး။ ၀၁-၅၀၀၀၀၇၅ရ ကိုခေါ် ၀မ်းနည်းပါတယ်လို့ ၀င်္ကဝုတ္တိတွေပြော ၇္က ဝ္က။')
				.should.equal('၁၀ရက်၁၀ လ ၂၀၁၀ နှစ်။ ဝါး ၁၀၇ ချောင်း ကို ဝင်္ကမ္ဘာထဲမှာ ဝင်းဝင်းနဲ့ ဝမ်းပြည့်အောင်ဝါး။ ၀၁-၅၀၀၀၀၇၅၇ ကိုခေါ် ဝမ်းနည်းပါတယ်လို့ ဝင်္ကဝုတ္တိတွေပြော ရ္က ဝ္က။');
		});
	});
});
