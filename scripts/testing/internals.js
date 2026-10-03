// Loads a fresh copy of a library module with some of its private bindings exported, for tests that read the
// library's rule tables or need a module with its load-time state reset. The copy requires the library's other
// modules by the usual relative paths, so it shares them (and their state) with main.js.
//
// The library itself is not changed: the source is read from disk, and a line exporting the named bindings is
// added to the end before it is compiled, the way Node wraps a CommonJS module.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const LIBRARY = path.join(__dirname, '..', '..', 'library');

// options.moduleRequire: what the module sees as module.require (library/detector.js loads myanmar-tools
// through it). options.context: a vm context to compile the module in, for a global object without `process`.
function loadWithInternals(file, names, options) {
  options = options || {};
  const filename = path.join(LIBRARY, file);
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
    return require(id.charAt(0) === '.' ? path.join(LIBRARY, id) : id);
  };
  const mod = { exports: {}, filename: filename, require: options.moduleRequire || localRequire };
  compiled.call(mod.exports, mod.exports, localRequire, mod, filename, LIBRARY);
  return mod.exports;
}

module.exports = { LIBRARY: LIBRARY, loadWithInternals: loadWithInternals };
