const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const entry = path.join(root, 'main.js');

fs.mkdirSync(dist, { recursive: true });

const shared = {
  entryPoints: [entry],
  bundle: true,
  legalComments: 'none',
  logLevel: 'warning'
};

Promise.all([
  esbuild.build(Object.assign({}, shared, {
    format: 'esm',
    platform: 'neutral',
    outfile: path.join(dist, 'knayi-myscript.mjs')
  })),
  esbuild.build(Object.assign({}, shared, {
    format: 'iife',
    platform: 'browser',
    globalName: 'knayi',
    outfile: path.join(dist, 'knayi-myscript.js')
  })),
  esbuild.build(Object.assign({}, shared, {
    format: 'iife',
    platform: 'browser',
    globalName: 'knayi',
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
