// The 29 detector signatures, documented: the readable oracle of countEvidence (DESIGN.md §2.3). Owner: W4
// (detect).
//
// spec/ files import nothing, and nothing in src/ imports them; the tests read them, and they are never bundled.
// So their data is a plain literal, not frozen.
//
// 12 Unicode rows U01-U12, then 17 Zawgyi rows Z01-Z17, in 2.x order. Each row is { id, side, pattern (the 2.x
// source string, whitespace class expanded), why, source, example }.
//
// Skeleton (W0): empty until W4 writes the rows.

export const DETECTOR_SIGNATURES = [];
