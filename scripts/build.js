const esbuild = require('esbuild');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const entry = path.join(root, 'main.js');

// The tracked dist/ holds the build of the last release and changes only in release commits, because jsDelivr
// serves main's dist/ to `@master` links (scripts/check-dist.js checks this in CI). `npm run build` writes dist/
// for a release; the tests build into a temporary directory instead (builtDist below).
const FILES = ['knayi-myscript.mjs', 'knayi-myscript.es.js', 'knayi-myscript.js', 'knayi-myscript.min.js'];

// Without a target, esbuild writes the newest syntax when it minifies (`??`, `catch {}`), and browsers older than
// that syntax cannot parse the file at all. test/syntax.test.js keeps every build at ES2015.
// The unminified builds name each module in a comment (`// library/win.js`) relative to absWorkingDir, so the
// output does not depend on the directory the build runs from.
const shared = {
  absWorkingDir: root,
  bundle: true,
  legalComments: 'none',
  logLevel: 'warning',
  target: 'es2015'
};

// `var knayi` is only global in a classic <script>. When a bundler imports the file, it is module scoped,
// so the script build also sets the global itself, as 2.8.3's `window.knayi = ...` did.
const browserGlobal = {
  js: '(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window).knayi = knayi;'
};

// esbuild options for the three files it writes into outDir; knayi-myscript.es.js is a copy of the .mjs file.
function configs(outDir) {
  // Bundlers follow the `module` field for both `import { fontConvert }` and `require()`,
  // so the ESM build needs every main.js export as a named export, not only a default.
  const esmEntry = {
    contents:
      "import knayi from './main.js';\n" +
      'export const { ' + Object.keys(require(entry)).join(', ') + ' } = knayi;\n' +
      'export default knayi;\n',
    resolveDir: root,
    sourcefile: 'esm-entry.js'
  };
  return {
    mjs: Object.assign({}, shared, {
      stdin: esmEntry,
      format: 'esm',
      platform: 'neutral',
      outfile: path.join(outDir, 'knayi-myscript.mjs')
    }),
    js: Object.assign({}, shared, {
      entryPoints: [entry],
      format: 'iife',
      platform: 'browser',
      globalName: 'knayi',
      footer: browserGlobal,
      outfile: path.join(outDir, 'knayi-myscript.js')
    }),
    min: Object.assign({}, shared, {
      entryPoints: [entry],
      format: 'iife',
      platform: 'browser',
      globalName: 'knayi',
      footer: browserGlobal,
      minify: true,
      outfile: path.join(outDir, 'knayi-myscript.min.js')
    })
  };
}

// Writes the four dist files into outDir and returns it.
function build(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const options = configs(outDir);
  esbuild.buildSync(options.mjs);
  esbuild.buildSync(options.js);
  esbuild.buildSync(options.min);
  fs.copyFileSync(
    path.join(outDir, 'knayi-myscript.mjs'),
    path.join(outDir, 'knayi-myscript.es.js')
  );
  ['knayi-myscript.js.map', 'knayi-myscript.min.js.map'].forEach(function (name) {
    const file = path.join(outDir, name);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });
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

module.exports = { FILES, configs, build, builtDist };

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
