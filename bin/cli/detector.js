// --detector myanmar-tools: Google's ZawgyiDetector, for the commands that detect (to-unicode with no --from,
// detect and check). The 3.0 API takes it as an object and never loads it (DESIGN.md §4); this is the one place
// the command loads code, and only when asked to.
//
// It is imported by name from this file, so Node looks for it only in the node_modules folders above the installed
// knayi package, never in the working directory: the command is meant to run inside data folders whose contents
// nobody has checked, and a node_modules there must not decide which code runs (SECURITY.md, "Loading code it
// should not"). An ES module import does not read NODE_PATH or the global folders either.

import { usageError } from './errors.js';

// null for --detector rules, the default: the 3.0 API then decides by its rule evidence (src/rules/detect.js).
export async function loadZawgyiDetector(name) {
  if (name !== 'myanmar-tools') return null;
  let loaded;
  try {
    loaded = await import('myanmar-tools');
  } catch (error) {
    throw usageError(cannotLoad(error));
  }
  const ZawgyiDetector = loaded.ZawgyiDetector || (loaded.default && loaded.default.ZawgyiDetector);
  if (typeof ZawgyiDetector !== 'function') {
    throw usageError('--detector myanmar-tools: the package has no ZawgyiDetector export; install myanmar-tools@1.1.3');
  }
  return new ZawgyiDetector();
}

function cannotLoad(error) {
  const firstLine = String(error && error.message).split('\n')[0];
  if (error && error.code === 'ERR_MODULE_NOT_FOUND' && firstLine.indexOf('\'myanmar-tools\'') !== -1) {
    return '--detector myanmar-tools needs the myanmar-tools package where knayi is installed ' +
      '(npm install myanmar-tools@1.1.3 next to knayi-myscript); knayi does not load it from the working directory';
  }
  // myanmar-tools 1.2.0 on npm ships without build_node/, so its own require fails (src/compat/zawgyiModel.js).
  return '--detector myanmar-tools: myanmar-tools could not be loaded (' + firstLine + '); install myanmar-tools@1.1.3';
}
