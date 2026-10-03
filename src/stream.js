// knayi 3.0: streams of text, line by line (DESIGN.md §12). Layer L4. The entry 'knayi-myscript/stream'.
//
// Text arrives in chunks, strings or UTF-8 bytes, and is cut into lines at '\n'. Each line goes through a function,
// and the result goes out with the line's ending. A line is never cut: one longer than options.maxLineLength is an
// error (§12.4).
//
// - mapLines(fn) is the line cutter itself, with no stream class: transform(chunk) gives the text of the lines a
//   chunk completes, and flush() the last line. Every stream here runs on one.
//
// The streams of src/index.js's functions are separate from it, so that an import of normalize alone carries no
// stream code, and one of the streams carries only the functions it runs.

export { mapLines } from './api/lines.js';
