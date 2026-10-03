// knayi 3.0: the public API (DESIGN.md §11). Layer L4.
//
// One stateless core under it (DESIGN.md §4): every option is an argument of the call that uses it, nothing is kept
// between calls, nothing is written to the console, and myanmar-tools' ZawgyiDetector is passed in by the caller
// when it is wanted. Bad arguments throw errors with a `code` (src/api/args.js). The 2.x API, setGlobalOptions and
// all, is src/compat/index.js.
//
// Every export is a function or a constant, and the modules have no top-level side effects (DESIGN.md §2.4), so a
// bundle that imports only normalize leaves the glyph tables, detection and segmentation out.

import { PACKAGE_VERSION, OUTPUT_VERSION } from './version.js';
import { createTrace } from './core/rules.js';

// The package version, and the version of knayi's output: the latter changes with every deliberate change to what
// any function returns (decision 33), so a dataset can record it and know when to normalize again.
export const VERSION = PACKAGE_VERSION;
export { OUTPUT_VERSION };

// createTrace(): { start: null, records: [] }, for the trace option of normalize, toUnicode and toZawgyi. A call
// fills it: start is its input, and each record is { id, label, text }, the text after a stage or rule row that
// changed it, with the stage's stable id.
export { createTrace };

export { normalize, isNormalized } from './api/normalize.js';
export { detectEncoding } from './api/encoding.js';
export { explain } from './api/explain.js';
export { toUnicode, toZawgyi } from './api/convert.js';
export { segmentSyllables, syllableBoundaries, truncate, collapseRepeatedMarks } from './api/segment.js';
