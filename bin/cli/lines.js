// The input of a run, read a chunk at a time and cut into lines (README.md, "Command line").
//
// Each input is a file, or standard input for '-'; they are read in turn, as cat reads them. Its bytes are decoded
// as they arrive (decoding.js), and the text is cut at each line feed. A line is held only until its line break,
// and a line longer than --max-line-length stops the run, so memory stays bounded on any input.
//
// A run that stops on an input error has written the output of every line before the line it names, and nothing
// of that line or after it, wherever the chunks of the input happened to end.

import fs from 'node:fs';
import { CliError, inputError } from './errors.js';
import { ChunkDecoder } from './decoding.js';

// How much of a file is read at a time.
const CHUNK_BYTES = 64 * 1024;

// Reads every input in turn and calls handleLine(line, ending, where) for each line, in order. ending is how the
// line ended: '\n', or '\r\n', whose carriage return is not part of the line; or '' for the last line of the last
// input when that input does not end with a line feed, so that the output ends as the input did. (The last line of
// any other input ends with '\n', so the next input starts a line.) where is { name, line }: the input's name and the
// line's number from 1. What the calls return for a chunk is written to output at once. Stops early when the output
// has closed.
export async function readLines(files, stdin, settings, handleLine, output) {
  for (let k = 0; k < files.length; k++) {
    const isLastInput = k === files.length - 1;
    await readInput(openInput(files[k], stdin), settings, isLastInput, handleLine, output);
    if (output.closed) return;
  }
}

function openInput(file, stdin) {
  if (file === '-') return { name: '<stdin>', stream: stdin };
  return { name: file, stream: fs.createReadStream(file, { highWaterMark: CHUNK_BYTES }) };
}

async function readInput(input, settings, isLastInput, handleLine, output) {
  const reader = {
    decoder: new ChunkDecoder(settings.encoding),
    lines: new LineCutter(),
    where: { name: input.name, line: 0 },
    settings: settings,
    handleLine: handleLine
  };
  try {
    for await (const bytes of input.stream) {
      await writeLines(reader, reader.decoder.decode(bytes), output);
      if (output.closed) return;
    }
  } catch (error) {
    throw asInputError(error, input.name);
  }
  await writeLines(reader, reader.decoder.decode(undefined), output);
  const last = reader.lines.end();
  if (last !== null) await output.write(handleLine(last, isLastInput ? '' : '\n', nextLine(reader.where)));
}

// Handles the lines the decoded text completes and writes their output; then throws the error that stopped them,
// if any: an input error of a line, or bytes that did not decode, which lie on the line after the last one handled.
async function writeLines(reader, decoded, output) {
  const handled = handleText(reader, decoded.text);
  await output.write(handled.out);
  if (handled.error !== null) throw handled.error;
  if (!decoded.valid) {
    throw inputError(reader.where.name + ':' + (reader.where.line + 1), 'the input is not valid ' +
      reader.settings.encoding + ' (text saved in Windows-1252, as Win font text often is, needs --encoding ' +
      'windows-1252)');
  }
}

// { out, error }: the output of handleLine for each line the text completes, up to the first line with an input
// error, and that error (or null). A line over the limit is an error as soon as it is, also while it is still held,
// waiting for its line break.
function handleText(reader, text) {
  const lines = reader.lines.push(text);
  let out = '';
  try {
    for (let k = 0; k < lines.length; k++) {
      const crlf = lines[k].charCodeAt(lines[k].length - 1) === 0x0D;
      const line = crlf ? lines[k].slice(0, -1) : lines[k];
      checkLength(line.length, reader);
      out += reader.handleLine(line, crlf ? '\r\n' : '\n', nextLine(reader.where));
    }
    checkLength(reader.lines.heldLength(), reader);
  } catch (error) {
    if (!(error instanceof CliError)) throw error;
    return { out: out, error: error };
  }
  return { out: out, error: null };
}

function checkLength(length, reader) {
  if (length <= reader.settings.maxLineLength) return;
  throw inputError(reader.where.name + ':' + (reader.where.line + 1), 'the line is longer than ' +
    reader.settings.maxLineLength + ' UTF-16 units, the limit --max-line-length sets');
}

function nextLine(where) {
  where.line++;
  return where;
}

// A file that cannot be read (missing, a directory, not readable) is an input error naming it.
function asInputError(error, name) {
  if (error instanceof CliError || typeof error.syscall !== 'string') return error;
  return inputError(name, 'cannot be read (' + error.message + ')');
}

// ---------------------------------------------------------------------------------------------------------------

// Cuts decoded text into lines at each line feed, holding the start of a line until its line break arrives.
class LineCutter {
  constructor() {
    this.held = '';
  }

  // The lines the text completes, without their line feeds.
  push(text) {
    const lines = [];
    let start = 0;
    for (let end = text.indexOf('\n'); end !== -1; end = text.indexOf('\n', start)) {
      lines.push(this.held + text.slice(start, end));
      this.held = '';
      start = end + 1;
    }
    this.held += text.slice(start);
    return lines;
  }

  // The length of the line held so far, without a carriage return at its end, which a line feed may follow.
  heldLength() {
    const held = this.held;
    return held.charCodeAt(held.length - 1) === 0x0D ? held.length - 1 : held.length;
  }

  // The last line, when the text did not end with a line feed; else null.
  end() {
    const last = this.held;
    this.held = '';
    return last === '' ? null : last;
  }
}
