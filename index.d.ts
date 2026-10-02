interface DetectorOptions {
  use_myanmartools?: boolean;
  myanmartools_zg_threshold?: [number, number];
  adapter?: 'rules' | 'myanmartools';
}

interface GlobalOptions {
  silent_mode?: boolean;
  detector?: DetectorOptions;
}

interface TruncateOptions {
  length?: number;
  omission?: string;
  fontType?: string | null;
}

interface ConvertDebug {
  to: string;
  from: string;
  matched_patterns: string[];
  steps: string[];
}

interface Knayi {
  version: string;
  setGlobalOptions(options?: GlobalOptions): void;
  fontDetect(
    content: string | null | undefined,
    fallbackFontType?: string | null,
    options?: DetectorOptions
  ): string;
  fontConvert: ((
    content: string | null | undefined,
    targetFontType?: string,
    originalFontType?: string
  ) => string) & {
    debugging(
      content: string,
      targetFontType?: string,
      originalFontType?: string
    ): ConvertDebug;
  };
  syllBreak(
    content: string | null | undefined,
    fontType?: string | null,
    breakPoint?: string
  ): string;
  spellingFix(content: string | null | undefined, fontType?: string): string;
  truncate(content: string | null | undefined, options?: TruncateOptions): string;
  normalize(content: string | null | undefined): string;
}

declare const knayi: Knayi;
export = knayi;
