// An ES module that uses the packed package. scripts/check-types.mjs compiles it in a project that has the
// tarball installed, under node16 and nodenext resolution, then runs the output in Node.
import knayi from "knayi-myscript";
import * as namespace from "knayi-myscript";
import {
  fontConvert,
  fontDetect,
  normalize,
  setGlobalOptions,
  spellingFix,
  syllBreak,
  truncate,
  version
} from "knayi-myscript";
import type { ConvertDebug, DetectorOptions, GlobalOptions, Knayi, TruncateOptions } from "knayi-myscript";

function check(ok: boolean, what: string): void {
  if (!ok) throw new Error("esm.mts: " + what);
}

const zawgyi = "မဂၤလာပါ";
const unicode = "မင်္ဂလာပါ";

const globalOptions: GlobalOptions = { silent_mode: true, detector: { use_myanmartools: false } };
const detectorOptions: DetectorOptions = { adapter: "rules" };
const truncateOptions: TruncateOptions = { length: 30, fontType: null };
setGlobalOptions(globalOptions);

// Importing CommonJS from an ES module, the default import is module.exports, which main.js also gives a
// default property.
const fromDefault: Knayi = knayi.default;
check(knayi.fontConvert(zawgyi, "unicode", "zawgyi") === unicode, "default import");
check(fromDefault.fontConvert(zawgyi, "unicode", "zawgyi") === unicode, "default property");
check(namespace.normalize(unicode) === unicode, "namespace import");

check(fontConvert(zawgyi, "unicode", "zawgyi") === unicode, "named fontConvert");
const debug: ConvertDebug = fontConvert.debugging(zawgyi, "unicode", "zawgyi");
check(debug.steps[debug.steps.length - 1] === unicode, "fontConvert.debugging");
check(fontDetect(zawgyi, null, detectorOptions) === "zawgyi", "fontDetect");
check(syllBreak(unicode, null, "|") === "မင်္ဂလာ|ပါ", "syllBreak");
check(typeof spellingFix(unicode, "unicode") === "string", "spellingFix");
check(typeof truncate(unicode, truncateOptions) === "string", "truncate");
check(normalize(unicode) === unicode, "normalize");
check(version === knayi.version, "version");

// The types are the package's own, not any.
// @ts-expect-error normalize returns a string
const wrong: number = normalize(unicode);
// @ts-expect-error adapter is a per-call option; setGlobalOptions does not store it
setGlobalOptions({ detector: { adapter: "rules" } });

export { wrong };
