var assert = require("assert");
var knayi = require("../npm");

var unicode_string = "ကျွန်တော်တို့စက်ရုံမှာ အလုပ်သမား ၂၁၄ ယောက်ရှိပါတယ်။ သူတို့ကို မှီခို နေတဲ့ မိသားစုတွေက" +
                    "လည်း ၁,၀၀၀ ကျော်လောက် ရှိပါတယ်။ စက်ရုံသာ ပိတ် လိုက်ရင် ဒီအလုပ်သမားတွေ ဘယ်လို" +
                    "လုပ်ကြမလဲ။ ကျွန်တော်တို့ဆီမှာ အလုပ် လုပ်တဲ့ အလုပ်သမားအကုန်လုံးနီးပါးက ကျွန်တော်တို့နဲ့" +
                    "၁၀ နှစ်ကျော် လက်တွဲ ပြီး အလုပ်လုပ်လာတဲ့ သူတွေပါ။ နောက်ပြီး ကျွန်တော်တို့ဒီစက်ရုံအတွက်" +
                    "နိုင်ငံတကာအရည်အသွေးမီ စည်သွတ်ဘူး တွေထုတ်နိုင်အောင် ငွေကြေးအမြောက် အမြားကို" +
                    "လည်း ရင်းနှီးမြှုပ်နှံထားရပါတယ်။ ကာလပေါက်ဈေးနဲ့ တွက်မယ်ဆိုရင် ကျပ်သိန်းပေါင်းတစ်သောင်း" +
                    "လောက် ကိုရှိပါတယ်";

var zawgyi_string = "ကၽြန္ေတာ္တို႔စက္႐ုံမွာ အလုပ္သမား ၂၁၄ ေယာက္ရွိပါတယ္။ သူတို႔ကို မွီခို ေနတဲ့ မိသားစုေတြက" +
                    "လည္း ၁,၀၀၀ ေက်ာ္ေလာက္ ရွိပါတယ္။ စက္႐ုံသာ ပိတ္ လိုက္ရင္ ဒီအလုပ္သမားေတြ ဘယ္လို" +
                    "လုပ္ၾကမလဲ။ ကၽြန္ေတာ္တို႔ဆီမွာ အလုပ္ လုပ္တဲ့ အလုပ္သမားအကုန္လုံးနီးပါးက ကၽြန္ေတာ္တို႔နဲ႔" +
                    "၁၀ ႏွစ္ေက်ာ္ လက္တြဲ ၿပီး အလုပ္လုပ္လာတဲ့ သူေတြပါ။ ေနာက္ၿပီး ကၽြန္ေတာ္တို႔ဒီစက္႐ုံအတြက္" +
                    "နိုင္ငံတကာအရည္အေသြးမီ စည္သြတ္ဘူး ေတြထုတ္နိုင္ေအာင္ ေငြေၾကးအေျမာက္ အျမားကို" +
                    "လည္း ရင္းႏွီးျမႇုပ္ႏွံထားရပါတယ္။ ကာလေပါက္ေဈးနဲ႔ တြက္မယ္ဆိုရင္ က်ပ္သိန္းေပါင္းတစ္ေသာင္း" +
                    "ေလာက္ ကိုရွိပါတယ္";

describe('knayi-myscript NPM version TEST', function() {
  describe("#detector", function(){
    it("should most match with Unicode standard font", function(){
      var result = knayi(unicode_string).getFontType();
      assert.equal(result, "unicode5");
    });

    it("should most match with Zawgyi font", function(){
      var result = knayi(zawgyi_string).getFontType();
      assert.equal(result, "zawgyi");
    });
  });

  describe('#Converter aSync', function() {
    it("should return unicode result", function(done){
      var _unicode_string = knayi(zawgyi_string).fontConvert(null, function(edited, old){
        var _fontType = knayi(edited).getFontType();
        assert.equal(_fontType, "unicode5");
        done();
      });
    });

    it("should return zawgyi result", function(done){
      var _zawgyi_string = knayi(unicode_string).fontConvert("zawgyi", function(edited, old){
        var _fontType = knayi(edited).getFontType();
        assert.equal(_fontType, "zawgyi");
        done();
      });
    });
  });

  describe('#Converter Sync', function() {
    it("should return unicode result", function(){
      var edited = knayi(zawgyi_string).fontConvertSync();
      var _fontType = knayi(edited).getFontType();
      assert.equal(_fontType, "unicode5");
    });

    it("should return zawgyi result", function(){
      var edited = knayi(unicode_string).fontConvertSync("zawgyi");
      var _fontType = knayi(edited).getFontType();
      assert.equal(_fontType, "zawgyi");
    });
  });

  describe('#Syllable-Break Sync', function() {
    it("should return unicode break", function(){
      var edited = knayi("ကျွန်တော် တို့သည်").syllable();
      assert.equal(edited, "\u200Bကျွန်\u200Bတော် တို့\u200Bသည်");
    });
  });
});
