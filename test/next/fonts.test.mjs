// The font data and the compiled fonts: src/fonts/zawgyi.js, src/fonts/win.js and compileFont of
// src/engine/fontReader.js (docs/next/DESIGN.md §2.3, §3.8, §7.8). Owner: W6 (engine-fonts).
//
// The tables are checked row by row against the 2.x tables in the frozen copies of scripts/oracle/ (D19), the
// compiled lookup against 2.x font() on all 65,536 UTF-16 units, and each load-time check of compileFont on a
// deliberately broken row, so a bundle that drops the checks (§2.4) loses no coverage.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ROLE, KINZI_TEXT } from '../../src/script/codes.js';
import { ZAWGYI_GLYPHS, LAGAUNG_SEQUENCES, ZAWGYI_FONT } from '../../src/fonts/zawgyi.js';
import { WIN_GLYPHS, LOOK_ALIKE_SEQUENCES, C1_ALIASES, WIN_FONT } from '../../src/fonts/win.js';
import { compileFont } from '../../src/engine/fontReader.js';
import { internals, oracle, hex } from './helpers.mjs';

const zawgyi2x = internals('zawgyi.js', ['ZAWGYI', 'SEQUENCES', 'FONT']);
const win2x = internals('win.js', ['WIN', 'SEQUENCES', 'CP1252', 'FONT']);
const ROLES_2X = oracle.storageOrder.ROLES;

// The 2.x role string of each ROLE.
const ROLE_2X = new Map([[ROLE.BASE, ROLES_2X.BASE], [ROLE.BEFORE_BASE, ROLES_2X.PRE], [ROLE.MARK, ROLES_2X.MARK],
  [ROLE.STACK, ROLES_2X.STACK], [ROLE.KINZI, ROLES_2X.KINZI], [ROLE.PLAIN, ROLES_2X.TEXT]]);

// A row of a new table equals a 2.x row: the role mapped, the text, and the attached marks (2.x leaves a third
// item out where there are none).
function assertSameRow(row, row2x, where) {
  assert.equal(ROLE_2X.get(row[0]), row2x[0], where + ' role');
  assert.equal(row[1], row2x[1], where + ' text');
  assert.equal(row.length, row2x.length, where + ' items');
  if (row.length > 2) assert.equal(row[2], row2x[2], where + ' attached marks');
}

// The sequences equal 2.x [pattern, replacement] pairs: the same literal, flags and replacement, applied once.
function assertSameSequences(rows, pairs) {
  assert.equal(rows.length, pairs.length);
  rows.forEach((row, i) => {
    assert.equal(row.re.source, pairs[i][0].source, row.id + ' source');
    assert.equal(row.re.flags, pairs[i][0].flags, row.id + ' flags');
    assert.equal(row.to, pairs[i][1], row.id + ' replacement');
    assert.equal(row.repeat, false, row.id + ' applies once');
    assert.equal(row.label, undefined, row.id + ' has no label: its 2.x source is re.source');
  });
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, 'ids are unique');
}

// Every plain object and array under value is frozen.
function assertDeepFrozen(value, name) {
  if (value === null || typeof value !== 'object') return;
  const plain = Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype;
  if (!plain) return;
  assert.ok(Object.isFrozen(value), name + ' is frozen');
  for (const key of Object.keys(value)) assertDeepFrozen(value[key], name + '.' + key);
}

describe('src/fonts/zawgyi.js (DESIGN.md §2.3)', () => {
  it('ZAWGYI_GLYPHS has every 2.x row with its role mapped, and the digits are its self bases', () => {
    const table2x = zawgyi2x.ZAWGYI;
    for (const key of Object.keys(ZAWGYI_GLYPHS)) {
      assert.ok(Object.hasOwn(table2x, key), hex(key.charCodeAt(0)) + ' is a 2.x row');
      assertSameRow(ZAWGYI_GLYPHS[key], table2x[key], hex(key.charCodeAt(0)));
    }
    const declared = [];
    for (const [first, last] of ZAWGYI_FONT.selfBases) {
      for (let code = first; code <= last; code++) declared.push(String.fromCharCode(code));
    }
    for (const key of Object.keys(table2x)) {
      if (Object.hasOwn(ZAWGYI_GLYPHS, key)) continue;
      assert.ok(declared.includes(key), hex(key.charCodeAt(0)) + ' is a row or a self base');
      assert.deepEqual(table2x[key], [ROLES_2X.BASE, key], hex(key.charCodeAt(0)) + ' is a base of itself in 2.x');
    }
    assert.equal(Object.keys(ZAWGYI_GLYPHS).length + declared.length, Object.keys(table2x).length);
  });

  it('LAGAUNG_SEQUENCES are the 2.x sequences', () => {
    assertSameSequences(LAGAUNG_SEQUENCES, zawgyi2x.SEQUENCES);
  });

  it('ZAWGYI_FONT declares the table, the sequences, the digits and lagaung as a whole base', () => {
    assert.equal(ZAWGYI_FONT.name, 'zawgyi');
    assert.equal(ZAWGYI_FONT.glyphs, ZAWGYI_GLYPHS);
    assert.equal(ZAWGYI_FONT.sequences, LAGAUNG_SEQUENCES);
    assert.deepEqual(ZAWGYI_FONT.selfBases, [[0x1040, 0x1049]]);
    assert.deepEqual(ZAWGYI_FONT.aliases, {});
    assert.deepEqual(ZAWGYI_FONT.wholeBases, ['\u104E\u1004\u103A\u1038']);
  });
});

describe('src/fonts/win.js (DESIGN.md §2.3)', () => {
  it('WIN_GLYPHS and C1_ALIASES hold every 2.x row with its role mapped', () => {
    const table2x = win2x.WIN;
    for (const key of Object.keys(WIN_GLYPHS)) {
      assert.ok(Object.hasOwn(table2x, key), hex(key.charCodeAt(0)) + ' is a 2.x row');
      assertSameRow(WIN_GLYPHS[key], table2x[key], hex(key.charCodeAt(0)));
    }
    for (const [control, key] of Object.entries(C1_ALIASES)) {
      assert.ok(!Object.hasOwn(WIN_GLYPHS, control), hex(control.charCodeAt(0)) + ' is an alias, not a row');
      assert.equal(table2x[control], table2x[key], hex(control.charCodeAt(0)) + ' shares the row of its key in 2.x');
    }
    const keys = Object.keys(WIN_GLYPHS).concat(Object.keys(C1_ALIASES)).sort();
    assert.deepEqual(keys, Object.keys(table2x).sort());
  });

  it('C1_ALIASES is 2.x CP1252 read the other way, in 2.x order', () => {
    const cp1252 = win2x.CP1252;
    assert.deepEqual(Object.entries(C1_ALIASES), Object.keys(cp1252).map((key) => [cp1252[key], key]));
  });

  it('LOOK_ALIKE_SEQUENCES are the 2.x sequences', () => {
    assertSameSequences(LOOK_ALIKE_SEQUENCES, win2x.SEQUENCES);
  });

  it('WIN_FONT declares the table, the sequences, the aliases and the two whole bases', () => {
    assert.equal(WIN_FONT.name, 'win');
    assert.equal(WIN_FONT.glyphs, WIN_GLYPHS);
    assert.equal(WIN_FONT.sequences, LOOK_ALIKE_SEQUENCES);
    assert.deepEqual(WIN_FONT.selfBases, []);
    assert.equal(WIN_FONT.aliases, C1_ALIASES);
    assert.deepEqual(WIN_FONT.wholeBases, ['\u1000\u103B\u1015\u103A', '\u1009\u102C']);
  });
});

describe('the font data is frozen (DESIGN.md §2.3, §4)', () => {
  it('every exported table, row list and font, all the way down; the RegExps are left with lastIndex 0', () => {
    const exported = { ZAWGYI_GLYPHS, LAGAUNG_SEQUENCES, ZAWGYI_FONT, WIN_GLYPHS, LOOK_ALIKE_SEQUENCES, C1_ALIASES,
      WIN_FONT };
    for (const [name, value] of Object.entries(exported)) assertDeepFrozen(value, name);
    for (const row of LAGAUNG_SEQUENCES.concat(LOOK_ALIKE_SEQUENCES)) assert.equal(row.re.lastIndex, 0, row.id);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// compileFont (DESIGN.md §3.8).

// What a compiled font gives for a code: { role, text, marks, whole } as 2.x strings, or null for no glyph. The
// layout is private to fontReader.js; this reads it as its comment describes.
function compiledGlyph(font, code) {
  const glyph = code < font.index.length ? font.index[code] : 0;
  if (glyph === 0) return null;
  const units = (from, to) => String.fromCharCode(...font.units.subarray(from, to));
  return {
    role: ROLE_2X.get(font.roles[glyph]),
    text: units(font.textStart[glyph], font.textEnd[glyph]),
    marks: units(font.marksStart[glyph], font.end[glyph]),
    whole: units(font.textStart[glyph], font.end[glyph])
  };
}

// The same from 2.x font()'s Map.
function glyph2x(font2x, code) {
  const g = font2x.glyphs.get(code);
  return g === undefined ? null : { role: g.role, text: g.text, marks: g.marks.join(''), whole: g.text + g.extra };
}

// A small valid definition, and the same with some fields replaced.
const VALID = {
  name: 'test', glyphs: { A: [ROLE.BASE, '\u1000'], B: [ROLE.MARK, '\u102C'] }, sequences: [], selfBases: [],
  aliases: {}, wholeBases: []
};
const broken = (fields) => Object.assign({}, VALID, fields);
const withRow = (key, row) => broken({ glyphs: Object.assign({}, VALID.glyphs, { [key]: row }) });

// compileFont throws ERR_KNAYI_INVALID_FONT_TABLE for the definition, with a message naming the file and saying
// what is wrong.
function assertRefused(definition, what) {
  assert.throws(() => compileFont(definition), (error) => {
    assert.ok(error instanceof Error);
    assert.equal(error.code, 'ERR_KNAYI_INVALID_FONT_TABLE');
    assert.ok(error.message.startsWith('knayi fonts/' + definition.name + '.js: '), error.message);
    assert.match(error.message, what);
    return true;
  });
}

describe('compileFont (DESIGN.md §3.8)', () => {
  const fonts = [['zawgyi', ZAWGYI_FONT, zawgyi2x.FONT], ['win', WIN_FONT, win2x.FONT]];
  for (const [name, definition, font2x] of fonts) {
    it(name + ': the compiled lookup agrees with 2.x font() on all 65,536 units: role, text and marks', () => {
      const font = compileFont(definition);
      const differ = [];
      for (let code = 0; code < 0x10000; code++) {
        const ours = compiledGlyph(font, code);
        const theirs = glyph2x(font2x, code);
        if (JSON.stringify(ours) !== JSON.stringify(theirs)) differ.push(hex(code));
      }
      assert.deepEqual(differ, []);
      assert.equal(font.name, name);
      assert.equal(font.sequences, definition.sequences);
    });
  }

  it('the compiled font is frozen; its index runs to the highest code it reads', () => {
    const win = compileFont(WIN_FONT);
    assert.ok(Object.isFrozen(win));
    assert.equal(win.index.length, 0x2039 + 1, 'Win\'s highest key is U+2039');
    assert.equal(compileFont(ZAWGYI_FONT).index.length, 0x1097 + 1, 'Zawgyi\'s highest key is U+1097');
  });

  it('a valid definition compiles; plain text may be any string, the empty string included', () => {
    assert.doesNotThrow(() => compileFont(VALID));
    assert.doesNotThrow(() => compileFont(withRow('C', [ROLE.PLAIN, ''])));
    assert.doesNotThrow(() => compileFont(withRow('C', [ROLE.PLAIN, 'any text \u1000', '\u1039'])));
  });

  it('check 1: every key is one UTF-16 unit', () => {
    assertRefused(withRow('AB', [ROLE.BASE, '\u1001']), /glyph key "AB" must be one UTF-16 unit/);
    assertRefused(withRow('\uD835\uDC00', [ROLE.BASE, '\u1001']), /must be one UTF-16 unit/);
    assertRefused(broken({ aliases: { XY: 'A' } }), /alias key "XY" must be one UTF-16 unit/);
  });

  it('check 1: no key is a space or zero-width character, which readFont holds or writes before any lookup', () => {
    const what = /a space or zero-width character cannot have a glyph/;
    assertRefused(withRow(' ', [ROLE.PLAIN, '-']), /glyph U\+0020: a space or zero-width/);
    for (const code of ['\u00A0', '\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF']) {
      assertRefused(withRow(code, [ROLE.PLAIN, '']), what);
    }
    assertRefused(broken({ aliases: { '\u00A0': 'A' } }), /alias U\+00A0: a space or zero-width/);
  });

  it('check 2: every role is a known ROLE', () => {
    assertRefused(withRow('C', [7, '\u1001']), /glyph U\+0043: unknown role 7/);
    assertRefused(withRow('C', ['base', '\u1001']), /unknown role base/);
  });

  it('check 3: the marks of MARK and BEFORE_BASE rows, and the attached marks of STACK and KINZI rows, are ranked', () => {
    assertRefused(withRow('C', [ROLE.MARK, '\u1033']), /glyph U\+0043: U\+1033 is not a ranked mark/);
    assertRefused(withRow('C', [ROLE.MARK, '\u102C', '\u1039']), /U\+1039 is not a ranked mark/);
    assertRefused(withRow('C', [ROLE.BEFORE_BASE, '\u1031\u1035']), /U\+1035 is not a ranked mark/);
    assertRefused(withRow('C', [ROLE.STACK, '\u1039\u1010', '\u1000']), /U\+1000 is not a ranked mark/);
    assertRefused(withRow('C', [ROLE.KINZI, KINZI_TEXT, 'a']), /U\+0061 is not a ranked mark/);
  });

  it('check 4: a base is one letter or digit, a ligature or a declared whole base, of at most 8 units', () => {
    const what = /a base must be one letter or digit, a ligature, or a declared whole base/;
    assertRefused(withRow('C', [ROLE.BASE, 'A']), what);
    assertRefused(withRow('C', [ROLE.BASE, '\u102C']), what);
    assertRefused(withRow('C', [ROLE.BASE, '\u1000\u1001']), what);
    assertRefused(withRow('C', [ROLE.BASE, '\u1000\u1039\u1025']), what);
    assertRefused(withRow('C', [ROLE.BASE, '']), what);
    const long = '\u1000\u103B\u103C\u103D\u103E\u1031\u102D\u102F\u102C';
    assertRefused(broken({ glyphs: { C: [ROLE.BASE, long] }, wholeBases: [long] }), /a base has at most 8 units/);
    assertRefused(withRow('C', [ROLE.BASE, '\u1000', '\u102C']), /a base has no attached marks/);
    assert.doesNotThrow(() => compileFont(withRow('C', [ROLE.BASE, '\u1000\u1039\u1001'])));
    assert.doesNotThrow(() => compileFont(withRow('C', [ROLE.BASE, '\u1049'])));
    assert.doesNotThrow(() => compileFont(broken({ glyphs: { C: [ROLE.BASE, '\u1000\u102C'] },
      wholeBases: ['\u1000\u102C'] })));
  });

  it('check 4: a stacked consonant is a virama and a Burmese consonant, a kinzi is KINZI_TEXT, texts are strings', () => {
    assertRefused(withRow('C', [ROLE.STACK, '\u1010']), /a stacked consonant is a virama and a Burmese consonant/);
    assertRefused(withRow('C', [ROLE.STACK, '\u1039\u1022']), /a stacked consonant is a virama/);
    assertRefused(withRow('C', [ROLE.STACK, '\u1039\u1010\u1010']), /a stacked consonant is a virama/);
    assertRefused(withRow('C', [ROLE.KINZI, '\u1004\u103A']), /a kinzi is nga, asat and virama/);
    assertRefused(withRow('C', [ROLE.MARK, 1]), /text and marks must be strings/);
    assertRefused(withRow('C', [ROLE.MARK, '\u102C', null]), /text and marks must be strings/);
  });

  it('check 5: every alias names a key of the table, and no alias or self base is also a key', () => {
    assertRefused(broken({ aliases: { C: 'Z' } }), /alias U\+0043: names no key of the table/);
    assertRefused(broken({ aliases: { C: 'toString' } }), /alias U\+0043: names no key of the table/);
    assertRefused(broken({ aliases: { B: 'A' } }), /alias U\+0042: is also a key of the table/);
    assertRefused(broken({ glyphs: { '\u1041': [ROLE.BASE, '\u1041'] }, selfBases: [[0x1040, 0x1049]] }),
      /self base U\+1041: is also a key of the table/);
    assert.doesNotThrow(() => compileFont(broken({ aliases: { C: 'A' } })));
  });

  it('a broken row of a real table is refused at load, naming its file and glyph', () => {
    const glyphs = Object.assign({}, WIN_GLYPHS, { '\u00D3': [ROLE.BASE, '\u1009\u102C\u102C'] });
    assertRefused(Object.assign({}, WIN_FONT, { glyphs }), /^knayi fonts\/win\.js: glyph U\+00D3: a base must be/);
  });
});
