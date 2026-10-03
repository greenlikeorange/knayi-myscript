// Types for knayi-myscript (main.js). library/converter.d.ts types the deep path knayi-myscript/library/converter.
// In 2.x this file may only grow (ARCHITECTURE.md, "Stable surfaces"). test/readme.test.js runs the examples below.

/**
 * A font name knayi reads: `'unicode'` (or `'uni'`), `'zawgyi'` (or `'zaw'`), and `'win'`, the Win Innwa family of
 * legacy fonts. Names are case-insensitive, so `'Unicode'` and `'ZAWGYI'` name the same fonts. A font parameter
 * takes any string; these are the names an editor suggests.
 *
 * Only fontConvert converts `'win'` text, to Unicode. syllBreak and truncate throw a TypeError for it, and
 * spellingFix collapses the Unicode marks.
 */
export type FontName = 'unicode' | 'uni' | 'zawgyi' | 'zaw' | 'win';

/** Detector settings that setGlobalOptions stores. A fontDetect call may set them for itself too. */
export interface GlobalDetectorOptions {
  /**
   * Detect with the myanmar-tools package instead of knayi's rule scorer. Install `myanmar-tools@1.1.3` for it. If
   * the package is not installed or cannot be loaded, fontDetect uses the rule scorer and warns once. Default
   * `false`.
   */
  use_myanmartools?: boolean;
  /**
   * `[low, high]`: a myanmar-tools Zawgyi probability below `low` is `'unicode'`, above `high` is `'zawgyi'`, and
   * from `low` to `high` is the fallback. Two finite numbers in order, which may be equal. For any other value
   * knayi uses the stored pair and writes an error that starts with `[ERR_KNAYI_INVALID_THRESHOLD]`, unless
   * silent. Default `[0.05, 0.95]`.
   */
  myanmartools_zg_threshold?: [number, number];
}

/** Detector settings for a single fontDetect call. Settings it leaves out come from setGlobalOptions. */
export interface DetectorOptions extends GlobalDetectorOptions {
  /**
   * The detector for this call: `'rules'`, knayi's rule scorer and the default, or `'myanmartools'`, the
   * myanmar-tools package. It wins over `use_myanmartools`. Any other name warns unless silent, and the call uses
   * the detector `use_myanmartools` picks. setGlobalOptions does not store it.
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

/** What fontConvert.debugging reports. */
export interface ConvertDebug {
  /** The target font: `'unicode'` or `'zawgyi'`. */
  to: string;
  /** The source font, as named or detected: `'unicode'`, `'zawgyi'` or `'win'`. */
  from: string;
  /**
   * From Zawgyi or Win, the stages that changed the text, in this order: `'sequences'`, `'glyphs'`, `'syllables'`,
   * `'zero as wa'`, `'look-alikes'`, `'typos'`, `'NFC'`. From Unicode, the regex source of each rule that matched
   * (for a rule rewritten for speed, the source it had before).
   */
  matched_patterns: string[];
  /** The text before the first entry of `matched_patterns`, then after each entry. The last is fontConvert's result. */
  steps: string[];
}

/** The version of this copy of knayi, such as `'2.10.0'`. */
export declare const version: string;

/**
 * Sets options for this copy of knayi. `silent_mode: true` hides every warning and error knayi writes to the console.
 * `detector` sets the detector settings; a later call that sets only `use_myanmartools` keeps the stored threshold.
 * `null`, like `undefined`, sets nothing.
 *
 * In Node, `require` and `import` share one copy, main.js. A bundler that follows the `module` field loads
 * dist/knayi-myscript.es.js instead, a second copy with options of its own.
 */
export declare function setGlobalOptions(options?: GlobalOptions | null): void;

/**
 * Tells whether text is Unicode or Zawgyi: returns `'unicode'` or `'zawgyi'`, never `'win'`.
 *
 * When the rule scores tie, or a myanmar-tools probability falls between the thresholds, it returns the fallback, or
 * `'zawgyi'` if there is none. Short Unicode text, such as one consonant, often ties. Missing content (`null`,
 * `undefined`, `''`, `0`, `false`, `NaN`) and text with no Myanmar letters (U+1000 to U+109F) return the fallback,
 * or `'en'` if there is none.
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
 * Converts text between Unicode and Zawgyi, and from Win to Unicode.
 *
 * The text is trimmed first; zero-width spaces and non-joiners stay. Text with no Myanmar letters comes back
 * unchanged, except from Win, whose text is ASCII. A missing or unknown target, a Win target, and Win to Zawgyi
 * return the text, with an error unless silent. Missing content returns `''`.
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
   * Where fontConvert returns before converting, this returns the same value, not a ConvertDebug: for missing
   * content, content that is not a string, text with no Myanmar letters, a missing or unknown target, the same
   * source and target, and a Win direction knayi does not convert.
   *
   * @example
   * ```js
   * knayi.fontConvert.debugging('ေစ်း', 'unicode', 'zawgyi')
   * // { to: 'unicode', from: 'zawgyi', matched_patterns: ['glyphs', 'syllables'], steps: ['ေစ်း', 'ေစျး', 'ဈေး'] }
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
 * point. Write `lines.map((line) => knayi.syllBreak(line))`.
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
 * Collapses a mark typed two or more times in a row into one mark. It does not reorder marks: that is normalize.
 *
 * The text is trimmed, and its zero-width spaces and non-joiners removed, first. Text with no Myanmar letters comes
 * back unchanged, and missing content as `''`.
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
 * Cuts text on its syllable breaks, then on the spaces inside a syllable that does not fit, and appends the
 * omission, even to text that is shorter than `length`. Text with no Myanmar letters is cut at the length. `''`
 * returns the omission, and missing content `''`. Other values are turned into strings first.
 *
 * @param content The text.
 * @param options `length` (default 30), `omission` (default `'...'`) and the font, `fontType`.
 * @example
 * ```js
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
