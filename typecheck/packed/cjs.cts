// A CommonJS module that uses the packed package. 3.0 is ES modules only, which CommonJS loads with require() in
// Node 22.12 and later, and TypeScript allows under module commonjs, whose node10 resolution finds the subpaths
// through typesVersions, and under node20 and nodenext (5.8 and later), not under node16. scripts/check-types.mjs
// compiles it in a project that has the tarball installed, under the three, then runs the output in Node.
import knayi = require("knayi-myscript");
import compat = require("knayi-myscript/compat");
import type { ConvertDebug, Knayi, TruncateOptions } from "knayi-myscript/compat";

function check(ok: boolean, what: string): void {
  if (!ok) throw new Error("cjs.cts: " + what);
}

const zawgyi = "မဂၤလာပါ";
const unicode = "မင်္ဂလာပါ";

compat.setGlobalOptions({ silent_mode: true });

// The 3.0 API.
check(knayi.toUnicode(zawgyi, { from: "zawgyi" }) === unicode, "toUnicode");
check(knayi.normalize(unicode) === unicode, "normalize");

// The 2.x API: require() gives the module, with the 2.x object as its default export.
const fromDefault: Knayi = compat.default;
check(compat.fontConvert(zawgyi, "unicode", "zawgyi") === unicode, "named fontConvert");
check(fromDefault.fontConvert(zawgyi, "unicode", "zawgyi") === unicode, "the default export");
const debug: ConvertDebug = compat.fontConvert.debugging(zawgyi, "unicode", "zawgyi");
check(debug.from === "zawgyi" && debug.to === "unicode", "fontConvert.debugging");
const options: TruncateOptions = { length: 10, omission: "" };
check(typeof compat.truncate(unicode, options) === "string", "truncate");

// The types are the package's own, not any: each line below must be a type error. The function never runs, since
// the 3.0 API throws on what its types refuse.
function typeErrors(): void {
  // @ts-expect-error fontDetect takes options as its third argument
  compat.fontDetect(unicode, { adapter: "rules" });
  // @ts-expect-error the text is a string
  knayi.normalize(42);
}

export { typeErrors };
