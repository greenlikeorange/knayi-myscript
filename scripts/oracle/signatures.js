// Frozen copy of the 29 detector signatures and the rule scorer of knayi 2.10 (library/detector.js lines 1-2
// and 60-100), the oracle for the differential fuzz test (test/fuzz.test.js). Copied verbatim; only this
// header and the export at the end were added. Do not edit: a change here hides a change in the library.

const library = {};
const whitespace = '[\\x20\\t\\r\\n\\f]';

/** DETECTION Libarary **/
library.detect = {
  unicode: [
    '\u103e', '\u103f', '\u100a\u103a', '\u1014\u103a', '\u1004\u103a', '\u1031\u1038', '\u1031\u102c',
    '\u103a\u1038', '\u1035', '[\u1050-\u1059]', '^([\u1000-\u1021]\u103c|[\u1000-\u1021]\u1031)',
    // Zawgyi writes medial ra as U+103B before its consonant, so only count ya-pin when no consonant follows.
    // C + U+1039 + C is left out: it is a Pali stack in Unicode but asat + next syllable in Zawgyi.
    '[\u1000-\u1021]\u103b(?![\u1000-\u1021])'
  ],
  zawgyi : [
    '\u102c\u1039', '\u103a\u102c', whitespace+'(\u103b|\u1031|[\u107e-\u1084])[\u1000-\u1021]'
    ,'^(\u103b|\u1031|[\u107e-\u1084])[\u1000-\u1021]', '[\u1000-\u1021]\u1039[^\u1000-\u1021]', '\u1025\u1039'
    ,'\u1039\u1038' ,'[\u102b-\u1030\u1031\u103a\u1038](\u103b|[\u107e-\u1084])[\u1000-\u1021]' ,'\u1036\u102f'
    ,'[\u1000-\u1021]\u1039\u1031' , '\u1064','\u1039'+whitespace, '\u102c\u1031'
    ,'[\u102b-\u1030\u103a\u1038]\u1031[\u1000-\u1021]', '\u1031\u1031', '\u102f\u102d', '\u1039$'
  ]
};

// Populate Detect library as Regex
Object.keys(library.detect).forEach((type) => {
  for (var i = 0; i < library.detect[type].length; i++) {
    library.detect[type][i] = new RegExp(library.detect[type][i], 'g');
  }
});

function scoreWithRules(content, fallback) {
  var match = {};

  for (var type in library.detect) {
    match[type] = 0;

    for (var i = 0; i < library.detect[type].length; i++) {
      var found = content.match(library.detect[type][i]);
      match[type] += (found && found.length) || 0;
    }
  }

  if (match.unicode > match.zawgyi) return 'unicode';
  if (match.unicode < match.zawgyi) return 'zawgyi';
  return fallback;
}

module.exports = { detect: library.detect, scoreWithRules: scoreWithRules };
