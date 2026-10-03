const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const root = path.join(__dirname, '..', '..');

// Every file in library/ and main.js sits in a layer, and a file may require only files in its own layer or a
// lower one. The layers follow the planned layout (low to high):
//
//   L0 script    code points, character classes and NFC (library/nfc.js; planned: library/script/codes.js)
//   L1 core      options, input checks and the rule runner (planned: library/core/)
//   L2 fonts     font data: glyph tables and sequences (planned: library/fonts/)
//   L3 engine    syllable order and the readers (planned: library/engine/syllable.js and readers.js)
//   L3 rules     rules run on text: typing fixes, break rules, Unicode to Zawgyi rules
//   L3 stages    pipelines that chain the engine and the rules (planned: library/engine/stages.js)
//   L4 public    one file per public function, input checks then a call into the layers below
//   entry        main.js
//
// The three L3 parts are ordered as the data flows: the readers know nothing of the rules run after them.
// A file added to library/ fails this test until it is given a layer here.
const LAYERS = [
  ['L0 script', ['library/nfc.js']],
  ['L1 core', ['library/globalOptions.js', 'library/contentGate.js']],
  ['L2 fonts', ['library/zawgyi.js', 'library/win.js']],
  ['L3 engine', ['library/storageOrder.js']],
  ['L3 rules', ['library/typingFixes.js', 'library/syllable.js']],
  ['L3 stages', []],
  ['L4 public', [
    'library/converter.js',
    'library/detector.js',
    'library/normalization.js',
    'library/spellingCheck.js',
    'library/syllBreak.js',
    'library/truncate.js'
  ]],
  ['entry', ['main.js']]
];

// Today's upward edges. Each goes away when its file is split; remove the entry then (a stale entry fails), and
// never add one.
const KNOWN_UPWARD = [
  // storageOrder.js holds the font pipeline (toUnicode) as well as the reader, and the pipeline runs the typing
  // fixes after the reader. The pipeline belongs in L3 stages.
  'library/storageOrder.js -> library/typingFixes.js',
  // The font files run their own conversion through the engine; as data only they need nothing above L2.
  'library/zawgyi.js -> library/storageOrder.js',
  'library/win.js -> library/storageOrder.js'
];

const layerOf = new Map();
LAYERS.forEach(([name, files], rank) => {
  for (const file of files) layerOf.set(file, { name, rank });
});

function listFiles(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(file);
    return entry.name.endsWith('.js') ? [file] : [];
  });
}

// Code loaded other than by require('<literal>'), which esbuild cannot bundle either: require used as a value (an
// alias such as `var load = require`, require.call, require.apply), and the loading APIs module.require,
// createRequire and process.getBuiltinModule. They are allowed only inside the functions listed here; today one,
// detector.js's nodeRequire, which loads the optional myanmar-tools in Node.
const LOADER_SITES = ['library/detector.js nodeRequire'];
const LOADING_MEMBERS = ['require', 'createRequire', 'getBuiltinModule'];

// Every require(...) call in a file, found by walking the syntax tree, so comments and strings do not count, and
// every other way of loading code (see LOADER_SITES), with the name of the function it is in.
function requiresOf(file) {
  const tree = acorn.parse(fs.readFileSync(path.join(root, file), 'utf8'), {
    ecmaVersion: 'latest',
    sourceType: 'script',
    locations: true
  });
  const found = [];
  const loaders = [];
  const functions = [];
  (function walk(node, parent, key) {
    if (Array.isArray(node)) return node.forEach((child) => walk(child, parent, key));
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') {
      const arg = node.arguments[0];
      found.push({
        line: node.loc.start.line,
        id: node.arguments.length === 1 && arg.type === 'Literal' && typeof arg.value === 'string' ? arg.value : null
      });
    }
    const where = () => file + ' ' + (functions.length ? functions[functions.length - 1] : '(top level)');
    if (node.type === 'Identifier' && node.name === 'require' && !(parent && parent.type === 'CallExpression' && key === 'callee')) {
      const isName = parent && ((parent.type === 'MemberExpression' && key === 'property' && !parent.computed) ||
        (parent.type === 'Property' && key === 'key' && !parent.computed));
      if (!isName) loaders.push({ line: node.loc.start.line, what: 'require used as a value', site: where() });
    }
    if (node.type === 'MemberExpression') {
      const name = node.computed ? (node.property.type === 'Literal' ? node.property.value : null) : node.property.name;
      if (LOADING_MEMBERS.indexOf(name) !== -1) loaders.push({ line: node.loc.start.line, what: '.' + name, site: where() });
    }
    const named = node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression';
    if (named) functions.push(node.id ? node.id.name : '(anonymous function)');
    for (const k of Object.keys(node)) {
      if (k !== 'loc' && node[k] && typeof node[k] === 'object') walk(node[k], node, k);
    }
    if (named) functions.pop();
  })(tree, null, null);
  found.loaders = loaders;
  return found;
}

// The required file, relative to the root, or null when the id is not a relative path.
function resolve(from, id) {
  if (!id.startsWith('./') && !id.startsWith('../')) return null;
  const base = path.posix.join(path.posix.dirname(from), id);
  for (const candidate of [base, base + '.js', base + '/index.js']) {
    const full = path.join(root, candidate);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return candidate;
  }
  return base;
}

const files = listFiles('library').concat('main.js').sort();

const edges = [];
const unresolved = [];
const loaders = [];
for (const file of files) {
  const requires = requiresOf(file);
  loaders.push(...requires.loaders);
  for (const { line, id } of requires) {
    const target = id === null ? null : resolve(file, id);
    if (target === null || !layerOf.has(target)) {
      unresolved.push(file + ':' + line + ' requires ' + (id === null ? 'a computed path' : JSON.stringify(id)));
    } else {
      edges.push({ file, line, target });
    }
  }
}

describe('layers', () => {
  it('gives every library file a layer', () => {
    const missing = files.filter((file) => !layerOf.has(file));
    assert.deepEqual(missing, [], 'add these files to LAYERS in test/unit/layers.test.js');
    const gone = Array.from(layerOf.keys()).filter((file) => !files.includes(file));
    assert.deepEqual(gone, [], 'these files in LAYERS no longer exist');
  });

  // The library ships without runtime dependencies and runs in browsers, so it requires only its own files.
  // (detector.js loads the optional myanmar-tools at run time through module.require, not require().)
  it('requires only library files, by a literal relative path', () => {
    assert.deepEqual(unresolved, []);
  });

  it('loads other code only in the one adapter loader', () => {
    const outside = loaders.filter((l) => LOADER_SITES.indexOf(l.site) === -1)
      .map((l) => l.site.split(' ')[0] + ':' + l.line + ' ' + l.what + ' in ' + l.site.split(' ')[1]);
    assert.deepEqual(outside, [], 'load library files with require(\'./file\'), and nothing else outside LOADER_SITES');
    const unused = LOADER_SITES.filter((site) => !loaders.some((l) => l.site === site));
    assert.deepEqual(unused, [], 'these LOADER_SITES load nothing any more: remove them');
  });

  it('has no upward require beyond the known exceptions', () => {
    // A file without a layer fails the first test instead.
    const upward = edges
      .filter(({ file, target }) => layerOf.has(file) && layerOf.get(target).rank > layerOf.get(file).rank)
      .map(({ file, line, target }) => ({
        edge: file + ' -> ' + target,
        detail: file + ':' + line + ' (' + layerOf.get(file).name + ') requires ' + target + ' (' + layerOf.get(target).name + ')'
      }));
    const added = upward.filter(({ edge }) => !KNOWN_UPWARD.includes(edge)).map(({ detail }) => detail);
    assert.deepEqual(added, [], 'a file may require only its own layer or lower ones');
    const fixed = KNOWN_UPWARD.filter((edge) => !upward.some((found) => found.edge === edge));
    assert.deepEqual(fixed, [], 'these edges are gone: remove them from KNOWN_UPWARD');
  });
});
