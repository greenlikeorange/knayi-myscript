'use strict';
// Checks main.js at the 2.x reference, compat and the 3.0 builds that hold it (the compat module build, and the
// script build's knayi.compat in a vm) against the API contract matrix under the runtime that runs this file.
// `npm run test:bun` runs it with Bun; under Node, test/contract/api-matrix.test.js does the same.
//
// The cells are those of main.js at the 2.x reference. compat and its builds give them once compat has the 2.x
// changes that touch cells (scripts/testing/pending-port.js, MATRIX_CHANGES); until then each must differ, as
// api-matrix.test.js expects, and passing is the failure that says the port is done.
const matrix = require('./contract/matrix');
const { MATRIX_CHANGES, pendingPortNow } = require('./testing/pending-port');

async function main() {
  const snapshot = matrix.readSnapshot();
  let failed = false;
  for (const name of matrix.BUILDS) {
    const build = await matrix.loadBuild(name);
    const result = matrix.checkBuild(snapshot, build);
    if (name !== 'main.js') {
      try {
        pendingPortNow(MATRIX_CHANGES, () => {
          if (!result.ok) throw new Error(result.text);
        });
        console.log(name + ': ' + (result.ok ? result.text
          : 'differs from the matrix until the 2.x port, as expected'));
      } catch (error) {
        console.error(name + ': ' + error.message);
        failed = true;
      }
      continue;
    }
    if (result.ok) {
      console.log(result.text);
    } else {
      console.error(result.text);
      failed = true;
    }
  }

  for (const name of ['main.js', 'compat']) {
    const build = await matrix.loadBuild(name);
    const reversed = matrix.compareCells(matrix.runCells(build), matrix.runCells(build, { reverse: true }));
    if (reversed.changed.length) {
      console.error(matrix.formatReport(name + ' run last to first', reversed));
      failed = true;
    } else {
      console.log(name + ': the cells do not depend on the order they run in.');
    }
  }

  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
