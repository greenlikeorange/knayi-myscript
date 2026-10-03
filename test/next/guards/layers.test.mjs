// The layers of src/ and their import rules (docs/next/DESIGN.md §2.1, §2.2, §5.1). There are no known
// exceptions, and none may be added.
//
// - Every file of src/ has a layer, the one the tree of §2.1 gives it, and imports only from the layers below it,
//   or its own where §2.2 allows.
// - An import is a literal relative path ending in .js that stays inside src/: nothing imports library/, main.js
//   or a package.
// - There are no import cycles, the two readers do not import each other but both import engine/syllable.js, and
//   compat's files import each other one way only (§5.1).
// - The two public APIs stand apart: the 3.0 API (index.js and api/) and compat import neither each other nor the
//   other's files (§11.1).
// - No file loads code at run time, except compat/zawgyiModel.js (D3).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parsedSources, codeLoadingSites, where } from './ast.mjs';
import { AT_ACCEPTANCE_GATE, ROOT, srcFiles } from '../helpers.mjs';

const LAYER_OF = {
  'version.js': 'L0 script',
  'freeze.js': 'L0 script',
  'script/codes.js': 'L0 script',
  'core/errors.js': 'L1 core',
  'core/options.js': 'L1 core',
  'core/input.js': 'L1 core',
  'core/rules.js': 'L1 core',
  'core/nfc.js': 'L1 core',
  'core/edits.js': 'L1 core',
  'fonts/zawgyi.js': 'L2 fonts',
  'fonts/win.js': 'L2 fonts',
  'engine/syllable.js': 'L3 engine',
  'engine/unicodeReader.js': 'L3 engine',
  'engine/fontReader.js': 'L3 engine',
  'rules/typingFixes.js': 'L3 rules',
  'rules/detect.js': 'L3 rules',
  'rules/segment.js': 'L3 rules',
  'rules/unicodeToZawgyi.js': 'L3 rules',
  'stages/normalize.js': 'L3 stages',
  'stages/fonts.js': 'L3 stages',
  'compat/index.js': 'L4 public',
  'compat/globalOptions.js': 'L4 public',
  'compat/input.js': 'L4 public',
  'compat/legacy.js': 'L4 public',
  'compat/zawgyiModel.js': 'L4 public',
  'compat/fontDetect.js': 'L4 public',
  'compat/fontConvert.js': 'L4 public',
  'compat/text.js': 'L4 public',
  'index.js': 'L4 public',
  'api/args.js': 'L4 public',
  'api/normalize.js': 'L4 public',
  'api/explain.js': 'L4 public',
  'api/encoding.js': 'L4 public',
  'api/convert.js': 'L4 public',
  'spec/detectorSignatures.js': 'spec',
  'spec/breakRules.js': 'spec',
  'spec/typoRows.js': 'spec'
};

// The layers each layer may import. The L3 parts follow the data: rules never import the engine, the engine never
// imports rules, and only stages import both. Stage files do not import each other (NEVER below).
const MAY_IMPORT = {
  'L0 script': ['L0 script'],
  'L1 core': ['L0 script', 'L1 core'],
  'L2 fonts': ['L0 script', 'L1 core'],
  'L3 engine': ['L0 script', 'L1 core', 'L2 fonts', 'L3 engine'],
  'L3 rules': ['L0 script', 'L1 core', 'L2 fonts', 'L3 rules'],
  'L3 stages': ['L0 script', 'L1 core', 'L2 fonts', 'L3 engine', 'L3 rules'],
  'L4 public': ['L0 script', 'L1 core', 'L2 fonts', 'L3 engine', 'L3 rules', 'L3 stages', 'L4 public'],
  spec: []
};

// The two readers: they may not import each other, either way, and both import the syllable steps they share
// (§2.2, D9).
const READERS = ['engine/unicodeReader.js', 'engine/fontReader.js'];
const SHARED_BY_READERS = 'engine/syllable.js';

// compat's one-way imports (§5.1): the compat files each compat file may import.
const COMPAT_IMPORTS = {
  'compat/globalOptions.js': [],
  'compat/legacy.js': [],
  'compat/zawgyiModel.js': [],
  'compat/input.js': ['compat/globalOptions.js'],
  'compat/fontDetect.js': ['compat/input.js', 'compat/globalOptions.js', 'compat/zawgyiModel.js'],
  'compat/fontConvert.js': ['compat/fontDetect.js', 'compat/input.js', 'compat/legacy.js', 'compat/globalOptions.js'],
  'compat/text.js': ['compat/fontDetect.js', 'compat/input.js', 'compat/legacy.js', 'compat/globalOptions.js'],
  'compat/index.js': ['compat/fontDetect.js', 'compat/fontConvert.js', 'compat/text.js', 'compat/globalOptions.js']
};

// The files of the 3.0 API: index.js and api/ (§11.1).
const isApiFile = (file) => file === 'index.js' || file.startsWith('api/');

// The one file that may load code: myanmar-tools, for the 2.x API (D3).
const LOADER = 'compat/zawgyiModel.js';

const SOURCES = parsedSources();

// The import edges of a parsed file: [{ node, specifier, target }], target relative to src/ or null.
function importsOf({ file, ast }) {
  const edges = [];
  for (const node of ast.body) {
    const hasSource = node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration' ||
      (node.type === 'ExportNamedDeclaration' && node.source);
    if (!hasSource) continue;
    const specifier = node.source.value;
    const relative = /^\.\.?\//.test(specifier) && specifier.endsWith('.js');
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
    const target = relative && !resolved.startsWith('../') ? resolved : null;
    edges.push({ node, specifier, target });
  }
  return edges;
}

const GRAPH = new Map(SOURCES.map((source) => [source.file, importsOf(source)]));

// The layer of each file in the tree of DESIGN.md §2.1, which writes them L0, L1, L2, L3 engine, L3 rules,
// L3 stages, L4 and (spec): { 'version.js': 'L0', ... }.
function layersInDesign() {
  const design = fs.readFileSync(path.join(ROOT, 'docs', 'next', 'DESIGN.md'), 'utf8');
  const tree = design.slice(design.indexOf('### 2.1 Tree'), design.indexOf('### 2.2 '));
  const layers = {};
  for (const [, file, layer] of tree.matchAll(/^ {2}(\S+\.js) +(L[0-4](?: engine| rules| stages)?|\(spec\))/gm)) {
    layers[file] = layer;
  }
  return layers;
}

// A layer of LAYER_OF as the tree of §2.1 writes it: 'L0 script' is L0, 'L3 rules' stays, 'spec' is (spec).
const designName = (layer) => (layer === 'spec' ? '(spec)' : layer.startsWith('L3 ') ? layer : layer.slice(0, 2));

describe('layers of src/ (DESIGN.md §2.2)', () => {
  it('every file of src/ has a layer', () => {
    const unplaced = srcFiles().filter((file) => !LAYER_OF[file]);
    assert.deepEqual(unplaced, [], 'give these files a layer in DESIGN.md §2.1 and in LAYER_OF');
  });

  it('gives each file the layer of the tree in DESIGN.md §2.1, and no file the tree leaves out', () => {
    const inGuard = {};
    for (const file of Object.keys(LAYER_OF)) inGuard[file] = designName(LAYER_OF[file]);
    assert.deepEqual(inGuard, layersInDesign(), 'LAYER_OF and the tree of DESIGN.md §2.1 must agree');
  });

  it('every planned file exists', { skip: !AT_ACCEPTANCE_GATE && 'binds at the acceptance gate (§6.3)' }, () => {
    const present = new Set(srcFiles());
    assert.deepEqual(Object.keys(LAYER_OF).filter((file) => !present.has(file)), []);
  });

  it('imports are literal relative paths to .js files inside src/', () => {
    const bad = [];
    for (const [file, edges] of GRAPH) {
      for (const edge of edges) {
        if (!edge.target) bad.push(where(file, edge.node) + ' imports ' + edge.specifier);
        else if (!LAYER_OF[edge.target]) bad.push(where(file, edge.node) + ' imports unplanned ' + edge.target);
      }
    }
    assert.deepEqual(bad, []);
  });

  it('each file imports only the layers its layer may', () => {
    const bad = [];
    for (const [file, edges] of GRAPH) {
      const layer = LAYER_OF[file];
      for (const { node, target } of edges) {
        if (!target || !LAYER_OF[target]) continue;
        if (!MAY_IMPORT[layer].includes(LAYER_OF[target])) {
          bad.push(where(file, node) + ' (' + layer + ') imports ' + target + ' (' + LAYER_OF[target] + ')');
        }
        if (layer === 'L3 stages' && LAYER_OF[target] === 'L3 stages') {
          bad.push(where(file, node) + ': stage files do not import each other');
        }
      }
    }
    assert.deepEqual(bad, []);
  });

  it('the readers do not import each other, and both import ' + SHARED_BY_READERS, () => {
    const bad = [];
    for (const [from, to] of [READERS, READERS.slice().reverse()]) {
      const targets = (GRAPH.get(from) || []).map((edge) => edge.target);
      if (targets.indexOf(to) !== -1) bad.push(from + ' imports ' + to);
      if (GRAPH.has(from) && targets.indexOf(SHARED_BY_READERS) === -1) {
        bad.push(from + ' does not import ' + SHARED_BY_READERS);
      }
    }
    assert.deepEqual(bad, []);
  });

  it('compat files import each other one way (§5.1)', () => {
    const bad = [];
    for (const [file, edges] of GRAPH) {
      if (!file.startsWith('compat/')) continue;
      for (const { node, target } of edges) {
        if (target && target.startsWith('compat/') && !(COMPAT_IMPORTS[file] || []).includes(target)) {
          bad.push(where(file, node) + ' imports ' + target);
        }
      }
    }
    assert.deepEqual(bad, []);
  });

  it('the 3.0 API and compat do not import each other (§11.1)', () => {
    const bad = [];
    for (const [file, edges] of GRAPH) {
      for (const { node, target } of edges) {
        if (!target) continue;
        const fromApi = isApiFile(file) && target.startsWith('compat/');
        const fromCompat = file.startsWith('compat/') && isApiFile(target);
        if (fromApi || fromCompat) bad.push(where(file, node) + ' imports ' + target);
      }
    }
    assert.deepEqual(bad, []);
  });

  it('has no import cycles', () => {
    const state = new Map(); // file -> 'open' while on the path, 'done' after
    const cycles = [];
    const visit = (file, trail) => {
      if (state.get(file) === 'done') return;
      if (state.get(file) === 'open') {
        cycles.push(trail.slice(trail.indexOf(file)).concat(file).join(' -> '));
        return;
      }
      state.set(file, 'open');
      for (const edge of GRAPH.get(file) || []) if (edge.target) visit(edge.target, trail.concat(file));
      state.set(file, 'done');
    };
    for (const file of GRAPH.keys()) visit(file, []);
    assert.deepEqual(cycles, []);
  });

  it('no file loads code at run time, except ' + LOADER + ' (D3)', () => {
    const bad = [];
    for (const { file, ast } of SOURCES) {
      for (const [node, what] of codeLoadingSites(ast)) {
        const allowed = file === LOADER && what !== 'import()' && what !== 'import.meta';
        if (!allowed) bad.push(where(file, node) + ' uses ' + what);
      }
    }
    assert.deepEqual(bad, []);
  });
});
