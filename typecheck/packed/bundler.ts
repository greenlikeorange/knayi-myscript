// Code for a bundler that uses the packed package. scripts/check-types.mjs compiles it in a project that has
// the tarball installed, under bundler resolution, then bundles it with esbuild (which follows the `module`
// field to dist/knayi-myscript.es.js) and runs the bundle in Node.
import knayi from "knayi-myscript";
import { detectEncoding, fontConvert, fontDetect, normalize, setGlobalOptions, syllBreak, version } from "knayi-myscript";
import type { ConvertDebug, DetectorOptions, Knayi } from "knayi-myscript";
// The deep path is CommonJS, library/converter.js, bundled apart from dist/knayi-myscript.es.js: a copy of its own.
import deepConvert from "knayi-myscript/library/converter";

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
check(detectEncoding(unicode).encoding === "unicode", "detectEncoding");
check([zawgyi, unicode].map(fontDetect).join() === "zawgyi,unicode", "lines.map(fontDetect)");
check(syllBreak(unicode, "unicode", "|") === "မင်္ဂလာ|ပါ", "syllBreak");
check(normalize(unicode) === unicode, "normalize");
check(version === knayi.version, "version");
check(deepConvert(zawgyi, "unicode", "zawgyi") === unicode, "library/converter");

// The types are the package's own, not any.
// @ts-expect-error syllBreak returns a string
const wrong: string[] = syllBreak(unicode);

export { wrong };
