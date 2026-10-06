// knayi functions passed straight to Array#map, which calls them with the line, its index and the array. index.d.ts
// gives fontDetect, spellingFix and truncate an overload for those arguments, before the signature with the options;
// normalize and detectEncoding read one argument. Without the overloads, an options parameter fails here with "Type
// 'number' has no properties in common with" its type (TS2559, inside TS2345). npm test compiles this file with and
// without esModuleInterop; it never runs. test/inputs.test.js checks what the same calls return.
import knayi, { detectEncoding, fontConvert, fontDetect, normalize, spellingFix, syllBreak, truncate } from "knayi-myscript";
import type { DetectorOptions, EncodingDetection, FontName, Knayi, TruncateOptions } from "knayi-myscript";

// true only when A and B are the same type.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

declare const lines: string[];
declare const frozen: readonly string[];
declare const gaps: Array<string | null | undefined>;

// Each one type-checks as a map callback.
const normalized: string[] = lines.map(normalize);
const evidence: EncodingDetection[] = lines.map(detectEncoding);
const spelled: string[] = lines.map(spellingFix);
const truncated: string[] = lines.map(truncate);
const detected = lines.map(fontDetect);
// TypeScript reads a function passed as a value by its last signature, here with any string as the fallback, as
// ReturnType does: so map gives string[]. A callback that passes the line alone keeps the literal types.
const detectedType: Equal<typeof detected, string[]> = true;
const returnType: Equal<ReturnType<typeof fontDetect>, string> = true;
const literal: Array<"unicode" | "zawgyi" | "en"> = lines.map((line) => fontDetect(line));

// The same through the default export and the Knayi type, on a readonly array, and on lines that may be missing.
const fromDefault: string[] = lines.map(knayi.truncate);
const all: Knayi = knayi;
const fromKnayi: string[] = frozen.map(all.spellingFix);
const fromFrozen: string[] = frozen.map(truncate);
const fromGaps: string[] = gaps.map(normalize);
const gapsDetected: string[] = gaps.map(fontDetect);
// The overloads take the array as a required third argument, so that a direct call with a number in second place
// still fails (below). The cost: Array.from's map function gets the value and the index only, and does not fit.
// @ts-expect-error write Array.from(set, (line) => spellingFix(line))
Array.from(new Set(lines), spellingFix);

// The overloads change no direct call: a call with a number in second place fits neither signature, as before them,
// though at run time the number sets nothing. Parameters and ReturnType read the signature with the options.
// @ts-expect-error truncate's second argument is its options, not a length
truncate("ကျ", 20);
// @ts-expect-error a number is no font
spellingFix("ကျ", 1);
// @ts-expect-error a number is no fallback
fontDetect("ကျ", 2);
const truncateParameters: Equal<Parameters<typeof truncate>, [string | null | undefined, TruncateOptions?]> = true;
const spellingParameters: Equal<
  Parameters<typeof spellingFix>,
  [string | null | undefined, (FontName | (string & {}) | null)?]
> = true;
const detectParameters: Equal<
  Parameters<typeof fontDetect>,
  [string | null | undefined, (string | null | undefined)?, (DetectorOptions | null)?]
> = true;
const withTie = fontDetect("ကျ", "tie", { adapter: "rules" });
const tieType: Equal<typeof withTie, "unicode" | "zawgyi" | "tie"> = true;
const noFallback = fontDetect("ကျ");
const noFallbackType: Equal<typeof noFallback, "unicode" | "zawgyi" | "en"> = true;
// A call with three arguments, the last two typed any, matches the map overload, whose result is string, as is the
// result for a fallback typed string: the fallback typed any may be returned. With two arguments typed any, a call
// still gives any, as before the overloads.
declare const anyValue: any;
const anyFallbackAndOptions = fontDetect("ကျ", anyValue, anyValue);
const anyFallbackAndOptionsType: Equal<typeof anyFallbackAndOptions, string> = true;
const anyFallback = fontDetect("ကျ", anyValue);
const anyFallbackType: Equal<typeof anyFallback, any> = true;
const anyTextAndFallback = fontDetect(anyValue, anyValue);
const anyTextAndFallbackType: Equal<typeof anyTextAndFallback, any> = true;
// @ts-expect-error a misspelt option is still an error
truncate("ကျ", { lenght: 10 });
// @ts-expect-error so is an adapter knayi does not have
fontDetect("ကျ", null, { adapter: "tools" });

// syllBreak and fontConvert have no overload: map's index would be syllBreak's font and the array its break point,
// and the index would be fontConvert's target, which is no font.
// @ts-expect-error
lines.map(syllBreak);
// @ts-expect-error
lines.map(fontConvert);
// @ts-expect-error
lines.map(fontConvert.debugging);
const broken: string[] = lines.map((line) => syllBreak(line));

// A function written as one of these types takes map's arguments too: here, options that may be a number.
const double: Knayi["truncate"] = (content: string | null | undefined, options?: TruncateOptions | number) =>
  String(content) + (typeof options === "object" && options.omission ? options.omission : "...");
// @ts-expect-error options that may not be a number do not fit the map overload
const optionsOnly: Knayi["truncate"] = (content: string | null | undefined, options?: TruncateOptions) =>
  String(content) + (options && options.omission ? options.omission : "...");

export {
  normalized,
  evidence,
  spelled,
  truncated,
  detected,
  detectedType,
  returnType,
  literal,
  fromDefault,
  fromKnayi,
  fromFrozen,
  fromGaps,
  gapsDetected,
  truncateParameters,
  spellingParameters,
  detectParameters,
  tieType,
  noFallbackType,
  anyFallbackAndOptionsType,
  anyFallbackType,
  anyTextAndFallbackType,
  broken,
  double,
  optionsOnly
};
