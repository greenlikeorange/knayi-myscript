// The 15 break rules, documented: the readable oracle of the break scanners (DESIGN.md §2.3). Owner: W3
// (segment).
//
// spec/ files import nothing, and nothing in src/ imports them; the tests read them, and they are never bundled.
// So their data is a plain literal, not frozen.
//
// Unicode rows U1-U7 and Zawgyi rows Z1-Z8, in 2.x order. Each row is { id, pattern (the 2.x literal),
// replacement, offWhen (the 2.x third item, or null), why, source, example }.
//
// Skeleton (W0): empty until W3 writes the rows.

export const BREAK_RULES = { unicode: [], zawgyi: [] };
