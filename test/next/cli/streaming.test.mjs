// knayi reads its input a chunk at a time (bin/cli/lines.js), and its output does not depend on where the chunks
// end: each line goes through the 3.0 API on its own. On the proven boundary of DESIGN.md §11.5 (normalize, and
// toUnicode, which converts each line as it would alone), that output is also the API's on the whole input.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fc from 'fast-check';
import { arb, fuzz } from '../helpers.mjs';
import { runKnayi, inChunks, BIN } from './helpers.mjs';
import { normalize, toUnicode, detectEncoding, segmentSyllables, explain } from '../../../src/index.js';

// Lines of one kind of text, with line breaks (some CRLF) and an emoji between them, and an input that may or may
// not end with a line break. The input does not start with U+FEFF, which knayi reads as a byte order mark and drops
// ('a byte order mark' below).
const linesOf = (text) => fc.tuple(fc.array(fc.tuple(text, fc.constantFrom('\n', '\r\n', '\uD83D\uDE00\n')),
  { minLength: 1, maxLength: 5 }), fc.boolean()).map(([parts, ended]) => {
  const joined = parts.map(([line, end]) => line + end).join('');
  return ended ? joined : joined.slice(0, joined.lastIndexOf('\n'));
}).filter((input) => input.charCodeAt(0) !== 0xFEFF);
const anyLines = fc.oneof(linesOf(arb.unicodeText(10)), linesOf(arb.zawgyiText(10)), linesOf(arb.burmeseText));
const chunkSize = fc.integer({ min: 1, max: 9 });

// The API on each line of the text, each ending as it ended. A line ends at '\n', or '\r\n', whose '\r' is not part
// of the line; a text that ends with one has no empty line after it, and '' has no line.
function perLine(text, f) {
  let out = '';
  for (let start = 0; start < text.length;) {
    const feed = text.indexOf('\n', start);
    const end = feed === -1 ? text.length : feed;
    const crlf = feed !== -1 && text[feed - 1] === '\r' && feed - 1 >= start;
    out += f(text.slice(start, crlf ? end - 1 : end)) + (feed === -1 ? '' : crlf ? '\r\n' : '\n');
    start = end + 1;
  }
  return out;
}

describe('knayi output does not depend on where the chunks of its input end', () => {
  it('each command gives the 3.0 API on each line, for chunks of any size', async () => {
    const expected = {
      normalize: (text) => perLine(text, (line) => normalize(line)),
      'to-unicode': (text) => perLine(text, (line) => toUnicode(line)),
      detect: (text) => perLine(text, (line) => detectEncoding(line).encoding),
      segment: (text) => perLine(text, (line) => segmentSyllables(line).join('|'))
    };
    await fc.assert(fc.asyncProperty(anyLines, chunkSize, fc.constantFrom(...Object.keys(expected)),
      async (text, size, command) => {
        const run = await runKnayi([command], inChunks(text, size));
        assert.equal(run.status, 0, run.stderr);
        assert.equal(run.stdout, expected[command](text));
      }), { seed: fuzz.SEED, numRuns: fuzz.runs(300, 6000) });
  });

  it('check names each issue of explain on each line', async () => {
    await fc.assert(fc.asyncProperty(anyLines, chunkSize, async (text, size) => {
      const run = await runKnayi(['check'], inChunks(text, size));
      const count = text.split('\n').reduce((sum, line) => sum + explain(line).length, 0);
      assert.equal(run.status, count > 0 ? 1 : 0, run.stderr);
      assert.equal(run.stdout === '' ? 0 : run.stdout.split('\n').length - 1, count);
    }), { seed: fuzz.SEED, numRuns: fuzz.runs(200, 4000) });
  });

  it('normalize and to-unicode equal the API on the whole input (DESIGN.md §11.5)', async () => {
    await fc.assert(fc.asyncProperty(anyLines, linesOf(arb.winText(10)), chunkSize, async (text, win, size) => {
      assert.equal((await runKnayi(['normalize'], inChunks(text, size))).stdout, normalize(text));
      assert.equal((await runKnayi(['to-unicode'], inChunks(text, size))).stdout, toUnicode(text));
      assert.equal((await runKnayi(['to-unicode', '--from', 'zawgyi'], inChunks(text, size))).stdout,
        toUnicode(text, { from: 'zawgyi' }));
      assert.equal((await runKnayi(['to-unicode', '--from', 'win'], inChunks(win, size))).stdout,
        toUnicode(win, { from: 'win' }));
    }), { seed: fuzz.SEED, numRuns: fuzz.runs(200, 4000) });
  });

  it('names the same line for bytes that do not decode, and writes the same lines before it', async () => {
    const bytes = Buffer.concat([Buffer.from('\u1000\n\uD83D\uDE00\u1001\nab'), Buffer.from([0xC3, 0x28]),
      Buffer.from('\nok\n')]);
    for (let size = 1; size <= bytes.length; size++) {
      const chunks = [];
      for (let start = 0; start < bytes.length; start += size) chunks.push(bytes.subarray(start, start + size));
      const run = await runKnayi(['normalize'], chunks);
      assert.equal(run.status, 3, 'chunks of ' + size);
      assert.match(run.stderr, /^knayi: <stdin>:3: the input is not valid utf-8/, 'chunks of ' + size);
      assert.equal(run.stdout, '\u1000\n\uD83D\uDE00\u1001\n', 'chunks of ' + size);
    }
  });

  it('stops at a JSON Lines error after writing the records before it, for chunks of any size', async () => {
    const input = '{"text":"a"}\n{"text":"b"}\n{"text":\n{"text":"c"}\n';
    for (let size = 1; size <= input.length; size++) {
      const run = await runKnayi(['normalize', '--jsonl'], inChunks(input, size));
      assert.equal(run.status, 3);
      assert.match(run.stderr, /<stdin>:3: not JSON/);
      assert.equal(run.stdout, '{"text":"a"}\n{"text":"b"}\n');
    }
  });
});

describe('knayi --jsonl writes one field and passes the rest through', () => {
  // A record written as JSON.stringify writes it, or with a space after each colon and comma, as Python's json.dumps
  // does. Its members are written in the order given, whatever JavaScript would make of them ("0" before "a").
  const members = fc.tuple(fc.array(fc.tuple(fc.string().filter((key) => key !== 'text' && key !== 'encoding'),
    fc.jsonValue()), { maxLength: 4 }), arb.zawgyiText(10), fc.nat(4), fc.boolean());
  function recordLine(entries, spaced) {
    const write = (pairs) => pairs.map(([key, value]) => JSON.stringify(key) + (spaced ? ': ' : ':') +
      JSON.stringify(value)).join(spaced ? ', ' : ',');
    return '{' + write(entries) + '}';
  }

  it('the line is the same but for the value of the field, or the result added at its end', async () => {
    await fc.assert(fc.asyncProperty(members, chunkSize, async ([others, text, at, spaced], size) => {
      const entries = others.slice();
      entries.splice(Math.min(at, entries.length), 0, ['text', text]);
      const line = recordLine(entries, spaced);
      const converted = toUnicode(text, { from: 'zawgyi' });
      const run = await runKnayi(['to-unicode', '--jsonl', '--from', 'zawgyi'], inChunks(line, size));
      assert.equal(run.stdout, recordLine(entries.map(([key, value]) => [key, key === 'text' ? converted : value]),
        spaced));
      const detected = await runKnayi(['detect', '--jsonl'], inChunks(line + '\n', size));
      assert.equal(detected.stdout, recordLine(entries.concat([['encoding', detectEncoding(text).encoding]]), spaced) +
        '\n');
    }), { seed: fuzz.SEED, numRuns: fuzz.runs(300, 6000) });
  });
});

describe('knayi holds about one chunk of its input at a time', () => {
  it('converts 24 MB through a 24 MB heap, which holding the input whole would overflow', async () => {
    const line = '\u1031\u1000\u102C\u1004\u1039\u1038 \u1031\u1019\u102C\u1004\u1039 abc\n';
    const block = Buffer.from(line.repeat(2048));
    const total = 24 * 1024 * 1024;
    const child = spawn(process.execPath, ['--max-old-space-size=24', BIN, 'to-unicode', '--report'],
      { stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (data) => { stderr += data; });
    for (let sent = 0; sent < total; sent += block.length) {
      if (!child.stdin.write(block)) await new Promise((resolve) => child.stdin.once('drain', resolve));
    }
    child.stdin.end();
    const status = await new Promise((resolve) => child.on('close', resolve));
    assert.equal(status, 0, stderr);
    assert.equal(JSON.parse(stderr).records, Math.ceil(total / block.length) * 2048);
  });

  it('stops quietly, with status 0, when the reader of its output goes away, as `yes | knayi normalize | head`',
    async () => {
      const child = spawn(process.execPath, [BIN, 'normalize'], { stdio: ['pipe', 'pipe', 'pipe'] });
      const closed = new Promise((resolve) => child.on('close', (status) => resolve(status)));
      let stderr = '';
      child.stderr.on('data', (data) => { stderr += data; });
      child.stdout.once('data', () => child.stdout.destroy());
      child.stdin.on('error', () => {}); // EPIPE, once knayi has stopped reading
      const block = Buffer.from('abc\n'.repeat(16384));
      let open = true;
      closed.then(() => { open = false; });
      while (open) { // as yes does, write until the pipe breaks
        if (!child.stdin.write(block)) {
          await new Promise((resolve) => {
            child.stdin.once('drain', resolve);
            closed.then(resolve);
          });
        }
      }
      assert.equal(await closed, 0);
      assert.equal(stderr, '');
    });
});
