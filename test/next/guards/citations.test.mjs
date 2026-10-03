// What the comments of src/ cite (docs/next/DESIGN.md §1.2 rule 3). A reader of the code must be able to follow
// every citation inside the repository:
// - no citation of the refactor plan or of its evidence folder (SCR/), which DESIGN.md says are kept outside the
//   repository: a kept 2.x bug is cited by its row of DESIGN.md §10, and a measurement by its number and the test
//   that pins it;
// - every plan decision the code names (decision 34) is a row of DESIGN.md §1.3, and every quirk (DESIGN.md §10
//   Q11) a row of §10.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, srcFiles, srcText } from '../helpers.mjs';

const DESIGN = fs.readFileSync(path.join(ROOT, 'docs', 'next', 'DESIGN.md'), 'utf8');

// The text of a section of DESIGN.md, from its heading to the next heading of the same level.
function designSection(heading) {
  const start = DESIGN.indexOf(heading);
  assert.ok(start !== -1, 'DESIGN.md has ' + heading);
  const level = heading.slice(0, heading.indexOf(' ') + 1);
  const next = DESIGN.indexOf('\n' + level, start + heading.length);
  return DESIGN.slice(start, next === -1 ? DESIGN.length : next);
}

// The first cell of each row of the markdown tables in a section: '| 34 | ...' gives '34'.
function firstCells(section) {
  const cells = new Set();
  for (const [, cell] of section.matchAll(/^\| ([^|]+?) \|/gm)) cells.add(cell);
  return cells;
}

// Every match of re in the files of src/, as 'src/<file>:<line>: <match>'.
function citations(re) {
  const found = [];
  for (const file of srcFiles()) {
    srcText(file).split('\n').forEach((line, i) => {
      for (const match of line.matchAll(re)) found.push({ at: 'src/' + file + ':' + (i + 1), match });
    });
  }
  return found;
}

describe('the citations of src/ (DESIGN.md §1.2 rule 3)', () => {
  it('cite neither the refactor plan nor its evidence folder, which are outside the repository', () => {
    const outside = citations(/refactor plan|of the plan|\bplan (?:§|Phase|PR|decision)|\bSCR\//g);
    assert.deepEqual(outside.map(({ at, match }) => at + ': ' + match[0]), [],
      'cite DESIGN.md (§10 for a kept 2.x bug), UTN #11 or a research note, or give the number and its test');
  });

  it('name only the plan decisions that DESIGN.md §1.3 lists', () => {
    const listed = firstCells(designSection('### 1.3 '));
    const unknown = citations(/\bdecisions? (\d+)/g).filter(({ match }) => !listed.has(match[1]));
    assert.deepEqual(unknown.map(({ at, match }) => at + ': ' + match[0]), []);
  });

  it('name only the quirks that DESIGN.md §10 lists', () => {
    const listed = firstCells(designSection('## 10. '));
    const quirks = citations(/§10 (Q\d+)/g);
    assert.ok(quirks.length > 0, 'the code cites §10');
    const unknown = quirks.filter(({ match }) => !listed.has(match[1]));
    assert.deepEqual(unknown.map(({ at, match }) => at + ': ' + match[0]), []);
  });
});
