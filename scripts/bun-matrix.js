'use strict';
// Checks main.js, the ES module build and min.js (in a vm) against the API contract matrix under the runtime that
// runs this file. `npm run test:bun` runs it with Bun; under Node, test/contract/api-matrix.test.js does the same.
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

  const mainBuild = await matrix.loadBuild('main.js');
  const reversed = matrix.compareCells(matrix.runCells(mainBuild), matrix.runCells(mainBuild, { reverse: true }));
  if (reversed.changed.length) {
    console.error(matrix.formatReport('main.js run last to first', reversed));
    failed = true;
  } else {
    console.log('main.js: the cells do not depend on the order they run in.');
  }

  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
