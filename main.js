const globalOptions = require('./library/globalOptions');
const fontDetect = require('./library/detector');
const fontConvert = require('./library/converter');
const syllBreak = require('./library/syllBreak');
const spellingFix = require('./library/spellingCheck');
const truncate = require('./library/truncate');
const normalize = require('./library/normalization');

const {version} = require('./package.json');

module.exports = {
	version,
	setGlobalOptions: globalOptions.setOptions,
	fontDetect,
	fontConvert,
	syllBreak,
	spellingFix,
	truncate,
	normalize,
};
