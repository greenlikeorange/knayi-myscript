// Public Zawgyi and Unicode datasets used to evaluate knayi.
// Files are downloaded on first use into the cache directory and are never committed:
// some sources have no license or a non-commercial one, so we link to them instead of copying them.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const CACHE = process.env.KNAYI_EVAL_CACHE || path.join(import.meta.dirname, '..', '..', '.eval-cache');

const cp = (n) => String.fromCodePoint(n);
export const MYANMAR = new RegExp('[' + cp(0x1000) + '-' + cp(0x109f) + ']');
const BOM = new RegExp('^' + cp(0xfeff));

const github = (repo, sha, file) =>
  'https://raw.githubusercontent.com/' + repo + '/' + sha + '/' + file.split('/').map(encodeURIComponent).join('/');

// Downloads pinned to a commit or revision, with the sha256 of the file we evaluated against.
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

// Samples read through the Hugging Face datasets-server: `pages` pages of 100 rows, `stride` rows apart.
const HF_SAMPLES = {
  wikipedia: { dataset: 'wikimedia/wikipedia', config: '20231101.my', field: 'text', pages: 10, stride: 10000 },
  shn: { dataset: 'cis-lmu/GlotCC-V1', config: 'shn-Mymr', field: 'content', pages: 7, stride: 100 },
  mnw: { dataset: 'cis-lmu/GlotCC-V1', config: 'mnw-Mymr', field: 'content', pages: 1, stride: 100 },
  ksw: { dataset: 'cis-lmu/GlotCC-V1', config: 'ksw-Mymr', field: 'content', pages: 1, stride: 100 },
  blk: { dataset: 'cis-lmu/GlotCC-V1', config: 'blk-Mymr', field: 'content', pages: 1, stride: 100 }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': 'knayi-myscript-eval' } });
    if (res.ok) return res;
    if (attempt >= 4 || (res.status !== 429 && res.status < 500)) {
      throw new Error(url + ': HTTP ' + res.status);
    }
    await sleep(1000 * attempt);
  }
}

async function file(id) {
  const spec = FILES[id];
  const dest = path.join(CACHE, 'data', id + path.extname(new URL(spec.url).pathname));
  if (!fs.existsSync(dest)) {
    console.error('downloading ' + id + ' …');
    const res = await fetchWithRetry(spec.url);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  }
  const hash = crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');
  if (spec.sha256 && hash !== spec.sha256) {
    console.error('warning: ' + id + ' changed upstream (sha256 ' + hash + '); results may differ from the pinned run.');
  }
  return dest;
}

async function hfSample(id) {
  const spec = HF_SAMPLES[id];
  const dest = path.join(CACHE, 'data', 'hf-' + id + '.json');
  if (fs.existsSync(dest)) return JSON.parse(fs.readFileSync(dest, 'utf8'));
  console.error('sampling ' + spec.dataset + ' ' + spec.config + ' …');
  const texts = [];
  for (let page = 0; page < spec.pages; page++) {
    const query = new URLSearchParams({
      dataset: spec.dataset, config: spec.config, split: 'train', offset: String(page * spec.stride), length: '100'
    });
    const res = await fetchWithRetry('https://datasets-server.huggingface.co/rows?' + query);
    const body = await res.json();
    for (const { row } of body.rows || []) {
      if (typeof row[spec.field] === 'string') texts.push(row[spec.field]);
    }
    await sleep(300);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(texts));
  return texts;
}

const read = (p) => fs.readFileSync(p, 'utf8').replace(BOM, '');
const myanmarLines = (text) => text.split('\n').map((l) => l.trim()).filter((l) => MYANMAR.test(l));

// Where each data set comes from and under which terms. `unlicensed` sources are only read with --with-unlicensed
// and are never part of the published benchmark.
export const SOURCES = [
  { id: 'google', title: 'google/language-resources zawgyi_unicode_test.tsv', url: 'https://github.com/google/language-resources/blob/master/my/zawgyi_unicode_test.tsv',
    license: 'Apache-2.0', licenseUrl: 'https://github.com/google/language-resources/blob/master/LICENSE', use: 'Conversion, gold pairs' },
  { id: 'cldr', title: 'Unicode CLDR my-t-my-s0-zawgyi.txt', url: 'https://github.com/unicode-org/cldr/blob/main/common/testData/transforms/my-t-my-s0-zawgyi.txt',
    license: 'Unicode License V3', licenseUrl: 'https://github.com/unicode-org/cldr/blob/main/LICENSE', use: 'Conversion, gold pairs' },
  { id: 'waitzar', title: 'WaitZar words.zawgyi.txt', url: 'https://github.com/yathit/waitzar/blob/master/FontConvertTester/words.zawgyi.txt',
    license: 'Apache-2.0', licenseUrl: 'https://github.com/yathit/waitzar/blob/master/LICENSE', use: 'Detection of hand-typed Zawgyi' },
  { id: 'flores', title: 'FLORES-200 mya_Mymr (dev + devtest)', url: 'https://github.com/facebookresearch/flores/tree/main/flores200',
    license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', use: 'Unicode flagged as Zawgyi; speed' },
  { id: 'wikipedia', title: 'Burmese Wikipedia (wikimedia/wikipedia 20231101.my), 1,000 articles', url: 'https://huggingface.co/datasets/wikimedia/wikipedia',
    license: 'CC BY-SA 3.0 and GFDL', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', use: 'Unicode flagged as Zawgyi; round trip; speed' },
  { id: 'okell', title: 'John Okell, A Corpus of Modern Burmese', url: 'https://zenodo.org/records/1202324',
    license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', use: 'Unicode flagged as Zawgyi' },
  { id: 'glotcc', title: "GlotCC-V1 Shan, Mon, S'gaw Karen, Pa'o", url: 'https://huggingface.co/datasets/cis-lmu/GlotCC-V1',
    license: 'CC0 1.0 (text from Common Crawl, whose terms of use apply)', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', use: 'Other Myanmar-script languages flagged as Zawgyi' },
  { id: 'mc4', title: 'mC4 c4-my validation (allenai/c4)', url: 'https://huggingface.co/datasets/allenai/c4',
    license: 'ODC-BY (text from Common Crawl, whose terms of use apply)', licenseUrl: 'https://opendatacommons.org/licenses/by/1-0/', use: 'Web text without labels' },
  { id: 'queries', title: 'sven-oly/Zawgyi-Unicode 2018 top 10k search queries', url: 'https://github.com/sven-oly/Zawgyi-Unicode',
    license: 'none stated', licenseUrl: null, use: 'Detection of real search queries (opt-in only)', unlicensed: true }
];

export async function loadAll({ withUnlicensed = false } = {}) {
  const google = read(await file('google')).split('\n').slice(1)
    .map((l) => l.split('\t'))
    .filter((r) => r.length >= 3 && r[1] && r[2] && !/EXAMPLE NEEDED/.test(r.join(' ')))
    .map((r) => [r[1], r[2]]);

  const cldr = read(await file('cldr')).split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('\t'))
    .filter((r) => r.length >= 2 && r[0] && r[1])
    .map((r) => [r[0], r[1].trimEnd()]);

  // No license is stated for the query log, so it is only read on request.
  // Columns: query, freq, then the C++ and the JS myanmar-tools detector (p, converted, same?, class).
  // A row is labelled only when both detectors give the same class, Z (Zawgyi) or U (Unicode).
  const queries = !withUnlicensed ? null : read(await file('queries')).split('\n').slice(2)
    .map((l) => l.split('\t'))
    .filter((r) => r.length > 9 && r[0] && r[5] === r[9] && (r[5] === 'Z' || r[5] === 'U'))
    .map((r) => ({ text: r[0], label: r[5] === 'Z' ? 'zawgyi' : 'unicode' }));

  const waitzar = myanmarLines(read(await file('waitzar')));

  const floresDir = path.join(CACHE, 'data', 'flores');
  const floresFiles = ['flores200_dataset/dev/mya_Mymr.dev', 'flores200_dataset/devtest/mya_Mymr.devtest'];
  if (!fs.existsSync(path.join(floresDir, floresFiles[1]))) {
    fs.mkdirSync(floresDir, { recursive: true });
    execFileSync('tar', ['-xzf', await file('flores'), '-C', floresDir, ...floresFiles]);
  }
  const flores = floresFiles.flatMap((f) => myanmarLines(read(path.join(floresDir, f))));

  const okell = myanmarLines(read(await file('okell')));

  const mc4 = zlib.gunzipSync(fs.readFileSync(await file('mc4'))).toString('utf8').split('\n')
    .filter(Boolean)
    .flatMap((l) => myanmarLines(JSON.parse(l).text));

  const wikipedia = (await hfSample('wikipedia')).flatMap(myanmarLines);
  const other = {};
  for (const id of ['shn', 'mnw', 'ksw', 'blk']) other[id] = (await hfSample(id)).flatMap(myanmarLines);

  return { google, cldr, queries, waitzar, flores, okell, mc4, wikipedia, other };
}
