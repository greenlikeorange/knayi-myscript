// The branches of a rule's pattern, for the edge probes in test/fixtures/tables.json
// (scripts/testing/table-cases.js).
//
// A row's main probe takes one path through its pattern. A guard such as (^|[^0-9]) or an alternative such as
// [Mj] or [sß] can then change, by a refactor or a rewrite of the regex as a scanner, without any pinned output
// changing. So every branch gets a probe of its own. neighbours(re) lists the patterns one step away from `re`:
//
// - for every range of every character class, negated or not: the range with each end moved in by one code point
//   and out by one code point (U+1040-U+1049 becomes U+1041-U+1049, U+1040-U+1048, U+103F-U+1049 and
//   U+1040-U+104A);
// - for every single character of a class with more than one member: the class without it; and for every single
//   character, the class with the code point before it and the one after it added;
// - for every group of alternatives, and alternatives at the top level: the pattern without each alternative.
//
// Each neighbour names the code points it moved (`chars`), which are the characters a probe for it needs, and a
// `forced` pattern: the pattern with that class written as the moved code point alone, or that group as the
// dropped alternative alone, whose matches take the branch. A neighbour that matches the same set as `re` (a
// code point moved onto another member) is left out. A class that occurs more than once in the pattern is
// named with its offset in the source.

'use strict';

const BACKSLASH = String.fromCharCode(92);
const CONTROLS = { t: 9, n: 10, v: 11, f: 12, r: 13 };

function hex(code) {
  return ('000' + code.toString(16).toUpperCase()).slice(-4);
}

function codePoint(code) {
  return 'U+' + hex(code);
}

function escape(code) {
  return BACKSLASH + 'u' + hex(code);
}

// One character of a pattern at `i`: { code, end }, or { other, end } for a class escape such as \s or \d.
function readChar(src, i) {
  if (src[i] !== BACKSLASH) return { code: src.charCodeAt(i), end: i + 1 };
  const next = src[i + 1];
  if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(src.substr(i + 2, 4))) return { code: parseInt(src.substr(i + 2, 4), 16), end: i + 6 };
  if (next === 'x' && /^[0-9a-fA-F]{2}$/.test(src.substr(i + 2, 2))) return { code: parseInt(src.substr(i + 2, 2), 16), end: i + 4 };
  if (Object.prototype.hasOwnProperty.call(CONTROLS, next)) return { code: CONTROLS[next], end: i + 2 };
  if (/[dDsSwWbB0-9]/.test(next)) return { other: src.slice(i, i + 2), end: i + 2 };
  return { code: src.charCodeAt(i + 1), end: i + 2 }; // an escaped punctuator, such as \- or \(
}

// The character classes and the groups of alternatives of a pattern, with their offsets in its source.
function parse(src) {
  const classes = [];
  const alternations = [];
  let i = 0;

  function readClass() {
    const start = i;
    i++;
    const negated = src[i] === '^';
    if (negated) i++;
    const items = [];
    while (i < src.length && src[i] !== ']') {
      const first = readChar(src, i);
      i = first.end;
      if (first.other !== undefined) {
        items.push({ other: first.other });
        continue;
      }
      if (src[i] === '-' && i + 1 < src.length && src[i + 1] !== ']') {
        const last = readChar(src, i + 1);
        if (last.other === undefined) {
          i = last.end;
          items.push({ from: first.code, to: last.code });
          continue;
        }
      }
      items.push({ from: first.code, to: first.code });
    }
    if (src[i] !== ']') throw new Error('unclosed class in /' + src + '/');
    i++;
    classes.push({ start, end: i, negated, items });
  }

  function readAlternation(start) {
    const bars = [];
    while (i < src.length && src[i] !== ')') {
      const c = src[i];
      if (c === '|') {
        bars.push(i);
        i++;
      } else if (c === '(') {
        i++;
        if (src[i] === '?') i += 2; // (?: (?= (?!
        readAlternation(i);
        if (src[i] !== ')') throw new Error('unclosed group in /' + src + '/');
        i++;
      } else if (c === '[') {
        readClass();
      } else if (c === BACKSLASH) {
        i = readChar(src, i).end;
      } else if (c === '{') {
        const quantifier = /^\{\d+(,\d*)?\}/.exec(src.slice(i));
        i += quantifier ? quantifier[0].length : 1;
      } else {
        i++;
      }
    }
    if (!bars.length) return;
    const starts = [start].concat(bars.map((bar) => bar + 1));
    const ends = bars.concat(i);
    alternations.push({ start, end: i, alternatives: starts.map((s, k) => ({ start: s, end: ends[k] })) });
  }

  readAlternation(0);
  if (i !== src.length) throw new Error('unbalanced ) in /' + src + '/');
  return { classes, alternations };
}

function classSource(cls, items) {
  return '[' + (cls.negated ? '^' : '') + items.map((item) => {
    if (item.other !== undefined) return item.other;
    return item.from === item.to ? escape(item.from) : escape(item.from) + '-' + escape(item.to);
  }).join('') + ']';
}

function inClass(source, code) {
  return new RegExp(source).test(String.fromCharCode(code));
}

// [{ source, label, chars, forced }]: the patterns one branch away from re.source (see the top of this file).
function neighbours(re) {
  const src = re.source;
  const { classes, alternations } = parse(src);
  const out = [];
  const seen = new Set([src]);
  const add = (source, label, chars, forced) => {
    if (seen.has(source)) return;
    try {
      new RegExp(source, re.flags);
      new RegExp(forced, re.flags);
    } catch (e) {
      return;
    }
    seen.add(source);
    out.push({ source, label, chars, forced });
  };
  const named = (start, end) => {
    const text = src.slice(start, end);
    const twice = classes.filter((cls) => src.slice(cls.start, cls.end) === text).length > 1;
    return text + (twice ? ' at ' + start : '');
  };

  for (const cls of classes) {
    const original = named(cls.start, cls.end);
    const members = cls.items.filter((item) => item.other === undefined).length;
    cls.items.forEach((item, k) => {
      if (item.other !== undefined) return;
      const variants = [];
      const replaced = (replacement) => cls.items.slice(0, k).concat(replacement, cls.items.slice(k + 1));
      if (item.from !== item.to) {
        variants.push([item.from, replaced([{ from: item.from + 1, to: item.to }])]);
        variants.push([item.to, replaced([{ from: item.from, to: item.to - 1 }])]);
      } else if (members > 1) {
        variants.push([item.from, replaced([])]);
      }
      if (item.from > 0) variants.push([item.from - 1, replaced([{ from: item.from - 1, to: item.from - 1 }, item])]);
      if (item.to < 0xffff) variants.push([item.to + 1, replaced([item, { from: item.to + 1, to: item.to + 1 }])]);
      for (const [code, items] of variants) {
        const changed = classSource(cls, items);
        const before = inClass(src.slice(cls.start, cls.end), code);
        if (before === inClass(changed, code)) continue;
        add(src.slice(0, cls.start) + changed + src.slice(cls.end),
          codePoint(code) + (before ? ' no longer matches ' : ' also matches ') + original, [code],
          src.slice(0, cls.start) + escape(code) + src.slice(cls.end));
      }
    });
  }

  for (const group of alternations) {
    group.alternatives.forEach((alternative, k) => {
      const kept = group.alternatives.filter((other, j) => j !== k).map((other) => src.slice(other.start, other.end));
      add(src.slice(0, group.start) + kept.join('|') + src.slice(group.end),
        'alternative ' + JSON.stringify(src.slice(alternative.start, alternative.end)) + ' dropped from ' +
        JSON.stringify(src.slice(group.start, group.end)), [],
        src.slice(0, group.start) + src.slice(alternative.start, alternative.end) + src.slice(group.end));
    });
  }
  return out;
}

module.exports = { neighbours: neighbours, parse: parse };
