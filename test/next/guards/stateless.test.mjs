// The stateless core (docs/next/DESIGN.md §4). The core is every file of src/ outside compat/ and spec/.
//
// Rule 1: no configuration state. A module-level value is a literal or a function, frozen data, a table (a typed
// array built once at load), a primitive, or one of the names of MODULE_STATE below, each with its reason: the
// memo of NFC_MEMO (D20), the readers' scratch objects (§3.11) and the exec-loop regexes of the typing fixes. No
// other may be added without a line here and in DESIGN.md §4. Rule 2: no console and no environment: no console,
// process, globalThis, window or self, no eval or Function, and no module loading.
//
// The configuration runs call the entry points with different per-call options, interleaved in one process, and
// require each call to give what it gives alone: nothing carries over (Phase 6 exit).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parsedSources, walk, isReference, codeLoadingSites, where } from './ast.mjs';
import { topLevelConsts, constKind } from './moduleState.mjs';
import { SRC, oracle } from '../helpers.mjs';
import { detectFont } from '../../../src/rules/detect.js';
import { normalizeText } from '../../../src/stages/normalize.js';
import * as nfc from '../../../src/core/nfc.js';
import {
  fixTypos, readDigitsAsLetters, readLettersAsDigits, fixLookAlikes, zeroAsWa
} from '../../../src/rules/typingFixes.js';

// The module state the core holds, by name, with the reason each may (DESIGN.md §4 rule 1). Rule 1 fails on any
// other top-level value that is not state-free.
const MODULE_STATE = {
  'core/nfc.js': { NFC_MEMO: 'the memo of facts about the runtime\'s Unicode data, never a result (D20)' },
  'engine/unicodeReader.js': { SCRATCH: 'the Unicode reader\'s scratch, reset at each call (§3.11)' },
  'engine/fontReader.js': {
    FONT_SYLLABLE: 'the font reader\'s SyllableBuffer, reset at each call (§3.11)',
    FONT_OUTPUT: 'the font reader\'s CodeBuffer, cleared at each call (§3.11)'
  },
  'rules/typingFixes.js': {
    TYPOS: 'an exec-loop regex: each loop sets lastIndex to 0 first and ends with it at 0',
    ZERO_OR_SEVEN: 'an exec-loop regex, as TYPOS',
    BURMESE_DIGIT: 'an exec-loop regex, as TYPOS'
  }
};
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
  it('rule 1: no top-level let or var', () => {
    const bad = [];
    for (const { file, ast } of CORE) {
      for (const statement of ast.body) {
        const node = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
        if (node && node.type === 'VariableDeclaration' && node.kind !== 'const') {
          bad.push(where(file, node) + ': top-level ' + node.kind);
        }
      }
    }
    assert.deepEqual(bad, []);
  });

  it('rule 1: every top-level const is state-free, or module state listed by name with its reason', async () => {
    const sources = new Map(CORE.map((source) => [source.file, source]));
    const bad = [];
    for (const source of CORE) {
      const listed = MODULE_STATE[source.file] || {};
      const exports = await import(pathToFileURL(path.join(SRC, source.file)).href);
      for (const constant of topLevelConsts(source)) {
        const kind = constKind(sources, source, constant);
        const at = where(source.file, constant.node) + ': ' + constant.name;
        if (Object.prototype.hasOwnProperty.call(listed, constant.name)) {
          if (kind === 'free' || kind === 'frozen' || kind === 'table' || kind === 'regex') {
            bad.push(at + ' is state-free: take it out of MODULE_STATE');
          }
        } else if (kind === 'unfrozen literal') {
          bad.push(at + ' is not frozen');
        } else if (kind === 'stateful regex') {
          bad.push(at + ' keeps state in its lastIndex (exec, test with g or y, or a write)');
        } else if (kind === 'call' && !(constant.exported && isPrimitive(exports[constant.name]))) {
          bad.push(at + ' is made by a call that returns neither deepFreeze(...) nor a typed array');
        }
      }
    }
    assert.deepEqual(bad, [], 'make these frozen data or tables, or list them in MODULE_STATE and DESIGN.md §4');
  });

  it('rule 1: every name of MODULE_STATE is a top-level const of its file', () => {
    for (const [file, names] of Object.entries(MODULE_STATE)) {
      const source = CORE.find((candidate) => candidate.file === file);
      assert.ok(source, file);
      const consts = topLevelConsts(source).map((constant) => constant.name);
      for (const name of Object.keys(names)) assert.ok(consts.indexOf(name) !== -1, file + ' ' + name);
    }
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

  it('the exec-loop regexes of the typing fixes carry nothing from one call to the next', () => {
    // Each function runs on a fuzz string, then at once on a probe whose match is at index 0: a lastIndex left past
    // 0 by the first call would skip that match. The pieces put a match the loop may pass over (four after a digit,
    // zero inside a number) before the end of the string, where an early exit would leave lastIndex.
    const pieces = ['\u1041\u1044\u1004\u103A\u1038', '\u1040\u1041', '\u1041\u1040', '\u102D\u102E', '\u1040\u102C',
      '\u101D\u1041', '\u1047', '\u1000', ' ', '.', '\u1004\u103A'];
    // 2.x exports its two look-alike passes only together; on each probe here the other pass changes nothing.
    const checks = [
      [fixTypos, '\u102D\u102E\u1000', oracle.typingFixes.typos],
      [readDigitsAsLetters, '\u1040\u102C', oracle.typingFixes.lookAlikes],
      [readLettersAsDigits, '\u101D\u1041', oracle.typingFixes.lookAlikes],
      [fixLookAlikes, '\u1040\u102C', oracle.typingFixes.lookAlikes],
      [fixLookAlikes, '\u101D\u1041', oracle.typingFixes.lookAlikes]
    ];
    let seed = 4711;
    for (let n = 0; n < 3000; n++) {
      let text = '';
      for (let k = (n % 6) + 1; k > 0; k--) {
        seed = (seed * 1103515245 + 12345) >>> 0;
        text += pieces[(seed >>> 16) % pieces.length];
      }
      for (const [fix, probe, expected] of checks) {
        fix(text);
        assert.equal(fix(probe), expected(probe), fix.name + ' on ' + JSON.stringify(probe) + ' after ' + text);
      }
    }
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

function isPrimitive(value) {
  return value === null || (typeof value !== 'object' && typeof value !== 'function');
}
