const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fc = require('fast-check');
const { check } = require('../scripts/testing/fuzz-settings');

// library/nfc.js: String.prototype.normalize('NFC') in linear time. nfc(text) must return exactly what the
// runtime's normalize returns, and it reorders long runs of non-starters itself with the combining classes it reads
// from normalize. These tests read the classes again, with other probe marks, for every code point the runtime
// knows, and check the helper against them: its run characters, the order it gives every pair of them, and its
// output on the characters around runs, on long runs in several scripts and on random text. The timings are in
// test/growth.timing.js and test/performance.test.js; scripts/eval/compare.mjs checks the library's output on the
// corpora, unchanged by the helper.

const NFC_FILE = path.join(__dirname, '..', 'library', 'nfc.js');

// A copy of the module with empty caches, so it finds the combining classes in the order a test meets them.
function freshNfc() {
  delete require.cache[NFC_FILE];
  return require(NFC_FILE);
}

const nfc = freshNfc();
const LONGEST = 30; // the longest run, in code units, that nfc leaves to normalize as it is (UAX #15)

function cp() {
  return String.fromCodePoint.apply(null, arguments);
}

function nfd(text) {
  return text.normalize('NFD');
}

function hex(text) {
  return Array.from(text, (ch) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
}

// The test's own probe marks, not the helper's (asat and dot below): U+0334, of class 1, the lowest, and U+0345,
// of class 240, the highest. A code point that does not decompose is a non-starter when canonical ordering moves
// the low one in front of the high one across it.
const LOWEST = cp(0x334);
const HIGHEST = cp(0x345);
function isNonStarter(y) {
  const probe = HIGHEST + y + LOWEST;
  return nfd(probe) !== probe;
}

// Every code point the runtime knows, but the surrogates, by its canonical decomposition: all non-starters (a run
// character), or a starter with non-starters (a mixed character, such as a letter with marks).
const RUN = [];
const MIXED = [];
for (let code = 0; code <= 0x10FFFF; code++) {
  if (code === 0xD800) code = 0xE000;
  const parts = Array.from(nfd(cp(code)));
  const marks = parts.filter(isNonStarter).length;
  if (marks === parts.length) RUN.push(cp(code));
  else if (marks) MIXED.push(cp(code));
}

describe('nfc finds the combining classes of the runtime', () => {
  it('with probe marks that work', (t) => {
    assert.equal(hex(nfd(HIGHEST + LOWEST)), hex(LOWEST + HIGHEST));
    for (const code of [0x301, 0x334, 0x345, 0x1037, 0x1039, 0x103A, 0x108D, 0x344, 0xF73, 0x1D165]) {
      assert.ok(RUN.includes(cp(code)), hex(cp(code)) + ' is a run character');
    }
    for (const code of [0x41, 0x1000, 0x102C, 0x1038, 0x103B, 0x1E09, 0xAC00]) {
      assert.ok(!RUN.includes(cp(code)), hex(cp(code)) + ' is not a run character');
    }
    t.diagnostic(RUN.length + ' run characters, ' + MIXED.length + ' mixed characters');
  });

  // reorder(text, 1) puts every run longer than one code unit in canonical order. A probe mark next to a run
  // character makes such a run; next to anything else it stands alone. The code points go from the top, so the
  // classes are found in another order than in the next test.
  it('for every code point', () => {
    const fresh = freshNfc();
    const isRun = new Set(RUN);
    const wrong = [];
    for (let code = 0x10FFFF; code >= 0; code--) {
      if (code === 0xDFFF) code = 0xD7FF;
      const x = cp(code);
      const after = x + LOWEST;
      const before = HIGHEST + x;
      if (fresh.reorder(after, 1) !== (isRun.has(x) ? nfd(after) : after) ||
        fresh.reorder(before, 1) !== (isRun.has(x) ? nfd(before) : before)) {
        wrong.push(hex(x));
      }
    }
    assert.deepEqual(wrong.slice(0, 20), [], wrong.length + ' code points classified differently');
  });

  // Every ordered pair of run characters, by their place in canonical order: before, after or (same class) as
  // typed. This proves the order the helper derives, whatever order it met the classes in.
  it('and orders every pair of run characters as canonical ordering does', () => {
    const fresh = freshNfc();
    const wrong = [];
    for (const a of RUN) {
      for (const b of RUN) {
        if (fresh.reorder(a + b, 1) !== nfd(a + b)) wrong.push(hex(a) + ', ' + hex(b));
      }
    }
    assert.deepEqual(wrong.slice(0, 20), [], wrong.length + ' of ' + RUN.length * RUN.length + ' pairs out of order');
  });
});

describe('nfc returns what normalize returns', () => {
  // Acute (230) and grave below (220): a run of 40 code units, out of order.
  const LONG_RUN = cp(0x301, 0x316).repeat(20);

  it('next to every character made of a starter and non-starters', () => {
    const wrong = [];
    for (const x of MIXED) {
      for (const text of [x + LONG_RUN, LONG_RUN + x, LONG_RUN + x + LONG_RUN, x + x + LONG_RUN + x]) {
        if (nfc(text) !== text.normalize('NFC') || nfd(nfc.reorder(text, LONGEST)) !== nfd(text)) wrong.push(hex(x));
      }
    }
    assert.deepEqual(wrong.slice(0, 20), []);
  });

  it('on long runs of marks in Myanmar and other scripts', () => {
    const SHAPES = [
      ['ka, then dot below and virama', cp(0x1000), cp(0x1037, 0x1039)],
      ['ka, then asat and dot below', cp(0x1000), cp(0x103A, 0x1037)],
      ['ka, then U+108D and dot below', cp(0x1000), cp(0x108D, 0x1037)],
      ['dot below and virama, no consonant', '', cp(0x1037, 0x1039)],
      ['Latin: a, then acute and dot below', 'a', cp(0x301, 0x323)],
      ['Greek: alpha, then ypogegrammeni and dialytika tonos (U+0344)', cp(0x3B1), cp(0x345, 0x344)],
      ['Hebrew: bet, then dagesh and qamats', cp(0x5D1), cp(0x5BC, 0x5B8)],
      ['Arabic: beh, then shadda and fatha', cp(0x628), cp(0x651, 0x64E)],
      ['Tibetan: ka, then U+0F73 and U+0F39', cp(0xF40), cp(0xF73, 0xF39)],
      ['astral: musical augmentation dot and stem', 'x', cp(0x1D16D, 0x1D165)]
    ];
    for (const [name, base, unit] of SHAPES) {
      const text = base + unit.repeat(1000) + 'z';
      assert.equal(hex(nfc(text)), hex(text.normalize('NFC')), name);
    }
  });

  it('putting a run in order only when it is longer than ' + LONGEST + ' code units', () => {
    const run30 = cp(0x301, 0x316).repeat(15);
    const astral30 = cp(0x1D16D, 0x1D165).repeat(7) + cp(0x1D16D); // 15 code points, 30 code units
    for (const run of [run30, astral30]) {
      for (const text of ['a' + run, run, run + 'a', 'a' + run + 'b' + run]) {
        assert.equal(nfc.reorder(text, LONGEST), text, hex(text));
      }
    }
    for (const run of [run30 + cp(0x316), astral30 + cp(0x1D165)]) {
      for (const text of ['a' + run, run, run + 'a', 'a' + run + 'b' + run]) {
        assert.equal(hex(nfc.reorder(text, LONGEST)), hex(nfd(text)), hex(text));
      }
    }
  });

  it('with lone surrogates, which end a run', () => {
    const run = cp(0x301, 0x316).repeat(20);
    for (const lone of [String.fromCharCode(0xD800), String.fromCharCode(0xDC00), String.fromCharCode(0xDBFF)]) {
      for (const text of [run + lone + run, lone + run, run + lone, lone + lone + run + lone]) {
        assert.equal(hex(nfc.reorder(text, LONGEST)), hex(text.split(lone).map(nfd).join(lone)), hex(text));
        assert.equal(hex(nfc(text)), hex(text.normalize('NFC')), hex(text));
      }
    }
  });

  // Random text over starters, marks of many classes (Myanmar, Latin, Greek, Hebrew, Arabic, Tibetan and astral),
  // characters that decompose into marks or into a letter and marks, and both halves of a surrogate pair alone.
  const ALPHABET = [
    0x61, 0x20, 0x1000, 0x102C, 0x1038, 0x103B, 0x3B1, 0x5D1, 0x628, 0xF40, 0x200B, // starters
    0x300, 0x301, 0x316, 0x323, 0x327, 0x334, 0x345, 0x1037, 0x1039, 0x103A, 0x108D, 0x5B8, 0x5BC, 0x64E, 0x651,
    0xF39, 0xF71, 0xF72, 0x1D165, 0x1D16D, 0x101FD, // non-starters
    0x340, 0x341, 0x343, 0x344, 0xF73, 0xF75, 0xF81, // run characters that decompose
    0xE9, 0x1E09, 0x1FB3, 0x1D15E, 0xF77 // letters with marks
  ].map((code) => cp(code)).concat([String.fromCharCode(0xD800), String.fromCharCode(0xDC00)]);
  const text = fc.array(fc.constantFrom(...ALPHABET), { maxLength: 80 }).map((chars) => chars.join(''));

  it('on random text, at every run length', () => {
    check(fc.property(text, (input) => {
      const want = input.normalize('NFC');
      assert.equal(hex(nfc(input)), hex(want));
      for (const longest of [0, 1, 2, 3, 7]) {
        const ordered = nfc.reorder(input, longest);
        assert.equal(hex(nfd(ordered)), hex(nfd(input)), 'reorder at ' + longest);
        assert.equal(hex(ordered.normalize('NFC')), hex(want), 'reorder at ' + longest);
      }
    }), 20000, [[cp(0x1000) + cp(0x1037, 0x1039).repeat(40)], [cp(0x1D16D) + String.fromCharCode(0xDC00) + cp(0x301)]]);
  });
});
