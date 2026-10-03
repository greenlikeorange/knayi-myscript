// compat: the myanmar-tools loader factory and its shared instance (DESIGN.md §5.1, C26, D3, D21). Layer L4.
// Owner: W8 (compat).
//
// This is the only file of src/ that may load code (§2.2). It imports no other compat file and writes nothing to
// the console.
//
// Skeleton (W0): the exports have their final names and signatures. The shared loader is frozen and empty, and
// the factory throws ERR.NOT_BUILT until W8 builds it.

import { deepFreeze } from '../freeze.js';
import { ERR, libraryError } from '../core/errors.js';

// { load(), missingMessage(), warnOnce(write) } over requireFn(id).
export function createZawgyiModelLoader(requireFn) {
  throw libraryError(ERR.NOT_BUILT, 'src/compat/zawgyiModel.js createZawgyiModelLoader is not built yet');
}

// The one loader compat uses.
export const zawgyiModelLoader = /* @__PURE__ */ deepFreeze({});
