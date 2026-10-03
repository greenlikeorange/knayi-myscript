const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const entry = path.join(root, 'main.js');

fs.mkdirSync(dist, { recursive: true });

// Without a target, esbuild writes the newest syntax when it minifies (`??`, `catch {}`), and browsers older than
// that syntax cannot parse the file at all. test/syntax.test.js keeps every build at ES2015.
const shared = {
  bundle: true,
  legalComments: 'none',
  logLevel: 'warning',
  target: 'es2015'
};

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

// `var knayi` is only global in a classic <script>. When a bundler imports the file, it is module scoped,
// so the script build also sets the global itself, as 2.8.3's `window.knayi = ...` did.
const browserGlobal = {
  js: '(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window).knayi = knayi;'
};

Promise.all([
  esbuild.build(Object.assign({}, shared, {
    stdin: esmEntry,
    format: 'esm',
    platform: 'neutral',
    outfile: path.join(dist, 'knayi-myscript.mjs')
  })),
  esbuild.build(Object.assign({}, shared, {
    entryPoints: [entry],
    format: 'iife',
    platform: 'browser',
    globalName: 'knayi',
    footer: browserGlobal,
    outfile: path.join(dist, 'knayi-myscript.js')
  })),
  esbuild.build(Object.assign({}, shared, {
    entryPoints: [entry],
    format: 'iife',
    platform: 'browser',
    globalName: 'knayi',
    footer: browserGlobal,
    minify: true,
    outfile: path.join(dist, 'knayi-myscript.min.js')
  }))
]).then(function () {
  fs.copyFileSync(
    path.join(dist, 'knayi-myscript.mjs'),
    path.join(dist, 'knayi-myscript.es.js')
  );
  ['knayi-myscript.js.map', 'knayi-myscript.min.js.map'].forEach(function (name) {
    var file = path.join(dist, name);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });
}).catch(function (error) {
  console.error(error);
  process.exit(1);
});
