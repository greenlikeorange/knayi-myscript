// The fonts knayi knows, text predicates and the text check of the 3.0 API (DESIGN.md §2.3, D1). Layer L1.
// Owner: W1 (core).
//
// Only what 3.0 shares lives here. The 2.x preamble (INPUT_POLICY, enter() and its warnings, the 2.x font-name
// lookup in any letter case, and breakFont with 2.x's font error) is compat's (compat/input.js), because the core is
// silent and stateless (§4), and the 3.0 API validates strictly and throws, where 2.x mostly warns.
//
// Every function here takes a string; the callers check that first (§4 rule 4).

import { deepFreeze } from '../freeze.js';
import { MYANMAR_BLOCK_PATTERN, MYANMAR_SCRIPT_PATTERN } from '../script/codes.js';
import { ERR, libraryError } from './errors.js';

// The font registry: one entry per font, with every name a caller may use for it and what a converter needs to
// know about it. The aliases are 2.x's (contentGate.js:3-9), in its order; FONT_ALIASES is built from them.
// - visualOrder: the text is stored in drawing order, glyph by glyph, so it reaches Unicode through the font
//   reader (2.x converter.js DRAWING_ORDER_FONTS; research/zawgyi-to-unicode.md §2).
// - sourceOnly: knayi converts from it, never to it (2.x converter.js fontConvert; research/win-fonts.md, Summary).
// - ascii: it draws Burmese on ASCII and Windows-1252 code points, so its text has no Myanmar-block character and
//   the Myanmar gate cannot see it: the converter checks the font before the gate (2.x fontConvert;
//   research/win-fonts.md §2).
export const FONTS = /* @__PURE__ */ deepFreeze({
  unicode: { name: 'unicode', aliases: ['unicode', 'uni'], visualOrder: false, sourceOnly: false, ascii: false },
  zawgyi: { name: 'zawgyi', aliases: ['zawgyi', 'zaw'], visualOrder: true, sourceOnly: false, ascii: false },
  win: { name: 'win', aliases: ['win'], visualOrder: true, sourceOnly: true, ascii: true }
});

// Every alias of FONTS, mapped to its font's name: unicode, uni -> 'unicode'; zawgyi, zaw -> 'zawgyi';
// win -> 'win'. The object has a null prototype, so a lookup of 'constructor' or '__proto__' finds nothing.
// The keys are lower case: compat reads a 2.x name in any letter case (compat/input.js resolveFont, decision 11),
// and the 3.0 API takes only these names as written.
export const FONT_ALIASES = /* @__PURE__ */ buildFontAliases(FONTS);

function buildFontAliases(fonts) {
  const aliases = Object.create(null);
  const names = Object.keys(fonts);
  for (let i = 0; i < names.length; i++) {
    const font = fonts[names[i]];
    for (let j = 0; j < font.aliases.length; j++) aliases[font.aliases[j]] = font.name;
  }
  return deepFreeze(aliases);
}

// Whether text has a unit in U+1000-U+109F: the gate every 2.x function but normalize checks first
// (contentGate.js hasMyanmar). It leaves out Extended-A and -B on purpose (DESIGN.md C8).
export function hasMyanmarBlockChar(text) {
  return MYANMAR_BLOCK_PATTERN.test(text);
}

// Whether text has a unit in the three Myanmar blocks: the no-Myanmar fast path of normalize (DESIGN.md §3.10).
export function hasMyanmarScriptChar(text) {
  return MYANMAR_SCRIPT_PATTERN.test(text);
}

// Zero-width space and zero-width non-joiner, which 2.x removes before it reads breaks, marks or evidence
// (contentGate.js cleanText). Only the zero-width space marks a word break; the non-joiner changes how letters
// join. The other zero-width characters stay.
const ZERO_WIDTH_BREAKS = /[\u200B\u200C]/g;

// text without U+200B and U+200C.
export function stripZeroWidthBreaks(text) {
  return text.replace(ZERO_WIDTH_BREAKS, '');
}

// value when it is a string; else throws a TypeError with the code ERR_KNAYI_INVALID_ARG_TYPE. apiName names the
// public function, for the message: requireText('normalize', 1) throws 'knayi.normalize: text must be a string'.
export function requireText(apiName, value) {
  if (typeof value === 'string') return value;
  throw libraryError(ERR.INVALID_ARG_TYPE, 'knayi.' + apiName + ': text must be a string', TypeError);
}
