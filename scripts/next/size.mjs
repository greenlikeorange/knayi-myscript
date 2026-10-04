// The size of an import of each entry of the exports map, and of a normalize-only import, against 3.0's budgets,
// and the tree-shaking check (docs/next/DESIGN.md §2.4, §6.4).
//
//   node scripts/next/size.mjs
//
// Each bundle is measured as scripts/check-size.js measures the dist files: esbuild IIFE at ES2015, minified, and
// gzip by Node's zlib at level 9. They are what a user's bundler adds for an import:
// - api: `import * from 'knayi-myscript'`, the 3.0 API (src/index.js);
// - compat: 'knayi-myscript/compat', the 2.x API on the core (src/compat/index.js);
// - stream: 'knayi-myscript/stream', every stream of 3.0 (src/stream.js, DESIGN.md §12);
// - api normalize-only: `import { normalize } from 'knayi-myscript'`, as a 3.0 user who needs only normalize;
// - stream normalizer-only: `import { createNormalizer } from 'knayi-myscript/stream'`;
// - normalize-only: an entry that imports only the core's normalizeText, the floor under both.
//
// Prints each bundle's size against its budget and each module's share, from esbuild's metafile, and fails above a
// budget. Fails too when a module that normalize never needs (the fonts, the font reader and stages, detection,
// segmentation, Unicode to Zawgyi, compat and spec, and the other functions of the 3.0 API) puts a byte into any of
// the three normalize-only bundles. CI's `checks` job runs this on every pull request.

import esbuild from 'esbuild';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// 3.0's budgets, proposed with its packaging and still to be confirmed by the maintainer (DESIGN.md §6.4):
// `measured` is the size when the exports map was added, and `limit` about 5% above it, rounded up to 100 B, as for
// the dist files (scripts/check-size.js). Before 3.0 compat had the 2.x limit of 10,854 B and the normalize-only
// bundle 4,850 B; both were missed once the core grew its gates and the 3.0 API's edit logs (§7.11, §11.3), so these
// replace them. The two stream budgets were set the same way when the streams were merged with the packaging (§14).
export const BUDGETS = {
  api: { measured: 21109, limit: 22200 },
  compat: { measured: 17624, limit: 18600 },
  stream: { measured: 16082, limit: 16900 },
  'api normalize-only': { measured: 9158, limit: 9700 },
  'stream normalizer-only': { measured: 10315, limit: 10900 },
  'normalize-only': { measured: 6804, limit: 7200 }
};

// Modules that must contribute 0 bytes to the normalize-only bundles (§2.4), as paths relative to the root.
const NOT_IN_NORMALIZE = [
  /^src\/fonts\//, /^src\/engine\/fontReader\.js$/, /^src\/stages\/fonts\.js$/, /^src\/rules\/detect\.js$/,
  /^src\/rules\/segment\.js$/, /^src\/rules\/unicodeToZawgyi\.js$/, /^src\/compat\//, /^src\/spec\//,
  /^src\/api\/(explain|encoding|convert|segment)\.js$/
];

// The bundles that import only normalize.
const NORMALIZE_ONLY = ['normalize-only', 'api normalize-only', 'stream normalizer-only'];

const ENTRIES = {
  api: { entryPoints: [path.join(ROOT, 'src', 'index.js')] },
  compat: { entryPoints: [path.join(ROOT, 'src', 'compat', 'index.js')] },
  stream: { entryPoints: [path.join(ROOT, 'src', 'stream.js')] },
  'api normalize-only': {
    stdin: {
      contents: "export { normalize } from './src/index.js';\n",
      resolveDir: ROOT,
      sourcefile: 'api-normalize-only.js'
    }
  },
  'stream normalizer-only': {
    stdin: {
      contents: "export { createNormalizer } from './src/stream.js';\n",
      resolveDir: ROOT,
      sourcefile: 'stream-normalizer-only.js'
    }
  },
  'normalize-only': {
    stdin: {
      contents: "export { normalizeText } from './src/stages/normalize.js';\n",
      resolveDir: ROOT,
      sourcefile: 'normalize-only.js'
    }
  }
};

// Builds one bundle in memory: { name, minified, gzip, modules: [[path, bytes]] }, modules by bytes, largest first.
export function measure(name) {
  const result = esbuild.buildSync(Object.assign({
    absWorkingDir: ROOT,
    bundle: true,
    format: 'iife',
    globalName: 'knayi',
    platform: 'browser',
    target: 'es2015',
    minify: true,
    legalComments: 'none',
    logLevel: 'silent',
    write: false,
    outfile: path.join(ROOT, name.replace(/ /g, '-') + '.min.js'),
    metafile: true
  }, ENTRIES[name]));
  const code = result.outputFiles[0].contents;
  const output = Object.values(result.metafile.outputs)[0];
  const modules = Object.entries(output.inputs)
    .map(([file, { bytesInOutput }]) => [file, bytesInOutput])
    .sort((a, b) => b[1] - a[1]);
  return { name, minified: code.length, gzip: zlib.gzipSync(code, { level: 9 }).length, modules };
}

// The modules that put bytes into a normalize-only bundle but must not: [[path, bytes]].
export function normalizeOnlyLeaks(report = measure('normalize-only')) {
  return report.modules.filter(([file, bytes]) => bytes > 0 && NOT_IN_NORMALIZE.some((re) => re.test(file)));
}

function bytes(value) {
  return value.toLocaleString('en-US') + ' B';
}

function signed(value) {
  return (value > 0 ? '+' : value < 0 ? '-' : '±') + bytes(Math.abs(value));
}

// Prints one bundle and returns whether it is over its budget.
function print(report) {
  const budget = BUDGETS[report.name];
  const over = budget !== null && report.gzip > budget.limit;
  const goal = budget === null ? 'no budget yet.'
    : signed(report.gzip - budget.measured) + ' against ' + bytes(budget.measured) + '; limit ' + bytes(budget.limit) +
      (over ? ', ' + bytes(report.gzip - budget.limit) + ' over.' : ', ' + bytes(budget.limit - report.gzip) + ' to spare.');
  console.log(report.name + ': ' + bytes(report.gzip) + ' gzip (level 9), ' + bytes(report.minified) + ' minified. ' +
    goal);
  for (const [file, size] of report.modules) {
    const share = report.minified ? (100 * size / report.minified).toFixed(1) : '0.0';
    console.log('  ' + share.padStart(5) + '%  ' + bytes(size).padStart(9) + '  ' + file);
  }
  return over;
}

function main() {
  let failed = false;
  for (const name of Object.keys(ENTRIES)) {
    const report = measure(name);
    if (print(report)) {
      console.error(name + ' is over its budget. Make the change smaller, or agree a new budget with the maintainer ' +
        'and change it here and in docs/next/DESIGN.md §6.4.');
      failed = true;
    }
    if (NORMALIZE_ONLY.indexOf(name) !== -1) {
      const leaks = normalizeOnlyLeaks(report);
      for (const [file, size] of leaks) {
        console.error('tree-shaking: ' + file + ' puts ' + bytes(size) + ' into the ' + name + ' bundle ' +
          '(DESIGN.md §2.4: build its top-level values with /* @__PURE__ */ builders)');
      }
      if (leaks.length) failed = true;
    }
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
