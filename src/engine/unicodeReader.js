// The Unicode reader of normalize: Unicode text in UTN #11 storage order, in one pass from left to right (DESIGN.md
// §3.5, §3.6; research/normalize.md §2-3). Layer L3 engine. Owner: W5 (engine-unicode).
//
// Unicode text is already in logical order: a kinzi comes before the consonant it sits on, a stacked consonant
// (virama and consonant) after it, and e and medial ra after it with the other marks. So mostly only the marks need
// sorting, which orderSyllable does by the same rules as for the fonts (engine/syllable.js). Two habits of Zawgyi
// typing are undone (research/normalize.md §3):
// - an e or medial ra typed before the consonant that follows it (placePrebaseMark);
// - a space typed before a mark of the syllable, which is dropped.
//
// The behaviour is that of 2.x arrangeUnicode (scripts/oracle/storageOrder.js:321-434), unit for unit, and
// test/next/readers-unicode.fuzz.test.mjs checks it. The structure is new: the hot state lives in the scratch
// SyllableBuffer and one state object, each run of e and medial ra is read once, the mark mask answers "has a vowel"
// in O(1), and the output goes through a CopyThroughWriter, so a syllable already in order costs a comparison and
// no string.

import { deepFreeze } from '../freeze.js';
import {
  CP, CLS, classOf, isBurmeseConsonant, isSyllableBase, isBurmeseDigit, isBurmeseMark, isPrebaseMark,
  isOtherScriptLetter, isVowelSign, isNfcSafe, isMyanmarBlock, zeroWidthBit, MASK_VOWEL_OR_FINAL, MASK_ASAT,
  MASK_MEDIAL_HA
} from '../script/codes.js';
import { SyllableBuffer, CopyThroughWriter, closeSyllable, isHeld, marksGoOn } from './syllable.js';

// The Unicode reader's side of the four deliberate differences between the readers (§3.5).
export const UNICODE_READING = /* @__PURE__ */ deepFreeze({
  // ZW.ZWSP | ZW.WORD_JOINER | ZW.BOM: ZWNJ and ZWJ stay where they were typed, since in Unicode text they can
  // shape the syllable (research/normalize.md §3, "Spaces and joiners").
  heldZeroWidth: 25,
  // A Burmese digit takes no mark from across a space (research/normalize.md §3).
  digitTakesMarksAcrossSpace: false,
  // An e or medial ra looks only at the unit right after its run, so a zero-width unit there makes it stay.
  prebaseCrossesZeroWidth: false,
  // U+1025 right after a vowel sign stays u, as Pa'o writes it (research/normalize.md §3).
  keepUAfterVowelSign: true
});

// What the reader saw, for the final-NFC gate (§3.10).
export const SEEN = /* @__PURE__ */ deepFreeze({
  LETTER_U: 1, // U+1025: followed by U+102E, NFC composes it into U+1026
  NFC_UNSAFE: 2 // a unit at or above U+0300, outside U+1000-U+109F, for which isNfcSafe does not hold
});

// Where placePrebaseMark sends an e or medial ra (2.x HERE, NEXT and ALONE).
const TO_OPEN_SYLLABLE = 0;
const TO_NEXT_BASE = 1;
const STAYS = 2;

// The reader's scratch (§3.11): one SyllableBuffer, one CopyThroughWriter and the per-call state, made once,
// reset at the start of each call and released when large at its end. While it holds data the reader calls nothing
// but this module, syllable.js and codes.js, so a call cannot re-enter it.
const SCRATCH = /* @__PURE__ */ createScratch();

function createScratch() {
  return {
    syllable: new SyllableBuffer(),
    writer: new CopyThroughWriter(),
    runEnd: 0, // the end of the last run of e and medial ra that placePrebaseMark looked past
    pendingStart: 0, // where the pending run starts in the text
    syllableStart: 0, // where the open syllable's source begins: its pending run, else its kinzi or base
    seen: 0 // SEEN flags
  };
}

// { text, seen }: text in storage order, and the SEEN flags (§3.6). The text is the input string itself when no
// syllable changed.
//
// Each unit goes to the first of these steps that takes it, and the order is part of the behaviour:
//   1. held; 2. kinzi; 3. base; 4. e or medial ra; 5. virama; 6. mark; 7. anything else.
// The loop dispatches on the unit's class first, which keeps that order, because the classes are disjoint: only a
// unit outside the Burmese classes can be held (a space or a zero-width character), and only a consonant can start
// a kinzi. So a Burmese unit pays for no test of a step that cannot take it.
export function reorderUnicode(text) {
  const scratch = SCRATCH;
  startReading(scratch, text);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    switch (classOf(code)) {
      case CLS.CONSONANT:
        // 2. Kinzi, which opens a syllable on the consonant it sits on; else 3. a base. Returns the last unit read.
        i = readConsonant(scratch, text, i, code);
        break;
      case CLS.LETTER:
      case CLS.DIGIT:
        // 3. Base. Digits too: zero and seven are typed for wa and ra (research/normalize.md §3, "Look-alikes").
        readBase(scratch, text, i, code);
        break;
      case CLS.PREBASE:
        // 4. e or medial ra: to the open syllable, to the next base, or where it is.
        readPrebaseMark(scratch, text, i, code);
        break;
      case CLS.VIRAMA:
        // 5. Virama: a stacked consonant, past any e or medial ra typed between. Returns the last unit read.
        i = readVirama(scratch, text, i);
        break;
      case CLS.MARK:
        // 6. Mark.
        readMark(scratch, i, code);
        break;
      default:
        // 1. Held after the open syllable, else 7. it closes the syllable and stays where it is.
        readOther(scratch, i, code);
    }
  }
  return finishReading(scratch, text.length);
}

// The capacity, in units, of this module's scratch buffers (§3.11), for the memory tests.
export function unicodeReaderScratchUnits() {
  return SCRATCH.syllable.capacity() + SCRATCH.writer.syllable.capacity();
}

function startReading(scratch, text) {
  scratch.syllable.reset();
  scratch.writer.begin(text);
  scratch.runEnd = 0;
  scratch.pendingStart = 0;
  scratch.syllableStart = 0;
  scratch.seen = 0;
}

// Closes the open syllable and returns the result. The pending list is empty here: a pending run is always
// followed by the base it waits for (placePrebaseMark).
function finishReading(scratch, end) {
  closeOpenSyllable(scratch, end);
  const text = scratch.writer.finish();
  scratch.syllable.releaseIfLarge();
  scratch.writer.releaseIfLarge();
  return { text: text, seen: scratch.seen };
}

// Closes the open syllable, if any. Its source is text[syllableStart, end), where `end` is where the unit that
// closed it begins: what the writer compares the written syllable with.
function closeOpenSyllable(scratch, end) {
  const buf = scratch.syllable;
  if (!buf.isOpen) return;
  if (buf.markCount === 0 && buf.stackLength === 0 && buf.heldLength === 0) {
    // A bare base, or a kinzi and its base, with nothing held after it: no pending mark joined it (it would be a
    // mark), so its source is exactly what orderSyllable would write, and there is nothing to compare.
    buf.isOpen = false;
    return;
  }
  const writer = scratch.writer;
  writer.beginSyllable();
  closeSyllable(buf, writer.syllable);
  writer.endSyllable(scratch.syllableStart, end);
}

// Closes the open syllable and opens one at i. The pending e and medial ra become its first marks, and its source
// begins where they do.
function openSyllableAt(scratch, i, kinziLead, keepU) {
  closeOpenSyllable(scratch, i);
  scratch.syllableStart = scratch.syllable.pendingLength > 0 ? scratch.pendingStart : i;
  scratch.syllable.open(kinziLead, keepU);
}

// Steps 2 and 3 for a consonant: a kinzi opens a syllable on the consonant it sits on, and reading goes on after
// that consonant; any other consonant is a base. Returns the index of the last unit read. The units a kinzi
// skips are Burmese and none is U+1025, so `seen` needs none of them.
function readConsonant(scratch, text, i, code) {
  if (!isKinziAt(text, i)) {
    readBase(scratch, text, i, code);
    return i;
  }
  openSyllableAt(scratch, i, code, false);
  scratch.syllable.setBase(text.charCodeAt(i + 3));
  return i + 3;
}

// Step 3: a base closes the open syllable and opens one. Every U+1025 is read here, so this is where `seen` notes
// it: followed by ii, NFC composes it into U+1026 (§3.10).
function readBase(scratch, text, i, code) {
  if (code === CP.LETTER_U) scratch.seen |= SEEN.LETTER_U;
  openSyllableAt(scratch, i, 0, keepsLetterU(text, i, code));
  scratch.syllable.setBase(code);
}

// Steps 1 and 7 for a unit outside the Burmese classes. A space, or a zero-width character the reader holds, after
// an open syllable is held until the next unit shows whether the syllable goes on. Anything else closes the
// syllable and stays where it is. Every unit outside the Myanmar block is read here, so this is where `seen` notes
// one that NFC could move or compose with its neighbours (§3.10); the units the reader holds are all NFC-safe.
function readOther(scratch, i, code) {
  const buf = scratch.syllable;
  if (isHeld(buf, code, UNICODE_READING)) {
    buf.hold(code, zeroWidthBit(code) !== 0);
    return;
  }
  if (code >= 0x0300 && !isMyanmarBlock(code) && !isNfcSafe(code)) scratch.seen |= SEEN.NFC_UNSAFE;
  closeOpenSyllable(scratch, i);
}

// A kinzi at i: nga, or ra as Sanskrit repha, then asat and virama, before the Burmese consonant it sits on (UTN
// #11; storageOrder.js isKinziAt).
function isKinziAt(text, i) {
  const code = text.charCodeAt(i);
  return (code === CP.NGA || code === CP.RA) && text.charCodeAt(i + 1) === CP.ASAT &&
    text.charCodeAt(i + 2) === CP.VIRAMA && isBurmeseConsonant(text.charCodeAt(i + 3));
}

// u right after a vowel sign starts a syllable of its own and stays u, as in Pa'o ဥ်း; after a consonant or medial
// it is typed for nya, and orderSyllable makes it nya (research/normalize.md §3, "ဥ and ဉ";
// UNICODE_READING.keepUAfterVowelSign).
function keepsLetterU(text, i, code) {
  return code === CP.LETTER_U && UNICODE_READING.keepUAfterVowelSign && isVowelSign(text.charCodeAt(i - 1));
}

// Step 4: an e or medial ra goes where placePrebaseMark sends it.
function readPrebaseMark(scratch, text, i, code) {
  const place = placePrebaseMark(scratch, text, i, code);
  if (place === TO_NEXT_BASE) {
    closeOpenSyllable(scratch, i);
    if (scratch.syllable.pendingLength === 0) scratch.pendingStart = i;
    scratch.syllable.addPending(code);
  } else if (place === TO_OPEN_SYLLABLE) {
    readMark(scratch, i, code);
  } else {
    closeOpenSyllable(scratch, i);
  }
}

// Where the e or medial ra at i goes (research/normalize.md §3, "e and medial ra typed before their consonant";
// 2.x placeTypedFirst, without its rescan). It decides in O(1) from the mark mask, and reads each run of e and
// medial ra once. UNICODE_READING.prebaseCrossesZeroWidth is false: only the unit right after the run counts.
function placePrebaseMark(scratch, text, i, code) {
  const buf = scratch.syllable;
  if (i >= scratch.runEnd) scratch.runEnd = endOfPrebaseRun(text, i + 1);
  const after = text.charCodeAt(scratch.runEnd);
  // Right after a letter or mark of another Myanmar-script language it stays: those syllables are not read here
  // (as with a Mon medial in တၟေင်).
  if (!buf.isOpen && isOtherScriptLetter(text.charCodeAt(i - 1))) return STAYS;
  // To the open syllable unless it is finished and no mark of it follows.
  if (!isFinished(buf, code) || (buf.isOpen && (isBurmeseMark(after) || after === CP.VIRAMA))) {
    return TO_OPEN_SYLLABLE;
  }
  // Else to the base after the run (လည်းေကာင်း is လည်းကောင်း). With no base there it belongs to neither syllable
  // and stays as typed, as in Okell's ေ(ရ.
  return isSyllableBase(after) || isBurmeseDigit(after) ? TO_NEXT_BASE : STAYS;
}

// The end of the run of e and medial ra that continues at `from`.
function endOfPrebaseRun(text, from) {
  let end = from;
  while (isPrebaseMark(text.charCodeAt(end))) end++;
  return end;
}

// Whether no e or medial ra can join the open syllable: there is none, a space is held after it, or it already
// has its vowel or final. An asat alone still takes a medial ra (ခ်ြ), and an asat after medial ha, Mon's final h,
// still takes e (research/normalize.md §3).
function isFinished(buf, code) {
  if (!buf.isOpen || buf.spaceHeld) return true;
  if ((buf.markMask & MASK_VOWEL_OR_FINAL) !== 0) return true;
  return (buf.markMask & MASK_ASAT) !== 0 && code !== CP.MEDIAL_RA && (buf.markMask & MASK_MEDIAL_HA) === 0;
}

// Step 5: a virama with a Burmese consonant after it, past any e or medial ra, is a stacked consonant of the open
// syllable. The e and medial ra between join as marks. Returns the index of the last unit read.
function readVirama(scratch, text, i) {
  const buf = scratch.syllable;
  const at = buf.isOpen ? stackedConsonantAt(text, i) : -1;
  if (at < 0 || !marksGoOn(buf, UNICODE_READING)) {
    closeOpenSyllable(scratch, i);
    return i;
  }
  buf.goOn();
  for (let k = i + 1; k < at; k++) buf.pushMark(text.charCodeAt(k));
  buf.pushStack(CP.VIRAMA);
  buf.pushStack(text.charCodeAt(at));
  return at;
}

// The stacked consonant after the virama at i, past any e or medial ra typed before it, or -1.
function stackedConsonantAt(text, i) {
  const at = endOfPrebaseRun(text, i + 1);
  return isBurmeseConsonant(text.charCodeAt(at)) ? at : -1;
}

// Step 6: a mark joins the open syllable unless a space held after it keeps it apart. A space typed before a mark
// only moved it and is dropped, but not after a digit (marksGoOn), and an e or medial ra never goes back across a
// space (research/normalize.md §3, "Spaces and joiners"; §3.5). Otherwise it closes the syllable and stays.
function readMark(scratch, i, code) {
  const buf = scratch.syllable;
  if (buf.isOpen && marksGoOn(buf, UNICODE_READING) && !(buf.spaceHeld && isPrebaseMark(code))) {
    buf.goOn();
    buf.pushMark(code);
  } else {
    closeOpenSyllable(scratch, i);
  }
}
