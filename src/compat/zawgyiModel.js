// compat: the myanmar-tools loader factory and its shared instance (DESIGN.md §5.1, C26, D3, D21). Layer L4.
// Owner: W8 (compat).
//
// This is the only file of src/ that may load code (§2.2). It imports no other compat file and writes nothing to
// the console: fontDetect.js prints the message, silent mode permitting.
//
// 2.x fontDetect scores with Google's myanmar-tools when asked to (2.x detector.js loadMyanmarTools). compat loads it
// as the 2.x ES module build does (D3): by name, from the working directory, in Node and Bun only, at most once per
// process, by the first call that needs it. The core takes the model as an argument and never loads it (§4 rule 5).

import { deepFreeze } from '../freeze.js';

// What a package without the ZawgyiDetector export counts as: a load error with this message (2.x loadMyanmarTools).
const NO_DETECTOR_EXPORT = /* @__PURE__ */ deepFreeze({ message: 'the package has no ZawgyiDetector export' });

// { load(), missingMessage(), warnOnce(write) } over requireFn(id), which returns the package, throws its load
// error, or returns null where there is no Node-style require. Each loader keeps its own outcome and warned flag,
// so a test can build one with a stub require and leave the shared one alone (D21).
export function createZawgyiModelLoader(requireFn) {
  const state = { attempted: false, model: null, error: null, warned: false };
  return deepFreeze({
    // The first call tries to load and records the outcome; later calls return the same model, or null.
    load: () => loadOnce(state, requireFn),
    // The §5.3 text for the recorded outcome.
    missingMessage: () => missingMessageFor(state.error),
    // write(message) unless a warning has printed; the flag is set only when write says it printed, so a call in
    // silent mode leaves the next call free to warn (C26).
    warnOnce: (write) => {
      if (!state.warned && write(missingMessageFor(state.error))) state.warned = true;
    }
  });
}

function loadOnce(state, requireFn) {
  if (state.attempted) return state.model;
  state.attempted = true;
  try {
    const loaded = requireFn('myanmar-tools');
    if (loaded && typeof loaded.ZawgyiDetector === 'function') state.model = new loaded.ZawgyiDetector();
    else if (loaded) state.error = NO_DETECTOR_EXPORT;
  } catch (error) {
    state.error = error;
  }
  return state.model;
}

// The warning for a model that did not load (2.x detector.js missingMyanmarToolsMessage).
function missingMessageFor(error) {
  if (!error) return 'myanmar-tools is not available in this environment; fontDetect used the rule scorer.';
  const firstLine = String(error.message).split('\n')[0];
  if (/MODULE_NOT_FOUND$/.test(String(error.code)) && firstLine.indexOf('\'myanmar-tools\'') !== -1) {
    return 'myanmar-tools is not installed; fontDetect used the rule scorer. Install myanmar-tools@1.1.3 to use it.';
  }
  // myanmar-tools 1.2.0 on npm ships without build_node/, so require() fails inside the package.
  return 'myanmar-tools could not be loaded (' + firstLine + '); fontDetect used the rule scorer. ' +
    'Install myanmar-tools@1.1.3.';
}

// The require of the 2.x ES module build (C26): Node and Bun only, made from the working directory at the moment
// of the first load, not at import, through process.getBuiltinModule (Node 20.16 and 22.3 or later, and Bun). In
// other runtimes, or a Node without getBuiltinModule, there is nothing to load from. main.js resolves the package
// from library/ instead; that is the second known build difference (§5.4).
function requireFromWorkingDirectory(id) {
  if (typeof process === 'undefined' || !process || !process.versions) return null;
  if (typeof process.versions.node !== 'string' || typeof process.getBuiltinModule !== 'function') return null;
  const nodeModule = process.getBuiltinModule('module');
  if (!nodeModule || typeof nodeModule.createRequire !== 'function') return null;
  return nodeModule.createRequire(process.cwd() + '/package.json')(id);
}

// The one loader compat uses: it holds the model, the load error and the warned flag for the process.
export const zawgyiModelLoader = /* @__PURE__ */ createZawgyiModelLoader(requireFromWorkingDirectory);
