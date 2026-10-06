const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const knayi = require('../main');

// Super-linear time on structured random input. Each case is a prefix, a short unit repeated many times and a
// suffix, drawn from the characters the rules care about: Burmese letters and marks, the Zawgyi and Win
// glyphs, the other languages of the Myanmar blocks, digits, spaces, zero-width characters and the
// punctuation the break rules read. Every public call form runs it with the unit repeated to n and 2n characters.
// In linear time the second takes about twice as long; a quadratic path takes four times as long. 2.10.0's
// quadratic normalize (ka, then e repeated) got past test/performance.test.js because that file only tries
// the shapes someone thought of; scripts/check-redos.mjs checks the regexes one by one.
//
// Timings are noisy, on shared CI runners most of all, so the verdict has two steps (scripts/testing/growth.js,
// which also holds the runner evidence behind the numbers). A cheap screen times the case at two sizes (SCREEN): a
// ratio t(2n)/t(n) at or below SOFT_RATIO passes. A case above it is confirmed over an 8-fold span, from N to 8N
// units, where linear code grows about 8 times and quadratic code about 64 times, and fails only when the exponent
// from N to 8N and that of the top doubling, from 4N to 8N, both stay at 1.5 or more, or when one call passes the
// time cap. A screen reading the confirmation does not
// uphold is reported as a diagnostic ('above the soft bound, not confirmed'), so it stays visible. Every time is
// the fastest of several readings of repeated calls, and each confirming reading lasts at least 20 ms and comes
// after a full garbage collection. The file runs on its own, after the other test files (package.json `test`,
// which runs it with --expose-gc), so the fuzz, matrix and property tests do not compete with it for the CPU.
// fast-check shrinks a failing case and prints its seed; KNAYI_GROWTH_SEED replays it and KNAYI_GROWTH_RUNS
// sets the number of random cases per call form (a nightly job can run many more).
//
// NFC: normalize and conversion to Unicode end with NFC, and String.prototype.normalize puts a run of
// non-starters (marks of a combining class above 0) in order with an insertion sort, in quadratic time, in Node and
// in Bun: ka followed by 16,000 pairs of dot below and virama took about 250 ms in Node 26 and 700 ms in Bun 1.4.
// The library runs NFC through library/nfc.js, which puts a long run in order first, in linear time. The tests
// under 'runs of marks that NFC reorders' check that on such runs in Myanmar and in other scripts, through every
// call form that runs NFC.

const growthCheck = require('../scripts/testing/growth');

// The screen: t(2n) / t(n) from n = 4N to 8N, the top of the confirming span (N is growthCheck.CONFIRM.n: 4,096
// characters under Node, 1,024 under Bun). It is about 2 in linear time and 4 in quadratic time; above SOFT_RATIO
// (growth exponent 1.38) the case is confirmed. The screen sits at the top because a quadratic term weighs most
// there: the weakest one the confirmation fails, which costs 0.35 times the linear time at N (an exponent of 1.5
// from N to 8N), reads 3.2 from 4N to 8N, but only 2.5 from N to 2N, where the screen would pass it. Readings of
// 1 ms keep the screen cheap (scripts/testing/growth.js says why); the confirmation takes three of 20 ms.
const SOFT_RATIO = 2.6;
const SCREEN = { n: 4 * growthCheck.CONFIRM.n, span: 2, soft: Math.log2(SOFT_RATIO) };
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

// How the call's time grows on the shape, by the two steps of scripts/testing/growth.js: { ok, verdict, screen,
// confirm }. ok is false only for a confirmed super-linear verdict.
function growth(fn, shape) {
  const make = (n) => shape.prefix + shape.pump.repeat(Math.ceil(n / shape.pump.length)) + shape.suffix;
  const result = growthCheck.checkGrowth(fn, make, { screen: SCREEN });
  return Object.assign({ ok: result.verdict !== 'super-linear' }, result);
}

function codePoints(input) {
  return Array.from(input, (ch) => 'U+' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
}

function describeCase(shape, result) {
  return 'prefix [' + codePoints(shape.prefix) + '], unit [' + codePoints(shape.pump) + '], suffix [' +
    codePoints(shape.suffix) + ']: ' + growthCheck.describeGrowth(result);
}

// A screen reading above the soft bound that the confirmation did not uphold: reported, never a failure.
function reportUnconfirmed(t, name, shape, result) {
  if (result.verdict === 'unconfirmed') t.diagnostic(name + ' above the soft bound, not confirmed: ' + describeCase(shape, result));
}

describe('time grows linearly on structured random input', () => {
  FORMS.forEach((form, index) => {
    it(form.name, (t) => {
      fc.assert(fc.property(shapes, (shape) => {
        const result = growth(form.run, shape);
        reportUnconfirmed(t, form.name, shape, result);
        assert.ok(result.ok, form.name + ' grows faster than linear: ' + describeCase(shape, result));
      }), { seed: SEED + index, numRuns: RUNS, examples: EXAMPLES });
    });
  });
});

// Every character of the alphabets repeated alone, and after ka, through the call forms whose readers walk runs of
// marks: normalize and conversion to Unicode (`pumps` in FORMS). The random cases rarely draw a unit of one
// character: a loop that rescanned the current run of anusvara for each anusvara took 8 s at 100k characters and
// passed them at the pull request setting. Each pump gets the same two steps as the random cases.
const KA = String.fromCharCode(0x1000);
const PUMPS = ALL.map((ch) => ({ prefix: '', pump: ch, suffix: '' }))
  .concat(ALL.map((ch) => ({ prefix: KA, pump: ch, suffix: '' })));

describe('time grows linearly on a run of one character', () => {
  for (const form of FORMS.filter((f) => f.pumps)) {
    it(form.name, (t) => {
      let confirmed = 0;
      for (const pump of PUMPS) {
        const result = growth(form.run, pump);
        if (result.confirm) confirmed++;
        reportUnconfirmed(t, form.name, pump, result);
        assert.ok(result.ok, form.name + ' grows faster than linear: ' + describeCase(pump, result));
      }
      t.diagnostic(PUMPS.length + ' pumps, ' + confirmed + ' confirmed after a screen reading above the soft bound' +
        (growthCheck.gcAvailable ? '' : '; no garbage collection before readings (run Node with --expose-gc)'));
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
    it(form.name, (t) => {
      for (const [name, run] of NFC_RUNS) {
        const result = growth(form.run, run);
        reportUnconfirmed(t, form.name + ' on ' + name, run, result);
        assert.ok(result.ok, form.name + ' on ' + name + ' grows faster than linear: ' + describeCase(run, result));
      }
    });
  }
});
