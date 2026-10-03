// NFC in linear time (DESIGN.md §2.3, §3.10, D20). Layer L1. Owner: W1 (core). This file holds the only calls of
// String#normalize in src/ (test/next/core-nfc.test.mjs checks it).
//
// toNfc(text) returns exactly what text.normalize('NFC') returns. NFC puts each run of non-starters (characters
// of a canonical combining class above 0, such as dot below, virama and asat) in canonical order (The Unicode
// Standard §3.11, the canonical ordering algorithm), and String#normalize does that with an insertion sort, in
// Node and in Bun: a long run out of order takes quadratic time. Ka followed by 32,000 pairs of dot below and
// virama took 984 ms (Node 26), so a short untrusted input could stall a server (SECURITY.md).
//
// So a run longer than STREAM_SAFE_RUN units is put in canonical order here first, in linear time: its characters
// are decomposed, and the code points stably sorted by combining class with a bucket sort. That is what NFC does to
// the run itself, so the text stays canonically equivalent and keeps its NFC, and normalize then finds the run in
// order, which it handles in linear time. Shorter runs, which is all of them in ordinary text, go to normalize as
// they are. This is the 2.x helper (library/nfc.js, d170cd8), ported by W1 (DESIGN.md §7.3).
//
// JavaScript has no table of combining classes, so they are read from normalize itself, with probes of two or
// three characters, and kept in a memo: they are always the runtime's own. The memo holds facts about the
// runtime's Unicode data, never the result of a call, and its size is bounded by that data (D20, §3.11).

// The longest run of non-starters, in UTF-16 units, left to normalize as it is: the limit of the stream-safe text
// format (UAX #15 §13), which ordinary text never reaches.
const STREAM_SAFE_RUN = 30;

// Two non-starters of different classes, for the probes: asat (class 9) and dot below (class 7). Canonical
// ordering moves the dot below in front of the asat across any non-starter between them, and across no starter.
const PROBE_HIGH_CLASS = '\u103A';
const PROBE_LOW_CLASS = '\u1037';

// What the memo knows of a code point below U+20000.
const KIND_UNSEEN = 0;
const KIND_ENDS_RUN = 1; // a starter, or a starter with marks such as U+1E09: it ends the run before it
const KIND_IN_RUN = 2; // a run character: its canonical decomposition is all non-starters

// An empty memo of the runtime's Unicode data (D20):
// - kinds: a Uint8Array of KIND_* for the code points below U+20000 (the BMP and plane 1, 128 KB), allocated at
//   the first probe. A code point above U+1FFFF is probed again each time it is looked at, unless it is a run
//   character, so the memory stays bounded whatever the text.
// - decompositions: each run character seen, by code point: its canonical decomposition as
//   [non-starter, class entry, non-starter, class entry, ...].
// - classes: one entry { mark, rank } per combining class seen, in canonical order; rank is its index.
// - classOfMark: each non-starter seen (a one-code-point string), with its class entry.
export function createNfcMemo() {
  return { kinds: null, decompositions: new Map(), classes: [], classOfMark: new Map() };
}

// The one memo of the core, filled lazily and never reset (D20; the stateless guard exempts it by name).
const NFC_MEMO = /* @__PURE__ */ createNfcMemo();

// text.normalize('NFC'), in linear time.
export function toNfc(text) {
  return toNfcWith(text, NFC_MEMO);
}

// toNfc with a memo of the caller's: test/next/guards/stateless.test.mjs compares a cold memo with the warm one.
// A text of STREAM_SAFE_RUN units or fewer has no run to put in order, so it goes to normalize at once: most
// words do (normalize per word is a perf workload, DESIGN.md §6.4).
export function toNfcWith(text, memo) {
  const ordered = text.length > STREAM_SAFE_RUN ? orderLongRuns(text, STREAM_SAFE_RUN, memo) : text;
  return ordered.normalize('NFC');
}

// text with every run of more than `longest` units of run characters (see decomposeRunCharacter) in canonical
// order, and the rest as it is. The result is canonically equivalent to text, so it has the same NFC. Exported
// for test/next/core-nfc.test.mjs, which checks the order it gives every pair of run characters, at longest 1.
//
// A run of more than `longest` units covers one unit in every longest + 1, so only those are looked at, and the run
// around each one that is a run character is measured. A run short enough to stay as it is cannot reach the unit
// looked at before, and a longer one is skipped once it is in order, so each unit is read a few times at most.
// Ordinary text has few run characters, so most of it is never read at all.
export function orderLongRuns(text, longest, memo) {
  let out = '';
  let done = 0; // the text before `done` is in out
  for (let i = longest; i < text.length; i += longest + 1) {
    if (!isRunCharacterAt(text, i, memo)) continue;
    const from = runStartBefore(text, i, done, memo);
    const to = runEndAfter(text, i + 1, memo);
    if (to - from <= longest) continue;
    out += text.slice(done, from) + canonicalOrder(text, from, to, memo);
    done = i = to; // the unit at `to` ends the run, so the next run starts after it
  }
  return done === 0 ? text : out + text.slice(done);
}

// Where the run that holds unit i starts: never before `done`, the end of the last run put in order.
function runStartBefore(text, i, done, memo) {
  let from = i;
  while (from > done && isRunCharacterAt(text, from - 1, memo)) from--;
  return from;
}

// Where the run that holds the unit before `to` ends.
function runEndAfter(text, to, memo) {
  while (to < text.length && isRunCharacterAt(text, to, memo)) to++;
  return to;
}

// Whether the character that unit i of text belongs to is a run character. Both halves of a surrogate pair belong
// to the pair's code point, and a lone surrogate is not a run character, as normalize leaves it alone.
function isRunCharacterAt(text, i, memo) {
  let code = text.charCodeAt(i);
  if (code < 0x300) return false; // U+0300 is the first non-starter
  if (code >= 0xD800 && code <= 0xDFFF) {
    code = text.codePointAt(code < 0xDC00 ? i : i - 1) | 0; // a low surrogate's pair starts before it
    if (code < 0x10000) return false; // a lone surrogate
  }
  if (code > 0x1FFFF) return memo.decompositions.has(code) || decomposeRunCharacter(code, memo) !== null;
  const kinds = memo.kinds || (memo.kinds = new Uint8Array(0x20000));
  if (kinds[code] === KIND_UNSEEN) kinds[code] = decomposeRunCharacter(code, memo) ? KIND_IN_RUN : KIND_ENDS_RUN;
  return kinds[code] === KIND_IN_RUN;
}

// The decomposition of a run character, kept in the memo; null for any other character. A run character is one
// whose canonical decomposition is all non-starters: a combining mark, or one of the few characters, such as
// U+0344 and U+0F73, that decompose into two of them. A letter with marks, such as U+1E09, ends the run before it,
// and normalize adds its marks to the run after it, at a cost of a step for each of them per character of the run.
//
// A code point y of a decomposition is a non-starter when canonical ordering moves the low probe in front of the
// high one across it: a starter between them ends the run, and each probe stays where it is.
function decomposeRunCharacter(code, memo) {
  const decomposed = nfd(String.fromCodePoint(code));
  const list = [];
  for (let i = 0; i < decomposed.length;) {
    const y = String.fromCodePoint(decomposed.codePointAt(i));
    const probe = PROBE_HIGH_CLASS + y + PROBE_LOW_CLASS;
    if (nfd(probe) === probe) return null;
    list.push(y, combiningClassOf(y, memo));
    i += y.length;
  }
  memo.decompositions.set(code, list);
  return list;
}

// The class entry of non-starter y, kept in the memo.
function combiningClassOf(y, memo) {
  let entry = memo.classOfMark.get(y);
  if (entry === undefined) {
    entry = findOrInsertClass(y, memo.classes);
    memo.classOfMark.set(y, entry);
  }
  return entry;
}

// The entry of y's class in classes, which are in canonical order. y is compared with a mark of each class, in
// order, by the order canonical ordering puts the two in. A class not seen yet is inserted in its place, and the
// ranks after it are renumbered, so the entries already handed out keep a true rank.
function findOrInsertClass(y, classes) {
  let i = 0;
  for (; i < classes.length; i++) {
    const mark = classes[i].mark;
    if (nfd(mark + y) !== mark + y) break; // y sorts before this class
    if (nfd(y + mark) === y + mark) return classes[i]; // neither moves: y is of this class
  }
  const entry = { mark: y, rank: i };
  classes.splice(i, 0, entry);
  for (let r = i + 1; r < classes.length; r++) classes[r].rank = r;
  return entry;
}

// The run of characters in text[from, to), in canonical order: the code points of their decompositions, sorted
// by class with a stable bucket sort.
function canonicalOrder(text, from, to, memo) {
  const buckets = [];
  for (let i = from; i < to;) {
    const code = text.codePointAt(i);
    const list = memo.decompositions.get(code);
    for (let j = 0; j < list.length; j += 2) {
      const rank = list[j + 1].rank;
      (buckets[rank] || (buckets[rank] = [])).push(list[j]);
    }
    i += code > 0xFFFF ? 2 : 1;
  }
  let out = '';
  for (let rank = 0; rank < buckets.length; rank++) {
    if (buckets[rank]) out += buckets[rank].join('');
  }
  return out;
}

function nfd(text) {
  return text.normalize('NFD');
}
