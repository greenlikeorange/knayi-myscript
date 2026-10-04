// The L0 files of src/: script/codes.js, version.js and freeze.js, and core/errors.js (docs/next/DESIGN.md §7.2).
//
// Every predicate and class of codes.js is checked against its 2.x definition (§6.2) on all 65,536 UTF-16 units,
// through the frozen copies of scripts/oracle/ (D19). The mark ranks are checked against 2.x rank(), the named
// ranks against the indexes 2.x copied by hand, and each mask literal against the marks it names.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as acorn from 'acorn';
import * as codes from '../../src/script/codes.js';
import { PACKAGE_VERSION, OUTPUT_VERSION } from '../../src/version.js';
import { deepFreeze } from '../../src/freeze.js';
import { ERR, libraryError } from '../../src/core/errors.js';
import { internals, oracle, ranges, ORACLE, srcText } from './helpers.mjs';

const require = createRequire(import.meta.url);

const storageOrder = internals('storageOrder.js', [
  'isMyanmarLetter', 'isUnicodeMark', 'isConsonant', 'isDigit', 'isOtherMyanmar', 'isTypedFirst', 'isSpace',
  'isZeroWidth', 'rank', 'MARK_ORDER', 'LAST_MEDIAL', 'LOWER_RANK', 'AI_ANUSVARA', 'FIRST_VOWEL', 'ASAT', 'VIRAMA',
  'VISARGA', 'AA', 'AA_TALL', 'AA_SHORT', 'ANUSVARA', 'LOWER_VOWELS', 'E_AA', 'I', 'DOT_BELOW', 'MEDIALS',
  'MEDIAL_YA', 'MEDIAL_HA', 'CA', 'JHA', 'U', 'NYA', 'SEVEN', 'RA'
]);
const typingFixes = internals('typingFixes.js', [
  'MARK', 'TONE', 'CONSONANT', 'WORD_CHAR', 'ANY_DIGIT', 'isDigit', 'ZERO', 'SEVEN', 'WA', 'RA', 'VISARGA'
]);
const contentGate = internals('contentGate.js', ['MYANMAR']);

const UNITS = 0x10000;
const char = (code) => String.fromCharCode(code);

// Fails with the units where `ours` and `theirs` disagree, as ranges.
function assertAgreesOnEveryUnit(ours, theirs, what) {
  const differ = [];
  for (let code = 0; code < UNITS; code++) {
    if (Boolean(ours(code)) !== Boolean(theirs(code))) differ.push(code);
  }
  assert.equal(ranges(differ), '', what + ' differs from 2.x on ' + differ.length + ' units');
}

// The 2.x regex class whose body is `body`, written in the oracle file `file` as `[body]` with \u escapes.
function classIn(file, body) {
  const source = fs.readFileSync(path.join(ORACLE, file), 'utf8');
  assert.ok(source.includes('[' + body + ']'), 'scripts/oracle/' + file + ' has no class [' + body + ']');
  const re = new RegExp('^[' + body + ']$');
  return (code) => re.test(char(code));
}

// The 2.x glyph roles, by name: { BASE: 'base', PRE: 'pre', ... } (storageOrder.js:10-16).
function storageOrderRoles() {
  return oracle.storageOrder.ROLES;
}

// A 2.x regex (no g flag) as a predicate on one unit.
const testsUnit = (re) => (code) => re.test(char(code));

// The union of markBit over the marks of a 2.x string such as '\u102B\u102C'.
function maskOf(marks) {
  let mask = 0;
  for (const mark of marks) mask |= codes.markBit(mark.charCodeAt(0));
  return mask;
}

describe('codes.js: Burmese predicates against storageOrder.js', () => {
  it('isBurmeseConsonant is isConsonant', () => {
    assertAgreesOnEveryUnit(codes.isBurmeseConsonant, storageOrder.isConsonant, 'isBurmeseConsonant');
  });

  it('isSyllableBase is isMyanmarLetter', () => {
    assertAgreesOnEveryUnit(codes.isSyllableBase, storageOrder.isMyanmarLetter, 'isSyllableBase');
  });

  it('isBurmeseDigit is isDigit, in storageOrder.js and typingFixes.js', () => {
    assertAgreesOnEveryUnit(codes.isBurmeseDigit, storageOrder.isDigit, 'isBurmeseDigit');
    assertAgreesOnEveryUnit(codes.isBurmeseDigit, (code) => typingFixes.isDigit(char(code)), 'isBurmeseDigit');
  });

  it('isBurmeseMark is isUnicodeMark', () => {
    assertAgreesOnEveryUnit(codes.isBurmeseMark, storageOrder.isUnicodeMark, 'isBurmeseMark');
  });

  it('isPrebaseMark is isTypedFirst', () => {
    assertAgreesOnEveryUnit(codes.isPrebaseMark, storageOrder.isTypedFirst, 'isPrebaseMark');
  });

  it('isOtherScriptLetter is isOtherMyanmar', () => {
    assertAgreesOnEveryUnit(codes.isOtherScriptLetter, storageOrder.isOtherMyanmar, 'isOtherScriptLetter');
  });

  it('isVowelSign is the afterVowel test of arrangeUnicode', () => {
    const source = fs.readFileSync(path.join(ORACLE, 'storageOrder.js'), 'utf8');
    const found = /var afterVowel = (.+);/.exec(source);
    assert.ok(found, 'scripts/oracle/storageOrder.js has no afterVowel test');
    const afterVowel = new Function('previous', 'return ' + found[1] + ';');
    assertAgreesOnEveryUnit(codes.isVowelSign, afterVowel, 'isVowelSign');
  });

  it('isSpaceBeforeMark is isSpace', () => {
    assertAgreesOnEveryUnit(codes.isSpaceBeforeMark, storageOrder.isSpace, 'isSpaceBeforeMark');
  });

  it('isMyanmarBlock and MYANMAR_BLOCK_PATTERN are contentGate.js MYANMAR', () => {
    assertAgreesOnEveryUnit(codes.isMyanmarBlock, testsUnit(contentGate.MYANMAR), 'isMyanmarBlock');
    assertAgreesOnEveryUnit(testsUnit(codes.MYANMAR_BLOCK_PATTERN), testsUnit(contentGate.MYANMAR),
      'MYANMAR_BLOCK_PATTERN');
  });

  it('isMyanmarScript and MYANMAR_SCRIPT_PATTERN are the three blocks isOtherMyanmar reads', () => {
    // isOtherMyanmar's inBlocks: every unit the 2.x reader classifies as Burmese or as another language.
    const inBlocks = (code) => storageOrder.isOtherMyanmar(code) || storageOrder.isMyanmarLetter(code) ||
      storageOrder.isDigit(code) || storageOrder.isUnicodeMark(code) || code === 0x1039 || code === 0x104A ||
      code === 0x104B;
    assertAgreesOnEveryUnit(codes.isMyanmarScript, inBlocks, 'isMyanmarScript');
    assertAgreesOnEveryUnit(testsUnit(codes.MYANMAR_SCRIPT_PATTERN), inBlocks, 'MYANMAR_SCRIPT_PATTERN');
  });
});

describe('codes.js: CLASS and classOf', () => {
  // DESIGN.md §3.1, from the 2.x definitions.
  function class2x(code) {
    if (storageOrder.isConsonant(code)) return codes.CLS.CONSONANT;
    if (storageOrder.isMyanmarLetter(code)) return codes.CLS.LETTER;
    if (storageOrder.isDigit(code)) return codes.CLS.DIGIT;
    if (storageOrder.isTypedFirst(code)) return codes.CLS.PREBASE;
    if (storageOrder.isUnicodeMark(code)) return codes.CLS.MARK;
    if (code === 0x1039) return codes.CLS.VIRAMA;
    if (code === 0x104A || code === 0x104B) return codes.CLS.PUNCTUATION;
    if (storageOrder.isOtherMyanmar(code)) return codes.CLS.OTHER_SCRIPT;
    return codes.CLS.OTHER;
  }

  it('has the classes of the spec', () => {
    assert.deepEqual({ ...codes.CLS }, {
      OTHER: 0, CONSONANT: 1, LETTER: 2, DIGIT: 3, MARK: 4, PREBASE: 5, VIRAMA: 6, PUNCTUATION: 7, OTHER_SCRIPT: 8
    });
  });

  it('classOf gives every unit its 2.x class', () => {
    const differ = [];
    for (let code = 0; code < UNITS; code++) {
      if (codes.classOf(code) !== class2x(code)) differ.push(code);
    }
    assert.equal(ranges(differ), '');
  });

  it('each class is exactly its 2.x set', () => {
    const cls = codes.CLS;
    const only = (value) => (code) => codes.classOf(code) === value;
    assertAgreesOnEveryUnit(only(cls.CONSONANT), storageOrder.isConsonant, 'CONSONANT');
    assertAgreesOnEveryUnit(only(cls.LETTER),
      (code) => storageOrder.isMyanmarLetter(code) && !storageOrder.isConsonant(code), 'LETTER');
    assertAgreesOnEveryUnit(only(cls.DIGIT), storageOrder.isDigit, 'DIGIT');
    assertAgreesOnEveryUnit(only(cls.MARK),
      (code) => storageOrder.isUnicodeMark(code) && !storageOrder.isTypedFirst(code), 'MARK');
    assertAgreesOnEveryUnit(only(cls.PREBASE), storageOrder.isTypedFirst, 'PREBASE');
    assertAgreesOnEveryUnit(only(cls.VIRAMA), (code) => code === 0x1039, 'VIRAMA');
    assertAgreesOnEveryUnit(only(cls.PUNCTUATION), (code) => code === 0x104A || code === 0x104B, 'PUNCTUATION');
    assertAgreesOnEveryUnit(only(cls.OTHER_SCRIPT), storageOrder.isOtherMyanmar, 'OTHER_SCRIPT');
  });

  it('CLASS is the Myanmar block of classOf', () => {
    assert.ok(codes.CLASS instanceof Uint8Array);
    assert.equal(codes.CLASS.length, 160);
    for (let code = 0x1000; code <= 0x109F; code++) assert.equal(codes.CLASS[code - 0x1000], codes.classOf(code));
  });
});

describe('codes.js: zero-width characters', () => {
  it('zeroWidthBit is non-zero exactly where 2.x isZeroWidth holds', () => {
    assertAgreesOnEveryUnit(codes.zeroWidthBit, storageOrder.isZeroWidth, 'zeroWidthBit');
  });

  it('each ZW bit names its character, and ALL is their union', () => {
    const ZW = codes.ZW;
    assert.deepEqual({ ...ZW }, { ZWSP: 1, ZWNJ: 2, ZWJ: 4, WORD_JOINER: 8, BOM: 16, ALL: 31 });
    assert.equal(codes.zeroWidthBit(codes.CP.ZWSP), ZW.ZWSP);
    assert.equal(codes.zeroWidthBit(codes.CP.ZWNJ), ZW.ZWNJ);
    assert.equal(codes.zeroWidthBit(codes.CP.ZWJ), ZW.ZWJ);
    assert.equal(codes.zeroWidthBit(codes.CP.WORD_JOINER), ZW.WORD_JOINER);
    assert.equal(codes.zeroWidthBit(codes.CP.BOM), ZW.BOM);
    assert.equal(ZW.ALL, ZW.ZWSP | ZW.ZWNJ | ZW.ZWJ | ZW.WORD_JOINER | ZW.BOM);
  });
});

describe('codes.js: script-wide classes against typingFixes.js', () => {
  it('has the flags of the spec', () => {
    assert.deepEqual({ ...codes.SCRIPT }, { MARK: 1, TONE: 2, CONSONANT: 4, WORD: 8, DIGIT: 16, BURMESE_DIGIT: 32 });
  });

  it('isScriptMark is MARK', () => {
    assertAgreesOnEveryUnit(codes.isScriptMark, testsUnit(typingFixes.MARK), 'isScriptMark');
  });

  it('isScriptTone is TONE', () => {
    assertAgreesOnEveryUnit(codes.isScriptTone, testsUnit(typingFixes.TONE), 'isScriptTone');
  });

  it('isScriptConsonant is CONSONANT', () => {
    assertAgreesOnEveryUnit(codes.isScriptConsonant, testsUnit(typingFixes.CONSONANT), 'isScriptConsonant');
  });

  it('isScriptWordChar is WORD_CHAR', () => {
    assertAgreesOnEveryUnit(codes.isScriptWordChar, testsUnit(typingFixes.WORD_CHAR), 'isScriptWordChar');
  });

  it('isScriptDigit is ANY_DIGIT', () => {
    assertAgreesOnEveryUnit(codes.isScriptDigit, testsUnit(typingFixes.ANY_DIGIT), 'isScriptDigit');
  });

  it('the BURMESE_DIGIT flag is typingFixes.js isDigit', () => {
    assertAgreesOnEveryUnit((code) => codes.scriptClassOf(code) & codes.SCRIPT.BURMESE_DIGIT,
      (code) => typingFixes.isDigit(char(code)), 'BURMESE_DIGIT');
  });

  it('scriptClassOf is 0 outside the three blocks', () => {
    for (let code = 0; code < UNITS; code++) {
      if (!codes.isMyanmarScript(code)) assert.equal(codes.scriptClassOf(code), 0, 'U+' + code.toString(16));
    }
  });
});

describe('codes.js: Zawgyi classes against syllable.js and the detector signatures', () => {
  it('isZawgyiPrebase is [\\u1031\\u103b\\u107e-\\u1084]', () => {
    const body = '\\u1031\\u103b\\u107e-\\u1084';
    assertAgreesOnEveryUnit(codes.isZawgyiPrebase, classIn('syllable.js', body), 'isZawgyiPrebase');
  });

  it('isZawgyiMedialRa is [\\u103b\\u107e-\\u1084], and the signatures\' (\\u103b|[\\u107e-\\u1084])', () => {
    assertAgreesOnEveryUnit(codes.isZawgyiMedialRa, classIn('syllable.js', '\\u103b\\u107e-\\u1084'),
      'isZawgyiMedialRa');
    const signatures = fs.readFileSync(path.join(ORACLE, 'signatures.js'), 'utf8');
    assert.ok(signatures.includes('(\\u103b|[\\u107e-\\u1084])'));
    const alternation = /^(\u103b|[\u107e-\u1084])$/;
    assertAgreesOnEveryUnit(codes.isZawgyiMedialRa, testsUnit(alternation), 'isZawgyiMedialRa');
  });

  it('isZawgyiKinzi is [\\u1064\\u108b-\\u108d]', () => {
    assertAgreesOnEveryUnit(codes.isZawgyiKinzi, classIn('syllable.js', '\\u1064\\u108b-\\u108d'), 'isZawgyiKinzi');
  });
});

describe('codes.js: mark order against storageOrder.js', () => {
  it('MARK_GROUPS is MARK_ORDER', () => {
    const groups = storageOrder.MARK_ORDER.map((group) => [...group].map((mark) => mark.charCodeAt(0)));
    assert.deepEqual(codes.MARK_GROUPS, groups);
  });

  it('markRank is rank() on every unit', () => {
    const differ = [];
    for (let code = 0; code < UNITS; code++) {
      if (codes.markRank(code) !== storageOrder.rank(char(code))) differ.push(code);
    }
    assert.equal(ranges(differ), '');
  });

  it('MARK_RANK holds the ranks of U+102B-U+103E', () => {
    assert.ok(codes.MARK_RANK instanceof Int8Array);
    assert.equal(codes.MARK_RANK.length, 20);
    for (let code = 0x102B; code <= 0x103E; code++) {
      assert.equal(codes.MARK_RANK[code - 0x102B], storageOrder.rank(char(code)));
    }
  });

  it('the named ranks are 3, 4, 5, 6, 8 and 12, as 2.x copied them', () => {
    assert.equal(codes.RANK_LAST_MEDIAL, 3);
    assert.equal(codes.RANK_LAST_MEDIAL, storageOrder.LAST_MEDIAL);
    assert.equal(codes.RANK_E, 4);
    assert.equal(codes.RANK_E, storageOrder.rank('\u1031'));
    assert.equal(codes.RANK_FIRST_VOWEL, 5);
    assert.equal(codes.RANK_FIRST_VOWEL, storageOrder.FIRST_VOWEL);
    assert.equal(codes.RANK_LOWER_VOWEL, 6);
    assert.equal(codes.RANK_LOWER_VOWEL, storageOrder.LOWER_RANK);
    assert.equal(codes.RANK_AI_ANUSVARA, 8);
    assert.equal(codes.RANK_AI_ANUSVARA, storageOrder.AI_ANUSVARA);
    assert.equal(codes.RANK_UNRANKED, 12);
    assert.equal(codes.RANK_UNRANKED, storageOrder.MARK_ORDER.length);
    assert.equal(codes.RANK_UNRANKED, codes.MARK_GROUPS.length);
  });

  it('markBit gives each mark of U+102B-U+103E its own bit of 20', () => {
    let all = 0;
    for (let code = 0x102B; code <= 0x103E; code++) {
      const bit = codes.markBit(code);
      assert.equal(bit, 1 << (code - 0x102B));
      assert.equal(all & bit, 0);
      all |= bit;
    }
    assert.equal(all, 0xFFFFF);
  });
});

describe('codes.js: mark masks', () => {
  // Each mask with the union of markBit over its marks, from the 2.x set where 2.x had one (storageOrder.js:41-52).
  const MASKS = {
    MASK_ANY_AA: () => maskOf(storageOrder.AA),
    MASK_UPPER_VOWELS: () => maskOf(storageOrder.I),
    MASK_LOWER_VOWELS: () => maskOf(storageOrder.LOWER_VOWELS),
    MASK_E_OR_AA: () => maskOf(storageOrder.E_AA),
    MASK_MEDIALS: () => maskOf(storageOrder.MEDIALS),
    // 2.x hasVowel (storageOrder.js:376-383): a mark ranked FIRST_VOWEL or later that is not the asat.
    MASK_VOWEL_OR_FINAL: () => {
      let mask = 0;
      for (let code = 0x102B; code <= 0x103E; code++) {
        const mark = char(code);
        if (storageOrder.rank(mark) >= storageOrder.FIRST_VOWEL && mark !== storageOrder.ASAT) {
          mask |= codes.markBit(code);
        }
      }
      return mask;
    },
    MASK_ASAT: () => maskOf(storageOrder.ASAT),
    MASK_DOT_BELOW: () => maskOf(storageOrder.DOT_BELOW),
    MASK_VISARGA: () => maskOf(storageOrder.VISARGA),
    MASK_MEDIAL_YA: () => maskOf(storageOrder.MEDIAL_YA),
    MASK_MEDIAL_HA: () => maskOf(storageOrder.MEDIAL_HA),
    // The marks of MARK_GROUPS 4 to 9, RANK_E to dot below (writesAsTyped, engine/syllable.js).
    MASK_E_TO_DOT_BELOW: () => {
      let mask = 0;
      for (let code = 0x102B; code <= 0x103E; code++) {
        const rank = codes.markRank(code);
        if (rank >= codes.RANK_E && rank <= codes.markRank(0x1037)) mask |= codes.markBit(code);
      }
      return mask;
    }
  };

  for (const [name, union] of Object.entries(MASKS)) {
    it(name + ' is the union of its marks', () => {
      assert.equal(codes[name], union(), name + ' = 0x' + codes[name].toString(16) + ', union 0x' +
        union().toString(16));
    });
  }

  it('every mask is a number literal with a comment (DESIGN.md §2.4 rule 6)', () => {
    const source = srcText('script/codes.js');
    const comments = [];
    const ast = acorn.parse(source, { ecmaVersion: 2015, sourceType: 'module', locations: true, onComment: comments });
    const masks = [];
    for (const node of ast.body) {
      const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : null;
      if (!declaration || declaration.type !== 'VariableDeclaration') continue;
      for (const variable of declaration.declarations) {
        if (!variable.id.name.startsWith('MASK_')) continue;
        masks.push(variable.id.name);
        assert.equal(variable.init.type, 'Literal', variable.id.name + ' is not a literal');
        assert.equal(typeof variable.init.value, 'number', variable.id.name + ' is not a number');
        const line = node.loc.start.line;
        assert.ok(comments.some((c) => c.loc.start.line === line || c.loc.end.line === line - 1),
          variable.id.name + ' has no comment naming its marks');
      }
    }
    assert.deepEqual(masks.sort(), Object.keys(MASKS).sort());
  });
});

describe('codes.js: code points, kinzi and roles', () => {
  it('CP holds the code points of the spec', () => {
    assert.deepEqual({ ...codes.CP }, {
      KA: 0x1000, NGA: 0x1004, CA: 0x1005, JHA: 0x1008, NYA: 0x1009, RA: 0x101B, WA: 0x101D,
      LETTER_U: 0x1025, LETTER_UU: 0x1026, LETTER_O: 0x1029, LETTER_AU: 0x102A,
      TALL_AA: 0x102B, AA: 0x102C, I: 0x102D, II: 0x102E, U: 0x102F, UU: 0x1030, E: 0x1031, AI: 0x1032,
      ANUSVARA: 0x1036, DOT_BELOW: 0x1037, VISARGA: 0x1038, VIRAMA: 0x1039, ASAT: 0x103A,
      MEDIAL_YA: 0x103B, MEDIAL_RA: 0x103C, MEDIAL_WA: 0x103D, MEDIAL_HA: 0x103E, GREAT_SA: 0x103F,
      DIGIT_ZERO: 0x1040, DIGIT_FOUR: 0x1044, DIGIT_SEVEN: 0x1047, LITTLE_SECTION: 0x104A, SECTION: 0x104B,
      LAGAUNG: 0x104E, SPACE: 0x20, NBSP: 0xA0, ZWSP: 0x200B, ZWNJ: 0x200C, ZWJ: 0x200D, WORD_JOINER: 0x2060,
      BOM: 0xFEFF
    });
  });

  it('CP agrees with the constants of storageOrder.js and typingFixes.js', () => {
    const CP = codes.CP;
    const pairs = [
      [CP.TALL_AA, storageOrder.AA_TALL], [CP.AA, storageOrder.AA_SHORT], [CP.ANUSVARA, storageOrder.ANUSVARA],
      [CP.DOT_BELOW, storageOrder.DOT_BELOW], [CP.VISARGA, storageOrder.VISARGA], [CP.VIRAMA, storageOrder.VIRAMA],
      [CP.ASAT, storageOrder.ASAT], [CP.MEDIAL_YA, storageOrder.MEDIAL_YA], [CP.MEDIAL_HA, storageOrder.MEDIAL_HA],
      [CP.CA, storageOrder.CA], [CP.JHA, storageOrder.JHA], [CP.LETTER_U, storageOrder.U], [CP.NYA, storageOrder.NYA],
      [CP.DIGIT_SEVEN, storageOrder.SEVEN], [CP.RA, storageOrder.RA], [CP.DIGIT_ZERO, typingFixes.ZERO],
      [CP.DIGIT_SEVEN, typingFixes.SEVEN], [CP.WA, typingFixes.WA], [CP.RA, typingFixes.RA],
      [CP.VISARGA, typingFixes.VISARGA]
    ];
    for (const [code, text] of pairs) assert.equal(char(code), text);
  });

  it('KINZI_TEXT is the kinzi of zawgyi.js, win.js and syllable.js', () => {
    assert.equal(codes.KINZI_TEXT, '\u1004\u103A\u1039');
    assert.equal(codes.KINZI_TEXT, internals('zawgyi.js', ['KINZI_TEXT']).KINZI_TEXT);
    assert.equal(codes.KINZI_TEXT, internals('win.js', ['KINZI_TEXT']).KINZI_TEXT);
    assert.equal(codes.KINZI_TEXT, internals('syllable.js', ['KINZI']).KINZI);
  });

  it('ROLE numbers the six 2.x roles, with PRE and TEXT renamed', () => {
    assert.deepEqual({ ...codes.ROLE }, { BASE: 1, BEFORE_BASE: 2, MARK: 3, STACK: 4, KINZI: 5, PLAIN: 6 });
    const RENAMED = { PRE: 'BEFORE_BASE', TEXT: 'PLAIN' }; // DESIGN.md Appendix A
    const names2x = Object.keys(storageOrderRoles()).map((name) => RENAMED[name] || name);
    assert.deepEqual(names2x.sort(), Object.keys(codes.ROLE).sort());
  });
});

describe('codes.js: isNfcSafe', () => {
  const SAFE_RANGES = [[0x0, 0x2FF], [0x2002, 0x206F], [0xA9E0, 0xA9FF], [0xAA60, 0xAA7F], [0xFEFF, 0xFEFF]];

  it('is the 943 units of the five ranges', () => {
    const inRanges = (code) => SAFE_RANGES.some(([first, last]) => code >= first && code <= last);
    assertAgreesOnEveryUnit(codes.isNfcSafe, inRanges, 'isNfcSafe');
    let count = 0;
    for (let code = 0; code < UNITS; code++) if (codes.isNfcSafe(code)) count++;
    assert.equal(count, 943);
  });

  // The nfc-safe check (DESIGN.md §3.10), on this runtime's NFC data. A safe unit X has combining class 0
  // (U+0301 X U+0334 is left alone), is NFC-stable alone, and composes with no unit of U+1000-U+109F on either
  // side, so NFC cannot move or compose it next to the text the engine writes.
  it('passes the nfc-safe check on this runtime', () => {
    const unsafe = [];
    for (let code = 0; code < UNITS; code++) {
      if (!codes.isNfcSafe(code)) continue;
      const x = char(code);
      const probes = [x, '\u0301' + x + '\u0334'];
      for (let m = 0x1000; m <= 0x109F; m++) probes.push(char(m) + x, x + char(m));
      if (probes.some((probe) => probe.normalize('NFC') !== probe)) unsafe.push(code);
    }
    assert.equal(ranges(unsafe), '', 'NFC moves or composes these units next to Myanmar text');
  });
});

describe('codes.js: mayChangeUnderNfc (DESIGN.md §3.10, gate 4)', () => {
  it('outside U+1000-U+109F, is every unit at or above U+0300 that isNfcSafe leaves out', () => {
    for (let code = 0; code < UNITS; code++) {
      if (codes.isMyanmarBlock(code)) continue;
      assert.equal(codes.mayChangeUnderNfc(code), code >= 0x300 && !codes.isNfcSafe(code), code.toString(16));
    }
  });

  // On this runtime's NFC data: a unit of the block that NFC changes alone, next to any unit of the block, or next
  // to a non-starter, is one of the five, and each of the five is changed so. U+102E is changed only after U+1025,
  // which is one of them.
  it('in U+1000-U+109F, is the units NFC moves or composes, on this runtime', () => {
    const changed = new Set();
    const probes = (x) => [x, x + '\u0301', '\u0301' + x, x + '\u0334', '\u0334' + x];
    for (let a = 0x1000; a <= 0x109F; a++) {
      if (probes(char(a)).some((p) => p.normalize('NFC') !== p)) changed.add(a);
      for (let b = 0x1000; b <= 0x109F; b++) {
        const pair = char(a) + char(b);
        if (pair.normalize('NFC') !== pair) changed.add(a).add(b);
      }
    }
    changed.delete(0x102E);
    const listed = [];
    for (let code = 0x1000; code <= 0x109F; code++) if (codes.mayChangeUnderNfc(code)) listed.push(code);
    assert.deepEqual([...changed].sort((x, y) => x - y), listed);
    assert.deepEqual(listed, [0x1025, 0x1037, 0x1039, 0x103A, 0x108D]);
  });
});

describe('codes.js: unit sets (DESIGN.md §3.10, gate 3)', () => {
  it('hold one bit for each unit of U+1000-U+109F, and leave every other unit out', () => {
    assert.equal(codes.UNIT_SET_WORDS, 5);
    const all = new Int32Array(codes.UNIT_SET_WORDS);
    for (let code = 0; code < 0x10000; code++) codes.addBlockUnit(all, code);
    assert.deepEqual(Array.from(all), [-1, -1, -1, -1, -1], 'the 160 units fill the five words');
    for (let code = 0x1000; code <= 0x109F; code++) {
      const one = new Int32Array(codes.UNIT_SET_WORDS);
      codes.addBlockUnit(one, code);
      const k = code - 0x1000;
      assert.equal(one[k >> 5], 1 << (k & 31), code.toString(16));
      assert.equal(one.reduce((n, word) => n + (word === 0 ? 0 : 1), 0), 1, code.toString(16));
    }
    const none = new Int32Array(codes.UNIT_SET_WORDS);
    for (const code of [0, 0x0FFF, 0x10A0, 0xAA60, 0xFFFF]) codes.addBlockUnit(none, code);
    assert.deepEqual(Array.from(none), [0, 0, 0, 0, 0]);
  });
});

describe('codes.js: the module', () => {
  it('states the Unicode version its tables match', () => {
    assert.match(srcText('script/codes.js'), /^\/\/ The tables match Unicode 15\.1, as library\/ does\./m);
  });

  it('freezes every exported plain object and array, and leaves the typed arrays and patterns usable', () => {
    for (const [name, value] of Object.entries(codes)) {
      if (value instanceof RegExp) {
        assert.equal(value.global, false, name + ' has a g flag');
        assert.equal(value.lastIndex, 0);
      } else if (ArrayBuffer.isView(value)) {
        assert.ok(!Object.isFrozen(value), name);
      } else if (value !== null && typeof value === 'object') {
        assertDeeplyFrozen(value, name);
      }
    }
  });

  it('exports what the spec lists', () => {
    assert.deepEqual(Object.keys(codes).sort(), [
      'CLASS', 'CLS', 'CP', 'KINZI_TEXT', 'MARK_GROUPS', 'MARK_RANK', 'MASK_ANY_AA', 'MASK_ASAT', 'MASK_DOT_BELOW',
      'MASK_E_OR_AA', 'MASK_E_TO_DOT_BELOW', 'MASK_LOWER_VOWELS', 'MASK_MEDIALS', 'MASK_MEDIAL_HA', 'MASK_MEDIAL_YA',
      'MASK_UPPER_VOWELS', 'MASK_VISARGA', 'MASK_VOWEL_OR_FINAL', 'MYANMAR_BLOCK_PATTERN', 'MYANMAR_SCRIPT_PATTERN',
      'RANK_AI_ANUSVARA', 'RANK_E', 'RANK_FIRST_VOWEL', 'RANK_LAST_MEDIAL', 'RANK_LOWER_VOWEL', 'RANK_UNRANKED', 'ROLE',
      'SCRIPT', 'UNIT_SET_WORDS', 'ZW', 'addBlockUnit', 'classOf', 'isBurmeseConsonant', 'isBurmeseDigit',
      'isBurmeseMark', 'isMyanmarBlock', 'isMyanmarScript',
      'isNfcSafe', 'isOtherScriptLetter', 'isPrebaseMark', 'isScriptConsonant', 'isScriptDigit', 'isScriptMark',
      'isScriptTone', 'isScriptWordChar', 'isSpaceBeforeMark', 'isSyllableBase', 'isVowelSign', 'isZawgyiKinzi',
      'isZawgyiMedialRa', 'isZawgyiPrebase', 'markBit', 'markRank', 'mayChangeUnderNfc', 'scriptClassOf', 'zeroWidthBit'
    ].sort());
  });
});

function assertDeeplyFrozen(value, name) {
  if (value === null || typeof value !== 'object' || ArrayBuffer.isView(value) || value instanceof RegExp) return;
  assert.ok(Object.isFrozen(value), name + ' is not frozen');
  for (const key of Object.getOwnPropertyNames(value)) assertDeeplyFrozen(value[key], name + '.' + key);
}

describe('version.js', () => {
  it('PACKAGE_VERSION is package.json "version"', () => {
    assert.equal(PACKAGE_VERSION, require('../../package.json').version);
  });

  it('OUTPUT_VERSION is 3: 2.10.0\'s output, 3.0\'s settled normalize, then the port of 2.11\'s fixes', () => {
    assert.equal(OUTPUT_VERSION, 3);
  });
});

describe('freeze.js: deepFreeze', () => {
  it('freezes plain objects and arrays all the way down, and returns its argument', () => {
    const value = { rows: [{ id: 'a', list: [1, 2] }], nested: { deeper: {} }, bare: Object.create(null) };
    assert.equal(deepFreeze(value), value);
    assertDeeplyFrozen(value, 'value');
    assert.ok(Object.isFrozen(value.bare));
  });

  it('leaves RegExps, typed arrays, functions and class instances as they are', () => {
    class Scratch {
      constructor() {
        this.length = 0;
      }
    }
    const value = { re: /a/g, codes: new Uint16Array(4), run() {}, scratch: new Scratch() };
    deepFreeze(value);
    assert.ok(Object.isFrozen(value));
    assert.ok(!Object.isFrozen(value.re));
    assert.equal('aXa'.replace(value.re, 'b'), 'bXb');
    value.codes[0] = 7;
    assert.equal(value.codes[0], 7);
    assert.ok(!Object.isFrozen(value.run));
    value.scratch.length = 3;
    assert.equal(value.scratch.length, 3);
  });

  it('returns other values unchanged, and ends at a cycle', () => {
    assert.equal(deepFreeze(5), 5);
    assert.equal(deepFreeze('text'), 'text');
    assert.equal(deepFreeze(null), null);
    const cycle = { name: 'knayi' };
    Object.defineProperty(cycle, 'default', { value: cycle, enumerable: false });
    assert.equal(deepFreeze(cycle), cycle);
    assert.ok(Object.isFrozen(cycle));
  });
});

describe('core/errors.js', () => {
  it('ERR holds the six codes of the spec', () => {
    assert.deepEqual({ ...ERR }, {
      INVALID_ARG_TYPE: 'ERR_KNAYI_INVALID_ARG_TYPE',
      INVALID_ARG_VALUE: 'ERR_KNAYI_INVALID_ARG_VALUE',
      LINE_TOO_LONG: 'ERR_KNAYI_LINE_TOO_LONG',
      UNSUPPORTED_RUNTIME: 'ERR_KNAYI_UNSUPPORTED_RUNTIME',
      INVALID_FONT_TABLE: 'ERR_KNAYI_INVALID_FONT_TABLE',
      NOT_BUILT: 'ERR_KNAYI_NOT_BUILT'
    });
    assert.ok(Object.isFrozen(ERR));
  });

  it('libraryError makes an error of the class asked for, with its code as an own enumerable property', () => {
    const error = libraryError(ERR.INVALID_ARG_TYPE, 'knayi.normalize: text must be a string', TypeError);
    assert.ok(error instanceof TypeError);
    assert.equal(error.message, 'knayi.normalize: text must be a string');
    assert.deepEqual(Object.getOwnPropertyDescriptor(error, 'code'),
      { value: 'ERR_KNAYI_INVALID_ARG_TYPE', writable: true, enumerable: true, configurable: true });
    const plain = libraryError(ERR.NOT_BUILT, 'src/rules/detect.js countEvidence is not built yet');
    assert.equal(Object.getPrototypeOf(plain), Error.prototype);
    assert.equal(plain.code, 'ERR_KNAYI_NOT_BUILT');
  });
});
