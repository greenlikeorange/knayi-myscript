// Bundle sizes of the 3.0 core on next, and its tree-shaking check (docs/next/DESIGN.md §2.4, §6.4).
//
//   node scripts/next/size.mjs [--gate]
//
// Two bundles, measured as scripts/check-size.js measures the 2.x build: esbuild IIFE at ES2015, minified, and
// gzip by Node's zlib at level 9.
// - compat: src/compat/index.js, the 2.x API on the core.
// - normalize-only: an entry that imports only normalizeText, as a 3.0 user who imports only normalize does.
//
// Prints each bundle's size against its target and each module's share, from esbuild's metafile. Fails when a
// module that normalize never needs (the fonts, the font reader and stages, detection, segmentation, Unicode to
// Zawgyi, compat and spec) puts a byte into the normalize-only bundle. The byte targets bind with --gate, at the
// acceptance gate (§6.3); before that they are reported. CI's `checks` job runs this on every pull request.

import esbuild from 'esbuild';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Targets before the port of the 2.x linear NFC helper (§6.4, §8). The port moves them to 10,854 B and 4,850 B.
export const TARGETS = { compat: 10854, 'normalize-only': 4300 };

// Modules that must contribute 0 bytes to the normalize-only bundle (§2.4), as paths relative to the root.
const NOT_IN_NORMALIZE = [
  /^src\/fonts\//, /^src\/engine\/fontReader\.js$/, /^src\/engine\/fontStages\.js$/, /^src\/detect\.js$/,
  /^src\/segment\.js$/, /^src\/unicodeToZawgyi\.js$/, /^src\/compat\//, /^src\/spec\//
];

const ENTRIES = {
  compat: { entryPoints: [path.join(ROOT, 'src', 'compat', 'index.js')] },
  'normalize-only': {
    stdin: {
      contents: "export { normalizeText } from './src/engine/normalizeStages.js';\n",
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
    outfile: path.join(ROOT, name + '.min.js'),
    metafile: true
  }, ENTRIES[name]));
  const code = result.outputFiles[0].contents;
  const output = Object.values(result.metafile.outputs)[0];
  const modules = Object.entries(output.inputs)
    .map(([file, { bytesInOutput }]) => [file, bytesInOutput])
    .sort((a, b) => b[1] - a[1]);
  return { name, minified: code.length, gzip: zlib.gzipSync(code, { level: 9 }).length, modules };
}

// The modules that put bytes into the normalize-only bundle but must not: [[path, bytes]].
export function normalizeOnlyLeaks(report = measure('normalize-only')) {
  return report.modules.filter(([file, bytes]) => bytes > 0 && NOT_IN_NORMALIZE.some((re) => re.test(file)));
}

function bytes(value) {
  return value.toLocaleString('en-US') + ' B';
}

function print(report) {
  const target = TARGETS[report.name];
  const over = report.gzip > target;
  console.log(report.name + ': ' + bytes(report.gzip) + ' gzip (level 9), ' + bytes(report.minified) +
    ' minified; target ' + bytes(target) + (over ? ', ' + bytes(report.gzip - target) + ' over.' : '.'));
  for (const [file, size] of report.modules) {
    const share = report.minified ? (100 * size / report.minified).toFixed(1) : '0.0';
    console.log('  ' + share.padStart(5) + '%  ' + bytes(size).padStart(9) + '  ' + file);
  }
  return over;
}

function main(args) {
  const gate = args.includes('--gate');
  let failed = false;
  for (const name of Object.keys(ENTRIES)) {
    const report = measure(name);
    const over = print(report);
    if (over && gate) failed = true;
    if (name === 'normalize-only') {
      const leaks = normalizeOnlyLeaks(report);
      for (const [file, size] of leaks) {
        console.error('tree-shaking: ' + file + ' puts ' + bytes(size) + ' into the normalize-only bundle ' +
          '(DESIGN.md §2.4: build its top-level values with /* @__PURE__ */ builders)');
      }
      if (leaks.length) failed = true;
    }
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
