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
import { ORACLE } from '../helpers.mjs';

// git rev-parse e5f6e24fa756f8f9c8d790f9a15ede85b135e8ae:library/<file>
const REFERENCE_BLOBS = {
  'contentGate.js': '814c5788446495b22daf70de8231a45802de0efb',
  'storageOrder.js': 'b53e22e200e5296ad582e6c875a5d04a4e8019a2',
  'syllable.js': '3148df4efdf99317630b89684ed53205dacb2a1e',
  'typingFixes.js': 'acf4f9e8e923933c2852082a362a1f7113a17ff2',
  'win.js': '145c84c6d2bb78b25cdb378c37bbbe027797b84a',
  'zawgyi.js': '3fbf65d78fa10373aee9a92ff4ef47b6ecd2ad7b'
};

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
