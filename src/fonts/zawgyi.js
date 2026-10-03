// The Zawgyi glyph table and lagaung sequences: data only (DESIGN.md §2.3, §3.8). Layer L2. Owner: W6
// (engine-fonts).
//
// Skeleton (W0): the exports have their final names, frozen and empty, until W6 moves this project's own MIT
// table out of library/zawgyi.js, unchanged except for the role names.
//
// A GlyphRow is [role (ROLE), text, attachedMarks?]; a FontDefinition is { name, glyphs, sequences, selfBases,
// aliases, wholeBases }.

import { deepFreeze } from '../freeze.js';
import { ROLE, KINZI_TEXT } from '../script/codes.js';

// Zawgyi code point -> GlyphRow, keyed by one UTF-16 unit.
export const ZAWGYI_GLYPHS = /* @__PURE__ */ deepFreeze({});

// The 2 rows that make the lagaung glyph, applied first (stage 'sequences').
export const LAGAUNG_SEQUENCES = /* @__PURE__ */ deepFreeze([]);

// The font: ZAWGYI_GLYPHS, LAGAUNG_SEQUENCES, and selfBases [[0x1040, 0x1049]], since Zawgyi types wa as zero.
export const ZAWGYI_FONT = /* @__PURE__ */ deepFreeze({});
