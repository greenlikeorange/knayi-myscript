// Errors with codes (docs/next/DESIGN.md §4 rule 4, D13): every throw in src/ throws libraryError(...), with a
// code from ERR, and no file constructs an error class itself. compat's legacyTypeError(), which reproduced the
// TypeErrors 2.10 threw by accident, went with the port of 2.11's font-name policy (DESIGN.md §8): 2.11 throws a
// TypeError with a code there.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsedSources, walk, where } from './ast.mjs';

const ERROR_CLASSES = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'EvalError',
  'URIError']);
const SOURCES = parsedSources();

function calleeName(node) {
  return node && (node.type === 'CallExpression' || node.type === 'NewExpression') &&
    node.callee.type === 'Identifier' ? node.callee.name : null;
}

describe('errors thrown by src/ (DESIGN.md §4 rule 4)', () => {
  it('every throw throws libraryError(...)', () => {
    const bad = [];
    for (const { file, ast, text } of SOURCES) {
      walk(ast, (node) => {
        if (node.type !== 'ThrowStatement') return;
        if (calleeName(node.argument) === 'libraryError') return;
        bad.push(where(file, node) + ': ' + text.slice(node.start, node.end));
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

  it('no file constructs an error class itself: every error comes from libraryError', () => {
    const bad = [];
    for (const { file, ast } of SOURCES) {
      walk(ast, (node) => {
        if (ERROR_CLASSES.has(calleeName(node))) bad.push(where(file, node) + ': ' + calleeName(node));
      });
    }
    assert.deepEqual(bad, []);
  });
});
