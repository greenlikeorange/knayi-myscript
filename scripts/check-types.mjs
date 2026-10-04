// Checks the types of every entry of the exports map the way users get them: from the packed tarball, under every
// module resolution.
//
// npm test type-checks typecheck/*.ts against src/compat/index.d.ts through a `paths` mapping with node10
// resolution, and typecheck/next/ against src/index.d.ts. This script packs the package instead, with a fresh
// build in dist/ (scripts/pack-fresh.mjs), unpacks the tarball into the node_modules of a scratch project (it has
// no dependencies, so that is all npm install would do), and:
// 1. compiles typecheck/packed/ there with tsc, skipLibCheck off: an ES module (esm.mts) under node16, node20 and
//    nodenext resolution; a CommonJS module (cjs.cts) under node20 and nodenext, the modes in which TypeScript
//    lets CommonJS require an ES module, as Node 22.12 and later do, and under `module: commonjs`, whose default
//    resolution, node10, reads no exports map and finds the subpaths through typesVersions; bundler.ts under
//    bundler resolution; and the
//    streams (stream.mts) under nodenext with the DOM library, which has the TransformStream type they name. The
//    others have only ES2022, so '.' and './compat' are shown to need no DOM or Node types;
// 2. runs the compiled modules in Node, and bundler.ts bundled by esbuild, so the types are checked against what
//    the code does;
// 3. runs @arethetypeswrong/cli on the tarball for every entry of the exports map. Problems listed in
//    KNOWN_PROBLEMS are reported but do not fail the check; any other problem fails it, and so does a known
//    one that is gone, so the list stays current.
//
// Usage: node scripts/check-types.mjs [--keep]   (--keep leaves the scratch project in place and prints it)

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { packFresh } from './pack-fresh.mjs';

const root = path.join(import.meta.dirname, '..');
const require = createRequire(path.join(root, 'package.json'));
const keep = process.argv.includes('--keep');

// The entries of the exports map (package.json), each with its types: the 3.0 API, the 2.x API and streaming.
const ENTRYPOINTS = ['.', './compat', './stream'];

// Problems attw reports by design. Each is a choice of 3.0's packaging (decision 31), with its reason.
const ESM_ONLY = 'ES modules only: CommonJS loads them with require() in Node 22.12 and later, and TypeScript ' +
  'allows that under module commonjs, node20 and nodenext (typecheck/packed/cjs.cts), not under node16';
const KNOWN_PROBLEMS = {
  'CJSResolvesToESM . node16-cjs': ESM_ONLY,
  'CJSResolvesToESM ./compat node16-cjs': ESM_ONLY,
  'CJSResolvesToESM ./stream node16-cjs': ESM_ONLY
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
  const tarball = packFresh(packDir, { quiet: true });
  const tarballName = path.basename(tarball);

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
  const projects = ['tsconfig.node10.json', 'tsconfig.node16.json', 'tsconfig.node20.json', 'tsconfig.nodenext.json',
    'tsconfig.bundler.json', 'tsconfig.stream.json'];
  for (const project of projects) {
    const result = spawnSync(process.execPath, [tsc, '-p', path.join(app, project)], { cwd: app, encoding: 'utf8' });
    if (result.status === 0) {
      console.log('tsc ' + typescriptVersion + ' ' + project + ': ok');
    } else {
      failures.push('tsc ' + project + ':\n' + (result.stdout + result.stderr).trim());
    }
  }

  // ---- Run what tsc compiled, and the bundler consumer through esbuild.
  const outputs = ['out/node10/cjs.cjs', 'out/node16/esm.mjs', 'out/node20/esm.mjs', 'out/node20/cjs.cjs',
    'out/nodenext/esm.mjs', 'out/nodenext/cjs.cjs', 'out/stream/stream.mjs'];
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
