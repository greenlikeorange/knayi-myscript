const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const matrix = require('../../scripts/contract/matrix');
const { MATRIX_CHANGES, pendingPort } = require('../../scripts/testing/pending-port');

// The API contract matrix (scripts/contract/matrix.js): every public function and call form on fixed synthetic
// probes, with what each call returns, throws and writes to the console. A failure lists the cells that changed.
// If the change is deliberate, run `npm run matrix:update` and commit test/contract/api-matrix.json with it.
// scripts/bun-matrix.js runs the same check under Bun.

describe('API contract matrix', () => {
  const snapshot = matrix.readSnapshot();

  it('has one recorded cell for every cell the matrix defines', () => {
    assert.equal(snapshot.cells.length, snapshot.cellCount);
    assert.deepEqual(snapshot.cells.map((cell) => cell.id), matrix.defineCells().map((cell) => cell.id));
  });

  for (const name of matrix.BUILDS) {
    const check = async (t) => {
      const build = await matrix.loadBuild(name);
      const result = matrix.checkBuild(snapshot, build);
      assert.ok(result.ok, result.text);
      t.diagnostic(result.text);
    };
    // The cells are those of main.js at the 2.x reference, 8923365. compat and the builds that hold it give every one
    // of them since the port of 2.11, but the known build difference. After a later merge of the 2.x line they wait
    // for the ports of the changes that touch cells (MATRIX_CHANGES, scripts/testing/pending-port.js).
    it(name + ' gives the recorded result, error class and console output in every cell',
      name === 'main.js' ? check : pendingPort(MATRIX_CHANGES, check));
  }

  // compat holds the 2.x option store and the myanmar-tools loader as module state, as main.js does, so it is checked
  // for state left behind too (docs/next/DESIGN.md §6.3).
  for (const name of ['main.js', 'compat']) {
    it(name + ' gives the same cells whatever order they run in', async () => {
      const build = await matrix.loadBuild(name);
      const comparison = matrix.compareCells(matrix.runCells(build), matrix.runCells(build, { reverse: true }));
      assert.ok(!comparison.changed.length, matrix.formatReport(name + ' run last to first', comparison));
    });
  }
});
