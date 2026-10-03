// The browser builds of 3.0 (decision 18: engines with full ES2015 support). Node, Bun and bundlers load the ES
// module sources through the exports map of package.json, and the package ships them (src/) for anyone who wants
// to read the code; these files are for browsers, from a CDN or a copy, so all three are minified:
//
//   dist/knayi-myscript.min.mjs         the 3.0 API ('.', src/index.js) as one ES module
//   dist/knayi-myscript-compat.min.mjs  the 2.x API ('./compat', src/compat/index.js) as one ES module: the named
//                                       exports and the default export of 2.x's knayi-myscript.mjs
//   dist/knayi-myscript.min.js          a script that sets the global `knayi`: the 3.0 API, and as knayi.compat
//                                       the 2.x API, the object 2.x's script build set as `knayi`
//
// The tracked dist/ holds the build of the last release and changes only in release commits, because jsDelivr
// serves main's dist/ to `@master` links (scripts/check-dist.js checks this in CI). `npm run build` writes dist/
// for a release; the tests build into a temporary directory instead (builtDist below).

const esbuild = require('esbuild');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');

const FILES = ['knayi-myscript.min.mjs', 'knayi-myscript-compat.min.mjs', 'knayi-myscript.min.js'];

// How a browser loads each file: as an ES module, or as a classic script.
const SOURCE_TYPES = {
  'knayi-myscript.min.mjs': 'module',
  'knayi-myscript-compat.min.mjs': 'module',
  'knayi-myscript.min.js': 'script'
};

// The module each build starts from, relative to the root.
const ENTRIES = {
  api: './src/index.js',
  compat: './src/compat/index.js'
};

// The script build's entry: the 3.0 API's exports, and the 2.x export object as `compat`.
const SCRIPT_ENTRY = {
  contents:
    "export * from '" + ENTRIES.api + "';\n" +
    "export { default as compat } from '" + ENTRIES.compat + "';\n",
  resolveDir: root,
  sourcefile: 'script-entry.js'
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

// The sources are ES modules, which are strict. esbuild's script output is not, so the script build says
// "use strict" itself: the code runs as it was written and tested. One consequence shows in knayi.compat: a
// detached fontConvert call never reads a global `debug`, as in compat's module (docs/next/DESIGN.md §5.4).
const strictScript = { js: '"use strict";' };

// `var knayi` is only global in a classic <script>. When a bundler wraps the file in a module scope, it is module
// scoped, so the script build also sets the global itself, as 2.x's did.
const browserGlobal = {
  js: '(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window).knayi = knayi;'
};

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
    'knayi-myscript.min.js': Object.assign({}, shared, {
      stdin: SCRIPT_ENTRY,
      format: 'iife',
      platform: 'browser',
      globalName: 'knayi',
      banner: strictScript,
      footer: browserGlobal,
      outfile: path.join(outDir, 'knayi-myscript.min.js')
    })
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
