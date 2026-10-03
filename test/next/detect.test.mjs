// src/detect.js and its readable oracle, src/spec/detectorSignatures.js (docs/next/DESIGN.md §7.6).
//
// The spec rows against the 2.x signatures they document (scripts/oracle/signatures.js), each row's example, the
// String#match semantics the scanner restates (anchors, matches that do not overlap, the end of the text, the
// whitespace class), the table probes of test/fixtures/tables.json, decide against 2.x scoreWithRules, the
// model's thresholds, and the per-call options of detectFont and detectEncoding. The differential tests are in
// detect.fuzz.test.mjs; the growth check is detect.timing.mjs.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { countEvidence, decide, scoreByZawgyiModel, detectFont, detectEncoding } from '../../src/detect.js';
import { DETECTOR_SIGNATURES } from '../../src/spec/detectorSignatures.js';
import { oracle, tableProbes } from './helpers.mjs';

const require = createRequire(import.meta.url);
const SIGNATURES = oracle.signatures.detect;

// The 2.x evidence: the String#match counts of the 29 signatures, per side (detector.js:85-100).
function oracleEvidence(text) {
  const count = (patterns) => patterns.reduce((sum, re) => sum + (text.match(re) || []).length, 0);
  return { unicode: count(SIGNATURES.unicode), zawgyi: count(SIGNATURES.zawgyi) };
}

// 2.x fontDetect(text, fallback, { adapter: 'rules' }) on the core: the Myanmar block gate, the cleaning, then the
// evidence (detector.js:126-145).
function fontDetectOnCore(text, fallback) {
  if (!/[\u1000-\u109F]/.test(text)) return fallback || 'en';
  return decide(countEvidence(text.trim().replace(/[\u200B\u200C]/g, '')), fallback || 'zawgyi');
}

function units(text) {
  return Array.from(text, (ch) => 'U+' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
}

// A stand-in for myanmar-tools' ZawgyiDetector that gives one probability and records what it was asked.
function stubModel(probability) {
  const asked = [];
  return { asked, getZawgyiProbability(text) { asked.push(text); return probability; } };
}

describe('spec/detectorSignatures.js', () => {
  it('has the 2.x signatures, in 2.x order: 12 Unicode rows, then 17 Zawgyi rows', () => {
    const ids = DETECTOR_SIGNATURES.map((row) => row.id);
    const expected = [];
    for (let k = 1; k <= 12; k++) expected.push('U' + String(k).padStart(2, '0'));
    for (let k = 1; k <= 17; k++) expected.push('Z' + String(k).padStart(2, '0'));
    assert.deepEqual(ids, expected);
    for (const side of ['unicode', 'zawgyi']) {
      const rows = DETECTOR_SIGNATURES.filter((row) => row.side === side);
      assert.deepEqual(rows.map((row) => new RegExp(row.pattern, 'g').source), SIGNATURES[side].map((re) => re.source),
        side + ' patterns');
      assert.ok(SIGNATURES[side].every((re) => re.flags === 'g'), '2.x compiled every signature with the g flag only');
    }
  });

  for (const row of DETECTOR_SIGNATURES) {
    it(row.id + ' says why, gives its source, and its example matches it', () => {
      for (const field of ['why', 'source', 'example']) {
        assert.equal(typeof row[field], 'string', row.id + '.' + field);
        assert.ok(row[field].length > 0, row.id + '.' + field);
      }
      const matches = row.example.match(new RegExp(row.pattern, 'g'));
      assert.ok(matches, row.id + ': the example ' + units(row.example) + ' does not match');
      assert.deepEqual(countEvidence(row.example), oracleEvidence(row.example), row.id + ' example');
    });
  }
});

describe('countEvidence: the String#match semantics it restates', () => {
  // [text, the evidence, what it shows]. Each expectation is checked against the 2.x regexes too.
  const CASES = [
    ['', { unicode: 0, zawgyi: 0 }, 'empty text'],
    ['abc 123', { unicode: 0, zawgyi: 0 }, 'no Myanmar unit'],
    ['\u1031\u1031', { unicode: 0, zawgyi: 1 }, 'Z15 e e'],
    ['\u1031\u1031\u1031', { unicode: 0, zawgyi: 1 }, 'Z15: three e are one match, not two'],
    ['\u1031\u1031\u1031\u1031', { unicode: 0, zawgyi: 2 }, 'Z15: four e are two matches'],
    ['\u1031\u1031\u1031\u1031\u1031', { unicode: 0, zawgyi: 2 }, 'Z15: five e are two matches'],
    ['\u1031\u1031\u1031\u1000\u1031\u1031', { unicode: 0, zawgyi: 2 }, 'Z15: runs of e count apart'],
    ['\u1000\u103C', { unicode: 1, zawgyi: 0 }, 'U11 at the start'],
    ['\u1000\u103C\u1000\u103C', { unicode: 1, zawgyi: 0 }, 'U11 only at the start'],
    ['\u1015\u1000\u103C', { unicode: 0, zawgyi: 0 }, 'U11 not after the start'],
    ['\u103B\u1019', { unicode: 0, zawgyi: 1 }, 'Z04 at the start'],
    ['\u1000 \u103B\u1019', { unicode: 0, zawgyi: 1 }, 'Z03 after a space; Z04 only at the start'],
    ['\u1000\u1039', { unicode: 0, zawgyi: 1 }, 'Z17 at the end; Z05 needs a unit after U+1039'],
    ['\u1000\u1039\u1000\u1039', { unicode: 0, zawgyi: 1 }, 'Z17 only at the end; a consonant is not Z05'],
    ['\u1000\u1039\u1031', { unicode: 0, zawgyi: 2 }, 'Z05 and Z10 match the same units'],
    ['\u1000\u103B', { unicode: 1, zawgyi: 0 }, 'U12: the lookahead holds at the end'],
    ['\u1000\u103B\u1000', { unicode: 0, zawgyi: 0 }, 'U12: no match before a consonant'],
    ['\u102C\u1031\u1000', { unicode: 0, zawgyi: 2 }, 'Z13 and Z14 at one position'],
    ['\u1031\u103B\u1000', { unicode: 0, zawgyi: 1 }, 'Z08 starts at e; Z14 does not'],
    ['\u1031\u1031\u1000', { unicode: 0, zawgyi: 1 }, 'Z15, and no Z14: e is not in its first class'],
    ['\u103A\u1038', { unicode: 1, zawgyi: 0 }, 'U08'],
    ['\u103A\u102C', { unicode: 0, zawgyi: 1 }, 'Z02 starts at the same unit as U08'],
    ['\u1049\u1050\u1059\u105A', { unicode: 2, zawgyi: 0 }, 'U10: both ends of its range, not past them'],
    ['\u1064\u108B', { unicode: 0, zawgyi: 1 }, 'Z11: U+1064 only'],
    ['\u1000\u1039\u000B', { unicode: 0, zawgyi: 1 }, 'Z05 only: U+000B is not in the whitespace class'],
    ['\u1000\u1039\u00A0', { unicode: 0, zawgyi: 1 }, 'Z05 only: U+00A0 is not in the whitespace class'],
    ['\u000B\u103B\u1000', { unicode: 0, zawgyi: 0 }, 'no Z03 after U+000B']
  ];
  for (const [text, expected, what] of CASES) {
    it(what + ': ' + (units(text) || 'empty'), () => {
      assert.deepEqual(oracleEvidence(text), expected, 'the 2.x regexes');
      assert.deepEqual(countEvidence(text), expected);
    });
  }

  it('counts Z12 after each of the five whitespace units', () => {
    for (const space of [' ', '\t', '\n', '\r', '\f']) {
      const text = '\u1015\u1014\u1039' + space + '\u1015';
      assert.deepEqual(countEvidence(text), oracleEvidence(text), units(text));
      assert.equal(countEvidence(text).zawgyi, 2, units(text) + ': Z05 and Z12');
    }
  });

  it('reads UTF-16 units: a lone surrogate is a unit that is not a consonant', () => {
    const text = '\u1000\u1039\uD800';
    assert.deepEqual(countEvidence(text), oracleEvidence(text));
    assert.equal(countEvidence(text).zawgyi, 1);
  });

  it('returns a new plain object with the two counts', () => {
    const first = countEvidence('\u1000\u103B');
    assert.deepEqual(Object.keys(first), ['unicode', 'zawgyi']);
    assert.notEqual(countEvidence('\u1000\u103B'), first);
  });
});

describe('the table probes of test/fixtures/tables.json', () => {
  const probes = tableProbes();
  const rows = Object.keys(probes).filter((name) => name.startsWith('detector '));

  it('has one probe for each of the 29 rows', () => {
    assert.equal(rows.length, 29);
  });

  for (const name of rows) {
    it(name + ', with its edges, through the rule path on the core', () => {
      const entry = probes[name];
      for (const probe of [entry].concat(entry.edges || [])) {
        for (const fallback of ['unicode', 'zawgyi']) {
          const ours = fontDetectOnCore(probe.probe, fallback);
          assert.equal(ours, oracle.fontDetect(probe.probe, fallback), units(probe.probe) + ' against the oracle');
          assert.equal(ours, probe.expect[fallback], units(probe.probe) + ' against the recorded 2.x output');
        }
        assert.deepEqual(countEvidence(probe.probe), oracleEvidence(probe.probe), units(probe.probe));
      }
    });
  }
});

describe('decide', () => {
  it('picks the side with more evidence, as 2.x scoreWithRules does', () => {
    assert.equal(decide({ unicode: 2, zawgyi: 1 }, 'tie'), 'unicode');
    assert.equal(decide({ unicode: 1, zawgyi: 2 }, 'tie'), 'zawgyi');
    assert.equal(decide({ unicode: 0, zawgyi: 1 }, 'unicode'), 'zawgyi');
    for (const text of ['\u1000\u103B', '\u1031\u1000\u102C\u1039', '\u1000']) {
      for (const fallback of ['unicode', 'zawgyi', 'tie']) {
        assert.equal(decide(countEvidence(text), fallback), oracle.signatures.scoreWithRules(text, fallback));
      }
    }
  });

  it('returns the fallback of a tie as given, whatever it is', () => {
    const object = {};
    for (const fallback of [undefined, null, 0, '', 'en', object]) {
      assert.equal(decide({ unicode: 3, zawgyi: 3 }, fallback), fallback);
    }
    assert.equal(decide({ unicode: 0, zawgyi: 0 }, 'zawgyi'), 'zawgyi');
  });
});

describe('scoreByZawgyiModel: the injected myanmar-tools model', () => {
  const thresholds = [0.05, 0.95];

  it('compares the probability with each threshold strictly, as 2.x scoreWithMyanmarTools does', () => {
    const cases = [[0, 'unicode'], [0.0499, 'unicode'], [0.05, 'tie'], [0.5, 'tie'], [0.95, 'tie'],
      [0.9501, 'zawgyi'], [1, 'zawgyi'], [NaN, 'tie'], [-Infinity, 'unicode'], [Infinity, 'zawgyi']];
    for (const [probability, expected] of cases) {
      assert.equal(scoreByZawgyiModel('\u1000', stubModel(probability), thresholds, 'tie'), expected,
        'probability ' + probability);
    }
  });

  it('asks the model about the text it was given, once', () => {
    const model = stubModel(0.5);
    scoreByZawgyiModel('\u1000\u103B', model, thresholds, 'tie');
    assert.deepEqual(model.asked, ['\u1000\u103B']);
  });

  it('takes any thresholds, as 2.x does: [-1, -1] reads every probability as Zawgyi', () => {
    assert.equal(scoreByZawgyiModel('\u1000', stubModel(0), [-1, -1], 'tie'), 'zawgyi');
    assert.equal(scoreByZawgyiModel('\u1000', stubModel(0.5), [0.6, 0.9], 'tie'), 'unicode');
  });

  let ZawgyiDetector = null;
  try {
    ZawgyiDetector = require('myanmar-tools').ZawgyiDetector;
  } catch (error) {
    ZawgyiDetector = null;
  }
  it('works with myanmar-tools itself', { skip: !ZawgyiDetector && 'myanmar-tools is not installed' }, () => {
    const model = new ZawgyiDetector();
    for (const row of DETECTOR_SIGNATURES) {
      const probability = model.getZawgyiProbability(row.example);
      const expected = probability < 0.05 ? 'unicode' : probability > 0.95 ? 'zawgyi' : 'tie';
      assert.equal(scoreByZawgyiModel(row.example, model, thresholds, 'tie'), expected, row.id);
    }
    // A Zawgyi sentence and its Unicode spelling (the examples of rows Z04 and U04).
    assert.equal(scoreByZawgyiModel('\u103B\u1019\u1014\u1039\u1019\u102C', model, thresholds, 'tie'), 'zawgyi');
    assert.equal(scoreByZawgyiModel('\u1019\u103C\u1014\u103A\u1019\u102C', model, thresholds, 'tie'), 'unicode');
  });
});

describe('detectFont', () => {
  it('uses the rule evidence with no model, and falls back to zawgyi on a tie', () => {
    assert.equal(detectFont('\u1000'), 'zawgyi');
    assert.equal(detectFont('\u1000\u103B'), 'unicode');
    assert.equal(detectFont('\u103B\u1019\u1014\u1039\u1019\u102C'), 'zawgyi');
    assert.equal(detectFont('\u1000', { fallback: 'unicode' }), 'unicode');
    assert.equal(detectFont('\u1000', { fallback: null }), null, 'a fallback given is kept as it is');
    assert.equal(detectFont('\u1000', { zawgyiModel: null }), 'zawgyi');
  });

  it('is map-safe: an index or an array in the options place is no options', () => {
    assert.deepEqual(['\u1000', '\u1000\u103B'].map(detectFont), ['zawgyi', 'unicode']);
    assert.equal(detectFont('\u1000', ['unicode']), 'zawgyi');
  });

  it('asks the injected model, with the default thresholds or the given ones', () => {
    assert.equal(detectFont('\u1000', { zawgyiModel: stubModel(0.04) }), 'unicode');
    assert.equal(detectFont('\u1000', { zawgyiModel: stubModel(0.05) }), 'zawgyi', 'the fallback');
    assert.equal(detectFont('\u1000', { zawgyiModel: stubModel(0.05), fallback: 'tie' }), 'tie');
    assert.equal(detectFont('\u1000', { zawgyiModel: stubModel(0.96) }), 'zawgyi');
    assert.equal(detectFont('\u1000\u103B', { zawgyiModel: stubModel(1) }), 'zawgyi', 'the model, not the rules');
    assert.equal(detectFont('\u1000', { zawgyiModel: stubModel(0.5), thresholds: [0.6, 0.9] }), 'unicode');
  });

  it('reads its options and never writes or keeps them', () => {
    const options = Object.freeze({ zawgyiModel: Object.freeze(stubModel(1)), thresholds: Object.freeze([0.1, 0.2]) });
    assert.equal(detectFont('\u1000', options), 'zawgyi');
    assert.equal(detectFont('\u1000'), 'zawgyi');
    assert.equal(detectFont('\u1000\u103B'), 'unicode', 'the model of the last call is not kept');
  });
});

describe('detectEncoding', () => {
  it('is none for text with no unit of the Myanmar block, as 2.x fontDetect\'s gate', () => {
    for (const text of ['', 'abc', '\uAA60\uAA61', '\uA9E0', '\u0BB5']) {
      assert.deepEqual(detectEncoding(text), { encoding: 'none', unicode: 0, zawgyi: 0 }, units(text));
      assert.deepEqual(countEvidence(text), { unicode: 0, zawgyi: 0 }, units(text) + ': no row matches');
    }
  });

  it('is unknown on a tie, and gives the evidence', () => {
    assert.deepEqual(detectEncoding('\u1000'), { encoding: 'unknown', unicode: 0, zawgyi: 0 });
    assert.deepEqual(detectEncoding('\u1000\u103B\u1031\u1031'), { encoding: 'unknown', unicode: 1, zawgyi: 1 });
  });

  it('names the side with more evidence, with both counts', () => {
    for (const row of DETECTOR_SIGNATURES) {
      const evidence = oracleEvidence(row.example);
      const result = detectEncoding(row.example);
      assert.deepEqual(result, { encoding: decide(evidence, 'unknown'), unicode: evidence.unicode,
        zawgyi: evidence.zawgyi }, row.id);
    }
  });

  it('is 2.x fontDetect, with the fallback in place of none and unknown', () => {
    const texts = DETECTOR_SIGNATURES.map((row) => row.example).concat(['', 'abc', '\u1000', '\uAA60']);
    for (const text of texts) {
      const { encoding } = detectEncoding(text);
      const expected = encoding === 'none' ? 'en' : encoding === 'unknown' ? 'zawgyi' : encoding;
      assert.equal(expected, oracle.fontDetect(text, undefined), units(text));
    }
  });
});
