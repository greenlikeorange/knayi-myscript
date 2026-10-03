const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadWithInternals } = require('../../scripts/testing/internals');

// order (library/storageOrder.js) sorts a syllable's marks by rank, a mark's index in MARK_ORDER, and tells which
// marks a syllable has from one number with the bit 1 << rank of each. The ranks it names and the bits it tests
// are written out as numbers. This checks each against MARK_ORDER, so that a change to the table cannot leave
// them behind.

const BITS = {
  MEDIAL_YA_BIT: '\u103B',
  MEDIAL_BITS: '\u103B\u103C\u103D\u103E', // medial ya, ra, wa and ha
  MEDIAL_HA_BIT: '\u103E',
  E_AA_BITS: '\u1031\u102B\u102C', // e, tall aa, aa
  I_BIT: '\u102D\u102E', // i, ii
  LOWER_VOWEL_BIT: '\u102F\u1030', // u, uu
  AA_BIT: '\u102B\u102C', // tall aa, aa
  DOT_BELOW_BIT: '\u1037',
  ASAT_BIT: '\u103A',
  VISARGA_BIT: '\u1038'
};

// Each named rank, and a mark of that rank.
const RANKS = {
  LAST_MEDIAL: '\u103E', // medial ha
  FIRST_VOWEL: '\u102D', // i
  LOWER_RANK: '\u102F', // u
  AI_ANUSVARA: '\u1032' // ai
};

const so = loadWithInternals('storageOrder.js', ['MARK_ORDER', 'rank'].concat(Object.keys(BITS), Object.keys(RANKS)))
  .__internals;

function hex(marks) {
  return marks.split('').sort().map((mark) => 'U+' + mark.charCodeAt(0).toString(16).toUpperCase()).join(' ');
}

describe('mark ranks in storageOrder.js', () => {
  it('names the MARK_ORDER index of each rank it uses', () => {
    for (const [name, mark] of Object.entries(RANKS)) {
      assert.equal(so[name], so.rank(mark), name);
      assert.ok(so.MARK_ORDER[so[name]].indexOf(mark) >= 0, name);
    }
  });

  // A bit stands for the marks of its rank, so a rank must hold only marks the bit is meant for: aa and tall aa
  // share one, and medial ya has one of its own. A mark outside MARK_ORDER, such as U+1033, sorts after every
  // rank, and has none of these bits.
  it('tests the bits of exactly the marks each mask names', () => {
    const marks = so.MARK_ORDER.join('');
    for (const [name, named] of Object.entries(BITS)) {
      let expected = 0;
      for (const mark of named) expected |= 1 << so.rank(mark);
      assert.equal(so[name], expected, name);
      const covered = marks.split('').filter((mark) => so[name] & (1 << so.rank(mark))).join('');
      assert.equal(hex(covered), hex(named), name);
      assert.equal(so[name] & (1 << so.rank('\u1033')), 0, name);
    }
  });
});
