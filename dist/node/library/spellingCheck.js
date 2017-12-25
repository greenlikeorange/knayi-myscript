"use strict";

var fontDetect = require('./detector');

var mmCharacterRange = /[\u1000-\u109F]/;
var library = {};

/** Spelling Check Libarary **/
library.spellingFix = {
	unicode: "\u102B \u102C \u102D \u102E \u102F \u1030 \u1031 \u1032 \u1036 \u1037 \u1038 \u103A \u103B \u103C \u103D \u103E \u1039".split(" "),
	zawgyi: "\u102B \u102C \u102D \u102E \u102F \u1030 \u1031 \u1032 \u1033 \u1034 \u1036 \u1037 \u1038 \u1039 \u103A \u103B \u103C \u103D \u105A \u1060 \u1061 \u1062 \u1063 \u1064 \u1065 \u1066 \u1067 \u1068 \u1069 \u106A \u106B \u106C \u106D \u1070 \u1071 \u1072 \u1073 \u1074 \u1075 \u1076 \u1077 \u1078 \u1079 \u107A \u107B \u107C \u107D \u107E \u107F \u1080 \u1081 \u1082 \u1083 \u1084 \u1085 \u1087 \u1088 \u1089 \u108A \u108B \u108C \u108D \u108E \u1093 \u1094 \u1095 \u1096".split(" ")
};

// Populate Spelling Check
Object.keys(library.spellingFix).forEach(function (sys) {
	library.spellingFix[sys] = library.spellingFix[sys].map(function (exp) {
		return [new RegExp("[" + exp + "]{2,}", 'g'), exp];
	});
});

/**
* Spelling Check agent
* @param content Text to process
* @param fontType Type of font of content
* @return edited text
*/
function spellingFix(content, fontType) {
	if (!content) throw new Error('Content must be specified on knayi.fontConvert');

	if (content === '' || !mmCharacterRange.test(content)) return content;

	if (!fontType) fontType = fontDetect(content);

	content = content.trim().replace(/\u200B/g, '');

	switch (fontType) {
		case 'zawgyi':
			for (var i = 0; i < library.spellingFix.zawgyi.length; i++) {
				var rule = library.spellingFix.zawgyi[i];
				content = content.replace(rule[0], rule[1]);
			}
			return content;
		case 'unicode':
		default:
			for (var i = 0; i < library.spellingFix.unicode.length; i++) {
				var rule = library.spellingFix.unicode[i];
				content = content.replace(rule[0], rule[1]);
			}
			return content;
	}
};

module.exports = spellingFix;