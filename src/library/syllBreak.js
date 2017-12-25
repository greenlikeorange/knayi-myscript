const fontDetect = require('./detector');

const mmCharacterRange = /[\u1000-\u109F]/;
const library = {};

/** Syllable Libarary **/
library.syllable = {
  zawgyi: [
    [/([\u1000-\u1021\u1023-\u1027\u1029\u102a\u104c-\u104f\u1086\u108f-\u1092])/g, '\u200B$1'],
    [/([\u1031][\u103b\u107e-\u1084]|[\u1031\u103b\u107e-\u1084])/g, '\u200B$1'],
    [/([\u1031\u103b\u107e-\u1084])\u200B([\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090])/g, '$1$2'],
    [/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014])\u200B([\u1000-\u1021\u1031\u103b\u1025\u1029\u106A\u106B\u107e-\u1084\u1086\u108F\u1090])/g, '$1$2'],
    [/\u200B([\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090]\u1039)/g, '$1'],
    [/(\s|\n)\u200B([\u1000-\u1021\u1023-\u1027\u1029\u102a\u104c-\u104f\u1086\u108f-\u1092])/g, '$1$2'],
    [/([\u1000-\u1021])\u200B([\u1000-\u1021\u1031\u103b\u107e-\u1084])/g, '$1$2']
  ],
  unicode: [
    [/(\u103A)(\u1037)/g, "$2$1"],
    [/([\u1000-\u1021\u1023-\u1027\u1029\u102a\u103f\u104c-\u104f])/g, "\u200B$1"],
    [/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014]|\u1039)\u200B([\u1000-\u1021])/g, "$1$2"],
    [/\u200B(\u1004\u103A\u1039)/g, "$1"],
    [/\u200B([\u1000-\u1021]\u103A)/g, "$1"],
    [/(\s|\n)\u200B([\u1000-\u1021\u1023-\u1027\u1029\u102a\u103f\u104c-\u104f])/g, "$1$2"],
    [/([\u1000-\u1021])\u200B([\u1000-\u1021])/g, "$1$2"]
  ]
};

/**
* Syllable-Break agent
* @param content Text content
* @param language Language of content 'zawgyi' ? 'my'
* @param breakpoint Default is '\u200B'
* @return edited text
*/
function syllBreak(content, fontType, breakpoint){
  if (!content)
    throw new Error('Content must be specified on knayi.fontConvert');

  if (content === '' || !mmCharacterRange.test(content))
    return content;

  content = content.trim().replace(/\u200B/g, '');

  if (!fontType)
    fontType = fontDetect(content);

  var lib = library.syllable[fontType];

  for (var i = 0; i < lib.length; i++) {
    content = content.replace(lib[i][0], lib[i][1]);
  };

  content = content.replace(/^\u200B/, '');

  if (breakpoint && breakpoint !== '\u200B')
    return content.replace(/\u200B/g, breakpoint);

  return content
};

module.exports = syllBreak;
