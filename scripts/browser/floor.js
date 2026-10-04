'use strict';
// The browser floor: what the dist builds may use, given the oldest browsers README.md promises.
//
// test/syntax.test.js parses every build with acorn at ES2015. 3.0's floor is the first versions with full ES2015
// support (decision 18): Chrome 51, Edge 15, Firefox 54 and Safari 10.1, where 2.x's was Chrome 49, Edge 14,
// Firefox 34 and Safari 10, browsers that shipped only part of ES2015. Each rule below gives the first version of
// Chrome, Edge, Firefox and Safari with full support, from MDN's browser-compat-data (BCD, read 2026-10), unless
// the note says otherwise. A rule is active only when the README floor is older than one of those versions, so
// raising the floor in README.md switches rules off by itself.
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
  { id: 'TextDecoder', since: [38, 79, 19, 10.1], source: 'api.TextDecoder' },
  { id: 'structuredClone', since: [98, 98, 94, 15.4], source: 'api.structuredClone' },
  { id: 'queueMicrotask', since: [71, 79, 69, 12.1], source: 'api.queueMicrotask' }
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
  { id: 'Intl.supportedValuesOf', since: [99, 99, 93, 15.4] },
  { id: 'Intl.PluralRules', since: [63, 18, 58, 13] },
  { id: 'Intl.RelativeTimeFormat', since: [71, 79, 65, 14] },
  { id: 'Intl.ListFormat', since: [72, 79, 78, 14.1] },
  { id: 'Intl.Locale', since: [74, 79, 75, 14] },
  { id: 'Intl.Segmenter', since: [87, 87, 125, 14.1] }
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

// Allowlists: the built-ins every browser of the 2.x floor has (Chrome 49, Edge 14, Firefox 34, Safari 10), so
// every browser of 3.0's floor has them too. They come from BCD (read 2026-10): the javascript.builtins entries,
// static members and prototype members whose first version is at or below that floor in all four browsers, among
// the names Node 26 has. A rule above names a feature and its versions; the allowlists catch what no rule names.
// check() flags any other free global and any other static member of these namespaces ('unlisted global',
// 'unlisted static'), unless the use is behind a typeof guard or a rule names it; removalScript() deletes every
// other global, static member and prototype member before a build runs, but keeps what a rule names and the floor
// has. A higher floor in README.md switches the rules above off by itself, but these lists only grow by hand. To use
// a built-in that neither they nor a rule name, check BCD and add it here.
const FLOOR_GLOBALS = [
  'Array', 'ArrayBuffer', 'Boolean', 'DataView', 'Date', 'Error', 'EvalError', 'Float32Array', 'Float64Array',
  'Function', 'Infinity', 'Int16Array', 'Int32Array', 'Int8Array', 'Intl', 'JSON', 'Map', 'Math', 'NaN', 'Number',
  'Object', 'Promise', 'Proxy', 'RangeError', 'ReferenceError', 'RegExp', 'Set', 'String', 'SyntaxError', 'TypeError',
  'URIError', 'Uint16Array', 'Uint32Array', 'Uint8Array', 'Uint8ClampedArray', 'WeakMap', 'WeakSet', 'decodeURI',
  'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'escape', 'eval', 'isFinite', 'isNaN', 'parseFloat',
  'parseInt', 'undefined', 'unescape'
];

const FLOOR_STATICS = {
  Array: ['from', 'isArray', 'of'],
  ArrayBuffer: ['isView'],
  Boolean: [],
  DataView: [],
  Date: ['UTC', 'now', 'parse'],
  Error: [],
  EvalError: [],
  Float32Array: ['BYTES_PER_ELEMENT'],
  Float64Array: ['BYTES_PER_ELEMENT'],
  Function: [],
  Int16Array: ['BYTES_PER_ELEMENT'],
  Int32Array: ['BYTES_PER_ELEMENT'],
  Int8Array: ['BYTES_PER_ELEMENT'],
  Intl: ['Collator', 'DateTimeFormat', 'NumberFormat'],
  JSON: ['parse', 'stringify'],
  Map: [],
  Math: [
    'E', 'LN10', 'LN2', 'LOG10E', 'LOG2E', 'PI', 'SQRT1_2', 'SQRT2', 'abs', 'acos', 'acosh', 'asin', 'asinh', 'atan',
    'atan2', 'atanh', 'cbrt', 'ceil', 'clz32', 'cos', 'cosh', 'exp', 'expm1', 'floor', 'fround', 'hypot', 'imul',
    'log', 'log10', 'log1p', 'log2', 'max', 'min', 'pow', 'random', 'round', 'sign', 'sin', 'sinh', 'sqrt', 'tan',
    'tanh', 'trunc'
  ],
  Number: [
    'EPSILON', 'MAX_SAFE_INTEGER', 'MAX_VALUE', 'MIN_SAFE_INTEGER', 'MIN_VALUE', 'NEGATIVE_INFINITY', 'NaN',
    'POSITIVE_INFINITY', 'isFinite', 'isInteger', 'isNaN', 'isSafeInteger', 'parseFloat', 'parseInt'
  ],
  Object: [
    'assign', 'create', 'defineProperties', 'defineProperty', 'freeze', 'getOwnPropertyDescriptor',
    'getOwnPropertyNames', 'getPrototypeOf', 'is', 'isExtensible', 'isFrozen', 'isSealed', 'keys',
    'preventExtensions', 'seal', 'setPrototypeOf'
  ],
  Promise: ['all', 'race', 'reject', 'resolve'],
  Proxy: [],
  RangeError: [],
  ReferenceError: [],
  RegExp: ['input', 'lastMatch', 'lastParen', 'leftContext', 'rightContext'],
  Set: [],
  String: ['fromCharCode', 'fromCodePoint', 'raw'],
  SyntaxError: [],
  TypeError: [],
  URIError: [],
  Uint16Array: ['BYTES_PER_ELEMENT'],
  Uint32Array: ['BYTES_PER_ELEMENT'],
  Uint8Array: ['BYTES_PER_ELEMENT'],
  Uint8ClampedArray: ['BYTES_PER_ELEMENT'],
  WeakMap: [],
  WeakSet: []
};

const FLOOR_PROTOTYPES = {
  Array: [
    'concat', 'copyWithin', 'entries', 'every', 'fill', 'filter', 'find', 'findIndex', 'forEach', 'indexOf', 'join',
    'keys', 'lastIndexOf', 'length', 'map', 'pop', 'push', 'reduce', 'reduceRight', 'reverse', 'shift', 'slice',
    'some', 'sort', 'splice', 'toLocaleString', 'toString', 'unshift'
  ],
  ArrayBuffer: ['byteLength', 'slice'],
  Boolean: ['toString', 'valueOf'],
  DataView: [
    'buffer', 'byteLength', 'byteOffset', 'getFloat32', 'getFloat64', 'getInt16', 'getInt32', 'getInt8', 'getUint16',
    'getUint32', 'getUint8', 'setFloat32', 'setFloat64', 'setInt16', 'setInt32', 'setInt8', 'setUint16', 'setUint32',
    'setUint8'
  ],
  Date: [
    'getDate', 'getDay', 'getFullYear', 'getHours', 'getMilliseconds', 'getMinutes', 'getMonth', 'getSeconds',
    'getTime', 'getTimezoneOffset', 'getUTCDate', 'getUTCDay', 'getUTCFullYear', 'getUTCHours', 'getUTCMilliseconds',
    'getUTCMinutes', 'getUTCMonth', 'getUTCSeconds', 'getYear', 'setDate', 'setFullYear', 'setHours',
    'setMilliseconds', 'setMinutes', 'setMonth', 'setSeconds', 'setTime', 'setUTCDate', 'setUTCFullYear',
    'setUTCHours', 'setUTCMilliseconds', 'setUTCMinutes', 'setUTCMonth', 'setUTCSeconds', 'setYear', 'toDateString',
    'toGMTString', 'toISOString', 'toJSON', 'toLocaleDateString', 'toLocaleString', 'toLocaleTimeString', 'toString',
    'toTimeString', 'toUTCString', 'valueOf'
  ],
  Error: ['message', 'name', 'toString'],
  Function: [
    'apply', 'arguments', 'bind', 'call', 'caller', 'length', 'name', 'toString'
  ],
  Map: [
    'clear', 'delete', 'entries', 'forEach', 'get', 'has', 'keys', 'set', 'size', 'values'
  ],
  Number: ['toExponential', 'toFixed', 'toLocaleString', 'toPrecision', 'toString', 'valueOf'],
  Object: ['hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'toString', 'valueOf'],
  Promise: ['catch', 'then'],
  RegExp: [
    'compile', 'exec', 'global', 'ignoreCase', 'multiline', 'source', 'sticky', 'test', 'toString'
  ],
  Set: [
    'add', 'clear', 'delete', 'entries', 'forEach', 'has', 'keys', 'size', 'values'
  ],
  String: [
    'anchor', 'big', 'blink', 'bold', 'charAt', 'charCodeAt', 'codePointAt', 'concat', 'endsWith', 'fixed',
    'fontcolor', 'fontsize', 'indexOf', 'italics', 'lastIndexOf', 'length', 'link', 'localeCompare', 'match',
    'normalize', 'repeat', 'replace', 'search', 'slice', 'small', 'split', 'startsWith', 'strike', 'sub', 'substr',
    'substring', 'sup', 'toLocaleLowerCase', 'toLocaleUpperCase', 'toLowerCase', 'toString', 'toUpperCase', 'trim',
    'trimLeft', 'trimRight', 'valueOf'
  ],
  WeakMap: ['delete', 'get', 'has', 'set'],
  WeakSet: ['add', 'delete', 'has']
};

// Host names a browser page has, which the builds may read: the global object under its names, and console.
const FLOOR_HOST_GLOBALS = ['window', 'self', 'console'];
// Prototype members the removal keeps although BCD gives the floor no version for them: V8's split and replace
// read RegExp#flags on their slow path, and the others are older than BCD's records.
const KEEP_PROTOTYPE_MEMBERS = ['constructor', 'flags', '__proto__', '__defineGetter__', '__defineSetter__',
  '__lookupGetter__', '__lookupSetter__'];
const FUNCTION_STATICS = ['length', 'name', 'prototype', 'arguments', 'caller'];

// The rules the allowlists add: a free global or a static member that none of the lists or rules above names.
const UNLISTED = [
  { id: 'unlisted global', kind: 'global', since: [Infinity, Infinity, Infinity, Infinity],
    source: 'not in FLOOR_GLOBALS (scripts/browser/floor.js)' },
  { id: 'unlisted static', kind: 'static', since: [Infinity, Infinity, Infinity, Infinity],
    source: 'not in FLOOR_STATICS (scripts/browser/floor.js)' }
];

const ALL = [].concat(
  SYNTAX.map((r) => Object.assign({ kind: 'syntax' }, r)),
  GLOBALS.map((r) => Object.assign({ kind: 'global' }, r)),
  STATICS.map((r) => Object.assign({ kind: 'static' }, r)),
  UNLISTED,
  METHODS.map((r) => Object.assign({ kind: 'method' }, r)),
  TYPED.map((r) => Object.assign({ kind: 'typed-array' }, r)),
  RUNTIME_ONLY.map((r) => Object.assign({ kind: 'runtime' }, r))
);

// README.md: "They run in Chrome 51, Edge 15, Firefox 54, Safari 10.1 (iOS 10.3), ..."
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
    if (versions[i] === Infinity) out.push(browser + ' ' + floor[browser] + ' (not on the floor allowlists)');
    else if (versions[i] > floor[browser]) out.push(browser + ' ' + floor[browser] + ' (needs ' + versions[i] + ')');
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

// true when `test` is false only if `key` is defined: `typeof key === 'undefined'`, `!key`, or an `||` of tests one
// of which is such a test. The right side of `test || ...`, and the code after `if (test) return`, run only then.
function falseOnlyIfDefined(test, key) {
  if (!test) return false;
  if (test.type === 'LogicalExpression' && test.operator === '||') {
    return falseOnlyIfDefined(test.left, key) || falseOnlyIfDefined(test.right, key);
  }
  if (test.type === 'UnaryExpression' && test.operator === '!' && exprKey(test.argument) === key) return true;
  return testDefines(test, key) === false;
}

// Whether a statement always leaves its function or block: a return or a throw, or a block that ends in one.
function exits(statement) {
  if (!statement) return false;
  if (statement.type === 'ReturnStatement' || statement.type === 'ThrowStatement') return true;
  return statement.type === 'BlockStatement' && exits(statement.body[statement.body.length - 1]);
}

// Whether a statement list returns early when `key` is undefined before `child`, one of its statements:
// `if (typeof key === 'undefined' || ...) return ...;` with no else. The code after it reads key safely.
function exitsEarlyWithout(statements, child, key) {
  const index = statements.indexOf(child);
  for (let i = 0; i < index; i++) {
    const s = statements[i];
    if (s.type === 'IfStatement' && !s.alternate && exits(s.consequent) && falseOnlyIfDefined(s.test, key)) return true;
  }
  return false;
}

// Is the node at the end of `ancestors` only reached when `key` is defined? `typeof key` itself is safe, but
// `typeof key.member` is not: it still reads key.
function isGuarded(ancestors, key, node) {
  const parent = ancestors.length ? ancestors[ancestors.length - 1].node : null;
  if (parent && parent.type === 'UnaryExpression' && parent.operator === 'typeof') return true;
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const { node: container, key: childKey } = ancestors[i];
    const child = i + 1 < ancestors.length ? ancestors[i + 1].node : node;
    if (container.type === 'ConditionalExpression' || container.type === 'IfStatement') {
      const defines = testDefines(container.test, key);
      if (childKey === 'consequent' && defines === true) return true;
      if (childKey === 'alternate' && defines === false) return true;
    }
    if (container.type === 'LogicalExpression' && childKey === 'right') {
      if (container.operator === '&&' && testDefines(container.left, key) === true) return true;
      if (container.operator === '||' && falseOnlyIfDefined(container.left, key)) return true;
    }
    if ((container.type === 'BlockStatement' || container.type === 'Program') && childKey === 'body' && child &&
      exitsEarlyWithout(container.body, child, key)) return true;
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

// Uint8Array.from and the like, which the rule 'TypedArray.from/of' names, so they are not unlisted statics.
function isTypedArrayFromOf(objectName, name) {
  return objectName !== null && TYPED_ARRAYS.indexOf(objectName) !== -1 && (name === 'from' || name === 'of');
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
  const floorGlobals = new Set(FLOOR_GLOBALS.concat(FLOOR_HOST_GLOBALS, 'arguments'));

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
        if (globalIds.has(node.name) && !declared.has(node.name) && !isGuarded(ancestors, node.name, node)) {
          add(node.name, 'global', node);
        } else if (!globalIds.has(node.name) && !floorGlobals.has(node.name) && !declared.has(node.name) &&
          !isGuarded(ancestors, node.name, node)) {
          add('unlisted global', 'global', node, { name: node.name });
        }
        break;
      }
      case 'MemberExpression': {
        const name = propertyName(node);
        if (name === null) break;
        const k = exprKey(node);
        const objectName = node.object.type === 'Identifier' ? node.object.name : null;
        if (k && staticIds.has(k) && !declared.has(objectName) && !isGuarded(ancestors, k, node)) {
          add(k, 'static', node);
        } else if (objectName && Object.prototype.hasOwnProperty.call(FLOOR_STATICS, objectName) && !declared.has(objectName) &&
          FLOOR_STATICS[objectName].indexOf(name) === -1 && FUNCTION_STATICS.indexOf(name) === -1 && !staticIds.has(k) &&
          !isTypedArrayFromOf(objectName, name) && !isGuarded(ancestors, k, node) && !isGuarded(ancestors, objectName, node)) {
          add('unlisted static', 'static', node, { name: k });
        }
        if (objectName && ['window', 'self', 'globalThis'].indexOf(objectName) !== -1 && globalIds.has(name)) {
          add(name, 'global', node);
        }
        if (methodIds.has('.' + name) && !(k && isGuarded(ancestors, k, node))) add('.' + name, 'method', node);
        const typedObject = newTypedArrayName(node.object) ||
          (objectName && typedReceivers.has(objectName) ? objectName : null);
        if (typedObject && Object.prototype.hasOwnProperty.call(TYPED_ARRAY_METHODS, name)) {
          add('TypedArray method', 'typed-array', node, { since: TYPED_ARRAY_METHODS[name], method: name });
        }
        if (isTypedArrayFromOf(objectName, name)) add('TypedArray.from/of', 'typed-array', node);
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

// The allowlists at a floor: the lists above, and the globals, static members and methods that a rule names and
// every browser of the floor has (none at the 2.x floor the lists were made for; Symbol, Reflect and the like at
// 3.0's).
function allowedAt(floor) {
  const globals = FLOOR_GLOBALS.concat(FLOOR_HOST_GLOBALS);
  const statics = JSON.parse(JSON.stringify(FLOOR_STATICS));
  const prototypes = JSON.parse(JSON.stringify(FLOOR_PROTOTYPES));
  GLOBALS.forEach((rule) => { if (!isActive(rule, floor)) globals.push(rule.id); });
  STATICS.forEach((rule) => {
    const [owner, name] = rule.id.split('.');
    if (!isActive(rule, floor) && statics[owner]) statics[owner].push(name);
  });
  METHODS.forEach((rule) => {
    if (isActive(rule, floor)) return;
    rule.on.forEach((owner) => { if (prototypes[owner]) prototypes[owner].push(rule.id.slice(1)); });
  });
  return { globals, statics, prototypes };
}

// A script for a vm context that deletes every built-in the floor lacks, so a build that calls one throws or
// takes its fallback: the ones the rules name, and then every global, static member and prototype member the
// allowlists at the floor leave out (one the runtime will not let go of is left, and the script returns only what
// it removed). It also sets `window`, which the script builds fall back to without globalThis.
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
    '  var allow = ' + JSON.stringify(Object.assign(allowedAt(floor),
    { functionStatics: FUNCTION_STATICS, keep: KEEP_PROTOTYPE_MEMBERS })) + ';\n' +
    '  var removed = paths.slice();\n' +
    '  function prune(owner, label, allowed) {\n' +
    '    var names = Object.getOwnPropertyNames(owner);\n' +
    '    for (var k = 0; k < names.length; k++) {\n' +
    '      if (allowed(names[k])) continue;\n' +
    '      try { delete owner[names[k]]; } catch (e) {}\n' +
    '      if (!Object.prototype.hasOwnProperty.call(owner, names[k])) removed.push(label + names[k]);\n' +
    '    }\n' +
    '  }\n' +
    '  var ns;\n' +
    '  for (ns in allow.statics) {\n' +
    '    if (g[ns]) prune(g[ns], ns + ".", function (n) { return allow.statics[ns].indexOf(n) !== -1 || allow.functionStatics.indexOf(n) !== -1; });\n' +
    '  }\n' +
    '  for (ns in allow.prototypes) {\n' +
    '    if (g[ns] && g[ns].prototype) prune(g[ns].prototype, ns + ".prototype.", function (n) { return allow.prototypes[ns].indexOf(n) !== -1 || allow.keep.indexOf(n) !== -1; });\n' +
    '  }\n' +
    '  prune(g, "", function (n) { return allow.globals.indexOf(n) !== -1; });\n' +
    '  g.window = g;\n' +
    '  return removed;\n' +
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
  const { FILES, SOURCE_TYPES, builtDist } = require('../build');
  for (const file of FILES) {
    const code = fs.readFileSync(path.join(builtDist(), file), 'utf8');
    const uses = scan(code, SOURCE_TYPES[file]);
    const counts = {};
    uses.forEach((u) => { counts[u.id] = (counts[u.id] || 0) + 1; });
    const violations = check(code, { sourceType: SOURCE_TYPES[file], floor });
    console.log('\n' + file + ': uses ' + Object.keys(counts).map((k) => k + ' ' + counts[k]).join(', '));
    violations.forEach((v) => console.log('  below the floor: ' + v.id + ' at ' + v.line + ':' + v.column + '  ' + v.text));
  }
}
