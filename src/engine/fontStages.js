// The font pipeline of Zawgyi and Win to Unicode, and the compiled fonts (DESIGN.md §2.3, §3.8). Layer L3
// stages. Owner: W6 (engine-fonts).
//
// Skeleton (W0): the exports have their final names and signatures. The stage list is frozen and empty, and each
// function throws ERR.NOT_BUILT until W6 builds it. W6 adds the compiled fonts, each a private constant built by
// a /* @__PURE__ */ compileFont(...) call.
//
// Stage ids and labels, exactly the 2.x names in this order: 'sequences', 'glyphs' (traceOnly), 'syllables',
// 'zero as wa', 'look-alikes', 'typos', 'NFC'.

import { deepFreeze } from '../freeze.js';
import { ERR, libraryError } from '../core/errors.js';
import { applyRuleRows, runStages, startTrace } from '../core/rules.js';
import { toNfc } from '../core/nfc.js';
import { ZAWGYI_FONT } from '../fonts/zawgyi.js';
import { WIN_FONT } from '../fonts/win.js';
import { compileFont, readFont, glyphsInTypedOrder } from './fontReader.js';
import { zeroAsWa, fixLookAlikes, fixTypos } from './typingFixes.js';

export const FONT_STAGES = /* @__PURE__ */ deepFreeze([]);

export function fontToUnicode(text, fontName) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/fontStages.js fontToUnicode is not built yet');
}

export function traceFontToUnicode(text, fontName, trace) {
  throw libraryError(ERR.NOT_BUILT, 'src/engine/fontStages.js traceFontToUnicode is not built yet');
}
