// Checks the gzip size of each 3.0 dist file against its budget, and fails above it.
//
//   node scripts/check-size.js [dir] [--modules]
//
// dir holds the dist files to measure (default: KNAYI_DIST, or a fresh build of this checkout in a temporary
// directory). --modules also lists each module's share of each file, from the esbuild metafile. The sizes of an
// import of each package entry, and the tree-shaking check, are scripts/next/size.mjs's.
//
// Sizes are Node's zlib at level 9 (`zlib.gzipSync(file, { level: 9 })`), as 2.x's baseline was measured. The gzip
// command line gives a slightly different number for the same file (it may store the file name, and its deflate
// may differ), so compare only numbers from this script.

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { FILES, builtDist, configs } = require('./build');

// The budgets of 3.0, proposed with its packaging and still to be confirmed by the maintainer (docs/next/DESIGN.md
// §6.4): `measured` is the size when the builds were first made from src/ (3.0.0-next.0's sources), and `limit`
// about 5% above it, rounded up to 100 B, so the 2.x ports, the stream entry and Extended-C fit while a mistake
// such as a table pulled in twice does not. 2.x's min.js was 9,830 B at 2.10, with a limit of 10,854 B; the 3.0
// script build, knayi.min.js, holds both APIs (its budget is the one the script build had when it was named
// knayi-myscript.min.js), and knayi-myscript.min.js now holds the 2.x API alone, as 2.x's did, measured when it got
// that content back (docs/next/DESIGN.md §14.3).
const BUDGETS = {
  'knayi-myscript.min.mjs': { measured: 20890, limit: 22000 },
  'knayi-myscript-compat.min.mjs': { measured: 17408, limit: 18300 },
  'knayi.min.js': { measured: 23782, limit: 25000 },
  'knayi-myscript.min.js': { measured: 17778, limit: 18700 }
};

const args = process.argv.slice(2);
const dir = path.resolve(args.find((arg) => !arg.startsWith('--')) || builtDist());

const n = (value) => value.toLocaleString('en-US') + ' B';
const signed = (value) => (value > 0 ? '+' : value < 0 ? '-' : '±') + n(Math.abs(value));

// Each module's share of one file: the file rebuilt in memory with a metafile; bytesInOutput is before gzip.
function moduleShares(file) {
  const result = esbuild.buildSync(Object.assign({}, configs(dir)[file], { write: false, metafile: true }));
  const output = Object.values(result.metafile.outputs)[0];
  return Object.entries(output.inputs)
    .map(([name, { bytesInOutput }]) => [name, bytesInOutput, 100 * bytesInOutput / output.bytes])
    .sort((a, b) => b[1] - a[1]);
}

let over = 0;
for (const file of FILES) {
  const bytes = fs.readFileSync(path.join(dir, file));
  const size = zlib.gzipSync(bytes, { level: 9 }).length;
  const { measured, limit } = BUDGETS[file];
  console.log(file + ': ' + n(size) + ' gzip (level 9), ' + n(bytes.length) + ' minified. ' + signed(size - measured) +
    ' against ' + n(measured) + '; limit ' + n(limit) + (size <= limit ? ', ' + n(limit - size) + ' to spare.' : '.'));
  if (args.includes('--modules')) {
    for (const [name, inOutput, share] of moduleShares(file)) {
      console.log('  ' + share.toFixed(1).padStart(5) + '%  ' + n(inOutput).padStart(9) + '  ' + name);
    }
  }
  if (size > limit) {
    console.error(file + ' is ' + n(size - limit) + ' over its limit. Make the change smaller, or agree a new budget ' +
      'with the maintainer and change it here and in docs/next/DESIGN.md §6.4.');
    over++;
  }
}
if (over) process.exitCode = 1;
