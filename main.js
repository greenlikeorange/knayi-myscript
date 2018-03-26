const fontDetect = require('./library/detector')
const fontConvert = require('./library/converter')
const syllBreak = require('./library/syllBreak')
const spellingFix = require('./library/spellingCheck')

const setGlobalOptions = (options = {}) => {
	fontDetect.__setOptions(options.detector)
}

module.exports = {
	setGlobalOptions,
	fontDetect,
	fontConvert,
	syllBreak,
	spellingFix
};
