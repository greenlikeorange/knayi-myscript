'use strict';

const fontDetect = require('./detector');
const globalOptions = require('./globalOptions');
const gate = require('./contentGate');
const syllable = require('./syllableRules');
const win = require('./win');
const zawgyi = require('./zawgyi');

// Fonts stored in drawing order, converted to Unicode glyph by glyph (library/storageOrder.js).
const DRAWING_ORDER_FONTS = { win: win, zawgyi: zawgyi };

function fontConvert(content, to, from) {
  return convert(content, to, from, false);
}

// fontConvert and fontConvert.debugging. The debug flag is an argument, so a call that is not a method call, such
// as `const f = knayi.fontConvert; f(text, 'unicode')`, returns text whatever the global object holds.
function convert(content, to, from, debug) {
  content = gate.toText(content);
  if (gate.isMissing(content)) {
    if (!globalOptions.isSilentMode()) console.warn('Content must be specified on knayi.fontConvert.');
    return unconverted('', to, from, debug);
  }

  // Numbers, booleans and objects come back unchanged, whatever the fonts, from debugging too: a ConvertDebug
  // holds strings.
  if (typeof content !== 'string')
    return content;

  // Win text is ASCII, so it has no Myanmar letters to find.
  if (gate.resolveFont(from) !== 'win' && !gate.hasMyanmar(content))
    return unconverted(content, to, from, debug);

  if (!to) {
    if (!globalOptions.isSilentMode()) console.error('Convert target font must be specified on knayi.fontConvert.');
    return unconverted(content, to, from, debug);
  }

  // Zero-width spaces and non-joiners mark word breaks, so they stay.
  content = content.trim();
  var source = gate.givenName(from);
  to = gate.resolveFont(to);
  from = gate.resolveFont(from);

  if (!to) {
    if (!globalOptions.isSilentMode()) console.error('Convert library doesn\'t have this fontType.')
    return unconverted(content, to, from, debug);
  } else if (!from) {
    // No source font, or one that is not a string, means "detect". An unknown name is detected too, with a warning.
    if (source !== null && !globalOptions.isSilentMode()) {
      console.warn('Unknown source font ' + JSON.stringify(source) + ' on knayi.fontConvert; detecting it.');
    }
    from = fontDetect(content);
  }

  if (to === from) {
    return unconverted(content, to, from, debug);
  }

  // Win is a source font only: knayi converts Win text to Unicode.
  if (to === 'win' || (from === 'win' && to !== 'unicode')) {
    if (!globalOptions.isSilentMode()) console.error('knayi.fontConvert converts Win text to Unicode only.');
    return unconverted(content, to, from, debug);
  }

  // Here a Win or Zawgyi source always has a Unicode target.
  if (DRAWING_ORDER_FONTS[from]) return drawingOrderToUnicode(content, from, debug);

  content = syllable.collapseMarks(content, from);
  return syllable.convertText(content, from, to, debug);
}

// A call that returns before converting returns `text`. With debug it returns a ConvertDebug (index.d.ts) as for a
// conversion in which no rule matched: no patterns, and one step, the text fontConvert returns. `to` and `from`
// name the fonts the call read: 'unicode', 'zawgyi' or 'win', or '' for none, for an unknown name and for a source
// the call has not detected yet.
function unconverted(text, to, from, debug) {
  if (!debug) return text;
  return { to: fontName(to), from: fontName(from), matched_patterns: [], steps: [text] };
}

// A font for the debugging log, read as a name only (givenName). On the first exits, before resolveFont reads `to`
// and `from`, a value that is not a string gives '', and its string form, whose conversion can throw, is not read.
function fontName(font) {
  return gate.resolveFont(gate.givenName(font)) || '';
}

// Win and Zawgyi have their tables in library/win.js and library/zawgyi.js. The debugging log has the same
// shape as the other conversions and ends with the converted text.
function drawingOrderToUnicode(content, from, debug) {
  var result = DRAWING_ORDER_FONTS[from].toUnicode(content, debug);
  if (!debug) return result;
  return { to: 'unicode', from: from, matched_patterns: result.matched_patterns, steps: result.steps };
}

fontConvert.debugging = function (content, to, from) {
  return convert(content, to, from, true);
};

module.exports = fontConvert;
