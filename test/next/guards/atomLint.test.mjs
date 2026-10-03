// The atom lint (docs/next/DESIGN.md §6.2, decision 29). On V8, a regex that is a pure literal, or an indexOf
// needle, whose first unit is in U+1000-U+1010 takes a slow search path: 10-50x slower, on Node 18, 24 and 26
// (refactor plan §6, PR 1.2). Wrapping the first unit in a one-character class (/[\u1004]\u103A\u1039/g) avoids
// it, and a Unicode to Zawgyi row keeps the 2.x source as its `label`.
//
// The range is exactly U+1000-U+1010 and must not widen: a literal starting at U+1014 gets slower when wrapped.
// The lint reads every regex of the shipped code (src/ outside spec/, whose rows keep the 2.x literals as the
// oracle), and the needle of every indexOf call.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as acorn from 'acorn';
import { parsedSources, walk, memberName, where } from './ast.mjs';

const FIRST = 0x1000;
const LAST = 0x1010;

// The units of a regex pattern that is a pure literal (no class, group, alternation, quantifier, anchor, dot or
// class escape), or null when it is not one.
function pureLiteralUnits(pattern) {
  const units = [];
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if ('^$.|?*+()[]{}'.indexOf(ch) >= 0) return null;
    if (ch !== '\\') {
      units.push(pattern.charCodeAt(i));
      continue;
    }
    const escape = /^(?:u([0-9A-Fa-f]{4})|x([0-9A-Fa-f]{2})|([\\/^$.|?*+()[\]{}-]))/.exec(pattern.slice(i + 1));
    if (!escape) return null; // \d, \w, \s, \b, \u{...}, a backreference: not a plain atom
    units.push(escape[3] ? escape[3].charCodeAt(0) : parseInt(escape[1] || escape[2], 16));
    i += escape[0].length;
  }
  return units;
}

const startsInRange = (code) => code >= FIRST && code <= LAST;

// Whether a regex is an atom that starts in U+1000-U+1010.
function isSlowAtom(pattern) {
  const units = pureLiteralUnits(pattern);
  return units !== null && units.length > 0 && startsInRange(units[0]);
}

// The slow atoms and needles of an AST: [node, what].
function slowSites(ast) {
  const found = [];
  const literal = (node) => (node && node.type === 'Literal' && typeof node.value === 'string' ? node.value : null);
  walk(ast, (node) => {
    if (node.type === 'Literal' && node.regex && isSlowAtom(node.regex.pattern)) found.push([node, node.raw]);
    if ((node.type === 'NewExpression' || node.type === 'CallExpression') && node.callee.type === 'Identifier' &&
      node.callee.name === 'RegExp' && literal(node.arguments[0]) !== null && isSlowAtom(literal(node.arguments[0]))) {
      found.push([node, 'RegExp(' + JSON.stringify(literal(node.arguments[0])) + ')']);
    }
    if (node.type === 'CallExpression' && memberName(node.callee) === 'indexOf') {
      const needle = literal(node.arguments[0]);
      if (needle && startsInRange(needle.charCodeAt(0))) found.push([node, 'indexOf(' + JSON.stringify(needle) + ')']);
    }
  });
  return found;
}

describe('the atom lint (decision 29)', () => {
  it('no regex atom or indexOf needle of the shipped code starts in U+1000-U+1010', () => {
    const bad = [];
    for (const { file, ast } of parsedSources()) {
      if (file.startsWith('spec/')) continue;
      for (const [node, what] of slowSites(ast)) bad.push(where(file, node) + ': ' + what);
    }
    assert.deepEqual(bad, [], 'wrap the first unit in a one-character class, such as [\\u1004]');
  });

  it('covers exactly U+1000-U+1010, and only pure literals', () => {
    const count = (code) => slowSites(acorn.parse(code, { ecmaVersion: 'latest', locations: true })).length;
    assert.equal(count('/\\u1000a/g; /\\u1010/; /\\u100d\\u1039\\u100e/g; s.indexOf("\\u1004\\u103a");'), 4);
    assert.equal(count('new RegExp("\\\\u1004\\\\u103a\\\\u1039", "g");'), 1);
    assert.equal(count('/\\u0fff/; /\\u1011\\u1039/; /\\u1014/; s.indexOf("\\u1039\\u1010");'), 0);
    assert.equal(count('/[\\u1004]\\u103a\\u1039/g; /\\u1004+/; /(\\u1004)/; /\\u1004|a/; /^\\u1004/;'), 0);
  });
});
