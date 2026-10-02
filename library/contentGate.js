const MYANMAR = /[\u1000-\u109F]/;

const FONT_ALIASES = {
  unicode: 'unicode',
  uni: 'unicode',
  zawgyi: 'zawgyi',
  zaw: 'zawgyi'
};

function isMissing(content) {
  return content == null || content === '';
}

function hasMyanmar(content) {
  return typeof content === 'string' && MYANMAR.test(content);
}

function resolveFont(fontType) {
  if (fontType == null || fontType === '') return null;
  if (Object.prototype.hasOwnProperty.call(FONT_ALIASES, fontType)) {
    return FONT_ALIASES[fontType];
  }
  return null;
}

function cleanText(content, trim) {
  var text = trim ? content.trim() : content;
  return text.replace(/[\u200B\u200C]/g, '');
}

module.exports = {
  isMissing,
  hasMyanmar,
  resolveFont,
  cleanText
};
