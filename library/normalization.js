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

'က ဃ စ ဆ ဇ ဈ'

// Syllable re-ordering
const BURMESE = 'က-ဧဩ';

const C = 'က-အ'
// Medials
const M = _M.replace(' ', '');
// Dependent Vowel Signs
const V = _V.replace(' ', '');
// Sign Virama
const S = _S.replace(' ', '');
// Sign Asat
const A = _A.replace(' ', '');
// Dependent Various Signs
const F = _F.replace(' ', '');
// Independent Vowels, Various Signs 
const I = _I.replace(' ', '');
// Independent Vowels
const E = _E.replace(' ', '');
// THA GYI 
const G = _G.replace(' ', '');
// Digits
const D = _D.replace(' ', '');
// Punctuation Marks
const P = _P.replace(' ', '');
// ZERO
const ZERO = '၀';

/** Extended rules */

const ZERO_WA = '၀ ဝ';                // Zero to Wa lone
const U_FIX = 'ဦ ဦ';                  // U
const AWL = 'ဩော် ဪ';               // Awl
const DOUBLE_LONE_GYI_TIN = 'ိီ ီ';
const DOUBLE_TA_CHAUNG_NGIN = 'ုူ ူ';

const REGEX_BURMESE = new RegExp(`[${BURMESE}]`);

// Brake point use for normalize
const brakePoint = `([${C}${E}${ZERO}])([${M}${V}${A}${F}]+)`;
const brakePointRegex = new RegExp(brakePoint, 'gm');

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

let extendedRules = [];
function addExtededRules([pattern, replacement]) {
  extendedRules.push([new RegExp(pattern, 'gm'), replacement]);
}

addExtededRules(ZERO_WA.split(' '));
addExtededRules(U_FIX.split(' '));
addExtededRules(AWL.split(' '));
addExtededRules(DOUBLE_LONE_GYI_TIN.split(' '));
addExtededRules(DOUBLE_TA_CHAUNG_NGIN.split(' '));

// Remove duplicated
function uniquify(array) {
  return [...(new Set(array))];
}

// Fix extended rules
function fixExtended(content) {
  return extendedRules.reduce((a,b) => {
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
  
  return content
    .replace(/\u200B/g, '')
    .replace(brakePointRegex, (m, g1, g2) => {
      let result = g1;

      // Re-ordering
      uniquify(g2)
        .sort((a,b) => rankingMap[a] - rankingMap[b])
        .forEach((v) => result += v);
     
      return fixExtended(result);
    });
}

module.exports = normalize;