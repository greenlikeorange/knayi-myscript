// The finer types of index.d.ts: fontDetect's literal results, detectEncoding's result, the font names on font
// parameters, DetectorOptions as an extension of GlobalDetectorOptions, and zawgyiDetector. npm test compiles this
// file with and without esModuleInterop; it never runs.
import { detectEncoding, fontConvert, fontDetect, spellingFix, syllBreak, truncate } from "knayi-myscript";
import type {
  DetectorOptions,
  EncodingDetection,
  FontName,
  GlobalDetectorOptions,
  TruncateOptions,
  ZawgyiDetectorLike
} from "knayi-myscript";

// true only when A and B are the same type.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

// fontDetect returns 'unicode' or 'zawgyi', and the fallback as given, or 'en' when there is none.
const detected = fontDetect("ကျ");
const noFallback: Equal<typeof detected, "unicode" | "zawgyi" | "en"> = true;
const withNull = fontDetect("ကျ", null, null);
const nullFallback: Equal<typeof withNull, "unicode" | "zawgyi" | "en"> = true;
const withEmpty = fontDetect("ကျ", "");
const emptyFallback: Equal<typeof withEmpty, "unicode" | "zawgyi" | "en"> = true;
const withTie = fontDetect("ကျ", "tie", { adapter: "rules" });
const literalFallback: Equal<typeof withTie, "unicode" | "zawgyi" | "tie"> = true;
declare const maybeTie: "tie" | null;
const withMaybeTie = fontDetect("ကျ", maybeTie);
const maybeFallback: Equal<typeof withMaybeTie, "unicode" | "zawgyi" | "tie" | "en"> = true;
declare const anyFallback: string | null | undefined;
const withAnyFallback = fontDetect("ကျ", anyFallback);
const stringFallback: Equal<typeof withAnyFallback, string> = true;
// @ts-expect-error fontDetect never returns 'win'
const win: "win" = fontDetect("ကျ");

// detectEncoding returns the encoding, one of four, and the two counts; it takes the text alone.
const evidence: EncodingDetection = detectEncoding("ကျ");
const encodings: Equal<EncodingDetection["encoding"], "unicode" | "zawgyi" | "unknown" | "none"> = true;
const counts: Equal<EncodingDetection["unicode"] | EncodingDetection["zawgyi"], number> = true;
const mapped: EncodingDetection[] = ["ကျ", "abc"].map(detectEncoding);
const missing: EncodingDetection = detectEncoding(null);
// @ts-expect-error detectEncoding never returns 'win'
const noWin: "win" = detectEncoding("ကျ").encoding;
// @ts-expect-error detectEncoding takes no fallback
detectEncoding("ကျ", "unicode");

// Font parameters suggest the names knayi reads, 'win' only where knayi reads it, and take any other string, such
// as a name in capitals.
type BreakFont = Exclude<FontName, "win"> | (string & {});
const breakFonts: Equal<Parameters<typeof syllBreak>[1], BreakFont | null | undefined> = true;
const targetFonts: Equal<Parameters<typeof fontConvert>[1], BreakFont | undefined> = true;
const sourceFonts: Equal<Parameters<typeof fontConvert>[2], FontName | (string & {}) | null | undefined> = true;
const truncateFonts: Equal<TruncateOptions["fontType"], BreakFont | null | undefined> = true;
const zaw: FontName = "zaw";
const converted: string = fontConvert("ျမန္မာ", "Unicode", zaw);
const debugFrom: string = fontConvert.debugging("ျမန္မာ", "uni", "ZAWGYI").from;
const broken: string = syllBreak("မြန်မာ", "uni", "|");
const spelled: string = spellingFix("ကဳဳ", "win");
const truncateOptions: TruncateOptions = { fontType: "zaw" };
const shortened: string = truncate("မြန်မာ", truncateOptions);
declare const someName: string;
const anyName: string = syllBreak("မြန်မာ", someName);
// @ts-expect-error a font name is a string
syllBreak("မြန်မာ", 1);

// DetectorOptions is GlobalDetectorOptions with the per-call adapter.
const detectorOptions: DetectorOptions = {
  adapter: "myanmartools",
  use_myanmartools: true,
  myanmartools_zg_threshold: [0.05, 0.95]
};
const stored: GlobalDetectorOptions = detectorOptions;
const extendsGlobal: DetectorOptions extends GlobalDetectorOptions ? true : false = true;

// zawgyiDetector takes a myanmar-tools ZawgyiDetector, which has more members than ZawgyiDetectorLike, any object
// with its method, or null.
declare class ToolsDetector {
  model: unknown;
  getZawgyiProbability(input: string): number;
}
const passed: DetectorOptions = { adapter: "myanmartools", zawgyiDetector: new ToolsDetector() };
const storedDetector: GlobalDetectorOptions = { use_myanmartools: true, zawgyiDetector: { getZawgyiProbability: () => 0.5 } };
const noDetector: GlobalDetectorOptions = { zawgyiDetector: null };
const detectorType: Equal<GlobalDetectorOptions["zawgyiDetector"], ZawgyiDetectorLike | null | undefined> = true;
// @ts-expect-error the class is no detector; an instance is
const notInstance: GlobalDetectorOptions = { zawgyiDetector: ToolsDetector };
// @ts-expect-error a detector returns a probability
const notProbability: ZawgyiDetectorLike = { getZawgyiProbability: (text: string) => text };

export {
  noFallback,
  nullFallback,
  emptyFallback,
  literalFallback,
  maybeFallback,
  stringFallback,
  win,
  evidence,
  encodings,
  counts,
  mapped,
  missing,
  noWin,
  breakFonts,
  targetFonts,
  sourceFonts,
  truncateFonts,
  converted,
  debugFrom,
  broken,
  spelled,
  shortened,
  anyName,
  stored,
  extendsGlobal,
  passed,
  storedDetector,
  noDetector,
  detectorType,
  notInstance,
  notProbability
};
