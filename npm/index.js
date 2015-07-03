/**
 * Kanyi Myanmar script on npm
 *
 */

var core_version = "1.1.0",
	core_obj = {},
	whitespace = "[\\x20\\t\\r\\n\\f]",
	rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g" ),
	rZawgyi = /[\u1000-\u1097\u1e29]/,

	// Usable font-type shortcut
	fontTypes = {
		unicode5: "unicode5",
		unicode: "unicode5",
		uni5: "unicode5",
		uni: "unicode5",
		zawgyi: "zawgyi",
		zaw: "zawgyi"
	},

	fontType2Lang = {
		unicode5: 'my',
		unicode: 'my',
		zawgyi: 'zawgyi'
	},

	/**
	 * Main Library;
	 */
	library = {

		// Font Detecting Library
		detect: {
			unicode5: [
				'ှ', 'ဿ', 'ည်', 'န်', 'င်', 'ေး', 'ော',
				'်း', 'ဵ', '[ၐ-ၙ]', '^([က-အ]ြ|[က-အ]ေ)'
			],
			zawgyi : [
				'ာ္', '်ာ', whitespace+'(ျ|ေ|[ၾ-ႄ])[က-အ]'
				,'^(ျ|ေ|[ၾ-ႄ])[က-အ]', '[က-အ]္[^က-အ]', 'ဥ္'
				,'္း' ,'[ါ-ူေ်း](ျ|[ၾ-ႄ])[က-အ]' ,'ံု'
				,'[က-အ]္ေ' , 'ၤ','္'+whitespace, 'ာေ'
				,'[ါ-ူ်း]ေ[က-အ]', 'ေေ', 'ုိ', '္$'
			]

		},

		/**
		 * Font Converting Library
		 * library can use exchange method, when direct library don't support
		 *
		 * "[Base Font]": {
		 *     "[Coverable Font]": {
		 * 			singleReplace: [One Time replace],
		 *			whileReplace: [While Match replace]
		 * 		}
		 * }
		 */
		convert: {

			unicode5: {

				zawgyi: {
					singleReplace: [

						[/([က-အ](္[က-အ]|[ျြွ]+)[ိီေဲံ့ှ]*)ု/g, "$1ဳ"],
						[/([က-အ](္[က-အ]|[ျြွ]+)[ိီေဲံ့ှ]*)ူ/g, "$1ဴ"],

						[/([က-အ](္[က-အ]|[ျြွ]+)[ိီေဲံ့ှ]*)့/g, "$1႔"],
						[/([က-အ])ျ([ွ][ှ]*)/g, "$1ၽ$2"],

						[/([ုူ])[့႔]/g, "$1႕"],

						[/([က-အ])ြ/g, "ြ$1"],
						[/([က-အ][^က-အ]*)ေ/g, "ေ$1"],
						[/ြေ/g, "ေြ"],
						[/နွ/g, "ႏွ"],

						[/၎င်း/g, "၎"],
						[/ါ်/g, "ၚ"],
						[/ဿ/g, "ႆ"],
						[/္လ/g, "ႅ"],
						[/္မ/g, "ၼ"],
						[/္ဘ/g, "ၻ"],
						[/္ဗ/g, "ၺ"],
						[/္ဖ/g, "ၹ"],
						[/္ဖ/g, "ၹ"],
						[/္ပ/g, "ၸ"],
						[/္န/g, "ၷ"],
						[/္ဓ/g, "ၶ"],
						[/္ဒ/g, "ၵ"],
						[/္ထ/g, "ၳ"],
						[/္တ/g, "ၱ"],
						[/္ဏ/g, "ၰ"],
						[/ဎ္ဍ/g, "ၯ"],
						[/ဏ္ဍ/g, "႑"],
						[/ဍ္ဍ/g, "ၮ"],
						[/္ဌ/g, "ၭ"],
						[/္ဋ/g, "ၬ"],
						[/ဉ/g, "ၪ"],
						[/္စျ/g, "ၩ"],
						[/္ဇ/g, "ၨ"],
						[/္ဆ/g, "ၦ"],
						[/္စ/g, "ၥ"],
						[/္ဃ/g, "ၣ"],
						[/ဌ/g, "႒"],
						[/္ဂ/g, "ၢ"],
						[/္ခ/g, "ၡ"],
						[/ွှ/g, "ႊ"],
						[/ှူ/g, "ႉ"],
						[/္က/g, "ၠ"],
						[/ဋ္ဋ/g, "႗"],
						[/င်္/g, "ၤ"],
						[/ှု/g, "ႈ"],
						[/့/g, "့"],
						[/်/g, "္"],
						[/ျ/g, "်"],
						[/ြ/g, "ျ"],
						[/ွ/g, "ြ"],
						[/ှ/g, "ွ"]

						//ဆွေးနွေးပွဲဆိုင်ရာ
						//ေဆြးေနြးပြဲဆိုင္ရာ

					],
					whileReplace: [
						[/([ျြွှ])ေ/g, "ေ$1"],

						[/ျ([ကဃဆဏတထဘယလသဟအ])/g, "ၾ$1"],
						[/ျ([က-အ](ြွ|ႊ|ြ)[ိီ])/g, "ႃ$1"],
						[/ၾ([က-အ](ြွ|ႊ|ြ)[ိီ])/g, "ႄ$1"],
						[/ျ([က-အ][ိီ])/g, "ၿ$1"],
						[/ၾ([က-အ][ိီ])/g, "ႀ$1"],
						[/ျ([က-အ][ြ])/g, "ႁ$1"],
						[/ၾ([က-အ][ြ])/g, "ႂ$1"]
					]
				}
			},
			zawgyi: {

				unicode5: {
					singleReplace: [
						[/၀[^၀-၉\+\-\*\/]/g, '၀'],
						[/[^၀-၉\+\-\*\/]၀/g, '၀'],

						[/ွ/g, 'ှ'],
						[/ြ/g, 'ွ'],
						[/[ျၾ-ႄ]/g, 'ြ'],
						[/[်ၽ]/g, 'ျ'],
						[/္/g, '်'],
						[/[႔-႕]/g, '့'],
						[/[ၻ႓]/g, '္ဘ'],
						[/ဳ/g, 'ု'],
						[/ဴ/g, 'ူ'],
						[/ႈ/g, 'ှု'],
						[/ၤ/g, 'င်္'],
						[/ႉ/g, 'ှူ'],
						[/ႊ/g, 'ွှ'],
						[/ၡ/g, '္ခ'],
						[/ႏ/g, 'န'],
						[/ၢ/g, '္ဂ'],
						[/ၣ/g, '္ဃ'],
						[/ၥ/g, '္စ'],
						[/ၦ/g, '္ဆ'],
						[/ၨ/g, '္ဇ'],
						[/ၩ/g, '္စျ'],
						[/ၪ/g, 'ဉ'],
						[/ၫ/g, 'ည'],
						[/ၬ/g, '္ဋ'],
						[/ၭ/g, '္ဌ'],
						[/ၮ/g, 'ဍ္ဍ'],
						[/ၯ/g, 'ဎ္ဍ'],
						[/ၰ/g, '္ဏ'],
						[/ၱ/g, '္တ'],
						[/ၳ/g, '္ထ'],
						[/ၵ/g, '္ဒ'],
						[/ၶ/g, '္ဓ'],
						[/ၷ/g, '္န'],
						[/ၸ/g, '္ပ'],
						[/ၹ/g, '္ဖ'],
						[/ၹ/g, '္ဖ'],
						[/ၺ/g, '္ဗ'],
						[/ၼ/g, '္မ'],
						[/ႅ/g, '္လ'],
						[/ႆ/g, 'ဿ'],
						[/႐/g, 'ရ'],
						[/႑/g, 'ဏ္ဍ'],
						[/႒/g, 'ဌ'],
						[/႗/g, 'ဋ္ဋ'],
						[/ၠ/g, '္က'],
						[/ၚ/g, 'ါ်'],
						[/၎/g, '၎င်း'],
						[/ဥ်/g, 'ဉ်'],
						[/ႋ/g, 'င်္ိ'],
						[/ႌ/g, 'င်္ီ'],
						[/ႍ/g, 'င်္ံ'],
						[/ႎ/g, 'ိံ'],

						[/ြ([က-အ])/g, '$1ြ'],
						[/ေ([က-အ])/g, '$1ေ'],
						[/([ျြွ])(င်္)/g, '$2$1'],
						[/ေ(င်္)/g, '$1ေ'],
						[/([က-အ])(င်္)/g, '$2$1'],
						[/\u0020(္[က-အ])/g, '$1']
					],
					whileReplace: [
						[/([ါာိီေုူဲံ့း])([ျြွှ])/g, "$2$1"],
						[/ွ([ျြ])/g, "$1ွ"],
						[/ှ([ျြွ])/g, "$1ှ"],
						[/([ုူ])([ိီ])/g, "$2$1"],
						[/ံ([ိီုူ])/g, "$1ံ"],
						[/့([ောါုူဲ])/g, "$1့"],
						[/([ေါာ])(္[က-အ])/g, "$2$1"],
						[/([ါာ])(င်္)/g, "$2$1"]
					]
				}
			}

		},

		/**
		 * Syllable Character Breaking
		 * https://github.com/andjc/jquery.mymr
		 *
		 * License: GPL 3.0
		 * Currently supports: Burmese, Mon, S'gaw Karen
		 *
		 * 2013-04-08
		 */
		syllable: {

			// Zawgyi Font-type "Burmese" break point
			'zawgyi': [
				[/([က-အဣ-ဧဩဪ၌-၏ႆႏ-႒])/g, '\u200B$1'],
				[/([\u1031][\u103b\u107e-\u1084]|[\u1031\u103b\u107e-\u1084])/g, '\u200B$1'],
				[/([\u1031\u103b\u107e-\u1084])\u200B([\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090])/g, '$1$2'],
				[/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014])\u200B([\u1000-\u1021\u1031\u103b\u1025\u1029\u106A\u106B\u107e-\u1084\u1086\u108F\u1090])/g, '$1$2'],
				[/\u200B([\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090]\u1039)/g, '$1'],
				[/(\s|\n)\u200B([က-အဣ-ဧဩဪ၌-၏ႆႏ-႒])/g, '$1$2'],
				[/([က-အ])\u200B([က-အ\u1031\u103b\u107e-\u1084])/g, '$1$2']
			],

			// Unicode5.2 Font-type Burmese break points
			'my': [
				[/(\u103A)(\u1037)/g, "$2$1"],
				[/([က-အဣ-ဧဩဪဿ၌-၏])/g, "\u200B$1"],
				[/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014]|\u1039)\u200B([\u1000-\u1021])/g, "$1$2"],
				[/\u200B(\u1004\u103A\u1039)/g, "$1"],
				[/\u200B([\u1000-\u1021]\u103A)/g, "$1"],
				[/(\s|\n)\u200B([က-အဣ-ဧဩဪဿ၌-၏])/g, "$1$2"],
				[/([က-အ])\u200B([က-အ])/g, "$1$2"]
			],
			'rki': [
				[/(\u103A)(\u1037)/g, "$2$1"],
				[/([က-အဣ-ဧဩဪဿ၌-၏])/g, "\u200B$1"],
				[/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014]|\u1039)\u200B([\u1000-\u1021])/g, "$1$2"],
				[/\u200B(\u1004\u103A\u1039)/g, "$1"],
				[/\u200B([\u1000-\u1021]\u103A)/g, "$1"],
				[/(\s|\n)\u200B([က-အဣ-ဧဩဪဿ၌-၏])/g, "$1$2"],
				[/([က-အ])\u200B([က-အ])/g, "$1$2"]
			],
			'tvn': [
				[/(\u103A)(\u1037)/g, "$2$1"],
				[/([က-အဣ-ဧဩဪဿ၌-၏])/g, "\u200B$1"],
				[/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014]|\u1039)\u200B([\u1000-\u1021])/g, "$1$2"],
				[/\u200B(\u1004\u103A\u1039)/g, "$1"],
				[/\u200B([\u1000-\u1021]\u103A)/g, "$1"],
				[/(\s|\n)\u200B([က-အဣ-ဧဩဪဿ၌-၏])/g, "$1$2"],
				[/([က-အ])\u200B([က-အ])/g, "$1$2"]
			],
			'int': [
				[/(\u103A)(\u1037)/g, "$2$1"],
				[/([က-အဣ-ဧဩဪဿ၌-၏])/g, "\u200B$1"],
				[/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014]|\u1039)\u200B([\u1000-\u1021])/g, "$1$2"],
				[/\u200B(\u1004\u103A\u1039)/g, "$1"],
				[/\u200B([\u1000-\u1021]\u103A)/g, "$1"],
				[/(\s|\n)\u200B([က-အဣ-ဧဩဪဿ၌-၏])/g, "$1$2"],
				[/([က-အ])\u200B([က-အ])/g, "$1$2"]
			],

			// S'gaw Karen break points
			'ksw': [
				[/([\u1000-\u1006\u100a\u1010-\u1012\u1014-\u1016\u1018-\u101f\u1021\u1027\u1061])/g, '\u200B$1'],
				[/(^|[\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|\||>|[\u0021-\u0023\u0025-\u002A\u002C-\u002F\u003A\u003B\u003F\u0040\u005B-\u005D\u005F\u007B\u007D\u00A1\u00A7\u00AB\u00B6\u00B7\u00BB\u00BF\u104A-\u104F\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E]|\u200B)\|/g, '$1']
			],
			'pwo': [],
			'kjp': [],
			'blk': [],

			// Mon break points
			'mnw': [
				[/(\u103A)(\u1037)/g, '$2$1'],
				[/([\u1000-\u1003\u1005-\u1007\u1009-\u1021\u1023\u1025\u1028-\u102A\u105A-\u105D])/g, '\u200B$1'],
				[/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014]|\u1039)\u200B([\u1000-\u1003\u1005-\u1007\u1009-\u1021\u105A-\u105D])/g, '$1$2'],
				[/\u200B([\u1000-\u1003\u1005-\u1007\u1009-\u1021\u105A-\u105D]\u103A)/g, '$1'],
				[/(\s|\n)\u200B([\u1000-\u1003\u1005-\u1007\u1009-\u1021\u1023\u1025\u1028-\u102A\u105A-\u105D])/g, '$1$2']
			],
			'kyu': [],
			'csh': [],

			// Shan break points
			'shn':[
				[/([\u1004\u1010\u1011\u1015\u1019-\u101E\u1022\u1075-\u1081\u109E\u109F])/g, '\u200B$1'],
				[/\u200B([\u1004\u1010\u1011\u1015\u1019-\u101C\u101E\u1022\u1075-\u1079\u107B-\u1081\u109E\u109F]\u103A)/g, '$1'],
				[/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f>\u201C\u2018\-\(\[{\u2012-\u2014])\u200B([\u1004\u1010\u1011\u1015\u1019-\u101E\u1022\u1075-\u1081\u109E\u109F])/g, '$1$2']
			],

			// Khmati Shan break points
			'kht': [
				[/([\u1000\u1002\u1004\u1010\u1011\u1015\u1019-\u101D\u1022\u1075\u1078\u1079\u107B\u107C\u107F\u1080\uAA60-\uAA6F\uAA71-\uAA76])/g, '\u200B$1'],
				[/\u200B([\u1000\u1004\u1010\u1015\u1019\u101D\uAA65\uAA6B]\u103A)/g, '$1'],
				[/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f>\u201C\u2018\-\(\[{\u2012-\u2014])\u200B([\u1000\u1002\u1004\u1010\u1011\u1015\u1019-\u101D\u1022\u1075\u1078\u1079\u107B\u107C\u107F\u1080\uAA60-\uAA6F\uAA71-\uAA76])/g, '$1$2']
			],
			'aio': [],
			'phk': [],
			'tle': [],
			'pll': [],
			'pce': [],
			'rbb': []

		}
	},

	knayi = function(content){
		return new knayi.fn.init(content);
	};

knayi.fn = knayi.prototype = {

	knayi: core_version,

	constructor: knayi,

	init: function(content, fontType){

		var fontType = fontTypes[(fontType || undefined)] || undefined;

		this.content = content;
		this.knyData = {};

		if( !fontType ) {
			fontType = fontDetect(content);
			if( fontType[0].matchTime === 0 ) this.knyData.fontType = undefined;
			else this.knyData.fontType = fontType[0].type;
		}

	},

	/**
	 * Font Converter async
	 * @return {knayi object}
	 */
	fontConvert: function(to, callback){
		var to = to || "unicode5";
		this.edited = fontConvert(this.content, to);

		callback(this.edited, this.content);
		return this;
	},

	/**
	 * Font Converter sync
	 * return {String, String} converted, old
	 */
	fontConvertSync: function(to){
		var to = to || "unicode5";
		return ( this.edited = fontConvert(this.content, to, this.knyData.fontType) );
	},

	syllableSync: function(lang){
		var lang = this.knyData.fontType == "zawgyi" ? "zawgyi": "my";
		return ( this.edited = syllable( this.edited || this.content, lang ) );
	},

	syllable: function(lang, callback){
		var lang = this.knyData.fontType == "zawgyi" ? "zawgyi": "my";
		if(callback)
			return callback(syllable( this.edited || this.content, lang ));
		else
		  return syllbrak( this.edited || this.content, lang );
	},

	getFontType: function(){
		return this.knyData.fontType;
	}

};

knayi.fn.init.prototype = knayi.fn;

/**
 * Font Detector agent
 * @param {String} content
 * @return {Array} result will include detected data
 */
function fontDetect(content){

	var result = [],
		text = content.trim().replace(/\u200B/g, ''),
		lib = library.detect,
		copy, font, match;

	// Loop and Search Match on Library
	for ( font in lib ) {

		var t = 0, j = 0;
		copy = lib[ font ];

		for (; j < copy.length; j++ ) {
			if ( ( match = text.match( copy[j] ) ) ) t += match.length || 0;
		};

		result.push( { type: font, matchTime: t } );

	}

	// Sort most possible first
	result.sort(function(a,b){
		if(a.matchTime < b.matchTime)
			return 1;
		if(a.matchTime > b.matchTime)
			return -1;
		return 0;
	});

	return result;

};

/**
 * Font Converter agent
 *
 * @param {String} text content
 * @param {String} which font to convert. Default: "unicode5";
 * @param {String}[Option] give current font type
 * 		without "form" knayi will first detect what font it's!
 * @return {String} converted text
 */
function fontConvert( content, to, from ) {

	// Trim and Remove break points "\u200B"
	var text = content.trim().replace(/\u200B/, ''),
		detect, dlib, sourceLib;

	// Return when Target font and Current font are same type
	if ( from == to ){
		return content;
	}

	/* Library Searching
	 * If direct library not found, Knayi will find 2 level library
	 */
	if ( ( dlib = library.convert[from] ) ){

		// Searching extensible library!
		if ( !dlib[to] ){

			var rlib;
			var font;

			for( font in dlib ) {
				if( library.convert[font] && library.convert[font][to] ) rlib = font;
			}

			// Return when no more convertible library found
			if( !rlib ) {
				return content;
			}

			text = fontConvert( text, font, from );
			dlib = library.convert[font];

		}

		// Return converted text content
		return util.convert( text, dlib, to );

	} else {
		// Return library not found!
		return content;
	}

};

/**
 * Syllable-Break agent
 *
 * @param {String} text content
 * @param {String} language of content
 * @return {String} edited text content
 */
function syllbreak( text, language ){

	// Detect font when language is not given
	var lang = language || fontDetect( text );

	// Return when not match with any language
	if( !language && lang[0].matchTime < 1 ) return text;
	else if ( !language ) lang = lang[0].type;

	lang = fontType2Lang[ lang ];

	var lib = library.syllable[lang];

	if ( lib ) {
		for (var i = 0; i < lib.length; i++) {
			text = text.replace(lib[i][0], lib[i][1]);
		};
	};

	return text;

};


/**
 * Internal Utility Functions
 */
var util = {

	// Check and replace unwanted spelling error on converting font
	// Supported font-types: unicode5, zawgyi
	spellChecker: function( text, fontType ){

		var $text = text, i = 0,
			rxc,line,match,
			result = [];

		switch( fontType ){

			case 'unicode5':

				var dbreg = "ါ ာ ိ ီ ု ူ ေ ဲ ံ ့ း ် ျ ြ ွ ှ ္".split(" ");

				for (; i < dbreg.length; i++) {

					rxc = new RegExp(dbreg[i]+"{2,}");

					while( (  match = rxc.exec( $text ) ) ) {
						result.push( [ match[0], match.index ] );
						$text = $text.replace(rxc, dbreg[i]);
					}

				}

				// return result and edited text
				return {result: result, text: $text};
				break;
			case 'zawgyi':

				var dbreg = "ါ ာ ိ ီ ု ူ ေ ဲ ဳ ဴ ံ ့ း ္ ် ျ ြ ွ ၚ ၠ ၡ ၢ ၣ ၤ ၥ ၦ ၧ ၨ ၩ ၪ ၫ ၬ ၭ ၰ ၱ ၲ ၳ ၴ ၵ ၶ ၷ ၸ ၹ ၺ ၻ ၼ ၽ ၾ ၿ ႀ ႁ ႂ ႃ ႄ ႅ ႇ ႈ ႉ ႊ ႋ ႌ ႍ ႎ ႓ ႔ ႕ ႖".split(" ");

				for (; i < dbreg.length; i++) {

					rxc = new RegExp(dbreg[i]+"{2,}");

					while( (  match = rxc.exec( $text ) ) ) {
						result.push( [ match[0], match.index ] );
						$text = $text.replace(rxc, dbreg[i]);
					}

				}

				// return result and edited text
				return {result: result, text: $text};
				break;
			default:
				return {result: [], text: $text};
				break;
		}

		return false;

	},

	// Converter with specific
	convert: function( $text, lib, to ){

		var sourceLib = lib[to],
			i = 0, j = 0,
			copy;

		// Replace Single loop RegExp
		for (; i < sourceLib.singleReplace.length; i++ ) {
			$text = $text.replace( sourceLib.singleReplace[i][0], sourceLib.singleReplace[i][1] );
		}

		// Spelling check prevent endless loop!
		$text = util.spellChecker( $text, to ).text;

		for (; j < sourceLib.whileReplace.length; j++) {
			copy = sourceLib.whileReplace[j];
			while( $text.match(copy[0]) ) {
				$text = $text.replace( copy[0], copy[1] );
			}

		}

		return $text;

	}
};

module.exports = knayi;
