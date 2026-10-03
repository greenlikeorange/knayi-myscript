// No skeleton stub left (docs/next/DESIGN.md §6.2 item 5, §6.3). W0 landed every file of src/ with stubs that
// throw ERR.NOT_BUILT, so the builders could work in parallel against stable imports (D12). This lists the stubs
// still there. Until the acceptance gate, which sets AT_ACCEPTANCE_GATE in helpers.mjs, it skips and says how many
// are left; from then on it fails on any.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsedSources, walk, memberName, where } from './ast.mjs';
import { AT_ACCEPTANCE_GATE } from '../helpers.mjs';

function stubSites() {
  const sites = [];
  for (const { file, ast } of parsedSources()) {
    if (file === 'core/errors.js') continue;
    walk(ast, (node) => {
      if (memberName(node) === 'NOT_BUILT' && node.object.type === 'Identifier' && node.object.name === 'ERR') {
        sites.push(where(file, node));
      }
    });
  }
  return sites;
}

describe('skeleton stubs (DESIGN.md §6.3)', () => {
  it('none is left', { skip: !AT_ACCEPTANCE_GATE && stubSites().length + ' stubs left; binds at the gate' }, () => {
    assert.deepEqual(stubSites(), []);
  });
});
