// The font reader of Zawgyi and Win conversion: drawing order to storage order, in one pass, and the compiled fonts
// it reads (DESIGN.md §3.5, §3.6, §3.8; research/zawgyi-to-unicode.md §2, research/win-fonts.md §5). Layer L3
// engine. Owner: W6 (engine-fonts).
//
// Zawgyi and Win store text in the order the glyphs are drawn: e and medial ra before the consonant, kinzi and
// stacked consonants after it, and the marks in any order. readFont reads each UTF-16 unit once, from left to
// right, looks its glyph up in the compiled font, gathers each syllable in this module's SyllableBuffer, and has
// engine/syllable.js write it in the storage order of UTN #11 into this module's CodeBuffer. It replaces 2.x font,
// arrange and glyphsInTypedOrder (storageOrder.js:187-267, :436-444), which built strings syllable by syllable.

import { deepFreeze } from '../freeze.js';
import {
  CP, ROLE, KINZI_TEXT, isSyllableBase, isBurmeseConsonant, isBurmeseDigit, isSpaceBeforeMark, zeroWidthBit, markRank,
  RANK_UNRANKED, mayChangeUnderNfc
} from '../script/codes.js';
import { ERR, libraryError } from '../core/errors.js';
import { sharedEnds } from '../core/edits.js';
import { SyllableBuffer, CodeBuffer, closeSyllable, isHeld, marksGoOn } from './syllable.js';

// The font reader's side of the four deliberate differences between the readers (§3.5).
export const FONT_READING = /* @__PURE__ */ deepFreeze({
  // ZW.ALL: every zero-width character typed inside a syllable moves to its end
  // (research/zawgyi-to-unicode.md §3, "Zero-width spaces and non-joiners").
  heldZeroWidth: 31,
  // After a held space, a mark joins any base, a digit included (research/zawgyi-to-unicode.md §3).
  digitTakesMarksAcrossSpace: true,
  // With no open syllable, a zero-width unit is written at once, and a pending e or medial ra goes on waiting for
  // the next base.
  prebaseCrossesZeroWidth: true,
  // Zawgyi and Win text is Burmese: U+1025 with asat, aa or a stacked consonant is nya wherever it is
  // (research/normalize.md §3).
  keepUAfterVowelSign: false
});

// The reader's scratch (§3.11): reset at the start of each call, and released when large at its end. Only readFont
// and glyphsInTypedOrder use them, and neither calls out of this module while they hold data.
const FONT_SYLLABLE = /* @__PURE__ */ new SyllableBuffer();
const FONT_OUTPUT = /* @__PURE__ */ new CodeBuffer();

// The most units a BASE glyph's text may have: SyllableBuffer.baseCodes holds 8 (§3.3).
const MAX_BASE_UNITS = 8;

// ---------------------------------------------------------------------------------------------------------------
// compileFont: the checked, flat form of a FontDefinition (§3.8).
//
// A CompiledFont is { name, sequences, index, roles, nfcRisk, units, textStart, textEnd, marksStart, end }, frozen,
// and its typed arrays are read-only by contract. Glyph g's units are units[textStart[g], end[g]): its Unicode text
// up to textEnd[g], then its attached marks. Glyph 0 is "no glyph":
//   index[code]                          the glyph of a code, 0 for none (an index sized to the highest key + 1)
//   roles[g]                             its ROLE
//   nfcRisk[g]                           1 when NFC may move or compose a unit of the glyph (mayChangeUnderNfc)
//   units[textStart[g], textEnd[g])      its text: a BASE's base text, a STACK's virama and consonant
//   units[marksStart[g], end[g])         what it pushes as marks: text and attached marks for MARK and
//                                        BEFORE_BASE, the attached marks alone for STACK and KINZI
//   units[textStart[g], end[g])          what it writes when it cannot join a syllable

// Checks the definition and builds its CompiledFont, once, at load (stages/fonts.js). Throws
// libraryError(ERR.INVALID_FONT_TABLE, 'knayi fonts/<name>.js: glyph U+XXXX: <what is wrong>') on the first row
// that breaks a check of §3.8, so a broken table fails at load, not on some later input.
export function compileFont(definition) {
  const where = 'knayi fonts/' + definition.name + '.js';
  const rowsByCode = new Map();
  addTableRows(rowsByCode, definition, where);
  addAliasRows(rowsByCode, definition, where);
  addSelfBaseRows(rowsByCode, definition, where);
  addBuiltInBases(rowsByCode);
  return deepFreeze(layOutGlyphs(definition, rowsByCode));
}

// Check 1 and the row checks 2-4, for each row of the table.
function addTableRows(rowsByCode, definition, where) {
  const keys = Object.keys(definition.glyphs);
  for (let i = 0; i < keys.length; i++) {
    const code = requireKey(keys[i], where, 'glyph');
    const row = definition.glyphs[keys[i]];
    checkRow(row, definition.wholeBases, where + ': glyph ' + hex(code));
    rowsByCode.set(code, row);
  }
}

// Check 5: each alias reads as the glyph of a key of the table (2.x win.js:222-224 copied the row). An alias that
// was a key itself would hide that key's row.
function addAliasRows(rowsByCode, definition, where) {
  const aliases = Object.keys(definition.aliases);
  for (let i = 0; i < aliases.length; i++) {
    const code = requireKey(aliases[i], where, 'alias');
    const target = definition.aliases[aliases[i]];
    if (rowsByCode.has(code)) fail(where + ': alias ' + hex(code) + ': is also a key of the table');
    const row = Object.prototype.hasOwnProperty.call(definition.glyphs, target) ? definition.glyphs[target] : null;
    if (row === null) fail(where + ': alias ' + hex(code) + ': names no key of the table');
    rowsByCode.set(code, row);
  }
}

// Check 5: each code of the selfBases ranges is a base of itself (2.x zawgyi.js:118-121 added the digits as rows),
// and no such code is also a key.
function addSelfBaseRows(rowsByCode, definition, where) {
  for (let r = 0; r < definition.selfBases.length; r++) {
    const range = definition.selfBases[r];
    for (let code = range[0]; code <= range[1]; code++) {
      if (rowsByCode.has(code)) fail(where + ': self base ' + hex(code) + ': is also a key of the table');
      const row = [ROLE.BASE, String.fromCharCode(code)];
      checkRow(row, definition.wholeBases, where + ': self base ' + hex(code));
      rowsByCode.set(code, row);
    }
  }
}

// The built-in rule (2.x font(), storageOrder.js:206-209): every syllable base of U+1000-U+104F that the font
// does not list is a base of itself, such as the letters the sequences make.
function addBuiltInBases(rowsByCode) {
  for (let code = 0x1000; code <= 0x104F; code++) {
    if (!rowsByCode.has(code) && isSyllableBase(code)) rowsByCode.set(code, [ROLE.BASE, String.fromCharCode(code)]);
  }
}

// Checks 2-4 of §3.8 for one row: [role, text, attachedMarks?].
function checkRow(row, wholeBases, where) {
  const role = row[0];
  const text = row[1];
  const attached = row.length > 2 ? row[2] : '';
  if (typeof text !== 'string' || typeof attached !== 'string') fail(where + ': text and marks must be strings');
  if (role === ROLE.BASE) checkBase(text, attached, wholeBases, where);
  else if (role === ROLE.MARK || role === ROLE.BEFORE_BASE) requireRanked(text + attached, where);
  else if (role === ROLE.STACK) checkStack(text, attached, where);
  else if (role === ROLE.KINZI) checkKinzi(text, attached, where);
  else if (role !== ROLE.PLAIN) fail(where + ': unknown role ' + String(role)); // PLAIN text may be any string
}

// Check 4 for a BASE: one unit (a syllable base or a Burmese digit), a ligature (consonant, virama, consonant), or
// one of the font's whole bases; at most MAX_BASE_UNITS units; and no attached marks, which 2.x never wrote for a
// base.
function checkBase(text, attached, wholeBases, where) {
  const first = text.charCodeAt(0);
  const oneUnit = text.length === 1 && (isSyllableBase(first) || isBurmeseDigit(first));
  const ligature = text.length === 3 && isBurmeseConsonant(first) && text.charCodeAt(1) === CP.VIRAMA &&
    isBurmeseConsonant(text.charCodeAt(2));
  if (!oneUnit && !ligature && wholeBases.indexOf(text) < 0) {
    fail(where + ': a base must be one letter or digit, a ligature, or a declared whole base');
  }
  if (text.length > MAX_BASE_UNITS) fail(where + ': a base has at most ' + MAX_BASE_UNITS + ' units');
  if (attached !== '') fail(where + ': a base has no attached marks');
}

// Check 4 for a STACK: virama and a Burmese consonant; check 3 for its attached marks.
function checkStack(text, attached, where) {
  if (text.length !== 2 || text.charCodeAt(0) !== CP.VIRAMA || !isBurmeseConsonant(text.charCodeAt(1))) {
    fail(where + ': a stacked consonant is a virama and a Burmese consonant');
  }
  requireRanked(attached, where);
}

// Check 4 for a KINZI: its text is KINZI_TEXT; check 3 for its attached marks.
function checkKinzi(text, attached, where) {
  if (text !== KINZI_TEXT) fail(where + ': a kinzi is nga, asat and virama');
  requireRanked(attached, where);
}

// Check 3: every unit is a mark with a place in the storage order (markRank below RANK_UNRANKED), so orderSyllable
// can sort it and the 20-bit mark set can hold it.
function requireRanked(units, where) {
  for (let i = 0; i < units.length; i++) {
    const code = units.charCodeAt(i);
    if (markRank(code) >= RANK_UNRANKED) fail(where + ': ' + hex(code) + ' is not a ranked mark');
  }
}

// Check 1: a key is one UTF-16 unit, and not a space or zero-width character: readFont holds or writes those
// before it would look up a glyph (§3.6, steps 1 and 2), so their rows would never be read. Returns its code.
function requireKey(key, where, what) {
  if (key.length !== 1) fail(where + ': ' + what + ' key ' + JSON.stringify(key) + ' must be one UTF-16 unit');
  const code = key.charCodeAt(0);
  if (isSpaceBeforeMark(code) || zeroWidthBit(code) !== 0) {
    fail(where + ': ' + what + ' ' + hex(code) + ': a space or zero-width character cannot have a glyph');
  }
  return code;
}

function fail(message) {
  throw libraryError(ERR.INVALID_FONT_TABLE, message);
}

// U+XXXX, for messages.
function hex(code) {
  const digits = code.toString(16).toUpperCase();
  return 'U+' + '0000'.slice(digits.length) + digits;
}

// The flat typed arrays of a CompiledFont, glyphs numbered from 1 in the order of their codes.
function layOutGlyphs(definition, rowsByCode) {
  const codes = [];
  rowsByCode.forEach(function (row, code) { codes.push(code); });
  codes.sort(function (a, b) { return a - b; });
  const count = codes.length + 1;
  const font = {
    name: definition.name, sequences: definition.sequences, index: new Uint16Array(codes[codes.length - 1] + 1),
    roles: new Uint8Array(count), nfcRisk: new Uint8Array(count), units: null, textStart: new Uint32Array(count),
    textEnd: new Uint32Array(count), marksStart: new Uint32Array(count), end: new Uint32Array(count)
  };
  const units = [];
  for (let g = 1; g < count; g++) {
    const row = rowsByCode.get(codes[g - 1]);
    font.index[codes[g - 1]] = g;
    font.roles[g] = row[0];
    font.textStart[g] = units.length;
    pushUnits(units, row[1]);
    font.textEnd[g] = units.length;
    pushUnits(units, row.length > 2 ? row[2] : '');
    font.end[g] = units.length;
    font.nfcRisk[g] = hasUnitNfcMayChange(units, font.textStart[g], font.end[g]) ? 1 : 0;
    font.marksStart[g] = row[0] === ROLE.MARK || row[0] === ROLE.BEFORE_BASE ? font.textStart[g] : font.textEnd[g];
  }
  font.units = Uint16Array.from(units);
  return font;
}

function pushUnits(units, text) {
  for (let i = 0; i < text.length; i++) units.push(text.charCodeAt(i));
}

function hasUnitNfcMayChange(units, start, end) {
  for (let k = start; k < end; k++) if (mayChangeUnderNfc(units[k])) return true;
  return false;
}

// ---------------------------------------------------------------------------------------------------------------
// readFont (§3.6; research/zawgyi-to-unicode.md §2-3, research/win-fonts.md §5).

// Font text in Unicode storage order: the stage 'syllables'. The text has had the font's sequences applied.
export function readFont(text, font) {
  readGlyphs(text, font);
  return finishOutput(FONT_OUTPUT);
}

// readFont, and whether NFC may change its output (DESIGN.md §3.10, gate 4): { text, nfcMayChange }. nfcMayChange
// is false only when no unit the reader writes outside a sorted syllable may change under NFC. A sorted syllable's
// marks are in canonical order: MARK_GROUPS puts dot below before asat, and the two asat placements that move the
// asat forward, ON_CONSONANT and AFTER_MEDIALS, never have a dot below (§3.4).
export function readFontNoting(text, font) {
  const nfcMayChange = readGlyphs(text, font) !== 0;
  return { text: finishOutput(FONT_OUTPUT), nfcMayChange: nfcMayChange };
}

// Reads the text into the module's scratch, FONT_OUTPUT. Returns the OR of font.nfcRisk over the glyphs written
// whole (bases, e and medial ra, and glyphs that join no syllable) and of mayChangeUnderNfc over the units with no
// glyph. The numbered steps are those of DESIGN.md §3.6, and their order is part of the behaviour.
function readGlyphs(text, font) {
  const buf = FONT_SYLLABLE;
  const sink = FONT_OUTPUT;
  const index = font.index;
  const roles = font.roles;
  const nfcRisk = font.nfcRisk;
  let risk = 0;
  buf.reset();
  sink.clear();
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const glyph = code < index.length ? index[code] : 0;
    const role = roles[glyph];
    if (glyph === 0) {
      // 1-3. No glyph: a space or zero-width character, held or written, or a unit that ends the syllable.
      readUnitWithNoGlyph(buf, sink, code);
      if (code >= 0x0300 && mayChangeUnderNfc(code)) risk = 1;
    } else if (role === ROLE.BASE) {
      // 4. A base starts a syllable (research/win-fonts.md §5, "Syllables").
      openSyllable(buf, sink, font, glyph);
      risk |= nfcRisk[glyph];
    } else if (role === ROLE.BEFORE_BASE) {
      // 5. e and medial ra are drawn before the base they belong to, so they wait for the next one.
      waitForBase(buf, sink, font, glyph);
      risk |= nfcRisk[glyph];
    } else if (role !== ROLE.PLAIN && buf.isOpen && marksGoOn(buf, FONT_READING)) {
      // 6. A mark, stacked consonant or kinzi belongs to the open syllable, which sorts it.
      addToSyllable(buf, font, glyph, role);
    } else {
      // 7. Plain text, or a mark with no base before it, ends the syllable and is written as it is.
      writeGlyph(buf, sink, font, glyph);
      risk |= nfcRisk[glyph];
    }
  }
  closeOpenSyllable(buf, sink);
  buf.writePending(sink); // an e or medial ra that found no base stays where it was typed
  return risk;
}

// Writes the open syllable, if any, in storage order, with the characters held after it.
function closeOpenSyllable(buf, sink) {
  if (buf.isOpen) closeSyllable(buf, sink);
}

// Steps 1-3, for a unit the font has no glyph for. compileFont gives no space or zero-width character a glyph,
// so reading these after the lookup keeps the order of §3.6.
function readUnitWithNoGlyph(buf, sink, code) {
  const zeroWidth = (zeroWidthBit(code) & FONT_READING.heldZeroWidth) !== 0;
  if (isHeld(buf, code, FONT_READING)) {
    // 1. A space or zero-width character after an open syllable is held until the next glyph shows whether the
    //    syllable goes on: a space typed before a mark only moved the mark, and is dropped; a zero-width
    //    character moves to the end of the syllable (research/zawgyi-to-unicode.md §3, "A space typed before a
    //    dot below", "Zero-width spaces and non-joiners").
    buf.hold(code, zeroWidth);
  } else if (zeroWidth && FONT_READING.prebaseCrossesZeroWidth) {
    // 2. A zero-width character with no open syllable is written at once, and a pending e or medial ra goes on
    //    waiting for the next base.
    sink.push(code);
  } else {
    // 3. Any other unit ends the syllable, after any e or medial ra that found no base, and is written as it is.
    closeOpenSyllable(buf, sink);
    buf.writePending(sink);
    sink.push(code);
  }
}

// Step 4: a new syllable on the glyph's base text, whose first marks are the pending e and medial ra. keepU is
// never set: FONT_READING.keepUAfterVowelSign is false, so u with asat, aa or a stack is always nya.
function openSyllable(buf, sink, font, glyph) {
  closeOpenSyllable(buf, sink);
  buf.open(0, false);
  buf.setBaseText(font.units, font.textStart[glyph], font.textEnd[glyph]);
}

// Step 5: the syllable ends, and the glyph's marks wait for the next base, in typed order.
function waitForBase(buf, sink, font, glyph) {
  closeOpenSyllable(buf, sink);
  const units = font.units;
  for (let k = font.marksStart[glyph]; k < font.end[glyph]; k++) buf.addPending(units[k]);
}

// Step 6: the syllable goes on, so the spaces held since it last went on are dropped and the zero-width characters
// stay. A stacked consonant follows the base (research/win-fonts.md §2, "Stacked consonants follow the base"); a
// kinzi, typed after the consonant it sits on, is stored before it (UTN #11).
function addToSyllable(buf, font, glyph, role) {
  const units = font.units;
  buf.goOn();
  if (role === ROLE.STACK) {
    for (let k = font.textStart[glyph]; k < font.textEnd[glyph]; k++) buf.pushStack(units[k]);
  } else if (role === ROLE.KINZI) {
    buf.kinziLead = CP.NGA; // KINZI_TEXT's first unit, which compileFont requires of every kinzi
  }
  for (let k = font.marksStart[glyph]; k < font.end[glyph]; k++) buf.pushMark(units[k]);
}

// Step 7: the syllable ends, any e or medial ra that found no base is written, then the glyph's text and attached
// marks.
function writeGlyph(buf, sink, font, glyph) {
  closeOpenSyllable(buf, sink);
  buf.writePending(sink);
  sink.pushCodes(font.units, font.textStart[glyph], font.end[glyph]);
}

// The output as a string. Buffers that grew past 65,536 units go back to their first size (DESIGN.md §3.11): 33.4 MB
// stayed allocated after an 8.9M-character conversion without this, and test/next/readers-font.test.mjs converts
// 8.9M characters and requires every buffer back at its size.
function finishOutput(sink) {
  const out = sink.decode();
  sink.releaseIfLarge();
  FONT_SYLLABLE.releaseIfLarge();
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// readFontLogged (DESIGN.md §11.3): readFontNoting, recording each syllable and each glyph written whole in an
// EditLog. The reader writes a syllable only when the unit after it arrives, and an e or medial ra typed before its
// base when the base's syllable closes, so this reader notes where each began, in the text and in the output, and
// records an edit when it writes them: from where the syllable's source began (its pending e or medial ra, else its
// base) up to the unit that closed it. That takes in the spaces and zero-width characters held after the syllable,
// and a zero-width character written at once while an e waited (step 2).
//
// It is its own loop, with the steps of readGlyphs in the same order and the same helpers where nothing is to be
// noted: threading the notes through readGlyphs's helpers made Zawgyi and Win conversion 4-13% slower under Node with
// no log at all (npm run perf, 5 rounds), and test/next/core-edits.test.mjs checks on fuzz that both give one text.

// { text, nfcMayChange }, as readFontNoting gives, with its edits in `log`.
export function readFontLogged(text, font, log) {
  const spans = { text: text, log: log, pendingSource: 0, pendingOutput: 0, syllableSource: 0, syllableOutput: 0 };
  const nfcMayChange = readGlyphsLogged(text, font, spans) !== 0;
  return { text: finishOutput(FONT_OUTPUT), nfcMayChange: nfcMayChange };
}

// readGlyphs, noting the spans. The numbered steps are those of readGlyphs.
function readGlyphsLogged(text, font, spans) {
  const buf = FONT_SYLLABLE;
  const sink = FONT_OUTPUT;
  let risk = 0;
  buf.reset();
  sink.clear();
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const glyph = code < font.index.length ? font.index[code] : 0;
    const role = font.roles[glyph];
    if (glyph === 0) {
      readUnitWithNoGlyphLogged(buf, sink, code, spans, i); // 1-3
      if (code >= 0x0300 && mayChangeUnderNfc(code)) risk = 1;
    } else if (role === ROLE.BASE) {
      closeSyllableLogged(buf, sink, spans, i); // 4
      noteSyllableStart(spans, buf, sink, i);
      openSyllable(buf, sink, font, glyph);
      risk |= font.nfcRisk[glyph];
    } else if (role === ROLE.BEFORE_BASE) {
      closeSyllableLogged(buf, sink, spans, i); // 5
      if (buf.pendingLength === 0) notePendingStart(spans, sink, i);
      waitForBase(buf, sink, font, glyph);
      risk |= font.nfcRisk[glyph];
    } else if (role !== ROLE.PLAIN && buf.isOpen && marksGoOn(buf, FONT_READING)) {
      addToSyllable(buf, font, glyph, role); // 6
    } else {
      writeGlyphLogged(buf, sink, font, glyph, spans, i); // 7
      risk |= font.nfcRisk[glyph];
    }
  }
  closeSyllableLogged(buf, sink, spans, text.length);
  writePendingLogged(buf, sink, spans, text.length);
  return risk;
}

// Steps 1-3, noting the syllable and the pending run that a unit with no glyph ends.
function readUnitWithNoGlyphLogged(buf, sink, code, spans, i) {
  const zeroWidth = (zeroWidthBit(code) & FONT_READING.heldZeroWidth) !== 0;
  if (isHeld(buf, code, FONT_READING) || (zeroWidth && FONT_READING.prebaseCrossesZeroWidth)) {
    readUnitWithNoGlyph(buf, sink, code); // 1 and 2 close nothing: their units fall inside a span noted later
    return;
  }
  closeSyllableLogged(buf, sink, spans, i);
  writePendingLogged(buf, sink, spans, i);
  sink.push(code);
}

// Step 7, noting the syllable and the pending run it ends, and the glyph it writes.
function writeGlyphLogged(buf, sink, font, glyph, spans, i) {
  closeSyllableLogged(buf, sink, spans, i);
  writePendingLogged(buf, sink, spans, i);
  const output = sink.length;
  sink.pushCodes(font.units, font.textStart[glyph], font.end[glyph]);
  addSpan(spans, sink, i, i + 1, output);
}

// Writes the open syllable, if any, and notes that its source, up to `at`, became what it wrote.
function closeSyllableLogged(buf, sink, spans, at) {
  if (!buf.isOpen) return;
  closeSyllable(buf, sink);
  addSpan(spans, sink, spans.syllableSource, at, spans.syllableOutput);
}

// Writes the e and medial ra that found no base, and notes their source, up to `at`.
function writePendingLogged(buf, sink, spans, at) {
  if (buf.pendingLength === 0) return;
  buf.writePending(sink);
  addSpan(spans, sink, spans.pendingSource, at, spans.pendingOutput);
}

// The first e or medial ra of a pending run is read at i, after the syllable before it was written.
function notePendingStart(spans, sink, i) {
  spans.pendingSource = i;
  spans.pendingOutput = sink.length;
}

// A syllable opens on the base at i: its source begins at its pending e or medial ra, if any, else at its base, and
// its output where that source began to be written.
function noteSyllableStart(spans, buf, sink, i) {
  if (buf.pendingLength > 0) {
    spans.syllableSource = spans.pendingSource;
    spans.syllableOutput = spans.pendingOutput;
  } else {
    spans.syllableSource = i;
    spans.syllableOutput = sink.length;
  }
}

// Records that text[start, end) became the output from `output` to the end of the sink, leaving out the units the
// two share at either end, as EditLog#addChange does (core/edits.js sharedEnds): a syllable already in storage
// order, or a glyph whose text is its own unit, records nothing.
function addSpan(spans, sink, start, end, output) {
  const text = spans.text;
  const outEnd = sink.length;
  if (isWrittenAsTyped(text, start, end, sink, output)) return;
  const ends = sharedEnds(end - start, outEnd - output, (k) => text.charCodeAt(start + k) === sink.codeAt(output + k),
    (k) => text.charCodeAt(end - 1 - k) === sink.codeAt(outEnd - 1 - k));
  spans.log.add(start + ends.head, end - ends.tail, output + ends.head, outEnd - ends.tail);
}

// Whether the sink from `output` on holds exactly the units of text[start, end).
function isWrittenAsTyped(text, start, end, sink, output) {
  if (sink.length - output !== end - start) return false;
  for (let k = 0; k < end - start; k++) {
    if (text.charCodeAt(start + k) !== sink.codeAt(output + k)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------------------------
// Each glyph as Unicode, still in typed order: the trace-only stage 'glyphs' (2.x glyphsInTypedOrder,
// storageOrder.js:436-444). A unit with no glyph is written as it is.
export function glyphsInTypedOrder(text, font) {
  const sink = FONT_OUTPUT;
  const index = font.index;
  sink.clear();
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const glyph = code < index.length ? index[code] : 0;
    if (glyph === 0) sink.push(code);
    else sink.pushCodes(font.units, font.textStart[glyph], font.end[glyph]);
  }
  return finishOutput(sink);
}

// The capacity, in units, of this module's scratch buffers (§3.11), for the memory tests.
export function fontReaderScratchUnits() {
  return FONT_SYLLABLE.capacity() + FONT_OUTPUT.capacity();
}
