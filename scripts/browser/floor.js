'use strict';
// The browser floor: what the dist builds may use, given the oldest browsers README.md promises.
//
// test/syntax.test.js parses every build with acorn at ES2015, but README.md also names browsers that shipped
// only part of ES2015. Each rule below gives the first version of Chrome, Edge, Firefox and Safari with full
// support, from MDN's browser-compat-data (BCD, read 2026-10), unless the note says otherwise. A rule is active
// only when the README floor is older than one of those versions, so raising the floor in README.md switches
// rules off by itself (decision 18).
//
// test/dist-floor.test.js runs check() on every build and runs the builds without the removed built-ins
// (removalScript). `node scripts/browser/floor.js` prints the active rules and what each build uses.

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = path.join(__dirname, '..', '..');
const BROWSERS = ['chrome', 'edge', 'firefox', 'safari'];

// Syntax. `since` is [chrome, edge, firefox, safari]; Edge 79 and later is Chromium.
const SYNTAX = [
  { id: 'let', since: [49, 14, 44, 10], source: 'statements.let',
    note: 'Firefox before 44 accepts let only in <script type="application/javascript;version=1.7">.' },
  { id: 'const', since: [21, 12, 36, 5.1], source: 'statements.const',
    note: 'Firefox before 36 scopes const to the function; before 51 it rejects const in a for...of head.' },
  { id: 'class', since: [49, 13, 45, 10.1], source: 'statements.class, operators.class' },
  { id: 'for-of', since: [51, 14, 53, 7], source: 'statements.for_of.closing_iterators',
    note: 'for...of itself is Firefox 13, but Firefox has no Symbol.iterator before 36, no iterator closing on ' +
      'break or return before 53 (Chrome 51), and rejects for (const x of ...) before 51.' },
  { id: 'destructuring', since: [49, 14, 41, 8], source: 'operators.destructuring',
    note: 'Firefox 2 to 40 had a non-standard implementation.' },
  { id: 'new.target', since: [46, 13, 41, 11], source: 'operators.new_target' },
  { id: 'super', since: [42, 13, 45, 7], source: 'operators.super' },
  { id: 'code-point-escape', since: [44, 12, 40, 9], source: 'grammar.unicode_point_escapes',
    note: 'esbuild 0.25 at target es2015 writes an astral character as \\u{...}, even from a surrogate pair.' },
  { id: 'regexp-u-flag', since: [50, 12, 46, 10], source: 'builtins.RegExp.unicode' },
  { id: 'block-function', since: [49, 12, 46, 10], source: 'functions.block_level_functions',
    note: 'A function declaration inside a block, outside a function body.' },
  { id: 'arrow-arguments', since: [45, 12, 43, 10],
    source: 'not in BCD: Firefox 43 release notes, bug 889158 (not re-checked)',
    note: 'Before Firefox 43 an arrow function had its own arguments object.' },
  // Allowed at the current floor. They are listed so the floor, not a guess, decides.
  { id: 'arrow-function', since: [45, 12, 22, 10], source: 'functions.arrow_functions' },
  { id: 'template-literal', since: [41, 12, 34, 9], source: 'grammar.template_literals' },
  { id: 'default-parameter', since: [49, 14, 15, 10], source: 'functions.default_parameters' },
  { id: 'rest-parameter', since: [47, 12, 15, 10], source: 'functions.rest_parameters' },
  { id: 'spread', since: [46, 12, 27, 8], source: 'operators.spread' },
  { id: 'shorthand-property', since: [47, 12, 33, 9], source: 'operators.object_initializer.shorthand_property_names' },
  { id: 'method-definition', since: [47, 12, 34, 9], source: 'operators.object_initializer.shorthand_method_names' },
  { id: 'computed-property', since: [47, 12, 34, 8], source: 'operators.object_initializer.computed_property_names' },
  { id: 'generator', since: [49, 13, 26, 10], source: 'statements.generator_function, operators.generator_function' },
  { id: 'binary-octal-literal', since: [41, 12, 25, 9], source: 'grammar.binary_numeric_literals' },
  { id: 'regexp-y-flag', since: [49, 13, 3, 10], source: 'builtins.RegExp.sticky' }
];

// Globals. A use behind `typeof X` (or `X ?`, `X &&`) is allowed.
const GLOBALS = [
  { id: 'globalThis', since: [71, 79, 65, 12.1], source: 'builtins.globalThis' },
  { id: 'Symbol', since: [38, 12, 36, 9], source: 'builtins.Symbol' },
  { id: 'Reflect', since: [49, 12, 42, 10], source: 'builtins.Reflect' },
  { id: 'BigInt', since: [67, 79, 68, 14], source: 'builtins.BigInt' },
  { id: 'WeakRef', since: [84, 84, 79, 14.1], source: 'builtins.WeakRef' },
  { id: 'FinalizationRegistry', since: [84, 84, 79, 14.1], source: 'builtins.FinalizationRegistry' },
  { id: 'AggregateError', since: [85, 85, 79, 14], source: 'builtins.AggregateError' },
  { id: 'SharedArrayBuffer', since: [68, 79, 79, 15.2], source: 'builtins.SharedArrayBuffer' },
  { id: 'Atomics', since: [68, 79, 78, 15.2], source: 'builtins.Atomics' },
  { id: 'Float16Array', since: [135, 135, 129, 18.2], source: 'builtins.Float16Array' },
  { id: 'TextEncoder', since: [38, 79, 18, 10.1], source: 'api.TextEncoder' },
  { id: 'TextDecoder', since: [38, 79, 19, 10.1], source: 'api.TextDecoder' }
];

// Static members of globals that exist at the floor.
const STATICS = [
  { id: 'Object.entries', since: [54, 14, 47, 10.1] },
  { id: 'Object.values', since: [54, 14, 47, 10.1] },
  { id: 'Object.getOwnPropertyDescriptors', since: [54, 15, 50, 10] },
  { id: 'Object.getOwnPropertySymbols', since: [38, 12, 36, 9] },
  { id: 'Object.fromEntries', since: [73, 79, 63, 12.1] },
  { id: 'Object.hasOwn', since: [93, 93, 92, 15.4] },
  { id: 'Object.groupBy', since: [117, 117, 119, 17.4] },
  { id: 'Map.groupBy', since: [117, 117, 119, 17.4] },
  { id: 'Array.fromAsync', since: [121, 121, 115, 16.4] },
  { id: 'Promise.allSettled', since: [76, 79, 71, 13] },
  { id: 'Promise.any', since: [85, 85, 79, 14] },
  { id: 'Promise.withResolvers', since: [119, 119, 121, 17.4] },
  { id: 'Promise.try', since: [128, 128, 134, 18.2] },
  { id: 'RegExp.escape', since: [136, 136, 134, 18.2] },
  { id: 'Intl.getCanonicalLocales', since: [54, 16, 48, 10.1] },
  { id: 'Intl.supportedValuesOf', since: [99, 99, 93, 15.4] }
].map((rule) => Object.assign({ source: 'builtins.' + rule.id }, rule));

// Methods that no built-in had at the floor, matched by name on any object. `on` lists the prototypes the floor
// emulation removes them from.
const METHODS = [
  { id: '.includes', since: [47, 14, 43, 9], on: ['Array', 'String', '%TypedArray%'],
    source: 'builtins.Array.includes; String.includes is Firefox 40' },
  { id: '.padStart', since: [57, 15, 48, 10], on: ['String'] },
  { id: '.padEnd', since: [57, 15, 48, 10], on: ['String'] },
  { id: '.trimStart', since: [66, 79, 61, 12], on: ['String'] },
  { id: '.trimEnd', since: [66, 79, 61, 12], on: ['String'] },
  { id: '.matchAll', since: [73, 79, 67, 13], on: ['String'] },
  { id: '.replaceAll', since: [85, 85, 77, 13.1], on: ['String'] },
  { id: '.isWellFormed', since: [111, 111, 119, 16.4], on: ['String'] },
  { id: '.toWellFormed', since: [111, 111, 119, 16.4], on: ['String'] },
  { id: '.at', since: [92, 92, 90, 15.4], on: ['Array', 'String', '%TypedArray%'] },
  { id: '.flat', since: [69, 79, 62, 12], on: ['Array'] },
  { id: '.flatMap', since: [69, 79, 62, 12], on: ['Array'] },
  { id: '.findLast', since: [97, 97, 104, 15.4], on: ['Array', '%TypedArray%'] },
  { id: '.findLastIndex', since: [97, 97, 104, 15.4], on: ['Array', '%TypedArray%'] },
  { id: '.toSorted', since: [110, 110, 115, 16], on: ['Array', '%TypedArray%'] },
  { id: '.toReversed', since: [110, 110, 115, 16], on: ['Array', '%TypedArray%'] },
  { id: '.toSpliced', since: [110, 110, 115, 16], on: ['Array'] },
  { id: '.with', since: [110, 110, 115, 16], on: ['Array', '%TypedArray%'] },
  { id: '.finally', since: [63, 18, 58, 11.1], on: ['Promise'], source: 'builtins.Promise.finally' },
  // Not removed by the emulation: V8's split and replace read `flags` on their slow path.
  { id: '.flags', since: [49, 79, 37, 9], on: [], source: 'builtins.RegExp.flags' },
  { id: '.description', since: [70, 79, 63, 12.1], on: [], source: 'builtins.Symbol.description' }
].map((rule) => Object.assign({ source: 'builtins.' + rule.on.concat('Array')[0] + rule.id }, rule));

// Typed arrays exist at the floor, but most of their methods came later. The name alone cannot tell
// `table.fill(0)` on a Uint8Array (Firefox 37) from Array#fill (Firefox 31), so these rules apply to receivers
// written as `new Uint8Array(...)` or bound to one by `x = new Uint8Array(...)` anywhere in the file.
const TYPED_ARRAYS = ['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array',
  'Uint32Array', 'Float32Array', 'Float64Array'];
const TYPED_ARRAY_METHODS = {
  entries: [45, 12, 37, 10], every: [45, 12, 37, 10], fill: [45, 12, 37, 10], filter: [45, 12, 38, 10],
  find: [45, 12, 37, 10], findIndex: [45, 12, 37, 10], forEach: [45, 12, 38, 10], indexOf: [45, 12, 37, 10],
  join: [45, 12, 37, 10], keys: [38, 12, 37, 10], lastIndexOf: [45, 12, 37, 10], map: [45, 12, 38, 10],
  reduce: [45, 12, 37, 10], reduceRight: [45, 12, 37, 10], reverse: [45, 12, 37, 10], slice: [45, 12, 38, 10],
  some: [45, 12, 37, 10], sort: [45, 12, 46, 10], values: [38, 12, 37, 10]
};
const TYPED = [
  { id: 'TypedArray method', since: [45, 12, 46, 10], source: 'builtins.TypedArray.<method>',
    note: 'Per method in TYPED_ARRAY_METHODS: fill and most others are Firefox 37-38, sort 46.' },
  { id: 'TypedArray.from/of', since: [45, 12, 38, 10], source: 'builtins.TypedArray.from, .of' },
  { id: 'new TypedArray()', since: [7, 12, 55, 5.1], source: 'builtins.TypedArray.constructor_without_parameters' }
];

// Removed only by the floor emulation, because the name is shared with methods the floor has
// (Map#values is Firefox 20, Set#values Firefox 24).
const RUNTIME_ONLY = [
  { id: 'Array.prototype.values', since: [66, 14, 60, 9], source: 'builtins.Array.values' }
];

const ALL = [].concat(
  SYNTAX.map((r) => Object.assign({ kind: 'syntax' }, r)),
  GLOBALS.map((r) => Object.assign({ kind: 'global' }, r)),
  STATICS.map((r) => Object.assign({ kind: 'static' }, r)),
  METHODS.map((r) => Object.assign({ kind: 'method' }, r)),
  TYPED.map((r) => Object.assign({ kind: 'typed-array' }, r)),
  RUNTIME_ONLY.map((r) => Object.assign({ kind: 'runtime' }, r))
);

// README.md: "They run in Chrome 49, Edge 14, Firefox 34, Safari 10 (iOS 10), ..."
function readmeFloor(text) {
  const readme = text === undefined ? fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8') : text;
  const m = /They run in Chrome (\d+(?:\.\d+)?), Edge (\d+(?:\.\d+)?), Firefox (\d+(?:\.\d+)?), Safari (\d+(?:\.\d+)?)/.exec(readme);
  if (!m) throw new Error('README.md no longer states the browser floor as "They run in Chrome N, Edge N, Firefox N, Safari N"');
  return { chrome: Number(m[1]), edge: Number(m[2]), firefox: Number(m[3]), safari: Number(m[4]) };
}

// The browsers at the floor that lack the feature, for example ['firefox 34 (needs 44)'].
function blockedAt(rule, floor, since) {
  const versions = since || rule.since;
  const out = [];
  BROWSERS.forEach((browser, i) => {
    if (versions[i] > floor[browser]) out.push(browser + ' ' + floor[browser] + ' (needs ' + versions[i] + ')');
  });
  return out;
}

function isActive(rule, floor, since) {
  return blockedAt(rule, floor, since).length > 0;
}

function walk(node, visit, ancestors) {
  visit(node, ancestors);
  for (const key of Object.keys(node)) {
    if (key === 'loc') continue;
    const value = node[key];
    const children = Array.isArray(value) ? value : [value];
    for (const child of children) {
      if (child && typeof child.type === 'string') {
        ancestors.push({ node, key });
        walk(child, visit, ancestors);
        ancestors.pop();
      }
    }
  }
}

function bindingNames(pattern, out) {
  if (!pattern) return out;
  if (pattern.type === 'Identifier') out.add(pattern.name);
  else if (pattern.type === 'ObjectPattern') pattern.properties.forEach((p) => bindingNames(p.type === 'RestElement' ? p : p.value, out));
  else if (pattern.type === 'ArrayPattern') pattern.elements.forEach((e) => bindingNames(e, out));
  else if (pattern.type === 'RestElement') bindingNames(pattern.argument, out);
  else if (pattern.type === 'AssignmentPattern') bindingNames(pattern.left, out);
  return out;
}

function isFunction(node) {
  return node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression';
}

function propertyName(member) {
  if (!member.computed && member.property.type === 'Identifier') return member.property.name;
  if (member.computed && member.property.type === 'Literal' && typeof member.property.value === 'string') return member.property.value;
  return null;
}

// 'Object.entries' for Object.entries, 'x' for x; null for anything else.
function exprKey(node) {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') {
    const object = exprKey(node.object);
    const name = propertyName(node);
    return object !== null && name !== null ? object + '.' + name : null;
  }
  return null;
}

// true when `test` holds only if `key` is defined, false when it holds only if `key` is undefined.
function testDefines(test, key) {
  if (!test) return null;
  if (exprKey(test) === key) return true;
  if (test.type === 'UnaryExpression' && test.operator === '!') {
    const inner = testDefines(test.argument, key);
    return inner === null ? null : !inner;
  }
  if (test.type !== 'BinaryExpression') return null;
  let typeOf = test.left;
  let other = test.right;
  let op = test.operator;
  if (!(typeOf.type === 'UnaryExpression' && typeOf.operator === 'typeof')) {
    typeOf = test.right;
    other = test.left;
    op = { '<': '>', '>': '<' }[op] || op;
  }
  if (!(typeOf.type === 'UnaryExpression' && typeOf.operator === 'typeof') || exprKey(typeOf.argument) !== key) return null;
  if (other.type !== 'Literal' || typeof other.value !== 'string') return null;
  // esbuild's minifier writes `typeof x !== "undefined"` as `typeof x < "u"`.
  if (other.value === 'u' && op === '<') return true;
  if (other.value === 'u' && op === '>') return false;
  if (other.value === 'undefined') {
    if (op === '!==' || op === '!=') return true;
    if (op === '===' || op === '==') return false;
    return null;
  }
  return op === '===' || op === '==' ? true : null;
}

// Is the node at the end of `ancestors` only reached when `key` is defined? `typeof key` itself is safe, but
// `typeof key.member` is not: it still reads key.
function isGuarded(ancestors, key) {
  const parent = ancestors.length ? ancestors[ancestors.length - 1].node : null;
  if (parent && parent.type === 'UnaryExpression' && parent.operator === 'typeof') return true;
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const { node, key: childKey } = ancestors[i];
    if (node.type === 'ConditionalExpression' || node.type === 'IfStatement') {
      const defines = testDefines(node.test, key);
      if (childKey === 'consequent' && defines === true) return true;
      if (childKey === 'alternate' && defines === false) return true;
    }
    if (node.type === 'LogicalExpression' && childKey === 'right') {
      const defines = testDefines(node.left, key);
      if (node.operator === '&&' && defines === true) return true;
      if (node.operator === '||' && defines === false) return true;
    }
  }
  return false;
}

function isReference(node, parent, key) {
  if (!parent) return true;
  if (parent.type === 'MemberExpression' && key === 'property' && !parent.computed) return false;
  if ((parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') &&
    key === 'key' && !parent.computed) return false;
  if ((parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') &&
    key === 'label') return false;
  if (parent.type === 'MetaProperty') return false;
  if (parent.type === 'ExportSpecifier' && key === 'exported') return false;
  return true;
}

// A backslash-u-brace that is not itself escaped.
function hasCodePointEscape(raw) {
  return /(^|[^\\])(\\\\)*\\u\{/.test(raw);
}

function newTypedArrayName(node) {
  return node && node.type === 'NewExpression' && node.callee.type === 'Identifier' &&
    TYPED_ARRAYS.indexOf(node.callee.name) !== -1 ? node.callee.name : null;
}

// Every use of a feature in `code`, active or not: [{ id, kind, line, column, text }].
function scan(code, sourceType) {
  const ast = acorn.parse(code, { ecmaVersion: 2015, sourceType, locations: true });
  const declared = new Set();
  const typedReceivers = new Set();
  walk(ast, (node) => {
    if (node.type === 'VariableDeclarator') {
      bindingNames(node.id, declared);
      if (node.id.type === 'Identifier' && newTypedArrayName(node.init)) typedReceivers.add(node.id.name);
    }
    if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier' && newTypedArrayName(node.right)) {
      typedReceivers.add(node.left.name);
    }
    if (isFunction(node)) {
      if (node.id) declared.add(node.id.name);
      node.params.forEach((p) => bindingNames(p, declared));
    }
    if (node.type === 'CatchClause') bindingNames(node.param, declared);
    if ((node.type === 'ClassDeclaration' || node.type === 'ClassExpression') && node.id) declared.add(node.id.name);
  }, []);

  const uses = [];
  const add = (id, kind, node, extra) => {
    const text = code.slice(node.start, Math.min(node.end, node.start + 60)).replace(/\s+/g, ' ');
    uses.push(Object.assign({ id, kind, line: node.loc.start.line, column: node.loc.start.column, text }, extra));
  };
  const globalIds = new Set(GLOBALS.map((r) => r.id));
  const staticIds = new Set(STATICS.map((r) => r.id));
  const methodIds = new Set(METHODS.map((r) => r.id));

  walk(ast, (node, ancestors) => {
    const parentEntry = ancestors[ancestors.length - 1];
    const parent = parentEntry && parentEntry.node;
    const key = parentEntry && parentEntry.key;
    switch (node.type) {
      case 'VariableDeclaration':
        if (node.kind !== 'var') add(node.kind, 'syntax', node);
        break;
      case 'ClassDeclaration':
      case 'ClassExpression':
        add('class', 'syntax', node);
        break;
      case 'ForOfStatement':
        add('for-of', 'syntax', node);
        break;
      case 'ObjectPattern':
      case 'ArrayPattern':
        add('destructuring', 'syntax', node);
        break;
      case 'MetaProperty':
        add('new.target', 'syntax', node);
        break;
      case 'Super':
        add('super', 'syntax', node);
        break;
      case 'ArrowFunctionExpression':
        add('arrow-function', 'syntax', node);
        break;
      case 'TemplateLiteral':
        add('template-literal', 'syntax', node);
        break;
      case 'TemplateElement':
        if (hasCodePointEscape(node.value.raw)) add('code-point-escape', 'syntax', node);
        break;
      case 'SpreadElement':
        add('spread', 'syntax', node);
        break;
      case 'AssignmentPattern':
        if (parent && isFunction(parent) && key === 'params') add('default-parameter', 'syntax', node);
        break;
      case 'RestElement':
        if (parent && isFunction(parent) && key === 'params') add('rest-parameter', 'syntax', node);
        break;
      case 'Property':
        if (node.shorthand) add('shorthand-property', 'syntax', node);
        if (node.method) add('method-definition', 'syntax', node);
        if (node.computed) add('computed-property', 'syntax', node);
        break;
      case 'Literal':
        if (node.regex) {
          if (node.regex.flags.indexOf('u') !== -1) add('regexp-u-flag', 'syntax', node);
          if (node.regex.flags.indexOf('y') !== -1) add('regexp-y-flag', 'syntax', node);
        } else if (typeof node.raw === 'string' && /^0[bBoO]/.test(node.raw)) {
          add('binary-octal-literal', 'syntax', node);
        }
        if (typeof node.raw === 'string' && hasCodePointEscape(node.raw)) add('code-point-escape', 'syntax', node);
        break;
      case 'FunctionDeclaration': {
        const inBody = parent && (parent.type === 'Program' || parent.type === 'ExportNamedDeclaration' ||
          parent.type === 'ExportDefaultDeclaration' ||
          (parent.type === 'BlockStatement' && ancestors.length > 1 && isFunction(ancestors[ancestors.length - 2].node) &&
            ancestors[ancestors.length - 2].key === 'body'));
        if (!inBody) add('block-function', 'syntax', node);
        if (node.generator) add('generator', 'syntax', node);
        break;
      }
      case 'FunctionExpression':
        if (node.generator) add('generator', 'syntax', node);
        break;
      case 'Identifier': {
        if (code.slice(node.start, node.end) !== node.name && hasCodePointEscape(code.slice(node.start, node.end))) {
          add('code-point-escape', 'syntax', node);
        }
        if (!isReference(node, parent, key)) break;
        if (node.name === 'arguments') {
          for (let i = ancestors.length - 1; i >= 0; i--) {
            const a = ancestors[i].node;
            if (a.type === 'ArrowFunctionExpression') { add('arrow-arguments', 'syntax', node); break; }
            if (a.type === 'FunctionExpression' || a.type === 'FunctionDeclaration') break;
          }
        }
        if (globalIds.has(node.name) && !declared.has(node.name) && !isGuarded(ancestors, node.name)) {
          add(node.name, 'global', node);
        }
        break;
      }
      case 'MemberExpression': {
        const name = propertyName(node);
        if (name === null) break;
        const k = exprKey(node);
        const objectName = node.object.type === 'Identifier' ? node.object.name : null;
        if (k && staticIds.has(k) && !declared.has(objectName) && !isGuarded(ancestors, k)) {
          add(k, 'static', node);
        }
        if (objectName && ['window', 'self', 'globalThis'].indexOf(objectName) !== -1 && globalIds.has(name)) {
          add(name, 'global', node);
        }
        if (methodIds.has('.' + name) && !(k && isGuarded(ancestors, k))) add('.' + name, 'method', node);
        const typedObject = newTypedArrayName(node.object) ||
          (objectName && typedReceivers.has(objectName) ? objectName : null);
        if (typedObject && Object.prototype.hasOwnProperty.call(TYPED_ARRAY_METHODS, name)) {
          add('TypedArray method', 'typed-array', node, { since: TYPED_ARRAY_METHODS[name], method: name });
        }
        if (objectName && TYPED_ARRAYS.indexOf(objectName) !== -1 && (name === 'from' || name === 'of')) {
          add('TypedArray.from/of', 'typed-array', node);
        }
        if (objectName && TYPED_ARRAYS.indexOf(objectName) !== -1 && name === 'prototype' && parent &&
          parent.type === 'MemberExpression' && key === 'object') {
          const method = propertyName(parent);
          if (method && Object.prototype.hasOwnProperty.call(TYPED_ARRAY_METHODS, method)) {
            add('TypedArray method', 'typed-array', parent, { since: TYPED_ARRAY_METHODS[method], method });
          }
        }
        break;
      }
      case 'NewExpression':
        if (newTypedArrayName(node) && node.arguments.length === 0) add('new TypedArray()', 'typed-array', node);
        break;
    }
  }, []);
  return uses;
}

function ruleById(id) {
  return ALL.find((rule) => rule.id === id);
}

// The uses of features the floor lacks: [{ id, kind, line, column, text, blocked }].
function check(code, options) {
  const opts = options || {};
  const floor = opts.floor || readmeFloor();
  return scan(code, opts.sourceType || 'script').filter((use) => {
    const rule = ruleById(use.id);
    if (!rule) throw new Error('no rule for ' + use.id);
    return isActive(rule, floor, use.since);
  }).map((use) => Object.assign({ blocked: blockedAt(ruleById(use.id), floor, use.since) }, use));
}

// Problems with one RegExp built at run time (pattern and flags as strings), under ES2015 rules and the floor:
// lookbehind, named groups, \p{} and the s flag fail acorn's ES2015 grammar; the u flag fails the floor.
function regexpProblems(pattern, flags, options) {
  const floor = (options && options.floor) || readmeFloor();
  flags = flags || '';
  const problems = [];
  let source;
  try {
    // `source` escapes `/` and line breaks, so it can be written as a literal.
    source = new RegExp(pattern, flags).source;
  } catch (e) {
    return ['does not compile here: ' + e.message];
  }
  try {
    acorn.parse('/' + source + '/' + flags, { ecmaVersion: 2015 });
  } catch (e) {
    problems.push('not ES2015: ' + e.message.replace(/ \(\d+:\d+\)$/, ''));
  }
  if (flags.indexOf('u') !== -1 && isActive(ruleById('regexp-u-flag'), floor)) {
    problems.push('u flag: ' + blockedAt(ruleById('regexp-u-flag'), floor).join(', '));
  }
  if (flags.indexOf('y') !== -1 && isActive(ruleById('regexp-y-flag'), floor)) {
    problems.push('y flag: ' + blockedAt(ruleById('regexp-y-flag'), floor).join(', '));
  }
  return problems;
}

// A script for a vm context that deletes every built-in the floor lacks, so a build that calls one throws or
// takes its fallback. It also sets `window`, which the script builds fall back to without globalThis.
function removalScript(options) {
  const floor = (options && options.floor) || readmeFloor();
  const paths = [];
  GLOBALS.forEach((r) => { if (isActive(r, floor)) paths.push(r.id); });
  STATICS.forEach((r) => { if (isActive(r, floor)) paths.push(r.id); });
  METHODS.forEach((r) => {
    if (isActive(r, floor)) r.on.forEach((owner) => paths.push(owner + '.prototype.' + r.id.slice(1)));
  });
  Object.keys(TYPED_ARRAY_METHODS).forEach((name) => {
    if (isActive(TYPED[0], floor, TYPED_ARRAY_METHODS[name])) paths.push('%TypedArray%.prototype.' + name);
  });
  if (isActive(TYPED[1], floor)) paths.push('%TypedArray%.from', '%TypedArray%.of');
  RUNTIME_ONLY.forEach((r) => { if (isActive(r, floor)) paths.push(r.id); });
  return '(function (g) {\n' +
    '  var roots = { "%TypedArray%": Object.getPrototypeOf(Int8Array) };\n' +
    '  var paths = ' + JSON.stringify(paths) + ';\n' +
    '  for (var i = 0; i < paths.length; i++) {\n' +
    '    var parts = paths[i].split(".");\n' +
    '    var owner = roots[parts[0]] || (parts.length > 1 ? g[parts[0]] : g);\n' +
    '    var start = parts.length > 1 ? 1 : 0;\n' +
    '    for (var j = start; owner && j < parts.length - 1; j++) owner = owner[parts[j]];\n' +
    '    var name = parts[parts.length - 1];\n' +
    '    if (owner && Object.prototype.hasOwnProperty.call(owner, name)) delete owner[name];\n' +
    '    if (owner && Object.prototype.hasOwnProperty.call(owner, name)) throw new Error("could not remove " + paths[i]);\n' +
    '  }\n' +
    '  g.window = g;\n' +
    '  return paths;\n' +
    '})(this);\n';
}

module.exports = {
  ROOT,
  BROWSERS,
  RULES: ALL,
  TYPED_ARRAY_METHODS,
  readmeFloor,
  isActive,
  blockedAt,
  scan,
  check,
  regexpProblems,
  removalScript
};

if (require.main === module) {
  const floor = readmeFloor();
  console.log('README floor: ' + BROWSERS.map((b) => b + ' ' + floor[b]).join(', '));
  const active = ALL.filter((r) => isActive(r, floor));
  console.log('\nActive rules (' + active.length + '):');
  active.forEach((r) => console.log('  ' + r.kind.padEnd(11) + ' ' + r.id.padEnd(34) + ' ' + blockedAt(r, floor).join(', ')));
  console.log('\nAllowed at this floor: ' + ALL.filter((r) => !isActive(r, floor)).map((r) => r.id).join(', '));
  const builds = { 'knayi-myscript.min.js': 'script', 'knayi-myscript.js': 'script', 'knayi-myscript.mjs': 'module',
    'knayi-myscript.es.js': 'module' };
  for (const file of Object.keys(builds)) {
    const code = fs.readFileSync(path.join(require('../build').builtDist(), file), 'utf8');
    const uses = scan(code, builds[file]);
    const counts = {};
    uses.forEach((u) => { counts[u.id] = (counts[u.id] || 0) + 1; });
    const violations = check(code, { sourceType: builds[file], floor });
    console.log('\n' + file + ': uses ' + Object.keys(counts).map((k) => k + ' ' + counts[k]).join(', '));
    violations.forEach((v) => console.log('  below the floor: ' + v.id + ' at ' + v.line + ':' + v.column + '  ' + v.text));
  }
}
