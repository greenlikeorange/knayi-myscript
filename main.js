const globalOptions = require('./library/globalOptions');
const detection = require('./library/detection');
const fontConvert = require('./library/converter');
const syllBreak = require('./library/syllBreak');
const spellingFix = require('./library/spellingCheck');
const truncate = require('./library/truncate');
const normalize = require('./library/normalization');

const version = '2.10.0';
// Shorthand properties only: Node finds the named exports for `import { … }` by scanning this object.
const setGlobalOptions = globalOptions.setOptions;
const fontDetect = detection.fontDetect;
const detectEncoding = detection.detectEncoding;

module.exports = {
  version,
  setGlobalOptions,
  fontDetect,
  detectEncoding,
  fontConvert,
  syllBreak,
  spellingFix,
  truncate,
  normalize,
};

// TypeScript without esModuleInterop compiles `import knayi from` to `require(...).default`.
// Non-enumerable, so Object.keys and Node's named-export scan stay the same.
Object.defineProperty(module.exports, 'default', { value: module.exports });
