// The 4 typo rules, documented: the readable oracle of fixTypos (DESIGN.md §2.3, §3.9). Owner: W2
// (typing-fixes).
//
// spec/ files import nothing, and nothing in src/ imports them; the tests read them, and they are never bundled.
// So their data is a plain literal, not frozen, and each string is one literal (DESIGN.md §2.4 rule 2).
//
// The rules of typingFixes.js:12-17 at the reference, in 2.x order. Each row is:
//   id           stable and unique in this table; engine/typingFixes.js cites it in its comments
//   pattern      the 2.x literal, flags included
//   replacement  the 2.x replacement string
//   why          what the row fixes, and why
//   source       the evidence
//   example      a synthetic input that the row changes (test/next/typingFixes.test.mjs runs it through fixTypos
//                and through the row itself)
//
// fixTypos runs the four rows as one alternation, in one scan (DESIGN.md §3.9). That equals 2.x's four passes:
// - each row starts with its own units (i or ii, u or uu, o, four), so at most one row matches at an index;
// - no two rows' matches overlap;
// - no replacement makes or unmakes a match of another row.
// typo.lagaung's "no digit before the four" consumes the unit before the four in 2.x. fixTypos reads that unit
// by char code instead, because lookbehind is outside ES2015 (decision 18).

export const TYPO_ROWS = [
  {
    id: 'typo.ii',
    pattern: /\u102D\u102E|\u102E\u102D/g,
    replacement: '\u102E',
    // The example: ကြိီး, typed for ကြီး (big).
    why: 'i typed together with ii, in either order, is ii: the two signs draw on top of each other.',
    source: 'research/normalize.md §4: the honorific U typed with both i and ii in 27 of 9,987 mC4 Zawgyi lines.',
    example: '\u1000\u103C\u102D\u102E\u1038'
  },
  {
    id: 'typo.uu',
    pattern: /\u102F\u1030|\u1030\u102F/g,
    replacement: '\u1030',
    // The example: အထုူး, typed for အထူး (special).
    why: 'u typed together with uu, in either order, is uu: the two signs draw on top of each other.',
    source: 'research/normalize.md §4: "Doubled vowels", among 9,987 mC4 Zawgyi lines.',
    example: '\u1021\u1011\u102F\u1030\u1038'
  },
  {
    id: 'typo.au',
    pattern: /\u1029\u1031\u102C\u103A/g,
    replacement: '\u102A',
    // The example: ဩော်, typed for ဪ.
    why: 'The letter o with e, aa and asat draws the independent vowel au, which Unicode encodes as U+102A.',
    source: 'UTN #11, the independent vowels; the 2.x comment at typingFixes.js:15.',
    example: '\u1029\u1031\u102C\u103A'
  },
  {
    id: 'typo.lagaung',
    pattern: /(^|[^\u1040-\u1049])\u1044(?=\u1004\u103A\u1038)/g,
    replacement: '$1\u104E',
    // The example: ၄င်း, typed for ၎င်း (it). After a digit, as in ၁၄င်း, the four stays.
    why: 'The digit four before nga, asat and visarga is the look-alike symbol lagaung, unless a digit comes before it and makes it part of a number.',
    source: 'research/zawgyi-to-unicode.md §1, bug B (44 of 9,987 mC4 lines), and §3.',
    example: '\u1044\u1004\u103A\u1038'
  }
];
