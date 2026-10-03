/** Detector settings for a single fontDetect call. */
export interface DetectorOptions {
  use_myanmartools?: boolean;
  myanmartools_zg_threshold?: [number, number];
  adapter?: 'rules' | 'myanmartools';
}

/** Detector settings that setGlobalOptions stores. `adapter` only applies per call. */
export interface GlobalDetectorOptions {
  use_myanmartools?: boolean;
  myanmartools_zg_threshold?: [number, number];
}

export interface GlobalOptions {
  silent_mode?: boolean;
  detector?: GlobalDetectorOptions;
}

export interface TruncateOptions {
  length?: number;
  omission?: string;
  fontType?: string | null;
}

export interface ConvertDebug {
  to: string;
  from: string;
  matched_patterns: string[];
  steps: string[];
}

export declare const version: string;

/** `null`, like `undefined`, sets nothing. */
export declare function setGlobalOptions(options?: GlobalOptions | null): void;

/** `options` of `null`, like `undefined`, uses the detector settings that setGlobalOptions stored. */
export declare function fontDetect(
  content: string | null | undefined,
  fallbackFontType?: string | null,
  options?: DetectorOptions | null
): string;

export declare const fontConvert: ((
  content: string | null | undefined,
  targetFontType?: string,
  originalFontType?: string | null
) => string) & {
  debugging(
    content: string,
    targetFontType?: string,
    originalFontType?: string | null
  ): ConvertDebug;
};

export declare function syllBreak(
  content: string | null | undefined,
  fontType?: string | null,
  breakPoint?: string
): string;

export declare function spellingFix(content: string | null | undefined, fontType?: string | null): string;

export declare function truncate(content: string | null | undefined, options?: TruncateOptions): string;

export declare function normalize(content: string | null | undefined): string;

export interface Knayi {
  version: typeof version;
  setGlobalOptions: typeof setGlobalOptions;
  fontDetect: typeof fontDetect;
  fontConvert: typeof fontConvert;
  syllBreak: typeof syllBreak;
  spellingFix: typeof spellingFix;
  truncate: typeof truncate;
  normalize: typeof normalize;
}

declare const knayi: Knayi;
export default knayi;
