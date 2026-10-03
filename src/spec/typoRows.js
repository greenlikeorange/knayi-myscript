// The 4 typo rules, documented: the readable oracle of fixTypos (DESIGN.md §2.3, §3.9). Owner: W2
// (typing-fixes).
//
// spec/ files import nothing, and nothing in src/ imports them; the tests read them, and they are never bundled.
// So their data is a plain literal, not frozen.
//
// The rules of typingFixes.js:12-17, in 2.x order. Each row is { id, pattern (the 2.x literal), replacement,
// why, source, example }.
//
// Skeleton (W0): empty until W2 writes the rows.

export const TYPO_ROWS = [];
