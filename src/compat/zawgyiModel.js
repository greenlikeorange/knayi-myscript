// compat: the myanmar-tools adapter with no detector, and its one warning (DESIGN.md §5.1, C26, D3, D21). Layer L4.
// Owner: W8 (compat).
//
// 2.x fontDetect scores with Google's myanmar-tools when asked to. Since 2.11 (2.x 649b2b4, decision 17) only 2.x's
// main.js loads the package itself, through module.require, from knayi's own folder; the builds in dist/, and knayi
// bundled into an app, load no package by name, and the adapter calls the detector passed as zawgyiDetector, for one
// call or stored with setGlobalOptions. compat is an ES module like 2.x's module build, and loads no code at all: not
// from the working directory, as it did until this port, and not from next to a build file. With no detector the
// adapter uses the rule scorer, and warns once. The core takes the model as an argument and never loads it (§4
// rule 5).
//
// This file imports no other compat file and writes nothing to the console: fontDetect.js prints the message
// (globalOptions.js MESSAGES.noDetector), silent mode permitting.

import { deepFreeze } from '../freeze.js';

// { warnOnce(write) }: calls write() unless a warning has printed. The flag is set only when write says it printed,
// so a call in silent mode leaves the next call free to warn (C26). Each notice keeps its own flag, so a test can
// build one and leave the shared one alone (D21).
export function createNoDetectorNotice() {
  const state = { warned: false };
  return deepFreeze({
    warnOnce: (write) => {
      if (!state.warned && write()) state.warned = true;
    }
  });
}

// The one notice compat uses: whether the warning has printed in this process.
export const noDetectorNotice = /* @__PURE__ */ createNoDetectorNotice();
