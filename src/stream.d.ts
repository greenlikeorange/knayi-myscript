// Types of knayi 3.0's streams, src/stream.js (docs/next/DESIGN.md §12). Hand-written; typecheck/next/ compiles code
// against them, and test/next/api/types.test.mjs checks that they declare exactly what src/stream.js exports.
//
// A stream cuts its text into lines at '\n'; a '\r' right before it belongs to the line's ending. Each line goes
// through a function without its ending, and the ending goes out after the result as it came. A bad argument, chunk
// or result throws a KnayiError (src/index.d.ts): a TypeError with the code 'ERR_KNAYI_INVALID_ARG_TYPE', a RangeError
// with 'ERR_KNAYI_INVALID_ARG_VALUE', or, for a line longer than maxLineLength, 'ERR_KNAYI_LINE_TOO_LONG'.

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
