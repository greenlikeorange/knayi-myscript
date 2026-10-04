'use strict';

// The 2.x path of fontDetect, which library/detection.js holds. The library requires that file; this one is not
// bundled.
module.exports = require('./detection').fontDetect;
