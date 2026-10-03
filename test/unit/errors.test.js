const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const root = path.join(__dirname, '..', '..');

// The contract matrix records the full message of an error knayi throws on purpose, and only the class of a
// TypeError the engine raises by accident, whose wording differs between runtimes and builds (decision 9b of the
// refactor plan). It tells the two apart by a string `code` on the error (CONTRIBUTING.md), so an error the library
// throws without one would be recorded by its class only, and its message could change unseen.
//
// This makes the rule hold by construction: every `throw` in library/ and main.js throws the result of a call to
// libraryError(code, message, Ctor), a helper in library/contentGate.js that sets `code`. Today the library throws
// nothing, so the helper does not exist yet; the pull request with the first throw adds it, and this test then
// checks that it sets the code. A rethrow, or an error built by hand, fails here.

function listFiles(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(file);
    return entry.name.endsWith('.js') ? [file] : [];
  });
}

function throwsOf(file) {
  const tree = acorn.parse(fs.readFileSync(path.join(root, file), 'utf8'), {
    ecmaVersion: 'latest',
    sourceType: 'script',
    locations: true
  });
  const found = [];
  (function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'ThrowStatement') found.push(node);
    for (const key of Object.keys(node)) {
      if (key !== 'loc' && node[key] && typeof node[key] === 'object') walk(node[key]);
    }
  })(tree);
  return found;
}

function isLibraryError(node) {
  if (!node || node.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee.type === 'Identifier') return callee.name === 'libraryError';
  return callee.type === 'MemberExpression' && !callee.computed && callee.property.name === 'libraryError';
}

describe('errors the library throws', () => {
  const files = listFiles('library').concat('main.js').sort();

  it('throws only what libraryError makes, so every error carries a code', () => {
    const bad = [];
    for (const file of files) {
      for (const node of throwsOf(file)) {
        if (!isLibraryError(node.argument)) bad.push(file + ':' + node.loc.start.line);
      }
    }
    assert.deepEqual(bad, [], 'throw libraryError(code, message, Ctor) from library/contentGate.js, which sets a ' +
      'string code; the contract matrix then records the message (CONTRIBUTING.md)');
  });

  it('libraryError sets a string code, once it exists', (t) => {
    const gate = require('../../library/contentGate');
    if (typeof gate.libraryError !== 'function') {
      t.skip('library/contentGate.js has no libraryError yet: the library throws nothing');
      return;
    }
    const error = gate.libraryError('KNAYI_PROBE', 'a probe message', TypeError);
    assert.ok(error instanceof TypeError);
    assert.equal(error.code, 'KNAYI_PROBE');
    assert.equal(error.message, 'a probe message');
  });
});
