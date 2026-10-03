const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const knayi = require('../main');

// Super-linear time on structured random input. Each case is a prefix, a short unit repeated many times and a
// suffix, drawn from the characters the rules care about: Burmese letters and marks, the Zawgyi and Win
// glyphs, the other languages of the Myanmar blocks, digits, spaces, zero-width characters and the
// punctuation the break rules read. Every public call form runs it with the unit repeated k and 2k times. In
// linear time the second takes about twice as long; a quadratic path takes four times as long. 2.10.0's
// quadratic normalize (ka, then e repeated) got past test/performance.test.js because that file only tries
// the shapes someone thought of; scripts/check-redos.mjs checks the regexes one by one.
//
// Timings are noisy, so each size runs REPS times interleaved and the medians count, sizes grow until a call
// takes MIN_MS, and a ratio above LIMIT is measured again at twice the size: a case fails only when the ratio is
// above LIMIT at two sizes (or on all ATTEMPTS at the largest size). A burst of load on the machine spoils one
// measurement, seldom two at different sizes, while super-linear code reads high at every size. The file runs on
// its own, after the other test files (package.json `test`), so the fuzz, matrix and property tests do not
// compete with it for the CPU.
// fast-check shrinks a failing case and prints its seed; KNAYI_GROWTH_SEED replays it and KNAYI_GROWTH_RUNS
// sets the number of random cases per call form (a nightly job can run many more).
//
// NFC: normalize and conversion to Unicode end with NFC, and String.prototype.normalize puts a run of
// non-starters (marks of a combining class above 0) in order with an insertion sort, in quadratic time, in Node and
// in Bun: ka followed by 16,000 pairs of dot below and virama took about 250 ms in Node 26 and 700 ms in Bun 1.4.
// The library runs NFC through library/nfc.js, which puts a long run in order first, in linear time. The tests
// under 'runs of marks that NFC reorders' check that on such runs in Myanmar and in other scripts, through every
// call form that runs NFC.

const LIMIT = 2.6; // t(2n) / t(n): about 2 in linear time, 4 in quadratic time (growth exponent 1.38)
const ATTEMPTS = 3;
const REPS = 5;
const START_CHARS = 2048;
// Past about 64k characters, memory effects alone push the ratio of even trivially linear calls to 2.5-3.5,
// while a quadratic path is already obvious at a few thousand.
const MAX_CHARS = 1 << 15;
const MIN_MS = 4; // a median below this is mostly timer and GC noise, so the input grows
const SLOW_MS = 2000; // one call this slow fails at once
const RUNS = Number(process.env.KNAYI_GROWTH_RUNS) || 10;
const SEED = Number(process.env.KNAYI_GROWTH_SEED) || 20261003;

knayi.setGlobalOptions({ silent_mode: true });

// Characters by role (scripts/testing/growth-alphabets.js): letters start a syllable; marks join the one before.
const {
  LETTERS, BURMESE_MARKS, MEDIALS, OTHER_MARKS, WIN_MARKS, BLANKS, PUNCTUATION, ALL
} = require('../scripts/testing/growth-alphabets');

function weighted(groups) {
  return fc.oneof(...groups.map(([weight, list]) => ({ weight, arbitrary: fc.constantFrom(...list) })));
}

const letter = fc.constantFrom(...LETTERS);
const mark = weighted([[5, BURMESE_MARKS], [3, MEDIALS], [2, OTHER_MARKS], [1, WIN_MARKS], [1, BLANKS]]);
const any = weighted([[3, LETTERS], [4, BURMESE_MARKS], [2, MEDIALS], [2, OTHER_MARKS], [1, WIN_MARKS],
  [2, BLANKS], [1, PUNCTUATION]]);

function text(arbitrary, minLength, maxLength) {
  return fc.array(arbitrary, { minLength, maxLength }).map((list) => list.join(''));
}

// Three kinds of case: marks piling up on one letter (how 2.10.0's normalize went quadratic), whole syllables
// repeated, and anything at all.
const shapes = fc.oneof(
  {
    weight: 3,
    arbitrary: fc.record({
      prefix: fc.tuple(text(any, 0, 2), letter).map((parts) => parts.join('')),
      pump: text(mark, 1, 3),
      suffix: text(any, 0, 2)
    })
  },
  {
    weight: 1,
    arbitrary: fc.record({
      prefix: text(any, 0, 2),
      pump: fc.tuple(text(mark, 0, 1), letter, text(mark, 0, 3)).map((parts) => parts.join('')),
      suffix: text(any, 0, 2)
    })
  },
  {
    weight: 2,
    arbitrary: fc.record({ prefix: text(any, 0, 3), pump: text(any, 1, 4), suffix: text(any, 0, 3) })
  }
);

function shape(prefix, pump) {
  return { prefix: String.fromCharCode.apply(null, prefix), pump: String.fromCharCode.apply(null, pump), suffix: '' };
}

// Inputs that took super-linear time in a release run before the random cases: 2.10.0's normalize and its NFC
// (in every conversion to Unicode too), and 2.9.0's Unicode to Zawgyi conversion.
const EXAMPLES = [
  shape([0x1000], [0x1031]), // ka, then e
  shape([0x1000], [0x103C]), // ka, then medial ra
  shape([0x1000], [0x200B, 0x102C]), // ka, then zero-width space and aa
  shape([0x1000], [0x1037, 0x1039]), // ka, then dot below and virama (NFC)
  shape([], [0x1037, 0x1039]), // Zawgyi dot below and virama (NFC)
  shape([], [0x1039, 0x68]), // Win virama and h (NFC)
  shape([0x1000, 0x1060], [0x102C, 0x102D]), // ka with a stacked ka, then aa and i
  shape([0x1064], [0x102C, 0x102D]) // kinzi, then aa and i
].map((example) => [example]);

// Every public call form. `nfc` marks the ones whose output goes through NFC (library/nfc.js).
const FORMS = [
  { name: 'normalize', nfc: true, pumps: true, run: (s) => knayi.normalize(s) },
  { name: 'fontConvert zawgyi to unicode', nfc: true, pumps: true, run: (s) => knayi.fontConvert(s, 'unicode', 'zawgyi') },
  { name: 'fontConvert win to unicode', nfc: true, pumps: true, run: (s) => knayi.fontConvert(s, 'unicode', 'win') },
  { name: 'fontConvert detected to unicode', nfc: true, pumps: true, run: (s) => knayi.fontConvert(s, 'unicode') },
  { name: 'fontConvert unicode to zawgyi', run: (s) => knayi.fontConvert(s, 'zawgyi', 'unicode') },
  { name: 'fontConvert detected to zawgyi', run: (s) => knayi.fontConvert(s, 'zawgyi') },
  {
    name: 'fontConvert.debugging zawgyi to unicode',
    nfc: true,
    run: (s) => knayi.fontConvert.debugging(s, 'unicode', 'zawgyi')
  },
  {
    name: 'fontConvert.debugging win to unicode',
    nfc: true,
    run: (s) => knayi.fontConvert.debugging(s, 'unicode', 'win')
  },
  { name: 'fontConvert.debugging unicode to zawgyi', run: (s) => knayi.fontConvert.debugging(s, 'zawgyi', 'unicode') },
  { name: 'fontDetect', run: (s) => knayi.fontDetect(s) },
  { name: 'fontDetect with a unicode fallback', run: (s) => knayi.fontDetect(s, 'unicode') },
  { name: 'syllBreak unicode', run: (s) => knayi.syllBreak(s, 'unicode', '|') },
  { name: 'syllBreak zawgyi', run: (s) => knayi.syllBreak(s, 'zawgyi', '|') },
  { name: 'syllBreak detected', run: (s) => knayi.syllBreak(s) },
  { name: 'spellingFix unicode', run: (s) => knayi.spellingFix(s, 'unicode') },
  { name: 'spellingFix zawgyi', run: (s) => knayi.spellingFix(s, 'zawgyi') },
  { name: 'spellingFix detected', run: (s) => knayi.spellingFix(s) },
  { name: 'truncate detected', run: (s) => knayi.truncate(s) },
  { name: 'truncate unicode at 120', run: (s) => knayi.truncate(s, { length: 120, fontType: 'unicode' }) },
  { name: 'truncate zawgyi at 10', run: (s) => knayi.truncate(s, { length: 10, omission: '', fontType: 'zawgyi' }) }
];

function time(fn, input) {
  const start = process.hrtime.bigint();
  fn(input);
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
}

// How the call's time grows from k to 2k units: { ok, chars, ratios, ms }. After a ratio above LIMIT the next
// measurement is at twice the size, until 4k units would pass MAX_CHARS.
function growth(fn, shape) {
  const make = (k) => shape.prefix + shape.pump.repeat(k) + shape.suffix;
  let k = Math.ceil(START_CHARS / shape.pump.length);
  const ratios = [];
  const highAt = new Set();
  for (;;) {
    const small = make(k);
    const big = make(2 * k);
    fn(small);
    fn(big);
    const a = [];
    const b = [];
    for (let r = 0; r < REPS; r++) {
      a.push(time(fn, small));
      b.push(time(fn, big));
    }
    const ms = [median(a), median(b)];
    if (ms[1] > SLOW_MS) return { ok: false, chars: big.length, ratios, ms };
    if (ms[1] < MIN_MS) {
      if (big.length * 2 > MAX_CHARS) return { ok: true, chars: big.length, ratios, ms }; // too fast to matter
      k *= 2;
      continue;
    }
    ratios.push(ms[1] / ms[0]);
    if (ratios[ratios.length - 1] <= LIMIT) return { ok: true, chars: big.length, ratios, ms };
    highAt.add(big.length);
    if (highAt.size >= 2 || ratios.length >= ATTEMPTS) return { ok: false, chars: big.length, ratios, ms };
    if (make(4 * k).length <= MAX_CHARS) k *= 2;
  }
}

function codePoints(input) {
  return Array.from(input, (ch) => 'U+' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
}

function describeCase(shape, result) {
  return 'prefix [' + codePoints(shape.prefix) + '], unit [' + codePoints(shape.pump) + '], suffix [' +
    codePoints(shape.suffix) + '] at ' + result.chars + ' characters: t(2n)/t(n) ' +
    result.ratios.map((r) => r.toFixed(2)).join(', ') + ' (limit ' + LIMIT + '), ' +
    result.ms.map((ms) => ms.toFixed(1)).join(' ms and ') + ' ms';
}

describe('time grows linearly on structured random input', () => {
  FORMS.forEach((form, index) => {
    it(form.name, () => {
      fc.assert(fc.property(shapes, (shape) => {
        const result = growth(form.run, shape);
        assert.ok(result.ok, form.name + ' grows faster than linear: ' + describeCase(shape, result));
      }), { seed: SEED + index, numRuns: RUNS, examples: EXAMPLES });
    });
  });
});

// Every character of the alphabets repeated alone, and after ka, through the call forms whose readers walk runs of
// marks: normalize and conversion to Unicode (`pumps` in FORMS). The random cases rarely draw a unit of one
// character: a loop that rescanned the current run of anusvara for each anusvara took 8 s at 100k characters and
// passed them at the pull request setting. Each pump is timed first at 4,096 and 8,192 characters, the faster of
// two calls each; one that grows faster than LIMIT gets the full measurement of growth().
const KA = String.fromCharCode(0x1000);
const PUMPS = ALL.map((ch) => ({ prefix: '', pump: ch, suffix: '' }))
  .concat(ALL.map((ch) => ({ prefix: KA, pump: ch, suffix: '' })));

function quickRatio(fn, shape) {
  const small = shape.prefix + shape.pump.repeat(4096);
  const big = shape.prefix + shape.pump.repeat(8192);
  fn(small);
  fn(big);
  const a = Math.min(time(fn, small), time(fn, small));
  const b = Math.min(time(fn, big), time(fn, big));
  return b / Math.max(a, 0.001);
}

describe('time grows linearly on a run of one character', () => {
  for (const form of FORMS.filter((f) => f.pumps)) {
    it(form.name, (t) => {
      let measured = 0;
      for (const pump of PUMPS) {
        if (quickRatio(form.run, pump) <= LIMIT) continue;
        measured++;
        const result = growth(form.run, pump);
        assert.ok(result.ok, form.name + ' grows faster than linear: ' + describeCase(pump, result));
      }
      t.diagnostic(PUMPS.length + ' pumps, ' + measured + ' measured in full after a high first reading');
    });
  }
});

// Runs of marks of two combining classes, which NFC has to put in order, in Myanmar and in other scripts (the
// unit is UTF-16 code units, so an astral mark is a surrogate pair). library/nfc.js puts them in order before
// String.prototype.normalize sees them; before it did, the first three (in EXAMPLES too) took quadratic time.
const NFC_RUNS = [
  ['ka, then dot below and virama', shape([0x1000], [0x1037, 0x1039])],
  ['Zawgyi dot below and virama', shape([], [0x1037, 0x1039])],
  ['Win virama and h', shape([], [0x1039, 0x68])],
  ['ka, then asat and dot below', shape([0x1000], [0x103A, 0x1037])],
  ['Latin a, then acute and dot below', shape([0x61], [0x301, 0x323])],
  ['Greek alpha, then ypogegrammeni and dialytika tonos', shape([0x3B1], [0x345, 0x344])],
  ['Hebrew bet, then dagesh and qamats', shape([0x5D1], [0x5BC, 0x5B8])],
  ['Arabic beh, then shadda and fatha', shape([0x628], [0x651, 0x64E])],
  ['Tibetan ka, then U+0F73 and U+0F39', shape([0xF40], [0xF73, 0xF39])],
  ['x, then the musical augmentation dot and stem (U+1D16D, U+1D165)', shape([0x78], [0xD834, 0xDD6D, 0xD834, 0xDD65])]
];

describe('time grows linearly on runs of marks that NFC reorders', () => {
  for (const form of FORMS.filter((f) => f.nfc)) {
    it(form.name, () => {
      for (const [name, run] of NFC_RUNS) {
        const result = growth(form.run, run);
        assert.ok(result.ok, form.name + ' on ' + name + ' grows faster than linear: ' + describeCase(run, result));
      }
    });
  }
});
