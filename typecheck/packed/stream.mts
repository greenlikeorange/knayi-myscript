// An ES module that uses the packed package's './stream' entry. scripts/check-types.mjs compiles it in a project that
// has the tarball installed, under nodenext resolution, then runs the output in Node.
//
// Its project (tsconfig.stream.json) adds the DOM library to ES2022: the streams are the runtime's TransformStream,
// whose type TypeScript has in the DOM library or in @types/node, and src/stream.d.ts names it. esm.mts compiles '.'
// and './compat' without either.
import { normalize } from "knayi-myscript";
import { createConverter, createNormalizer, lineTransform, mapLines } from "knayi-myscript/stream";
import type { Chunk, ConverterOptions, LineMapper, LineOptions } from "knayi-myscript/stream";

function check(ok: boolean, what: string): void {
  if (!ok) throw new Error("stream.mts: " + what);
}

const zawgyi = "မဂၤလာပါ";
const unicode = "မင်္ဂလာပါ";

// Everything a stream gives out, joined.
async function readAll(readable: ReadableStream<string>): Promise<string> {
  const reader = readable.getReader();
  let text = "";
  for (let part = await reader.read(); !part.done; part = await reader.read()) text += part.value;
  return text;
}

// Writes the chunks to a stream and closes it, while its output is read.
async function through(stream: TransformStream<Chunk, string>, chunks: Chunk[]): Promise<string> {
  const writer = stream.writable.getWriter();
  const written = Promise.all(chunks.map((chunk) => writer.write(chunk)).concat(writer.close()));
  const text = await readAll(stream.readable);
  await written;
  return text;
}

// The line cutter, with no stream class.
const lineOptions: LineOptions = { maxLineLength: 1024 };
const lines: LineMapper = mapLines(normalize, lineOptions);
check(lines.transform(unicode + "\r\n" + unicode.slice(0, 3)) === unicode + "\r\n", "mapLines transform");
check(lines.flush() === unicode.slice(0, 3), "mapLines flush");

// UTF-8 bytes, cut inside a character, through the converter.
const bytes = new TextEncoder().encode(zawgyi + "\n" + zawgyi);
const options: ConverterOptions = { from: "zawgyi" };
const converted = await through(createConverter(options), [bytes.subarray(0, 5), bytes.subarray(5)]);
check(converted === unicode + "\n" + unicode, "createConverter");
check(await through(createNormalizer(), [unicode, "\n"]) === unicode + "\n", "createNormalizer");
check(await through(lineTransform((line) => line.length + ""), ["ab\ncd"]) === "2\n2", "lineTransform");

// The types are the package's own, not any: each line below must be a type error. The function never runs, since
// the streams throw on what their types refuse.
function typeErrors(): void {
  // @ts-expect-error a stream cannot convert to Zawgyi line by line
  createConverter({ to: "zawgyi" });
  // @ts-expect-error a line function returns a string
  mapLines((line: string) => line.length);
}

export { typeErrors };
