// A CommonJS module that uses the packed package. scripts/check-types.mjs compiles it in a project that has
// the tarball installed, under node16 and nodenext resolution, then runs the output in Node.
import knayi = require("knayi-myscript");
import knayiDefault from "knayi-myscript";
import { fontConvert, normalize, setGlobalOptions } from "knayi-myscript";
import type { ConvertDebug, Knayi, TruncateOptions } from "knayi-myscript";
import deepConvert = require("knayi-myscript/library/converter");

function check(ok: boolean, what: string): void {
  if (!ok) throw new Error("cjs.cts: " + what);
}

const zawgyi = "မဂၤလာပါ";
const unicode = "မင်္ဂလာပါ";

setGlobalOptions({ silent_mode: true });

const fromDefault: Knayi = knayiDefault;
check(knayi.fontConvert(zawgyi, "unicode", "zawgyi") === unicode, "import = require");
check(fromDefault.fontConvert(zawgyi, "unicode", "zawgyi") === unicode, "default import");
check(fontConvert(zawgyi, "unicode", "zawgyi") === unicode, "named import");

const debug: ConvertDebug = knayi.fontConvert.debugging(zawgyi, "unicode", "zawgyi");
check(debug.from === "zawgyi" && debug.to === "unicode", "fontConvert.debugging");
const options: TruncateOptions = { length: 10, omission: "" };
check(typeof knayi.truncate(unicode, options) === "string", "truncate");
check(normalize(unicode) === unicode, "normalize");
check(deepConvert === fontConvert, "library/converter is fontConvert");
const deepDebug: ConvertDebug = deepConvert.debugging(zawgyi, "unicode", "zawgyi");
check(deepDebug.steps[deepDebug.steps.length - 1] === unicode, "library/converter debugging");

// The types are the package's own, not any.
// @ts-expect-error fontDetect takes options as its third argument
knayi.fontDetect(unicode, { adapter: "rules" });
