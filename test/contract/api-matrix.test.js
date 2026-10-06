const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const matrix = require('../../scripts/contract/matrix');

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
    it(name + ' gives the recorded result, error class and console output in every cell', async (t) => {
      const build = await matrix.loadBuild(name);
      const result = matrix.checkBuild(snapshot, build);
      assert.ok(result.ok, result.text);
      t.diagnostic(result.text);
    });
  }

  it('gives the same cells whatever order they run in', async () => {
    const build = await matrix.loadBuild('main.js');
    const comparison = matrix.compareCells(matrix.runCells(build), matrix.runCells(build, { reverse: true }));
    assert.ok(!comparison.changed.length, matrix.formatReport('main.js run last to first', comparison));
  });
});
