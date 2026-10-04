// Properties of 3.0's normalize (docs/next/DESIGN.md §11.2, §11.3; decision 36), on fast-check strings.
//
// - Idempotent: normalize(normalize(x)) === normalize(x). The pull-request run is seeded and small; a long run
//   (KNAYI_FUZZ_SCALE=20) makes it 1M strings of each kind, as DESIGN.md §11.2 records.
// - It is the stable pass repeated over the whole text until the pass changes nothing, and that takes at most 3
//   passes, also on pumped chains: normalizeTextStable repeats it only on the regions the first pass changed, and
//   the regions are independent (cut-locality, checked here).
// - Where 2.x settles its own way (no u, zero or seven after a virama or under a kinzi), it gives what repeating 2.x
//   normalize gives.
// - The report's changes rebuild the output from the input.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { arb, fuzz } from '../helpers.mjs';
import { units } from './helpers.mjs';
import { normalize } from '../../../src/index.js';
import { normalizeText, STABLE_NORMALIZE_STAGES } from '../../../src/stages/normalize.js';
import { runStages } from '../../../src/core/rules.js';

// The kinds of text: Unicode Burmese and its neighbours, structured Burmese with typing slips, and any UTF-16 units.
const TEXTS = { unicode: arb.unicodeText(16), burmese: arb.burmeseText, units: arb.codeUnits };

// One pass of STABLE_NORMALIZE_STAGES through the stage runner.
const stablePass = (text) => runStages(text, STABLE_NORMALIZE_STAGES, { openAllGates: false, seen: 0 }, null);

// [the text the stable pass settles on over the whole text, the passes it took, the last one changing nothing].
function settleWhole(text) {
  for (let passes = 1; passes <= 50; passes++) {
    const next = stablePass(text);
    if (next === text) return [text, passes];
    text = next;
  }
  throw new Error('the stable pass did not settle');
}

// 2.x normalize, repeated until it changes nothing.
function settledBy2x(text) {
  for (let pass = 0; pass < 50; pass++) {
    const next = normalizeText(text);
    if (next === text) return text;
    text = next;
  }
  throw new Error('2.x did not settle on ' + units(text));
}

// The regressions: the garbled classes of DESIGN.md §10 Q12 and the chains the pumping found.
const REGRESSIONS = [
  '\u1040\u103D \u103E', '\u1010\u102B\u1039\u1040', '\u1010\u1040\u1040\u102E', '\u101D\u1038\u102D\u1025\u102C',
  '\u102D\u102E\u102D', '\u1031\u1025\u102C', '\u1044\u103A\u1031\u103A\u100A', '\u1005\u103A\u102B\u103B',
  '\u1025\u1039\u1047\u1036', '\u1000\u103E\u1039\u1025\u102B', '\u1047\u1040\u1039', '\u1010\u1040\u1047\u1034'
].map((text) => [text]);

describe('normalize is idempotent (decision 36)', () => {
  for (const [kind, text] of Object.entries(TEXTS)) {
    it(kind + ' strings', () => {
      fuzz.check(fc.property(text, (x) => {
        const once = normalize(x);
        assert.equal(normalize(once), once, units(x) + ' gives ' + units(once));
      }), 50000, REGRESSIONS, 1000000);
    });
  }
});

describe('normalize is the stable pass, settled (DESIGN.md §11.2)', () => {
  it('equals the pass repeated over the whole text, which settles in at most 3 passes', () => {
    let most = 0;
    fuzz.check(fc.property(TEXTS.unicode, (x) => {
      const [settled, passes] = settleWhole(x);
      most = Math.max(most, passes);
      assert.equal(normalize(x), settled, units(x));
      assert.ok(passes <= 3, units(x) + ' took ' + passes + ' passes');
    }), 30000, REGRESSIONS, 600000);
    assert.ok(most >= 2, 'some strings need a second pass');
  });

  it('settles every pumped chain in at most 3 passes', () => {
    const chains = ['\u1025\u1039\u1047', '\u1039\u1025', '\u102D', '\u1040', '\u1040\u1047', '\u1031\u1025',
      '\u1039\u1040', '\u102F\u1030', '\u1040\u1036 '];
    for (const link of chains) {
      for (const n of [3, 10, 40]) {
        for (const text of ['\u1000\u103E' + link.repeat(n) + '\u102B', link.repeat(n) + '\u1036', '\u1010' +
          link.repeat(n) + '\u102E']) {
          const [settled, passes] = settleWhole(text);
          assert.ok(passes <= 3, units(text) + ' took ' + passes + ' passes');
          assert.equal(normalize(text), settled);
        }
      }
    }
  });

  it('reads a region the same whether alone or in its text: a pass is local to regions', () => {
    // A region starts at a syllable base or Burmese digit after a unit below U+0300 that is no number separator.
    const separator = fc.constantFrom(' ', '\n', '\t', 'a', '\u00A0', '!');
    const base = fc.constantFrom('\u1000', '\u1025', '\u1040', '\u1047', '\u101D', '\u103F', '\u1004');
    fuzz.check(fc.property(TEXTS.unicode, separator, base, TEXTS.unicode, (a, cut, first, b) => {
      const left = a + cut;
      const right = first + b;
      assert.equal(stablePass(left + right), stablePass(left) + stablePass(right), units(left) + ' | ' + units(right));
      assert.equal(normalize(left + right), normalize(left) + normalize(right));
    }), 30000, [], 600000);
  });

  it('gives what repeating 2.x gives, where nothing is stacked as a look-alike', () => {
    // A virama, then any e or medial ra the reader skips to reach the stacked consonant, then u, zero or seven.
    const stackedLookAlike = /\u1039[\u1031\u103C]*[\u1025\u1040\u1047]/;
    fuzz.check(fc.property(fc.oneof(TEXTS.unicode, TEXTS.burmese), (x) => {
      if (stackedLookAlike.test(x.normalize('NFC'))) return;
      assert.equal(units(normalize(x)), units(settledBy2x(x)), units(x));
    }), 50000, REGRESSIONS, 1000000);
  });
});

describe('normalize\'s report (DESIGN.md §11.3)', () => {
  it('rebuilds the output from the input, and agrees with the plain call', () => {
    fuzz.check(fc.property(fc.oneof(TEXTS.unicode, TEXTS.burmese, TEXTS.units), (x) => {
      const report = normalize(x, { report: true });
      assert.equal(report.text, normalize(x));
      let rebuilt = '';
      let copied = 0;
      let output = 0;
      for (const change of report.changes) {
        assert.ok(change.start >= copied && change.end >= change.start && change.outputStart >= output);
        assert.equal(change.start - copied, change.outputStart - output, 'copied units line up');
        assert.equal(x.slice(change.start, change.end), change.before);
        assert.equal(report.text.slice(change.outputStart, change.outputEnd), change.after);
        if (x.isWellFormed()) {
          assert.ok(change.before.isWellFormed() && change.after.isWellFormed(), 'a pair cut: ' + units(x));
        }
        rebuilt += x.slice(copied, change.start) + change.after;
        copied = change.end;
        output = change.outputEnd;
      }
      assert.equal(rebuilt + x.slice(copied), report.text, units(x));
    }), 30000, REGRESSIONS.concat([['a\uD804\uDD31\uD804\uDD27'], ['x\uD834\uDD6D\uD834\uDD65']]), 600000);
  });
});
