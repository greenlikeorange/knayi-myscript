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
// takes long enough to measure, and a case fails only when every one of ATTEMPTS measurements is above LIMIT.
// fast-check shrinks a failing case and prints its seed; KNAYI_GROWTH_SEED replays it and KNAYI_GROWTH_RUNS
// sets the number of random cases per call form (a nightly job can run many more).
//
// Known: String.prototype.normalize itself takes quadratic time on a long run of combining marks that NFC has
// to reorder (measured in Node and in Bun), and normalize and conversion to Unicode end with NFC. ka followed
// by 16,000 pairs of dot below and virama takes about 250 ms in Node 26 and 700 ms in Bun 1.4. Where a call
// form that runs NFC grows too fast, the case runs again with NFC replaced by a no-op: if the call is then
// linear, the time is NFC's, and the case is listed as a diagnostic instead of failing. The probes under
// 'known super-linear time' show the problem as TODO tests until the library limits what it passes to NFC.

const LIMIT = 2.6; // t(2n) / t(n): about 2 in linear time, 4 in quadratic time (growth exponent 1.38)
const ATTEMPTS = 3;
const REPS = 5;
const START_CHARS = 2048;
// Past about 64k characters, memory effects alone push the ratio of even trivially linear calls to 2.5-3.5,
// while a quadratic path is already obvious at a few thousand.
const MAX_CHARS = 1 << 15;
const MIN_MS = 1; // a median below this is mostly timer and GC noise, so the input grows
const SLOW_MS = 2000; // one call this slow fails at once
const RUNS = Number(process.env.KNAYI_GROWTH_RUNS) || 10;
const SEED = Number(process.env.KNAYI_GROWTH_SEED) || 20261003;

knayi.setGlobalOptions({ silent_mode: true });

function chars(codes) {
  return codes.map((code) => String.fromCharCode(code));
}

function range(first, last) {
  const codes = [];
  for (let code = first; code <= last; code++) codes.push(code);
  return codes;
}

// Characters by role. A letter starts a syllable; a mark joins the one before it.
const LETTERS = chars([0x1000, 0x1001, 0x1004, 0x1005, 0x1009, 0x100A, 0x1010, 0x1014, 0x1015, 0x1019, 0x101A,
  0x101B, 0x101C, 0x101D, 0x101E, 0x1021, 0x1023, 0x1025, 0x1027, 0x1029, 0x103F, 0x104E,
  0x1040, 0x1041, 0x1044, 0x1047, // digits: zero and seven are typed for wa and ra
  0x106A, 0x106B, 0x108F, 0x1090, 0x1086, // Zawgyi letter shapes
  0x1050, 0x105A, 0x1075, 0xA9E0, 0xAA60, // Mon, Shan, Karen and the other languages
  0x75, 0x63, 0x69, 0x70, 0x65, 0x79, 0x72, 0x77, 0x78, 0x26, 0x76, 0x6F, 0x74, 0x4F]); // Win letter keys
const BURMESE_MARKS = chars(range(0x102B, 0x1032).concat([0x1036, 0x1037, 0x1038, 0x103A, 0x1039]));
const MEDIALS = chars(range(0x103B, 0x103E));
// Zawgyi glyphs, and the marks and tones of the other languages.
const OTHER_MARKS = chars([0x1033, 0x1034, 0x1035, 0x1056, 0x1058, 0x105E, 0x1060, 0x1062, 0x1063, 0x1064,
  0x1067, 0x1071, 0x1072, 0x107E, 0x1080, 0x1082, 0x1084, 0x1085, 0x1087, 0x1088, 0x108A, 0x108B, 0x108D,
  0x1094, 0x1095, 0x1096, 0x109A, 0xA9E5, 0xAA7B]);
const WIN_MARKS = chars([0x61, 0x6A, 0x64, 0x6B, 0x66, 0x73, 0x44, 0x47, 0x48, 0x68, 0x6D, 0x3B, 0x4D, 0xF1]);
const BLANKS = chars([0x20, 0xA0, 0x09, 0x0A, 0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF]);
const PUNCTUATION = chars([0x104A, 0x104B, 0x2E, 0x2C, 0x3A, 0x2B, 0x2D, 0x3E, 0x28, 0x5B, 0x7B, 0x201C, 0x2018,
  0x2014, 0xA1, 0xD3, 0x201A]);

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

// Inputs that took super-linear time in a release run before the random cases: 2.10.0's normalize, and
// 2.9.0's Unicode to Zawgyi conversion.
const EXAMPLES = [
  shape([0x1000], [0x1031]), // ka, then e
  shape([0x1000], [0x103C]), // ka, then medial ra
  shape([0x1000], [0x200B, 0x102C]), // ka, then zero-width space and aa
  shape([0x1000, 0x1060], [0x102C, 0x102D]), // ka with a stacked ka, then aa and i
  shape([0x1064], [0x102C, 0x102D]) // kinzi, then aa and i
].map((example) => [example]);

// Every public call form. `nfc` marks the ones whose output goes through String.prototype.normalize.
const FORMS = [
  { name: 'normalize', nfc: true, run: (s) => knayi.normalize(s) },
  { name: 'fontConvert zawgyi to unicode', nfc: true, run: (s) => knayi.fontConvert(s, 'unicode', 'zawgyi') },
  { name: 'fontConvert win to unicode', nfc: true, run: (s) => knayi.fontConvert(s, 'unicode', 'win') },
  { name: 'fontConvert detected to unicode', nfc: true, run: (s) => knayi.fontConvert(s, 'unicode') },
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

// How the call's time grows from k to 2k units: { ok, chars, ratios, ms }.
function growth(fn, shape) {
  const make = (k) => shape.prefix + shape.pump.repeat(k) + shape.suffix;
  let k = Math.ceil(START_CHARS / shape.pump.length);
  const ratios = [];
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
    if (ratios.length >= ATTEMPTS) return { ok: false, chars: big.length, ratios, ms };
  }
}

// growth with String.prototype.normalize replaced by a no-op.
function growthWithoutNfc(fn, shape) {
  const nfc = String.prototype.normalize;
  String.prototype.normalize = function () {
    return String(this);
  };
  try {
    return growth(fn, shape);
  } finally {
    String.prototype.normalize = nfc;
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
    it(form.name, (t) => {
      fc.assert(fc.property(shapes, (shape) => {
        const result = growth(form.run, shape);
        if (result.ok) return;
        if (form.nfc && growthWithoutNfc(form.run, shape).ok) {
          t.diagnostic('NFC, not the library, grows too fast (known): ' + describeCase(shape, result));
          return;
        }
        assert.fail(form.name + ' grows faster than linear: ' + describeCase(shape, result));
      }), { seed: SEED + index, numRuns: RUNS, examples: EXAMPLES });
    });
  });
});

const NFC_TODO = 'String.prototype.normalize reorders a long run of combining marks in quadratic time, and the ' +
  'library passes such runs to NFC; it needs to limit them first (UAX #15 stream-safe text)';

describe('known super-linear time', () => {
  const dotBelowVirama = shape([0x1000], [0x1037, 0x1039]); // ka, then dot below and virama
  const probes = [
    ['String.prototype.normalize itself', (s) => s.normalize('NFC'), dotBelowVirama],
    ['normalize', (s) => knayi.normalize(s), dotBelowVirama],
    ['fontConvert win to unicode', (s) => knayi.fontConvert(s, 'unicode', 'win'), shape([], [0x1039, 0x68])],
    ['fontConvert zawgyi to unicode', (s) => knayi.fontConvert(s, 'unicode', 'zawgyi'), shape([], [0x1037, 0x1039])]
  ];
  for (const [name, fn, probe] of probes) {
    it(name + ' on ' + codePoints(probe.prefix + probe.pump) + ' repeated', { todo: NFC_TODO }, () => {
      const result = growth(fn, probe);
      assert.ok(result.ok, describeCase(probe, result));
    });
  }
});
