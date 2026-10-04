// main.js at commit e5f6e24, 2.10.0's code and the 2.x reference the 3.0 core was built against (docs/next/DESIGN.md
// §1.1, D19): the 2.x API of the frozen 2.10 engine. compat now follows the 2.x reference of scripts/reference/. Its
// only change is the paths: e5f6e24 requires './library/<file>', and the frozen copies of those files sit next to
// this one, so it requires './<file>'. Do not edit it otherwise: guards/oracle.test.mjs checks it against e5f6e24.

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
