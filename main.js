const fontDetect = require('./library/detector')
const fontConvert = require('./library/converter')
const syllBreak = require('./library/syllBreak')
const spellingFix = require('./library/spellingCheck')

module.exports = {
	fontDetect,
	fontConvert,
	syllBreak,
	spellingFix
};
