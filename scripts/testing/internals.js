// Loads a fresh copy of a module of the 2.x library with some of its private bindings exported, for tests that read
// the 2.x rule tables or need a module with its load-time state reset. The 2.x library is by default the frozen copy
// of library/ at e5f6e24 in scripts/oracle/ (docs/next/DESIGN.md D19), which 3.0 no longer ships, or with
// `dir` another copy, such as the 2.x reference's in scripts/reference/library/. The copy requires the library's
// other modules by the usual relative paths, so it shares them (and their state) with the main.js beside them.
//
// The file itself is not changed: the source is read from disk, and a line exporting the named bindings is added
// to the end before it is compiled, the way Node wraps a CommonJS module.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ORACLE = path.join(__dirname, '..', 'oracle');

// options.moduleRequire: what the module sees as module.require (2.x detector.js loads myanmar-tools through it).
// options.context: a vm context to compile the module in, for a global object without `process`. options.dir: the
// directory to read the file from, scripts/oracle/ by default. Its relative requires resolve in that directory too.
function loadWithInternals(file, names, options) {
  options = options || {};
  const dir = options.dir || ORACLE;
  const filename = path.join(dir, file);
  let source = fs.readFileSync(filename, 'utf8');
  // Compiled as a function, as Node compiles a CommonJS module. A copy of the unchanged source keeps the file's
  // name, so test coverage counts what it runs. A copy with an added line, or in another context (where V8
  // reports no block coverage), gets a name of its own: under the file's name it would mark lines covered that
  // never ran.
  let name = filename;
  if (names && names.length) {
    source += '\nmodule.exports.__internals = { ' + names.join(', ') + ' };\n';
    name += ' (copy with internals)';
  }
  const params = ['exports', 'require', 'module', '__filename', '__dirname'];
  const compiled = options.context
    ? vm.compileFunction(source, params, { filename: name + ' (vm context)', parsingContext: options.context })
    : vm.compileFunction(source, params, { filename: name });
  const localRequire = function (id) {
    return require(id.charAt(0) === '.' ? path.join(dir, id) : id);
  };
  const mod = { exports: {}, filename: filename, require: options.moduleRequire || localRequire };
  compiled.call(mod.exports, mod.exports, localRequire, mod, filename, dir);
  return mod.exports;
}

module.exports = { ORACLE: ORACLE, loadWithInternals: loadWithInternals };
