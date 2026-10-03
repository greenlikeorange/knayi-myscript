// Code for a bundler that uses the packed package. scripts/check-types.mjs compiles it in a project that has the
// tarball installed, under bundler resolution, then bundles it with esbuild, which follows the exports map, and runs
// the bundle in Node.
import { normalize, segmentSyllables, toUnicode } from "knayi-myscript";
import compat, { fontConvert, fontDetect, setGlobalOptions, syllBreak, version } from "knayi-myscript/compat";
import type { ConvertDebug, DetectorOptions, Knayi } from "knayi-myscript/compat";

function check(ok: boolean, what: string): void {
  if (!ok) throw new Error("bundler.ts: " + what);
}

const zawgyi = "မဂၤလာပါ";
const unicode = "မင်္ဂလာပါ";

// The 3.0 API.
check(toUnicode(zawgyi, { from: "zawgyi" }) === unicode, "toUnicode");
check(normalize(unicode) === unicode, "normalize");
check(segmentSyllables(unicode).join("") === unicode, "segmentSyllables");

// The 2.x API, './compat'.
setGlobalOptions({ silent_mode: true });
const all: Knayi = compat;
check(all.fontConvert(zawgyi, "unicode", "zawgyi") === unicode, "default import");
check(fontConvert(zawgyi, "unicode", "zawgyi") === unicode, "named import");
const debug: ConvertDebug = fontConvert.debugging(zawgyi, "unicode", "zawgyi");
check(debug.steps.length > 0, "fontConvert.debugging");
const options: DetectorOptions = { adapter: "rules" };
check(fontDetect(unicode, null, options) === "unicode", "fontDetect");
check(syllBreak(unicode, "unicode", "|") === "မင်္ဂလာ|ပါ", "syllBreak");
check(version === compat.version, "version");

// The types are the package's own, not any.
// @ts-expect-error syllBreak returns a string
const wrong: string[] = syllBreak(unicode);

export { wrong };
