// Differential fuzz of src/rules/segment.js against 2.x (docs/next/DESIGN.md §6.1, §7.5). Owner: W3 (segment).
//
// Every string is checked under both fonts, against the frozen 2.x code of scripts/oracle/syllable.js (D19):
//   - breakParts and breakString against 2.x breakParts and joinParts on the cleaned string, and against the rows of
//     src/spec/breakRules.js run by the 2.x algorithm;
//   - the 2.x public preamble with the core functions against 2.x syllBreak and spellingFix on the raw string;
//   - collapseRepeatedMarks against 2.x collapseMarks;
//   - segmentSyllables and syllableBoundaries: lossless under every policy, and 2.x's breaks under PAIRS.
// A long run (KNAYI_FUZZ_SCALE above 1) also runs every distinct line of every cached corpus, when the eval cache
// holds all of them; it never downloads. The nightly job's scale, 100, gives each property its nightly count of 1M
// strings; by hand, KNAYI_FUZZ_SCALE=5 already gives the first two theirs.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  BARE_CONSONANTS, prepareBreakText, breakParts, breakString, segmentSyllables, syllableBoundaries,
  collapseRepeatedMarks
} from '../../src/rules/segment.js';
import { BREAK_RULES } from '../../src/spec/breakRules.js';
import { arb, fuzz } from './helpers.mjs';
import {
  FONTS, syllable2x, breakPartsByRows, syllBreak2x, spellingFix2x, syllBreakOnCore, spellingFixOnCore, cleanText,
  assertSame
} from './segmentOracle.mjs';

const ch = (code) => String.fromCharCode(code);
const range = (first, last) => Array.from({ length: last - first + 1 }, (_, i) => ch(first + i));

// Every unit a break row names, the units just outside each of its ranges, the spaces and opening marks of rows
// U3, U6, Z4 and Z7, and a few others. U+200B and U+200C are in the raw strings and cleaned out where 2.x cleans.
const ROW_UNITS = [].concat(
  range(0x0FFF, 0x1000), range(0x1021, 0x102C), range(0x1031, 0x1032), range(0x1036, 0x1040), range(0x104B, 0x1050),
  range(0x1059, 0x105B), range(0x105F, 0x1066), range(0x1069, 0x106C), range(0x106D, 0x1071), range(0x107D, 0x1087),
  range(0x108A, 0x1097),
  range(0x08, 0x0E), [' ', '\u00A0', '\u1680', '\u2000', '\u200A', '\u2028', '\u2029', '\u202F', '\u205F', '\u3000',
    '\uFEFF', '\u2011', '\u2012', '\u2014', '\u2015', '\u2018', '\u2019', '\u201C', '\u201D'],
  ['>', '-', '(', '[', '{', ')', 'a', '1', '\u200D', '\u2060', '\u200B', '\u200C']
);
// The units the join reasons turn on, drawn more often.
const HOT_UNITS = ['\u1000', '\u1001', '\u1004', '\u1025', '\u1029', '\u1031', '\u103B', '\u103C', '\u107E', '\u1084',
  '\u1039', '\u103A', '\u1037', '\u1038', '\u1094', '\u1095', '\u1064', '\u108B', '\u108D', '\u1062', '\u1063',
  '\u106A', '\u1086', '\u108F', '\u1090', '\u103D', '\u103E', '\u102C', '\u102D', ' ', '('];

const rowText = fc.string({
  unit: fc.oneof({ weight: 3, arbitrary: fc.constantFrom(...HOT_UNITS) }, { weight: 2, arbitrary: fc.constantFrom(...ROW_UNITS) }),
  minLength: 1,
  maxLength: 16
});
const text = fc.oneof(
  { weight: 4, arbitrary: rowText },
  { weight: 1, arbitrary: arb.unicodeText(16) },
  { weight: 1, arbitrary: arb.zawgyiText(16) },
  { weight: 1, arbitrary: arb.burmeseText }
);
const separator = fc.constantFrom('|', '', '\u200B', ' ', '--');

// Paths the 2.x fixes of the break rows name, and long runs, checked first.
const REGRESSIONS = [
  '\u1000\u1000\u1000', // bare consonants: pairs
  '\u1015\u1011\u1019\u1006\u102F\u1036\u1038', // ပထမဆုံး
  '\u1016\u103C\u1004\u1037\u103A', // ဖြင့်: dot below before asat (41e18bf)
  '\u101E\u1004\u103A\u1037', // asat typed before the dot below (row U1)
  '\u100A\u1025\u1037\u103A', // ညဥ့်
  '\u1011\u103D\u1030\u101C\u1032\u1025\u103A\u1038', // Pa'o: u after a vowel sign starts a syllable (73214a3)
  '\u1000\u1004\u103A\u1039\u1037', // row U4
  '\u1000\u107E\u1000\u1015\u102B', // ကၾကပါ (b982c98)
  '\u103B\u1001\u1031\u101E\u1064\u1037', // ျခေသၤ့: Zawgyi kinzi (row Z6)
  '\u1031\u103B\u1031\u103B\u1000\u1064', // two e and medial ra pairs before a kinzi consonant
  '\u1000\u1064 \u1062\u103A', // S'gaw Karen: row Z6 off
  '\u1019\u1004\u1038\u1039', // မငး္: visarga before Zawgyi asat (a2d6e49)
  '\u1000 \u2028\u1001(\u1002\u201C\u1003', // spaces and opening marks
  ' \u200B\u1000\u103C ', // cleaned twice is not cleaned once
  '\u1000'.repeat(41) + '\u1031'.repeat(20) + '\u102D'.repeat(20)
].map((x) => [x]);

// Checks one raw string under both fonts.
function checkBreaks(raw, sep) {
  const cleaned = cleanText(raw);
  for (const font of FONTS) {
    const parts = syllable2x.breakParts(cleaned, font);
    assertSame(breakParts(cleaned, font), parts, 'breakParts ' + font, cleaned);
    assertSame(breakString(cleaned, font, sep), syllable2x.joinParts(parts, sep), 'breakString ' + font, cleaned);
    assertSame(breakPartsByRows(cleaned, BREAK_RULES[font]), parts, 'the spec rows ' + font, cleaned);
    assertSame(syllBreakOnCore(raw, font, sep), syllBreak2x(raw, font, sep), 'syllBreak ' + font, raw);
    assertSame(spellingFixOnCore(raw, font), spellingFix2x(raw, font), 'spellingFix ' + font, raw);
  }
}

// Strings with runs of repeated marks, for the collapse.
const MARK_UNITS = range(0x102B, 0x103F).concat(range(0x105A, 0x105A), range(0x105F, 0x1097), ['\u1000', ' ', 'a']);
const repeated = fc.array(fc.tuple(fc.constantFrom(...MARK_UNITS), fc.integer({ min: 1, max: 4 })), { minLength: 1, maxLength: 8 })
  .map((runs) => runs.map(([unit, n]) => unit.repeat(n)).join(''));

// The breaks 2.x gives a text with no U+200B or U+200C, as indexes of the text.
function boundaries2x(text, font) {
  let at = 0;
  return syllable2x.breakParts(text, font).slice(0, -1).map((part) => (at += part.length));
}

describe('src/rules/segment.js against 2.x, both fonts', () => {
  it('breakParts, breakString, the spec rows, syllBreak and spellingFix', () => {
    fuzz.check(fc.property(text, separator, (raw, sep) => checkBreaks(raw, sep)),
      200000, REGRESSIONS.map(([x]) => [x, '|']), 1000000);
  });

  it('collapseRepeatedMarks', () => {
    fuzz.check(fc.property(fc.oneof(repeated, text), (raw) => {
      for (const font of FONTS) {
        assertSame(collapseRepeatedMarks(raw, font), syllable2x.collapseMarks(raw, font), 'collapseRepeatedMarks ' + font, raw);
      }
    }), 300000, [['\u102D\u102D\u102D\u1060\u1060'], ['\u1037'.repeat(9)]], 1000000);
  });

  it('segmentSyllables and syllableBoundaries: lossless under every policy, 2.x\'s breaks under PAIRS', () => {
    const anyText = fc.oneof(text, arb.codeUnits);
    fuzz.check(fc.property(anyText, (raw) => {
      for (const font of FONTS) {
        for (const policy of Object.values(BARE_CONSONANTS)) {
          const syllables = segmentSyllables(raw, font, policy);
          assert.equal(syllables.join(''), raw);
          assert.ok(syllables.every((s) => s.length > 0));
          let at = 0;
          assert.deepEqual(syllableBoundaries(raw, font, policy), syllables.slice(0, -1).map((s) => (at += s.length)));
        }
        if (!/[\u200B\u200C]/.test(raw)) {
          const prepared = prepareBreakText(raw, font);
          assertSame(syllableBoundaries(raw, font), boundaries2x(prepared, font), 'syllableBoundaries ' + font, raw);
        }
      }
    }), 100000, REGRESSIONS, 1000000);
  });
});

// Every distinct line of every cached corpus, on a long run, when the cache holds all of them.
async function cachedCorpora() {
  if (!fuzz.LONG_RUN) return { skip: 'a long run only (KNAYI_FUZZ_SCALE above 1)' };
  const { checkCache } = await import('../../scripts/eval/datasets.mjs');
  const missing = checkCache().filter((row) => row.status !== 'ok' && !/\(legacy\)$/.test(row.name));
  if (missing.length) return { skip: 'the eval cache lacks ' + missing.map((row) => row.name).join(', ') };
  const { corpusSets } = await import('../../scripts/eval/lib/inputs.mjs');
  return { sets: (await corpusSets()).sets };
}

describe('src/rules/segment.js against 2.x on the corpora', async () => {
  const corpora = await cachedCorpora();
  it('every distinct line, both fonts', { skip: corpora.skip || false }, (t) => {
    let lines = 0;
    for (const set of corpora.sets) {
      for (const line of set.lines) {
        checkBreaks(line, '|');
        for (const font of FONTS) {
          assertSame(collapseRepeatedMarks(line, font), syllable2x.collapseMarks(line, font), 'collapse ' + font, line);
          assert.equal(segmentSyllables(line, font).join(''), line);
        }
        lines++;
      }
    }
    t.diagnostic(lines + ' lines in ' + corpora.sets.length + ' sets: ' + corpora.sets.map((s) => s.id).join(', '));
  });
});
