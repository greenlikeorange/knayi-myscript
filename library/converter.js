const fontDetect = require('./detector');
const globalOptions = require('./globalOptions');
const gate = require('./contentGate');
const syllable = require('./syllable');
const win = require('./win');
const zawgyi = require('./zawgyi');

// Fonts stored in drawing order, converted to Unicode glyph by glyph (library/storageOrder.js).
const DRAWING_ORDER_FONTS = { win: win, zawgyi: zawgyi };

function fontConvert(content, to, from) {
  content = gate.toText(content);
  if (gate.isMissing(content)) {
    if (!globalOptions.isSilentMode()) console.warn('Content must be specified on knayi.fontConvert.');
    return '';
  }

  // Numbers, booleans and objects come back unchanged, whatever the fonts.
  if (typeof content !== 'string')
    return content;

  // Win text is ASCII, so it has no Myanmar letters to find.
  if (gate.resolveFont(from) !== 'win' && !gate.hasMyanmar(content))
    return content;

  if (!to) {
    if (!globalOptions.isSilentMode()) console.error('Convert target font must be specified on knayi.fontConvert.');
    return content;
  }

  // Zero-width spaces and non-joiners mark word breaks, so they stay.
  content = content.trim();
  var source = gate.fontName(from);
  to = gate.resolveFont(to);
  from = gate.resolveFont(from);

  if (!to) {
    if (!globalOptions.isSilentMode()) console.error('Convert library doesn\'t have this fontType.')
    return content;
  } else if (!from) {
    // No source font, or one that is not a string, means "detect". An unknown name is detected too, with a warning.
    if (source !== null && !globalOptions.isSilentMode()) {
      console.warn('Unknown source font ' + JSON.stringify(source) + ' on knayi.fontConvert; detecting it.');
    }
    from = fontDetect(content);
  }

  if (to === from) {
    return content;
  }

  // Win is a source font only: knayi converts Win text to Unicode.
  if (to === 'win' || (from === 'win' && to !== 'unicode')) {
    if (!globalOptions.isSilentMode()) console.error('knayi.fontConvert converts Win text to Unicode only.');
    return content;
  }

  var debug = this && this.debug;
  // Here a Win or Zawgyi source always has a Unicode target.
  if (DRAWING_ORDER_FONTS[from]) return drawingOrderToUnicode(content, from, debug);

  content = syllable.collapseMarks(content, from);
  return syllable.convertText(content, from, to, debug);
}

// Win and Zawgyi have their tables in library/win.js and library/zawgyi.js. The debugging log has the same
// shape as the other conversions and ends with the converted text.
function drawingOrderToUnicode(content, from, debug) {
  var result = DRAWING_ORDER_FONTS[from].toUnicode(content, debug);
  if (!debug) return result;
  return { to: 'unicode', from: from, matched_patterns: result.matched_patterns, steps: result.steps };
}

fontConvert.debugging = function (param1, param2, param3) {
  return fontConvert.apply({debug: true}, [param1, param2, param3])
}

module.exports = fontConvert;
