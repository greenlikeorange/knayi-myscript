const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const knayi = require('../main');
const { readExamples } = require('../scripts/testing/readme-examples');

// Every `knayi.…` example in README.md and ARCHITECTURE.md runs against main.js, and returns the value in its
// comment. An example whose note says it warns must write a warning or an error to the console.
//
// The number of examples in each file is pinned, so an example the reader stops seeing fails here. When you add or
// remove an example, change its count.
const FILES = { 'README.md': 51, 'ARCHITECTURE.md': 11 };

// Runs fn with console.warn and console.error recorded instead of printed.
function capture(fn) {
  const messages = [];
  const warn = console.warn;
  const error = console.error;
  console.warn = (...args) => messages.push('warn: ' + args.join(' '));
  console.error = (...args) => messages.push('error: ' + args.join(' '));
  try {
    return { value: fn(), messages: messages };
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

for (const [file, count] of Object.entries(FILES)) {
  describe(file + ' examples', () => {
    const examples = readExamples(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), file);

    it('reads every example', (t) => {
      assert.equal(examples.length, count, file + ' has ' + examples.length + ' examples; if you added or removed one, ' +
        'change its count in test/readme.test.js');
      t.diagnostic(examples.length + ' examples');
    });

    for (const example of examples) {
      it(file + ':' + example.line + ' ' + example.code.replace(/\s+/g, ' '), () => {
        assert.notEqual(example.expected, null, 'add the value this call returns to ' + file + ', as a comment after it');
        const run = capture(() => new Function('knayi', 'return (' + example.code + ');')(knayi));
        const expected = new Function('return (' + example.expected + ');')();
        assert.deepEqual(run.value, expected);
        if (example.note && /\bwarns\b/.test(example.note)) {
          assert.ok(run.messages.length > 0, 'the documentation says this call warns');
        }
      });
    }
  });
}

// README.md also gives examples in its prose, as "`input` is output" with Myanmar output. Each runs through the
// call of the section it is in; one in another section fails until it gets a call here.
const PROSE_CALLS = {
  'Zawgyi to Unicode': (s) => knayi.fontConvert(s, 'unicode', 'zawgyi'),
  'Win fonts': (s) => knayi.fontConvert(s, 'unicode', 'win'),
  'normalize(content)': (s) => knayi.normalize(s)
};
const PROSE_COUNT = 12;

function prosePairs(text) {
  const pair = new RegExp('`([^`]+)` is ([' + String.fromCharCode(0x1000) + '-' + String.fromCharCode(0x109f) + ']+)', 'g');
  const pairs = [];
  let section = null;
  let inFence = false;
  text.split('\n').forEach((line, i) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    const heading = inFence ? null : /^#+\s+(.*)$/.exec(line);
    if (heading) section = heading[1].trim();
    else if (!inFence) for (const m of line.matchAll(pair)) pairs.push({ line: i + 1, section, input: m[1], output: m[2] });
  });
  return pairs;
}

describe('README.md prose examples', () => {
  const pairs = prosePairs(fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8'));

  it('reads every prose example', () => {
    assert.equal(pairs.length, PROSE_COUNT, 'README.md has ' + pairs.length + ' prose examples; if you added or removed ' +
      'one, change PROSE_COUNT in test/readme.test.js');
  });

  for (const { line, section, input, output } of pairs) {
    it('README.md:' + line + ' `' + input + '` is ' + output, () => {
      assert.ok(PROSE_CALLS[section], 'no call for the section "' + section + '"; add one to PROSE_CALLS');
      assert.equal(PROSE_CALLS[section](input), output);
    });
  }
});

describe('example reader', () => {
  const fence = (tag, body) => '```' + tag + '\n' + body + '\n```\n';

  it('reads every fence tag and notation of an example', () => {
    const text = 'Prose that names knayi.normalize is not an example.\n' +
      fence('javascript', "knayi.normalize('a') // 'a'") +
      fence('js', "  knayi.normalize('b') // 'b'") +
      fence('ts', "import knayi from 'knayi-myscript'\nconsole.log(knayi.normalize('c')) // 'c'") +
      fence('mjs', "knayi.syllBreak('d', 'unicode', '|')\n// 'd'") +
      fence('cjs', "const knayi = require('knayi-myscript');\nknayi.truncate('e', {\n  length: 4\n}) // 'e...'") +
      fence('typescript', 'knayi.version // ' + JSON.stringify(knayi.version)) +
      fence('bash', 'echo knayi.normalize');
    const examples = readExamples(text, 'probe.md');
    assert.deepEqual(examples.map((e) => [e.line, e.code, e.expected]), [
      [3, "knayi.normalize('a')", "'a'"],
      [6, "knayi.normalize('b')", "'b'"],
      [10, "knayi.normalize('c')", "'c'"],
      [13, "knayi.syllBreak('d', 'unicode', '|')", "'d'"],
      [18, "knayi.truncate('e', {\n  length: 4\n})", "'e...'"],
      [23, 'knayi.version', JSON.stringify(knayi.version)]
    ]);
  });

  it('keeps a note after the value, and parentheses inside strings out of the count', () => {
    const [example] = readExamples(fence('javascript', "knayi.fontConvert('(', 'unicode') // '('  (no change; warns)"));
    assert.deepEqual([example.code, example.expected, example.note], ["knayi.fontConvert('(', 'unicode')", "'('", 'no change; warns']);
  });

  it('rejects a line with knayi. in any other form', () => {
    for (const body of ["const x = knayi.normalize('a')", "knayi.normalize('a').length", "console.log(knayi.normalize('a')"]) {
      assert.throws(() => readExamples(fence('javascript', body), 'probe.md'), /unrecognised example at probe\.md:2/, body);
    }
  });
});
