const fontDetect = require('./library/detector')
const fontConvert = require('./library/converter')
const syllBreak = require('./library/syllBreak')
const spellingFix = require('./library/spellingCheck')

const {version} = require('./package.json')

const setGlobalOptions = (options = {}) => {
	fontDetect.__setOptions(options.detector)
}

module.exports = {
	version,
	setGlobalOptions,
	fontDetect,
	fontConvert,
	syllBreak,
	spellingFix
};
