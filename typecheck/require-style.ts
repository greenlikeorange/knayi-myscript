import knayi = require("knayi-myscript/compat");

const converted: string = knayi.fontConvert("မဂၤလာပါ", "unicode", "zawgyi");
const detected: string = knayi.fontDetect("ကျ", null, { adapter: "rules" });
const broken: string = knayi.syllBreak("မင်္ဂလာပါ", "unicode", "|");
const normalized: string = knayi.normalize("ကိီ");
const shortened: string = knayi.truncate("က", { length: 30, omission: "..." });
const spelled: string = knayi.spellingFix("ကိီ", "unicode");

knayi.setGlobalOptions({
  silent_mode: true,
  detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
});

const debug = knayi.fontConvert.debugging("က္ကြွှေိာ်", "zawgyi", "unicode");
const lastStep: string = debug.steps[debug.steps.length - 1];

export {
  converted,
  detected,
  broken,
  normalized,
  shortened,
  spelled,
  lastStep
};
