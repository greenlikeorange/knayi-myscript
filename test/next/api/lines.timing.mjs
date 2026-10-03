// Growth of mapLines (docs/next/DESIGN.md §6.2 item 4, §12): the line cutter reads each unit once, however the
// text is cut into chunks. A long line in one-unit chunks waits as pieces joined once at its end; a text of many
// lines, '\r\n' lines, lines of '\r' and UTF-8 bytes in one-byte chunks are cut in linear time. The method is that
// of api.timing.mjs: a quick reading at n, 2n and 4n units, and a reading above 1.3 measured three more times.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { growthExponent } from '../../../scripts/eval/lib/timing.mjs';
import { SHAPES } from '../helpers.mjs';
import { chunksOf } from './helpers.mjs';
import { mapLines } from '../../../src/stream.js';
import { normalize } from '../../../src/index.js';

const LIMIT = 1.3;
const encoder = new TextEncoder();
const repeatTo = (unit, n) => unit.repeat(Math.max(1, Math.round(n / unit.length)));

function screenedGrowth(call, make) {
  const quick = growthExponent(call, make, { samples: 2, sampleMs: 1, warmMs: 1 });
  if (quick.exponent !== null && quick.exponent <= LIMIT) return quick;
  const tries = [growthExponent(call, make), growthExponent(call, make), growthExponent(call, make)];
  const value = (g) => (g.exponent === null ? Infinity : g.exponent);
  return tries.sort((a, b) => value(a) - value(b))[0];
}

// Runs a new mapper over the chunks; the chunks are made outside the timing.
function runChunks(fn, chunks) {
  const mapper = mapLines(fn, { maxLineLength: Infinity });
  let out = '';
  for (let k = 0; k < chunks.length; k++) out += mapper.transform(chunks[k]);
  return out + mapper.flush();
}

const same = (line) => line;
const CASES = [
  ['one long line, in one-unit chunks', (n) => chunksOf('\u1000'.repeat(n), [1])],
  ['one long line, in one chunk', (n) => ['\u1000'.repeat(n)]],
  ['empty lines, in one chunk', (n) => ['\n'.repeat(n)]],
  ['\\r\\n lines, in one-unit chunks', (n) => chunksOf(repeatTo('a\r\n', n), [1])],
  ['a line of \\r, in one-unit chunks', (n) => chunksOf('\r'.repeat(n), [1])],
  ['four-byte characters, in one-byte chunks', (n) => chunksOf(encoder.encode(repeatTo('\uD83D\uDE00', n)), [1])],
  ['three-byte lines, in seven-byte chunks', (n) => chunksOf(encoder.encode(repeatTo('\u1000\u102C\n', n)), [7])]
].map(([id, make]) => ({ id, make }));

describe('growth of mapLines (DESIGN.md §6.2, §12)', () => {
  it('cuts lines in linear time, however the text is cut into chunks', () => {
    const bad = [];
    for (const shape of CASES) {
      const growth = screenedGrowth((chunks) => runChunks(same, chunks), shape.make);
      if (growth.exponent === null || growth.exponent > LIMIT) bad.push(shape.id + ': ' + JSON.stringify(growth));
    }
    assert.deepEqual(bad, []);
  });

  it('runs normalize line by line in linear time on every shape, in 61-unit chunks', () => {
    const bad = [];
    for (const shape of SHAPES) {
      const growth = screenedGrowth((chunks) => runChunks(normalize, chunks), (n) => chunksOf(shape.make(n), [61]));
      if (growth.exponent === null || growth.exponent > LIMIT) bad.push(shape.id + ': ' + JSON.stringify(growth));
    }
    assert.deepEqual(bad, []);
  });
});
