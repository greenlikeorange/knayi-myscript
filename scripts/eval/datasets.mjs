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

// The two FLORES files taken out of the archive. The archive is pinned above; these pins catch a damaged or
// edited copy of the extracted text, which is otherwise never checked again.
const FLORES_FILES = {
  'flores200_dataset/dev/mya_Mymr.dev': 'fb8aeaf0144f1236287645eb8e91733276907448ad50bcd978ff9309d26487b9',
  'flores200_dataset/devtest/mya_Mymr.devtest': 'bbccb36a909003dfbaf68cf59b63729769cab723a0f90a85f68efd9ded7b1512'
};

// Rows read through the Hugging Face datasets-server. Small configs are read whole. Large ones are read as
// `blocks` random blocks of `rows` rows, picked with a fixed seed so every run reads the same rows.
// The datasets-server always serves the current revision of a dataset, so a new download can hold other rows
// than the sample the published results were made from. Each cached sample file is pinned by its sha256: a
// sample that does not match stops the run, and `node scripts/eval/datasets.mjs --refresh-samples` downloads
// new ones and prints their hashes for review.
const SEED = 20261002;
const HF_SAMPLES = {
  wikipedia: { dataset: 'wikimedia/wikipedia', config: '20231101.my', field: 'text', blocks: 25, rows: 40,
    sha256: 'df5efe2a7d3410fdefbcbc98e621e6d870531fbe4ad7e0ac75aec82285516c12' },
  shn: { dataset: 'cis-lmu/GlotCC-V1', config: 'shn-Mymr', field: 'content',
    sha256: '27c29c05f09ad4b60825eacf66ec2bc89f771d71f85cd41afbc2a68fd470de16' },
  mnw: { dataset: 'cis-lmu/GlotCC-V1', config: 'mnw-Mymr', field: 'content',
    sha256: '674096e27f3e7d160c752a4966a3dcdf512e1e740fa6d5607f09ab2e6649453d' },
  ksw: { dataset: 'cis-lmu/GlotCC-V1', config: 'ksw-Mymr', field: 'content',
    sha256: 'ff16ee6fbae60855f8f688785a69aba063651dd6294733490877a6179834d32d' },
  blk: { dataset: 'cis-lmu/GlotCC-V1', config: 'blk-Mymr', field: 'content',
    sha256: '326dce382e9a57b8cf51c0750323998157ea082210054f180311b32f26278ebe' }
};

// The first Wikipedia sample, from before the sample was redrawn (hf-wikipedia.json: a bare array of 1,000
// articles, 10,732 distinct lines). Nothing downloads it any more and it shares no article with the current
// sample, but older caches still hold it and earlier measurements marked "(v1)" used it. compare.mjs reads it as
// an extra corpus when it is cached.
const LEGACY_SAMPLES = {
  'wikipedia-v1': { file: 'hf-wikipedia.json', sha256: '7dd6303f18139f5ae995322b7da30202aa23d2f79b546a86b553b74f26aaed3e' }
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

const samplePath = (id) => path.join(CACHE, 'data', 'hf-' + id + '-v2.json');

function sampleMismatch(id, what, actual) {
  const spec = HF_SAMPLES[id];
  return new Error(what + ' of ' + spec.dataset + ' ' + spec.config + ' (' + path.basename(samplePath(id)) + ') has sha256 ' +
    actual + ', but ' + spec.sha256 + ' is pinned. The published results were made from the pinned sample, and another ' +
    'sample would change them without notice. If the dataset changed upstream, run ' +
    '`node scripts/eval/datasets.mjs --refresh-samples ' + id + '`, review the new sample, and update its sha256 in ' +
    'HF_SAMPLES (scripts/eval/datasets.mjs). If only the cached file is damaged, delete it to download it again.');
}

// With `refresh`, the sample is downloaded again and kept whatever its hash; the caller reports the new hash.
async function hfSample(id, { refresh = false } = {}) {
  const spec = HF_SAMPLES[id];
  const dest = samplePath(id);
  if (fs.existsSync(dest) && !refresh) {
    const actual = sha256(dest);
    if (actual !== spec.sha256) throw sampleMismatch(id, 'The cached sample', actual);
    return JSON.parse(fs.readFileSync(dest, 'utf8'));
  }
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
  const body = JSON.stringify(sample);
  const actual = crypto.createHash('sha256').update(body).digest('hex');
  if (actual !== spec.sha256 && !refresh) throw sampleMismatch(id, 'The sample downloaded now', actual);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest + '.part', body);
  fs.renameSync(dest + '.part', dest);
  return sample;
}

// Extracts the two FLORES files from the pinned archive when they are missing or do not match their pins.
async function floresFiles(dataDir) {
  const intact = () => Object.entries(FLORES_FILES).every(([f, hash]) => {
    const p = path.join(dataDir, 'flores', f);
    return fs.existsSync(p) && sha256(p) === hash;
  });
  if (intact()) return Object.keys(FLORES_FILES);
  const archive = await file('flores');
  fs.mkdirSync(path.join(dataDir, 'flores'), { recursive: true });
  // Relative paths and cwd: GNU tar on Windows reads "C:" in an absolute path as a remote host.
  execFileSync('tar', ['-xzf', path.basename(archive), '-C', 'flores', ...Object.keys(FLORES_FILES)], { cwd: dataDir });
  if (!intact()) throw new Error('The FLORES files extracted from ' + archive + ' do not match their pinned sha256 (FLORES_FILES).');
  return Object.keys(FLORES_FILES);
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

// Every line set is returned as its distinct lines. `meta` states, per set, how many lines it had and how many
// are distinct, and the sha256 its source is pinned to (the download, the sample or the extracted archive).
// `withLegacy` also returns, in `legacy`, cached samples that nothing downloads any more (LEGACY_SAMPLES).
export async function loadAll({ withUnlicensed = false, withLegacy = false } = {}) {
  const meta = {};
  const lineSet = (id, lines, sha) => {
    const distinct = unique(lines);
    meta[id] = { ...(meta[id] || {}), lines: lines.length, unique: distinct.length, sha256: sha };
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
  meta.google = { pairs: google.length, sha256: FILES.google.sha256 };
  meta.cldr = { pairs: cldrAll.length, notInGoogle: cldr.length, sha256: FILES.cldr.sha256 };

  // No license is stated for the query log, so it is only read on request.
  // Columns: query, freq, then the C++ and the JS myanmar-tools detector (p, converted, same?, class).
  // A row is labelled only when both detectors give the same class, Z (Zawgyi) or U (Unicode).
  const queries = !withUnlicensed ? null : [...new Map(read(await file('queries')).split('\n').slice(2)
    .map((l) => l.split('\t'))
    .filter((r) => r.length > 9 && r[0] && r[5] === r[9] && (r[5] === 'Z' || r[5] === 'U'))
    .map((r) => [r[0], { text: r[0], label: r[5] === 'Z' ? 'zawgyi' : 'unicode' }])).values()];

  const waitzar = lineSet('waitzar', myanmarLines(read(await file('waitzar'))), FILES.waitzar.sha256);

  const dataDir = path.join(CACHE, 'data');
  const flores = lineSet('flores', (await floresFiles(dataDir)).flatMap((f) => myanmarLines(read(path.join(dataDir, 'flores', f)))),
    FILES.flores.sha256);

  const okell = lineSet('okell', myanmarLines(read(await file('okell'))), FILES.okell.sha256);

  const mc4 = lineSet('mc4', zlib.gunzipSync(fs.readFileSync(await file('mc4'))).toString('utf8').split('\n')
    .filter(Boolean)
    .flatMap((l) => myanmarLines(JSON.parse(l).text)), FILES.mc4.sha256);

  const sampled = async (id) => {
    const sample = await hfSample(id);
    meta[id] = { ...sample.meta };
    return lineSet(id, sample.texts.flatMap(myanmarLines), HF_SAMPLES[id].sha256);
  };
  const wikipedia = await sampled('wikipedia');
  const other = {};
  for (const id of ['shn', 'mnw', 'ksw', 'blk']) other[id] = await sampled(id);

  const legacy = {};
  if (withLegacy) {
    for (const [id, spec] of Object.entries(LEGACY_SAMPLES)) {
      const p = path.join(dataDir, spec.file);
      if (!fs.existsSync(p)) continue;
      const actual = sha256(p);
      if (actual !== spec.sha256) {
        throw new Error(spec.file + ' has sha256 ' + actual + ', but ' + spec.sha256 + ' is pinned (LEGACY_SAMPLES). ' +
          'Nothing downloads this sample any more: restore it from an older cache, or delete it to run without it.');
      }
      legacy[id] = lineSet(id, JSON.parse(fs.readFileSync(p, 'utf8')).flatMap(myanmarLines), spec.sha256);
    }
  }

  for (const [id, lines] of Object.entries({ waitzar, flores, okell, mc4, wikipedia, ...other, ...legacy })) {
    if (lines.length === 0) throw new Error(id + ': no lines with Myanmar text');
  }

  return { google, cldr, queries, waitzar, flores, okell, mc4, wikipedia, other, legacy, meta };
}

// Checks every cached file against its pin without downloading anything. One row per file.
export function checkCache() {
  const dataDir = path.join(CACHE, 'data');
  const row = (name, p, pinned) => {
    if (!fs.existsSync(p)) return { name, status: 'missing' };
    const actual = sha256(p);
    return { name, status: actual === pinned ? 'ok' : 'mismatch', sha256: actual, pinned };
  };
  return [
    ...Object.entries(FILES).map(([id, spec]) => row(id, path.join(dataDir, id + path.extname(new URL(spec.url).pathname)), spec.sha256)),
    ...Object.entries(FLORES_FILES).map(([f, hash]) => row('flores/' + f, path.join(dataDir, 'flores', f), hash)),
    ...Object.entries(HF_SAMPLES).map(([id, spec]) => row('hf-' + id, samplePath(id), spec.sha256)),
    ...Object.entries(LEGACY_SAMPLES).map(([id, spec]) => row(id + ' (legacy)', path.join(dataDir, spec.file), spec.sha256))
  ];
}

// node scripts/eval/datasets.mjs --check                   checks the cache against the pins; downloads nothing
// node scripts/eval/datasets.mjs --refresh-samples [id …]  downloads the Hugging Face samples again, prints their hashes
if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--check') {
    const rows = checkCache();
    for (const r of rows) {
      console.log(r.status.padEnd(9) + r.name + (r.status === 'mismatch' ? ' (found ' + r.sha256 + ', pinned ' + r.pinned + ')' : ''));
    }
    // A missing file is downloaded on first use; only a file that does not match its pin is an error.
    process.exitCode = rows.some((r) => r.status === 'mismatch') ? 1 : 0;
  } else if (args[0] === '--refresh-samples') {
    const ids = args.length > 1 ? args.slice(1) : Object.keys(HF_SAMPLES);
    const unknown = ids.filter((id) => !HF_SAMPLES[id]);
    if (unknown.length) {
      console.error('unknown sample ' + unknown.join(', ') + '; the samples are ' + Object.keys(HF_SAMPLES).join(', '));
      process.exit(2);
    }
    for (const id of ids) {
      const sample = await hfSample(id, { refresh: true });
      const actual = sha256(samplePath(id));
      console.log(id + ': ' + sample.meta.rows + ' of ' + sample.meta.total + ' rows, sha256 ' + actual +
        (actual === HF_SAMPLES[id].sha256 ? ' (matches the pin)' : ' (pinned: ' + HF_SAMPLES[id].sha256 + '; update HF_SAMPLES to use it)'));
    }
  } else {
    console.error('usage: node scripts/eval/datasets.mjs --check | --refresh-samples [' + Object.keys(HF_SAMPLES).join(' ') + ']');
    process.exit(2);
  }
}
