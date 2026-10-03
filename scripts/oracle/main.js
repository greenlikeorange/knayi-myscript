// main.js at the 2.x reference, commit e5f6e24 (docs/next/DESIGN.md §1.1): the 2.x API, frozen, that compat
// (src/compat/) reproduces. Its only change is the paths: the reference requires './library/<file>', and the frozen
// copies of those files sit next to this one, so it requires './<file>'. Do not edit it otherwise: a difference
// from the reference is what the tests that compare compat with it are for.

const globalOptions = require('./globalOptions');
const fontDetect = require('./detector');
const fontConvert = require('./converter');
const syllBreak = require('./syllBreak');
const spellingFix = require('./spellingCheck');
const truncate = require('./truncate');
const normalize = require('./normalization');

const version = '2.10.0';
// Shorthand properties only: Node finds the named exports for `import { … }` by scanning this object.
const setGlobalOptions = globalOptions.setOptions;

module.exports = {
  version,
  setGlobalOptions,
  fontDetect,
  fontConvert,
  syllBreak,
  spellingFix,
  truncate,
  normalize,
};

// TypeScript without esModuleInterop compiles `import knayi from` to `require(...).default`.
// Non-enumerable, so Object.keys and Node's named-export scan stay the same.
Object.defineProperty(module.exports, 'default', { value: module.exports });
