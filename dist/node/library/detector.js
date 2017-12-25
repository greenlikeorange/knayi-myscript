'use strict';

var whitespace = '[\\x20\\t\\r\\n\\f]';
var mmCharacterRange = /[\u1000-\u109F]/;
var library = {};

/** DETECTION Libarary **/
library.detect = {
	unicode: ['\u103E', '\u103F', '\u100A\u103A', '\u1014\u103A', '\u1004\u103A', '\u1031\u1038', '\u1031\u102C', '\u103A\u1038', '\u1035', '[\u1050-\u1059]', '^([\u1000-\u1021]\u103C|[\u1000-\u1021]\u1031)'],
	zawgyi: ['\u102C\u1039', '\u103A\u102C', whitespace + '(\u103B|\u1031|[\u107E-\u1084])[\u1000-\u1021]', '^(\u103B|\u1031|[\u107E-\u1084])[\u1000-\u1021]', '[\u1000-\u1021]\u1039[^\u1000-\u1021]', '\u1025\u1039', '\u1039\u1038', '[\u102B-\u1030\u1031\u103A\u1038](\u103B|[\u107E-\u1084])[\u1000-\u1021]', '\u1036\u102F', '[\u1000-\u1021]\u1039\u1031', '\u1064', '\u1039' + whitespace, '\u102C\u1031', '[\u102B-\u1030\u103A\u1038]\u1031[\u1000-\u1021]', '\u1031\u1031', '\u102F\u102D', '\u1039$']
};

// Populate Detect library as RegExps
Object.keys(library.detect).forEach(function (type) {
	for (var i = 0; i < library.detect[type].length; i++) {
		library.detect[type][i] = new RegExp(library.detect[type][i], 'g');
	}
});

/**
 * Font Type Detector agent
 * @param content Text to make a detection
 * @param def Default return format;
 * @return unicode ? zawgyi
 */
function fontDetect(content, def) {
	if (!content) throw new Error('Content must be specified on knayi.fontDetect');

	if (content === '') return content;

	if (!mmCharacterRange.test(content)) return def;

	content = content.trim().replace(/\u200B/g, '');
	def = def || 'zawgyi';

	var match = {};

	for (var type in library.detect) {
		match[type] = 0;

		for (var i = 0; i < library.detect[type].length; i++) {
			var rule = library.detect[type][i];
			var m = content.match(rule);
			match[type] += m && m.length || 0;
		}
	}

	if (match.unicode > match.zawgyi) {
		return 'unicode';
	} else if (match.unicode < match.zawgyi) {
		return 'zawgyi';
	} else {
		return def;
	}
};

module.exports = fontDetect;