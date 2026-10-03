// Parsing and walking the files of src/ for the guards (docs/next/DESIGN.md §6.2 item 5).

import * as acorn from 'acorn';
import { srcFiles, srcText } from '../helpers.mjs';

// The files of src/ (paths relative to src/), each parsed as a module with locations and its comments.
// ecmaVersion 'latest', so that the floor guard alone reports syntax above ES2015.
export function parsedSources() {
  return srcFiles().map((file) => {
    const text = srcText(file);
    const comments = [];
    const ast = acorn.parse(text, {
      ecmaVersion: 'latest', sourceType: 'module', locations: true, onComment: comments
    });
    return { file, text, ast, comments };
  });
}

// Calls visit(node, parent, key) on every node under root, depth first, parents before children.
export function walk(root, visit) {
  (function visitNode(node, parent, key) {
    visit(node, parent, key);
    for (const field of Object.keys(node)) {
      if (field === 'loc') continue;
      const value = node[field];
      if (Array.isArray(value)) {
        for (const child of value) if (child && typeof child.type === 'string') visitNode(child, node, field);
      } else if (value && typeof value.type === 'string') {
        visitNode(value, node, field);
      }
    }
  })(root, null, null);
}

// Whether an Identifier node is a reference to a binding, rather than a property name or an object key.
export function isReference(node, parent, key) {
  if (!parent) return true;
  if (parent.type === 'MemberExpression' && key === 'property' && !parent.computed) return false;
  if ((parent.type === 'Property' || parent.type === 'MethodDefinition') && key === 'key' && !parent.computed) {
    return false;
  }
  return true;
}

// The name a member access reads: x.name or x['name']; null when it cannot be known.
export function memberName(node) {
  if (node.type !== 'MemberExpression') return null;
  if (!node.computed && node.property.type === 'Identifier') return node.property.name;
  if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string') {
    return node.property.value;
  }
  return null;
}

// Every place an AST loads code at run time (DESIGN.md §2.2): require, createRequire, getBuiltinModule, import()
// and import.meta. Returns [node, what] pairs.
export function codeLoadingSites(ast) {
  const found = [];
  walk(ast, (node, parent, key) => {
    if (node.type === 'ImportExpression') found.push([node, 'import()']);
    else if (node.type === 'MetaProperty' && node.meta.name === 'import') found.push([node, 'import.meta']);
    else if (node.type === 'Identifier' && (node.name === 'require' || node.name === 'createRequire') &&
      isReference(node, parent, key)) found.push([node, node.name]);
    else if (memberName(node) === 'getBuiltinModule' || memberName(node) === 'createRequire') {
      found.push([node, memberName(node)]);
    }
  });
  return found;
}

// file:line, for messages.
export function where(file, node) {
  return 'src/' + file + ':' + node.loc.start.line;
}
