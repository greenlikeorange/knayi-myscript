// Code for a bundler that uses the packed package. scripts/check-types.mjs compiles it in a project that has
// the tarball installed, under bundler resolution, then bundles it with esbuild and runs the bundle in Node.
import knayi from "knayi-myscript";
import { fontConvert, fontDetect, normalize, setGlobalOptions, syllBreak, version } from "knayi-myscript";
import type { ConvertDebug, DetectorOptions, Knayi } from "knayi-myscript";

function check(ok: boolean, what: string): void {
  if (!ok) throw new Error("bundler.ts: " + what);
}

const zawgyi = "မဂၤလာပါ";
const unicode = "မင်္ဂလာပါ";

setGlobalOptions({ silent_mode: true });

const all: Knayi = knayi;
check(all.fontConvert(zawgyi, "unicode", "zawgyi") === unicode, "default import");
check(fontConvert(zawgyi, "unicode", "zawgyi") === unicode, "named import");
const debug: ConvertDebug = fontConvert.debugging(zawgyi, "unicode", "zawgyi");
check(debug.steps.length > 0, "fontConvert.debugging");
const options: DetectorOptions = { adapter: "rules" };
check(fontDetect(unicode, null, options) === "unicode", "fontDetect");
check(syllBreak(unicode, "unicode", "|") === "မင်္ဂလာ|ပါ", "syllBreak");
check(normalize(unicode) === unicode, "normalize");
check(version === knayi.version, "version");

// The types are the package's own, not any.
// @ts-expect-error syllBreak returns a string
const wrong: string[] = syllBreak(unicode);

export { wrong };
