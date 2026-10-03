// Compiles code against src/stream.d.ts, the types of the 3.0 streams (docs/next/DESIGN.md §12). Each line marked
// to expect an error must be one, so the types refuse what the functions refuse.

import { normalize, toUnicode } from '../../src/index.js';
import type { KnayiError } from '../../src/index.js';

// mapLines: the line cutter, with no stream class.
import { mapLines } from '../../src/stream.js';
import type { LineMapper, Chunk } from '../../src/stream.js';

const mapper: LineMapper = mapLines((line) => line.toUpperCase(), { maxLineLength: 4096 });
const fromText: string = mapper.transform('a\nb');
const fromBytes: string = mapper.transform(new TextEncoder().encode('c\n'));
const fromBuffer: string = mapper.transform(new ArrayBuffer(0));
const rest: string = mapper.flush();
const normalizing: LineMapper = mapLines(normalize);
const converting: LineMapper = mapLines((line) => toUnicode(line, { from: 'zawgyi' }), { maxLineLength: Infinity });
const chunks: Chunk[] = ['a', new Uint8Array(1), new DataView(new ArrayBuffer(1))];
// @ts-expect-error: fn returns a string
mapLines((line: string) => line.length);
// @ts-expect-error: a chunk is a string or bytes
mapper.transform(42);
// @ts-expect-error: maxLineLength is a number
mapLines(normalize, { maxLineLength: '4096' });
try {
  mapper.flush();
} catch (error) {
  const code: string = (error as KnayiError).code;
}
