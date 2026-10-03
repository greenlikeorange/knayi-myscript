const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { FILES, SOURCE_TYPES, builtDist } = require('../scripts/build');

// Browsers can't parse a file that uses syntax newer than they support, so one newer construct in a build
// breaks it everywhere older. Every build stays ES2015 (issue #66; decision 18).
describe('build syntax', () => {
  for (const file of FILES) {
    it(file + ' parses as ES2015', () => {
      const code = fs.readFileSync(path.join(builtDist(), file), 'utf8');
      assert.doesNotThrow(() => acorn.parse(code, { ecmaVersion: 2015, sourceType: SOURCE_TYPES[file] }));
    });
  }
});
