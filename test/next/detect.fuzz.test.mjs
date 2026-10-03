// Differential tests of src/detect.js against the 2.x signatures, the 29 regexes of scripts/oracle/signatures.js
// (docs/next/DESIGN.md §6.1, §7.6). countEvidence must give their String#match counts, per side:
//   - on every string of up to 3 units over the boundary alphabet below: 120,100 strings. A long run
//     (KNAYI_FUZZ_SCALE above 1, the nightly job) goes to 4 units: 5,884,901 strings, the set of the plan's P1;
//   - on 200k fast-check strings (2M in a long run), after the regressions;
//   - on every line of every corpus in the cache, raw and cleaned. The test reads only corpora whose files are all
//     cached and match their pins, so it never downloads; with no cache (CI's test job) it skips.
// On the same inputs, the rule path on the core (the 2.x gate and cleaning, then decide(countEvidence(...)))
// gives what the oracle's fontDetect gives, for each fallback.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { countEvidence, decide } from '../../src/detect.js';
import { oracle, arb, fuzz, internals } from './helpers.mjs';
import { checkCache, CORPORA } from '../../scripts/eval/datasets.mjs';
import { corpusSets } from '../../scripts/eval/lib/inputs.mjs';

const SIGNATURES = oracle.signatures.detect;

// The 2.x evidence: the String#match counts of the 29 signatures, per side (detector.js:85-100).
function oracleEvidence(text) {
  const count = (patterns) => patterns.reduce((sum, re) => sum + (text.match(re) || []).length, 0);
  return { unicode: count(SIGNATURES.unicode), zawgyi: count(SIGNATURES.zawgyi) };
}

function cleaned(text) {
  return text.trim().replace(/[\u200B\u200C]/g, '');
}

// 2.x fontDetect(text, fallback, { adapter: 'rules' }) on the core: the Myanmar block gate, the cleaning, then the
// evidence (detector.js:126-145).
function fontDetectOnCore(text, fallback) {
  if (!/[\u1000-\u109F]/.test(text)) return fallback || 'en';
  return decide(countEvidence(cleaned(text)), fallback || 'zawgyi');
}

function units(text) {
  return Array.from(text, (ch) => 'U+' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
}

function sameEvidence(text) {
  const ours = countEvidence(text);
  const theirs = oracleEvidence(text);
  if (ours.unicode !== theirs.unicode || ours.zawgyi !== theirs.zawgyi) {
    assert.fail(units(text) + ': countEvidence ' + JSON.stringify(ours) + ', the 2.x regexes ' +
      JSON.stringify(theirs));
  }
}

// The boundary alphabet, 49 units: every unit a signature names, both ends of each range in a signature and the
// units just outside them, the whitespace class of Z03 and Z12 with U+000B (which is not in it), and units in no
// class (SCR/api-verify/scanner-fuzz.js, the plan's P1).
const BOUNDARY = [
  // Consonants: the ends of U+1000-U+1021 and the units past them, and nga, nya and na (U03-U05).
  0x0FFF, 0x1000, 0x1021, 0x1022, 0x1004, 0x100A, 0x1014,
  // The letter nya, which Z06's u stands for, and the letter u.
  0x1009, 0x1025,
  // Vowel signs: the ends of U+102B-U+1030 and the units past them, and the ones the rows name.
  0x102B, 0x102C, 0x102D, 0x102E, 0x102F, 0x1030, 0x1031, 0x1032,
  // e above, anusvara, visarga, U+1039 and U+103A-U+103F.
  0x1035, 0x1036, 0x1038, 0x1039, 0x103A, 0x103B, 0x103C, 0x103D, 0x103E, 0x103F,
  // U10's range, U+1050-U+1059, and the units past it.
  0x104F, 0x1050, 0x1059, 0x105A,
  // Zawgyi's kinzi, and the medial ra glyphs U+107E-U+1084 with the units past them and one inside.
  0x1064, 0x107D, 0x107E, 0x1081, 0x1084, 0x1085,
  // The last unit of the Myanmar block, and the next.
  0x109F, 0x10A0,
  // The whitespace class [\x20\t\r\n\f], and U+000B.
  0x20, 0x09, 0x0D, 0x0A, 0x0C, 0x0B,
  // Units in no class: NUL, 'a', no-break space and a lone surrogate.
  0x00, 0x61, 0xA0, 0xD800
].map((code) => String.fromCharCode(code));

// Calls visit on every string of length 0 to maxLength over alphabet; returns how many.
function everyString(alphabet, maxLength, visit) {
  let count = 0;
  (function extend(prefix, room) {
    visit(prefix);
    count++;
    if (room === 0) return;
    for (const unit of alphabet) extend(prefix + unit, room - 1);
  })('', maxLength);
  return count;
}

describe('countEvidence against the 2.x signatures', () => {
  const maxLength = fuzz.LONG_RUN ? 4 : 3;
  it('on every string of up to ' + maxLength + ' units over the boundary alphabet', (t) => {
    assert.equal(BOUNDARY.length, 49);
    const count = everyString(BOUNDARY, maxLength, sameEvidence);
    assert.equal(count, maxLength === 4 ? 5884901 : 120100);
    t.diagnostic(count + ' strings');
  });

  const E = '\u1031';
  const boundaryText = fc.string({ unit: fc.constantFrom(...BOUNDARY), maxLength: 40 });
  // Runs of e between boundary text: Z15's matches must not overlap.
  const eRuns = fc.tuple(boundaryText, fc.integer({ min: 1, max: 12 }), boundaryText)
    .map(([before, run, after]) => before + E.repeat(run) + after);
  // Burmese text with typing slips, written in Zawgyi by the frozen 2.x converter (as test/fuzz.test.js does).
  const toZawgyi = internals('syllable.js', ['convertText', 'collapseMarks']);
  const zawgyiWords = arb.burmeseText
    .map((text) => toZawgyi.convertText(toZawgyi.collapseMarks(text, 'unicode'), 'unicode', 'zawgyi'));
  const detectable = fc.oneof(arb.unicodeText(24), arb.zawgyiText(24), arb.burmeseText, arb.codeUnits, boundaryText,
    eRuns, zawgyiWords);

  // Strings where a row's edge case lives: the anchors, a match that needs a unit after it, the lookahead at the
  // end, two rows on the same units, and the runs of e.
  const REGRESSIONS = [
    E + E + E, E + E + E + E, ' ' + E + E + E + '\u1000', '\u1000' + E + E + E + '\u1000',
    '\u1000\u1039', '\u1000\u1039\u1031', '\u1000\u103B', '\u1000\u103B\u1000', '\u1000\u103C\u1000\u103C',
    '\u103B\u1019\u1000\u1039', ' \u103B\u1000', '\u000B\u103B\u1000', '\u1039\u000B', '\u102C\u1031\u1000'
  ].map((text) => [text]);

  it('on fuzz: 200k strings, 2M in a long run', () => {
    fuzz.check(fc.property(detectable, sameEvidence), 200000, REGRESSIONS, 2000000);
  });

  it('decide on the evidence is 2.x scoreWithRules, and the rule path is the oracle\'s fontDetect', () => {
    const fallback = fc.constantFrom(undefined, 'unicode', 'zawgyi', 'tie');
    fuzz.check(fc.property(detectable, fallback, (text, given) => {
      assert.equal(decide(countEvidence(text), given), oracle.signatures.scoreWithRules(text, given), units(text));
      assert.equal(fontDetectOnCore(text, given), oracle.fontDetect(text, given), units(text));
    }), 50000, REGRESSIONS.map(([text]) => [text, undefined]), 500000);
  });
});

// The corpora to leave out: those with a cached file that is missing or does not match its pin, so that
// corpusSets reads only cached files and downloads nothing. A row of checkCache names its corpus: 'okell',
// 'flores/...', 'hf-wikipedia' or 'wikipedia-v1 (legacy)'. CLDR also reads Google's file.
function uncachedCorpora() {
  const unusable = new Set();
  const legacy = [];
  for (const row of checkCache()) {
    const id = row.name.replace(/ \(legacy\)$/, '').replace(/^hf-/, '').split('/')[0];
    if (row.name.endsWith(' (legacy)')) legacy.push(id);
    if (row.status !== 'ok') unusable.add(id);
  }
  if (unusable.has('google')) unusable.add('cldr');
  return CORPORA.concat(legacy).filter((id) => unusable.has(id));
}

describe('countEvidence on the corpora', () => {
  const without = uncachedCorpora();
  const skip = CORPORA.every((id) => without.indexOf(id) !== -1) &&
    'no corpus is cached (node scripts/eval/datasets.mjs --fetch fills the cache)';
  it('equals the 2.x signatures on every cached line, raw and cleaned', { skip }, async (t) => {
    const { sets } = await corpusSets({ without });
    let calls = 0;
    for (const set of sets) {
      for (const line of set.lines) {
        sameEvidence(line);
        sameEvidence(cleaned(line));
        for (const given of [undefined, 'unicode']) {
          assert.equal(fontDetectOnCore(line, given), oracle.fontDetect(line, given), set.id + ': ' + units(line));
        }
        calls += 4;
      }
    }
    t.diagnostic(sets.map((set) => set.id + ' ' + set.lines.length).join(', ') + '; ' + calls + ' calls' +
      (without.length ? '; not cached: ' + without.join(', ') : ''));
  });
});
