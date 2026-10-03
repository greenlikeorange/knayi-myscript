// Types of the knayi 3.0 API, src/index.js (docs/next/DESIGN.md §11). Hand-written; typecheck/next/ compiles code
// against them, and test/next/api/types.test.mjs checks that they declare exactly what src/index.js exports.
//
// Every function takes the text first and its options second. Options are per call and in camelCase; an option
// that is undefined or null takes its default. Every function is map-safe: lines.map(normalize) passes an index
// where the options go, which counts as no options. A bad argument throws a KnayiError: a TypeError with the code
// 'ERR_KNAYI_INVALID_ARG_TYPE' for a wrong type, a RangeError with 'ERR_KNAYI_INVALID_ARG_VALUE' for a value knayi
// does not accept.

/** The package version, as in package.json. */
export declare const VERSION: string;

/**
 * The version of knayi's output. It goes up with every deliberate change to what any function returns, so a
 * dataset that records it knows when its text needs normalizing or converting again (decision 33).
 */
export declare const OUTPUT_VERSION: number;

/** The `code` of every error knayi throws on purpose. */
export type KnayiErrorCode = 'ERR_KNAYI_INVALID_ARG_TYPE' | 'ERR_KNAYI_INVALID_ARG_VALUE';

/** An error knayi throws on purpose: a TypeError or RangeError with a code. */
export interface KnayiError extends Error {
  code: KnayiErrorCode;
}

/** One step of a trace: the text after a stage or rule that changed it. */
export interface TraceRecord {
  /** The stage's or rule's stable id, such as 'syllables' or 'uz.kinzi.2'. */
  id: string;
  /** Its name in 2.x's debug log, such as 'syllables' or a rule's regex source. */
  label: string;
  /** The whole text after the step. */
  text: string;
}

/** What a call with a `trace` option fills: its input, then each step that changed the text. */
export interface Trace {
  start: string | null;
  records: TraceRecord[];
}

/** An empty trace, `{ start: null, records: [] }`, for the `trace` option of normalize, toUnicode and toZawgyi. */
export declare function createTrace(): Trace;

// ---------------------------------------------------------------------------------------------------------------
// normalize and isNormalized

/** The ids of the stages of normalize, in the order they run. */
export type NormalizeStageId = 'nfc.input' | 'syllables' | 'typos' | 'look-alikes' | 'nfc.final';

export interface NormalizeOptions {
  /** true: return `{ text, changes }` instead of the text. */
  report?: boolean | null;
  /** A trace from createTrace(), to fill with the text after each stage of each pass that changed it. */
  trace?: Trace | null;
}

/** One change normalize made: `before`, at text[start, end), became `after`, at output[outputStart, outputEnd). */
export interface NormalizeChange {
  start: number;
  end: number;
  before: string;
  after: string;
  outputStart: number;
  outputEnd: number;
  /** The stages that made it, in the order they ran. */
  rules: NormalizeStageId[];
}

export interface NormalizeReport {
  text: string;
  changes: NormalizeChange[];
}

/**
 * Unicode Burmese text in the storage order of UTN #11, with its typing slips and look-alike digits fixed, in NFC.
 * Idempotent: normalize(normalize(text)) === normalize(text). Never trims; zero-width characters stay.
 */
export declare function normalize(text: string, options: NormalizeOptions & { report: true }): NormalizeReport;
export declare function normalize(text: string, options?: NormalizeOptions | number | null): string;

/** Whether normalize would return the text unchanged. It does not tell Zawgyi from Unicode. */
export declare function isNormalized(text: string): boolean;

// ---------------------------------------------------------------------------------------------------------------
// detectEncoding

/** The shape of myanmar-tools' ZawgyiDetector that knayi uses. */
export interface ZawgyiDetector {
  getZawgyiProbability(text: string): number;
}

export interface DetectorOptions {
  /** myanmar-tools' ZawgyiDetector, or any object with the same method, to decide instead of the rule evidence. */
  zawgyiDetector?: ZawgyiDetector | null;
  /** [low, high]: a Zawgyi probability below low is Unicode, above high Zawgyi. Default [0.05, 0.95]. */
  thresholds?: readonly [number, number] | null;
}

export type Encoding = 'unicode' | 'zawgyi' | 'unknown' | 'none';

export interface EncodingEvidence {
  /** 'none' with no character of U+1000-U+109F, 'unknown' when the evidence ties. */
  encoding: Encoding;
  /** Matches of the Unicode signatures. */
  unicode: number;
  /** Matches of the Zawgyi signatures. */
  zawgyi: number;
  /** With a zawgyiDetector: its probability that the text is Zawgyi. */
  zawgyiProbability?: number;
}

/** Whether text is Unicode or Zawgyi, with the evidence. */
export declare function detectEncoding(text: string, options?: DetectorOptions | number | null): EncodingEvidence;

// ---------------------------------------------------------------------------------------------------------------
// explain

/** What an issue of explain is about. */
export type IssueKind = 'zawgyi' | 'order' | 'mark' | 'look-alike' | 'typo' | 'nfc';

/** The rule ids of explain, one for each thing it finds. */
export type IssueRule =
  | 'encoding.zawgyi'
  | 'order.prebase'
  | 'order.marks'
  | 'mark.space'
  | 'mark.repeated'
  | 'asat.dropped'
  | 'look-alike.u-as-nya'
  | 'look-alike.seven-as-ra'
  | 'look-alike.zero-as-wa'
  | 'look-alike.ca-as-jha'
  | 'look-alike.wa-as-zero'
  | 'look-alike.ra-as-seven'
  | 'typo.ii'
  | 'typo.uu'
  | 'typo.au'
  | 'typo.lagaung'
  | 'nfc.order';

/** One issue of a text: text[start, end), which is `text`, has it, and `fix` is what belongs there. */
export interface Issue {
  kind: IssueKind;
  rule: IssueRule;
  start: number;
  end: number;
  text: string;
  /** What normalize writes there; for a Zawgyi line, the line in Unicode. */
  fix: string;
}

/**
 * The issues of a text, by start: lines that read as Zawgyi, and in the other lines each thing normalize changes.
 */
export declare function explain(text: string, options?: DetectorOptions | number | null): Issue[];

// ---------------------------------------------------------------------------------------------------------------
// toUnicode and toZawgyi

/** The fonts toUnicode converts from. */
export type SourceFont = 'unicode' | 'zawgyi' | 'win';

export interface ToUnicodeOptions extends DetectorOptions {
  /** The font of the text. Not given: each line is detected; Win text cannot be, and needs from: 'win'. */
  from?: SourceFont | null;
  /** How a line whose detection ties is read: 'unicode' (left as it is, the default) or 'zawgyi' (as 2.x did). */
  tie?: 'unicode' | 'zawgyi' | null;
  /** A trace from createTrace(), to fill with the text after each stage of the font pipeline that changed it. */
  trace?: Trace | null;
  /** true: return `{ text, offsets }`. */
  offsets?: boolean | null;
}

export interface ConversionWithOffsets {
  text: string;
  /** offsets[i]: the index in the input of the unit output unit i came from; offsets[text.length]: input length. */
  offsets: number[];
}

/** Text in Unicode. Never trims. */
export declare function toUnicode(text: string, options: ToUnicodeOptions & { offsets: true }): ConversionWithOffsets;
export declare function toUnicode(text: string, options?: ToUnicodeOptions | number | null): string;

export interface ToZawgyiOptions {
  /** A trace from createTrace(), to fill with the text after the collapse and after each rule that changed it. */
  trace?: Trace | null;
}

/** Unicode text in Zawgyi. */
export declare function toZawgyi(text: string, options?: ToZawgyiOptions | number | null): string;
