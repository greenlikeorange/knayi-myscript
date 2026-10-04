// What a top-level const of src/ holds, read from the AST, for rule 1 of the stateless guard (docs/next/DESIGN.md
// §4 rule 1). A const is state-free when it is:
// - a literal, an identifier or a function; a regex literal only when no code ever writes its lastIndex or runs
//   exec on it (or test, with the g or y flag), since those leave state in it between calls;
// - frozen data: a deepFreeze(...) call, or a call of a builder whose every return is deepFreeze(...);
// - a table: a call of a builder whose every return is a typed array the builder makes, read-only by contract (§2.3);
// - an exported primitive (a named rank), which the guard checks at run time.
// Everything else is module state, and must be listed by name, with its reason.

import path from 'node:path';
import { walk, memberName } from './ast.mjs';

const TYPED_ARRAYS = new Set(['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array',
  'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array']);

// The top-level consts of a parsed file: [{ name, init, exported, node }].
export function topLevelConsts(source) {
  const found = [];
  for (const statement of source.ast.body) {
    const exported = statement.type === 'ExportNamedDeclaration';
    const node = exported ? statement.declaration : statement;
    if (!node || node.type !== 'VariableDeclaration' || node.kind !== 'const') continue;
    for (const declarator of node.declarations) {
      found.push({ name: declarator.id.name, init: declarator.init, exported, node: declarator });
    }
  }
  return found;
}

const isDeepFreezeCall = (node) => node.type === 'CallExpression' && node.callee.type === 'Identifier' &&
  node.callee.name === 'deepFreeze';

// Whether node makes a typed array: new Uint8Array(n), Uint16Array.from(...) or .of(...), or one of these .fill(...).
function makesTypedArray(node) {
  if (node.type === 'NewExpression') return node.callee.type === 'Identifier' && TYPED_ARRAYS.has(node.callee.name);
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') return false;
  const method = memberName(node.callee);
  const object = node.callee.object;
  if (method === 'fill') return makesTypedArray(object);
  return (method === 'from' || method === 'of') && object.type === 'Identifier' && TYPED_ARRAYS.has(object.name);
}

// The nodes under root, depth first, without entering the functions inside it.
function nodesOutsideInnerFunctions(root, visit) {
  (function visitNode(node) {
    visit(node);
    for (const key of Object.keys(node)) {
      const value = node[key];
      for (const child of Array.isArray(value) ? value : [value]) {
        if (child && typeof child.type === 'string' && !/Function/.test(child.type)) visitNode(child);
      }
    }
  })(root);
}

// What a builder function returns: 'frozen' when every return is deepFreeze(...), 'table' when every return is a
// typed array the function makes (directly, or through a const of its own), else null.
function builtKind(fn) {
  const returned = [];
  const madeTables = new Set();
  nodesOutsideInnerFunctions(fn.body, (node) => {
    if (node.type === 'ReturnStatement' && node.argument) returned.push(node.argument);
    if (node.type === 'VariableDeclarator' && node.init && makesTypedArray(node.init)) madeTables.add(node.id.name);
  });
  if (returned.length === 0) return null;
  if (returned.every(isDeepFreezeCall)) return 'frozen';
  const isTable = (value) => makesTypedArray(value) || (value.type === 'Identifier' && madeTables.has(value.name));
  return returned.every(isTable) ? 'table' : null;
}

// The file an import specifier of `file` names, relative to src/.
function importedFile(file, specifier) {
  return path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
}

// The declaration of the function `name` in a source, or in the file it is imported from; null when it is not a
// function declared in src/ (a class, for one).
function functionNamed(sources, source, name) {
  for (const statement of source.ast.body) {
    const node = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (node && node.type === 'FunctionDeclaration' && node.id.name === name) return node;
    if (statement.type !== 'ImportDeclaration') continue;
    for (const specifier of statement.specifiers) {
      if (specifier.type !== 'ImportSpecifier' || specifier.local.name !== name) continue;
      const imported = sources.get(importedFile(source.file, statement.source.value));
      return imported ? functionNamed(sources, imported, specifier.imported.name) : null;
    }
  }
  return null;
}

// Where a regex const of `source` is used: its own file, and every file that imports it, each with its local name.
function usesOf(sources, source, name) {
  const uses = [{ source, local: name }];
  for (const other of sources.values()) {
    for (const statement of other.ast.body) {
      if (statement.type !== 'ImportDeclaration' || importedFile(other.file, statement.source.value) !== source.file) {
        continue;
      }
      for (const specifier of statement.specifiers) {
        if (specifier.type === 'ImportSpecifier' && specifier.imported.name === name) {
          uses.push({ source: other, local: specifier.local.name });
        }
      }
    }
  }
  return uses;
}

// Whether any code writes the regex's lastIndex, or runs exec on it, or test with the g or y flag.
function regexKeepsState(sources, source, name, flags) {
  const sticky = /[gy]/.test(flags);
  let keeps = false;
  for (const { source: user, local } of usesOf(sources, source, name)) {
    walk(user.ast, (node) => {
      const isThisRegex = (object) => object && object.type === 'Identifier' && object.name === local;
      if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' &&
        isThisRegex(node.left.object) && memberName(node.left) === 'lastIndex') keeps = true;
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' &&
        isThisRegex(node.callee.object)) {
        const method = memberName(node.callee);
        if (method === 'exec' || (method === 'test' && sticky)) keeps = true;
      }
    });
  }
  return keeps;
}

// What a top-level const holds: 'free' (a literal, identifier or function), 'frozen', 'table', 'regex',
// 'stateful regex', 'call' (made by a call or new that returns neither frozen data nor a table: state, or a
// primitive the guard checks at run time), or 'unfrozen literal'.
export function constKind(sources, source, { name, init }) {
  switch (init.type) {
    case 'Identifier':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return 'free';
    case 'UnaryExpression':
      return init.argument.type === 'Literal' && typeof init.argument.value === 'number' ? 'free' : 'call';
    case 'Literal':
      if (!init.regex) return 'free';
      return regexKeepsState(sources, source, name, init.regex.flags) ? 'stateful regex' : 'regex';
    case 'ObjectExpression':
    case 'ArrayExpression':
      return 'unfrozen literal';
    case 'CallExpression':
      if (isDeepFreezeCall(init)) return 'frozen';
      if (init.callee.type === 'Identifier') {
        const builder = functionNamed(sources, source, init.callee.name);
        const kind = builder && builtKind(builder);
        if (kind) return kind;
      }
      return 'call';
    default:
      return 'call';
  }
}
