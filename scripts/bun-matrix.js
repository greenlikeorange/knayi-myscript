'use strict';
// Checks main.js at the 2.x reference, compat and the 3.0 builds that hold it (the compat module build, and the
// script build's knayi.compat in a vm) against the API contract matrix under the runtime that runs this file.
// `npm run test:bun` runs it with Bun; under Node, test/contract/api-matrix.test.js does the same.
const matrix = require('./contract/matrix');

async function main() {
  const snapshot = matrix.readSnapshot();
  let failed = false;
  for (const name of matrix.BUILDS) {
    const build = await matrix.loadBuild(name);
    const result = matrix.checkBuild(snapshot, build);
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
