// The frozen 2.x library of scripts/oracle/ (docs/next/DESIGN.md §6.1, D18, D19). The module tests of test/next
// compare with these copies, so each must stay byte-identical to library/ at commit e5f6e24 (2.10.0's code, the 2.x
// reference the core was built against), and scripts/oracle/main.js to that commit's main.js but for its header and
// paths. compat's tests compare with the 2.x reference of scripts/reference/ instead (guards/reference.test.mjs).
//
// Each copy is hashed as git hashes a blob, and compared with the blob id of `git rev-parse e5f6e24:library/<file>`
// (or `e5f6e24:main.js`), recorded in test/next/helpers.mjs, so the check needs no git history in CI.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ORACLE, ORACLE_REFERENCE_BLOBS as REFERENCE_BLOBS, ORACLE_MAIN_BLOB } from '../helpers.mjs';

// The id git gives a file's bytes as a blob: sha1 of "blob <size>\0" and the bytes.
function gitBlobId(bytes) {
  return crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
}

// scripts/oracle/main.js as the reference wrote it: without the comment lines and the blank line that open it, and
// with each require of a sibling copy pointed back at library/.
function asReferenceMain(text) {
  const body = text.replace(/^(\/\/[^\n]*\n)+\n/, '');
  return body.replace(/require\('\.\/(\w+)'\)/g, "require('./library/$1')");
}

describe('scripts/oracle/ (DESIGN.md D19)', () => {
  for (const [file, blob] of Object.entries(REFERENCE_BLOBS)) {
    it(file + ' is library/' + file + ' at e5f6e24, byte for byte', () => {
      assert.equal(gitBlobId(fs.readFileSync(path.join(ORACLE, file))), blob,
        'scripts/oracle/' + file + ' changed; restore it with git show e5f6e24:library/' + file);
    });
  }

  it('main.js is main.js at e5f6e24, with its header and its requires of the copies next to it', () => {
    const text = fs.readFileSync(path.join(ORACLE, 'main.js'), 'utf8');
    assert.equal(gitBlobId(Buffer.from(asReferenceMain(text))), ORACLE_MAIN_BLOB,
      'scripts/oracle/main.js changed; it is git show e5f6e24:main.js with ./library/ made ./, under a header');
  });
});
