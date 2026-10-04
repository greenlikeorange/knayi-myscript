// src/index.d.ts and src/stream.d.ts, the hand-written types of the 3.0 API and its streams, against src/index.js
// and src/stream.js (docs/next/DESIGN.md §11.1, §12): each declares every value its module exports, and nothing
// else. typecheck/next/ compiles code against the types, in npm test.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SRC } from '../helpers.mjs';
import * as knayi from '../../../src/index.js';
import * as streams from '../../../src/stream.js';

// The values a declaration file declares: `export declare const NAME` and `export declare function NAME`.
function declaredValues(file) {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8');
  const names = new Set();
  for (const [, name] of text.matchAll(/^export declare (?:const|function) (\w+)/gm)) names.add(name);
  return [...names].sort();
}

describe('src/index.d.ts (DESIGN.md §11.1)', () => {
  it('declares exactly what src/index.js exports', () => {
    assert.deepEqual(declaredValues('index.d.ts'), Object.keys(knayi).sort());
  });

  it('exports functions and the two version constants', () => {
    for (const [name, value] of Object.entries(knayi)) {
      if (name === 'VERSION') assert.equal(typeof value, 'string');
      else if (name === 'OUTPUT_VERSION') assert.ok(Number.isInteger(value) && value >= 1);
      else assert.equal(typeof value, 'function', name);
    }
  });
});

describe('src/stream.d.ts (DESIGN.md §12)', () => {
  it('declares exactly what src/stream.js exports, all of them functions', () => {
    assert.deepEqual(declaredValues('stream.d.ts'), Object.keys(streams).sort());
    for (const [name, value] of Object.entries(streams)) assert.equal(typeof value, 'function', name);
  });
});
