'use strict';
// NFC in linear time. nfc(text) returns exactly what text.normalize('NFC') returns.
//
// NFC puts each run of non-starters (characters of a canonical combining class above 0, such as dot below,
// virama and asat) in canonical order, and String.prototype.normalize does that with an insertion sort, in Node
// and in Bun: a long run out of order takes quadratic time. Ka followed by 32,000 pairs of dot below and virama
// took about a second.
//
// So a run longer than LONGEST is put in canonical order here first, in linear time: its characters are
// decomposed, and the code points stably sorted by combining class. That is what NFC does to the run itself, so
// the text stays canonically equivalent and keeps its NFC, and normalize then finds the run in order, which it
// handles in linear time. Shorter runs, which is all of them in ordinary text, go to normalize as they are.
//
// JavaScript has no table of combining classes. The classes are read from normalize itself, by normalizing
// strings of two or three characters, and kept per character, so they always match the runtime's Unicode data.

// The longest run of non-starters, in UTF-16 code units, left to normalize as it is: UAX #15's limit for
// stream-safe text.
const LONGEST = 30;

// Two non-starters, of different classes: asat (9) and dot below (7).
const HIGH = String.fromCharCode(0x103A);
const LOW = String.fromCharCode(0x1037);

var kinds = null; // per code point below U+20000: 0 not seen yet, 1 not a run character, 2 a run character
var parts = {}; // run character -> what decompose returned for it
var classes = []; // one per combining class seen so far, in canonical order: { mark, rank }
var classOf = {}; // non-starter -> its class

function nfd(text) {
  return text.normalize('NFD');
}

// The class of non-starter y, found by comparing y with a mark of each class seen so far, in order, by the order
// canonical ordering puts the two in. A class not seen yet is inserted, and the ranks renumbered.
function classFor(y) {
  var i, mark;
  if (classOf[y]) return classOf[y];
  for (i = 0; i < classes.length; i++) {
    mark = classes[i].mark;
    if (nfd(mark + y) !== mark + y) break; // y comes first
    if (nfd(y + mark) === y + mark) return (classOf[y] = classes[i]); // neither moves: the same class
  }
  classes.splice(i, 0, classOf[y] = { mark: y });
  for (i = 0; i < classes.length; i++) classes[i].rank = i;
  return classOf[y];
}

// A run character is one whose canonical decomposition is all non-starters: a combining mark, or one of the few
// characters, such as U+0344 and U+0F73, that decompose into two of them. For a run character, decompose returns
// the code points of its decomposition, each followed by its class, and keeps them in `parts`; for any other
// character, which ends a run, null. A letter with marks, such as U+1E09, ends the run before it, and normalize
// adds its marks to the run after it, which costs a step for each of them per character of the run when the run is
// in order.
//
// A code point y of a decomposition is a non-starter when canonical ordering puts the low mark before the high
// one across it: a starter between them would end the run.
function decompose(code) {
  var d = nfd(String.fromCodePoint(code));
  var list = [];
  var i, y, probe;
  for (i = 0; i < d.length; i += y.length) {
    y = String.fromCodePoint(d.codePointAt(i));
    probe = HIGH + y + LOW;
    if (nfd(probe) === probe) return null;
    list.push(y, classFor(y));
  }
  return (parts[code] = list);
}

// Whether the character that code unit i of text belongs to is a run character. Both halves of a surrogate pair
// belong to the pair's code point, and a lone surrogate is not a run character. The answer is kept for the code
// points below U+20000 (the BMP and plane 1, in 128 KB) and for the run characters, so the memory stays bounded
// whatever the text; any other character above U+1FFFF is probed again each time it is looked at.
function isRunAt(text, i) {
  var code = text.charCodeAt(i);
  if (code < 0x300) return false; // nothing below U+0300 is a mark
  if (code >= 0xD800 && code < 0xE000) {
    code = text.codePointAt(code < 0xDC00 ? i : i - 1) | 0; // a low surrogate's pair starts before it
    if (code < 0x10000) return false; // a lone surrogate
  }
  if (code > 0x1FFFF) return !!(parts[code] || decompose(code));
  if (!kinds) kinds = new Uint8Array(0x20000);
  if (!kinds[code]) kinds[code] = decompose(code) ? 2 : 1;
  return kinds[code] === 2;
}

// The run of characters in from..to of text, in canonical order: the code points of their decompositions, sorted
// by class with a stable bucket sort.
function inOrder(text, from, to) {
  var buckets = [];
  var out = '';
  var i, j, list, code, rank;
  for (i = from; i < to; i += code > 0xFFFF ? 2 : 1) {
    code = text.codePointAt(i);
    list = parts[code];
    for (j = 0; j < list.length; j += 2) {
      rank = list[j + 1].rank;
      (buckets[rank] || (buckets[rank] = [])).push(list[j]);
    }
  }
  for (i = 0; i < buckets.length; i++) {
    if (buckets[i]) out += buckets[i].join('');
  }
  return out;
}

// text with every run of more than `longest` code units of run characters (see decompose) in canonical order. The
// result has the same NFC as text.
//
// A run that long covers one in every longest + 1 code units, so only those are looked at, and the run around each
// one that is a run character is measured. A run short enough to stay as it is cannot reach the unit looked at
// before, and a longer one is skipped once it is in order, so each unit is read a few times at most, and as
// ordinary text has few run characters, most of it is never read at all.
function reorder(text, longest) {
  var out = '';
  var done = 0; // the text before done is in out
  var i, from, to;
  for (i = longest; i < text.length; i += longest + 1) {
    if (isRunAt(text, i)) {
      from = i;
      to = i + 1;
      while (from > done && isRunAt(text, from - 1)) from--;
      while (to < text.length && isRunAt(text, to)) to++;
      if (to - from > longest) {
        out += text.slice(done, from) + inOrder(text, from, to);
        done = i = to; // the unit at `to` ends the run, so the next run starts after it
      }
    }
  }
  return done ? out + text.slice(done) : text;
}

function nfc(text) {
  return reorder(text, LONGEST).normalize('NFC');
}

nfc.reorder = reorder;

module.exports = nfc;
