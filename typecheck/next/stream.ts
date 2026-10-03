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

// The TransformStreams: lineTransform, createNormalizer and createConverter.
import { lineTransform, createNormalizer, createConverter } from '../../src/stream.js';
import type { ConverterOptions } from '../../src/stream.js';

const upper: TransformStream<Chunk, string> = lineTransform((line) => line.toUpperCase());
const normalizer: TransformStream<Chunk, string> = createNormalizer({ maxLineLength: 65536 });
const fromZawgyi: TransformStream<Chunk, string> = createConverter({ from: 'zawgyi', to: 'unicode' });
const detecting: TransformStream<Chunk, string> = createConverter({ tie: 'zawgyi', thresholds: [0.1, 0.9] });
const options: ConverterOptions = { from: null, to: null, maxLineLength: null };
const text: ReadableStream<string> = new ReadableStream<Chunk>().pipeThrough(createNormalizer());
// @ts-expect-error: a stream does not convert to Zawgyi
createConverter({ to: 'zawgyi' });
// @ts-expect-error: from is a font name
createConverter({ from: 'Zawgyi' });
// @ts-expect-error: fn returns a string
lineTransform((line: string) => [line]);
