// The OUTPUT_VERSION check of CI's Compare job (scripts/next/output-version.mjs; decision 33): a change to the 3.0
// API's output needs an OUTPUT_VERSION above that of the latest release the base descends from.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { outputVersionVerdict } from '../../scripts/next/output-version.mjs';

const CHANGED = 'syllBreak.unicode 1,332';

describe('outputVersionVerdict', () => {
  it('passes output that does not change, whatever the release', () => {
    assert.equal(outputVersionVerdict('', 2, 2, null).ok, true);
    assert.equal(outputVersionVerdict('', 2, 3, { tag: 'v3.0.0', version: 2 }).ok, true);
  });

  it('asks a change after a release to raise OUTPUT_VERSION above the release\'s', () => {
    const verdict = outputVersionVerdict(CHANGED, 2, 2, { tag: 'v3.0.0', version: 2 });
    assert.equal(verdict.ok, false);
    assert.match(verdict.message, /OUTPUT_VERSION is 2, as in v3\.0\.0: raise it in src\/version\.js/);
    assert.equal(outputVersionVerdict(CHANGED, 2, 3, { tag: 'v3.0.0', version: 2 }).ok, true);
  });

  it('lets changes before the next release share the number the first of them raised', () => {
    assert.equal(outputVersionVerdict(CHANGED, 3, 3, { tag: 'v3.0.0', version: 2 }).ok, true);
    // Before 3.0.0, the last release is 2.x, whose output is 1: 3.0's own changes keep 2.
    assert.equal(outputVersionVerdict(CHANGED, 2, 2, { tag: 'v2.9.1', version: 1 }).ok, true);
  });

  it('asks for a raise over the base itself when the history has no release tag', () => {
    assert.equal(outputVersionVerdict(CHANGED, 2, 2, null).ok, false);
    assert.equal(outputVersionVerdict(CHANGED, 2, 3, null).ok, true);
  });

  it('never lets OUTPUT_VERSION go down', () => {
    assert.equal(outputVersionVerdict('', 3, 2, null).ok, false);
    assert.equal(outputVersionVerdict(CHANGED, 3, 2, { tag: 'v2.9.1', version: 1 }).ok, false);
  });
});
