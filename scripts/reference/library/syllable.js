'use strict';
// The 2.x path of the syllable rules, which live in library/syllableRules.js, with the test-only Unicode parser of
// library/unicodeParser.js. Nothing in the library requires this file, so the builds leave it and the parser out.
module.exports = Object.assign({}, require('./unicodeParser'), require('./syllableRules'));
