const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const root = path.join(__dirname, '..', '..');

// Every file in library/ and main.js sits in a layer, and a file may require only files in its own layer or a
// lower one. The layers follow the planned layout (low to high):
//
//   L0 script    code points and character classes (planned: library/script/codes.js)
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
  ['L0 script', []],
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

// Every require(...) call in a file, found by walking the syntax tree, so comments and strings do not count.
function requiresOf(file) {
  const tree = acorn.parse(fs.readFileSync(path.join(root, file), 'utf8'), {
    ecmaVersion: 'latest',
    sourceType: 'script',
    locations: true
  });
  const found = [];
  (function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') {
      const arg = node.arguments[0];
      found.push({
        line: node.loc.start.line,
        id: node.arguments.length === 1 && arg.type === 'Literal' && typeof arg.value === 'string' ? arg.value : null
      });
    }
    for (const key of Object.keys(node)) {
      if (key !== 'loc' && node[key] && typeof node[key] === 'object') walk(node[key]);
    }
  })(tree);
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
for (const file of files) {
  for (const { line, id } of requiresOf(file)) {
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
