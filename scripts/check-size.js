// Checks the gzip size of knayi-myscript.min.js against the 2.x bundle budget: at most 1,024 B over the
// 2.10 build. Prints the size and the change from 2.10, and fails above the limit.
//
//   node scripts/check-size.js [dir] [--modules]
//
// dir holds the dist files to measure (default: KNAYI_DIST, or a fresh build of this checkout in a temporary
// directory). --modules also lists each module's share of the minified file, from the esbuild metafile.
//
// Sizes are Node's zlib at level 9 (`zlib.gzipSync(file, { level: 9 })`), which is how the 2.10 baseline was
// measured. The gzip command line gives a slightly different number for the same file (it may store the file
// name, and its deflate may differ), so compare only numbers from this script.

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { builtDist, configs } = require('./build');

// knayi-myscript.min.js at 2.10.0 plus the Shan zero fix (f6f3c7b): 29,051 B, 9,830 B with gzip level 9.
const BASELINE = 9830;
const BUDGET = 1024;
const LIMIT = BASELINE + BUDGET;

const args = process.argv.slice(2);
const dir = args.find((arg) => !arg.startsWith('--')) || builtDist();
const file = path.join(path.resolve(dir), 'knayi-myscript.min.js');

const min = fs.readFileSync(file);
const size = zlib.gzipSync(min, { level: 9 }).length;
const delta = size - BASELINE;

const n = (value) => value.toLocaleString('en-US') + ' B';
const signed = (value) => (value > 0 ? '+' : value < 0 ? '-' : '±') + n(Math.abs(value));

console.log(
  'knayi-myscript.min.js: ' + n(size) + ' gzip (level 9), ' + n(min.length) + ' minified. ' +
  signed(delta) + ' against 2.10 (' + n(BASELINE) + '); limit ' + n(LIMIT) +
  (size <= LIMIT ? ', ' + n(LIMIT - size) + ' to spare.' : '.')
);

if (args.includes('--modules')) {
  // Rebuild the min.js in memory with a metafile; bytesInOutput is each module's share before gzip.
  const result = esbuild.buildSync(Object.assign({}, configs(path.dirname(file)).min, { write: false, metafile: true }));
  const output = Object.values(result.metafile.outputs).find((entry) => entry.entryPoint);
  const inputs = Object.entries(output.inputs).sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput);
  for (const [name, { bytesInOutput }] of inputs) {
    const share = (100 * bytesInOutput / output.bytes).toFixed(1).padStart(5);
    console.log('  ' + share + '%  ' + n(bytesInOutput).padStart(9) + '  ' + name);
  }
}

if (size > LIMIT) {
  console.error(
    'knayi-myscript.min.js is ' + n(size - LIMIT) + ' over the limit. The 2.x budget allows ' + n(BUDGET) +
    ' of gzip growth over 2.10 in total; make the change smaller, or agree a new budget with the maintainer.'
  );
  process.exitCode = 1;
}
