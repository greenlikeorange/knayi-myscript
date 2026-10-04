// An ES module that uses the packed package's entries. scripts/check-types.mjs compiles it in a project that has the
// tarball installed, under node16, node20 and nodenext resolution, then runs the output in Node.
import * as knayi from "knayi-myscript";
import { normalize, toUnicode, createTrace, VERSION } from "knayi-myscript";
import type { NormalizeReport, Trace } from "knayi-myscript";
import compat, {
  detectEncoding,
  fontConvert,
  fontDetect,
  setGlobalOptions,
  spellingFix,
  syllBreak,
  truncate,
  version
} from "knayi-myscript/compat";
import type {
  ConvertDebug,
  DetectorOptions,
  EncodingDetection,
  GlobalOptions,
  Knayi,
  TruncateOptions,
  ZawgyiDetectorLike
} from "knayi-myscript/compat";

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
const detected: "unicode" | "zawgyi" | "tie" = fontDetect(unicode, "tie");
check(detected === "unicode", "fontDetect with a fallback");
check(syllBreak(unicode, null, "|") === "မင်္ဂလာ|ပါ", "syllBreak");
check(typeof compat.truncate(unicode, truncateOptions) === "string", "truncate");
// As Array#map callbacks: the 2.x types give these an overload for map's index and array.
const lines = [zawgyi, unicode, "abc"];
check(lines.map(spellingFix)[1] === unicode, "lines.map(spellingFix)");
check(lines.map(truncate)[2] === "abc...", "lines.map(truncate)");
check(lines.map(compat.normalize)[1] === unicode, "lines.map(normalize)");
// null options are no options, and a fallback that is not a string, such as map's index, is no fallback.
check(fontDetect(zawgyi, null, null) === "zawgyi", "fontDetect with null options");
setGlobalOptions(null);
const fonts: string[] = lines.map(fontDetect);
check(fonts.join() === "zawgyi,unicode,en", "lines.map(fontDetect)");
// The project has no myanmar-tools: a detector passed as zawgyiDetector needs none, and compat loads no package.
const unicodeDetector: ZawgyiDetectorLike = { getZawgyiProbability: () => 0 };
check(fontDetect(zawgyi, null, { adapter: "myanmartools", zawgyiDetector: unicodeDetector }) === "unicode",
  "zawgyiDetector");
const evidence: EncodingDetection = detectEncoding(zawgyi);
check(evidence.encoding === "zawgyi" && evidence.zawgyi > evidence.unicode, "detectEncoding");
check(compat.detectEncoding === detectEncoding, "detectEncoding on the default export");

// './stream' is stream.mts's: its types name the runtime's TransformStream, which this project's lib leaves out, so
// that '.' and './compat' are shown to need no DOM or Node types.

// The types are the package's own, not any: each line below must be a type error. The function never runs, since
// the 3.0 API throws on what its types refuse.
function typeErrors(): void {
  // @ts-expect-error normalize returns a string without { report: true }
  const wrong: number = normalize(unicode);
  // @ts-expect-error 3.0 options are camelCase objects; a font name is not one
  toUnicode(zawgyi, "zawgyi");
  // @ts-expect-error adapter is a per-call option; setGlobalOptions does not store it
  setGlobalOptions({ detector: { adapter: "rules" } });
  // @ts-expect-error fontDetect never returns 'win'
  const notWin: "win" = fontDetect(unicode);
  check(wrong === 0 && notWin === "win", "never runs");
}

export { typeErrors };
