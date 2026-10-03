// The 2.x call forms of npm run compare, each made with the 3.0 call that MIGRATION.md gives for it, with 3.0's
// defaults: what a 2.x user who moves to the 3.0 API gets. MIGRATION.md's counts of output changes compare compat,
// which gives 2.x's output, with this file:
//
//   npm run compare -- --base mjs:src/compat/index.js --head mjs:scripts/next/migration/plain.mjs --forms <forms>
//
// where <forms> leaves out the four debugging.* forms: a 3.0 trace is not the shape of 2.x's debug object, so they
// are not compared. scripts/next/migration/as-2x.mjs makes the same calls with the options that keep 2.x's output.
//
// The functions answer only the call forms compare makes (scripts/eval/lib/callForms.mjs), with their 2.x names, so
// that compare can load this file as it loads a copy of the 2.x API.
import * as api from '../../../src/index.js';

const ZERO_WIDTH_SPACE = '\u200B';

// fontConvert(text, 'unicode', from): toUnicode(text, { from }), which detects each line when from is undefined.
// fontConvert(text, 'zawgyi', 'unicode'): toZawgyi(text).
function fontConvert(text, to, from) {
  if (to === 'unicode') return api.toUnicode(text, { from: from });
  if (to === 'zawgyi' && from === 'unicode') return api.toZawgyi(text);
  throw new Error('not a call form of compare: fontConvert(text, ' + to + ', ' + from + ')');
}

// fontDetect(text) and fontDetect(text, 'unicode'): detectEncoding(text).encoding, which names a tie 'unknown' and
// text with no Myanmar 'none', where 2.x answers its fallback ('zawgyi' for a tie, 'en' for no Myanmar, when none is
// given).
function fontDetect(text) {
  return api.detectEncoding(text).encoding;
}

// syllBreak(text, font): the syllables of segmentSyllables joined by U+200B, 2.x's separator. With no font, 2.x
// detected one; the 3.0 call names it, from detectEncoding, a tie read as Unicode as toUnicode reads it.
function syllBreak(text, font) {
  return api.segmentSyllables(text, { font: font || fontOf(text) }).join(ZERO_WIDTH_SPACE);
}

function fontOf(text) {
  return api.detectEncoding(text).encoding === 'zawgyi' ? 'zawgyi' : 'unicode';
}

// spellingFix(text, font): collapseRepeatedMarks(text, { font }).
function spellingFix(text, font) {
  return api.collapseRepeatedMarks(text, { font: font });
}

// truncate(text, { length }): truncate(text, { length }).
function truncate(text, options) {
  return api.truncate(text, { length: options.length });
}

// normalize(text): normalize(text).
function normalize(text) {
  return api.normalize(text);
}

export default { fontConvert, fontDetect, syllBreak, spellingFix, truncate, normalize };
