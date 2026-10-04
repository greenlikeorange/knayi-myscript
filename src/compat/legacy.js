// compat: the syllBreak separator, which 2.x converts as Array#join does, and the 2.x shape of the Win tables
// (DESIGN.md §5.1, C20). Layer L4. Owner: W8 (compat).
//
// Until the port of 2.11 (DESIGN.md §8) this file also held 2.x's rule-table lookups, which found what
// Object.prototype has under a font name such as 'constructor', and the TypeErrors 2.x threw by accident for them.
// 2.11 gives font names one policy (2.x 24f81c6): compat/input.js breakFont throws a coded TypeError for the fonts
// with no break rules, and spellingFix reads its marks by an own key, so nothing here throws any more.

import { ROLE } from '../script/codes.js';
import { WIN_GLYPHS, LOOK_ALIKE_SEQUENCES, C1_ALIASES } from '../fonts/win.js';

// The separator as 2.x's parts.join(separator) converted it (syllable.js:272-275, C20): toString before valueOf,
// and a Symbol throws a TypeError. The caller has already turned a falsy separator into U+200B.
export function toJoinSeparator(value) {
  return ['', ''].join(value);
}

// ---------------------------------------------------------------------------------------------------------------
// The 2.x shape of the Win tables.

// library/win.js exports its tables as `tables`: { WIN, SEQUENCES, ROLES }, with the role strings, the C1 controls
// as keys that share their Windows-1252 key's row, the keys in 2.x's order, and [pattern, replacement] pairs. That
// shape is 2.x API (ARCHITECTURE.md, "Stable surfaces": scripts/eval/win-glyphs.mjs reads it), so compat builds it
// from fonts/win.js here, and so will the shim that replaces library/win.js when 3.0 deletes library/ (DESIGN.md
// §9). Each call returns new objects and new RegExps, as open to change as 2.x's, so no caller can reach the
// core's own data.
export function legacyWinTables() {
  const names = legacyRoleNames();
  const win = {};
  const keys = Object.keys(WIN_GLYPHS);
  for (let i = 0; i < keys.length; i++) win[keys[i]] = legacyRow(WIN_GLYPHS[keys[i]], names);
  const controls = Object.keys(C1_ALIASES);
  for (let i = 0; i < controls.length; i++) win[controls[i]] = win[C1_ALIASES[controls[i]]];
  const sequences = [];
  for (let i = 0; i < LOOK_ALIKE_SEQUENCES.length; i++) {
    const row = LOOK_ALIKE_SEQUENCES[i];
    sequences.push([new RegExp(row.re.source, row.re.flags), row.to]);
  }
  return { WIN: win, SEQUENCES: sequences, ROLES: legacyRoles(names) };
}

// The 2.x role string of each ROLE (storageOrder.js:10-16).
function legacyRoleNames() {
  const names = [];
  names[ROLE.BASE] = 'base';
  names[ROLE.BEFORE_BASE] = 'pre';
  names[ROLE.MARK] = 'mark';
  names[ROLE.STACK] = 'stack';
  names[ROLE.KINZI] = 'kinzi';
  names[ROLE.PLAIN] = 'text';
  return names;
}

// storageOrder.ROLES: { BASE, PRE, MARK, STACK, KINZI, TEXT }, in that order.
function legacyRoles(names) {
  return {
    BASE: names[ROLE.BASE], PRE: names[ROLE.BEFORE_BASE], MARK: names[ROLE.MARK], STACK: names[ROLE.STACK],
    KINZI: names[ROLE.KINZI], TEXT: names[ROLE.PLAIN]
  };
}

// A row in the 2.x shape: [role string, text], with the attached marks as a third item only where the row has them.
function legacyRow(row, names) {
  const out = [names[row[0]], row[1]];
  if (row.length > 2) out.push(row[2]);
  return out;
}
