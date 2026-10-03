// An ES module that uses the packed package's entries. scripts/check-types.mjs compiles it in a project that has the
// tarball installed, under node16, node20 and nodenext resolution, then runs the output in Node.
import * as knayi from "knayi-myscript";
import { normalize, toUnicode, createTrace, VERSION } from "knayi-myscript";
import type { NormalizeReport, Trace } from "knayi-myscript";
import compat, { fontConvert, fontDetect, setGlobalOptions, syllBreak, version } from "knayi-myscript/compat";
import type { ConvertDebug, DetectorOptions, GlobalOptions, Knayi, TruncateOptions } from "knayi-myscript/compat";
import * as stream from "knayi-myscript/stream";

function check(ok: boolean, what: string): void {
  if (!ok) throw new Error("esm.mts: " + what);
}

const zawgyi = "မဂၤလာပါ";
const unicode = "မင်္ဂလာပါ";

// The 3.0 API.
const trace: Trace = createTrace();
check(toUnicode(zawgyi, { from: "zawgyi", trace }) === unicode, "toUnicode");
check(trace.records.length > 0, "the trace");
const report: NormalizeReport = normalize(unicode, { report: true });
check(report.text === unicode && report.changes.length === 0, "normalize with a report");
check(knayi.isNormalized(unicode), "the namespace");
check(VERSION === version, "one version");

// The 2.x API, './compat'.
const globalOptions: GlobalOptions = { silent_mode: true, detector: { use_myanmartools: false } };
const detectorOptions: DetectorOptions = { adapter: "rules" };
const truncateOptions: TruncateOptions = { length: 30, fontType: null };
setGlobalOptions(globalOptions);
const all: Knayi = compat;
check(all.fontConvert(zawgyi, "unicode", "zawgyi") === unicode, "default import");
check(fontConvert(zawgyi, "unicode", "zawgyi") === unicode, "named fontConvert");
const debug: ConvertDebug = fontConvert.debugging(zawgyi, "unicode", "zawgyi");
check(debug.steps[debug.steps.length - 1] === unicode, "fontConvert.debugging");
check(fontDetect(zawgyi, null, detectorOptions) === "zawgyi", "fontDetect");
check(syllBreak(unicode, null, "|") === "မင်္ဂလာ|ပါ", "syllBreak");
check(typeof compat.truncate(unicode, truncateOptions) === "string", "truncate");

// './stream' exports nothing until streaming lands there.
check(Object.keys(stream).length === 0, "stream");

// The types are the package's own, not any: each line below must be a type error. The function never runs, since
// the 3.0 API throws on what its types refuse.
function typeErrors(): void {
  // @ts-expect-error normalize returns a string without { report: true }
  const wrong: number = normalize(unicode);
  // @ts-expect-error 3.0 options are camelCase objects; a font name is not one
  toUnicode(zawgyi, "zawgyi");
  // @ts-expect-error adapter is a per-call option; setGlobalOptions does not store it
  setGlobalOptions({ detector: { adapter: "rules" } });
  check(wrong === 0, "never runs");
}

export { typeErrors };
