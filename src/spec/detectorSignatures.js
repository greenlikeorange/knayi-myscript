// The 29 detector signatures, documented: the readable oracle of countEvidence (DESIGN.md §2.3). Owner: W4
// (detect).
//
// spec/ files import nothing, and nothing in src/ imports them; the tests read them, and they are never bundled.
// So their data is a plain literal, not frozen.
//
// 12 Unicode rows U01-U12, then 17 Zawgyi rows Z01-Z17, in 2.x order (library/detector.js at the reference,
// e5f6e24; scripts/oracle/signatures.js). Each row is:
//   id       the id that src/rules/detect.js cites in its comments;
//   side     the side its matches count for: 'unicode' or 'zawgyi';
//   pattern  the 2.x source string, byte for byte, with 2.x's whitespace class '[\\x20\\t\\r\\n\\f]' written out.
//            2.x compiled it with new RegExp(pattern, 'g') and added the length of String#match to its side, so a
//            row counts the matches that do not overlap, and ^ and $ anchor it to the start and end of the text;
//   why      what the row detects, and why it is evidence of its side;
//   source   the evidence for the row, and where the readings it relies on come from;
//   example  a hand-written string the pattern matches (decision 22), with what it is in the why.
//
// The readings. Both encodings put Burmese on the Unicode code points U+1000-U+109F, with different meanings and
// in a different order:
// - Unicode stores each syllable in UTN #11 order: kinzi, the consonant, stacked consonants, medials (ya U+103B,
//   ra U+103C, wa U+103D, ha U+103E), e (U+1031), the other vowel signs, anusvara, dot below, asat (U+103A) and
//   visarga. U+1039 is the virama, which stacks the consonant after it, so a consonant always follows it.
// - Zawgyi stores glyphs in drawing order: e and medial ra before their consonant, kinzi after it. Its asat is
//   U+1039, its medial ya U+103A, medial ra U+103B and U+107E-U+1084, medial wa U+103C, medial ha U+103D and
//   U+1087, great sa U+1086 and kinzi U+1064 (the glyph table: research/zawgyi-to-unicode.md §2; library/zawgyi.js).
//
// Most rows have been in the detector since before 2.9, and their evidence was not recorded: their source says so.
// The detector is judged as a whole by the benchmark (npm run eval), not row by row.

const KEPT = 'kept from 2.x; evidence not recorded';
const UTN11 = 'Reading: UTN #11 storage order';
const GLYPHS = 'Reading: the Zawgyi glyph table (research/zawgyi-to-unicode.md §2)';

// The rows are built by a function, called once, so that their prose may be split over lines: a top-level
// initialiser of src/ holds literals only (§2.4 rule 2).
export const DETECTOR_SIGNATURES = /* @__PURE__ */ detectorSignatures();

function detectorSignatures() {
  return [
    // Unicode.
    {
      id: 'U01',
      side: 'unicode',
      pattern: '\u103e',
      why: 'Medial ha, U+103E. Zawgyi writes medial ha as U+103D or U+1087, and reads U+103E only as Unicode\'s ha ' +
        'in mixed text. The example is hma, from.',
      source: KEPT + '. ' + GLYPHS,
      example: '\u1019\u103e'
    },
    {
      id: 'U02',
      side: 'unicode',
      pattern: '\u103f',
      why: 'Great sa, U+103F. Zawgyi draws great sa at U+1086 and has no glyph at U+103F. The example is peittha, ' +
        'the viss.',
      source: KEPT + '. ' + GLYPHS,
      example: '\u1015\u102d\u103f'
    },
    {
      id: 'U03',
      side: 'unicode',
      pattern: '\u100a\u103a',
      why: 'Nya with asat, a common final. In Zawgyi, U+103A after nya would be medial ya on nya. The example is ' +
        'pyi, country.',
      source: KEPT + '. ' + GLYPHS,
      example: '\u1015\u103c\u100a\u103a'
    },
    {
      id: 'U04',
      side: 'unicode',
      pattern: '\u1014\u103a',
      why: 'Na with asat, a common final. In Zawgyi, U+103A after na would be medial ya on na. The example is ' +
        'myanma.',
      source: KEPT + '. ' + GLYPHS,
      example: '\u1019\u103c\u1014\u103a\u1019\u102c'
    },
    {
      id: 'U05',
      side: 'unicode',
      pattern: '\u1004\u103a',
      why: 'Nga with asat: the final -in, and the start of a kinzi (U+1004 U+103A U+1039). Zawgyi writes that asat ' +
        'as U+1039 and kinzi as U+1064; U+103A after nga would be medial ya. The example is pin, tree.',
      source: KEPT + '. ' + GLYPHS,
      example: '\u1015\u1004\u103a'
    },
    {
      id: 'U06',
      side: 'unicode',
      pattern: '\u1031\u1038',
      why: 'e, then visarga. Unicode stores e after its consonant, so the syllable\'s visarga can follow it. Zawgyi ' +
        'types e before its consonant, so a consonant follows e. The example is zei, market.',
      source: KEPT + '. ' + UTN11,
      example: '\u1008\u1031\u1038'
    },
    {
      id: 'U07',
      side: 'unicode',
      pattern: '\u1031\u102c',
      why: 'e, then aa: the vowel aw in Unicode order, where e and aa both follow the consonant. In Zawgyi the ' +
        'consonant sits between them. The example is thaw.',
      source: KEPT + '. ' + UTN11,
      example: '\u101e\u1031\u102c'
    },
    {
      id: 'U08',
      side: 'unicode',
      pattern: '\u103a\u1038',
      why: 'Asat, then visarga, a common ending. Zawgyi writes asat as U+1039 (row Z07); its U+103A is medial ya. ' +
        'The example is min, king.',
      source: KEPT + '. ' + GLYPHS,
      example: '\u1019\u1004\u103a\u1038'
    },
    {
      id: 'U09',
      side: 'unicode',
      pattern: '\u1035',
      why: 'Vowel sign e above, U+1035, which Unicode 5.1 added for Mon. The Zawgyi glyph table has no entry for ' +
        'it. The example is the Mon word ka.',
      source: KEPT + '. ' + GLYPHS,
      example: '\u1000\u1035'
    },
    {
      id: 'U10',
      side: 'unicode',
      pattern: '[\u1050-\u1059]',
      why: 'The Pali and Sanskrit letters sha, ssa, vocalic r, rr, l and ll, and their vowel signs, U+1050-U+1059, ' +
        'which Unicode 5.1 added. The Zawgyi glyph table has none of them: its own shapes are U+105A and ' +
        'U+1060-U+1097. The example is sha.',
      source: KEPT + '. ' + GLYPHS,
      example: '\u1050'
    },
    {
      id: 'U11',
      side: 'unicode',
      pattern: '^([\u1000-\u1021]\u103c|[\u1000-\u1021]\u1031)',
      why: 'Text that starts with a consonant, then medial ra or e: Unicode stores both after their consonant, ' +
        'Zawgyi before it (row Z04). Anchored to the start of the text, so it matches at most once. In Zawgyi, ' +
        'U+103C is medial wa, so Zawgyi text that starts with a consonant and medial wa matches too. The example ' +
        'is kyet, chicken.',
      source: KEPT + '. ' + UTN11,
      example: '\u1000\u103c\u1000\u103a'
    },
    {
      id: 'U12',
      side: 'unicode',
      pattern: '[\u1000-\u1021]\u103b(?![\u1000-\u1021])',
      why: 'A consonant with medial ya, U+103B, and no consonant after it. In Zawgyi, U+103B is medial ra, typed ' +
        'before the next consonant, so a consonant, U+103B and a consonant is Zawgyi, and the row leaves it out. A ' +
        'consonant, U+1039 and a consonant is left out of the Unicode rows too: a stack in Unicode, an asat before ' +
        'the next syllable in Zawgyi. The example is kya, tiger.',
      source: 'commit 0eb2de4 (v2.9.1): against 2.8.3 on Burmese Wikipedia lines, with Zawgyi copies made by Rabbit ' +
        'and by knayi, and on the myanmar-tools mmgov and UDHR corpora, no line or word was lost, and 35 Unicode ' +
        'lines and words were gained',
      example: '\u1000\u103b\u102c\u1038'
    },

    // Zawgyi.
    {
      id: 'Z01',
      side: 'zawgyi',
      pattern: '\u102c\u1039',
      why: 'Aa, then U+1039: Zawgyi\'s asat after aa, in the vowel aw. In Unicode, U+1039 is the virama, which a ' +
        'consonant follows and which never follows aa; the asat is U+103A. The example is kaw in Zawgyi.',
      source: KEPT + '. ' + GLYPHS,
      example: '\u1031\u1000\u102c\u1039'
    },
    {
      id: 'Z02',
      side: 'zawgyi',
      pattern: '\u103a\u102c',
      why: 'U+103A, then aa: Zawgyi\'s medial ya, then aa. In Unicode, U+103A is the asat, which UTN #11 stores ' +
        'after aa, not before it. The example is kya, tiger, in Zawgyi.',
      source: KEPT + '. ' + GLYPHS + '; UTN #11 storage order',
      example: '\u1000\u103a\u102c\u1038'
    },
    {
      id: 'Z03',
      side: 'zawgyi',
      pattern: '[\\x20\\t\\r\\n\\f](\u103b|\u1031|[\u107e-\u1084])[\u1000-\u1021]',
      why: 'A space, tab, line break or form feed, then e or a medial ra glyph, then a consonant: Zawgyi types e and ' +
        'medial ra before their consonant, so a word can start with them. A Unicode word starts with its consonant; ' +
        'there U+103B is medial ya and U+107E-U+1084 are Shan letters and signs. U+000B and U+00A0 are not in the ' +
        'class. The example is thu kyaung, he and school, in Zawgyi.',
      source: KEPT + '. ' + GLYPHS + '; UTN #11 storage order',
      example: '\u101e\u1030 \u1031\u1000\u103a\u102c\u1004\u1039\u1038'
    },
    {
      id: 'Z04',
      side: 'zawgyi',
      pattern: '^(\u103b|\u1031|[\u107e-\u1084])[\u1000-\u1021]',
      why: 'Text that starts with e or a medial ra glyph, then a consonant: row Z03 at the start of the text. ' +
        'Anchored, so it matches at most once. The example is myanma in Zawgyi.',
      source: KEPT + '. ' + GLYPHS + '; UTN #11 storage order',
      example: '\u103b\u1019\u1014\u1039\u1019\u102c'
    },
    {
      id: 'Z05',
      side: 'zawgyi',
      pattern: '[\u1000-\u1021]\u1039[^\u1000-\u1021]',
      why: 'A consonant and U+1039, then a unit that is not a consonant: Zawgyi\'s asat on a final consonant. In ' +
        'Unicode a consonant follows the virama. A consonant after U+1039 is left out: a stack in Unicode, the next ' +
        'syllable in Zawgyi. The class needs a unit, so U+1039 at the end of the text does not match here (row Z17 ' +
        'counts it). The example is pan, flower, in Zawgyi.',
      source: KEPT + '. ' + GLYPHS,
      example: '\u1015\u1014\u1039\u1038'
    },
    {
      id: 'Z06',
      side: 'zawgyi',
      pattern: '\u1025\u1039',
      why: 'U+1025, then U+1039: Zawgyi types the letter u for nya, which its font draws alike, here with its asat. ' +
        'Unicode spells that nya U+1009 with U+103A. Unicode text that types the letter u for nya before a stacked ' +
        'consonant (U+1025, the virama U+1039, a consonant) matches too. The example is yin, vehicle, in Zawgyi.',
      source: KEPT + '. Reading: research/zawgyi-to-unicode.md §3, the letters Zawgyi draws alike',
      example: '\u101a\u102c\u1025\u1039'
    },
    {
      id: 'Z07',
      side: 'zawgyi',
      pattern: '\u1039\u1038',
      why: 'U+1039, then visarga: Zawgyi\'s asat, then visarga. In Unicode a consonant follows the virama, and asat ' +
        'with visarga is U+103A U+1038 (row U08). The example is kaung, good, in Zawgyi.',
      source: KEPT + '. ' + GLYPHS,
      example: '\u1031\u1000\u102c\u1004\u1039\u1038'
    },
    {
      id: 'Z08',
      side: 'zawgyi',
      pattern: '[\u102b-\u1030\u1031\u103a\u1038](\u103b|[\u107e-\u1084])[\u1000-\u1021]',
      why: 'A vowel sign from tall aa to uu, e, U+103A or visarga, then a medial ra glyph, then a consonant: a ' +
        'syllable ends, and Zawgyi types the next one\'s medial ra before its consonant; after e, it is the order ' +
        'Zawgyi types e and medial ra in, both before their consonant. In Unicode, U+103B is medial ya, which ' +
        'follows its consonant. The example is pa pyi, done, in Zawgyi.',
      source: KEPT + '. ' + GLYPHS + '; UTN #11 storage order',
      example: '\u1015\u102b\u103b\u1015\u102e'
    },
    {
      id: 'Z09',
      side: 'zawgyi',
      pattern: '\u1036\u102f',
      why: 'Anusvara, then u: the order Zawgyi text is typed in. UTN #11 stores u before anusvara. The example is ' +
        'a lone, all, in Zawgyi.',
      source: KEPT + '. ' + UTN11,
      example: '\u1021\u102c\u1038\u101c\u1036\u102f\u1038'
    },
    {
      id: 'Z10',
      side: 'zawgyi',
      pattern: '[\u1000-\u1021]\u1039\u1031',
      why: 'A consonant and U+1039, then e: Zawgyi\'s asat, then the next syllable\'s e, typed before its consonant. ' +
        'In Unicode a consonant follows the virama. Such text matches row Z05 as well. The example is kan taw in ' +
        'Zawgyi.',
      source: KEPT + '. ' + GLYPHS,
      example: '\u1000\u1014\u1039\u1031\u1010\u102c'
    },
    {
      id: 'Z11',
      side: 'zawgyi',
      pattern: '\u1064',
      why: 'U+1064, Zawgyi\'s kinzi, drawn after the consonant it sits on. Unicode writes kinzi as U+1004 U+103A ' +
        'U+1039 before the consonant, and U+1064 is a S\'gaw Karen tone mark. Zawgyi\'s kinzi with i, ii or ' +
        'anusvara (U+108B-U+108D) is not in the row. The example is inga-leit, English, in Zawgyi.',
      source: KEPT + '. ' + GLYPHS,
      example: '\u1021\u1002\u1064\u101c\u102d\u1015\u1039'
    },
    {
      id: 'Z12',
      side: 'zawgyi',
      pattern: '\u1039[\\x20\\t\\r\\n\\f]',
      why: 'U+1039, then a space, tab, line break or form feed: Zawgyi\'s asat at the end of a word. In Unicode a ' +
        'consonant follows the virama. The example is ta khu, one thing, in Zawgyi.',
      source: KEPT + '. ' + GLYPHS,
      example: '\u1010\u1005\u1039 \u1001\u102f'
    },
    {
      id: 'Z13',
      side: 'zawgyi',
      pattern: '\u102c\u1031',
      why: 'Aa, then e: a syllable ends in aa, and Zawgyi types the next syllable\'s e before its consonant. In ' +
        'Unicode, e follows its consonant, and UTN #11 stores it before aa. The example is la thaw, that came, in ' +
        'Zawgyi.',
      source: KEPT + '. ' + UTN11,
      example: '\u101c\u102c\u1031\u101e\u102c'
    },
    {
      id: 'Z14',
      side: 'zawgyi',
      pattern: '[\u102b-\u1030\u103a\u1038]\u1031[\u1000-\u1021]',
      why: 'A vowel sign from tall aa to uu, U+103A or visarga, then e, then a consonant: the next syllable\'s e ' +
        'typed before its consonant, as in row Z13. The example is thu dwei, they, in Zawgyi.',
      source: KEPT + '. ' + UTN11,
      example: '\u101e\u1030\u1031\u1010\u103c'
    },
    {
      id: 'Z15',
      side: 'zawgyi',
      pattern: '\u1031\u1031',
      why: 'Two e in a row. Unicode stores one e after each consonant, so two cannot meet; Zawgyi text has them ' +
        'where a second e was typed by mistake. The matches do not overlap: three e in a row count once, four ' +
        'twice. The example is a doubled e before kaw, in Zawgyi.',
      source: KEPT + '. Reading: research/zawgyi-to-unicode.md §1, bug E (a mark twice in a row)',
      example: '\u1031\u1031\u1000\u102c'
    },
    {
      id: 'Z16',
      side: 'zawgyi',
      pattern: '\u102f\u102d',
      why: 'U, then i: the order Zawgyi text is often typed in. UTN #11 stores i before u. The example is ko in ' +
        'Zawgyi.',
      source: KEPT + '. ' + UTN11,
      example: '\u1000\u102f\u102d'
    },
    {
      id: 'Z17',
      side: 'zawgyi',
      pattern: '\u1039$',
      why: 'U+1039 at the end of the text: Zawgyi\'s asat on the last consonant. In Unicode a consonant follows the ' +
        'virama. Anchored, so it matches at most once. The example is chit, love, in Zawgyi.',
      source: KEPT + '. ' + GLYPHS,
      example: '\u1001\u103a\u1005\u1039'
    }
  ];
}
