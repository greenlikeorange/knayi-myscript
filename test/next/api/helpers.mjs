// Shared helpers of the tests of the 3.0 API (docs/next/DESIGN.md §11).

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, hex } from '../helpers.mjs';

// A text as its UTF-16 units, for messages: 'U+1000 U+103A'.
export function units(text) {
  return Array.from(text, (unit, i) => hex(text.charCodeAt(i))).join(' ') || '(empty)';
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
