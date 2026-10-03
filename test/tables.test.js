const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const knayi = require('../main');
const { buildRows } = require('../scripts/testing/rows');
const fixture = require('./fixtures/tables.json');

// One case per row of the library's tables: every Zawgyi and Win glyph and look-alike sequence, every Unicode
// to Zawgyi rule, detector signature, break rule, spellingFix collapse rule and normalize typo rule. Each case
// is a synthetic probe that exercises its row (the glyph is read, the rule changes the text at its turn inside
// the public call, the signature decides the detection), and the output the public API gave for it when the
// case was written. A refactor must keep every output; a pull request that changes output on purpose rewrites
// the cases with `node scripts/testing/table-cases.js --write` and shows the diff.

const rows = buildRows(knayi);
const cases = fixture.cases;
const UPDATE = 'node scripts/testing/table-cases.js --write';

const tables = [];
for (const row of rows) {
  if (tables.indexOf(row.table) === -1) tables.push(row.table);
}

describe('table rows', () => {
  for (const table of tables) {
    describe(table, () => {
      for (const row of rows.filter((r) => r.table === table)) {
        it(row.id, () => {
          const entry = cases[row.id];
          assert.ok(entry, 'no case for ' + row.id + ' (' + row.label + '); run ' + UPDATE);
          assert.ok(row.exercises(entry.probe), 'the probe ' + JSON.stringify(entry.probe) + ' no longer exercises ' +
            row.id + ' (' + row.label + ')');
          if (row.reach) {
            assert.equal(row.reach(entry.probe), entry.reach, row.id + ' fires ' +
              (entry.reach === 'call' ? 'inside the public call' : 'by pattern only') + ' for its probe');
          }
          assert.deepEqual(row.run(entry.probe), entry.expect);
        });
      }
    });
  }

  it('has no case for a row that is gone', () => {
    const ids = new Set(rows.map((row) => row.id));
    const stale = Object.keys(cases).filter((id) => !ids.has(id));
    assert.deepEqual(stale, [], 'cases without a row; run ' + UPDATE);
  });

  it('reports row reach', (t) => {
    for (const table of tables) {
      const inTable = rows.filter((row) => row.table === table);
      const pinned = inTable.filter((row) => cases[row.id] && row.exercises(cases[row.id].probe));
      const inCall = pinned.filter((row) => !row.reach || row.reach(cases[row.id].probe) === 'call');
      t.diagnostic(table + ': ' + pinned.length + '/' + inTable.length + ' rows pinned, ' + inCall.length +
        ' fire inside the public call');
      assert.equal(pinned.length, inTable.length);
    }
  });
});
