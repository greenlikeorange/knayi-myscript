// Inputs for compare.mjs: the cached corpora, generated inputs and seeded fuzz. Only the corpora need the eval
// cache; everything else is made here.
import { loadAll } from '../datasets.mjs';

const cp = (...codes) => String.fromCodePoint(...codes);
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const distinct = (xs) => [...new Set(xs)];

// mulberry32: a small seeded generator, so a seed always gives the same fuzz strings.
export function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// An input set: { id, kind: 'myanmar' | 'win', origin: 'corpus' | 'generated' | 'fuzz', lines, total, about }.
// `lines` are distinct; `total` is how many there were before duplicates were dropped.
const set = (id, kind, origin, all, about) => {
  const lines = distinct(all);
  return { id, kind, origin, lines, total: all.length, about };
};

const MYANMAR = range(0x1000, 0x109f);
const KA = 0x1000;
const AA = 0x102c;
// Printable Latin-1, the bytes of the Win fonts' keys when text is read as ISO-8859-1.
const LATIN1 = range(0x20, 0xff).filter((c) => c < 0x7f || c >= 0xa0);
const ASCII_PRINTABLE = range(0x21, 0x7e);
// What Windows-1252 shows for bytes 0x80-0x9F (five bytes are undefined), and the C1 controls that ISO-8859-1
// shows for the same bytes. library/win.js reads both.
const CP1252 = [0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d,
  0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178];
const C1 = range(0x80, 0x9f);

export function generatedSets() {
  // Every code point of the Myanmar block alone and doubled, and every ordered pair of them after ka: 25,920.
  const pairs = [];
  for (const a of MYANMAR) {
    pairs.push(cp(a), cp(a, a));
    for (const b of MYANMAR) pairs.push(cp(KA, a, b));
  }
  // Myanmar Extended-A, -B and -C, and the spaces, joiners and marks of punctuation that sit next to Myanmar text:
  // alone, after ka, before ka, and between ka and aa.
  const others = [...range(0xaa60, 0xaa7f), ...range(0xa9e0, 0xa9ff), ...range(0x116d0, 0x116e3),
    0x20, 0x09, 0x0a, 0xa0, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x25cc, 0x2c, 0x2e, 0x30, 0x31, 0x37, 0x61];
  const extended = others.flatMap((c) => [cp(c), cp(KA, c), cp(c, KA), cp(KA, c, AA)]);
  // Win text: every printable Latin-1 character alone and before every printable ASCII character (18,145), and the
  // Windows-1252 characters and C1 controls alone, before and after every printable ASCII character.
  const win = LATIN1.flatMap((a) => [cp(a), ...ASCII_PRINTABLE.map((b) => cp(a, b))]);
  const cp1252 = [...CP1252, ...C1].flatMap((a) => [cp(a), ...ASCII_PRINTABLE.flatMap((b) => [cp(a, b), cp(b, a)])]);
  return [
    set('generated.pairs', 'myanmar', 'generated', pairs, 'U+1000-U+109F alone, doubled, and every ordered pair after U+1000'),
    set('generated.extended', 'myanmar', 'generated', extended, 'Myanmar Extended-A/B/C, spaces and joiners next to U+1000'),
    set('generated.win', 'win', 'generated', win, 'printable Latin-1 alone and before printable ASCII'),
    set('generated.cp1252', 'win', 'generated', cp1252, 'Windows-1252 and C1 characters next to printable ASCII')
  ];
}

export const DEFAULT_SEED = 20261003;

// Seeded random strings: over the whole Myanmar block with separators, over a base and Burmese marks (where the
// syllable reordering lives), and over the Win alphabet.
export function fuzzSets({ seed = DEFAULT_SEED, count = 20000 } = {}) {
  const make = (offset, alphabet, gen) => {
    const next = random(seed + offset);
    const pick = (xs) => xs[Math.floor(next() * xs.length)];
    const out = [];
    for (let i = 0; i < count; i++) out.push(gen(next, pick, alphabet));
    return out;
  };
  const block = [...MYANMAR, 0x20, 0x200b, 0x200c, 0x2e, 0x2c, 0x31].map((c) => cp(c));
  const bases = [0x1000, 0x101d, 0x1040, 0x1047, 0x1004, 0x100b, 0x100d, 0x100f, 0x1025].map((c) => cp(c));
  const marks = [...range(0x102b, 0x1032), 0x1036, 0x1037, 0x1038, ...range(0x1039, 0x103e)].map((c) => cp(c));
  const between = [0x20, 0x200b, 0x1039, 0x1000].map((c) => cp(c));
  const winAlphabet = [...LATIN1, ...CP1252].map((c) => cp(c));
  const string = (next, pick, alphabet, max) => {
    let s = '';
    const n = 1 + Math.floor(next() * max);
    for (let j = 0; j < n; j++) s += pick(alphabet);
    return s;
  };
  const about = (what) => what + ', seed ' + seed + ', ' + count.toLocaleString('en-US') + ' strings';
  return [
    set('fuzz.block', 'myanmar', 'fuzz', make(0, block, (next, pick) => string(next, pick, block, 12)),
      about('1-12 characters of U+1000-U+109F, spaces, ZWSP, ZWNJ and punctuation')),
    set('fuzz.marks', 'myanmar', 'fuzz', make(1, marks, (next, pick) => {
      let s = pick(bases);
      const n = 1 + Math.floor(next() * 8);
      for (let j = 0; j < n; j++) s += next() < 0.8 ? pick(marks) : pick(between);
      return s;
    }), about('a base and 1-8 Burmese marks, spaces, ZWSP, virama or ka')),
    set('fuzz.win', 'win', 'fuzz', make(2, winAlphabet, (next, pick) => string(next, pick, winAlphabet, 12)),
      about('1-12 characters of Latin-1 and Windows-1252'))
  ];
}

// Every cached corpus, as distinct lines, through datasets.mjs. The reference pairs give both columns.
export async function corpusSets() {
  const data = await loadAll({ withLegacy: true });
  const M = data.meta;
  const pin = (id) => (M[id] && M[id].sha256 ? 'sha256 ' + M[id].sha256.slice(0, 12) : '');
  const lines = (id, xs, what) => {
    const m = M[id];
    const s = set(id, 'myanmar', 'corpus', xs, what + ', ' + m.unique.toLocaleString('en-US') + ' distinct of ' +
      m.lines.toLocaleString('en-US') + ' lines, ' + pin(id));
    return s;
  };
  const pairs = (id, ps, what) => set(id, 'myanmar', 'corpus', ps.flatMap((p) => [p[0], p[1]]),
    what + ', ' + ps.length + ' pairs, both columns, ' + pin(id));
  return {
    sets: [
      lines('flores', data.flores, 'FLORES-200 mya_Mymr dev + devtest'),
      lines('wikipedia', data.wikipedia, 'Wikipedia sample v2'),
      ...Object.keys(data.legacy).map((id) => lines(id, data.legacy[id], 'Wikipedia sample v1 (legacy cache)')),
      lines('okell', data.okell, 'Okell corpus'),
      lines('mc4', data.mc4, 'mC4 c4-my validation, raw (mostly Zawgyi)'),
      lines('waitzar', data.waitzar, 'WaitZar Zawgyi words'),
      ...['shn', 'mnw', 'ksw', 'blk'].map((id) => lines(id, data.other[id], 'GlotCC ' + id + ' sample')),
      pairs('google', data.google, 'google/language-resources Zawgyi/Unicode pairs'),
      pairs('cldr', data.cldr, 'CLDR pairs not in Google\'s file')
    ],
    data
  };
}
