// Reads the examples in README.md: every line in a ```javascript block that starts with `knayi.`. An example is
// the call, the expected value from the comment after it (on the same line, or alone on the next line), and a
// note in parentheses after the value, such as "(no target font; warns)". A call written over several lines
// with no comment has no expected value. test/readme.test.js runs them against main.js.

const fs = require('fs');
const path = require('path');

const README = path.join(__dirname, '..', '..', 'README.md');

function balanced(code) {
  let depth = 0;
  for (const c of code) {
    if (c === '(') depth++;
    if (c === ')') depth--;
  }
  return depth === 0;
}

function splitComment(comment) {
  let note = null;
  const expected = comment.replace(/\s*\(([^)]*)\)\s*$/, (all, text) => {
    note = text;
    return '';
  });
  return { expected: expected, note: note };
}

function readExamples(text) {
  const lines = (text === undefined ? fs.readFileSync(README, 'utf8') : text).split('\n');
  const examples = [];
  let inJs = false;
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    if (/^```javascript\s*$/.test(line)) { inJs = true; continue; }
    if (/^```/.test(line)) { inJs = false; continue; }
    if (!inJs || !/^knayi\./.test(line)) continue;
    const inline = line.match(/^(knayi\..*?)\s*\/\/\s*(.*)$/);
    if (inline) {
      examples.push(Object.assign({ line: n + 1, code: inline[1] }, splitComment(inline[2])));
      continue;
    }
    const next = (lines[n + 1] || '').match(/^\/\/\s*(.*)$/);
    if (next) {
      examples.push(Object.assign({ line: n + 1, code: line }, splitComment(next[1])));
      n++;
      continue;
    }
    let code = line;
    let last = n;
    while (!balanced(code) && last + 1 < lines.length) code += '\n' + lines[++last];
    examples.push({ line: n + 1, code: code, expected: null, note: null });
    n = last;
  }
  return examples;
}

// The number of lines in ```javascript blocks that start with `knayi.`, to check that every one was read.
function countCallLines(text) {
  let inJs = false;
  let count = 0;
  for (const line of (text === undefined ? fs.readFileSync(README, 'utf8') : text).split('\n')) {
    if (/^```javascript\s*$/.test(line)) { inJs = true; continue; }
    if (/^```/.test(line)) { inJs = false; continue; }
    if (inJs && /^knayi\./.test(line)) count++;
  }
  return count;
}

module.exports = { README: README, readExamples: readExamples, countCallLines: countCallLines };
