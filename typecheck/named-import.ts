import { fontConvert, fontDetect, normalize, setGlobalOptions, spellingFix, syllBreak, truncate, version } from "knayi-myscript";
import type { DetectorOptions, GlobalOptions, TruncateOptions } from "knayi-myscript";

const detectorOptions: DetectorOptions = { adapter: "rules" };
const globalOptions: GlobalOptions = { silent_mode: true, detector: { use_myanmartools: false } };
const truncateOptions: TruncateOptions = { length: 30, fontType: null };

setGlobalOptions(globalOptions);

const converted: string = fontConvert("မဂၤလာပါ", "unicode", null);
const detected: string = fontDetect("ကျ", null, detectorOptions);
const broken: string = syllBreak("မင်္ဂလာပါ", null, "|");
const spelled: string = spellingFix("ကိီ", null);
const shortened: string = truncate("က", truncateOptions);
const normalized: string = normalize("ကိီ");
const current: string = version;

// adapter is a per-call option; setGlobalOptions does not store it.
// @ts-expect-error
setGlobalOptions({ detector: { adapter: "rules" } });

export { converted, detected, broken, spelled, shortened, normalized, current };
