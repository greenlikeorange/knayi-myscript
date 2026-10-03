// The frozen 2.x engine of scripts/oracle/ (docs/next/DESIGN.md §6.1, D18, D19). The module tests of test/next
// compare with these copies, so each must stay byte-identical to library/ at the reference, commit e5f6e24.
//
// Each copy is hashed as git hashes a blob, and compared with the blob id of `git rev-parse e5f6e24:library/<file>`,
// recorded below, so the check needs no git history in CI.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ORACLE, ORACLE_REFERENCE_BLOBS as REFERENCE_BLOBS } from '../helpers.mjs';

// The id git gives a file's bytes as a blob: sha1 of "blob <size>\0" and the bytes.
function gitBlobId(bytes) {
  return crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
}

describe('scripts/oracle/ (DESIGN.md D19)', () => {
  for (const [file, blob] of Object.entries(REFERENCE_BLOBS)) {
    it(file + ' is library/' + file + ' at e5f6e24, byte for byte', () => {
      assert.equal(gitBlobId(fs.readFileSync(path.join(ORACLE, file))), blob,
        'scripts/oracle/' + file + ' changed; restore it with git show e5f6e24:library/' + file);
    });
  }
});
