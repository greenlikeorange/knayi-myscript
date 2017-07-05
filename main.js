var fontDetect = require('./library/detector');
var fontConvert = require('./library/converter');
var syllBreak = require('./library/syllBreak');
var spellingFix = require('./library/spellingCheck')

if (typeof window !== 'undefined') {
	window.knayi = {
		fontDetect,
		fontConvert,
		syllBreak,
		spellingFix
	}
}

module.exports = {
	fontDetect,
	fontConvert,
	syllBreak,
	spellingFix
}
