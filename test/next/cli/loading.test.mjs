// knayi never loads code from the working directory (SECURITY.md, "Loading code it should not"). The command is
// meant to run inside data folders nobody has checked, so a node_modules or package.json there must not decide
// which code runs. These tests run it in such a folder, and read the sources of bin/ for every place that loads
// code, as test/next/guards/stateless.test.mjs reads src/.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as acorn from 'acorn';
import { ROOT } from '../helpers.mjs';
import { walk, codeLoadingSites } from '../guards/ast.mjs';
import { spawnKnayi, fixture } from './helpers.mjs';

const BIN_DIR = path.join(ROOT, 'bin');

// A folder whose node_modules holds a myanmar-tools that leaves a file behind when it is loaded, and whose
// package.json would make every .js file an ES module and map a # import, as a hostile folder might.
let folder;
let marker;
before(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'knayi-cli-'));
  marker = path.join(folder, 'LOADED');
  const fake = path.join(folder, 'node_modules', 'myanmar-tools');
  fs.mkdirSync(fake, { recursive: true });
  fs.writeFileSync(path.join(fake, 'package.json'), JSON.stringify({ name: 'myanmar-tools', main: 'index.js' }));
  fs.writeFileSync(path.join(fake, 'index.js'), 'require("fs").writeFileSync(' + JSON.stringify(marker) +
    ', "loaded");\nexports.ZawgyiDetector = function () { this.getZawgyiProbability = () => 1; };\n');
  fs.writeFileSync(path.join(folder, 'package.json'),
    JSON.stringify({ type: 'module', imports: { '#knayi': './node_modules/myanmar-tools/index.js' } }));
  fs.copyFileSync(fixture('mixed.txt'), path.join(folder, 'mixed.txt'));
});
after(() => fs.rmSync(folder, { recursive: true, force: true }));

describe('knayi in a folder with a node_modules of its own', () => {
  it('--detector myanmar-tools loads the package installed next to knayi, not the folder\'s', () => {
    const run = spawnKnayi(['detect', '--detector', 'myanmar-tools', 'mixed.txt'], { cwd: folder });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(fs.existsSync(marker), false, 'the folder\'s myanmar-tools ran');
    assert.equal(run.stdout, spawnKnayi(['detect', '--detector', 'myanmar-tools', fixture('mixed.txt')]).stdout);
    assert.notEqual(run.stdout.split('\n')[0], 'zawgyi', 'the fake reads every line as Zawgyi');
  });

  it('nor through NODE_PATH, which ES modules do not read', () => {
    const env = Object.assign({}, process.env, { NODE_PATH: path.join(folder, 'node_modules') });
    const run = spawnKnayi(['detect', '--detector', 'myanmar-tools', 'mixed.txt'], { cwd: folder, env: env });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(fs.existsSync(marker), false);
  });

  it('every command runs there without loading anything of the folder', () => {
    for (const command of ['normalize', 'to-unicode', 'to-zawgyi', 'detect', 'segment', 'check']) {
      const run = spawnKnayi([command, 'mixed.txt'], { cwd: folder });
      assert.ok(run.status === 0 || (command === 'check' && run.status === 1), command + ': ' + run.stderr);
    }
    assert.equal(fs.existsSync(marker), false);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The sources of bin/.

function binSources() {
  const files = [];
  (function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith('.js')) files.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  })(BIN_DIR);
  return files.map((file) => {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/^#!.*/, '');
    const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    return { file, ast };
  });
}

describe('the sources of bin/', () => {
  it('load code in one place: bin/cli/detector.js imports myanmar-tools by name, and only on request', () => {
    const sites = [];
    for (const { file, ast } of binSources()) {
      for (const [node, what] of codeLoadingSites(ast)) {
        const literal = node.type === 'ImportExpression' && node.source.type === 'Literal' ? node.source.value : null;
        sites.push(file + ': ' + what + (literal === null ? '' : ' ' + literal));
      }
    }
    assert.deepEqual(sites, ['bin/cli/detector.js: import() myanmar-tools']);
  });

  it('import only Node built-ins, each other, and the public entries of src/', () => {
    const allowed = new Set(['src/index.js', 'src/stream.js']);
    const bad = [];
    for (const { file, ast } of binSources()) {
      walk(ast, (node) => {
        if (node.type !== 'ImportDeclaration' && node.type !== 'ExportNamedDeclaration') return;
        if (!node.source) return;
        const specifier = node.source.value;
        if (specifier.startsWith('node:')) return;
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
        if (!(target.startsWith('bin/') || allowed.has(target))) bad.push(file + ': ' + specifier);
      });
    }
    assert.deepEqual(bad, []);
  });

  it('keep every function to 40 lines, as src/ does (DESIGN.md §1.2 rule 3)', () => {
    const bad = [];
    for (const { file, ast } of binSources()) {
      walk(ast, (node) => {
        if (!/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type)) return;
        const lines = node.loc.end.line - node.loc.start.line + 1;
        if (lines > 40) bad.push(file + ':' + node.loc.start.line + ': ' + lines + ' lines');
      });
    }
    assert.deepEqual(bad, []);
  });
});
