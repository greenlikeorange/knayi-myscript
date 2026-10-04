// compat: the 2.x API on the 3.0 core (DESIGN.md §5, C1). Layer L4. Owner: W8 (compat).
//
// The named exports are the 2.x functions. The default export is the 2.x export object (main.js module.exports): the 9
// keys in that order, and a non-enumerable `default` that points back at the object, for TypeScript without
// esModuleInterop, which compiles `import knayi from` to `require(...).default`. Like 2.x's, the object is not frozen.
//
// Its output is byte-identical to the reference's main.js (commit 8923365, 2.11) on every input, with the one known
// build difference of §5.4, which 2.11's builds in dist/ share: no package is loaded by name, so the myanmar-tools
// adapter needs a detector passed as zawgyiDetector.

import { PACKAGE_VERSION } from '../version.js';
import { setGlobalOptions } from './globalOptions.js';
import { fontDetect, detectEncoding } from './fontDetect.js';
import { fontConvert } from './fontConvert.js';
import { normalize, syllBreak, spellingFix, truncate } from './text.js';

export const version = PACKAGE_VERSION;

export { setGlobalOptions, fontDetect, detectEncoding, fontConvert, syllBreak, spellingFix, truncate, normalize };

export default /* @__PURE__ */ createKnayiObject();

// The 2.x export object, built once.
function createKnayiObject() {
  const knayi = {
    version: PACKAGE_VERSION,
    setGlobalOptions: setGlobalOptions,
    fontDetect: fontDetect,
    detectEncoding: detectEncoding,
    fontConvert: fontConvert,
    syllBreak: syllBreak,
    spellingFix: spellingFix,
    truncate: truncate,
    normalize: normalize
  };
  Object.defineProperty(knayi, 'default', { value: knayi });
  return knayi;
}
