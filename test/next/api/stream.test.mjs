// The TransformStreams of src/stream.js: lineTransform, createNormalizer, createConverter (docs/next/DESIGN.md §12).
//
// - Each gives what its function gives for the whole text, on every cached corpus, cut into chunks of random sizes,
//   as strings with '\n' and as UTF-8 bytes with '\r\n' (§12.2, §12.3).
// - They serve WHATWG streams (pipeThrough) and Node streams (stream.pipeline, Duplex.fromWeb) alike (§12.1).
// - A line longer than maxLineLength, a bad chunk or a function that throws errors the stream; a bad option throws
//   when the stream is made; createConverter refuses to convert to Zawgyi, and says why (§10 Q10).
// - With no TransformStream, the streams throw ERR_KNAYI_UNSUPPORTED_RUNTIME, and mapLines still works.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable, Duplex } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { units, mapWholeText, chunksOf, seededSizes, cachedCorpora } from './helpers.mjs';
import { lineTransform, createNormalizer, createConverter, mapLines } from '../../../src/stream.js';
import { normalize, toUnicode, toZawgyi } from '../../../src/index.js';

const encoder = new TextEncoder();
const marked = (line) => '<' + line + '>';

// The chunks through a TransformStream, WHATWG style: what comes out, chunk by chunk.
async function pipedThrough(transform, chunks) {
  const source = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    }
  });
  const out = [];
  const reader = source.pipeThrough(transform).getReader();
  for (let read = await reader.read(); !read.done; read = await reader.read()) out.push(read.value);
  return out;
}

const streamed = async (transform, chunks) => (await pipedThrough(transform, chunks)).join('');

// The chunks through a TransformStream between Node streams, with stream.pipeline.
async function pipedByNode(transform, chunks) {
  let out = '';
  const sink = new Writable({
    write(chunk, encoding, done) {
      out += String(chunk);
      done();
    }
  });
  await pipeline(Readable.from(chunks), transform, sink);
  return out;
}

const ZAWGYI = '\u1031\u1000\u102C\u1004\u1039\u1038 \u1031\u1019\u102C\u1004\u1039';
const ZAWGYI_IN_UNICODE = '\u1000\u1031\u102C\u1004\u103A\u1038 \u1019\u1031\u102C\u1004\u103A';
const UNICODE = '\u1014\u103E\u1004\u103A\u1038 \u1000\u103B\u1031\u102C\u1004\u103A\u1038';

describe('the streams, WHATWG and Node (DESIGN.md §12.1)', () => {
  it('lineTransform gives each line to fn, and one string for each chunk that completes lines', async () => {
    assert.deepEqual(await pipedThrough(lineTransform(marked), ['a\nb', 'c', '\r\n\n', 'd']),
      ['<a>\n', '<bc>\r\n<>\n', '<d>']);
  });

  it('createNormalizer and createConverter give what normalize and toUnicode give for the whole text', async () => {
    const text = UNICODE + '\r\n\u1031\u1000\u103C\u102C\u1000\u103A\n' + ZAWGYI + '\n';
    const chunks = chunksOf(encoder.encode(text), [5, 1, 2]);
    assert.equal(await streamed(createNormalizer(), chunks), normalize(text));
    const detected = await streamed(createConverter(), chunks);
    assert.equal(detected, toUnicode(text));
    assert.ok(detected.startsWith(UNICODE + '\r\n') && detected.endsWith('\n' + ZAWGYI_IN_UNICODE + '\n'));
    assert.equal(await streamed(createConverter({ from: 'zawgyi', to: 'unicode' }), chunks),
      toUnicode(text, { from: 'zawgyi' }));
    assert.equal(await streamed(createConverter({ from: 'win' }), ['aMomf\nk', 'u']), toUnicode('aMomf\nku', {
      from: 'win' }));
  });

  it('createConverter reads tie and the detector as toUnicode does, each line alone', async () => {
    const tie = '\u1000\u1001\u1002';
    const text = tie + '\n' + ZAWGYI + '\n' + UNICODE;
    const byE = { getZawgyiProbability: (line) => (line.charCodeAt(0) === 0x1031 ? 1 : 0) };
    for (const options of [{ tie: 'zawgyi' }, { tie: 'unicode' }, { zawgyiDetector: byE, thresholds: [0.2, 0.8] }]) {
      assert.equal(await streamed(createConverter(options), chunksOf(text, [3])), toUnicode(text, options));
    }
  });

  it('serves Node streams: stream.pipeline takes the TransformStream, and Duplex.fromWeb makes a Duplex of it',
    async () => {
      const text = UNICODE + '\n' + ZAWGYI;
      assert.equal(await pipedByNode(createConverter({ from: 'zawgyi' }), chunksOf(Buffer.from(text), [4])),
        toUnicode(text, { from: 'zawgyi' }));
      assert.equal(await pipedByNode(createNormalizer(), chunksOf(text, [2])), normalize(text));
      const duplex = Duplex.fromWeb(lineTransform(marked), { encoding: 'utf8' });
      const read = [];
      duplex.on('data', (chunk) => read.push(chunk));
      const ended = new Promise((resolve) => duplex.on('end', resolve));
      duplex.end(Buffer.from('a\nb'));
      await ended;
      assert.equal(read.join(''), '<a>\n<b>');
    });

  it('errors the stream on a line longer than maxLineLength, a bad chunk, or a function that throws', async () => {
    const tooLong = { name: 'RangeError', code: 'ERR_KNAYI_LINE_TOO_LONG' };
    await assert.rejects(streamed(createNormalizer({ maxLineLength: 4 }), ['ab\nabc', 'de\n']), tooLong);
    await assert.rejects(pipedByNode(createConverter({ maxLineLength: 4 }), ['abcde']), tooLong);
    const badChunk = { name: 'TypeError', code: 'ERR_KNAYI_INVALID_ARG_TYPE' };
    await assert.rejects(streamed(createNormalizer(), ['a', 1]), badChunk);
    const failure = new Error('fn failed');
    await assert.rejects(streamed(lineTransform(() => { throw failure; }), ['a\n']), failure);
    await assert.rejects(streamed(lineTransform(() => 1), ['a\n']), { code: 'ERR_KNAYI_INVALID_ARG_TYPE' });
  });
});

describe('createConverter does not convert to Zawgyi (DESIGN.md §12.2, §10 Q10)', () => {
  it('throws a coded RangeError that says why, and points to toZawgyi', () => {
    assert.throws(() => createConverter({ to: 'zawgyi' }), (error) => {
      assert.equal(error.name, 'RangeError');
      assert.equal(error.code, 'ERR_KNAYI_INVALID_ARG_VALUE');
      assert.match(error.message, /^knayi\.createConverter: options\.to cannot be 'zawgyi': .*line breaks.*toZawgyi/);
      return true;
    });
    assert.throws(() => createConverter({ from: 'unicode', to: 'zawgyi' }), { code: 'ERR_KNAYI_INVALID_ARG_VALUE' });
  });

  it('because toZawgyi moves an e across a line break (Q10): when this fails, streaming to Zawgyi can come', () => {
    const lines = ['\u1000', '\u1031'];
    assert.equal(toZawgyi(lines.join('\n')), '\u1031\u1000\n');
    assert.notEqual(toZawgyi(lines.join('\n')), lines.map((line) => toZawgyi(line)).join('\n'));
  });

  it('crosses line breaks on 2,622 of the 64,797 pairs of neighbouring corpus lines, 839 Unicode', async (t) => {
    // Pairs of neighbouring lines whose conversion as one text is not the conversion of each line. The Unicode
    // corpora are all but mC4 and WaitZar, which are mostly Zawgyi.
    const RECORDED = {
      flores: [2008, 0], wikipedia: [4811, 0], 'wikipedia-v1': [10731, 0], okell: [16923, 250], shn: [9922, 589],
      mnw: [2269, 0], ksw: [672, 0], blk: [769, 0], mc4: [14303, 1384], waitzar: [2389, 399]
    };
    const corpora = await cachedCorpora();
    if (corpora.skip) return t.skip(corpora.skip);
    for (const [name, [pairs, crossed]] of Object.entries(RECORDED)) {
      const lines = corpora.sets[name];
      const alone = lines.map((line) => toZawgyi(line));
      let found = 0;
      for (let i = 1; i < lines.length; i++) {
        if (toZawgyi(lines[i - 1] + '\n' + lines[i]) !== alone[i - 1] + '\n' + alone[i]) found++;
      }
      assert.deepEqual([lines.length - 1, found], [pairs, crossed], name);
    }
  });
});

describe('the streams give the whole text\'s output on every cached corpus (DESIGN.md §12.2, §12.3)', () => {
  const FUNCTIONS = {
    normalize: [() => createNormalizer(), (text) => normalize(text)],
    'toUnicode from Zawgyi': [() => createConverter({ from: 'zawgyi' }), (text) => toUnicode(text, { from: 'zawgyi' })],
    'toUnicode, detected': [() => createConverter(), (text) => toUnicode(text)]
  };

  it('as strings with \\n and no final line break, and as UTF-8 bytes with \\r\\n, in chunks of random sizes',
    async (t) => {
      const corpora = await cachedCorpora();
      if (corpora.skip) return t.skip(corpora.skip);
      const random = seededSizes(20261004);
      const sizes = () => Array.from({ length: 16 }, () => 1 + random(16384));
      for (const [name, lines] of Object.entries(corpora.sets)) {
        const lf = lines.join('\n');
        const crlf = lines.join('\r\n') + '\r\n';
        for (const [what, [make, whole]] of Object.entries(FUNCTIONS)) {
          assert.ok((await streamed(make(), chunksOf(lf, sizes()))) === whole(lf), name + ', ' + what + ', strings');
          assert.ok((await streamed(make(), chunksOf(encoder.encode(crlf), sizes()))) === whole(crlf),
            name + ', ' + what + ', bytes');
        }
      }
    });
});

describe('the streams\' options and runtimes (DESIGN.md §11.1, §12.1)', () => {
  it('throw coded errors that name the function, when the stream is made, and are map-safe', () => {
    const typeError = { name: 'TypeError', code: 'ERR_KNAYI_INVALID_ARG_TYPE' };
    const rangeError = { name: 'RangeError', code: 'ERR_KNAYI_INVALID_ARG_VALUE' };
    assert.throws(() => createConverter({ from: 'Zawgyi' }), /^RangeError: knayi\.createConverter: options\.from/);
    assert.throws(() => createConverter({ to: 'win' }), rangeError);
    assert.throws(() => createConverter({ to: 1 }), typeError);
    assert.throws(() => createConverter({ tie: 'win' }), rangeError);
    assert.throws(() => createConverter({ thresholds: [0.9, 0.1] }), rangeError);
    assert.throws(() => createConverter({ zawgyiDetector: {} }), typeError);
    assert.throws(() => createConverter({ maxLineLength: 0 }), /^RangeError: knayi\.createConverter: options\.max/);
    assert.throws(() => createNormalizer({ maxLineLength: '1' }), /^TypeError: knayi\.createNormalizer: /);
    assert.throws(() => createNormalizer([]), typeError);
    assert.throws(() => lineTransform('x'), /^TypeError: knayi\.lineTransform: fn must be a function/);
    for (const none of [undefined, null, 0, {}]) {
      assert.ok(createNormalizer(none) instanceof TransformStream);
      assert.ok(createConverter(none) instanceof TransformStream);
    }
  });

  it('with no TransformStream, the streams throw ERR_KNAYI_UNSUPPORTED_RUNTIME and mapLines still works', () => {
    const saved = globalThis.TransformStream;
    try {
      globalThis.TransformStream = undefined;
      for (const make of [() => createNormalizer(), () => createConverter(), () => lineTransform(marked)]) {
        assert.throws(make, { name: 'Error', code: 'ERR_KNAYI_UNSUPPORTED_RUNTIME' });
      }
      const lines = mapLines(normalize);
      assert.equal(lines.transform(ZAWGYI + '\n') + lines.flush(), normalize(ZAWGYI) + '\n');
    } finally {
      globalThis.TransformStream = saved;
    }
  });

  it('with no TextDecoder, a stream takes strings and throws ERR_KNAYI_UNSUPPORTED_RUNTIME on bytes', () => {
    const saved = globalThis.TextDecoder;
    try {
      globalThis.TextDecoder = undefined;
      assert.equal(mapLines(marked).transform('a\n'), '<a>\n');
      assert.throws(() => mapLines(marked).transform(new Uint8Array(1)), { code: 'ERR_KNAYI_UNSUPPORTED_RUNTIME' });
    } finally {
      globalThis.TextDecoder = saved;
    }
  });

  it('gives mapWholeText for a whole text with any function, as mapLines does', async () => {
    const text = 'a\r\n\u1000\u103A\n\n\uD83D\uDE00\r';
    assert.equal(await streamed(lineTransform(encodeURIComponent), chunksOf(text, [1])),
      mapWholeText(text, encodeURIComponent), units(text));
  });
});
