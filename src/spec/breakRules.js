// The 15 break rules of 2.x, documented: the readable oracle of the break scanners in src/rules/segment.js (DESIGN.md
// §2.3). Owner: W3 (segment).
//
// spec/ files import nothing, and nothing in src/ imports them; the tests read them, and they are never bundled.
// So their data is a plain literal, not frozen, each string is one literal (DESIGN.md §2.4 rule 2), and their
// prose costs no bytes.
//
// How 2.x broke text (syllable.js breakParts, at the reference e5f6e24): the rows of a font run in order, each a
// global String#replace. The second row puts U+200B before every letter that may start a syllable; the later rows
// delete the U+200B that a join reason matches; then the text is split on U+200B, after dropping one at the start.
// A row with `offWhen` is skipped for the whole text when that pattern matches the text given to breakParts.
//
// Each row is { id, pattern (the 2.x literal), replacement (the 2.x string), offWhen (the 2.x third item, or
// null), why, source, example }. `example` is a synthetic input whose break the row decides at its turn; the
// comment above the row shows it in Myanmar script, with | for the breaks 2.x gives. test/next/segment.test.mjs
// checks every row against scripts/oracle/syllable.js and runs every example.
//
// The precondition is that of 2.x: the text has no U+200B or U+200C (2.x always cleans it first).

export const BREAK_RULES = {
  unicode: [
    // သင့် typed with asat before the dot below: no break, and the two marks swap.
    {
      id: 'U1',
      pattern: /(\u103A)(\u1037)/g,
      replacement: '$2$1',
      offWhen: null,
      why: 'Puts a dot below typed after asat before it, the order Unicode stores. The break text keeps this order: 2.x breakParts returns the reordered text, and the lossless segmentation of 3.0 reads it only to decide the breaks.',
      source: 'UTN #11 (dot below before asat); kept from 2.x',
      example: '\u101E\u1004\u103A\u1037'
    },
    // မြန်မာ -> မြန်|မာ
    {
      id: 'U2',
      pattern: /([\u1000-\u1021\u1023-\u1027\u1029\u102a\u103f\u104c-\u104f])/g,
      replacement: '\u200B$1',
      offWhen: null,
      why: 'Puts a break before every letter that may start a syllable: the consonants, the independent vowels but U+1022 and U+1028, great sa and the symbols U+104C-U+104F. The rows after it delete the breaks before letters that do not start one. U+1022 and U+1028 are syllable bases to the readers but not here.',
      source: 'UTN #11 (a syllable starts with a consonant or an independent vowel); U+1022 and U+1028 kept out as in 2.x, evidence not recorded',
      example: '\u1019\u103C\u1014\u103A\u1019\u102C'
    },
    // ကာ (ခါ) -> ကာ (ခါ): no break after the opening bracket.
    {
      id: 'U3',
      pattern: /([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014]|\u1039)\u200B([\u1000-\u1021])/g,
      replacement: '$1$2',
      offWhen: null,
      why: 'A consonant after a virama is stacked under the consonant before it, in the same syllable. A consonant after a space or an opening mark (> U+201C U+2018 - ( [ { and the dashes U+2012-U+2014) gets no break either: a space already separates the words, and an opening mark stays with the word it opens. The scanners keep the space and opening-mark part under PAIRS only: under CHAINS and SEPARATE a syllable after white space starts a piece, with the opening marks typed right before it (DESIGN.md §11.6).',
      source: 'UTN #11 (virama stacks the next consonant); the opening marks kept from 2.x, evidence not recorded',
      example: '\u1000\u102C (\u1001\u102B)'
    },
    // က, then a kinzi with a dot below: no break before the nga. Row U5 would keep it too.
    {
      id: 'U4',
      pattern: /\u200B(\u1004\u103A\u1039\u1037)/g,
      replacement: '$1',
      offWhen: null,
      why: 'A kinzi followed by a dot below stays with the syllable before it. Row U5 keeps every consonant with asat there, the nga of a kinzi included, so this row never decides a break: the scanner has no predicate for it, and the tests check that the rows give the same breaks without it.',
      source: 'kept from 2.x: 52af904 (2019) narrowed it from every kinzi to a kinzi with a dot below; evidence not recorded',
      example: '\u1000\u1004\u103A\u1039\u1037'
    },
    // ဖြင့် and ညဥ့် stay whole; ထွူ|လဲ|ဥ်း (Pa'o) breaks before ဥ.
    {
      id: 'U5',
      pattern: /\u200B([\u1000-\u1021][\u1037\u1038]*\u103A)|([\u1000-\u1021\u103B-\u103E])\u200B(\u1025[\u1037\u1038]*\u103A)/g,
      replacement: '$1$2$3',
      offWhen: null,
      why: 'A consonant with asat is the final of the syllable before it, also with a dot below or a visarga typed between them (U+1016 U+103C U+1004 U+1037 U+103A). U+1025 with asat is typed for nya, as in the one syllable U+100A U+1025 U+1037 U+103A, so it joins too, but only right after a consonant or medial: after a vowel sign it starts a syllable, as Pa\'o writes it.',
      source: 'UTN #11 (asat kills the inherent vowel of a final); 41e18bf (17,980 of 206,642 Wikipedia and Okell words) and 73214a3 (20 of 770 GlotCC Pa\'o lines)',
      example: '\u1016\u103C\u1004\u1037\u103A'
    },
    // ကာ ဥ: no break after the space.
    {
      id: 'U6',
      pattern: /(\s|\n)\u200B([\u1000-\u1021\u1023-\u1027\u1029\u102a\u103f\u104c-\u104f])/g,
      replacement: '$1$2',
      offWhen: null,
      why: 'A letter after white space (JavaScript \\s) gets no break: the space already separates the pieces. Row U3 covers the consonants after the common spaces; this row covers the other letters and spaces. The scanners keep it under PAIRS only: under CHAINS and SEPARATE white space separates syllables (DESIGN.md §11.6).',
      source: 'kept from 2.x; evidence not recorded',
      example: '\u1000\u102C \u1025'
    },
    // ကကက -> ကက|က
    {
      id: 'U7',
      pattern: /([\u1000-\u1021])\u200B([\u1000-\u1021])/g,
      replacement: '$1$2',
      offWhen: null,
      why: 'A bare consonant joins the consonant after it, as in the word U+1000 U+1000. A global replace does not look again at the consonant it just joined, so 2.x joins pairs only: three bare consonants break as two and one, which the comment of 2.x syllable.js:239 does not intend. The scanner reproduces the pairs in legacyBareConsonantPair; the 3.0 policy is decision 34\'s to make.',
      source: 'kept from 2.x; DESIGN.md §10 Q11 and decision 34',
      example: '\u1000\u1000\u1000'
    }
  ],
  zawgyi: [
    // မာမာ -> မာ|မာ
    {
      id: 'Z1',
      pattern: /([\u1000-\u1021\u1023-\u1027\u1029\u102a\u104c-\u104f\u1086\u108f-\u1092])/g,
      replacement: '\u200B$1',
      offWhen: null,
      why: 'Puts a break before every letter that may start a syllable: the consonants, the independent vowels but U+1022 and U+1028, the symbols U+104C-U+104F and the Zawgyi letters U+1086 and U+108F-U+1092. These do not match the bases of the Zawgyi glyph table (rows Z3, Z5 and Z8 use another class): the two stay separate until someone unifies them on purpose (DESIGN.md §10 Q17).',
      source: 'kept from 2.x; evidence not recorded',
      example: '\u1019\u102C\u1019\u102C'
    },
    // ပါေသ -> ပါ|ေသ
    {
      id: 'Z2',
      pattern: /([\u1031][\u103b\u107e-\u1084]|[\u1031\u103b\u107e-\u1084])/g,
      replacement: '\u200B$1',
      offWhen: null,
      why: 'Zawgyi stores e and the medial ra glyphs before the consonant, in drawing order, so a syllable may start with them: a break before each of them, but none between e and a medial ra typed right after it.',
      source: 'research/zawgyi-to-unicode.md §2 (drawing order)',
      example: '\u1015\u102B\u1031\u101E'
    },
    // ၾကပါ -> ၾက|ပါ
    {
      id: 'Z3',
      pattern: /([\u1031\u103b\u107e-\u1084])\u200B([\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090])/g,
      replacement: '$1$2',
      offWhen: null,
      why: 'An e or medial ra typed before a base belongs to that base: no break between them.',
      source: 'research/zawgyi-to-unicode.md §2 (drawing order); b982c98',
      example: '\u107E\u1000\u1015\u102B'
    },
    // (ေက) -> (ေက): no break after the opening bracket.
    {
      id: 'Z4',
      pattern: /([\u0009-\u000d\u0020\u00a0\u2000-\u200a\u2028\u2029\u202f]|>|\u201C|\u2018|\-|\(|\[|{|[\u2012-\u2014])\u200B([\u1000-\u1021\u1031\u103b\u1025\u1029\u106A\u106B\u107e-\u1084\u1086\u108F\u1090])/g,
      replacement: '$1$2',
      offWhen: null,
      why: 'A base or a prebase glyph after a space or an opening mark gets no break, as in Unicode row U3, and under PAIRS only, as row U3 is.',
      source: 'kept from 2.x; evidence not recorded',
      example: '(\u1031\u1000)'
    },
    // မငး္ and ေၾကာင့္ keep their final: no break before the င.
    {
      id: 'Z5',
      pattern: /\u200B([\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090][\u1037\u1038\u1094\u1095]*\u1039)/g,
      replacement: '$1',
      offWhen: null,
      why: 'A base with asat (U+1039 in Zawgyi) is the final of the syllable before it, also with dots below or a visarga typed before the asat.',
      source: 'UTN #11 (asat kills the inherent vowel of a final); b982c98, and a2d6e49 (51 of 9,987 mC4 Zawgyi lines)',
      example: '\u1019\u1004\u1038\u1039'
    },
    // ျခေသၤ့ stays whole.
    {
      id: 'Z6',
      pattern: /\u200B([\u1031\u103b\u107e-\u1084]*[\u1000-\u1021][\u1064\u108b-\u108d])/g,
      replacement: '$1',
      offWhen: /[\u1062\u1063]\u103a/,
      why: 'Zawgyi writes kinzi (U+1064, or U+108B-U+108D with a vowel) after the consonant it sits on, but it is the final nga of the syllable before, so that consonant, and any e or medial ra typed before it, stays there. S\'gaw Karen uses U+1064 as a tone mark, and its text is often detected as Zawgyi, so the row is off for text with a Karen vowel and asat (U+1062 or U+1063, then U+103A), which Zawgyi text practically never has: looksLikeSgawKaren.',
      source: 'UTN #11 (kinzi is the final nga of the syllable before); b982c98, and a2d6e49 (308 of 673 GlotCC Karen lines)',
      example: '\u103B\u1001\u1031\u101E\u1064\u1037'
    },
    // ကာ ဧ: no break after the space.
    {
      id: 'Z7',
      pattern: /(\s|\n)\u200B([\u1000-\u1021\u1023-\u1027\u1029\u102a\u104c-\u104f\u1086\u108f-\u1092])/g,
      replacement: '$1$2',
      offWhen: null,
      why: 'A letter after white space (JavaScript \\s) gets no break, as in Unicode row U6, and under PAIRS only, as row U6 is.',
      source: 'kept from 2.x; evidence not recorded',
      example: '\u1000\u102C \u1027'
    },
    // ကကက -> ကက|က; ကၾကပါ -> ကၾက|ပါ
    {
      id: 'Z8',
      pattern: /([\u1031\u103b\u107e-\u1084]+[\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090])|([\u1000-\u1021])\u200B([\u1031\u103b\u107e-\u1084]+[\u1000-\u1021\u1025\u1029\u106A\u106B\u1086\u108F\u1090]|[\u1000-\u1021\u1031\u103b\u107e-\u1084])/g,
      replacement: '$1$2$3',
      offWhen: null,
      why: 'A bare consonant joins what follows it: a consonant, a base with e or medial ra typed before it, or an e or medial ra with no base after it. A consonant typed after e or a medial ra already has its marks, like the consonant with medial ra in Unicode, so the first branch takes it whole and it joins nothing. As in row U7, a global replace joins pairs only.',
      source: 'b982c98 (200,214 of 206,642 Wikipedia and Okell words break as in Unicode, up from 162,225); DESIGN.md §10 Q11 and decision 34',
      example: '\u1000\u107E\u1000\u1015\u102B'
    }
  ]
};
