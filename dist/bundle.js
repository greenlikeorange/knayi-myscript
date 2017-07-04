!function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a="function"==typeof require&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n||e)},l,l.exports,e,t,n,r)}return n[o].exports}for(var i="function"==typeof require&&require,o=0;o<r.length;o++)s(r[o]);return s}({1:[function(require,module,exports){var spellingFix=require("./spellingCheck"),fontDetect=require("./detector"),fontTypes={unicode:"unicode",uni:"unicode",zawgyi:"zawgyi",zaw:"zawgyi"},mmCharacterRange=/[\u1000-\u109F]/,library={};library.convert={unicode:{zawgyi:{oneTime:[[/([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u102f/g,"$1ဳ"],[/([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u1030/g,"$1ဴ"],[/([\u1000-\u1021](\u1039[\u1000-\u1021]|[\u103b\u103c\u103d]+)[\u102d\u102e\u1031\u1032\u1036\u1037\u103e]*)\u1037/g,"$1႔"],[/([\u1000-\u1021])\u103b([\u103d][\u103e]*)/g,"$1ၽ$2"],[/([\u102f\u1030])[\u1037\u1094]/g,"$1႕"],[/([\u1000-\u1021])\u103c/g,"ြ$1"],[/([\u1000-\u1021][^\u1000-\u1021]*)\u1031/g,"ေ$1"],[/\u103c\u1031/g,"ေြ"],[/\u1014\u103d/g,"ႏွ"],[/\u104e\u1004\u103a\u1038/g,"၎"],[/\u102b\u103a/g,"ၚ"],[/\u103f/g,"ႆ"],[/\u1039\u101c/g,"ႅ"],[/\u1039\u1019/g,"ၼ"],[/\u1039\u1018/g,"ၻ"],[/\u1039\u1017/g,"ၺ"],[/\u1039\u1016/g,"ၹ"],[/\u1039\u1016/g,"ၹ"],[/\u1039\u1015/g,"ၸ"],[/\u1039\u1014/g,"ၷ"],[/\u1039\u1013/g,"ၶ"],[/\u1039\u1012/g,"ၵ"],[/\u1039\u1011/g,"ၳ"],[/\u1039\u1010/g,"ၱ"],[/\u1039\u100f/g,"ၰ"],[/\u100e\u1039\u100d/g,"ၯ"],[/\u100f\u1039\u100d/g,"႑"],[/\u100d\u1039\u100d/g,"ၮ"],[/\u1039\u100c/g,"ၭ"],[/\u1039\u100b/g,"ၬ"],[/\u1009/g,"ၪ"],[/\u1039\u1005\u103b/g,"ၩ"],[/\u1039\u1007/g,"ၨ"],[/\u1039\u1006/g,"ၦ"],[/\u1039\u1005/g,"ၥ"],[/\u1039\u1003/g,"ၣ"],[/\u100c/g,"႒"],[/\u1039\u1002/g,"ၢ"],[/\u1039\u1001/g,"ၡ"],[/\u103d\u103e/g,"ႊ"],[/\u103e\u1030/g,"ႉ"],[/\u1039\u1000/g,"ၠ"],[/\u100b\u1039\u100b/g,"႗"],[/\u1004\u103a\u1039/g,"ၤ"],[/\u103e\u102f/g,"ႈ"],[/\u1037/g,"့"],[/\u103a/g,"္"],[/\u103b/g,"်"],[/\u103c/g,"ျ"],[/\u103d/g,"ြ"],[/\u103e/g,"ွ"]],asFoundAs:[[/([\u103b\u103c\u103d\u103e])\u1031/g,"ေ$1"],[/\u103b([\u1000\u1003\u1006\u100f\u1010\u1011\u1018\u101a\u101c\u101e\u101f\u1021])/g,"ၾ$1"],[/\u103b([\u1000-\u1021](\u103c\u103d|\u108a|\u103c)[\u102d\u102e])/g,"ႃ$1"],[/\u107e([\u1000-\u1021](\u103c\u103d|\u108a|\u103c)[\u102d\u102e])/g,"ႄ$1"],[/\u103b([\u1000-\u1021][\u102d\u102e])/g,"ၿ$1"],[/\u107e([\u1000-\u1021][\u102d\u102e])/g,"ႀ$1"],[/\u103b([\u1000-\u1021][\u103c])/g,"ႁ$1"],[/\u107e([\u1000-\u1021][\u103c])/g,"ႂ$1"]]}},zawgyi:{unicode:{oneTime:[[/([^\u1040-\u1049\+\-\*\/])?\u1040([^\u1040-\u1049\+\-\*\/])?/g,"$1ဝ$2"],[/\u103d|\u1087/g,"ှ"],[/\u103c/g,"ွ"],[/[\u103b\u107e-\u1084]/g,"ြ"],[/[\u103a\u107d]/g,"ျ"],[/\u1039/g,"်"],[/[\u1094-\u1095]/g,"့"],[/[\u107b\u1093]/g,"္ဘ"],[/\u1033/g,"ု"],[/\u1034/g,"ူ"],[/\u1088/g,"ှု"],[/\u1089/g,"ှူ"],[/\u108a/g,"ွှ"],[/\u1061/g,"္ခ"],[/\u108f/g,"န"],[/\u1062/g,"္ဂ"],[/\u1063/g,"္ဃ"],[/\u1065/g,"္စ"],[/\u1066/g,"္ဆ"],[/\u1068/g,"္ဇ"],[/\u1069/g,"္စျ"],[/\u106a/g,"ဉ"],[/\u106b/g,"ည"],[/\u106c/g,"္ဋ"],[/\u106d/g,"္ဌ"],[/\u106e/g,"ဍ္ဍ"],[/\u106f/g,"ဎ္ဍ"],[/\u1070/g,"္ဏ"],[/\u1071/g,"္တ"],[/\u1073/g,"္ထ"],[/\u1075/g,"္ဒ"],[/\u1076/g,"္ဓ"],[/\u1077/g,"္န"],[/\u1078/g,"္ပ"],[/\u1079/g,"္ဖ"],[/\u1079/g,"္ဖ"],[/\u107a/g,"္ဗ"],[/\u107c/g,"္မ"],[/\u1085/g,"္လ"],[/\u1086/g,"ဿ"],[/\u1090/g,"ရ"],[/\u1091/g,"ဏ္ဍ"],[/\u1092/g,"ဌ"],[/\u1097/g,"ဋ္ဋ"],[/\u1060/g,"္က"],[/\u105a/g,"ါ်"],[/\u104e/g,"၎င်း"],[/\u1025\u103a/g,"ဉ်"],[/([\u1000-\u1021])\u108b/g,"ၤ$1ိ"],[/([\u1000-\u1021])\u108c/g,"ၤ$1ီ"],[/([\u1000-\u1021])\u108d/g,"ၤ$1ံ"],[/\u108e/g,"ိံ"],[/\u103c([\u1000-\u1021])/g,"$1ြ"],[/\u1031([\u1000-\u1021])/g,"$1ေ"],[/([\u103b\u103c\u103d])(\u1064)/g,"$2$1"],[/\u1031(\u1064)/g,"$1ေ"],[/([\u1000-\u1021])(\u1064)/g,"$2$1"],[/\u0020(\u1039[\u1000-\u1021])/g,"$1"],[/\u1064/g,"င်္"]],asFoundAs:[[/([\u102b\u102c\u102d\u102e\u1031\u102f\u1030\u1032\u1036\u1037\u1038])([\u103b\u103c\u103d\u103e])/g,"$2$1"],[/\u103d([\u103b\u103c])/g,"$1ွ"],[/\u103e([\u103b\u103c\u103d])/g,"$1ှ"],[/([\u102f\u1030])([\u102d\u102e])/g,"$2$1"],[/\u1036([\u102d\u102e\u102f\u1030])/g,"$1ံ"],[/\u1037([\u1031\u102c\u102b\u102f\u1030\u1032])/g,"$1့"],[/([\u1031\u102b\u102c])(\u1039[\u1000-\u1021])/g,"$2$1"],[/([\u102b\u102c])(\u1004\u103a\u1039)/g,"$2$1"]]}}},module.exports=function(content,to,from){if(!content)throw new Error("Content must be specified on knayi.fontConvert");if(""===content||!mmCharacterRange.test(content))return content;if(!to)throw new Error("convertTo must be specified on knayi.fontConvert");if(content=content.trim().replace(/\u200B/g,""),to=fontTypes[to],from=fontTypes[from],!to)return console.error("Convert library dosen't this fontType to convert"),content;if(from||(from=fontDetect(content)),to===from)return content;content=spellingFix(content,from);for(var refLib=library.convert[from][to],i=0;i<refLib.oneTime.length;i++){var rule1=refLib.oneTime[i];content=content.replace(rule1[0],rule1[1])}for(var j=0;j<refLib.asFoundAs.length;j++)for(var rule2=refLib.asFoundAs[j];rule2[0].test(content);)content=content.replace(rule2[0],rule2[1]);return content}},{"./detector":2,"./spellingCheck":3}],2:[function(require,module,exports){var mmCharacterRange=/[\u1000-\u109F]/,library={};library.detect={unicode:["ှ","ဿ","ည်","န်","င်","ေး","ော","်း","ဵ","[ၐ-ၙ]","^([က-အ]ြ|[က-အ]ေ)"],zawgyi:["ာ္","်ာ","[\\x20\\t\\r\\n\\f](ျ|ေ|[ၾ-ႄ])[က-အ]","^(ျ|ေ|[ၾ-ႄ])[က-အ]","[က-အ]္[^က-အ]","ဥ္","္း","[ါ-ူေ်း](ျ|[ၾ-ႄ])[က-အ]","ံု","[က-အ]္ေ","ၤ","္[\\x20\\t\\r\\n\\f]","ာေ","[ါ-ူ်း]ေ[က-အ]","ေေ","ုိ","္$"]},Object.keys(library.detect).forEach(type=>{for(var i=0;i<library.detect[type].length;i++)library.detect[type][i]=new RegExp(library.detect[type][i],"g")}),module.exports=function(content,def){if(!content)throw new Error("Content must be specified on knayi.fontDetect");if(""===content)return content;if(!mmCharacterRange.test(content))return def;content=content.trim().replace(/\u200B/g,""),def=def||"zawgyi";var match={};for(var type in library.detect){match[type]=0;for(var i=0;i<library.detect[type].length;i++){var rule=library.detect[type][i],m=content.match(rule);match[type]+=m&&m.length||0}}return match.unicode>match.zawgyi?"unicode":match.unicode<match.zawgyi?"zawgyi":def}},{}],3:[function(require,module,exports){var fontDetect=require("./detector"),mmCharacterRange=/[\u1000-\u109F]/,library={};library.spellingFix={unicode:"ါ ာ ိ ီ ု ူ ေ ဲ ံ ့ း ် ျ ြ ွ ှ ္".split(" "),zawgyi:"ါ ာ ိ ီ ု ူ ေ ဲ ဳ ဴ ံ ့ း ္ ် ျ ြ ွ ၚ ၠ ၡ ၢ ၣ ၤ ၥ ၦ ၧ ၨ ၩ ၪ ၫ ၬ ၭ ၰ ၱ ၲ ၳ ၴ ၵ ၶ ၷ ၸ ၹ ၺ ၻ ၼ ၽ ၾ ၿ ႀ ႁ ႂ ႃ ႄ ႅ ႇ ႈ ႉ ႊ ႋ ႌ ႍ ႎ ႓ ႔ ႕ ႖".split(" ")},library.spellingFix.unicode=library.spellingFix.unicode.map(function(exp){return[new RegExp(`[${exp}]{2,}`,"g"),exp]}),library.spellingFix.zawgyi=library.spellingFix.zawgyi.map(function(exp){return[new RegExp(`[${exp}]{2,}`,"g"),exp]}),module.exports=function(content,fontType){if(!content)throw new Error("Content must be specified on knayi.fontConvert");if(""===content||!mmCharacterRange.test(content))return content;switch(fontType||(fontType=fontDetect(content)),content=content.trim().replace(/\u200B/g,""),fontType){case"zawgyi":for(i=0;i<library.spellingFix.zawgyi.length;i++)rule=library.spellingFix.zawgyi[i],content=content.replace(rule[0],rule[1]);return content;case"unicode":default:for(var i=0;i<library.spellingFix.unicode.length;i++){var rule=library.spellingFix.unicode[i];content=content.replace(rule[0],rule[1])}return content}}},{"./detector":2}],4:[function(require,module,exports){var fontDetect=require("./detector"),mmCharacterRange=/[\u1000-\u109F]/,library={};library.syllable={zawgyi:[[/([\u1000-\u1021\u1023-\u1027\u1029\u102a\u104c-\u104f\u1086\u108f-\u1092])/g,"​$1"],[/([\u1031][\u103b\u107e-\u1084]|[\u1031\u103b\u107e-\u1084])/g,"​$1"],[/([\u1031\u103b\u107e-\u1084])\u200B([\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090])/g,"$1$2"],[/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014])\u200B([\u1000-\u1021\u1031\u103b\u1025\u1029\u106A\u106B\u107e-\u1084\u1086\u108F\u1090])/g,"$1$2"],[/\u200B([\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090]\u1039)/g,"$1"],[/(\s|\n)\u200B([\u1000-\u1021\u1023-\u1027\u1029\u102a\u104c-\u104f\u1086\u108f-\u1092])/g,"$1$2"],[/([\u1000-\u1021])\u200B([\u1000-\u1021\u1031\u103b\u107e-\u1084])/g,"$1$2"]],unicode:[[/(\u103A)(\u1037)/g,"$2$1"],[/([\u1000-\u1021\u1023-\u1027\u1029\u102a\u103f\u104c-\u104f])/g,"​$1"],[/([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014]|\u1039)\u200B([\u1000-\u1021])/g,"$1$2"],[/\u200B(\u1004\u103A\u1039)/g,"$1"],[/\u200B([\u1000-\u1021]\u103A)/g,"$1"],[/(\s|\n)\u200B([\u1000-\u1021\u1023-\u1027\u1029\u102a\u103f\u104c-\u104f])/g,"$1$2"],[/([\u1000-\u1021])\u200B([\u1000-\u1021])/g,"$1$2"]]},module.exports=function(content,fontType,breakpoint){if(!content)throw new Error("Content must be specified on knayi.fontConvert");if(""===content||!mmCharacterRange.test(content))return content;content=content.trim().replace(/\u200B/g,""),fontType||(fontType=fontDetect(content)),breakpoint||(breakpoint="​");for(var lib=library.syllable[fontType],i=0;i<lib.length;i++)content=content.replace(lib[i][0],lib[i][1]);return content}},{"./detector":2}],5:[function(require,module,exports){var fontDetect=require("./library/detector"),fontConvert=require("./library/converter"),syllBreak=require("./library/syllBreak"),spellingFix=require("./library/spellingCheck");"undefined"!=typeof window&&(window.knayi={fontDetect:fontDetect,fontConvert:fontConvert,syllBreak:syllBreak,spellingFix:spellingFix}),module.exports={fontDetect:fontDetect,fontConvert:fontConvert,syllBreak:syllBreak,spellingFix:spellingFix}},{"./library/converter":1,"./library/detector":2,"./library/spellingCheck":3,"./library/syllBreak":4}]},{},[5]);
