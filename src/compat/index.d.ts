// Types of knayi-myscript/compat, src/compat/index.js: the 2.x API on the 3.0 core (docs/next/DESIGN.md §5). They
// are 2.x's index.d.ts, which 3.0 moved here from the package root; test/package.test.js checks that they declare
// exactly what compat exports, and typecheck/ compiles 2.x code against them.
//
// Array#map calls a function with the line, its index and the array. fontDetect, spellingFix and truncate read that
// index and array as setting nothing, so each has an overload that takes them, and `lines.map(knayi.truncate)`
// type-checks. The overload comes first, since TypeScript reads Parameters and ReturnType from the last signature,
// and has a short JSDoc of its own, since an editor shows each signature's own JSDoc while you type a call. Its array
// is required, so that a direct call with a number in second place, such as `truncate(text, 20)`, still fails to
// compile; the cost is that Array.from(iterable, knayi.truncate), whose map function gets no array, fails too.
// normalize and detectEncoding read one argument, and need an overload only once they take a second. syllBreak and
// fontConvert change what they do for map's arguments, and get none. typecheck/map-callbacks.ts checks these types,
// and test/inputs.test.js what the calls return.

/**
 * A font name knayi reads: `'unicode'` (or `'uni'`), `'zawgyi'` (or `'zaw'`), and `'win'`, the Win Innwa family of
 * legacy fonts. Names are case-insensitive, so `'Unicode'` and `'ZAWGYI'` name the same fonts. A font parameter
 * takes any string; these are the names an editor suggests.
 *
 * Only fontConvert converts `'win'` text, to Unicode. syllBreak and truncate throw a TypeError for it, and
 * spellingFix collapses the Unicode marks.
 */
export type FontName = 'unicode' | 'uni' | 'zawgyi' | 'zaw' | 'win';

/**
 * A Zawgyi detector for the myanmar-tools adapter: a `ZawgyiDetector` of the myanmar-tools package, made with
 * `new ZawgyiDetector()`, or any object with the same method.
 */
export interface ZawgyiDetectorLike {
  /**
   * The probability that the text is Zawgyi rather than Unicode, from 0 to 1. knayi passes the text trimmed and
   * without zero-width spaces and non-joiners, and compares the result with `myanmartools_zg_threshold`.
   */
  getZawgyiProbability(text: string): number;
}

/** Detector settings that setGlobalOptions stores. A fontDetect call may set them for itself too. */
export interface GlobalDetectorOptions {
  /**
   * Detect with the myanmar-tools package instead of knayi's rule scorer: with the detector passed as
   * `zawgyiDetector`, or else with the package, which only main.js loads, in Node and Bun. Install
   * `myanmar-tools@1.1.3` for it. Where there is no detector and the package is not installed, cannot be loaded or is
   * not loaded (as in the builds in dist/), fontDetect uses the rule scorer and warns once. Default `false`.
   */
  use_myanmartools?: boolean;
  /**
   * `[low, high]`: a myanmar-tools Zawgyi probability below `low` is `'unicode'`, above `high` is `'zawgyi'`, and
   * from `low` to `high` is the fallback. Two finite numbers in order, which may be equal. For any other value
   * knayi uses the stored pair and writes an error that starts with `[ERR_KNAYI_INVALID_THRESHOLD]`, unless
   * silent. Default `[0.05, 0.95]`.
   */
  myanmartools_zg_threshold?: [number, number];
  /**
   * The detector the myanmar-tools adapter uses, such as `new ZawgyiDetector()` from myanmar-tools. With it, knayi
   * does not load the package itself, which only main.js does, in Node and Bun, so the adapter also works in
   * browsers, in Deno, in bundles and through the builds in dist/, which load no package by name. It does not choose
   * the adapter: set `use_myanmartools`, or a call's `adapter`, too. `null` is no detector, and main.js loads the
   * package. So is `undefined` when the key is there, as in a spread of options that holds it: it drops a stored
   * detector for the call, and setGlobalOptions removes the stored one. Leave the key out to keep it. For a value
   * without a `getZawgyiProbability` method, knayi uses the stored detector and writes an error that starts with
   * `[ERR_KNAYI_INVALID_DETECTOR]`, unless silent. Default `null`.
   */
  zawgyiDetector?: ZawgyiDetectorLike | null;
}

/** Detector settings for a single fontDetect call. Settings it leaves out come from setGlobalOptions. */
export interface DetectorOptions extends GlobalDetectorOptions {
  /**
   * The detector for this call: `'rules'`, knayi's rule scorer and the default, or `'myanmartools'`, the
   * myanmar-tools package, or the detector from it passed as `zawgyiDetector`. It wins over `use_myanmartools`. Any
   * other name warns unless silent, and the call uses the detector `use_myanmartools` picks. setGlobalOptions does
   * not store it.
   */
  adapter?: 'rules' | 'myanmartools';
}

/** Options for setGlobalOptions. */
export interface GlobalOptions {
  /** Hide every warning and error knayi writes to the console. Default `false`. */
  silent_mode?: boolean;
  /** The detector settings for fontDetect calls that do not set them, and for the functions that detect a font. */
  detector?: GlobalDetectorOptions;
}

/** Options for truncate. */
export interface TruncateOptions {
  /**
   * The length of the result, omission included, in UTF-16 code units: the text is cut to `length` minus the length
   * of the omission. Default 30, also for `0`.
   */
  length?: number;
  /** The text appended to the result. Default `'...'`, also for `''`. */
  omission?: string;
  /**
   * The font of the text, `'unicode'` or `'zawgyi'` (see FontName), as for syllBreak. Omitted, `null`, `''` or a
   * value that is not a string, fontDetect chooses it. `'win'` and unknown names throw a TypeError with the code
   * `'ERR_KNAYI_INVALID_FONT'` for text with a Myanmar letter.
   */
  fontType?: Exclude<FontName, 'win'> | (string & {}) | null;
}

/** What detectEncoding returns: the encoding knayi's rule scorer finds in the text, and its evidence. */
export interface EncodingDetection {
  /**
   * `'unicode'` or `'zawgyi'`: the encoding with more evidence. `'unknown'`: the two counts tie, as they do for short
   * text such as one consonant, or for a line with as much of each. `'none'`: missing content, a value that is not a
   * string, or text with no Myanmar letters (U+1000 to U+109F).
   */
  encoding: 'unicode' | 'zawgyi' | 'unknown' | 'none';
  /** The evidence for Unicode: how many times knayi's Unicode signatures match the text. 0 for `'none'`. */
  unicode: number;
  /** The evidence for Zawgyi: how many times knayi's Zawgyi signatures match the text. 0 for `'none'`. */
  zawgyi: number;
}

/** What fontConvert.debugging reports. */
export interface ConvertDebug {
  /**
   * The target font: `'unicode'` or `'zawgyi'`. Where fontConvert returns before converting, the target as the call
   * reads it: also `'win'`, or `''` for a missing or unknown target.
   */
  to: string;
  /**
   * The source font, as named or detected: `'unicode'`, `'zawgyi'` or `'win'`. `''` where fontConvert returns before
   * converting and the call names no source it knows, or before it detects one.
   */
  from: string;
  /**
   * From Zawgyi or Win, the stages that changed the text, in this order: `'sequences'`, `'glyphs'`, `'syllables'`,
   * `'zero as wa'`, `'typos'`, `'look-alikes'`, `'NFC'`. From Unicode, the regex source of each rule that matched
   * (for a rule rewritten for speed, the source it had before). Empty where fontConvert returns before converting.
   */
  matched_patterns: string[];
  /** The text before the first entry of `matched_patterns`, then after each entry. The last is fontConvert's result. */
  steps: string[];
}

/** The version of this copy of knayi, such as `'2.10.0'`. */
export declare const version: string;

/**
 * Sets options for this copy of knayi. `silent_mode: true` hides every warning and error knayi writes to the console.
 * `detector` sets the detector settings; a later call that sets only `use_myanmartools` keeps the stored threshold
 * and `zawgyiDetector`. `null`, like `undefined`, sets nothing.
 *
 * In Node, `require` and `import` share one copy, main.js. A bundler that follows the `module` field loads
 * dist/knayi-myscript.es.js instead, a second copy with options of its own.
 */
export declare function setGlobalOptions(options?: GlobalOptions | null): void;

// The result type is string, as for a fallback of any string: a call with three arguments whose fallback and options
// are typed any can match this signature, and then it may return that fallback.
/**
 * fontDetect as an Array#map callback: `lines.map(knayi.fontDetect)` gives each line what `fontDetect(line)` gives.
 * The index map passes is no fallback, and the array sets no option. The other signature has the details.
 */
export declare function fontDetect(
  content: string | null | undefined,
  index: number,
  array: ReadonlyArray<string | null | undefined>
): string;
/**
 * Tells whether text is Unicode or Zawgyi: returns `'unicode'` or `'zawgyi'`, never `'win'`.
 *
 * When the rule scores tie, or a myanmar-tools probability falls between the thresholds, it returns the fallback, or
 * `'zawgyi'` if there is none. Short Unicode text, such as one consonant, often ties. Missing content (`null`,
 * `undefined`, `''`, `0`, `false`, `NaN`) and text with no Myanmar letters (U+1000 to U+109F) return the fallback,
 * or `'en'` if there is none. detectEncoding gives the rule scorer's evidence, and tells a tie apart from text with no
 * Myanmar letters.
 *
 * `lines.map(knayi.fontDetect)` works: map passes each line's index as the fallback, which is no fallback, and the
 * array as the options, which set none, so each line gives what `fontDetect(line)` gives. TypeScript types the result
 * as `string[]`: it reads fontDetect passed as a value with any string as the fallback, as it reads
 * `ReturnType<typeof fontDetect>`. For `'unicode' | 'zawgyi' | 'en'`, write
 * `lines.map((line) => knayi.fontDetect(line))`.
 *
 * @param content The text.
 * @param fallbackFontType What to return when the text does not decide. It is returned as given. A value that is not
 * a string, such as the index Array#map passes, is no fallback, and neither is `''`.
 * @param options Detector settings for this call. `null`, like `undefined`, uses the settings setGlobalOptions stored.
 * @example
 * ```js
 * knayi.fontDetect('မဂၤလာပါ') // 'zawgyi'
 * knayi.fontDetect('မင်္ဂလာပါ') // 'unicode'
 * knayi.fontDetect('က') // 'zawgyi'
 * knayi.fontDetect('က', 'unicode') // 'unicode'
 * knayi.fontDetect(null) // 'en'
 * ```
 */
export declare function fontDetect<Fallback extends string | null | undefined = undefined>(
  content: string | null | undefined,
  fallbackFontType?: Fallback,
  options?: DetectorOptions | null
): 'unicode' | 'zawgyi' | (Fallback extends '' | null | undefined ? 'en' : Fallback);

/**
 * Tells whether text is Unicode or Zawgyi, with the evidence: returns `{ encoding, unicode, zawgyi }`
 * (EncodingDetection). The encoding is never `'win'`.
 *
 * It scores the text as fontDetect's rule scorer does, after trimming it and removing zero-width spaces and
 * non-joiners, and tells a tie (`'unknown'`) apart from text with no Myanmar letters (`'none'`). fontDetect with the
 * rule scorer returns `encoding` when it is `'unicode'` or `'zawgyi'`, and otherwise the fallback, or, with none,
 * `'zawgyi'` for `'unknown'` and `'en'` for `'none'`. detectEncoding always uses the rule scorer, whatever the
 * detector settings say. Missing content warns unless silent.
 *
 * It reads one argument, so `lines.map(knayi.detectEncoding)` works.
 *
 * @param content The text.
 * @example
 * ```js
 * knayi.detectEncoding('မဂၤလာပါ') // { encoding: 'zawgyi', unicode: 0, zawgyi: 1 }
 * knayi.detectEncoding('မြန်မာ') // { encoding: 'unicode', unicode: 2, zawgyi: 0 }
 * knayi.detectEncoding('က') // { encoding: 'unknown', unicode: 0, zawgyi: 0 }
 * knayi.detectEncoding('abc') // { encoding: 'none', unicode: 0, zawgyi: 0 }
 * ```
 */
export declare function detectEncoding(content: string | null | undefined): EncodingDetection;

/**
 * Converts text between Unicode and Zawgyi, and from Win to Unicode.
 *
 * The text is trimmed first; zero-width spaces and non-joiners stay. Text with no Myanmar letters comes back
 * unchanged, except from Win, whose text is ASCII. A missing or unknown target, a Win target, and Win to Zawgyi
 * return the text, with an error unless silent. Missing content returns `''`.
 *
 * Don't pass fontConvert to Array#map as it is: map passes each line's index as the target, which is no font, so each
 * line comes back unconverted, with an error unless silent, and the types refuse it. Write
 * `lines.map((line) => knayi.fontConvert(line, 'unicode'))`.
 *
 * @param content The text.
 * @param targetFontType The font to convert to: `'unicode'` or `'zawgyi'`.
 * @param originalFontType The font of the text: `'unicode'`, `'zawgyi'` or `'win'`. Omitted, `null` or an unknown
 * name (which warns unless silent), fontDetect chooses it, and a tie reads the text as Zawgyi: name the source font
 * for short text.
 * @example
 * ```js
 * knayi.fontConvert('မဂၤလာပါ', 'unicode', 'zawgyi') // 'မင်္ဂလာပါ'
 * knayi.fontConvert('မြန်မာ', 'zawgyi', 'unicode') // 'ျမန္မာ'
 * knayi.fontConvert('jrefrm', 'unicode', 'win') // 'မြန်မာ'
 * ```
 */
export declare function fontConvert(
  content: string | null | undefined,
  targetFontType?: Exclude<FontName, 'win'> | (string & {}),
  originalFontType?: FontName | (string & {}) | null
): string;

export declare namespace fontConvert {
  /**
   * Converts like fontConvert, and reports each step (ConvertDebug). The last step is what fontConvert returns.
   *
   * Where fontConvert returns before converting, the report has an empty `matched_patterns` and one step, what
   * fontConvert returns: for missing content (`''`), text with no Myanmar letters, a missing or unknown target, the
   * same source and target, and a Win direction knayi does not convert. Content that is not a string, such as a
   * number, comes back unchanged, as from fontConvert.
   *
   * @example
   * ```js
   * knayi.fontConvert.debugging('ေစ်း', 'unicode', 'zawgyi')
   * // { to: 'unicode', from: 'zawgyi', matched_patterns: ['glyphs', 'syllables'], steps: ['ေစ်း', 'ေစျး', 'ဈေး'] }
   * knayi.fontConvert.debugging(' ကျ ', 'unicode', 'unicode')
   * // { to: 'unicode', from: 'unicode', matched_patterns: [], steps: ['ကျ'] }
   * ```
   */
  function debugging(
    content: string,
    targetFontType?: Exclude<FontName, 'win'> | (string & {}),
    originalFontType?: FontName | (string & {}) | null
  ): ConvertDebug;
}

/**
 * Puts a break between the syllables of Unicode or Zawgyi text, and returns one string.
 *
 * The text is trimmed, and its zero-width spaces and non-joiners removed, first. Text with no Myanmar letters comes
 * back unchanged, and missing content as `''`.
 *
 * Don't pass syllBreak to Array#map as it is: map passes each line's index as the font and the array as the break
 * point, and the types refuse it. Write `lines.map((line) => knayi.syllBreak(line))`.
 *
 * @param content The text.
 * @param fontType `'unicode'` or `'zawgyi'` (see FontName). Omitted, `null`, `''` or a value that is not a string,
 * fontDetect chooses it. `'win'` and unknown names throw a TypeError with the code `'ERR_KNAYI_INVALID_FONT'` for
 * text with a Myanmar letter.
 * @param breakPoint The text put between syllables. U+200B (zero-width space) when omitted or falsy.
 * @example
 * ```js
 * knayi.syllBreak('မြန်မာ', 'unicode', '|') // 'မြန်|မာ'
 * knayi.syllBreak('ၾကပါ', 'zawgyi', '|') // 'ၾက|ပါ'
 * ```
 */
export declare function syllBreak(
  content: string | null | undefined,
  fontType?: Exclude<FontName, 'win'> | (string & {}) | null,
  breakPoint?: string
): string;

/**
 * spellingFix as an Array#map callback: `lines.map(knayi.spellingFix)` gives each line what `spellingFix(line)`
 * gives. The index map passes names no font, so fontDetect chooses it, and the array is not read. The other
 * signature has the details.
 */
export declare function spellingFix(
  content: string | null | undefined,
  index: number,
  array: ReadonlyArray<string | null | undefined>
): string;
/**
 * Collapses a mark typed two or more times in a row into one mark. It does not reorder marks: that is normalize.
 *
 * The text is trimmed, and its zero-width spaces and non-joiners removed, first. Text with no Myanmar letters comes
 * back unchanged, and missing content as `''`.
 *
 * `lines.map(knayi.spellingFix)` works: map passes each line's index as the font, which names no font, so fontDetect
 * chooses each line's font, as in `spellingFix(line)`.
 *
 * @param content The text.
 * @param fontType `'zawgyi'` or `'zaw'` (see FontName), in any letter case, collapses the Zawgyi marks, and any other
 * name, `'win'` included, the Unicode marks. Omitted, `null`, `''` or a value that is not a string, fontDetect
 * chooses the font.
 * @example
 * ```js
 * knayi.spellingFix('မင်္ဂလာာပါါ', 'unicode') // 'မင်္ဂလာပါ'
 * knayi.spellingFix('ကိီ', 'unicode') // 'ကိီ'
 * ```
 */
export declare function spellingFix(
  content: string | null | undefined,
  fontType?: FontName | (string & {}) | null
): string;

/**
 * truncate as an Array#map callback: `lines.map(knayi.truncate)` gives each line what `truncate(line)` gives. The
 * index map passes sets no option, so each line gets the defaults, and the array is not read. The other signature
 * has the details.
 */
export declare function truncate(
  content: string | null | undefined,
  index: number,
  array: ReadonlyArray<string | null | undefined>
): string;
/**
 * Returns the longest start of the text that fits in `length`, omission included, and ends at a syllable break or
 * after whitespace, trimmed, and appends the omission, even to text that is shorter than `length`. Text with no
 * Myanmar letters is cut at the length. `''` returns the omission, and missing content `''`. Other values are
 * turned into strings first.
 *
 * `lines.map(knayi.truncate)` works: map passes each line's index as the options, which set none, so each line gets
 * the defaults, as in `truncate(line)`.
 *
 * @param content The text.
 * @param options `length` (default 30), `omission` (default `'...'`) and the font, `fontType`.
 * @example
 * ```js
 * knayi.truncate('မြန်မာ နိုင်ငံ', { length: 10 }) // 'မြန်မာ...'
 * knayi.truncate('က') // 'က...'
 * knayi.truncate('') // '...'
 * ```
 */
export declare function truncate(content: string | null | undefined, options?: TruncateOptions): string;

/**
 * Puts each syllable of Unicode text in Unicode storage order (UTN #11), makes a few typing fixes, and returns NFC.
 * Unicode only: convert Zawgyi text with fontConvert first.
 *
 * Text with no character of the Myanmar blocks comes back in NFC only. Missing content returns `''`.
 *
 * It reads one argument, so `lines.map(knayi.normalize)` works.
 *
 * @param content The text.
 * @example
 * ```js
 * knayi.normalize('လည်းေကာင်း') // 'လည်းကောင်း'
 * knayi.normalize('၂ဝ၁၉') // '၂၀၁၉'
 * knayi.normalize('ကိီ') // 'ကီ'
 * ```
 */
export declare function normalize(content: string | null | undefined): string;

/** Everything knayi exports, as one object: the default export. */
export interface Knayi {
  /** The version of this copy of knayi, such as `'2.10.0'`. */
  version: typeof version;
  /** Sets options for this copy of knayi: silent mode and the detector settings. */
  setGlobalOptions: typeof setGlobalOptions;
  /** Tells whether text is Unicode or Zawgyi. */
  fontDetect: typeof fontDetect;
  /** Tells whether text is Unicode or Zawgyi, with the evidence. */
  detectEncoding: typeof detectEncoding;
  /** Converts text between Unicode and Zawgyi, and from Win to Unicode. */
  fontConvert: typeof fontConvert;
  /** Puts a break between syllables. */
  syllBreak: typeof syllBreak;
  /** Collapses a mark typed two or more times in a row into one mark. */
  spellingFix: typeof spellingFix;
  /** Cuts text on its syllable breaks, and appends an omission. */
  truncate: typeof truncate;
  /** Puts Unicode text in storage order, with a few typing fixes, as NFC. */
  normalize: typeof normalize;
}

/** Everything knayi exports, as one object, for `import knayi from 'knayi-myscript'`. */
declare const knayi: Knayi;
export default knayi;
