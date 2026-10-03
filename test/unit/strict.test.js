const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { builtDist } = require('../../scripts/build');

const root = path.join(__dirname, '..', '..');

// Every file in library/ is strict code: it starts with the directive 'use strict', so a slip such as an assignment
// to an undeclared name throws instead of making a global, and a function called on its own gets no global object
// as `this`. main.js has no directive. esbuild moves the entry's directive to the top of the script builds, and
// there it would also make strict any code that a site or a build tool concatenates after the file; each library
// module keeps its own directive inside its wrapper function, where it covers that module only.

function directives(source, sourceType) {
  const tree = acorn.parse(source, { ecmaVersion: 'latest', sourceType: sourceType || 'script' });
  const found = [];
  for (const node of tree.body) {
    if (node.type !== 'ExpressionStatement' || typeof node.directive !== 'string') break;
    found.push(node.directive);
  }
  return found;
}

describe('strict code', () => {
  const files = fs.readdirSync(path.join(root, 'library')).filter((name) => name.endsWith('.js')).sort();

  it('starts every file in library/ with the directive \'use strict\'', () => {
    const missing = files.filter((name) => {
      const source = fs.readFileSync(path.join(root, 'library', name), 'utf8');
      return directives(source).indexOf('use strict') === -1;
    });
    assert.ok(files.length > 0, 'no files found in library/');
    assert.deepEqual(missing, [], 'start each of these files with \'use strict\';');
  });

  it('leaves main.js and the top level of the script builds sloppy', () => {
    assert.deepEqual(directives(fs.readFileSync(path.join(root, 'main.js'), 'utf8')), [],
      'main.js has no directive: esbuild would move it to the top of the script builds');
    for (const name of ['knayi-myscript.js', 'knayi-myscript.min.js']) {
      const source = fs.readFileSync(path.join(builtDist(), name), 'utf8');
      assert.deepEqual(directives(source), [], name + ' starts with a directive');
      assert.ok(source.indexOf('"use strict";') !== -1, name + ' has no strict module in it');
    }
  });
});
