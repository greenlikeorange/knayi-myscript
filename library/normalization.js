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

const BURMESE = 'က-ဧဩ';
const C = 'က-အ'
const M = _M.replace(' ', '');
const V = _V.replace(' ', '');
const S = _S.replace(' ', '');
const A = _A.replace(' ', '');
const F = _F.replace(' ', '');
const I = _I.replace(' ', '');
const E = _E.replace(' ', '');
const G = _G.replace(' ', '');
const D = _D.replace(' ', '');
const P = _P.replace(' ', '');

// C{M}{V}{F} | C{M}V+A | C{M}{V}CA[F] | E[CA][F] | I | D | G
const brakePoint = `([${C}${E}])([${M}${V}${A}${F}]*)`;
const brakePointRegex = new RegExp(brakePoint, 'g');

const characterRankMap = {
  // M
  'ျ': 1, 
  'ြ': 2,
  'ွ': 3,
  'ှ': 4,
  // V 
  'ါ': 5,
  'ာ': 6,
  'ိ': 7,
  'ီ': 8,
  'ု': 9,
  'ူ': 10,
  'ေ': 11,
  'ဲ': 12,
  // A
  '်': 13,
  // F
  'ံ': 14,
  '့': 15,
  'း': 16,
};

function normalize(text) {
  return text.replace(brakePointRegex, (p1, p2, p3) => {
    let result = p2;
    const unique = [... new Set(p3)];
    unique.sort((a,b) => characterRankMap[a] - characterRankMap[b])
      .forEach((v) => result += v);
    return result;
  });
}

module.exports = normalize;