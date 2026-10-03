// The stateless core (docs/next/DESIGN.md §4). The core is every file of src/ outside compat/ and spec/.
//
// Rule 1: no configuration state. Module-level values are frozen data, the readers' scratch objects (made by
// /* @__PURE__ */ factories), or NFC_MEMO in core/nfc.js (D20), the one exemption, listed by name below. No other
// may be added. Rule 2: no console and no environment: no console, process, globalThis, window or self, no eval
// or Function, and no module loading.
//
// The configuration runs call the entry points with different per-call options, interleaved in one process, and
// require each call to give what it gives alone: nothing carries over (Phase 6 exit).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parsedSources, walk, isReference, codeLoadingSites, where } from './ast.mjs';
import { SRC } from '../helpers.mjs';
import { detectFont } from '../../../src/detect.js';
import { normalizeText } from '../../../src/engine/normalizeStages.js';
import * as nfc from '../../../src/core/nfc.js';

const EXEMPT = { 'core/nfc.js': ['NFC_MEMO'] };
const ENVIRONMENT = new Set(['console', 'process', 'globalThis', 'window', 'self', 'eval', 'Function']);

const isCore = (file) => !file.startsWith('compat/') && !file.startsWith('spec/');
const CORE = parsedSources().filter((source) => isCore(source.file));

// The exports of every core module.
async function coreExports() {
  const all = [];
  for (const { file } of CORE) {
    const module = await import(pathToFileURL(path.join(SRC, file)).href);
    for (const [name, value] of Object.entries(module)) all.push({ name: file + ' ' + name, value });
  }
  return all;
}

// Calls visit(value, path) on every value under value, through plain objects and arrays.
function eachValue(value, name, visit, seen = new Set()) {
  visit(value, name);
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null) return;
  for (const key of Object.getOwnPropertyNames(value)) eachValue(value[key], name + '.' + key, visit, seen);
}

const MYANMAR_TEXTS = ['\u1000\u103C\u1031\u102C\u1004\u103A\u1038', '\u1031\u1000\u103B\u102C\u1038',
  '\u1000\u1039\u1000\u102C\u103A', '\u1025\u102E\u1038', 'abc \u101D\u1004\u103A', '\u1040\u1041\u1040'];

// Runs each configuration on each text alone, then all of them interleaved, and requires the same results.
function assertNoCarryOver(configurations, texts) {
  const alone = configurations.map((run) => texts.map((text) => run(text)));
  for (let round = 0; round < 3; round++) {
    texts.forEach((text, t) => {
      configurations.forEach((run, c) => assert.deepEqual(run(text), alone[c][t], 'configuration ' + c));
    });
  }
  return alone;
}

describe('the stateless core (DESIGN.md §4)', () => {
  it('rule 1: no top-level let or var, and no mutable top-level object but NFC_MEMO', () => {
    const bad = [];
    for (const { file, ast } of CORE) {
      for (const statement of ast.body) {
        const node = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
        if (!node || node.type !== 'VariableDeclaration') continue;
        if (node.kind !== 'const') bad.push(where(file, node) + ': top-level ' + node.kind);
        for (const declarator of node.declarations) {
          const mutable = declarator.init && /^(ObjectExpression|ArrayExpression)$/.test(declarator.init.type);
          if (mutable && !(EXEMPT[file] || []).includes(declarator.id.name)) {
            bad.push(where(file, declarator) + ': ' + declarator.id.name + ' is not frozen');
          }
        }
      }
    }
    assert.deepEqual(bad, []);
  });

  it('rule 2: no console, process, globalThis, window, self, eval or Function, and no module loading', () => {
    const bad = [];
    for (const { file, ast } of CORE) {
      walk(ast, (node, parent, key) => {
        if (node.type === 'Identifier' && ENVIRONMENT.has(node.name) && isReference(node, parent, key)) {
          bad.push(where(file, node) + ': ' + node.name);
        }
      });
      for (const [node, what] of codeLoadingSites(ast)) bad.push(where(file, node) + ': ' + what);
    }
    assert.deepEqual(bad, []);
  });

  it('every exported plain object and array is frozen, all the way down', async () => {
    const bad = [];
    for (const { name, value } of await coreExports()) {
      eachValue(value, name, (item, at) => {
        if (item === null || typeof item !== 'object') return;
        const plain = Array.isArray(item) || Object.getPrototypeOf(item) === Object.prototype ||
          Object.getPrototypeOf(item) === null;
        if (plain && !Object.isFrozen(item)) bad.push(at);
      });
    }
    assert.deepEqual(bad, []);
  });

  it('detectFont honours each call\'s own model', () => {
    const model = (probability) => ({ getZawgyiProbability: () => probability });
    const unicodeModel = { zawgyiModel: model(0) };
    const zawgyiModel = { zawgyiModel: model(1) };
    const results = assertNoCarryOver([
      (text) => detectFont(text, unicodeModel),
      (text) => detectFont(text, zawgyiModel),
      (text) => detectFont(text)
    ], MYANMAR_TEXTS);
    assert.ok(results[0].every((font) => font === 'unicode'));
    assert.ok(results[1].every((font) => font === 'zawgyi'));
  });

  it('normalizeText honours each call\'s own gate setting', () => {
    const results = assertNoCarryOver([
      (text) => normalizeText(text),
      (text) => normalizeText(text, { openAllGates: true })
    ], MYANMAR_TEXTS.concat(['ascii only', '']));
    assert.deepEqual(results[0], results[1]);
  });

  it('toNfc with the warm memo equals toNfcWith a cold one', () => {
    const texts = MYANMAR_TEXTS.concat(['e\u0301\u0323', '\u1000' + '\u1037\u1039'.repeat(40)]);
    for (const text of texts) assert.equal(nfc.toNfc(text), nfc.toNfcWith(text, nfc.createNfcMemo()));
  });

  it('every global regex the core exports is left with lastIndex 0', async () => {
    const bad = [];
    for (const { name, value } of await coreExports()) {
      eachValue(value, name, (item, at) => {
        if (item instanceof RegExp && item.lastIndex !== 0) bad.push(at);
      });
    }
    assert.deepEqual(bad, []);
  });
});
