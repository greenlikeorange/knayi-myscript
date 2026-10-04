// The 2.x call forms of npm run compare, each made with the 3.0 API and the options and steps that MIGRATION.md
// gives for keeping 2.x's output: a trim, tie: 'zawgyi', bareConsonants: 'pairs', and 2.x's removal of U+200B and U+200C.
// MIGRATION.md's counts of what still differs compare compat, which gives 2.x's output, with this file:
//
//   npm run compare -- --base mjs:src/compat/index.js --head mjs:scripts/next/migration/as-2x.mjs --forms <forms>
//
// where <forms> are the forms this file answers. It has no normalize and no truncate: no option of the 3.0 API gives
// 2.x's normalize, which a second call can change again, or 2.x's truncate, which is not always a prefix of its
// text and appends the omission to text that fits. compat keeps both. scripts/next/migration/plain.mjs makes the
// plain 3.0 calls.
import * as api from '../../../src/index.js';

const ZERO_WIDTH_SPACE = '\u200B';
const ZERO_WIDTH_BREAKS = /[\u200B\u200C]/g;
const MYANMAR_BLOCK = /[\u1000-\u109F]/;

// 2.x returns text with no character of U+1000-U+109F as it is, untrimmed (all but normalize and truncate; and
// fontConvert from Win, whose text is ASCII).
function hasMyanmarBlock(text) {
  return MYANMAR_BLOCK.test(text);
}

// What 2.x reads breaks and marks from: the text trimmed, without U+200B and U+200C.
function cleaned(text) {
  return text.trim().replace(ZERO_WIDTH_BREAKS, '');
}

// fontConvert(text, to, from): the 3.0 conversion of the trimmed text, with a tie read as Zawgyi as 2.x reads it.
function fontConvert(text, to, from) {
  if (from !== 'win' && !hasMyanmarBlock(text)) return text;
  const trimmed = text.trim();
  if (to === 'unicode') return api.toUnicode(trimmed, { from: from, tie: 'zawgyi' });
  if (to === 'zawgyi' && from === 'unicode') return api.toZawgyi(trimmed);
  throw new Error('not a call form of compare: fontConvert(text, ' + to + ', ' + from + ')');
}

// fontDetect(text, fallback): detectEncoding's answer, with 2.x's fallback for 'none' ('en' when none is given) and
// for a tie ('zawgyi' when none is given).
function fontDetect(text, fallback) {
  const encoding = api.detectEncoding(text).encoding;
  if (encoding === 'none') return fallback || 'en';
  if (encoding === 'unknown') return fallback || 'zawgyi';
  return encoding;
}

// syllBreak(text, font): 2.x's pairs of bare consonants, on the cleaned text, the syllables joined by U+200B; with
// no font, the font detected as 2.x detects it, a tie read as Zawgyi.
function syllBreak(text, font) {
  if (!hasMyanmarBlock(text)) return text;
  const clean = cleaned(text);
  const breakFont = font || (fontDetect(clean) === 'zawgyi' ? 'zawgyi' : 'unicode');
  return api.segmentSyllables(clean, { bareConsonants: 'pairs', from: breakFont }).join(ZERO_WIDTH_SPACE);
}

// spellingFix(text, font): collapseRepeatedMarks on the cleaned text.
function spellingFix(text, font) {
  if (!hasMyanmarBlock(text)) return text;
  return api.collapseRepeatedMarks(cleaned(text), { from: font });
}

export default { fontConvert, fontDetect, syllBreak, spellingFix };
