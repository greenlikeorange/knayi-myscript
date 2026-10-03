'use strict';
// A read-only static server for the browser tests: dist/, docs/ and scripts/browser/ on 127.0.0.1.
// Playwright starts it (scripts/browser/playwright.config.js); nothing else is served. KNAYI_DIST_DIR serves
// /dist/ from another build directory, such as a build made in a temporary directory.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PORT = Number(process.env.KNAYI_BROWSER_PORT || 4317);
const DIST = process.env.KNAYI_DIST_DIR ? path.resolve(process.env.KNAYI_DIST_DIR) : path.join(ROOT, 'dist');
const SERVED = ['dist', 'docs', path.join('scripts', 'browser')];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function resolve(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  let file = path.normalize(path.join(ROOT, pathname));
  const allowed = SERVED.some((dir) => file.startsWith(path.join(ROOT, dir) + path.sep));
  if (!allowed) return null;
  if (file.startsWith(path.join(ROOT, 'dist') + path.sep)) file = path.join(DIST, path.relative(path.join(ROOT, 'dist'), file));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) return path.join(file, 'index.html');
  return file;
}

http.createServer((request, response) => {
  const file = request.method === 'GET' || request.method === 'HEAD' ? resolve(request.url) : null;
  if (!file || !fs.existsSync(file)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store'
  });
  if (request.method === 'HEAD') response.end();
  else fs.createReadStream(file).pipe(response);
}).listen(PORT, '127.0.0.1', () => {
  console.log('serving dist/, docs/ and scripts/browser/ on http://127.0.0.1:' + PORT);
});
