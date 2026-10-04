'use strict';

// The detector's code is in library/detection.js, not here. That file holds both public detection functions,
// fontDetect and detectEncoding, with the rule scorer and the myanmar-tools loader, and it is the file the library
// requires. This one is only the 2.x path of fontDetect, kept so that require('knayi-myscript/library/detector')
// still gives fontDetect; it is not bundled.
module.exports = require('./detection').fontDetect;
