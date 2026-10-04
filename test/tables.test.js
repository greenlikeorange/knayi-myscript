const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
// The 2.x API: compat, on the 3.0 core.
const knayi = require('../src/compat/index.js').default;
const { buildRows } = require('../scripts/testing/rows');
const { pendingPort } = require('../scripts/testing/pending-port');
const fixture = require('./fixtures/tables.json');

// One case per row of the library's tables: every Zawgyi and Win glyph and look-alike sequence, every Unicode
// to Zawgyi rule, detector signature, break rule, spellingFix collapse rule and normalize typo rule. Each case
// is a synthetic probe that exercises its row (the glyph is read, the rule changes the text at its turn inside
// the public call, the signature decides the detection), and the output the public API gave for it when the
// case was written. A row with a pattern also has edge probes, one for each branch of the pattern that its
// main probe does not take: the ends of each class range and the code points just outside them, each class
// member and each alternative (scripts/testing/branches.js). A refactor must keep every output; a pull request
// that changes output on purpose rewrites the cases with `node scripts/testing/table-cases.js --write` and
// shows the diff.

const rows = buildRows(knayi);
const cases = fixture.cases;
const UPDATE = 'node scripts/testing/table-cases.js --write';

// The rows and cases are those of the 2.x reference (scripts/testing/rows.js). A row of a 2.x change compat does not
// have yet waits for its port (scripts/testing/pending-port.js).
const PENDING_ROWS = { 'unicode-to-zawgyi oneTime 41': '05de555' };

const tables = [];
for (const row of rows) {
  if (tables.indexOf(row.table) === -1) tables.push(row.table);
}

describe('table rows', () => {
  for (const table of tables) {
    describe(table, () => {
      for (const row of rows.filter((r) => r.table === table)) {
        const test = () => {
          const entry = cases[row.id];
          assert.ok(entry, 'no case for ' + row.id + ' (' + row.label + '); run ' + UPDATE);
          assert.ok(row.exercises(entry.probe), 'the probe ' + JSON.stringify(entry.probe) + ' no longer exercises ' +
            row.id + ' (' + row.label + ')');
          if (row.reach) {
            assert.equal(row.reach(entry.probe), entry.reach, row.id + ' fires ' +
              (entry.reach === 'call' ? 'inside the public call' : 'by pattern only') + ' for its probe');
          }
          assert.deepEqual(row.run(entry.probe), entry.expect);
          for (const edge of entry.edges || []) {
            assert.deepEqual(row.run(edge.probe), edge.expect, 'edge probe ' + JSON.stringify(edge.probe) + ' (' +
              edge.branches.join('; ') + ')');
          }
        };
        it(row.id, PENDING_ROWS[row.id] ? pendingPort(PENDING_ROWS[row.id], test) : test);
      }
    });
  }

  it('has no case for a row that is gone', () => {
    const ids = new Set(rows.map((row) => row.id));
    const stale = Object.keys(cases).filter((id) => !ids.has(id));
    assert.deepEqual(stale, [], 'cases without a row; run ' + UPDATE);
  });

  // Only the Unicode to Zawgyi rows measure whether their rule fires inside the public call (reach); the other
  // rows are exercised at their turn by construction, and are reported as pinned.
  it('reports row reach', (t) => {
    for (const table of tables) {
      const inTable = rows.filter((row) => row.table === table);
      const pinned = inTable.filter((row) => cases[row.id] && row.exercises(cases[row.id].probe));
      const measured = inTable.filter((row) => row.reach);
      const inCall = pinned.filter((row) => row.reach && row.reach(cases[row.id].probe) === 'call');
      const entries = inTable.map((row) => cases[row.id] || {});
      const count = (key) => entries.reduce((n, e) => n + (e[key] || []).length, 0);
      const branches = count('covers') + entries.reduce((n, e) => n + (e.edges || []).reduce((m, x) => m + x.branches.length, 0), 0);
      t.diagnostic(table + ': ' + pinned.length + '/' + inTable.length + ' rows pinned' +
        (measured.length ? ', ' + inCall.length + ' fire inside the public call' : '') +
        (branches || count('unreached') ? '; ' + branches + ' pattern branches pinned by ' + count('edges') +
          ' edge probes and the main ones, ' + count('unreached') + ' unreached' : ''));
      assert.equal(pinned.length, inTable.length);
    }
  });
});
