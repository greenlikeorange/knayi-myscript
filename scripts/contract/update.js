'use strict';
// Rewrites test/contract/api-matrix.json from main.js at the 2.x reference, scripts/reference/main.js:
// `npm run matrix:update`. Run it when a port of the 2.x line moves the reference (docs/next/DESIGN.md §8).
// `--out <file>` writes the snapshot to another file instead, for comparing runtimes or checkouts.
//
// It also runs compat and the 3.0 builds that hold it (a fresh build in a temporary directory, or KNAYI_DIST), and
// records the cells where compat differs from main.js as known build differences. A difference that
// scripts/contract/matrix.js does not explain stops the update: either a KNAYI_DIST build is stale (rebuild it) or
// the builds really disagree, which needs a reason in KNOWN_BUILD_DIFFERENCES. The builds record none of their own:
// each must differ exactly where compat does (SHARES_RECORDED_DIFFERENCES).

const fs = require('fs');
const path = require('path');
const matrix = require('./matrix');

async function main() {
  const outIndex = process.argv.indexOf('--out');
  const out = outIndex === -1
    ? matrix.SNAPSHOT
    : path.resolve(process.argv[outIndex + 1] || fail('--out needs a file name'));
  const mainBuild = await matrix.loadBuild('main.js');
  const cells = matrix.runCells(mainBuild);

  // Every cell must come out the same whatever ran before it.
  const reversed = matrix.runCells(mainBuild, { reverse: true });
  const orderCheck = matrix.compareCells(cells, reversed);
  if (orderCheck.changed.length) {
    fail('Cells depend on the order they run in, so the matrix would not be repeatable.\n' +
      matrix.formatReport('main.js run last to first', orderCheck));
  }

  const known = [];
  for (const name of matrix.BUILDS) {
    if (name === 'main.js') continue;
    const build = await matrix.loadBuild(name);
    const differences = matrix.buildDifferences(cells, name, matrix.runCells(build));
    if (differences.unexplained.length || differences.missing.length || differences.extra.length) {
      fail(`${build.label} differs from main.js in cells that no known build difference explains. ` +
        'If KNAYI_DIST points at a stale build, rebuild it.\n' +
        matrix.formatReport(build.label + ' against main.js', {
          total: cells.length,
          changed: differences.unexplained,
          missing: differences.missing,
          extra: differences.extra
        }));
    }
    const sharedWith = matrix.SHARES_RECORDED_DIFFERENCES[name];
    if (sharedWith) {
      checkShared(build, sharedWith, differences.known, known.filter((entry) => entry.build === sharedWith));
      continue;
    }
    known.push.apply(known, differences.known);
  }

  if (fs.existsSync(matrix.SNAPSHOT)) {
    const previous = matrix.readSnapshot();
    const comparison = matrix.compareCells(previous.cells, cells);
    const changes = comparison.changed.length + comparison.missing.length + comparison.extra.length;
    if (changes) console.log(matrix.formatReport('main.js against the previous snapshot', comparison) + '\n');
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, matrix.formatSnapshot(cells, known));
  const byBuild = {};
  for (const entry of known) byBuild[entry.build] = (byBuild[entry.build] || 0) + 1;
  const shown = path.relative(process.cwd(), out);
  console.log(`Wrote ${shown.indexOf('..') === 0 ? out : shown}: ${matrix.formatCount(cells.length)} cells ` +
    `from main.js on ${matrix.runtimeName()}; known build differences: ` +
    (known.length ? Object.keys(byBuild).map((name) => name + ' ' + byBuild[name]).join(', ') : 'none') + '.');
}

// A build that shares another build's recorded differences (matrix.SHARES_RECORDED_DIFFERENCES) records none of its
// own, so it must differ from main.js in exactly the cells that build does, the same way. That build comes first in
// matrix.BUILDS, so its differences are already in `sharedKnown`.
function checkShared(build, sharedWith, ownKnown, sharedKnown) {
  const unshared = matrix.unsharedDifferences(ownKnown, sharedKnown);
  if (unshared.length) {
    fail(`${build.label} shares the known build differences of ${sharedWith}, but differs from them in ` +
      `${unshared.length} cells: ${unshared.slice(0, 5).join('; ')}${unshared.length > 5 ? '; ...' : ''}`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
