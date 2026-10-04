// The ES2015 floor of src/ (docs/next/DESIGN.md D14, decision 18b).
//
// - Syntax: acorn parses every file at ecmaVersion 2015 as a module. That rejects `**`, async, object spread,
//   optional catch binding, `?.`, `??`, class fields, private names and import.meta.
// - Regexes, literal or built: no lookbehind, named groups or backreferences, \p{} or s flag. A built regex is
//   built from string literals, or is a copy of another regex (new RegExp(re.source, re.flags)), or is built from
//   data by a function of BUILT_FROM_DATA, whose patterns another test reads.
// - Built-ins: the ES2016+ names of the denylist below, as a global identifier or as a property name (x.name or
//   x['name']). The guard cannot know a receiver's type, so it also bans some ES2015 methods of the same name,
//   such as String#includes and Array#values: use indexOf and a loop instead.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as acorn from 'acorn';
import { parsedSources, walk, isReference, memberName, where } from './ast.mjs';

const GLOBALS = new Set(['globalThis', 'BigInt', 'BigInt64Array', 'BigUint64Array', 'SharedArrayBuffer', 'Atomics',
  'WeakRef', 'FinalizationRegistry', 'AggregateError', 'Iterator', 'Float16Array']);

const PROPERTIES = new Set([
  // ES2016-ES2019
  'includes', 'values', 'entries', 'getOwnPropertyDescriptors', 'padStart', 'padEnd', 'finally', 'flat', 'flatMap',
  'fromEntries', 'trimStart', 'trimEnd', 'trimLeft', 'trimRight', 'description',
  // ES2020-ES2022
  'matchAll', 'allSettled', 'replaceAll', 'any', 'at', 'hasOwn', 'cause',
  // ES2023 and later
  'findLast', 'findLastIndex', 'toSorted', 'toReversed', 'toSpliced', 'with', 'fromAsync', 'groupBy',
  'withResolvers', 'isWellFormed', 'toWellFormed', 'transfer', 'transferToFixedLength', 'resize', 'union',
  'intersection', 'difference', 'symmetricDifference', 'isSubsetOf', 'isSupersetOf', 'isDisjointFrom', 'escape',
  'try', 'f16round'
]);

// Regex syntax above ES2015, found in a pattern's source text.
const REGEX_ABOVE_2015 = [
  [/\(\?<[=!]/, 'lookbehind'],
  [/\(\?<[A-Za-z_$]/, 'a named group'],
  [/\\k</, 'a named backreference'],
  [/\\[pP]\{/, 'a \\p{} property escape']
];
const ES2015_FLAGS = /^[gimuy]*$/;

// The functions that may build a regex from data, by file, and the test that reads each pattern they build, since
// this guard cannot. tableRow builds a Unicode to Zawgyi row read from the Zawgyi glyph table: its pattern is the
// escapes of a table text, which test/next/unicodeToZawgyi.test.mjs compares with the 2.x source of the row.
const BUILT_FROM_DATA = { 'rules/unicodeToZawgyi.js': 'tableRow' };

const SOURCES = parsedSources();

// The name of the innermost function declaration around node, or null.
function functionAround(ast, node) {
  let name = null;
  walk(ast, (candidate) => {
    if (candidate.type === 'FunctionDeclaration' && candidate.start <= node.start && node.end <= candidate.end) {
      name = candidate.id.name;
    }
  });
  return name;
}

// What is above ES2015 in a regex pattern and its flags, or null.
function regexAbove2015(pattern, flags) {
  for (const [re, what] of REGEX_ABOVE_2015) if (re.test(pattern)) return what;
  return ES2015_FLAGS.test(flags) ? null : 'the flags ' + flags;
}

// The text of an identifier or of a chain of plain property reads (a.b.c), or null.
function pathOf(node) {
  if (node.type === 'Identifier') return node.name;
  if (node.type !== 'MemberExpression' || node.computed) return null;
  const object = pathOf(node.object);
  return object === null ? null : object + '.' + node.property.name;
}

// new RegExp(re.source, re.flags): a copy of a regex that this guard reads where it is written (compat/legacy.js
// copies the Win sequences this way, so that 2.x callers get RegExps of their own). It adds no pattern.
function copiesARegex(node) {
  const [source, flags] = node.arguments;
  if (node.arguments.length !== 2 || memberName(source) !== 'source' || memberName(flags) !== 'flags') return false;
  const regex = pathOf(source.object);
  return regex !== null && regex === pathOf(flags.object);
}

// The regexes of an AST: literals, RegExp(...) and new RegExp(...), and string patterns of match and search.
// Returns [{ node, pattern, flags }], with pattern null when it is not a literal.
function regexesOf(ast) {
  const found = [];
  const literal = (node) => (node && node.type === 'Literal' && typeof node.value === 'string' ? node.value : null);
  walk(ast, (node) => {
    if (node.type === 'Literal' && node.regex) {
      found.push({ node, pattern: node.regex.pattern, flags: node.regex.flags });
    } else if ((node.type === 'NewExpression' || node.type === 'CallExpression') &&
      node.callee.type === 'Identifier' && node.callee.name === 'RegExp') {
      if (copiesARegex(node)) return;
      const flags = node.arguments[1] ? literal(node.arguments[1]) : '';
      found.push({ node, pattern: literal(node.arguments[0]), flags: flags === null ? '?' : flags });
    } else if (node.type === 'CallExpression' && /^(match|search)$/.test(memberName(node.callee) || '') &&
      literal(node.arguments[0]) !== null) {
      found.push({ node, pattern: literal(node.arguments[0]), flags: '' });
    }
  });
  return found;
}

describe('the ES2015 floor of src/ (DESIGN.md D14)', () => {
  it('every file parses at ecmaVersion 2015 as a module', () => {
    const bad = [];
    for (const { file, text } of SOURCES) {
      try {
        acorn.parse(text, { ecmaVersion: 2015, sourceType: 'module' });
      } catch (error) {
        bad.push('src/' + file + ': ' + error.message);
      }
    }
    assert.deepEqual(bad, []);
  });

  it('every regex, literal or built, is ES2015, and a built one is built from literals', () => {
    const bad = [];
    for (const { file, ast } of SOURCES) {
      for (const { node, pattern, flags } of regexesOf(ast)) {
        const readElsewhere = pattern === null && file in BUILT_FROM_DATA &&
          functionAround(ast, node) === BUILT_FROM_DATA[file];
        if ((pattern === null && !readElsewhere) || flags === '?') {
          bad.push(where(file, node) + ': build it from string literals, so this guard can read it');
          continue;
        }
        const above = regexAbove2015(readElsewhere ? '' : pattern, flags);
        if (above) bad.push(where(file, node) + ': ' + above);
      }
    }
    assert.deepEqual(bad, []);
  });

  it('reads every built regex but the one tableRow builds from the glyph table', () => {
    const fromData = [];
    for (const { file, ast } of SOURCES) {
      for (const { node, pattern } of regexesOf(ast)) {
        if (pattern === null) fromData.push(file + ' ' + functionAround(ast, node));
      }
    }
    assert.deepEqual(fromData, ['rules/unicodeToZawgyi.js tableRow']);
  });

  it('no ES2016+ built-in name, as a global or a property name', () => {
    const bad = [];
    for (const { file, ast } of SOURCES) {
      walk(ast, (node, parent, key) => {
        if (node.type === 'Identifier' && GLOBALS.has(node.name) && isReference(node, parent, key)) {
          bad.push(where(file, node) + ': ' + node.name);
        }
        const name = memberName(node);
        if (name !== null && PROPERTIES.has(name)) bad.push(where(file, node) + ': .' + name);
      });
    }
    assert.deepEqual(bad, [], 'use the ES2015 way (indexOf and a loop for includes and values)');
  });

  it('finds what it looks for', () => {
    const flagged = (code) => {
      const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
      let count = 0;
      walk(ast, (node, parent, key) => {
        const name = memberName(node);
        if ((name !== null && PROPERTIES.has(name)) ||
          (node.type === 'Identifier' && GLOBALS.has(node.name) && isReference(node, parent, key))) count++;
      });
      for (const { pattern, flags } of regexesOf(ast)) if (pattern === null || regexAbove2015(pattern, flags)) count++;
      return count;
    };
    assert.equal(flagged("x.includes('a'); y['at'](0); globalThis.z;"), 3);
    assert.equal(flagged('/(?<=a)b/; new RegExp("\\\\p{L}", "u"); /a/s; new RegExp(x);'), 4);
    assert.equal(flagged("x.indexOf('a'); var o = { values: 1, at: 2 }; /(?:a)b/gi;"), 0);
    // A copy of a regex adds no pattern; a regex built from parts of two others is not a copy.
    assert.equal(flagged('new RegExp(row.re.source, row.re.flags); new RegExp(re.source, re.flags);'), 0);
    assert.equal(flagged('new RegExp(a.re.source, b.re.flags); new RegExp(re.source); new RegExp(re.source + "x", re.flags);'), 3);
  });
});
