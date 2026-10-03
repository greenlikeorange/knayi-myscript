// Top-level code free of side effects, so an import pulls in only what it uses (docs/next/DESIGN.md §2.4, D16).
//
// esbuild drops an unused top-level binding only when it can see that its initialiser has no side effects. This
// checks rules 1-6 of §2.4 on every file of src/ with acorn, then bundles a normalize-only import with
// scripts/next/size.mjs and requires 0 bytes from the modules normalize never needs.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsedSources, walk, where } from './ast.mjs';
import { normalizeOnlyLeaks } from '../../../scripts/next/size.mjs';
import { ZW } from '../../../src/script/codes.js';
import { UNICODE_READING } from '../../../src/engine/unicodeReader.js';
import { FONT_READING } from '../../../src/engine/fontReader.js';

const SOURCES = parsedSources();

// Characters a string or regex literal of src/ writes as \u escapes (rule 5): the Myanmar blocks, C1 controls,
// zero-width and bidi controls, and lone surrogates.
const ESCAPE_ONLY = new RegExp('[\\u0080-\\u009F\\u1000-\\u109F\\uA9E0-\\uA9FF\\uAA60-\\uAA7F' +
  '\\u200B-\\u200F\\u2028-\\u202E\\u2060-\\u206F\\uFEFF\\uD800-\\uDFFF]');

// Whether a call or new is annotated /* @__PURE__ */: the last comment before it, with only spaces between.
function isPure(node, comments, text) {
  return comments.some((c) => c.type === 'Block' && c.value.trim() === '@__PURE__' &&
    text.slice(c.end, node.start).trim() === '');
}

// Rule 2: literals, identifiers, functions, and array and object literals of these with no computed keys. Rule 3:
// a call or new of a named function, annotated /* @__PURE__ */, whose arguments follow rule 2. Returns the
// offending node, or null.
function offendingPart(node, source) {
  switch (node.type) {
    case 'Literal':
    case 'Identifier':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return null;
    case 'UnaryExpression': // a negative number literal
      return node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number'
        ? null : node;
    case 'ArrayExpression':
      return firstOffending(node.elements, source) || (node.elements.includes(null) ? node : null);
    case 'ObjectExpression':
      for (const property of node.properties) {
        if (property.type !== 'Property' || property.computed) return property;
        const part = offendingPart(property.value, source);
        if (part) return part;
      }
      return null;
    case 'CallExpression':
    case 'NewExpression':
      if (!isPure(node, source.comments, source.text) || node.callee.type !== 'Identifier') return node;
      return firstOffending(node.arguments, source, true);
    default:
      return node;
  }
}

function firstOffending(nodes, source, noCalls) {
  for (const node of nodes) {
    if (!node) continue;
    if (noCalls && (node.type === 'CallExpression' || node.type === 'NewExpression')) return node;
    const part = offendingPart(node, source);
    if (part) return part;
  }
  return null;
}

// The initialisers of a top-level statement that rules 2 and 3 apply to, or a string saying why the statement
// itself breaks rule 1.
function initialisersOf(statement) {
  let node = statement;
  if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
    if (!node.declaration) return [];
    if (node.type === 'ExportDefaultDeclaration' && !/Declaration$/.test(node.declaration.type)) {
      return [node.declaration];
    }
    node = node.declaration;
  }
  switch (node.type) {
    case 'ImportDeclaration':
    case 'ExportAllDeclaration':
    case 'FunctionDeclaration':
    case 'ClassDeclaration':
      return [];
    case 'VariableDeclaration':
      return node.kind === 'const' ? node.declarations.map((d) => d.init) : 'a top-level ' + node.kind;
    default:
      return 'a top-level ' + node.type;
  }
}

describe('top-level code of src/ (DESIGN.md §2.4)', () => {
  it('rule 1: imports, exports, functions, classes and const declarations only', () => {
    const bad = [];
    for (const { file, ast } of SOURCES) {
      for (const statement of ast.body) {
        const found = initialisersOf(statement);
        if (typeof found === 'string') bad.push(where(file, statement) + ': ' + found);
      }
    }
    assert.deepEqual(bad, []);
  });

  it('rules 2-4: initialisers are literals, or /* @__PURE__ */ calls of literals', () => {
    const bad = [];
    for (const source of SOURCES) {
      for (const statement of source.ast.body) {
        const found = initialisersOf(statement);
        if (typeof found === 'string') continue;
        for (const init of found) {
          const part = init && offendingPart(init, source);
          if (part) {
            bad.push(where(source.file, part) + ': ' + source.text.slice(part.start, part.end).split('\n')[0]);
          }
        }
      }
    }
    assert.deepEqual(bad, [], 'move these into a builder function, called once with /* @__PURE__ */');
  });

  it('rule 5: strings and regexes write Myanmar and invisible characters as \\u escapes', () => {
    const bad = [];
    for (const { file, ast } of SOURCES) {
      walk(ast, (node) => {
        const raw = node.type === 'Literal' ? node.raw : node.type === 'TemplateElement' ? node.value.raw : null;
        if (raw !== null && ESCAPE_ONLY.test(raw)) bad.push(where(file, node));
      });
    }
    assert.deepEqual(bad, []);
  });

  it('rule 6: masks and reader option bits are number literals that equal their definitions', () => {
    const bad = [];
    for (const { file, ast } of SOURCES) {
      walk(ast, (node) => {
        const isMask = node.type === 'VariableDeclarator' && /^MASK_/.test(node.id.name);
        const isOptionBits = node.type === 'Property' && !node.computed && node.key.name === 'heldZeroWidth';
        const value = isMask ? node.init : isOptionBits ? node.value : null;
        if (value && !(value.type === 'Literal' && typeof value.value === 'number')) bad.push(where(file, node));
      });
    }
    assert.deepEqual(bad, []);
    // codes.test.mjs checks each MASK_ against the marks it names.
    assert.equal(UNICODE_READING.heldZeroWidth, ZW.ZWSP | ZW.WORD_JOINER | ZW.BOM);
    assert.equal(FONT_READING.heldZeroWidth, ZW.ALL);
  });

  it('a normalize-only bundle has no bytes from the modules normalize never needs', () => {
    assert.deepEqual(normalizeOnlyLeaks(), []);
  });
});
