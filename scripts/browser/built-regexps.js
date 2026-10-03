'use strict';
// Prints, as JSON on stdout, every RegExp that the code of src/ builds from a string while it loads and while the
// shared call lists run (scripts/browser/examples.js): the 2.x calls on compat, the 3.0 calls on the 3.0 API, and
// compat's legacyWinTables(), which only scripts call. Each record is { via, site, pattern, flags }, with the site as
// 'src/<file>:<line>'; a pattern that is itself a RegExp is recorded as { regexp: source }.
//
// test/regex-floor.test.js runs it in a process of its own, so the hooks go in before anything loads src/: the
// modules build their table rows once, at load, and `bun test` runs every test file in one process.

const path = require('path');
const { fileURLToPath } = require('url');

const SRC = path.join(__dirname, '..', '..', 'src') + path.sep;
const NativeRegExp = RegExp;
const records = [];

// 'src/<file>:<line>' of the first stack frame in src/, or null. ES module frames name their file as a URL.
function sourceSite() {
  const prepare = Error.prepareStackTrace;
  Error.prepareStackTrace = (error, frames) => frames;
  const frames = new Error().stack;
  Error.prepareStackTrace = prepare;
  for (const frame of frames) {
    let file = frame.getFileName();
    if (file && file.startsWith('file:')) file = fileURLToPath(file);
    if (file && file.startsWith(SRC)) {
      return 'src/' + path.relative(SRC, file).split(path.sep).join('/') + ':' + frame.getLineNumber();
    }
  }
  return null;
}

function record(via, pattern, flags) {
  const site = sourceSite();
  if (!site) return;
  const shown = pattern instanceof NativeRegExp ? { regexp: pattern.source } : String(pattern === undefined ? '' : pattern);
  records.push({ via, site, pattern: shown, flags: flags === undefined ? '' : String(flags) });
}

global.RegExp = new Proxy(NativeRegExp, {
  construct(target, args, newTarget) {
    record('new RegExp', args[0], args[1]);
    return Reflect.construct(target, args, newTarget === global.RegExp ? target : newTarget);
  },
  apply(target, thisArg, args) {
    record('RegExp()', args[0], args[1]);
    return Reflect.apply(target, thisArg, args);
  }
});

// match, search and matchAll turn a string argument into a RegExp inside the engine.
for (const name of ['match', 'search', 'matchAll']) {
  const original = String.prototype[name];
  Object.defineProperty(String.prototype, name, {
    configurable: true,
    writable: true,
    value: function (pattern) {
      if (!(pattern instanceof NativeRegExp)) {
        record('.' + name, pattern === undefined ? '' : String(pattern), name === 'matchAll' ? 'g' : '');
      }
      return original.apply(this, arguments);
    }
  });
}

const compat = require('../../src/compat/index.js').default;
const api = require('../../src/index.js');
const { legacyWinTables } = require('../../src/compat/legacy.js');
const examples = require('./examples');

examples.runCalls(compat, examples.allCalls());
examples.runCalls(api, examples.apiCalls());
legacyWinTables();

process.stdout.write(JSON.stringify(records));
