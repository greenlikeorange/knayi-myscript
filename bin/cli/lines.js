// The input of a run, read a chunk at a time and cut into lines (README.md, "Command line").
//
// Each input is a file, or standard input for '-'; they are read in turn, as cat reads them. Its bytes are decoded
// as they arrive (decoding.js), and the text goes through src/stream.js's mapLines, the line cutter of the 3.0
// streams (DESIGN.md §12): a line ends at '\n', a '\r' before it is part of its ending, each line goes to the
// handler without its ending, and the ending goes out after the result as it came. A line is held only until its
// line break, and one longer than --max-line-length stops the run (§12.4), so memory stays bounded on any input.
//
// A run that stops on an input error has written every line before the one it names, and nothing of that line or
// of any line after it: the text goes to mapLines a line at a time (mapLineByLine), so an error on a line leaves the
// output of the lines before it, and the text before bytes that do not decode goes through first.

import fs from 'node:fs';
import { mapLines } from '../../src/stream.js';
import { CliError, inputError } from './errors.js';
import { ChunkDecoder } from './decoding.js';

// How much of a file is read at a time.
const CHUNK_BYTES = 64 * 1024;

// Reads every input in turn, gives each line to handler.map(line, where), and writes handler.written(mapped) for
// what mapLines makes of each chunk, without the lines handler.dropped() names (main.js lineHandler). where is { name, line }: the input's name, and the line's
// number from 1. The last line of an input that does not end with a line feed is ended with one when another input
// follows, so that the next input starts a line; the last input's ends as it did. Stops early when the output has
// closed.
export async function readLines(files, stdin, settings, handler, output) {
  for (let k = 0; k < files.length; k++) {
    const isLastInput = k === files.length - 1;
    await readInput(openInput(files[k], stdin), settings, isLastInput, handler, output);
    if (output.closed) return;
  }
}

function openInput(file, stdin) {
  if (file === '-') return { name: '<stdin>', stream: stdin };
  return { name: file, stream: fs.createReadStream(file, { highWaterMark: CHUNK_BYTES }) };
}

async function readInput(input, settings, isLastInput, handler, output) {
  const reader = createReader(input, settings, handler);
  try {
    for await (const bytes of input.stream) {
      await writeText(reader, reader.decoder.decode(bytes), output);
      if (output.closed) return;
    }
  } catch (error) {
    throw asInputError(error, input.name);
  }
  await writeText(reader, reader.decoder.decode(undefined), output);
  if (!isLastInput && reader.unended) await writeText(reader, { text: '\n', valid: true }, output);
  await writeMapped(reader, mapStep(reader, () => reader.lines.flush()), output);
}

// { decoder, lines, where, unended, settings, handler }: unended says whether the text so far ends inside a line.
function createReader(input, settings, handler) {
  const where = { name: input.name, line: 0 };
  const mapLine = (line) => {
    where.line++;
    return handler.map(line, where);
  };
  return {
    decoder: new ChunkDecoder(settings.encoding),
    lines: mapLines(mapLine, { maxLineLength: settings.maxLineLength }),
    where: where,
    unended: false,
    settings: settings,
    handler: handler
  };
}

// Writes the output of the lines the decoded text completes; then throws for bytes that did not decode, which lie
// on the line after the last one handled.
async function writeText(reader, decoded, output) {
  const text = decoded.text;
  if (text !== '') reader.unended = text.charCodeAt(text.length - 1) !== 0x0A;
  await writeMapped(reader, mapLineByLine(reader, text), output);
  if (decoded.valid) return;
  throw inputError(reader.where.name + ':' + (reader.where.line + 1), 'the input is not valid ' +
    reader.settings.encoding + ' (text saved in Windows-1252, as Win font text often is, needs --encoding ' +
    'windows-1252)');
}

// Writes what the lines gave ({ text, error }, mapStep), then throws the error that stopped them, if one did.
async function writeMapped(reader, mapped, output) {
  await output.write(reader.handler.written(mapped.text));
  if (mapped.error !== null) throw mapped.error;
}

// The text through mapLines a line at a time, each step ending at a line break, so that a step completes one line
// at most: { text, error }. An error on a line stops there, and `text` keeps the output of every line before it,
// which one step for the whole chunk would lose with the error.
function mapLineByLine(reader, text) {
  let mapped = '';
  for (let start = 0; start < text.length;) {
    const lineBreak = text.indexOf('\n', start);
    const end = lineBreak === -1 ? text.length : lineBreak + 1;
    const step = mapStep(reader, () => reader.lines.transform(text.slice(start, end)));
    if (step.error !== null) return { text: mapped, error: step.error };
    mapped += step.text;
    start = end;
  }
  return { text: mapped, error: null };
}

// One step of mapLines: { text, error }. The text is empty when the handler dropped the line the step completed
// (--invalid skip), its ending included. A line over the limit is an input error naming it, as soon as it passes
// the limit, also while it waits for its line break.
function mapStep(reader, step) {
  let text;
  try {
    text = step();
  } catch (error) {
    return { text: '', error: asLineError(reader, error) };
  }
  return { text: reader.handler.dropped() ? '' : text, error: null };
}

function asLineError(reader, error) {
  if (!error || error.code !== 'ERR_KNAYI_LINE_TOO_LONG') return error;
  return inputError(reader.where.name + ':' + (reader.where.line + 1), 'the line is longer than ' +
    reader.settings.maxLineLength + ' UTF-16 units, the limit --max-line-length sets');
}

// A file that cannot be read (missing, a directory, not readable) is an input error naming it.
function asInputError(error, name) {
  if (error instanceof CliError || typeof error.syscall !== 'string') return error;
  return inputError(name, 'cannot be read (' + error.message + ')');
}
