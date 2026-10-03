const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { loadWithInternals } = require('../../scripts/testing/internals');

// V8 finds the first character of a plain literal regex (one with no class, group, alternative, anchor,
// quantifier, dot or class escape) by the higher of its two bytes, and so it finds an indexOf, includes, split or
// replace needle. From U+1000 to U+1010 that byte is 0x10, which every Myanmar character has, so on Myanmar text
// the search stops at every character. On the Wikipedia sample, counting /\u1004\u103a/g takes about 7 times as
// long as counting /[\u1004]\u103a/g, and /\u100d\u1039\u100e/g, which never matches there, about 50 times. So the
// library puts the first character of such a pattern in a class of one, which V8 runs as a regex; a Unicode to
// Zawgyi rule keeps the source it had before as its label, which debugging output logs (library/syllableRules.js).
//
// The range is exactly U+1000-U+1010, and must not widen: from U+1011 the low byte is the higher one, V8 finds the
// literal quickly, and a class of one is slower (about 5 times as long at U+1011, 1.6 times at U+1014).
// JavaScriptCore (Bun) runs every class of one slower than the literal, 1.25 to 10 times as long on the same text,
// so fontDetect takes about 10% longer per line under Bun, and up to about 25% longer on one long string or document
// (npm run perf against the commit before the change). The refactor plan accepts a cost on Bun (decision 29), with
// an allowance of 15% for fontDetect, which one long string or document goes past; the cost lasts until a scanner
// replaces the detector regexes.
//
// This checks both directions: no regex the library holds or builds, and no needle it searches for, starts with a
// character from U+1000 to U+1010 as a plain literal; and no otherwise plain literal starts with a class of one
// around a character outside that range.

const ROOT = path.join(__dirname, '..', '..');
const LIBRARY = path.join(ROOT, 'library') + path.sep;
const MAIN = path.join(ROOT, 'main.js');
const SLOW = [0x1000, 0x1010];

function isSlowFirst(text) {
  const code = text.charCodeAt(0);
  return code >= SLOW[0] && code <= SLOW[1];
}

function hex4(code) {
  return ('000' + code.toString(16).toUpperCase()).slice(-4);
}

function codePoint(text) {
  return 'U+' + hex4(text.charCodeAt(0));
}

// Non-ASCII characters as escapes, so that messages read the same in any terminal.
function printable(text) {
  return text.replace(/[^\x20-\x7e]/g, (ch) => '\\u' + hex4(ch.charCodeAt(0)));
}

// The text a regex pattern matches when it is a plain literal: characters, and escapes of one character each.
// null when the pattern has any other syntax (a class, group, alternative, anchor, quantifier, dot, \d, \s, \w,
// \b, a back reference, \0, \c or \u{...}).
const ESCAPED = { t: '\t', n: '\n', v: '\v', f: '\f', r: '\r' };
function plainLiteral(pattern) {
  let text = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch !== '\\') {
      if ('^$.*+?()[]{}|'.indexOf(ch) !== -1) return null;
      text += ch;
      continue;
    }
    const rest = pattern.slice(i + 1);
    const hex = /^u([0-9a-fA-F]{4})|^x([0-9a-fA-F]{2})/.exec(rest);
    if (hex) {
      text += String.fromCharCode(parseInt(hex[1] || hex[2], 16));
      i += hex[0].length;
    } else if (ESCAPED[rest[0]]) {
      text += ESCAPED[rest[0]];
      i += 1;
    } else if (rest[0] && '^$\\.*+?()[]{}|/-'.indexOf(rest[0]) !== -1) {
      text += rest[0];
      i += 1;
    } else {
      return null;
    }
  }
  return text;
}

// The character in a class of one at the start of a pattern whose rest is a plain literal, as in
// [\u1004]\u103a\u1039, or null.
function classOfOneFirst(pattern) {
  const head = /^\[(\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}|[^\\\]^-])\]/.exec(pattern);
  if (!head || plainLiteral(pattern.slice(head[0].length)) === null) return null;
  return plainLiteral(head[1]);
}

// What V8 would search for slowly, or needlessly slowly, in a regex pattern; null when nothing.
function patternProblem(pattern) {
  const text = plainLiteral(pattern);
  if (text && isSlowFirst(text)) {
    return 'a plain literal starting at ' + codePoint(text) + ': put its first character in a class of one';
  }
  const first = classOfOneFirst(pattern);
  if (first && !isSlowFirst(first)) {
    return 'a class of one around ' + codePoint(first) + ', outside U+1000-U+1010: the plain literal is faster';
  }
  return null;
}

function needleProblem(needle) {
  return needle && isSlowFirst(needle) ? 'a needle starting at ' + codePoint(needle) : null;
}

const NEEDLE_METHODS = ['indexOf', 'lastIndexOf', 'includes', 'split', 'replace', 'replaceAll'];
const PATTERN_METHODS = ['match', 'matchAll', 'search']; // they turn a string into a RegExp

function problemOf(method, value) {
  return PATTERN_METHODS.indexOf(method) !== -1 ? patternProblem(value) : needleProblem(value);
}

// ---- The source: regex literals, and constant patterns and needles at their call sites.

function sourceFiles() {
  return fs.readdirSync(LIBRARY).filter((name) => name.endsWith('.js')).sort()
    .map((name) => 'library/' + name).concat('main.js');
}

function walk(node, visit) {
  if (Array.isArray(node)) return node.forEach((child) => walk(child, visit));
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key !== 'loc' && node[key] && typeof node[key] === 'object') walk(node[key], visit);
  }
}

// The string an expression always has: a string literal, a template with no substitutions, a top-level const that
// holds one, or a + of them. undefined for anything else.
function constantString(node, consts) {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  if (node.type === 'Identifier') return consts.get(node.name);
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const left = constantString(node.left, consts);
    const right = constantString(node.right, consts);
    return left === undefined || right === undefined ? undefined : left + right;
  }
  return undefined;
}

function scanSource(file) {
  const tree = acorn.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
    ecmaVersion: 'latest',
    sourceType: 'script',
    locations: true
  });
  const consts = new Map();
  for (const statement of tree.body) {
    if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const') continue;
    for (const declaration of statement.declarations) {
      if (declaration.id.type !== 'Identifier' || !declaration.init) continue;
      const value = constantString(declaration.init, consts);
      if (value !== undefined) consts.set(declaration.id.name, value);
    }
  }
  const found = { literals: 0, calls: 0, problems: [] };
  walk(tree, (node) => {
    const site = file + ':' + node.loc.start.line;
    if (node.type === 'Literal' && node.regex) {
      found.literals++;
      const problem = patternProblem(node.regex.pattern);
      if (problem) found.problems.push(site + ' /' + printable(node.regex.pattern) + '/: ' + problem);
      return;
    }
    if (node.type !== 'CallExpression' && node.type !== 'NewExpression') return;
    const callee = node.callee;
    let method = null;
    if (callee.type === 'Identifier' && callee.name === 'RegExp') method = 'match';
    else if (callee.type === 'MemberExpression' && !callee.computed) method = callee.property.name;
    if (NEEDLE_METHODS.indexOf(method) === -1 && PATTERN_METHODS.indexOf(method) === -1) return;
    const value = node.arguments.length ? constantString(node.arguments[0], consts) : undefined;
    if (value === undefined) return;
    found.calls++;
    const problem = problemOf(method, value);
    if (problem) found.problems.push(site + ' ' + method + '(' + printable(JSON.stringify(value)) + '): ' + problem);
  });
  return found;
}

// ---- A run of the call forms: every RegExp built from a string, and every string needle searched for.

const run = { built: [], needles: 0, problems: [] };
{
  const examples = require('../../scripts/browser/examples');
  const calls = examples.allCalls();

  function librarySite() {
    const prepare = Error.prepareStackTrace;
    Error.prepareStackTrace = (error, frames) => frames;
    const frames = new Error().stack;
    Error.prepareStackTrace = prepare;
    for (const frame of frames) {
      const file = frame.getFileName();
      if (file && (file.startsWith(LIBRARY) || file === MAIN)) {
        return file.slice(ROOT.length + 1).split(path.sep).join('/') + ':' + frame.getLineNumber();
      }
    }
    return null;
  }

  let busy = false;
  // A needle is checked at every call, and its site read only when it starts in the range, so that the run stays
  // fast; other needles are counted once each.
  const seen = new Set();
  function noteNeedle(method, needle) {
    if (busy || typeof needle !== 'string' || needle === '') return;
    busy = true;
    try {
      const problem = problemOf(method, needle);
      if (problem || !seen.has(method + needle)) {
        const site = librarySite();
        if (!site) return;
        seen.add(method + needle);
        run.needles++;
        if (problem) {
          run.problems.push(site + ' .' + method + '(' + printable(JSON.stringify(needle)) + '): ' + problem);
        }
      }
    } finally {
      busy = false;
    }
  }
  function noteBuilt(pattern) {
    if (busy || typeof pattern !== 'string') return;
    busy = true;
    try {
      const site = librarySite();
      if (!site) return;
      run.built.push(site);
      const problem = patternProblem(pattern);
      if (problem) run.problems.push(site + ' RegExp(' + printable(JSON.stringify(pattern)) + '): ' + problem);
    } finally {
      busy = false;
    }
  }

  // `bun test` runs every test file in one process with one module cache, so this loads its own copy of the
  // library, and puts the cached modules back afterwards (as test/regex-floor.test.js does).
  const cached = {};
  for (const id of Object.keys(require.cache)) {
    if (id === MAIN || id.startsWith(LIBRARY)) {
      cached[id] = require.cache[id];
      delete require.cache[id];
    }
  }
  const NativeRegExp = RegExp;
  const natives = {};
  global.RegExp = new Proxy(NativeRegExp, {
    construct(target, args, newTarget) {
      noteBuilt(args[0]);
      return Reflect.construct(target, args, newTarget === global.RegExp ? target : newTarget);
    },
    apply(target, thisArg, args) {
      noteBuilt(args[0]);
      return Reflect.apply(target, thisArg, args);
    }
  });
  for (const method of NEEDLE_METHODS.concat(PATTERN_METHODS)) {
    const original = String.prototype[method];
    natives[method] = original;
    Object.defineProperty(String.prototype, method, {
      configurable: true,
      writable: true,
      value: function (needle) {
        noteNeedle(method, needle);
        return original.apply(this, arguments);
      }
    });
  }
  try {
    examples.runCalls(require('../../main'), calls);
  } finally {
    global.RegExp = NativeRegExp;
    for (const method of Object.keys(natives)) {
      Object.defineProperty(String.prototype, method, { configurable: true, writable: true, value: natives[method] });
    }
    for (const id of Object.keys(require.cache)) {
      if (id === MAIN || id.startsWith(LIBRARY)) delete require.cache[id];
    }
    Object.assign(require.cache, cached);
  }
}

describe('literal searches V8 runs slowly on Myanmar text', () => {
  it('reads the range exactly, U+1000 to U+1010', () => {
    assert.match(patternProblem('\u1000\u103a'), /plain literal starting at U\+1000/);
    assert.match(patternProblem('\\u1010\\u103a'), /plain literal starting at U\+1010/);
    assert.match(patternProblem('\u1004'), /plain literal/);
    assert.equal(patternProblem('\u1011\u103a'), null);
    assert.equal(patternProblem('\u0fff\u103a'), null);
    assert.equal(patternProblem('[\u1004]\u103a'), null);
    assert.equal(patternProblem('[\\u1004]\\u103a\\u1039'), null);
    assert.match(patternProblem('[\u1014]\u103a'), /class of one around U\+1014/);
    assert.match(patternProblem('[\\u1011]\\u103a'), /class of one around U\+1011/);
    assert.equal(patternProblem('[\u1000-\u1021]\u103a'), null);
    assert.equal(patternProblem('[\u1004\u1005]\u103a'), null);
    assert.equal(patternProblem('\u1004\u103a|x'), null);
    assert.equal(patternProblem('\u1004(\u103a)'), null);
    assert.equal(patternProblem('^\u1004\u103a'), null);
    assert.equal(patternProblem('[\u102b]{2,}'), null);
    assert.match(needleProblem('\u1010x'), /needle starting at U\+1010/);
    assert.equal(needleProblem('\u1011'), null);
    assert.equal(needleProblem(''), null);
  });

  it('finds no regex literal or constant pattern or needle in library/ that starts there', (t) => {
    const all = sourceFiles().map(scanSource);
    const literals = all.reduce((n, found) => n + found.literals, 0);
    const calls = all.reduce((n, found) => n + found.calls, 0);
    t.diagnostic(literals + ' regex literals, ' + calls + ' calls with a constant pattern or needle');
    assert.ok(literals > 100, 'the scan found ' + literals + ' regex literals');
    const problems = [].concat(...all.map((found) => found.problems));
    assert.deepEqual(problems, [], problems.join('\n'));
  });

  it('builds no RegExp and searches for no needle that starts there while the call forms run', (t) => {
    t.diagnostic(run.built.length + ' RegExps built from strings, ' + run.needles + ' distinct string needles');
    assert.ok(run.built.some((site) => site.startsWith('library/detector.js:')), 'the detector signatures were seen');
    assert.ok(run.needles > 0, 'no string needle was seen');
    assert.deepEqual(run.problems, [], run.problems.join('\n'));
  });

  it('logs each wrapped Unicode to Zawgyi rule by the source it had before', () => {
    const rules = loadWithInternals('syllableRules.js', ['convertRules']).__internals.convertRules.unicode.zawgyi;
    const labelled = rules.oneTime.concat(rules.asLongAsMatch).filter((rule) => rule.length > 2);
    assert.ok(labelled.length > 0);
    for (const rule of labelled) {
      const label = rule[2];
      assert.equal(typeof label, 'string');
      // The label is a plain literal that starts in the range, and the pattern is that literal with its first
      // character in a class of one: the same matches, and the same text in debugging output as before.
      assert.ok(plainLiteral(label) && isSlowFirst(plainLiteral(label)), label + ' needs no label');
      assert.equal(rule[0].source, label.replace(/^(\\u[0-9a-fA-F]{4})/, '[$1]'));
    }
  });
});
