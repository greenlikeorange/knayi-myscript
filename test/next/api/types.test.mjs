// src/index.d.ts, the hand-written types of the 3.0 API, against src/index.js (docs/next/DESIGN.md §11.1): it
// declares every value the module exports, and nothing else. typecheck/next/ compiles code against the types, in
// npm test.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SRC } from '../helpers.mjs';
import * as knayi from '../../../src/index.js';

// The values src/index.d.ts declares: `export declare const NAME` and `export declare function NAME`.
function declaredValues() {
  const text = fs.readFileSync(path.join(SRC, 'index.d.ts'), 'utf8');
  const names = new Set();
  for (const [, name] of text.matchAll(/^export declare (?:const|function) (\w+)/gm)) names.add(name);
  return [...names].sort();
}

describe('src/index.d.ts (DESIGN.md §11.1)', () => {
  it('declares exactly what src/index.js exports', () => {
    assert.deepEqual(declaredValues(), Object.keys(knayi).sort());
  });

  it('exports functions and the two version constants', () => {
    for (const [name, value] of Object.entries(knayi)) {
      if (name === 'VERSION') assert.equal(typeof value, 'string');
      else if (name === 'OUTPUT_VERSION') assert.ok(Number.isInteger(value) && value >= 1);
      else assert.equal(typeof value, 'function', name);
    }
  });
});
