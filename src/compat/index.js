// compat: the 2.x API on the 3.0 core (DESIGN.md §5, C1). Layer L4. Owner: W8 (compat).
//
// The named exports are the 2.x functions. The default export is the 2.x export object: the 8 keys in the order
// of main.js:13-26, and a non-enumerable `default` that points back at the object.
//
// Skeleton (W0): the named exports are the skeleton's stubs, and the default export is frozen and empty until W8
// builds the object.

import { deepFreeze } from '../freeze.js';
import { PACKAGE_VERSION } from '../version.js';
import { setGlobalOptions } from './globalOptions.js';
import { fontDetect } from './fontDetect.js';
import { fontConvert } from './fontConvert.js';
import { normalize, syllBreak, spellingFix, truncate } from './text.js';

export const version = PACKAGE_VERSION;

export { setGlobalOptions, fontDetect, fontConvert, syllBreak, spellingFix, truncate, normalize };

export default /* @__PURE__ */ deepFreeze({});
