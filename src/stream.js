// knayi-myscript/stream: the streaming entry of 3.0 (docs/next/DESIGN.md §9). Layer L4.
//
// Streaming (createNormalizer, createConverter, mapLines and lineTransform, cutting at line breaks) is built on a
// branch of its own and lands here. Until then the entry exports nothing, so the exports map, its types and the
// checks of package.json (test/package.test.js, scripts/check-types.mjs) are in place: an import of a function that
// is not here yet fails when the module links, not when it runs.

export {};
