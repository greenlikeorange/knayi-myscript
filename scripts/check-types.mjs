// Checks index.d.ts the way users get it: from the packed tarball, under every module resolution.
//
// npm test type-checks typecheck/*.ts against index.d.ts through a `paths` mapping with node10 resolution.
// This script packs the package instead, unpacks the tarball into the node_modules of a scratch project (it
// has no dependencies, so that is all npm install would do), and:
// 1. compiles typecheck/packed/ there with tsc under node16 and nodenext resolution (an ES module, esm.mts,
//    and a CommonJS module, cjs.cts) and under bundler resolution (bundler.ts), with skipLibCheck off;
// 2. runs the compiled node16 and nodenext modules in Node, and bundler.ts bundled by esbuild, so the types
//    are checked against what the code does;
// 3. runs @arethetypeswrong/cli on the tarball for the entry points README documents. Problems listed in
//    KNOWN_PROBLEMS are reported but do not fail the check; any other problem fails it, and so does a known
//    one that is gone, so the list stays current.
//
// Usage: node scripts/check-types.mjs [--keep]   (--keep leaves the scratch project in place and prints it)

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.join(import.meta.dirname, '..');
const require = createRequire(path.join(root, 'package.json'));
const keep = process.argv.includes('--keep');

// The entry points README.md lists under "These paths load without an exports map".
const ENTRYPOINTS = ['.', './library/converter', './dist/knayi-myscript.min.js', './dist/knayi-myscript.es.js'];

// Problems attw reports today. Each is a gap in what the package ships (index.d.ts, file names, package.json),
// left for the PRs that may change those files.
const KNOWN_PROBLEMS = {
  // README documents this deep path, but it has no declaration file (PR 1.7 adds library/converter.d.ts), and
  // without an exports map Node's ESM resolver needs the '.js' extension, so the bare path does not resolve
  // from an ES module.
  'UntypedResolution ./library/converter node10': 'no library/converter.d.ts',
  'UntypedResolution ./library/converter node16-cjs': 'no library/converter.d.ts',
  'NoResolution ./library/converter node16-esm': 'ES modules need library/converter.js, with the extension',
  'UntypedResolution ./library/converter bundler': 'no library/converter.d.ts',
  // The script build is imported for its side effect, the knayi global, so it needs no types of its own.
  'UntypedResolution ./dist/knayi-myscript.min.js node10': 'script build, imported for the global',
  'UntypedResolution ./dist/knayi-myscript.min.js node16-cjs': 'script build, imported for the global',
  'UntypedResolution ./dist/knayi-myscript.min.js node16-esm': 'script build, imported for the global',
  'UntypedResolution ./dist/knayi-myscript.min.js bundler': 'script build, imported for the global',
  // Bundlers reach the ESM copy through the `module` field, where index.d.ts types it. Imported by its own
  // path it has no types, and as a '.js' file in a package without "type": "module" Node reads it as
  // CommonJS, so it loads in Node only through ES module syntax detection (Node 22.7 and later).
  'UntypedResolution ./dist/knayi-myscript.es.js node10': 'no types for the path itself',
  'UntypedResolution ./dist/knayi-myscript.es.js node16-cjs': 'no types for the path itself',
  'UntypedResolution ./dist/knayi-myscript.es.js node16-esm': 'no types for the path itself',
  'UntypedResolution ./dist/knayi-myscript.es.js bundler': 'no types for the path itself',
  'UnexpectedModuleSyntax dist/knayi-myscript.es.js': 'ESM syntax in a .js file of a package without "type"'
};

const failures = [];
// The real path, so tsc names files relative to the scratch project (on macOS, the temp dir is a symlink).
const work = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'knayi-types-'));

function run(file, args, options) {
  execFileSync(file, args, Object.assign({ stdio: 'inherit' }, options));
}

try {
  // ---- Pack, and install the tarball into a scratch project by unpacking it.
  const packDir = path.join(work, 'pack');
  fs.mkdirSync(packDir);
  run('npm', ['pack', '--silent', '--pack-destination', packDir], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
    shell: process.platform === 'win32'
  });
  const tarballName = fs.readdirSync(packDir).find((name) => name.endsWith('.tgz'));
  if (!tarballName) throw new Error('npm pack did not write a tarball');
  const tarball = path.join(packDir, tarballName);

  const app = path.join(work, 'app');
  const installed = path.join(app, 'node_modules', 'knayi-myscript');
  fs.mkdirSync(installed, { recursive: true });
  run('tar', ['-xzf', tarball, '-C', installed, '--strip-components=1']);
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'knayi-types-check', private: true }));
  const sources = path.join(root, 'typecheck', 'packed');
  for (const name of fs.readdirSync(sources)) fs.copyFileSync(path.join(sources, name), path.join(app, name));

  // ---- tsc under each module resolution.
  const tsc = require.resolve('typescript/bin/tsc');
  const typescriptVersion = require('typescript/package.json').version;
  for (const project of ['tsconfig.node16.json', 'tsconfig.nodenext.json', 'tsconfig.bundler.json']) {
    const result = spawnSync(process.execPath, [tsc, '-p', path.join(app, project)], { cwd: app, encoding: 'utf8' });
    if (result.status === 0) {
      console.log('tsc ' + typescriptVersion + ' ' + project + ': ok');
    } else {
      failures.push('tsc ' + project + ':\n' + (result.stdout + result.stderr).trim());
    }
  }

  // ---- Run what tsc compiled, and the bundler consumer through esbuild.
  const outputs = ['out/node16/esm.mjs', 'out/node16/cjs.cjs', 'out/nodenext/esm.mjs', 'out/nodenext/cjs.cjs'];
  try {
    require('esbuild').buildSync({
      absWorkingDir: app,
      entryPoints: ['bundler.ts'],
      bundle: true,
      platform: 'browser',
      format: 'esm',
      outfile: 'out/bundler/bundle.mjs',
      logLevel: 'silent'
    });
    outputs.push('out/bundler/bundle.mjs');
  } catch (error) {
    failures.push('esbuild bundler.ts:\n' + error.message);
  }
  for (const output of outputs) {
    const file = path.join(app, output);
    if (!fs.existsSync(file)) continue; // tsc failed above
    const result = spawnSync(process.execPath, [file], { cwd: app, encoding: 'utf8' });
    if (result.status === 0) console.log('node ' + output + ': ok');
    else failures.push('node ' + output + ':\n' + (result.stdout + result.stderr).trim());
  }

  // ---- @arethetypeswrong/cli.
  const attw = require.resolve('@arethetypeswrong/cli/package.json').replace(/package\.json$/, 'dist/index.js');
  const attwVersion = require('@arethetypeswrong/cli/package.json').version;
  // attw exits as soon as it has written its report, which cuts off a report written to a pipe at 64 KB, so
  // it writes to a file.
  const reportFile = path.join(work, 'attw.json');
  const reportFd = fs.openSync(reportFile, 'w');
  let result;
  try {
    result = spawnSync(process.execPath, [attw, tarball, '--format', 'json', '--entrypoints'].concat(ENTRYPOINTS),
      { cwd: app, encoding: 'utf8', stdio: ['ignore', reportFd, 'pipe'] });
  } finally {
    fs.closeSync(reportFd);
  }
  let report;
  try {
    report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  } catch (error) {
    throw new Error('attw wrote no JSON report (exit ' + result.status + '): ' + result.stderr);
  }
  const found = [];
  for (const list of Object.values(report.problems || {})) {
    for (const problem of list) {
      const where = problem.entrypoint
        ? problem.entrypoint + ' ' + problem.resolutionKind
        : String(problem.fileName).replace(/^\/node_modules\/knayi-myscript\//, '');
      found.push(problem.kind + ' ' + where);
    }
  }
  const known = found.filter((key) => key in KNOWN_PROBLEMS);
  const unknown = found.filter((key) => !(key in KNOWN_PROBLEMS));
  const gone = Object.keys(KNOWN_PROBLEMS).filter((key) => !found.includes(key));
  console.log('attw ' + attwVersion + ' on ' + tarballName + ', entry points ' + ENTRYPOINTS.join(' ') + ': ' +
    found.length + ' problems, ' + known.length + ' known');
  for (const key of known) console.log('  known: ' + key + ' (' + KNOWN_PROBLEMS[key] + ')');
  for (const key of unknown) failures.push('attw: ' + key);
  for (const key of gone) failures.push('attw no longer reports "' + key + '": remove it from KNOWN_PROBLEMS');
} finally {
  if (keep) console.log('scratch project kept at ' + work);
  else fs.rmSync(work, { recursive: true, force: true });
}

if (failures.length) {
  console.error('\ncheck:types found ' + failures.length + ' problem(s):');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}
