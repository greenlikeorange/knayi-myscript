// Running the knayi command in the tests of test/next/cli/ (README.md, "Command line").
//
// spawnKnayi runs bin/knayi.js in a process of its own, as a shell or a Python pipeline does; runKnayi calls its
// main() in this process, with standard input fed in chunks the test chooses, for the many runs of a fuzz test.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { ROOT } from '../helpers.mjs';
import { main } from '../../../bin/cli/main.js';

export const BIN = path.join(ROOT, 'bin', 'knayi.js');
export const FIXTURES = path.join(ROOT, 'test', 'next', 'cli', 'fixtures');

// The path of a fixture of test/next/cli/fixtures/ (hand-written; fixtures/SOURCES).
export function fixture(name) {
  return path.join(FIXTURES, name);
}

// { status, stdout, stderr } of `node bin/knayi.js ...args`, standard input given as text or bytes.
export function spawnKnayi(args, options) {
  const settings = options || {};
  const result = spawnSync(process.execPath, [BIN].concat(args), {
    input: settings.input === undefined ? '' : settings.input,
    cwd: settings.cwd === undefined ? ROOT : settings.cwd,
    env: settings.env === undefined ? process.env : settings.env,
    encoding: 'utf8'
  });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

// { status, stdout, stderr } of main(args), with standard input the chunks in order, each a string (as UTF-8) or
// bytes. A chunk may end inside a character, as a pipe's may.
export async function runKnayi(args, chunks) {
  const stdout = textSink();
  const stderr = textSink();
  const bytes = (chunks || []).map((chunk) => (typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk));
  const status = await main(args, { stdin: Readable.from(bytes), stdout: stdout.stream, stderr: stderr.stream });
  return { status: status, stdout: stdout.text(), stderr: stderr.text() };
}

function textSink() {
  const parts = [];
  const stream = new Writable({
    write(chunk, encoding, done) {
      parts.push(Buffer.from(chunk));
      done();
    }
  });
  return { stream: stream, text: () => Buffer.concat(parts).toString('utf8') };
}

// The input cut into chunks of `size` bytes, so that chunks end inside characters and lines.
export function inChunks(text, size) {
  const bytes = Buffer.from(text, 'utf8');
  const chunks = [];
  for (let start = 0; start < bytes.length; start += size) chunks.push(bytes.subarray(start, start + size));
  return chunks;
}
