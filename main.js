const globalOptions = require('./library/globalOptions');
const fontDetect = require('./library/detector');
const fontConvert = require('./library/converter');
const syllBreak = require('./library/syllBreak');
const spellingFix = require('./library/spellingCheck');
const truncate = require('./library/truncate');
const normalize = require('./library/normalization');

const version = '2.9.1';
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
