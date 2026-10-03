// The Win Innwa glyph table, look-alike sequences and C1 aliases: data only (DESIGN.md §2.3, §3.8). Layer L2.
// Owner: W6 (engine-fonts).
//
// Skeleton (W0): the exports have their final names, frozen and empty, until W6 moves this project's own MIT
// table out of library/win.js, unchanged except for the role names. Never copy LGPL, GPL or unlicensed tables,
// and never commit the Win fonts (CONTRIBUTING.md).

import { deepFreeze } from '../freeze.js';
import { ROLE, KINZI_TEXT } from '../script/codes.js';

// Win code point -> GlyphRow, keyed by one UTF-16 unit.
export const WIN_GLYPHS = /* @__PURE__ */ deepFreeze({});

// The 4 rows for letters Win types as look-alike sequences (aMomf, Mo, ps, OD), applied first.
export const LOOK_ALIKE_SEQUENCES = /* @__PURE__ */ deepFreeze([]);

// The 11 C1 controls -> the Windows-1252 key they stand for (win.js:217-221).
export const C1_ALIASES = /* @__PURE__ */ deepFreeze({});

export const WIN_FONT = /* @__PURE__ */ deepFreeze({});
