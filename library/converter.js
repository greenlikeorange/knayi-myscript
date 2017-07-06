const spellingFix = require('./spellingCheck');
const fontDetect = require('./detector');

const	fontTypes = {
  unicode: "unicode",
  uni: "unicode",
  zawgyi: "zawgyi",
  zaw: "zawgyi"
};
const mmCharacterRange = /[\u1000-\u109F]/;
const library = {};

/** Converting Libarary **/
library.convert = {
  unicode: {
    zawgyi: {
      oneTime: [
        [/([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u102f/g, "$1\u1033"],
        [/([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u1030/g, "$1\u1034"],
        [/([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u1037/g, "$1\u1094"],
        [/([\u1000-\u1021])\u103b([\u103d][\u103e]*)/g, "$1\u107d$2"],
        [/([\u102f\u1030])[\u1037\u1094]/g, "$1\u1095"],
        [/([\u1000-\u1021])\u103c/g, "\u103c$1"],
        [/([\u1000-\u1021][^\u1000-\u1021]*)\u1031/g, "\u1031$1"],
        [/\u103c\u1031/g, "\u1031\u103c"],
        [/\u1014\u103d/g, "\u108f\u103d"],
        [/\u104e\u1004\u103a\u1038/g, "\u104e"],
        [/\u102b\u103a/g, "\u105a"],
        [/\u103f/g, "\u1086"],
        [/\u1039\u101c/g, "\u1085"],
        [/\u1039\u1019/g, "\u107c"],
        [/\u1039\u1018/g, "\u107b"],
        [/\u1039\u1017/g, "\u107a"],
        [/\u1039\u1016/g, "\u1079"],
        [/\u1039\u1016/g, "\u1079"],
        [/\u1039\u1015/g, "\u1078"],
        [/\u1039\u1014/g, "\u1077"],
        [/\u1039\u1013/g, "\u1076"],
        [/\u1039\u1012/g, "\u1075"],
        [/\u1039\u1011/g, "\u1073"],
        [/\u1039\u1010/g, "\u1071"],
        [/\u1039\u100f/g, "\u1070"],
        [/\u100e\u1039\u100d/g, "\u106f"],
        [/\u100f\u1039\u100d/g, "\u1091"],
        [/\u100d\u1039\u100d/g, "\u106e"],
        [/\u1039\u100c/g, "\u106d"],
        [/\u1039\u100b/g, "\u106c"],
        [/\u1009/g, "\u106a"],
        [/\u1039\u1005\u103b/g, "\u1069"],
        [/\u1039\u1007/g, "\u1068"],
        [/\u1039\u1006/g, "\u1066"],
        [/\u1039\u1005/g, "\u1065"],
        [/\u1039\u1003/g, "\u1063"],
        [/\u100c/g, "\u1092"],
        [/\u1039\u1002/g, "\u1062"],
        [/\u1039\u1001/g, "\u1061"],
        [/\u103d\u103e/g, "\u108a"],
        [/\u103e\u1030/g, "\u1089"],
        [/\u1039\u1000/g, "\u1060"],
        [/\u100b\u1039\u100b/g, "\u1097"],
        [/\u1004\u103a\u1039/g, "\u1064"],
        [/\u103e\u102f/g, "\u1088"],
        [/\u1037/g, "\u1037"],
        [/\u103a/g, "\u1039"],
        [/\u103b/g, "\u103a"],
        [/\u103c/g, "\u103b"],
        [/\u103d/g, "\u103c"],
        [/\u103e/g, "\u103d"]
      ],
      asFoundAs: [
        [/([\u103b\u103c\u103d\u103e])\u1031/g, "\u1031$1"],
        [/\u103b([\u1000\u1003\u1006\u100f\u1010\u1011\u1018\u101a\u101c\u101e\u101f\u1021])/g, "\u107e$1"],
        [/\u103b([\u1000-\u1021](\u103c\u103d|\u108a|\u103c)[\u102d\u102e])/g, "\u1083$1"],
        [/\u107e([\u1000-\u1021](\u103c\u103d|\u108a|\u103c)[\u102d\u102e])/g, "\u1084$1"],
        [/\u103b([\u1000-\u1021][\u102d\u102e])/g, "\u107f$1"],
        [/\u107e([\u1000-\u1021][\u102d\u102e])/g, "\u1080$1"],
        [/\u103b([\u1000-\u1021][\u103c])/g, "\u1081$1"],
        [/\u107e([\u1000-\u1021][\u103c])/g, "\u1082$1"]
      ]
    }
  },
  zawgyi: {
    unicode: {
      oneTime: [
        [/([^\u1040-\u1049\+\-\*\/])?\u1040([^\u1040-\u1049\+\-\*\/])?/g, '$1\u101d$2'],
        [/\u103d|\u1087/g, '\u103e'],
        [/\u103c/g, '\u103d'],
        [/[\u103b\u107e-\u1084]/g, '\u103c'],
        [/[\u103a\u107d]/g, '\u103b'],
        [/\u1039/g, '\u103a'],
        [/[\u1094-\u1095]/g, '\u1037'],
        [/[\u107b\u1093]/g, '\u1039\u1018'],
        [/\u1033/g, '\u102f'],
        [/\u1034/g, '\u1030'],
        [/\u1088/g, '\u103e\u102f'],
        // [/\u1064/g, '\u1004\u103a\u1039'],
        [/\u1089/g, '\u103e\u1030'],
        [/\u108a/g, '\u103d\u103e'],
        [/\u1061/g, '\u1039\u1001'],
        [/\u108f/g, '\u1014'],
        [/\u1062/g, '\u1039\u1002'],
        [/\u1063/g, '\u1039\u1003'],
        [/\u1065/g, '\u1039\u1005'],
        [/\u1066/g, '\u1039\u1006'],
        [/\u1068/g, '\u1039\u1007'],
        [/\u1069/g, '\u1039\u1005\u103b'],
        [/\u106a/g, '\u1009'],
        [/\u106b/g, '\u100a'],
        [/\u106c/g, '\u1039\u100b'],
        [/\u106d/g, '\u1039\u100c'],
        [/\u106e/g, '\u100d\u1039\u100d'],
        [/\u106f/g, '\u100e\u1039\u100d'],
        [/\u1070/g, '\u1039\u100f'],
        [/\u1071/g, '\u1039\u1010'],
        [/\u1073/g, '\u1039\u1011'],
        [/\u1075/g, '\u1039\u1012'],
        [/\u1076/g, '\u1039\u1013'],
        [/\u1077/g, '\u1039\u1014'],
        [/\u1078/g, '\u1039\u1015'],
        [/\u1079/g, '\u1039\u1016'],
        [/\u1079/g, '\u1039\u1016'],
        [/\u107a/g, '\u1039\u1017'],
        [/\u107c/g, '\u1039\u1019'],
        [/\u1085/g, '\u1039\u101c'],
        [/\u1086/g, '\u103f'],
        [/\u1090/g, '\u101b'],
        [/\u1091/g, '\u100f\u1039\u100d'],
        [/\u1092/g, '\u100c'],
        [/\u1097/g, '\u100b\u1039\u100b'],
        [/\u1060/g, '\u1039\u1000'],
        [/\u105a/g, '\u102b\u103a'],
        [/\u104e/g, '\u104e\u1004\u103a\u1038'],
        [/\u1025\u103a/g, '\u1009\u103a'],
        [/([\u1000-\u1021])\u108b/g, '\u1064$1\u102d'],
        [/([\u1000-\u1021])\u108c/g, '\u1064$1\u102e'],
        [/([\u1000-\u1021])\u108d/g, '\u1064$1\u1036'],
        [/\u108e/g, '\u102d\u1036'],
        [/\u103c([\u1000-\u1021])/g, '$1\u103c'],
        [/\u1031([\u1000-\u1021])/g, '$1\u1031'],
        [/([\u103b\u103c\u103d])(\u1064)/g, '$2$1'],
        [/\u1031(\u1064)/g, '$1\u1031'],
        [/([\u1000-\u1021])(\u1064)/g, '$2$1'],
        [/\u0020(\u1039[\u1000-\u1021])/g, '$1'],
        [/\u1064/g, '\u1004\u103a\u1039']
      ],
      asFoundAs: [
        [/([\u102b\u102c\u102d\u102e\u1031\u102f\u1030\u1032\u1036\u1037\u1038])([\u103b\u103c\u103d\u103e])/g, "$2$1"],
        [/\u103d([\u103b\u103c])/g, "$1\u103d"],
        [/\u103e([\u103b\u103c\u103d])/g, "$1\u103e"],
        [/([\u102f\u1030])([\u102d\u102e])/g, "$2$1"],
        [/\u1036([\u102d\u102e\u102f\u1030])/g, "$1\u1036"],
        [/\u1037([\u1031\u102c\u102b\u102f\u1030\u1032])/g, "$1\u1037"],
        [/([\u1031\u102b\u102c])(\u1039[\u1000-\u1021])/g, "$2$1"],
        [/([\u102b\u102c])(\u1004\u103a\u1039)/g, "$2$1"]
      ]
    }
  }
};

/**
 * Font Converter agent
 * @param content Text that you want to convert
 * @param to Type of font to convert. Default: "unicode";
 * @param from Type of font of content text
 * @return converted text
 */
function fontConvert(content, to, from) {
  if (!content)
    throw new Error('Content must be specified on knayi.fontConvert');

  if (content === '' || !mmCharacterRange.test(content))
    return content;

  if (!to)
    throw new Error('convertTo must be specified on knayi.fontConvert')

  content = content.trim().replace(/\u200B/g, '');
  to = fontTypes[to];
  from = fontTypes[from];

  if (!to) {
    console.error('Convert library dosen\'t this fontType to convert')
    return content;
  } else if (!from) {
    from = fontDetect(content);
  }

  if (to === from) {
    return content;
  }

  content = spellingFix(content, from);
  var refLib = library.convert[from][to];

  for (var i = 0; i < refLib.oneTime.length; i++) {
    var rule1 = refLib.oneTime[i];
    content = content.replace(rule1[0], rule1[1]);
  }

  for (var j = 0; j < refLib.asFoundAs.length; j++) {
    var rule2 = refLib.asFoundAs[j];
    while (rule2[0].test(content)) {
      content = content.replace(rule2[0], rule2[1]);
    }
  }

  return content;
};

module.exports = fontConvert;
