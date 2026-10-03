// Shared helpers of the tests of the 3.0 API (docs/next/DESIGN.md §11).

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, hex } from '../helpers.mjs';

// A text as its UTF-16 units, for messages: 'U+1000 U+103A'.
export function units(text) {
  return Array.from(text, (unit, i) => hex(text.charCodeAt(i))).join(' ') || '(empty)';
}

// What a stream gives for a whole text (DESIGN.md §12.1), written out directly: the text cut at '\n', each line
// through fn without its ending, a '\r' before the '\n' part of the ending, and the text after the last '\n' as
// the last line, when there is any.
export function mapWholeText(text, fn) {
  const parts = text.split('\n');
  const last = parts.pop();
  let out = '';
  for (const part of parts) {
    const crlf = part.endsWith('\r');
    out += fn(crlf ? part.slice(0, -1) : part) + (crlf ? '\r\n' : '\n');
  }
  return last === '' ? out : out + fn(last);
}

// The text cut into chunks of the given sizes, repeated in turn until the text runs out. Works on strings and on
// Uint8Arrays.
export function chunksOf(text, sizes) {
  const chunks = [];
  for (let at = 0, k = 0; at < text.length; k++) {
    const size = Math.max(1, sizes[k % sizes.length]);
    chunks.push(text.slice(at, at + size));
    at += size;
  }
  return chunks;
}

// A seeded generator of whole numbers in [0, n), for chunk sizes that the tests can replay.
export function seededSizes(seed) {
  let state = seed >>> 0;
  return (n) => {
    state = (state * 1103515245 + 12345) >>> 0;
    return (state >>> 8) % n;
  };
}

// The corpora whose every line is Unicode; mC4 is raw web text, mostly Zawgyi, and WaitZar's are Zawgyi words.
export const UNICODE_CORPORA = ['flores', 'wikipedia', 'wikipedia-v1', 'okell', 'shn', 'mnw', 'ksw', 'blk'];

let loaded = null;

// The cached corpora: { sets: { id: distinct lines }, google: [zawgyi, unicode] pairs }, or { skip: why } when the
// cache is missing or a file does not match its pin. Nothing is downloaded, so in CI's test job, which has no
// cache, the corpus tests skip.
export async function cachedCorpora() {
  if (loaded === null) loaded = loadCorpora();
  return loaded;
}

async function loadCorpora() {
  const datasets = await import(pathToFileURL(path.join(ROOT, 'scripts', 'eval', 'datasets.mjs')).href);
  const missing = datasets.checkCache().filter((row) => row.status !== 'ok' && !/queries/.test(row.name));
  if (missing.length) return { skip: 'the corpus cache lacks ' + missing.map((row) => row.name).join(', ') };
  const data = await datasets.loadAll({ withLegacy: true });
  const sets = Object.assign({ flores: data.flores, wikipedia: data.wikipedia, okell: data.okell, mc4: data.mc4,
    waitzar: data.waitzar }, data.other, data.legacy);
  return { sets: sets, google: data.google };
}
