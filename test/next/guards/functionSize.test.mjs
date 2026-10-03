// Function sizes (docs/next/DESIGN.md §1.2 rule 3, §6.2): every function of src/ is at most 40 lines, counted from
// its first line to its last. The two reader dispatch loops, reorderUnicode and readFont, may reach 70, calling
// named helpers. A table builder whose body is a single `return` of a literal, or of deepFreeze of a literal
// (§2.4 rule 3), is data, not code, and has no limit. spec/ holds documented rows, not code, and is not counted.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsedSources, walk, where } from './ast.mjs';

const LIMIT = 40;
const READER_LOOPS = { 'engine/unicodeReader.js': 'reorderUnicode', 'engine/fontReader.js': 'readFont' };
const READER_LIMIT = 70;

const isFunction = (node) => /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type);
const isLiteralTable = (node) => node && (node.type === 'ObjectExpression' || node.type === 'ArrayExpression');

function functionName(node, parent) {
  if (node.id) return node.id.name;
  if (parent && parent.type === 'VariableDeclarator') return parent.id.name;
  const keyed = parent && (parent.type === 'Property' || parent.type === 'MethodDefinition');
  if (keyed && parent.key.type === 'Identifier') return parent.key.name;
  return '(anonymous)';
}

// A builder whose body is `return <literal>` or `return deepFreeze(<literal>)`.
function isTableBuilder(node) {
  const body = node.body.type === 'BlockStatement' ? node.body.body : null;
  if (!body || body.length !== 1 || body[0].type !== 'ReturnStatement') return false;
  const value = body[0].argument;
  if (isLiteralTable(value)) return true;
  return Boolean(value) && value.type === 'CallExpression' && value.callee.type === 'Identifier' &&
    value.callee.name === 'deepFreeze' && value.arguments.length === 1 && isLiteralTable(value.arguments[0]);
}

describe('function sizes in src/ (DESIGN.md §6.2)', () => {
  it('every function is at most ' + LIMIT + ' lines; the reader loops at most ' + READER_LIMIT, () => {
    const bad = [];
    for (const { file, ast } of parsedSources()) {
      if (file.startsWith('spec/')) continue;
      walk(ast, (node, parent) => {
        if (!isFunction(node) || isTableBuilder(node)) return;
        const name = functionName(node, parent);
        const lines = node.loc.end.line - node.loc.start.line + 1;
        const limit = READER_LOOPS[file] === name ? READER_LIMIT : LIMIT;
        if (lines > limit) bad.push(where(file, node) + ' ' + name + ': ' + lines + ' lines (limit ' + limit + ')');
      });
    }
    assert.deepEqual(bad, [], 'split these into named steps');
  });
});
