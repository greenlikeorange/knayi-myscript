// One syllable in UTN #11 storage order, shared by both readers: SyllableBuffer, orderSyllable and its steps,
// CodeBuffer and CopyThroughWriter (DESIGN.md §3.3-§3.5, §3.7, D9). Layer L3 engine. Owner: W5 (engine-unicode).
//
// A reader puts the parts of a syllable into a SyllableBuffer in the order they were typed: kinzi, base, stacked
// consonants, marks, and the spaces and zero-width characters held after it. orderSyllable then writes them in the
// storage order of Unicode Technical Note #11 (version 4): kinzi, base, stacked consonant, an asat that sits on the
// consonant, medials, e, vowels, anusvara, dot below, asat, visarga. The rules are those of 2.x order()
// (scripts/oracle/storageOrder.js:101-185); the steps have names, and the buffer holds char codes, so a syllable
// costs no allocation.

import { deepFreeze } from '../freeze.js';
import {
  CP, isBurmeseDigit, isSpaceBeforeMark, zeroWidthBit, markRank, markBit, RANK_LAST_MEDIAL, RANK_LOWER_VOWEL,
  RANK_AI_ANUSVARA, MASK_ANY_AA, MASK_UPPER_VOWELS, MASK_LOWER_VOWELS, MASK_E_OR_AA, MASK_MEDIALS, MASK_ASAT,
  MASK_DOT_BELOW, MASK_VISARGA, MASK_MEDIAL_YA, MASK_MEDIAL_HA, MASK_E_TO_DOT_BELOW
} from '../script/codes.js';

// Where orderSyllable puts the asat (§3.4; UTN #11, research/zawgyi-to-unicode.md §3). 2.x had the flags early,
// afterMedials, slip and last (storageOrder.js:117-132).
export const ASAT_PLACE = /* @__PURE__ */ deepFreeze({
  NONE: 0, // no asat
  DROPPED: 1, // a slip, typed early for the next consonant's asat: removed
  IN_ORDER: 2, // stored last, sorted with the marks (kyaw, dot below, aa with no medial)
  ON_CONSONANT: 3, // right after the base and stack, before the medials (kyun-up, loanword finals)
  AFTER_MEDIALS: 4 // after the medials: Mon's final h, with medial ha
});

// Sizes, in UTF-16 units (§3.3, §3.7, §3.11).
const CODE_BUFFER_UNITS = 256; // a CodeBuffer's capacity when none is given
const RELEASE_ABOVE_UNITS = 65536; // releaseIfLarge: a buffer that grew past this goes back to its first size
const DECODE_CHUNK_UNITS = 8192; // String.fromCharCode.apply takes at most this many units at a time
const BASE_UNITS = 8; // a base is 1 unit, or a font's ligature or whole base of at most 8 (compileFont checks)
const MARK_SLOTS = 20; // one per mark of U+102B-U+103E: a syllable holds each mark once
const STACK_UNITS = 8; // (virama, consonant) pairs; grows
const HELD_UNITS = 16; // spaces and zero-width characters held after the syllable; grows
const PENDING_UNITS = 8; // e and medial ra waiting for their base; grows

// ---------------------------------------------------------------------------------------------------------------
// CodeBuffer: a growable Uint16Array (§3.7).

export class CodeBuffer {
  // capacity: the first size, in units (256 when not given). It doubles when full, and releaseIfLarge brings it
  // back.
  constructor(capacity) {
    this.firstCapacity = capacity || CODE_BUFFER_UNITS;
    this.codes = new Uint16Array(this.firstCapacity);
    this.length = 0;
  }

  push(code) {
    if (this.length === this.codes.length) this.codes = grownCopy(this.codes, this.length + 1);
    this.codes[this.length++] = code;
  }

  // The units of text[start, end).
  pushText(text, start, end) {
    this.makeRoom(end - start);
    for (let i = start; i < end; i++) this.codes[this.length++] = text.charCodeAt(i);
  }

  // codes[start, end), from a typed array or an array of char codes.
  pushCodes(codes, start, end) {
    this.makeRoom(end - start);
    for (let i = start; i < end; i++) this.codes[this.length++] = codes[i];
  }

  makeRoom(units) {
    if (this.length + units > this.codes.length) this.codes = grownCopy(this.codes, this.length + units);
  }

  codeAt(i) {
    return this.codes[i];
  }

  // Empties the buffer and keeps its capacity.
  clear() {
    this.length = 0;
  }

  // Whether the buffer holds exactly the units of text[start, end).
  equalsText(text, start, end) {
    if (end - start !== this.length) return false;
    for (let k = 0; k < this.length; k++) {
      if (this.codes[k] !== text.charCodeAt(start + k)) return false;
    }
    return true;
  }

  // The units as a string, in chunks for String.fromCharCode.apply. Never TextDecoder, which would replace a lone
  // surrogate (DESIGN.md §3.7).
  decode() {
    if (this.length <= DECODE_CHUNK_UNITS) return String.fromCharCode.apply(null, this.codes.subarray(0, this.length));
    let text = '';
    for (let start = 0; start < this.length; start += DECODE_CHUNK_UNITS) {
      const end = Math.min(this.length, start + DECODE_CHUNK_UNITS);
      text += String.fromCharCode.apply(null, this.codes.subarray(start, end));
    }
    return text;
  }

  // Empties a buffer that grew past 65,536 units and gives it back its first capacity, so a long call leaves no
  // large buffer behind (§3.11: 33.4 MB stayed allocated after an 8.9M-char conversion without this).
  releaseIfLarge() {
    if (this.codes.length <= RELEASE_ABOVE_UNITS) return;
    this.codes = new Uint16Array(this.firstCapacity);
    this.length = 0;
  }

  capacity() {
    return this.codes.length;
  }
}

// A copy of codes with room for at least `needed` units: the capacity doubles until they fit.
function grownCopy(codes, needed) {
  let capacity = codes.length * 2;
  while (capacity < needed) capacity *= 2;
  const grown = new Uint16Array(capacity);
  grown.set(codes);
  return grown;
}

// codes, or a new array of its first size when it grew past 65,536 units. The contents are dropped: a reader
// releases a buffer only after it has written it out.
function releasedIfLarge(codes, firstCapacity) {
  return codes.length > RELEASE_ABOVE_UNITS ? new Uint16Array(firstCapacity) : codes;
}

// ---------------------------------------------------------------------------------------------------------------
// SyllableBuffer: the open syllable in typed order, and the text held after it (§3.3). One per reader, reused for
// every syllable of every call.

export class SyllableBuffer {
  constructor() {
    this.isOpen = false;
    this.kinziLead = 0; // 0, or the kinzi's first unit: nga, or ra in Unicode text (repha)
    this.base = 0; // the base's first unit
    this.baseCodes = new Uint16Array(BASE_UNITS);
    this.baseLength = 0;
    this.baseHasVirama = false; // a ligature base counts as stacked (2.x base.indexOf(VIRAMA) > 0)
    this.keepU = false; // U+1025 stays u (§3.5)
    this.marks = new Int32Array(MARK_SLOTS); // unique marks, in the order first typed
    this.markCount = 0;
    this.markMask = 0; // the markBit set of marks
    this.ranks = new Int32Array(MARK_SLOTS); // scratch for rankMarks and sortByRank
    this.stack = new Uint16Array(STACK_UNITS);
    this.stackLength = 0;
    this.held = new Uint16Array(HELD_UNITS);
    this.heldLength = 0;
    this.keptUpTo = 0; // held[0, keptUpTo) came before the syllable last went on: only their zero-width units stay
    this.spaceHeld = false; // a space was held since the syllable last went on
    this.pending = new Uint16Array(PENDING_UNITS);
    this.pendingLength = 0;
    this.typedInOrder = true; // no part came out of its place (writesAsTyped); see the methods that clear it
  }

  // Empties everything: a reader calls this at the start of each call.
  reset() {
    this.emptySyllable();
    this.isOpen = false;
    this.pendingLength = 0;
  }

  emptySyllable() {
    this.kinziLead = 0;
    this.base = 0;
    this.baseLength = 0;
    this.baseHasVirama = false;
    this.keepU = false;
    this.markCount = 0;
    this.markMask = 0;
    this.stackLength = 0;
    this.heldLength = 0;
    this.keptUpTo = 0;
    this.spaceHeld = false;
    this.typedInOrder = true;
  }

  // Opens a syllable. The pending e and medial ra were typed for this base, so they become its first marks, and
  // the syllable is no longer in its typed order: they were typed before the base.
  open(kinziLead, keepU) {
    this.emptySyllable();
    this.isOpen = true;
    this.kinziLead = kinziLead;
    this.keepU = keepU;
    if (this.pendingLength > 0) this.typedInOrder = false;
    for (let p = 0; p < this.pendingLength; p++) this.pushMark(this.pending[p]);
    this.pendingLength = 0;
  }

  setBase(code) {
    this.base = code;
    this.baseCodes[0] = code;
    this.baseLength = 1;
    this.baseHasVirama = false;
  }

  // A font's base text: one unit, a ligature (consonant, virama, consonant) or a whole base such as lagaung.
  setBaseText(codes, start, end) {
    this.base = codes[start];
    this.baseLength = end - start;
    this.baseHasVirama = false;
    for (let k = 0; k < this.baseLength; k++) {
      this.baseCodes[k] = codes[start + k];
      if (k > 0 && codes[start + k] === CP.VIRAMA) this.baseHasVirama = true;
    }
  }

  // A one-unit base read as the letter it looks like (fixLookAlikeLetters).
  replaceBase(code) {
    this.base = code;
    this.baseCodes[0] = code;
  }

  // A mark typed twice counts once (2.x order(), storageOrder.js:106-109). Every mark lies in U+102B-U+103E. The
  // dropped copy leaves the syllable out of its typed order.
  pushMark(code) {
    const bit = markBit(code);
    if ((this.markMask & bit) !== 0) {
      this.typedInOrder = false;
      return;
    }
    this.markMask |= bit;
    this.marks[this.markCount++] = code;
  }

  indexOfMark(code) {
    for (let k = 0; k < this.markCount; k++) {
      if (this.marks[k] === code) return k;
    }
    return -1;
  }

  // Removes a mark that the syllable has.
  removeMark(code) {
    for (let k = this.indexOfMark(code) + 1; k < this.markCount; k++) this.marks[k - 1] = this.marks[k];
    this.markCount--;
    this.markMask &= ~markBit(code);
  }

  // A stacked consonant is written before the marks, so one typed after a mark leaves the typed order.
  pushStack(code) {
    if (this.markCount > 0) this.typedInOrder = false;
    if (this.stackLength === this.stack.length) this.stack = grownCopy(this.stack, this.stackLength + 1);
    this.stack[this.stackLength++] = code;
  }

  // Holds a space or zero-width character until the next unit shows whether the syllable goes on.
  hold(code, zeroWidth) {
    if (this.heldLength === this.held.length) this.held = grownCopy(this.held, this.heldLength + 1);
    this.held[this.heldLength++] = code;
    if (!zeroWidth) this.spaceHeld = true;
  }

  // The syllable goes on: the spaces held so far are dropped, and the zero-width characters stay (2.x
  // `after = kept`). A space typed before a mark only moved the mark (research/zawgyi-to-unicode.md §3). Held
  // units are written after the syllable, so going on past one leaves the typed order.
  goOn() {
    if (this.heldLength > 0) this.typedInOrder = false;
    this.keptUpTo = this.heldLength;
    this.spaceHeld = false;
  }

  // An e or medial ra typed before the base it belongs to.
  addPending(code) {
    if (this.pendingLength === this.pending.length) this.pending = grownCopy(this.pending, this.pendingLength + 1);
    this.pending[this.pendingLength++] = code;
  }

  // Writes the pending e and medial ra as they were typed: they found no base.
  writePending(sink) {
    sink.pushCodes(this.pending, 0, this.pendingLength);
    this.pendingLength = 0;
  }

  releaseIfLarge() {
    this.stack = releasedIfLarge(this.stack, STACK_UNITS);
    this.held = releasedIfLarge(this.held, HELD_UNITS);
    this.pending = releasedIfLarge(this.pending, PENDING_UNITS);
  }

  // The units of every array the buffer holds, for the memory tests.
  capacity() {
    return this.baseCodes.length + this.marks.length + this.ranks.length + this.stack.length + this.held.length +
      this.pending.length;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// CopyThroughWriter: the Unicode reader's output (§3.7). It appends slices of the input, and returns the input
// string itself when no syllable changed: 99.92% of syllables and 93.6% of lines come out of normalize unchanged.

export class CopyThroughWriter {
  constructor() {
    this.syllable = new CodeBuffer(); // closeSyllable writes here
    this.source = '';
    this.out = ''; // the output up to source[copyFrom]
    this.copyFrom = 0; // source[copyFrom, ...) is not in out yet, and is the output so far as it stands
  }

  begin(source) {
    this.source = source;
    this.out = '';
    this.copyFrom = 0;
    this.syllable.clear();
  }

  beginSyllable() {
    this.syllable.clear();
  }

  // The syllable's source is source[start, end): its pending e or medial ra, its kinzi or its base, up to where
  // the unit that closed it begins. When the written syllable differs from it, the output takes the source up to
  // start, then the syllable.
  endSyllable(start, end) {
    if (this.syllable.equalsText(this.source, start, end)) return;
    this.out += this.source.slice(this.copyFrom, start) + this.syllable.decode();
    this.copyFrom = end;
  }

  // The output: source itself when no syllable changed. The writer lets go of both strings.
  finish() {
    const unchanged = this.copyFrom === 0 && this.out === '';
    const text = unchanged ? this.source : this.out + this.source.slice(this.copyFrom);
    this.source = '';
    this.out = '';
    return text;
  }

  releaseIfLarge() {
    this.syllable.releaseIfLarge();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// orderSyllable and its steps (§3.4). Each step reads state that the steps before it change, so their order is
// part of the behaviour.

// Writes the open syllable in storage order, then what was held after it, and closes it. Does nothing when no
// syllable is open (2.x close()).
export function closeSyllable(buf, sink) {
  if (!buf.isOpen) return;
  orderSyllable(buf, sink);
  writeHeld(buf, sink);
  buf.isOpen = false;
}

// ---------------------------------------------------------------------------------------------------------------
// Syllables typed in storage order (DESIGN.md §3.4, "as typed"). 99.92% of the syllables normalize reads come out
// unchanged, so the readers ask first whether orderSyllable would write the parts exactly as they came.

// Whether orderSyllable would write the syllable as it was typed: kinzi, base, stack, then the marks in the order
// they came. That holds when no part came out of its place (typedInOrder: no pending e or medial ra, no mark typed
// twice, no stack after a mark, no going on past a held unit), the marks came in rank order, the asat stays where
// it was typed (asatStaysAsTyped), and no look-alike letter is read as another (§3.4, fixLookAlikeLetters). With
// the marks in rank order already, rankMarks changes no rank: ai or anusvara ranks lower only when typed before
// aa, which ranks below them.
export function writesAsTyped(buf) {
  if (!buf.typedInOrder || !marksInRankOrder(buf)) return false;
  const stacked = buf.stackLength > 0 || buf.baseHasVirama;
  const hasAsat = (buf.markMask & MASK_ASAT) !== 0;
  if (hasAsat && !asatStaysAsTyped(buf, stacked)) return false;
  if ((buf.markMask & MASK_MEDIAL_YA) !== 0 && readsCaWithMedialYaAsJha(buf)) return false;
  if (buf.baseLength !== 1) return true;
  if (buf.base === CP.LETTER_U) return buf.keepU || !(stacked || hasAsat || (buf.markMask & MASK_ANY_AA) !== 0);
  if (buf.base === CP.DIGIT_SEVEN) return (buf.markMask & ~MASK_VISARGA) === 0;
  return true;
}

// Whether no mark ranks below the mark before it, so that sortByRank keeps the typed order.
function marksInRankOrder(buf) {
  let previous = -1;
  for (let k = 0; k < buf.markCount; k++) {
    const rank = markRank(buf.marks[k]);
    if (rank < previous) return false;
    previous = rank;
  }
  return true;
}

// Whether placeAsat leaves the asat where it was typed. DROPPED removes it. IN_ORDER sorts it with the marks, which
// are in order. ON_CONSONANT writes it right after the base and stack, which is where it was typed only as the
// first mark. AFTER_MEDIALS writes it after the medials, where it was typed only when no mark ranked between them
// (e to dot below) is present. The tests are placeAsat's, in its order.
function asatStaysAsTyped(buf, stacked) {
  const mask = buf.markMask;
  const hasAa = (mask & MASK_ANY_AA) !== 0;
  const hasDotBelow = (mask & MASK_DOT_BELOW) !== 0;
  if (!hasAa && ((mask & MASK_UPPER_VOWELS) !== 0 || (stacked && !hasDotBelow))) return false; // DROPPED
  if (hasDotBelow || isEOrAaTypedBeforeAsat(buf) || (hasAa && (mask & MASK_MEDIALS) === 0)) return true; // IN_ORDER
  if ((mask & MASK_MEDIAL_HA) !== 0) return (mask & MASK_E_TO_DOT_BELOW) === 0; // AFTER_MEDIALS
  return buf.marks[0] === CP.ASAT; // ON_CONSONANT
}

// Writes the syllable in UTN #11 storage order (2.x order(), storageOrder.js:101-185).
export function orderSyllable(buf, sink) {
  if (buf.markCount === 0 && buf.stackLength === 0) {
    writeKinziAndBase(buf, sink);
    return;
  }
  const stacked = buf.stackLength > 0 || buf.baseHasVirama;
  const hadAa = (buf.markMask & MASK_ANY_AA) !== 0; // read before any mark is removed
  const place = placeAsat(buf, stacked);
  fixLookAlikeLetters(buf, place, stacked, hadAa);
  if (buf.markCount > 1) {
    // One mark is in order already.
    rankMarks(buf);
    sortByRank(buf);
  }
  writeOrdered(buf, place, sink);
}

// Where the asat goes (UTN #11; the asat rules of research/zawgyi-to-unicode.md §3 and research/normalize.md §3).
// The first test that holds wins, as in storageOrder.js:117-132. Removes the asat from the marks unless it stays
// IN_ORDER.
export function placeAsat(buf, stacked) {
  const mask = buf.markMask;
  if ((mask & MASK_ASAT) === 0) return ASAT_PLACE.NONE;
  const hasAa = (mask & MASK_ANY_AA) !== 0;
  const hasDotBelow = (mask & MASK_DOT_BELOW) !== 0;
  // A slip, typed early for the next consonant's asat: no syllable has i or ii with asat, and a stacked consonant
  // takes none, unless aa makes it the vowel's asat (research/zawgyi-to-unicode.md §3, "Asat dropped").
  if (!hasAa && ((mask & MASK_UPPER_VOWELS) !== 0 || (stacked && !hasDotBelow))) {
    buf.removeMark(CP.ASAT);
    return ASAT_PLACE.DROPPED;
  }
  // Stored last: with a dot below, typed after e or aa (kyaw; research/normalize.md §3), or with aa and no medial
  // to make a contraction (research/zawgyi-to-unicode.md §3, "Asat typed before aa").
  if (hasDotBelow || isEOrAaTypedBeforeAsat(buf) || (hasAa && (mask & MASK_MEDIALS) === 0)) {
    return ASAT_PLACE.IN_ORDER;
  }
  // On the consonant: after the medials with medial ha (Mon's final h, ရှ်), else right after the consonant and its
  // stack, before the medials (ခ်ျ, ကျွန်ုပ်). UTN #11; research/zawgyi-to-unicode.md §3, "Asat on a consonant with a
  // medial and no vowel", "Asat with medial ha" and "Asat with ု and no other vowel".
  buf.removeMark(CP.ASAT);
  return (mask & MASK_MEDIAL_HA) !== 0 ? ASAT_PLACE.AFTER_MEDIALS : ASAT_PLACE.ON_CONSONANT;
}

// Whether e, tall aa or aa comes before the asat in typed order (2.x hasAny(marks, E_AA, asat)).
function isEOrAaTypedBeforeAsat(buf) {
  for (let k = 0; k < buf.markCount && buf.marks[k] !== CP.ASAT; k++) {
    if ((markBit(buf.marks[k]) & MASK_E_OR_AA) !== 0) return true;
  }
  return false;
}

// The letters the fonts draw alike, in this order (§3.4; research/zawgyi-to-unicode.md §3, "Letters Zawgyi draws
// alike"). Each rule runs only for its letter: medial ya, then a one-unit base of u or seven. 2.x compared the whole
// base text, so a font's ligature or whole base never matches.
export function fixLookAlikeLetters(buf, place, stacked, hadAa) {
  if ((buf.markMask & MASK_MEDIAL_YA) !== 0) readCaWithMedialYaAsJha(buf);
  if (buf.baseLength !== 1) return;
  if (buf.base === CP.LETTER_U) readLetterUAsNya(buf, place, stacked, hadAa);
  else if (buf.base === CP.DIGIT_SEVEN) readSevenWithMarksAsRa(buf, place);
}

// Ca with medial ya is jha, stacked too (မဇ္ဈိမ): the stack's last consonant first, else a lone ca base.
function readCaWithMedialYaAsJha(buf) {
  if (!readsCaWithMedialYaAsJha(buf)) return;
  if (buf.stackLength > 0) buf.stack[buf.stackLength - 1] = CP.JHA;
  else buf.replaceBase(CP.JHA);
  buf.removeMark(CP.MEDIAL_YA);
}

// Whether the syllable has ca where readCaWithMedialYaAsJha reads it: as the last stacked consonant, else as a
// lone base.
function readsCaWithMedialYaAsJha(buf) {
  if (buf.stackLength > 0) return buf.stack[buf.stackLength - 1] === CP.CA;
  return buf.baseLength === 1 && buf.base === CP.CA;
}

// The vowel u never takes a stacked consonant, an asat or aa (UTN #11): u with one is nya, as in ညဉ့် and ဉာဏ်.
// keepU keeps it u after a vowel sign, where Pa'o writes it (research/normalize.md §3, "ဥ and ဉ").
function readLetterUAsNya(buf, place, stacked, hadAa) {
  if (buf.keepU) return;
  const keepsAsat = place === ASAT_PLACE.IN_ORDER || place === ASAT_PLACE.ON_CONSONANT ||
    place === ASAT_PLACE.AFTER_MEDIALS;
  if (stacked || keepsAsat || hadAa) buf.replaceBase(CP.NYA);
}

// A digit takes no vowel sign or medial, so seven with one is ra (ေ၇း is ရေး). After digits a visarga alone is a
// colon, as in 7:30 (research/zawgyi-to-unicode.md §3; research/normalize.md §3, "Look-alikes").
function readSevenWithMarksAsRa(buf, place) {
  const asatOnConsonant = place === ASAT_PLACE.ON_CONSONANT || place === ASAT_PLACE.AFTER_MEDIALS;
  const marksBesidesVisarga = buf.markCount - ((buf.markMask & MASK_VISARGA) !== 0 ? 1 : 0);
  if (asatOnConsonant || marksBesidesVisarga > 0) buf.replaceBase(CP.RA);
}

// Fills buf.ranks with each mark's MARK_GROUPS rank. ai and anusvara come after a lower vowel and aa (UTN #11).
// With no lower vowel, either may be typed before aa to sit on the consonant, as Mon and Karen write it (ခရံာ်,
// Christ), and stays there, except anusvara before tall aa, which UTN #11 does not allow (research/normalize.md §3,
// "ai and anusvara").
export function rankMarks(buf) {
  const hasLowerVowel = (buf.markMask & MASK_LOWER_VOWELS) !== 0;
  for (let k = 0; k < buf.markCount; k++) {
    let rank = markRank(buf.marks[k]);
    if (rank === RANK_AI_ANUSVARA && !hasLowerVowel && sitsBeforeAa(buf, k)) rank = RANK_LOWER_VOWEL;
    buf.ranks[k] = rank;
  }
}

// Whether the ai or anusvara at marks[k] was typed before the aa (aa itself if present, else tall aa), and is
// not anusvara before tall aa.
function sitsBeforeAa(buf, k) {
  const shortAa = buf.indexOfMark(CP.AA);
  const aa = shortAa >= 0 ? shortAa : buf.indexOfMark(CP.TALL_AA);
  return aa > k && !(buf.marks[k] === CP.ANUSVARA && buf.marks[aa] === CP.TALL_AA);
}

// A stable insertion sort of the marks by rank: marks of one MARK_GROUPS group keep their typed order, and a
// syllable has few marks.
export function sortByRank(buf) {
  const marks = buf.marks;
  const ranks = buf.ranks;
  for (let n = 1; n < buf.markCount; n++) {
    const mark = marks[n];
    const rank = ranks[n];
    let at = n - 1;
    while (at >= 0 && ranks[at] > rank) {
      marks[at + 1] = marks[at];
      ranks[at + 1] = ranks[at];
      at--;
    }
    marks[at + 1] = mark;
    ranks[at + 1] = rank;
  }
}

// Writes kinzi, base, stack, an asat on the consonant, then the sorted marks, with an asat after the medials for
// AFTER_MEDIALS (UTN #11; research/zawgyi-to-unicode.md §3, "Asat with medial ha": ရှ်).
export function writeOrdered(buf, place, sink) {
  writeKinziAndBase(buf, sink);
  sink.pushCodes(buf.stack, 0, buf.stackLength);
  if (place === ASAT_PLACE.ON_CONSONANT) sink.push(CP.ASAT);
  let k = 0;
  if (place === ASAT_PLACE.AFTER_MEDIALS) {
    while (k < buf.markCount && markRank(buf.marks[k]) <= RANK_LAST_MEDIAL) sink.push(buf.marks[k++]);
    sink.push(CP.ASAT);
  }
  for (; k < buf.markCount; k++) sink.push(buf.marks[k]);
}

// The kinzi is its lead (nga, or ra as repha), asat and virama, stored before the base it sits on (UTN #11).
function writeKinziAndBase(buf, sink) {
  if (buf.kinziLead !== 0) {
    sink.push(buf.kinziLead);
    sink.push(CP.ASAT);
    sink.push(CP.VIRAMA);
  }
  sink.pushCodes(buf.baseCodes, 0, buf.baseLength);
}

// Writes what was held after the syllable: the zero-width units held before it last went on, then everything
// held since (2.x `out += order(syllable) + syllable.after`). Zero-width spaces and joiners mark word breaks, so
// they stay, after the syllable they were typed in (research/zawgyi-to-unicode.md §3, "Zero-width spaces").
export function writeHeld(buf, sink) {
  for (let k = 0; k < buf.keptUpTo; k++) {
    if (zeroWidthBit(buf.held[k]) !== 0) sink.push(buf.held[k]);
  }
  sink.pushCodes(buf.held, buf.keptUpTo, buf.heldLength);
}

// ---------------------------------------------------------------------------------------------------------------
// The reader decisions that take the reader's options (§3.5).

// Whether the unit is held after the open syllable: a space or no-break space, or a zero-width character that the
// reader holds (`heldZeroWidth`).
export function isHeld(buf, code, reading) {
  return buf.isOpen && (isSpaceBeforeMark(code) || (zeroWidthBit(code) & reading.heldZeroWidth) !== 0);
}

// Whether a mark may join the open syllable across what is held after it. A Burmese digit base takes no mark from
// across a space unless the reader allows it (`digitTakesMarksAcrossSpace`; research/normalize.md §3, "Space
// before a mark": not after a digit).
export function marksGoOn(buf, reading) {
  return !buf.spaceHeld || reading.digitTakesMarksAcrossSpace || !isBurmeseDigit(buf.base);
}
