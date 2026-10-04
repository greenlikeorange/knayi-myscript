// The browser builds of 3.0 (decision 18: engines with full ES2015 support). Node, Bun and bundlers load the ES
// module sources through the exports map of package.json, and the package ships them (src/) for anyone who wants
// to read the code; these files are for browsers, from a CDN or a copy, so all four are minified:
//
//   dist/knayi-myscript.min.mjs         the 3.0 API ('.', src/index.js) as one ES module
//   dist/knayi-myscript-compat.min.mjs  the 2.x API ('./compat', src/compat/index.js) as one ES module: the named
//                                       exports and the default export of 2.x's knayi-myscript.mjs
//   dist/knayi.min.js                   a script that sets the global `knayi`: the 3.0 API, and as knayi.compat
//                                       the 2.x API
//   dist/knayi-myscript.min.js          a script that sets the global `knayi` to the 2.x API, as 2.x's script
//                                       build of that name did
//
// 2.x's script build keeps its name and its global: pages load it from jsDelivr's @master, which follows main, and
// from unversioned CDN links, which follow npm's latest; they cannot pin a version, so a new global under the old
// name would break them the day 3.0 reached main (docs/next/DESIGN.md §14.3). The 3.0 global has a name of its own.
//
// The tracked dist/ holds the build of the last release and changes only in release commits, because jsDelivr
// serves main's dist/ to `@master` links (scripts/check-dist.js checks this in CI). `npm run build` writes dist/
// for a release; the tests build into a temporary directory instead (builtDist below).

const esbuild = require('esbuild');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');

const FILES = ['knayi-myscript.min.mjs', 'knayi-myscript-compat.min.mjs', 'knayi.min.js', 'knayi-myscript.min.js'];

// How a browser loads each file: as an ES module, or as a classic script.
const SOURCE_TYPES = {
  'knayi-myscript.min.mjs': 'module',
  'knayi-myscript-compat.min.mjs': 'module',
  'knayi.min.js': 'script',
  'knayi-myscript.min.js': 'script'
};

// The module each build starts from, relative to the root.
const ENTRIES = {
  api: './src/index.js',
  compat: './src/compat/index.js'
};

// The entries of the script builds. The 3.0 build's global is its exports: the 3.0 API, and the 2.x export object
// as `compat`. The 2.x build's global is that object itself, compat's default export, as 2.x's main.js exported it.
const SCRIPT_ENTRIES = {
  'knayi.min.js': {
    contents:
      "export * from '" + ENTRIES.api + "';\n" +
      "export { default as compat } from '" + ENTRIES.compat + "';\n",
    resolveDir: root,
    sourcefile: 'script-entry.js'
  },
  'knayi-myscript.min.js': {
    contents: "export { default } from '" + ENTRIES.compat + "';\n",
    resolveDir: root,
    sourcefile: 'script-entry-2x.js'
  }
};

// What each script build sets as the global `knayi`, from esbuild's `var knayi`, its entry's exports.
const SCRIPT_GLOBALS = {
  'knayi.min.js': 'knayi',
  'knayi-myscript.min.js': 'knayi.default'
};

// Without a target, esbuild writes the newest syntax when it minifies (`??`, `catch {}`), and browsers older than
// that syntax cannot parse the file at all. test/syntax.test.js keeps every build at ES2015. absWorkingDir keeps
// the output the same whatever directory the build runs from.
const shared = {
  absWorkingDir: root,
  bundle: true,
  minify: true,
  legalComments: 'none',
  logLevel: 'warning',
  target: 'es2015'
};

// The sources are ES modules, which are strict. esbuild's script output is not, so a script build runs its code in
// a strict function: the code runs as it was written and tested. One consequence shows in the 2.x API: a detached
// fontConvert call never reads a global `debug`, as in compat's module (docs/next/DESIGN.md §5.4). The directive
// stays inside the function: a "use strict" at the start of a classic script would make strict every script an
// asset pipeline concatenates after it, code that knayi does not own.
const strictFunction = { js: '(function () {"use strict";' };

// The function's `var knayi` is not a global, so the build sets the global itself, as 2.x's did: in a classic
// <script>, and also when a bundler wraps the file in a module scope.
function browserGlobal(file) {
  return { js: '(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window).knayi = ' +
    SCRIPT_GLOBALS[file] + ';\n})();' };
}

// The esbuild options of a script build.
function scriptConfig(file, outDir) {
  return Object.assign({}, shared, {
    stdin: SCRIPT_ENTRIES[file],
    format: 'iife',
    platform: 'browser',
    globalName: 'knayi',
    banner: strictFunction,
    footer: browserGlobal(file),
    outfile: path.join(outDir, file)
  });
}

// esbuild options for each file it writes into outDir, by file name.
function configs(outDir) {
  return {
    'knayi-myscript.min.mjs': Object.assign({}, shared, {
      entryPoints: [path.join(root, ENTRIES.api)],
      format: 'esm',
      platform: 'neutral',
      outfile: path.join(outDir, 'knayi-myscript.min.mjs')
    }),
    'knayi-myscript-compat.min.mjs': Object.assign({}, shared, {
      entryPoints: [path.join(root, ENTRIES.compat)],
      format: 'esm',
      platform: 'neutral',
      outfile: path.join(outDir, 'knayi-myscript-compat.min.mjs')
    }),
    'knayi.min.js': scriptConfig('knayi.min.js', outDir),
    'knayi-myscript.min.js': scriptConfig('knayi-myscript.min.js', outDir)
  };
}

// Writes the dist files into outDir and returns it.
function build(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const options = configs(outDir);
  for (const file of FILES) esbuild.buildSync(options[file]);
  return outDir;
}

let tempDist = null;

// The directory the tests read the dist files from: KNAYI_DIST when it is set (for example `KNAYI_DIST=dist` to
// test the committed release build), otherwise a fresh build of this checkout in a temporary directory, made once
// per process and removed when the process exits.
function builtDist() {
  if (process.env.KNAYI_DIST) return path.resolve(process.env.KNAYI_DIST);
  if (!tempDist) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knayi-dist-'));
    process.on('exit', function () {
      fs.rmSync(dir, { recursive: true, force: true });
    });
    tempDist = build(dir);
  }
  return tempDist;
}

module.exports = { FILES, SOURCE_TYPES, ENTRIES, configs, build, builtDist };

// node scripts/build.js [outDir]: writes dist/ (for a release commit) or the given directory.
if (require.main === module) {
  const outDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'dist');
  try {
    build(outDir);
  } catch (error) {
    // esbuild has already printed the build errors.
    if (!error.errors) console.error(error);
    process.exit(1);
  }
}
