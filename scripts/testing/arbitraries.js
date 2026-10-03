// fast-check generators for the fuzz and property tests (test/fuzz.test.js, test/properties.test.js): short
// strings over the characters each reader decides on, and structured Burmese text with typing slips.

const fc = require('fast-check');
const win = require('../../library/win').tables;

function chars(from, to) {
  const out = [];
  for (let code = from; code <= to; code++) out.push(String.fromCharCode(code));
  return out;
}

const SPACES = [' ', '\u00A0', '\n', '\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF'];

// Unicode text: letters that take marks (some typed for each other), digits typed for letters, every Burmese
// mark, spaces and zero-width characters, number punctuation, letters and marks of the other languages, and
// a combining mark from outside the blocks for NFC.
const UNICODE = {
  letters: ['\u1000', '\u1001', '\u1004', '\u1005', '\u1006', '\u1009', '\u100A', '\u1010', '\u1011', '\u1012',
    '\u1014', '\u1015', '\u1019', '\u101A', '\u101B', '\u101C', '\u101D', '\u101E', '\u101F', '\u1021', '\u1025',
    '\u1026', '\u1029', '\u103F', '\u104E', '\u104C', '\u1040', '\u1041', '\u1044', '\u1047'],
  marks: chars(0x102B, 0x103E),
  other: SPACES.concat(['.', ',', '+', '-', '\u104A', 'a', '\u0301', '\u1033', '\u1034', '\u1035', '\u1050',
    '\u105E', '\u1062', '\u1063', '\u1075', '\u1082', '\u1086', '\u1087', '\u1089', '\u108F', '\u109A', '\uA9E0',
    '\uA9E5', '\uAA60', '\uAA7B'])
};

// Zawgyi text: Burmese letters and marks, the Zawgyi shapes at U+1060-U+1097, e and the medial ra shapes typed
// first, digits, the lagaung sequences and spaces.
const ZAWGYI = {
  letters: ['\u1000', '\u1001', '\u1004', '\u1005', '\u1009', '\u100A', '\u1010', '\u1014', '\u1015', '\u1019',
    '\u101B', '\u101D', '\u101E', '\u1021', '\u1025', '\u1029', '\u104E', '\u1040', '\u1044', '\u1047',
    '\u106A', '\u106B', '\u108F', '\u1090', '\u1086'],
  marks: chars(0x102B, 0x103F).concat(chars(0x1060, 0x1097)),
  other: SPACES.concat(['.', '\u104A', 'a'])
};

// Win text: every key of the Win table, with more weight on the letters of the look-alike sequences and a few
// common keys, and spaces and other Latin-1 characters.
const WIN = {
  letters: Object.keys(win.WIN),
  marks: ['a', 'M', 'j', 'o', 'm', 'f', 'p', 's', 'O', 'D', 'u', 'r', '0', '7'],
  other: [' ', '\n', '\u00A0', '\u00FF', '#', 'x', '\u200B']
};

function textOver(alphabet, maxLength) {
  const unit = fc.oneof(
    { weight: 3, arbitrary: fc.constantFrom(...alphabet.letters) },
    { weight: 4, arbitrary: fc.constantFrom(...alphabet.marks) },
    { weight: 1, arbitrary: fc.constantFrom(...alphabet.other) }
  );
  return fc.string({ unit: unit, minLength: 1, maxLength: maxLength || 12 });
}

// Any UTF-16 code units, lone surrogates included.
const codeUnits = fc.string({ unit: fc.integer({ min: 0, max: 0xFFFF }).map((c) => String.fromCharCode(c)), maxLength: 16 });

// Structured Burmese: syllables in storage order (kinzi, consonant, stacked consonant, medials, e, vowel,
// anusvara, dot below, final with asat, visarga) and runs of digits, with breaks between them, then typing
// slips: e or medial ra typed before its consonant (and its kinzi), a space before a mark, a mark typed twice,
// two marks swapped. No slip lands inside a kinzi, and digits are kept apart from letters: a broken kinzi and a
// digit next to a mark are known failures (see test/properties.test.js).
const CONSONANTS = chars(0x1000, 0x1021);
const STACKABLE = '\u1000\u1001\u1002\u1003\u1005\u1006\u1007\u1008\u100B\u100C\u100D\u100E\u100F\u1010\u1011\u1012\u1013\u1014\u1015\u1016\u1017\u1018\u1019\u101C'.split('');
const VOWELS = ['', '\u102D', '\u102E', '\u102F', '\u1030', '\u102C', '\u102B', '\u1032', '\u102D\u102F'];

// true in about `percent` of the values; `sometimes` gives the value of arbitrary that often, or null.
const chance = (percent) => fc.integer({ min: 0, max: 99 }).map((n) => n < percent);
const sometimes = (arbitrary, percent) => fc.oneof(
  { weight: 100 - percent, arbitrary: fc.constant(null) },
  { weight: percent, arbitrary: arbitrary }
);

const syllable = fc.record({
  kinzi: chance(10),
  consonant: fc.constantFrom(...CONSONANTS),
  stack: sometimes(fc.constantFrom(...STACKABLE), 10),
  medials: fc.subarray(['\u103B', '\u103D', '\u103E']),
  ra: chance(20),
  e: chance(25),
  vowel: fc.constantFrom(...VOWELS),
  anusvara: chance(15),
  dot: chance(20),
  final: sometimes(fc.constantFrom(...CONSONANTS), 30),
  visarga: chance(20)
}).map((s) => {
  // [character, belongs to a kinzi]
  const out = [];
  if (s.kinzi && s.consonant !== '\u1004') out.push(['\u1004', true], ['\u103A', true], ['\u1039', true]);
  out.push([s.consonant, false]);
  if (s.stack) out.push(['\u1039', false], [s.stack, false]);
  const medials = s.ra ? ['\u103C'].concat(s.medials.filter((m) => m !== '\u103B')) : s.medials;
  medials.sort().forEach((m) => out.push([m, false]));
  if (s.e) out.push(['\u1031', false]);
  s.vowel.split('').forEach((v) => out.push([v, false]));
  if (s.anusvara) out.push(['\u1036', false]);
  // A dot below goes after the final consonant and before its asat (NFC order), as in kaung-dot (because).
  if (s.final) out.push([s.final, false]);
  if (s.dot) out.push(['\u1037', false]);
  if (s.final) out.push(['\u103A', false]);
  if (s.visarga) out.push(['\u1038', false]);
  return out;
});

const digits = fc.array(fc.constantFrom(...chars(0x1040, 0x1049)), { minLength: 1, maxLength: 4 })
  .map((ds) => ds.map((d) => [d, false]).concat([[' ', false]]));

const slip = fc.record({ kind: fc.constantFrom('typed first', 'space', 'twice', 'swap'), at: fc.nat() });

function isMark(ch) {
  return ch >= '\u102B' && ch <= '\u103E';
}

function applySlip(units, s) {
  if (!units.length) return units;
  const i = s.at % units.length;
  const [ch, inKinzi] = units[i];
  if (inKinzi || !isMark(ch)) return units;
  const out = units.slice();
  if (s.kind === 'typed first' && (ch === '\u1031' || ch === '\u103C')) {
    // Back to the consonant it belongs to (not a stacked one), and before its kinzi.
    const stacked = (k) => k > 0 && out[k - 1][0] === '\u1039' && !out[k - 1][1];
    let j = i - 1;
    while (j >= 0 && !(CONSONANTS.includes(out[j][0]) && !out[j][1] && !stacked(j))) j--;
    while (j > 0 && out[j - 1][1]) j--;
    if (j >= 0) out.splice(j, 0, out.splice(i, 1)[0]);
  } else if (s.kind === 'space') {
    out.splice(i, 0, [' ', false]);
  } else if (s.kind === 'twice') {
    out.splice(i, 0, [ch, false]);
  } else if (s.kind === 'swap' && i + 1 < out.length && isMark(out[i + 1][0]) && !out[i + 1][1]) {
    out[i] = out[i + 1];
    out[i + 1] = [ch, false];
  }
  return out;
}

const burmeseText = fc.tuple(
  fc.array(fc.tuple(fc.oneof({ weight: 6, arbitrary: syllable }, { weight: 1, arbitrary: digits }),
    fc.constantFrom('', '', '', ' ', '\u200B', '\n', '\u104B')), { minLength: 1, maxLength: 5 }),
  fc.array(slip, { maxLength: 3 })
).map(([parts, slips]) => {
  let units = [];
  parts.forEach(([part, gap]) => {
    units = units.concat(part);
    if (gap) units.push([gap, false]);
  });
  slips.forEach((s) => { units = applySlip(units, s); });
  return units.map((u) => u[0]).join('');
});

module.exports = {
  unicodeText: (maxLength) => textOver(UNICODE, maxLength),
  zawgyiText: (maxLength) => textOver(ZAWGYI, maxLength),
  winText: (maxLength) => textOver(WIN, maxLength),
  codeUnits: codeUnits,
  burmeseText: burmeseText
};
