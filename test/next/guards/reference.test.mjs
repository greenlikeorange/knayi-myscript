// The 2.x reference of scripts/reference/ (docs/next/DESIGN.md §1.1, §8): main.js and library/ of the 2.x line at
// the commit compat follows. compat's tests, the contract matrix and the table rows compare with these copies, so
// each must stay byte-identical to the commit's file, and nothing else may sit beside them.
//
// Each copy is hashed as git hashes a blob, and compared with the blob id of `git ls-tree <commit> main.js library/`,
// recorded in test/next/helpers.mjs, so the check needs no git history in CI. A port of the 2.x line that moves the
// reference copies the new commit's files and records their blob ids (DESIGN.md §8).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { REFERENCE, REFERENCE_BLOBS, REFERENCE_COMMIT } from '../helpers.mjs';

// The id git gives a file's bytes as a blob: sha1 of "blob <size>\0" and the bytes.
function gitBlobId(bytes) {
  return crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
}

// Every file under dir, as a path relative to it with '/' between its parts.
function filesUnder(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory()
    ? filesUnder(path.join(dir, entry.name), prefix + entry.name + '/')
    : [prefix + entry.name]));
}

const short = REFERENCE_COMMIT.slice(0, 7);

describe('scripts/reference/ (DESIGN.md §1.1, §8)', () => {
  for (const [file, blob] of Object.entries(REFERENCE_BLOBS)) {
    it(file + ' is ' + file + ' at ' + short + ', byte for byte', () => {
      assert.equal(gitBlobId(fs.readFileSync(path.join(REFERENCE, file))), blob,
        'scripts/reference/' + file + ' changed; restore it with git show ' + short + ':' + file);
    });
  }

  it('holds main.js and library/ of ' + short + ', and nothing else', () => {
    assert.deepEqual(filesUnder(REFERENCE).sort(), Object.keys(REFERENCE_BLOBS).sort());
  });
});
