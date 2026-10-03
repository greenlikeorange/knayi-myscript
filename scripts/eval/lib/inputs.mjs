// Inputs for compare.mjs and perf.mjs: the cached corpora, generated inputs, seeded fuzz, perf workloads and the
// adversarial shapes for growth exponents. Only the corpora need the eval cache; everything else is made here.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { loadAll } from '../datasets.mjs';

const require = createRequire(import.meta.url);
const ROOT = new URL('../../../', import.meta.url);
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
  const rows = rowProbes();
  return [
    set('generated.pairs', 'myanmar', 'generated', pairs, 'U+1000-U+109F alone, doubled, and every ordered pair after U+1000'),
    set('generated.extended', 'myanmar', 'generated', extended, 'Myanmar Extended-A/B/C, spaces and joiners next to U+1000'),
    set('generated.rows', 'myanmar', 'generated', rows.lines, rows.about),
    set('generated.win', 'win', 'generated', win, 'printable Latin-1 alone and before printable ASCII'),
    set('generated.cp1252', 'win', 'generated', cp1252, 'Windows-1252 and C1 characters next to printable ASCII')
  ];
}

// The probes the tests already hold, so that compare sees every one of them under every call form, in every
// build and runtime it runs: the main and edge probes of the table rows (test/fixtures/tables.json), every
// string in the examples of README.md, MIGRATION.md and ARCHITECTURE.md, and the matrix's content probes
// (scripts/contract/matrix.js). Each is used alone and with ka, the digit one, a space, Win's ka (u) or the
// digit 1 before or after it. They reach rules of four or more characters, and the branches of each rule, that
// the generated pairs and the fuzz alphabets do not build: o with e, aa and asat, for example. All of them are
// synthetic or hand-written (decision 22). The set is kind 'myanmar' and not a corpus, so the Win call forms
// read it too.
function rowProbes() {
  const probes = [];
  const fixture = JSON.parse(fs.readFileSync(new URL('test/fixtures/tables.json', ROOT), 'utf8'));
  for (const entry of Object.values(fixture.cases)) {
    probes.push(entry.probe, ...(entry.edges || []).map((edge) => edge.probe));
  }
  const tables = probes.length;
  const acorn = require('acorn');
  const { readExamples } = require('../../testing/readme-examples.js');
  const strings = (code) => {
    const found = [];
    (function walk(node) {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node.type !== 'string') return;
      if (node.type === 'Literal' && typeof node.value === 'string') found.push(node.value);
      for (const key of Object.keys(node)) if (node[key] && typeof node[key] === 'object') walk(node[key]);
    })(acorn.parse('(' + code + ')', { ecmaVersion: 'latest' }));
    return found;
  };
  for (const doc of ['README.md', 'MIGRATION.md', 'ARCHITECTURE.md']) {
    for (const example of readExamples(fs.readFileSync(new URL(doc, ROOT), 'utf8'))) {
      probes.push(...strings(example.code), ...(example.expected === null ? [] : strings(example.expected)));
    }
  }
  const docs = probes.length - tables;
  const { CONTENTS } = require('../../contract/matrix.js');
  for (const [, value] of CONTENTS) if (typeof value === 'string' || value instanceof String) probes.push(String(value));
  const matrix = probes.length - tables - docs;
  const around = [cp(KA), cp(0x1041), ' ', 'u', '1'];
  const lines = distinct(probes).filter(Boolean).flatMap((p) => [p, ...around.flatMap((c) => [c + p, p + c])]);
  const num = (n) => n.toLocaleString('en-US');
  return {
    lines,
    about: num(tables) + ' table probes, ' + num(docs) + ' strings of the README, MIGRATION and ARCHITECTURE examples, ' +
      num(matrix) + ' matrix probes; alone and next to ka, a digit, a space, u and 1'
  };
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

// Every cached corpus, as distinct lines, through datasets.mjs. The reference pairs give both columns. The corpora
// in `without` are not read, so they are neither downloaded nor checked (CI passes mc4).
export async function corpusSets({ without = [] } = {}) {
  const data = await loadAll({ withLegacy: true, without });
  const M = data.meta;
  const read = (id) => !without.includes(id);
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
      read('flores') && lines('flores', data.flores, 'FLORES-200 mya_Mymr dev + devtest'),
      read('wikipedia') && lines('wikipedia', data.wikipedia, 'Wikipedia sample v2'),
      ...Object.keys(data.legacy).map((id) => lines(id, data.legacy[id], 'Wikipedia sample v1 (legacy cache)')),
      read('okell') && lines('okell', data.okell, 'Okell corpus'),
      read('mc4') && lines('mc4', data.mc4, 'mC4 c4-my validation, raw (mostly Zawgyi)'),
      read('waitzar') && lines('waitzar', data.waitzar, 'WaitZar Zawgyi words'),
      ...['shn', 'mnw', 'ksw', 'blk'].filter(read).map((id) => lines(id, data.other[id], 'GlotCC ' + id + ' sample')),
      read('google') && pairs('google', data.google, 'google/language-resources Zawgyi/Unicode pairs'),
      read('cldr') && pairs('cldr', data.cldr, 'CLDR pairs not in Google\'s file')
    ].filter(Boolean),
    data
  };
}

// The text perf.mjs times: `count` FLORES lines in file order, the same lines in Zawgyi (converted by the base
// copy, so both copies get the same input), and a synthetic Win version of them for speed only: each Zawgyi glyph
// is replaced by a Win key that the base copy reads as the same Unicode text.
export function perfTexts(flores, base, count) {
  const unicode = flores.slice(0, count);
  const zawgyi = unicode.map((u) => base.fontConvert(u, 'zawgyi', 'unicode'));
  const byText = new Map();
  for (const w of [...LATIN1, ...CP1252]) {
    const u = base.fontConvert(cp(w), 'unicode', 'win');
    if (typeof u === 'string' && u !== '' && !byText.has(u)) byText.set(u, cp(w));
  }
  const glyph = new Map();
  for (const z of MYANMAR) {
    const w = byText.get(base.fontConvert(cp(z), 'unicode', 'zawgyi'));
    if (w) glyph.set(cp(z), w);
  }
  const win = zawgyi.map((z) => Array.from(z, (ch) => glyph.get(ch) || ch).join(''));
  return { unicode, zawgyi, win };
}

// The same text in four shapes: a call per line, a call per word, one call on the lines joined by spaces into one
// long line, and one call on the lines joined by line breaks (a document). With `longUnits`, the string and the
// document repeat the lines until they are that many UTF-16 units long, and are cut there.
export const WORKLOADS = ['line', 'word', 'string', 'document'];
export function workloads(lines, longUnits) {
  return {
    line: lines,
    word: distinct(lines.flatMap((l) => l.split(/\s+/)).filter(Boolean)),
    string: [repeatedTo(lines.join(' '), ' ', longUnits)],
    document: [repeatedTo(lines.join('\n'), '\n', longUnits)]
  };
}

function repeatedTo(text, joiner, units) {
  if (!units) return text;
  let out = text;
  while (out.length < units) out += joiner + text;
  return out.slice(0, units);
}

// Inputs that once took, or could take, super-linear time. make(n) returns about n UTF-16 units.
// The first 26 are the adversarial sweep of the refactor plan; the rest come from test/performance.test.js and the
// 2.10 quadratic normalize (a consonant followed by a long run of e or medial ra).
const rep = (unit, n) => unit.repeat(Math.max(1, Math.round(n / unit.length)));
const s = (...codes) => cp(...codes);
export const SHAPES = [
  ['marks on one consonant', (n) => s(KA) + rep(s(0x102d, 0x102f, 0x103a, 0x103b), n)],
  ['e, no consonant', (n) => rep(s(0x1031), n)],
  ['e before consonants', (n) => rep(s(0x1031, KA), n)],
  ['medial ra, no consonant', (n) => rep(s(0x103c), n)],
  ['wa', (n) => rep(s(0x101d), n)],
  ['zero', (n) => rep(s(0x1040), n)],
  ['seven', (n) => rep(s(0x1047), n)],
  ['digit wa', (n) => rep(s(0x1041, 0x101d), n)],
  ['zero dot', (n) => rep(s(0x1040, 0x2e), n)],
  ['spaces before marks', (n) => s(KA) + rep(s(0x20, 0x1037), n)],
  ['stacked consonants', (n) => s(KA) + rep(s(0x1039, KA), n)],
  ['kinzi', (n) => rep(s(0x1004, 0x103a, 0x1039, KA), n)],
  ['virama run', (n) => s(KA) + rep(s(0x1039), n)],
  ['asat run', (n) => s(KA) + rep(s(0x103a), n)],
  ['ZWSP in syllable', (n) => s(KA) + rep(s(0x200b, AA), n)],
  ['ZWSP run then mark', (n) => s(KA) + rep(s(0x200b), n) + s(0x20, 0x1037)],
  ['spaces only + one letter', (n) => s(KA) + rep(' ', n)],
  ['consonants, no marks', (n) => rep(s(KA), n)],
  ['syllables ka-aa', (n) => rep(s(KA, AA), n)],
  ['Zawgyi e-ka-aa-asat', (n) => rep(s(0x1031, KA, AA, 0x1039), n)],
  ['Zawgyi medial ra glyphs', (n) => rep(s(0x107e), n)],
  ['Shan letters + tone', (n) => rep(s(0x1075, 0x1087), n)],
  ['ASCII only', (n) => rep('a', n)],
  ['ASCII + one Myanmar', (n) => rep('a ', n) + s(KA)],
  ['Win e+ra+ka (a j u)', (n) => rep('aju', n)],
  ['Win marks on one base', (n) => 'u' + rep('dkfs', n)],
  ['Zawgyi stacked ka + aa i', (n) => s(KA, 0x1060) + rep(s(AA, 0x102d), n)],
  ['Zawgyi kinzi + aa i', (n) => s(0x1064) + rep(s(AA, 0x102d), n)],
  ['ka + e run', (n) => s(KA) + rep(s(0x1031), n)],
  ['ka + medial ra run', (n) => s(KA) + rep(s(0x103c), n)],
  ['ka + asat run, then medial ra run', (n) => s(KA) + rep(s(0x103a), n / 2) + rep(s(0x103c), n / 2)],
  ['ka + (e + medial ra) run', (n) => s(KA) + rep(s(0x1031, 0x103c), n)],
  ['ka + i + e run', (n) => s(KA, 0x102d) + rep(s(0x1031), n)],
  ['ka + medial ya run, then e', (n) => s(KA) + rep(s(0x103b), n) + s(0x1031)],
  ['ka + (medial ya + e) run', (n) => s(KA) + rep(s(0x103b, 0x1031), n)],
  ['(ka + 50 e) repeated', (n) => rep(s(KA) + s(0x1031).repeat(50), n)]
].map(([id, make]) => ({ id, make }));

// The call forms each shape runs through (the operations of the plan's sweep).
export const GROWTH_FORMS = ['normalize', 'fontConvert.zawgyi-unicode', 'fontConvert.unicode-zawgyi', 'fontConvert.win-unicode',
  'fontConvert.detected-unicode', 'syllBreak.unicode', 'syllBreak.zawgyi', 'spellingFix.unicode', 'truncate.30', 'fontDetect'];

// Every character test/growth.timing.js draws from (scripts/testing/growth-alphabets.js: letters, Burmese, Zawgyi and
// other marks, medials, Win keys, blanks and punctuation), repeated alone and after ka. A run of one character is
// where a loop that rescans the current run hides: one that rescanned a run of anusvara for each anusvara took 8 s
// at 100k characters and passed every shape above, at every size perf.mjs measures. perf.mjs runs each through
// PUMP_FORMS with a quick first reading, and measures it in full only when that reading is high.
const { ALL: GROWTH_CHARACTERS } = require('../../testing/growth-alphabets.js');
const unitName = (ch) => 'U+' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
export const PUMPS = GROWTH_CHARACTERS.flatMap((ch) => [
  { id: unitName(ch) + ' run', make: (n) => rep(ch, n) },
  { id: 'ka + ' + unitName(ch) + ' run', make: (n) => s(KA) + rep(ch, n) }
]);
export const PUMP_FORMS = ['normalize', 'fontConvert.zawgyi-unicode', 'fontConvert.win-unicode', 'fontConvert.detected-unicode',
  'fontConvert.unicode-zawgyi', 'syllBreak.unicode', 'spellingFix.unicode'];
