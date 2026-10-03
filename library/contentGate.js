const MYANMAR = /[\u1000-\u109F]/;

const FONT_ALIASES = {
  unicode: 'unicode',
  uni: 'unicode',
  zawgyi: 'zawgyi',
  zaw: 'zawgyi',
  win: 'win'
};

// null, undefined, '', 0, false, and NaN are missing content, as in 2.8.3.
function isMissing(content) {
  return !content;
}

// String objects behave like the strings they wrap.
function toText(content) {
  return Object.prototype.toString.call(content) === '[object String]' ? String(content) : content;
}

function hasMyanmar(content) {
  return typeof content === 'string' && MYANMAR.test(content);
}

// 'unicode', 'zawgyi' or 'win' for a font name or alias, else null. Names are case-insensitive, so 'Unicode' and
// 'ZAWGYI' are fonts too; a String object counts as its string. Any other value is looked up by its property name,
// as it is.
function resolveFont(fontType) {
  if (fontType == null || fontType === '') return null;
  fontType = toText(fontType);
  if (typeof fontType === 'string') fontType = fontType.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(FONT_ALIASES, fontType)) {
    return FONT_ALIASES[fontType];
  }
  return null;
}

// An error knayi throws on purpose. Its string `code`, such as 'ERR_KNAYI_INVALID_FONT', is API: callers test the
// code, not the message. It also tells the error apart from a TypeError the engine raises by accident, so the
// contract matrix records its message too (test/unit/errors.test.js checks every throw).
function libraryError(code, message, Ctor) {
  var error = new (Ctor || Error)(message);
  error.code = code;
  return error;
}

// The name a call was given, or null for none. A name is a string other than '', or a String object's string, and
// comes back as it is. It reads a font name, fontDetect's fallback (which is not a font name) and an adapter name.
// Any other value (undefined, null, '', or a number such as the index Array#map passes) names nothing: the font is
// detected, and the fallback or adapter is left out.
function givenName(value) {
  value = toText(value);
  return typeof value === 'string' && value !== '' ? value : null;
}

// The font syllBreak and truncate break text in: 'unicode', 'zawgyi', or null to detect it. The break rules exist
// for those two fonts only, so 'win' and unknown names throw a TypeError.
function breakFont(fontType, apiName) {
  var name = givenName(fontType);
  var font = resolveFont(name);
  if (name === null || font === 'unicode' || font === 'zawgyi') return font;
  throw libraryError('ERR_KNAYI_INVALID_FONT',
    'knayi.' + apiName + ' takes the font \'unicode\' or \'zawgyi\', not ' + JSON.stringify(name) + '.', TypeError);
}

function cleanText(content, trim) {
  var text = trim ? content.trim() : content;
  return text.replace(/[\u200B\u200C]/g, '');
}

module.exports = {
  isMissing,
  toText,
  hasMyanmar,
  resolveFont,
  givenName,
  breakFont,
  libraryError,
  cleanText
};
