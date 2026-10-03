// Bundle sizes of the 3.0 core on next, and its tree-shaking check (docs/next/DESIGN.md §2.4, §6.4).
//
//   node scripts/next/size.mjs [--gate]
//
// Four bundles, measured as scripts/check-size.js measures the 2.x build: esbuild IIFE at ES2015, minified, and
// gzip by Node's zlib at level 9.
// - compat: src/compat/index.js, the 2.x API on the core.
// - normalize-only: an entry that imports only the core's normalizeText.
// - api: src/index.js, the whole 3.0 API (DESIGN.md §11).
// - api normalize-only: an entry that imports only normalize from src/index.js, as a 3.0 user who needs only
//   normalize does.
//
// Prints each bundle's size against its target and each module's share, from esbuild's metafile. Fails when a
// module that normalize never needs (the fonts, the font reader and stages, detection, segmentation, Unicode to
// Zawgyi, compat and spec, and the other functions of the 3.0 API) puts a byte into either normalize-only bundle.
// The byte targets bind with --gate, at the acceptance gate (§6.3); before that they are reported, and the 3.0
// bundles have none yet. CI's `checks` job runs this on every pull request.

import esbuild from 'esbuild';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The targets after the port of the 2.x linear NFC helper (§6.4, "After it"): W1 ported the helper into core/nfc.js
// (§7.3, as built), so both bundles carry it. Before the port they were 10,854 B and 4,300 B.
export const TARGETS = { compat: 10854, 'normalize-only': 4850, api: null, 'api normalize-only': null };

// Modules that must contribute 0 bytes to the normalize-only bundle (§2.4), as paths relative to the root.
const NOT_IN_NORMALIZE = [
  /^src\/fonts\//, /^src\/engine\/fontReader\.js$/, /^src\/stages\/fonts\.js$/, /^src\/rules\/detect\.js$/,
  /^src\/rules\/segment\.js$/, /^src\/rules\/unicodeToZawgyi\.js$/, /^src\/compat\//, /^src\/spec\//,
  /^src\/api\/(explain|encoding|convert|segment)\.js$/
];

// The bundles that import only normalize.
const NORMALIZE_ONLY = ['normalize-only', 'api normalize-only'];

const ENTRIES = {
  compat: { entryPoints: [path.join(ROOT, 'src', 'compat', 'index.js')] },
  'normalize-only': {
    stdin: {
      contents: "export { normalizeText } from './src/stages/normalize.js';\n",
      resolveDir: ROOT,
      sourcefile: 'normalize-only.js'
    }
  },
  api: { entryPoints: [path.join(ROOT, 'src', 'index.js')] },
  'api normalize-only': {
    stdin: {
      contents: "export { normalize } from './src/index.js';\n",
      resolveDir: ROOT,
      sourcefile: 'api-normalize-only.js'
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

function print(report) {
  const target = TARGETS[report.name];
  const over = target !== null && report.gzip > target;
  const goal = target === null ? 'no target yet.' : 'target ' + bytes(target) +
    (over ? ', ' + bytes(report.gzip - target) + ' over.' : '.');
  console.log(report.name + ': ' + bytes(report.gzip) + ' gzip (level 9), ' + bytes(report.minified) + ' minified; ' +
    goal);
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
    if (NORMALIZE_ONLY.indexOf(name) !== -1) {
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
