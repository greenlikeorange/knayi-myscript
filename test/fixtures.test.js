const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const knayi = require('../main');

const phrases = [
  { text: 'မြန်မာ', detect: 'unicode', break: 'မြန်|မာ', norm: 'မြန်မာ', zawgyi: 'ျမန္မာ' },
  { text: 'ကျေးဇူး', detect: 'unicode', break: 'ကျေး|ဇူး', norm: 'ကျေးဇူး', zawgyi: 'ေက်းဇူး' },
  { text: 'ကျောင်းသား', detect: 'unicode', break: 'ကျောင်း|သား', norm: 'ကျောင်းသား', zawgyi: 'ေက်ာင္းသား' },
  { text: 'ဗုဒ္ဓ', detect: 'unicode', break: 'ဗု|ဒ္ဓ', norm: 'ဗုဒ္ဓ', zawgyi: 'ဗုဒၶ' },
  { text: 'တက္ကသိုလ်', detect: 'unicode', break: 'တက္ကသိုလ်', norm: 'တက္ကသိုလ်', zawgyi: 'တကၠသိုလ္' },
  { text: 'ဘုရား', detect: 'zawgyi', break: 'ဘု|ရား', norm: 'ဘုရား', zawgyi: 'ဘုရား' },
  { text: 'နိုင်ငံ', detect: 'unicode', break: 'နိုင်|ငံ', norm: 'နိုင်ငံ', zawgyi: 'နိုင္ငံ' },
  { text: 'သီဟိုဠ်', detect: 'zawgyi', break: 'သီ|ဟိုဠ်', norm: 'သီဟိုဠ်', zawgyi: 'သီဟိုဠ္' },
  { text: 'အင်း', detect: 'unicode', break: 'အင်း', norm: 'အင်း', zawgyi: 'အင္း' },
  { text: 'ကျော်', detect: 'unicode', break: 'ကျော်', norm: 'ကျော်', zawgyi: 'ေက်ာ္' }
];

describe('locked phrases', () => {
  for (const phrase of phrases) {
    it(phrase.text, () => {
      assert.equal(knayi.fontDetect(phrase.text), phrase.detect);
      assert.equal(knayi.syllBreak(phrase.text, 'unicode', '|'), phrase.break);
      assert.equal(knayi.normalize(phrase.text), phrase.norm);
      assert.equal(knayi.fontConvert(phrase.text, 'zawgyi', 'unicode'), phrase.zawgyi);
      assert.equal(knayi.fontConvert(phrase.zawgyi, 'unicode', 'zawgyi'), phrase.text);
    });
  }

  it('keeps the alias, spelling, and short-truncate results', () => {
    const zawgyiMyanmar = knayi.fontConvert('မြန်မာ', 'zawgyi', 'unicode');
    assert.equal(knayi.fontDetect(zawgyiMyanmar), 'zawgyi');
    assert.equal(knayi.fontConvert(zawgyiMyanmar, 'uni', 'zaw'), 'မြန်မာ');
    assert.equal(knayi.spellingFix('\u1033\u1033', 'zaw'), '\u1033');
    assert.equal(knayi.syllBreak('က္က', 'uni', '|'), 'က္က');
    assert.equal(knayi.truncate('က'), 'က...');
    assert.equal(knayi.fontConvert(' ကာာ ', 'unicode', 'unicode'), 'ကာာ');
    assert.equal(knayi.fontConvert('ကျ', 'unicode'), 'ကျ');
    assert.equal(knayi.spellingFix('ကိီ', 'unicode'), 'ကိီ');
    assert.equal(knayi.normalize('ကိီ'), 'ကီ');
    assert.equal(knayi.normalize('ဝ'), '၀');
  });
});
