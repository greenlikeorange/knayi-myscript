// Errors with codes (docs/next/DESIGN.md §4 rule 4, D13): every throw in src/ throws libraryError(...), with a
// code from ERR. The one exception is compat's legacyTypeError(), in compat/legacy.js only, which reproduces the
// TypeErrors 2.x threw by accident, with no code; so that file is also the only one that constructs an error
// class itself.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsedSources, walk, where } from './ast.mjs';

const LEGACY = 'compat/legacy.js';
const ERROR_CLASSES = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'EvalError',
  'URIError']);
const SOURCES = parsedSources();

function calleeName(node) {
  return node && (node.type === 'CallExpression' || node.type === 'NewExpression') &&
    node.callee.type === 'Identifier' ? node.callee.name : null;
}

describe('errors thrown by src/ (DESIGN.md §4 rule 4)', () => {
  it('every throw throws libraryError(...), or legacyTypeError() in ' + LEGACY, () => {
    const bad = [];
    for (const { file, ast, text } of SOURCES) {
      walk(ast, (node) => {
        if (node.type !== 'ThrowStatement') return;
        const name = calleeName(node.argument);
        const allowed = name === 'libraryError' || (name === 'legacyTypeError' && file === LEGACY);
        if (!allowed) bad.push(where(file, node) + ': ' + text.slice(node.start, node.end));
      });
    }
    assert.deepEqual(bad, []);
  });

  it('every libraryError call names a code of ERR', () => {
    const bad = [];
    for (const { file, ast, text } of SOURCES) {
      if (file === 'core/errors.js') continue;
      walk(ast, (node) => {
        if (calleeName(node) !== 'libraryError') return;
        const code = node.arguments[0];
        const named = code && code.type === 'MemberExpression' && !code.computed &&
          code.object.type === 'Identifier' && code.object.name === 'ERR';
        if (!named) bad.push(where(file, node) + ': ' + text.slice(node.start, node.end).split('\n')[0]);
      });
    }
    assert.deepEqual(bad, []);
  });

  it('only ' + LEGACY + ' constructs an error class itself; the rest go through libraryError', () => {
    const bad = [];
    for (const { file, ast } of SOURCES) {
      if (file === LEGACY) continue;
      walk(ast, (node) => {
        if (ERROR_CLASSES.has(calleeName(node))) bad.push(where(file, node) + ': ' + calleeName(node));
      });
    }
    assert.deepEqual(bad, []);
  });
});
