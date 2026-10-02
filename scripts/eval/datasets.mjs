// Public Zawgyi and Unicode datasets used to evaluate knayi.
// Files are downloaded on first use into the cache directory and are never committed:
// some sources have no license or a non-commercial one, so we link to them instead of copying them.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CACHE = process.env.KNAYI_EVAL_CACHE || path.join(HERE, '..', '..', '.eval-cache');

const cp = (n) => String.fromCodePoint(n);
export const MYANMAR = new RegExp('[' + cp(0x1000) + '-' + cp(0x109f) + ']');
const BOM = new RegExp('^' + cp(0xfeff));

const github = (repo, sha, file) =>
  'https://raw.githubusercontent.com/' + repo + '/' + sha + '/' + file.split('/').map(encodeURIComponent).join('/');

// Every download must match its sha256. The GitHub files are pinned to a commit, mC4 to a revision and
// Okell to a Zenodo record; the FLORES URL has no version, so the hash is its only pin.
const FILES = {
  google: {
    url: github('google/language-resources', '11f9e1c5b57232a539fbae9194c2ade8a763717c', 'my/zawgyi_unicode_test.tsv'),
    sha256: 'daa45bdd4f76524b26c12fc512557dad8788fb6bdf36beb1536ec57560014ba5'
  },
  cldr: {
    url: github('unicode-org/cldr', '09b27dcb68feed49de6ef5bf6c3175e8f301a77b', 'common/testData/transforms/my-t-my-s0-zawgyi.txt'),
    sha256: 'd7e34b2a4447aab4299df10a70de5f6cf5833cb504c7c1ace6b23dac9d47b609'
  },
  queries: {
    url: github('sven-oly/Zawgyi-Unicode', '641e004f310f2cec6b0b49ba70e71cc3ec65ee0e',
      'CONVERTER_COMPARE/Copy of Zawgyi detector%2Fconverter comp_ 20180709 top 10k queries - query.20180709.10k.cpp_js.tsv'),
    sha256: '8a491cfda97cd02f20078cb374d19e66b50ce095f1de14f0bb8e9aff741ecba4'
  },
  waitzar: {
    url: github('yathit/waitzar', '3b7294a6145101af294a7e4fd99c684f7da9363f', 'FontConvertTester/words.zawgyi.txt'),
    sha256: '40c2a0febadba277c698db8fe919488693925146f7617d53fbcc8cb8a8ffc1f3'
  },
  flores: {
    url: 'https://dl.fbaipublicfiles.com/nllb/flores200_dataset.tar.gz',
    sha256: 'b8b0b76783024b85797e5cc75064eb83fc5288b41e9654dabc7be6ae944011f6'
  },
  okell: {
    url: 'https://zenodo.org/records/1202324/files/allfiles.txt?download=1',
    sha256: '6bbafd699c587876317f6e0535b9dd8f9ec87c15efe4b7e65a8c7362ebcdbf4c'
  },
  mc4: {
    url: 'https://huggingface.co/datasets/allenai/c4/resolve/1588ec454efa1a09f29cd18ddd04fe05fc8653a2/multilingual/c4-my-validation.tfrecord-00000-of-00001.json.gz',
    sha256: '69a1b20842b1d62f3490b9c463af950581e50ce1faee1b9ea16a2dfaa9b6d71f'
  }
};

// Rows read through the Hugging Face datasets-server. Small configs are read whole. Large ones are read as
// `blocks` random blocks of `rows` rows, picked with a fixed seed so every run reads the same rows.
const SEED = 20261002;
const HF_SAMPLES = {
  wikipedia: { dataset: 'wikimedia/wikipedia', config: '20231101.my', field: 'text', blocks: 25, rows: 40 },
  shn: { dataset: 'cis-lmu/GlotCC-V1', config: 'shn-Mymr', field: 'content' },
  mnw: { dataset: 'cis-lmu/GlotCC-V1', config: 'mnw-Mymr', field: 'content' },
  ksw: { dataset: 'cis-lmu/GlotCC-V1', config: 'ksw-Mymr', field: 'content' },
  blk: { dataset: 'cis-lmu/GlotCC-V1', config: 'blk-Mymr', field: 'content' }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retries network errors, 429 and 5xx with backoff (about two minutes in all), and waits as long as
// Retry-After asks, up to a minute at a time.
async function fetchWithRetry(url) {
  for (let attempt = 1; ; attempt++) {
    let res = null;
    let error = null;
    try {
      res = await fetch(url, { headers: { 'user-agent': 'knayi-myscript-eval' } });
    } catch (e) {
      error = e;
    }
    if (res && res.ok) return res;
    const retryable = error || res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 8) throw new Error(url + ': ' + (error ? error.message : 'HTTP ' + res.status));
    const retryAfter = res ? Number(res.headers.get('retry-after')) : 0;
    await sleep(Math.min(retryAfter > 0 ? retryAfter : 2 ** (attempt - 1), 60) * 1000);
  }
}

const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// Written to a temporary file first, so an interrupted download never leaves a partial file behind.
async function download(url, dest) {
  const res = await fetchWithRetry(url);
  const tmp = dest + '.part';
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  fs.renameSync(tmp, dest);
}

// A file that does not match its hash is downloaded once more; if it still does not match, the run stops.
async function file(id) {
  const spec = FILES[id];
  const dest = path.join(CACHE, 'data', id + path.extname(new URL(spec.url).pathname));
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!fs.existsSync(dest)) {
      console.error('downloading ' + id + ' …');
      await download(spec.url, dest);
    }
    if (sha256(dest) === spec.sha256) return dest;
    fs.rmSync(dest);
    if (attempt === 0) console.error(id + ' does not match its sha256; downloading it again …');
  }
  throw new Error(id + ' does not match the pinned sha256 ' + spec.sha256 +
    '. The file changed upstream or the download is damaged; check it before updating the pin.');
}

// mulberry32: a small seeded generator, so the sampled Wikipedia rows are the same on every run.
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBlocks(total, blocks, rows) {
  const next = random(SEED);
  const starts = [];
  while (starts.length < blocks) {
    const start = Math.floor(next() * (total - rows));
    if (starts.every((s) => Math.abs(s - start) >= rows)) starts.push(start);
  }
  return starts.sort((a, b) => a - b).map((start) => [start, rows]);
}

async function hfRows(spec, offset, length) {
  const query = new URLSearchParams({
    dataset: spec.dataset, config: spec.config, split: 'train', offset: String(offset), length: String(length)
  });
  return (await fetchWithRetry('https://datasets-server.huggingface.co/rows?' + query)).json();
}

async function hfSample(id) {
  const spec = HF_SAMPLES[id];
  const dest = path.join(CACHE, 'data', 'hf-' + id + '-v2.json');
  if (fs.existsSync(dest)) return JSON.parse(fs.readFileSync(dest, 'utf8'));
  console.error('reading ' + spec.dataset + ' ' + spec.config + ' …');
  const total = (await hfRows(spec, 0, 1)).num_rows_total;
  if (!total) throw new Error(spec.dataset + ' ' + spec.config + ': the datasets-server reports no rows');
  const ranges = spec.blocks ? randomBlocks(total, spec.blocks, spec.rows) : [];
  if (!spec.blocks) for (let offset = 0; offset < total; offset += 100) ranges.push([offset, Math.min(100, total - offset)]);
  const texts = [];
  for (const [offset, length] of ranges) {
    const rows = (await hfRows(spec, offset, length)).rows || [];
    if (rows.length !== length) {
      throw new Error(spec.dataset + ' ' + spec.config + ': expected ' + length + ' rows at offset ' + offset + ', got ' + rows.length);
    }
    for (const { row } of rows) if (typeof row[spec.field] === 'string') texts.push(row[spec.field]);
    // The datasets-server rate-limits anonymous clients, so requests are spaced out.
    await sleep(1000);
  }
  const sample = { texts, meta: { dataset: spec.dataset, config: spec.config, total, rows: texts.length, seed: spec.blocks ? SEED : null } };
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest + '.part', JSON.stringify(sample));
  fs.renameSync(dest + '.part', dest);
  return sample;
}

const read = (p) => fs.readFileSync(p, 'utf8').replace(BOM, '');
const myanmarLines = (text) => text.split('\n').map((l) => l.trim()).filter((l) => MYANMAR.test(l));
// Pages repeat headings and boilerplate (Wikipedia's "references" heading appears hundreds of times),
// so every set is measured on its distinct lines.
const unique = (xs) => [...new Set(xs)];
const uniquePairs = (pairs) => [...new Map(pairs.map((p) => [p[0] + '\t' + p[1], p])).values()];

// Where each data set comes from and under which terms. `unlicensed` sources are only read with --with-unlicensed
// and are never part of the published benchmark.
export const SOURCES = [
  { id: 'google', title: 'google/language-resources zawgyi_unicode_test.tsv', url: 'https://github.com/google/language-resources/blob/master/my/zawgyi_unicode_test.tsv',
    license: 'Apache-2.0', licenseUrl: 'https://github.com/google/language-resources/blob/master/LICENSE', use: 'Conversion reference pairs' },
  { id: 'cldr', title: 'Unicode CLDR my-t-my-s0-zawgyi.txt', url: 'https://github.com/unicode-org/cldr/blob/main/common/testData/transforms/my-t-my-s0-zawgyi.txt',
    license: 'Unicode License V3', licenseUrl: 'https://github.com/unicode-org/cldr/blob/main/LICENSE', use: 'Conversion reference pairs (ICU)' },
  { id: 'waitzar', title: 'WaitZar words.zawgyi.txt', url: 'https://github.com/yathit/waitzar/blob/master/FontConvertTester/words.zawgyi.txt',
    license: 'Apache-2.0', licenseUrl: 'https://github.com/yathit/waitzar/blob/master/LICENSE', use: 'Detection of hand-typed Zawgyi' },
  { id: 'flores', title: 'FLORES-200 mya_Mymr (dev + devtest)', url: 'https://github.com/facebookresearch/flores/tree/main/flores200',
    license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', use: 'Unicode flagged as Zawgyi; speed' },
  { id: 'wikipedia', title: 'Burmese Wikipedia (wikimedia/wikipedia 20231101.my), 1,000 articles in 25 seeded random blocks', url: 'https://huggingface.co/datasets/wikimedia/wikipedia',
    license: 'CC BY-SA 3.0 and GFDL', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', use: 'Unicode flagged as Zawgyi; round trip; speed' },
  { id: 'okell', title: 'John Okell, A Corpus of Modern Burmese', url: 'https://zenodo.org/records/1202324',
    license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', use: 'Unicode flagged as Zawgyi' },
  { id: 'glotcc', title: "GlotCC-V1 Shan, Mon, S'gaw Karen, Pa'o (all documents)", url: 'https://huggingface.co/datasets/cis-lmu/GlotCC-V1',
    license: 'CC0 1.0 (text from Common Crawl, whose terms of use apply)', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', use: 'Other Myanmar-script languages flagged as Zawgyi' },
  { id: 'mc4', title: 'mC4 c4-my validation (allenai/c4)', url: 'https://huggingface.co/datasets/allenai/c4',
    license: 'ODC-BY (text from Common Crawl, whose terms of use apply)', licenseUrl: 'https://opendatacommons.org/licenses/by/1-0/', use: 'Web text without labels' },
  { id: 'queries', title: 'sven-oly/Zawgyi-Unicode 2018 top 10k search queries', url: 'https://github.com/sven-oly/Zawgyi-Unicode',
    license: 'none stated', licenseUrl: null, use: 'Detection of real search queries (opt-in only)', unlicensed: true }
];

export async function loadAll({ withUnlicensed = false } = {}) {
  const meta = {};
  const lineSet = (id, lines) => {
    const distinct = unique(lines);
    meta[id] = { ...(meta[id] || {}), lines: lines.length, unique: distinct.length };
    return distinct;
  };

  const google = uniquePairs(read(await file('google')).split('\n').slice(1)
    .map((l) => l.split('\t'))
    .filter((r) => r.length >= 3 && r[1] && r[2] && !/EXAMPLE NEEDED/.test(r.join(' ')))
    .map((r) => [r[1], r[2]]));

  // Most CLDR pairs repeat Google's file word for word; only the pairs Google does not have are measured.
  const googleKeys = new Set(google.map((p) => p[0] + '\t' + p[1]));
  const cldrAll = uniquePairs(read(await file('cldr')).split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('\t'))
    .filter((r) => r.length >= 2 && r[0] && r[1])
    .map((r) => [r[0], r[1].trimEnd()]));
  const cldr = cldrAll.filter((p) => !googleKeys.has(p[0] + '\t' + p[1]));
  meta.google = { pairs: google.length };
  meta.cldr = { pairs: cldrAll.length, notInGoogle: cldr.length };

  // No license is stated for the query log, so it is only read on request.
  // Columns: query, freq, then the C++ and the JS myanmar-tools detector (p, converted, same?, class).
  // A row is labelled only when both detectors give the same class, Z (Zawgyi) or U (Unicode).
  const queries = !withUnlicensed ? null : [...new Map(read(await file('queries')).split('\n').slice(2)
    .map((l) => l.split('\t'))
    .filter((r) => r.length > 9 && r[0] && r[5] === r[9] && (r[5] === 'Z' || r[5] === 'U'))
    .map((r) => [r[0], { text: r[0], label: r[5] === 'Z' ? 'zawgyi' : 'unicode' }])).values()];

  const waitzar = lineSet('waitzar', myanmarLines(read(await file('waitzar'))));

  const dataDir = path.join(CACHE, 'data');
  const floresFiles = ['flores200_dataset/dev/mya_Mymr.dev', 'flores200_dataset/devtest/mya_Mymr.devtest'];
  if (!fs.existsSync(path.join(dataDir, 'flores', floresFiles[1]))) {
    const archive = await file('flores');
    fs.mkdirSync(path.join(dataDir, 'flores'), { recursive: true });
    // Relative paths and cwd: GNU tar on Windows reads "C:" in an absolute path as a remote host.
    execFileSync('tar', ['-xzf', path.basename(archive), '-C', 'flores', ...floresFiles], { cwd: dataDir });
  }
  const flores = lineSet('flores', floresFiles.flatMap((f) => myanmarLines(read(path.join(dataDir, 'flores', f)))));

  const okell = lineSet('okell', myanmarLines(read(await file('okell'))));

  const mc4 = lineSet('mc4', zlib.gunzipSync(fs.readFileSync(await file('mc4'))).toString('utf8').split('\n')
    .filter(Boolean)
    .flatMap((l) => myanmarLines(JSON.parse(l).text)));

  const sampled = async (id) => {
    const sample = await hfSample(id);
    meta[id] = { ...sample.meta };
    return lineSet(id, sample.texts.flatMap(myanmarLines));
  };
  const wikipedia = await sampled('wikipedia');
  const other = {};
  for (const id of ['shn', 'mnw', 'ksw', 'blk']) other[id] = await sampled(id);

  for (const [id, lines] of Object.entries({ waitzar, flores, okell, mc4, wikipedia, ...other })) {
    if (lines.length === 0) throw new Error(id + ': no lines with Myanmar text');
  }

  return { google, cldr, queries, waitzar, flores, okell, mc4, wikipedia, other, meta };
}
