// Types of knayi 3.0's streams, src/stream.js (docs/next/DESIGN.md §12). Hand-written; typecheck/next/ compiles code
// against them, and test/next/api/types.test.mjs checks that they declare exactly what src/stream.js exports.
//
// A stream cuts its text into lines at '\n'; a '\r' right before it belongs to the line's ending. Each line goes
// through a function without its ending, and the ending goes out after the result as it came. A bad argument, chunk
// or result throws a KnayiError (src/index.d.ts): a TypeError with the code 'ERR_KNAYI_INVALID_ARG_TYPE', a RangeError
// with 'ERR_KNAYI_INVALID_ARG_VALUE', or, for a line longer than maxLineLength, 'ERR_KNAYI_LINE_TOO_LONG'; with no
// TransformStream, or bytes and no TextDecoder, an Error with 'ERR_KNAYI_UNSUPPORTED_RUNTIME'. A stream that throws
// is errored: its readable side rejects, and stream.pipeline calls back with the error.
//
// The streams are the runtime's TransformStream, so these types name the global TransformStream type, which a
// project has from TypeScript's DOM library or from @types/node (typecheck/packed/stream.mts compiles with the
// first). The types of '.' and './compat' need neither.

import type { DetectorOptions, SourceFont } from './index.js';

/**
 * A chunk of a stream's text: a string, or UTF-8 bytes (an ArrayBuffer, or a view of one such as a Uint8Array or a
 * Node Buffer). A stream takes strings or bytes, not both.
 */
export type Chunk = string | ArrayBuffer | ArrayBufferView;

export interface LineOptions {
  /**
   * The most UTF-16 units a line may hold, its ending not counted: a whole number of 1 or more, or Infinity for no
   * limit. Default 1,048,576. A line that passes it throws 'ERR_KNAYI_LINE_TOO_LONG'; it is never cut.
   */
  maxLineLength?: number | null;
}

/** The line cutter every stream runs on. */
export interface LineMapper {
  /** The text of the lines this chunk completes, each through the function and with its ending; '' for none. */
  transform(chunk: Chunk): string;
  /** The last line, through the function, when the text did not end with '\n', else ''. Then it starts again. */
  flush(): string;
}

/** A line cutter with no stream class: for a Node Transform, a loop, or a runtime with no TransformStream. */
export declare function mapLines(fn: (line: string) => string, options?: LineOptions | number | null): LineMapper;

/**
 * A TransformStream that gives each line to fn and writes what it returns, then the line's ending. Node's
 * stream.pipeline takes it between Node streams. Throws 'ERR_KNAYI_UNSUPPORTED_RUNTIME' with no TransformStream.
 */
export declare function lineTransform(
  fn: (line: string) => string,
  options?: LineOptions | number | null
): TransformStream<Chunk, string>;

/** A TransformStream that normalizes each line: it gives what normalize gives for the whole text. */
export declare function createNormalizer(options?: LineOptions | number | null): TransformStream<Chunk, string>;

export interface ConverterOptions extends DetectorOptions, LineOptions {
  /** The font of the text. Not given: each line is detected alone, as toUnicode detects it. */
  from?: SourceFont | null;
  /**
   * What to convert to: 'unicode', the default. 'zawgyi' throws 'ERR_KNAYI_INVALID_ARG_VALUE': the Unicode to Zawgyi
   * rules move e and medial ra across line breaks, so a stream cannot convert line by line to Zawgyi.
   */
  to?: 'unicode' | null;
  /** How a line whose detection ties is read: 'unicode' (left as it is, the default) or 'zawgyi'. */
  tie?: 'unicode' | 'zawgyi' | null;
}

/** A TransformStream that converts each line to Unicode: it gives what toUnicode gives for the whole text. */
export declare function createConverter(options?: ConverterOptions | number | null): TransformStream<Chunk, string>;
