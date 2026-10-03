// src/segment.js and src/spec/breakRules.js (docs/next/DESIGN.md §7.5). Owner: W3 (segment).
//
// The spec rows are checked against 2.x's BREAK_RULES (scripts/oracle/syllable.js), and every row's example
// against both the rows and the scanners. The scanners' character classes are checked on every UTF-16 unit, in the
// positions each class is read at. Then the 2.x quirks the scanners keep (pairs of bare consonants, the S'gaw
// Karen switch, row U1's swap), the 3.0 lossless segmentation and its bare-consonant policies, the repeated-mark
// collapse, and the table probes of test/fixtures/tables.json. segment.fuzz.test.mjs holds the differential fuzz.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  BARE_CONSONANTS, prepareBreakText, forEachBreak, breakParts, breakString, segmentSyllables, syllableBoundaries,
  looksLikeSgawKaren, collapseRepeatedMarks
} from '../../src/segment.js';
import { BREAK_RULES } from '../../src/spec/breakRules.js';
import { tableProbes, fuzz } from './helpers.mjs';
import {
  FONTS, syllable2x, breakPartsByRows, syllBreak2x, spellingFix2x, syllBreakOnCore, spellingFixOnCore, units,
  assertSame
} from './segmentOracle.mjs';

const ch = (code) => String.fromCharCode(code);
const KA = '\u1000';
const KHA = '\u1001';
const AA = '\u102C';

// Breaks of the core and of 2.x for one text, as 'a|b|c'.
const coreBreaks = (text, font) => breakString(text, font, '|');
const breaks2x = (text, font) => syllable2x.joinParts(syllable2x.breakParts(text, font), '|');

describe('spec/breakRules.js: the 2.x break rows, documented', () => {
  const ids = { unicode: ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7'], zawgyi: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7', 'Z8'] };

  for (const font of FONTS) {
    it(font + ': the rows equal 2.x BREAK_RULES, in order: source, flags, replacement and switch', () => {
      const theirs = syllable2x.BREAK_RULES[font];
      const ours = BREAK_RULES[font];
      assert.deepEqual(ours.map((row) => row.id), ids[font]);
      assert.equal(ours.length, theirs.length);
      ours.forEach((row, i) => {
        const [pattern, replacement, offWhen] = theirs[i];
        assert.equal(row.pattern.source, pattern.source, row.id);
        assert.equal(row.pattern.flags, pattern.flags, row.id);
        assert.equal(row.replacement, replacement, row.id);
        assert.equal(row.offWhen && row.offWhen.source, offWhen ? offWhen.source : null, row.id);
        assert.equal(row.offWhen && row.offWhen.flags, offWhen ? offWhen.flags : null, row.id);
      });
    });

    it(font + ': every row says why, cites its source and has an example the row decides at its turn', () => {
      const rows = BREAK_RULES[font];
      rows.forEach((row, k) => {
        for (const key of ['why', 'source', 'example']) {
          assert.equal(typeof row[key], 'string', row.id + ' ' + key);
          assert.ok(row[key].length > 0, row.id + ' ' + key);
        }
        // The row changes the text at its turn, after the rows before it.
        let text = row.example;
        for (const before of rows.slice(0, k)) {
          if (!(before.offWhen && before.offWhen.test(row.example))) text = text.replace(before.pattern, before.replacement);
        }
        assert.notEqual(text.replace(row.pattern, row.replacement), text, row.id + ' does not change its example');
        assert.deepEqual(breakPartsByRows(row.example, rows), syllable2x.breakParts(row.example, font), row.id);
        assert.equal(coreBreaks(row.example, font), breaks2x(row.example, font), row.id);
      });
    });
  }

  it('row U4 never decides a break: the rows without it break every probe the same way', () => {
    const withoutU4 = BREAK_RULES.unicode.filter((row) => row.id !== 'U4');
    const kinziDot = '\u1004\u103A\u1039\u1037';
    const probes = [kinziDot, KA + kinziDot, KA + AA + kinziDot + KHA, KA + ' ' + kinziDot, '(' + kinziDot,
      KA + '\u1039' + kinziDot, KA + kinziDot + '\u1037\u103A', KA + KA + kinziDot + KA];
    for (const probe of probes) {
      assert.deepEqual(breakPartsByRows(probe, withoutU4), breakPartsByRows(probe, BREAK_RULES.unicode), units(probe));
    }
  });
});

describe('the scanners\' classes, on every UTF-16 unit', () => {
  // Every unit but U+200B and U+200C, which the break functions never see (DESIGN.md §2.3).
  const UNITS = [];
  for (let code = 0; code < 0x10000; code++) if (code !== 0x200B && code !== 0x200C) UNITS.push(ch(code));

  // Each probe puts the unit where one class is read: before a letter (spaces, opening marks, virama, the bare
  // consonant of row U7 or Z8), as the letter itself (rows U2, Z1, Z2), and between a consonant and its asat (the
  // tone marks of rows U5 and Z5), before e (row Z8), after a consonant (the kinzi glyphs of row Z6), and between e
  // and a consonant carrying kinzi (the glyphs row Z6 reads before its consonant).
  const PROBES = {
    unicode: [(u) => KA + AA + u + KHA, (u) => KA + AA + u, (u) => KA + AA + KHA + u + '\u103A', (u) => KA + u + KHA + '\u103A'],
    zawgyi: [(u) => KA + AA + u + KHA, (u) => KA + AA + u, (u) => KA + AA + KHA + u + '\u1039', (u) => KA + u + '\u1031' + KHA,
      (u) => KA + AA + KHA + u, (u) => KA + AA + '\u1031' + u + KHA + '\u1064']
  };

  for (const font of FONTS) {
    it(font + ': each probe breaks as 2.x does', () => {
      const bad = [];
      for (const u of UNITS) {
        for (const probe of PROBES[font]) {
          const text = probe(u);
          if (coreBreaks(text, font) !== breaks2x(text, font)) bad.push(units(text));
        }
      }
      assert.deepEqual(bad.slice(0, 20), [], bad.length + ' probes differ');
    });
  }
});

describe('forEachBreak', () => {
  const text = '\u1019\u103C\u1014\u103A\u1019\u102C\u1005\u102C'; // မြန်|မာ|စာ
  const breaksOf = (input, font, policy) => {
    const seen = [];
    forEachBreak(input, font, (index) => { seen.push(index); }, policy);
    return seen;
  };

  it('reports each break once, in increasing order, never at 0', () => {
    const seen = [];
    forEachBreak(text, 'unicode', (index) => { seen.push(index); });
    assert.deepEqual(seen, [4, 6]);
    const lone = [];
    forEachBreak(KA, 'unicode', (index) => { lone.push(index); });
    assert.deepEqual(lone, []);
  });

  it('stops when onBreak returns false', () => {
    for (const font of FONTS) {
      const seen = [];
      forEachBreak(KA + AA + KHA + AA + KA + AA, font, (index) => {
        seen.push(index);
        return false;
      });
      assert.deepEqual(seen, [2], font);
    }
  });

  it('takes a bare-consonant policy: 2.x\'s PAIRS by default, CHAINS or SEPARATE', () => {
    assert.deepEqual(BARE_CONSONANTS, { PAIRS: 'pairs', CHAINS: 'chains', SEPARATE: 'separate' });
    assert.ok(Object.isFrozen(BARE_CONSONANTS));
    const three = KA + KA + KA;
    for (const font of FONTS) {
      assert.deepEqual(breaksOf(three, font), [2], font);
      assert.deepEqual(breaksOf(three, font, BARE_CONSONANTS.PAIRS), [2], font);
      assert.deepEqual(breaksOf(three, font, BARE_CONSONANTS.CHAINS), [], font);
      assert.deepEqual(breaksOf(three, font, BARE_CONSONANTS.SEPARATE), [1, 2], font);
    }
    // ပထမဆုံး: ပထ|မဆုံး in 2.x, one piece under CHAINS, one syllable per consonant under SEPARATE (UTN #11).
    const first = '\u1015\u1011\u1019\u1006\u102F\u1036\u1038';
    assert.deepEqual(breaksOf(first, 'unicode'), [2]);
    assert.deepEqual(breaksOf(first, 'unicode', BARE_CONSONANTS.CHAINS), []);
    assert.deepEqual(breaksOf(first, 'unicode', BARE_CONSONANTS.SEPARATE), [1, 2, 3]);
  });

  it('Zawgyi: the policy decides only bare consonants; a lone e or medial ra joins the consonant before it', () => {
    const withMedial = KA + '\u107E' + KA + '\u1015\u102B'; // ကၾကပါ: a consonant after a medial ra is not bare
    assert.deepEqual(breaksOf(withMedial, 'zawgyi', BARE_CONSONANTS.PAIRS), [3]);
    assert.deepEqual(breaksOf(withMedial, 'zawgyi', BARE_CONSONANTS.CHAINS), [3]);
    assert.deepEqual(breaksOf(withMedial, 'zawgyi', BARE_CONSONANTS.SEPARATE), [1, 3]);
    // A base after e and a medial ra, and the base U+106B, are syllables of their own under SEPARATE.
    assert.deepEqual(breaksOf(KA + '\u1031\u103B' + KHA, 'zawgyi'), []);
    assert.deepEqual(breaksOf(KA + '\u1031\u103B' + KHA, 'zawgyi', BARE_CONSONANTS.SEPARATE), [1]);
    assert.deepEqual(breaksOf(KA + '\u1031\u106B', 'zawgyi', BARE_CONSONANTS.SEPARATE), [1]);
    const loneE = KA + '\u1031 ' + KHA; // က, then an e with no base after it
    for (const policy of Object.values(BARE_CONSONANTS)) assert.deepEqual(breaksOf(loneE, 'zawgyi', policy), [], policy);
  });
});

describe('the 2.x quirks the scanners keep', () => {
  it('row U1: the break text has dot below before asat, as 2.x returns it', () => {
    const typed = '\u101E\u1004\u103A\u1037'; // သင့်် typed asat first
    assert.equal(prepareBreakText(typed, 'unicode'), '\u101E\u1004\u1037\u103A');
    assert.equal(prepareBreakText(typed, 'zawgyi'), typed);
    // One global replace: the second dot below of asat, dot below, dot below is not moved.
    assert.equal(prepareBreakText('\u103A\u1037\u1037', 'unicode'), '\u1037\u103A\u1037');
    assert.deepEqual(breakParts(typed, 'unicode'), syllable2x.breakParts(typed, 'unicode'));
    const plain = KA + AA;
    assert.equal(prepareBreakText(plain, 'unicode'), plain);
  });

  it('rows U7 and Z8: bare consonants join in pairs only (legacyBareConsonantPair)', () => {
    for (const font of FONTS) {
      assert.deepEqual(breakParts(KA + KA + KA, font), [KA + KA, KA], font);
      assert.deepEqual(breakParts(KA + KA + KA + KA, font), [KA + KA, KA + KA], font);
    }
    // ပထမဆုံး breaks as ပထ|မဆုံး.
    assert.equal(coreBreaks('\u1015\u1011\u1019\u1006\u102F\u1036\u1038', 'unicode'), '\u1015\u1011|\u1019\u1006\u102F\u1036\u1038');
    // ကၾကပါ: a consonant typed after a medial ra has its marks, and joins nothing (b982c98).
    assert.equal(coreBreaks(KA + '\u107E' + KA + '\u1015\u102B', 'zawgyi'), KA + '\u107E' + KA + '|\u1015\u102B');
  });

  it('row Z6 is off for text that looksLikeSgawKaren', () => {
    assert.equal(looksLikeSgawKaren('\u1062\u103A'), true);
    assert.equal(looksLikeSgawKaren(KA + '\u1063\u103A' + KA), true);
    assert.equal(looksLikeSgawKaren('\u1061\u103A'), false);
    assert.equal(looksLikeSgawKaren('\u1062\u1039'), false);
    assert.equal(looksLikeSgawKaren('\u1062 \u103A'), false);
    const kinzi = KA + AA + KHA + '\u1064'; // ကာခၤ: the kinzi keeps ခ with ကာ
    assert.equal(coreBreaks(kinzi, 'zawgyi'), kinzi);
    const karen = kinzi + ' \u1062\u103A';
    assert.equal(coreBreaks(karen, 'zawgyi'), KA + AA + '|' + KHA + '\u1064 \u1062\u103A');
    assert.equal(coreBreaks(karen, 'zawgyi'), breaks2x(karen, 'zawgyi'));
  });

  it('breakString puts U+200B at the breaks when the separator is empty, as 2.x joinParts', () => {
    const text = KA + AA + KHA + AA;
    assert.equal(breakString(text, 'unicode', ''), KA + AA + '\u200B' + KHA + AA);
    assert.equal(breakString(text, 'unicode'), KA + AA + '\u200B' + KHA + AA);
    assert.equal(breakString(text, 'unicode', ' / '), KA + AA + ' / ' + KHA + AA);
    assert.equal(breakString(KA + AA, 'unicode', '|'), KA + AA);
    assert.deepEqual(breakParts('', 'unicode'), ['']);
    assert.equal(breakString('', 'zawgyi', '|'), '');
  });
});

describe('lossless segmentation (3.0, decision 34)', () => {
  const words = [
    '\u1019\u103C\u1014\u103A\u1019\u102C', // မြန်မာ
    '\u101E\u1004\u103A\u1037 \u1000\u102D\u102F', // သင့်် ကို, asat typed before the dot below
    '\u1000\u102C\u200B\u1001\u102B\u200C\u1002', // with a zero-width space and non-joiner
    '  \u1000\u1000\u1000  '
  ];

  it('joins back to the text, with nothing cleaned, trimmed or reordered', () => {
    for (const font of FONTS) {
      for (const text of words) assert.equal(segmentSyllables(text, font).join(''), text, units(text));
    }
    assert.deepEqual(segmentSyllables('', 'unicode'), []);
    assert.deepEqual(syllableBoundaries('', 'unicode'), []);
  });

  it('decides the breaks on row U1\'s order, but keeps the typed order', () => {
    const text = words[1];
    assert.deepEqual(segmentSyllables(text, 'unicode'), [text]);
    assert.deepEqual(breakParts(text, 'unicode'), [prepareBreakText(text, 'unicode')]);
  });

  it('keeps U+200B and U+200C at the end of the syllable before them', () => {
    assert.deepEqual(segmentSyllables(words[2], 'unicode'),
      [KA + AA + '\u200B', KHA + '\u102B\u200C', '\u1002']);
    assert.deepEqual(syllableBoundaries(words[2], 'unicode'), [3, 6]);
  });

  it('takes the bare-consonant policy of forEachBreak, PAIRS by default', () => {
    const three = KA + KA + KA;
    for (const font of FONTS) {
      assert.deepEqual(segmentSyllables(three, font), [KA + KA, KA], font);
      assert.deepEqual(segmentSyllables(three, font, BARE_CONSONANTS.CHAINS), [three], font);
      assert.deepEqual(segmentSyllables(three, font, BARE_CONSONANTS.SEPARATE), [KA, KA, KA], font);
      assert.deepEqual(syllableBoundaries(three, font, BARE_CONSONANTS.SEPARATE), [1, 2], font);
    }
  });

  it('on text with no U+200B or U+200C, PAIRS gives the breaks of 2.x breakParts', () => {
    fc.assert(fc.property(fc.constantFrom(...FONTS), fc.string({ unit: fc.constantFrom(...'\u1000\u1001\u1004\u1025\u1031\u103B\u107E\u1039\u103A\u1037\u1038\u102C\u1064 ('.split('')), maxLength: 12 }),
      (font, text) => {
        let at = 0;
        const expected = syllable2x.breakParts(text, font).slice(0, -1).map((part) => (at += part.length));
        assert.deepEqual(syllableBoundaries(text, font), expected);
      }), { seed: fuzz.SEED, numRuns: fuzz.runs(5000, 50000) });
  });
});

describe('collapseRepeatedMarks', () => {
  it('collapses the marks of each font\'s 2.x COLLAPSE set, and nothing else, on every unit', () => {
    for (const font of FONTS) {
      const set = new Set(syllable2x.COLLAPSE[font].map((rule) => rule[1]));
      const bad = [];
      for (let code = 0; code < 0x10000; code++) {
        const twice = ch(code) + ch(code);
        const expected = set.has(ch(code)) ? ch(code) : twice;
        if (collapseRepeatedMarks(KA + twice, font) !== KA + expected) bad.push(code.toString(16));
      }
      assert.deepEqual(bad, [], font);
    }
  });

  it('collapses every run, of any length, in one pass', () => {
    const text = KA + '\u102D\u102D\u102D\u102F\u102F' + KHA + '\u103A\u103A' + ' ' + '\u1037'.repeat(5);
    assert.equal(collapseRepeatedMarks(text, 'unicode'), KA + '\u102D\u102F' + KHA + '\u103A \u1037');
    assert.equal(collapseRepeatedMarks(text, 'unicode'), syllable2x.collapseMarks(text, 'unicode'));
    assert.equal(collapseRepeatedMarks('\u1060\u1060\u1060' + KA, 'zawgyi'), '\u1060' + KA);
    assert.equal(collapseRepeatedMarks('\u1060\u1060', 'unicode'), '\u1060\u1060');
  });

  it('returns the text itself when nothing repeats', () => {
    const text = KA + '\u102D\u102F' + KHA + AA + ' a';
    assert.equal(collapseRepeatedMarks(text, 'unicode'), text);
    assert.equal(collapseRepeatedMarks('', 'zawgyi'), '');
    assert.equal(collapseRepeatedMarks('\u102D', 'zawgyi'), '\u102D');
  });
});

describe('the table probes of the break and collapse rows (test/fixtures/tables.json)', () => {
  const cases = tableProbes();
  const rows = Object.keys(cases).filter((id) => /^(break|collapse) /.test(id));

  it('covers every break and collapse row', () => {
    assert.equal(rows.filter((id) => id.startsWith('break ')).length, 16);
    assert.equal(rows.filter((id) => id.startsWith('collapse ')).length, 17 + 67);
  });

  for (const id of rows) {
    it(id, () => {
      const font = id.split(' ')[1];
      const run = id.startsWith('break ')
        ? (probe) => ({ output: syllBreakOnCore(probe, font, '|') })
        : (probe) => ({ output: spellingFixOnCore(probe, font) });
      const expect2x = id.startsWith('break ')
        ? (probe) => ({ output: syllBreak2x(probe, font, '|') })
        : (probe) => ({ output: spellingFix2x(probe, font) });
      for (const { probe, expect } of [cases[id]].concat(cases[id].edges || [])) {
        assert.deepEqual(run(probe), expect, units(probe));
        assertSame(run(probe), expect2x(probe), id, probe);
      }
    });
  }
});
