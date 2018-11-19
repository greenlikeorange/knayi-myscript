const globalOptions = require('./globalOptions');

const _M = 'ျ ြ ွ ှ';
const _V = 'ါ ာ ိ ီ ု ူ ေ ဲ';
const _S = '္';
const _A = '်';
const _F = 'ံ ့ း';
const _I = 'ဤ ဧ ဪ ၌ ၍ ၏';
const _E = 'ဣ ဥ ဦ ဩ ၎';
const _G = 'ဿ';
const _D = '၀ ၁ ၂ ၃ ၄ ၅ ၆ ၇ ၈ ၉';
const _P = '၊ ။';

function removeSpace(content) {
  return content.replace(/\s/g, '');
}

// Syllable re-ordering
const BURMESE = 'က-ဧဩ';

const C = 'က-အ'
// Medials
const M = removeSpace(_M);
// Dependent Vowel Signs
const V = removeSpace(_V);
// Sign Virama
const S = removeSpace(_S);
// Sign Asat
const A = removeSpace(_A);
// Dependent Various Signs
const F = removeSpace(_F);
// Independent Vowels, Various Signs 
const I = removeSpace(_I);
// Independent Vowels
const E = removeSpace(_E);
// THA GYI 
const G = removeSpace(_G);
// Digits
const D = removeSpace(_D);
// Punctuation Marks
const P = removeSpace(_P);
// ZERO
const ZERO = '၀';

const REGEX_BURMESE = new RegExp(`[${BURMESE}]`);

// Brake point use for normalize
const brakePoint = `([${C}${E}${ZERO}])([${M}${V}${A}${F}]+)`;
const brakePointRegex = new RegExp(brakePoint, 'gm');

/** Extended rules */

let extendedRules = [];
let postExtendedRules = [];
function addReplacementRule(rulesset, [pattern, replacement]) {
  rulesset.push([new RegExp(pattern, 'gm'), replacement]);
}

const ZERO_WA = '၀ ဝ';                // Zero to Wa lone
const U_FIX = 'ဦ ဦ';                  // U
const AWL = 'ဩော် ဪ';               // Awl
const DOUBLE_LONE_GYI_TIN = 'ိီ ီ';
const DOUBLE_TA_CHAUNG_NGIN = 'ုူ ူ';

// Post fix rule
const SPACE_IN_FRONT_OF_VIRAMA = '\\s(္[က-အ]) $1';

addReplacementRule(extendedRules, ZERO_WA.split(' '));
addReplacementRule(extendedRules, U_FIX.split(' '));
addReplacementRule(extendedRules, AWL.split(' '));
addReplacementRule(extendedRules, DOUBLE_LONE_GYI_TIN.split(' '));
addReplacementRule(extendedRules, DOUBLE_TA_CHAUNG_NGIN.split(' '));

addReplacementRule(postExtendedRules, SPACE_IN_FRONT_OF_VIRAMA.split(' '));

/** Extended rules */

const rankingMap = {
  // M
  'ျ': 1,
  'ြ': 2,
  'ွ': 3,
  'ှ': 4,
  // V 
  'ေ': 5,
  'ါ': 6,
  'ာ': 7,
  'ိ': 8,
  'ီ': 9,
  'ု': 10,
  'ူ': 11,
  'ဲ': 12,
  // A
  '်': 13,
  // F
  'ံ': 14,
  '့': 15,
  'း': 16,
};


// Remove duplicated
function uniquify(array) {
  return [...(new Set(array))];
}

// Apply replecement rules
function applyReplacementRules(rulesset, content) {
  return rulesset.reduce((a,b) => {
    return a.replace(b[0], b[1]);
  }, content);
}

/**
 * Normalization basically do transforming text into a single canonical form 
 * @param {String} content Context to normalize
 */
function normalize(content) {
  if (!content) {
    if (!globalOptions.isSilentMode()) console.warn('Content must be specified on knayi.normalize.');
    return '';
  }

  const result = content
    .replace(/\u200B/g, '')
    .replace(brakePointRegex, (m, g1, g2) => {
      let chunk = g1 || '';

      // Re-ordering
      uniquify(g2)
        .sort((a,b) => rankingMap[a] - rankingMap[b])
        .forEach((v) => chunk += v);
     
      return applyReplacementRules(extendedRules, chunk);
    });
  
  return applyReplacementRules(postExtendedRules, result);
}

module.exports = normalize;