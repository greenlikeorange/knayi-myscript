// Stage lists (docs/next/DESIGN.md §2.3, D10): every exported *_STAGES list of src/stages/ has well-formed stages
// whose ids are unique within the list, since the 3.0 trace reads records by id (decision 8). The check passes on
// the skeleton's empty lists, and binds as soon as a list is filled.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SRC, srcFiles } from '../helpers.mjs';

const STAGE_FILES = srcFiles().filter((file) => file.startsWith('stages/'));

async function stageLists() {
  const lists = [];
  for (const file of STAGE_FILES) {
    const module = await import(pathToFileURL(path.join(SRC, file)).href);
    for (const [name, value] of Object.entries(module)) {
      if (name.endsWith('_STAGES')) lists.push({ name: file + ' ' + name, stages: value });
    }
  }
  return lists;
}

describe('stage lists of src/stages/ (DESIGN.md §2.3)', () => {
  it('finds NORMALIZE_STAGES, STABLE_NORMALIZE_STAGES and FONT_STAGES', async () => {
    const names = (await stageLists()).map((list) => list.name.split(' ')[1]).sort();
    assert.deepEqual(names, ['FONT_STAGES', 'NORMALIZE_STAGES', 'STABLE_NORMALIZE_STAGES']);
  });

  it('each stage has an id, a label and run, and its optional fields have their types', async () => {
    for (const { name, stages } of await stageLists()) {
      assert.ok(Array.isArray(stages) && Object.isFrozen(stages), name + ' is a frozen array');
      stages.forEach((stage, i) => {
        const at = name + '[' + i + ']';
        assert.equal(typeof stage.id, 'string', at + '.id');
        assert.equal(typeof stage.label, 'string', at + '.label');
        assert.equal(typeof stage.run, 'function', at + '.run');
        assert.ok(stage.traceOnly === undefined || stage.traceOnly === true, at + '.traceOnly');
        assert.ok(stage.gate === undefined || typeof stage.gate === 'function', at + '.gate');
      });
    }
  });

  it('stage ids are unique within each list', async () => {
    for (const { name, stages } of await stageLists()) {
      const ids = stages.map((stage) => stage.id);
      const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
      assert.deepEqual(repeated, [], name + ' repeats stage ids');
    }
  });
});
