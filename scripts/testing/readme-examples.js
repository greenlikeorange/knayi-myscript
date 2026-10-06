// Reads the examples in README.md, or in another Markdown file such as ARCHITECTURE.md. An example is any line of
// a fenced block tagged js, javascript, mjs, cjs, ts or typescript that contains `knayi.` and is not an import or a
// require. It starts with `knayi.`, or with an array literal mapped through a call, as in
// `['a', 'b'].map(knayi.normalize)`, after any indentation and an optional `console.log(` around it; a line with
// `knayi.` in any other form is an error, "unrecognised example", so no example is skipped for its notation.
//
// An example is the call (over several lines if its parentheses close later), the expected value from the comment
// after it (on the line where the call ends, or alone on the next line), and a note in parentheses after the
// value, such as "(no target font; warns)". test/readme.test.js runs them against main.js and pins how many each
// file has; scripts/browser/examples.js runs the same calls in the builds.

const fs = require('fs');
const path = require('path');

const README = path.join(__dirname, '..', '..', 'README.md');
const JS_FENCES = ['js', 'javascript', 'mjs', 'cjs', 'ts', 'typescript'];

function splitComment(comment) {
  let note = null;
  const expected = comment.replace(/\s+\(([^()]*)\)\s*$/, (all, text) => {
    note = text;
    return '';
  });
  return { expected: expected, note: note };
}

// One past the parenthesis that closes the first call in `code`, or -1 when it is not closed yet. Parentheses
// inside string literals do not count.
function callEnd(code) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '\'' || c === '"' || c === '`') {
      quote = c;
    } else if (c === '(') {
      depth++;
    } else if (c === ')') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function readExamples(text, file) {
  const name = file || 'README.md';
  const lines = (text === undefined ? fs.readFileSync(README, 'utf8') : text).split('\n');
  const examples = [];
  let fence = null; // the tag of the open fence, or null outside a fence
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    const marker = /^\s*```\s*([\w-]*)/.exec(line);
    if (marker) {
      fence = fence === null ? marker[1].toLowerCase() : null;
      continue;
    }
    if (fence === null || JS_FENCES.indexOf(fence) === -1 || line.indexOf('knayi.') === -1) continue;
    const where = name + ':' + (n + 1);
    let code = line.trim();
    if (/^import\b/.test(code) || /^(const|let|var)\s+[\w{},\s]+=\s*require\(/.test(code)) continue;
    const wrapped = /^console\.log\(/.test(code);
    if (wrapped) code = code.slice('console.log('.length);
    // An array literal with .map( after it is one call, the map, which ends where its parentheses close.
    const mapped = /^\[[^\]]*\]\.map\(/.test(code);
    if (!mapped && !/^knayi\./.test(code)) throw new Error('unrecognised example at ' + where + ': ' + line.trim());

    // A property such as knayi.version has no call; otherwise the call ends where its parentheses close.
    let last = n;
    let end;
    const property = /^knayi\.[\w.]+(?=\s*(\/\/|\)|$))/.exec(code);
    if (property && code[property[0].length] !== '(') {
      end = property[0].length;
    } else {
      while ((end = callEnd(code)) === -1 && last + 1 < lines.length) code += '\n' + lines[++last];
      if (end === -1) throw new Error('unrecognised example at ' + where + ': the call never closes');
    }
    let rest = code.slice(end);
    code = code.slice(0, end);
    if (wrapped) {
      if (!/^\s*\)/.test(rest)) throw new Error('unrecognised example at ' + where + ': console.log( is not closed');
      rest = rest.replace(/^\s*\)/, '');
    }
    rest = rest.replace(/^\s*;?/, '');
    let comment = null;
    if (/^\/\//.test(rest)) {
      comment = rest.replace(/^\/\/\s*/, '');
    } else if (rest.trim() !== '') {
      throw new Error('unrecognised example at ' + where + ': ' + rest.trim());
    } else {
      const next = /^\s*\/\/\s*(.*)$/.exec(lines[last + 1] || '');
      if (next) {
        comment = next[1];
        last++;
      }
    }
    const value = comment === null ? { expected: null, note: null } : splitComment(comment);
    examples.push(Object.assign({ file: name, line: n + 1, code: code }, value));
    n = last;
  }
  return examples;
}

module.exports = { README: README, readExamples: readExamples };
