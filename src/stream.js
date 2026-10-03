// knayi 3.0: streams of text, line by line (DESIGN.md §12). Layer L4. The entry 'knayi-myscript/stream'.
//
// Text arrives in chunks, strings or UTF-8 bytes, and is cut into lines at '\n'. Each line goes through a function,
// and the result goes out with the line's ending. A line is never cut: one longer than options.maxLineLength is an
// error (§12.4).
//
// - createNormalizer() and createConverter({ from }) are TransformStreams of normalize and toUnicode. Each gives
//   what its function gives for the whole text, since both keep to the line boundary (§12.2). createConverter does
//   not convert to Zawgyi, whose rules cross line breaks.
// - lineTransform(fn) is a TransformStream of any function of a line.
// - mapLines(fn) is the line cutter itself, with no stream class: transform(chunk) gives the text of the lines a
//   chunk completes, and flush() the last line. Every stream here runs on one.
//
// The TransformStreams serve WHATWG streams (readable.pipeThrough(createNormalizer())) and Node streams
// (stream.pipeline(source, createNormalizer(), destination)) alike (§12.1). They are separate from src/index.js, so
// that an import of normalize alone carries no stream code, and an import of createNormalizer alone no converter.

export { createNormalizer, createConverter, lineTransform } from './api/stream.js';
export { mapLines } from './api/lines.js';
