const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { readExamples } = require('../scripts/testing/readme-examples');

// The two APIs the examples call: `knayi.…` the 3.0 API, `compat.…` the 2.x API on the 3.0 core.
const LIBRARIES = {
  knayi: require('../src/index.js'),
  compat: require('../src/compat/index.js').default
};

// Every example in README.md, MIGRATION.md and ARCHITECTURE.md runs against the API it names and returns the value in
// its comment. An example whose note says it warns must write a warning or an error to the console.
//
// The number of examples in each file is pinned, so an example the reader stops seeing fails here. When you add or
// remove an example, change its count.
const FILES = {
  'README.md': { knayi: 59, compat: 1 },
  'MIGRATION.md': { knayi: 26, compat: 54 },
  'ARCHITECTURE.md': { knayi: 0, compat: 11 }
};

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

function countByApi(examples) {
  const counts = { knayi: 0, compat: 0 };
  for (const example of examples) counts[example.api]++;
  return counts;
}

for (const [file, counts] of Object.entries(FILES)) {
  describe(file + ' examples', () => {
    const examples = readExamples(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), file);

    it('reads every example', (t) => {
      assert.deepEqual(countByApi(examples), counts, file + ' has other examples; if you added or removed one, ' +
        'change its count in test/readme.test.js');
      t.diagnostic(examples.length + ' examples');
    });

    for (const example of examples) {
      it(file + ':' + example.line + ' ' + example.code.replace(/\s+/g, ' '), () => {
        assert.notEqual(example.expected, null, 'add the value this call returns to ' + file + ', as a comment after it');
        const call = new Function(example.api, 'return (' + example.code + ');');
        const run = capture(() => call(LIBRARIES[example.api]));
        const expected = new Function('return (' + example.expected + ');')();
        assert.deepEqual(run.value, expected);
        if (example.note && /\bwarns\b/.test(example.note)) {
          assert.ok(run.messages.length > 0, 'the documentation says this call warns');
        }
      });
    }
  });
}

// README.md also gives examples of the 3.0 API in its prose, as "`input` is output" with Myanmar output. Each runs
// through the call of the section it is in; one in another section fails until it gets a call here.
const knayi = LIBRARIES.knayi;
const PROSE_CALLS = {
  'Zawgyi to Unicode': (s) => knayi.toUnicode(s, { from: 'zawgyi' }),
  'Win fonts': (s) => knayi.toUnicode(s, { from: 'win' }),
  'normalize(text, options)': (s) => knayi.normalize(s)
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

  it('reads every fence tag and notation of an example, and the API it calls', () => {
    const text = 'Prose that names knayi.normalize is not an example.\n' +
      fence('javascript', "knayi.normalize('a') // 'a'") +
      fence('js', "  compat.normalize('b') // 'b'") +
      fence('ts', "import compat from 'knayi-myscript/compat'\nconsole.log(compat.normalize('c')) // 'c'") +
      fence('mjs', "compat.syllBreak('d', 'unicode', '|')\n// 'd'") +
      fence('cjs', "const knayi = require('knayi-myscript');\nknayi.truncate('e', {\n  length: 4\n}) // 'e'") +
      fence('typescript', 'knayi.OUTPUT_VERSION // 2') +
      fence('bash', 'echo knayi.normalize');
    const examples = readExamples(text, 'probe.md');
    assert.deepEqual(examples.map((e) => [e.line, e.api, e.code, e.expected]), [
      [3, 'knayi', "knayi.normalize('a')", "'a'"],
      [6, 'compat', "compat.normalize('b')", "'b'"],
      [10, 'compat', "compat.normalize('c')", "'c'"],
      [13, 'compat', "compat.syllBreak('d', 'unicode', '|')", "'d'"],
      [18, 'knayi', "knayi.truncate('e', {\n  length: 4\n})", "'e'"],
      [23, 'knayi', 'knayi.OUTPUT_VERSION', '2']
    ]);
  });

  it('keeps a note after the value, and parentheses inside strings out of the count', () => {
    const [example] = readExamples(fence('javascript', "compat.fontConvert('(', 'unicode') // '('  (no change; warns)"));
    assert.deepEqual([example.code, example.expected, example.note], ["compat.fontConvert('(', 'unicode')", "'('", 'no change; warns']);
  });

  it('rejects a line with knayi. or compat. in any other form', () => {
    for (const body of ["const x = knayi.normalize('a')", "knayi.normalize('a').length", "console.log(knayi.normalize('a')",
      "const y = compat.normalize('a')"]) {
      assert.throws(() => readExamples(fence('javascript', body), 'probe.md'), /unrecognised example at probe\.md:2/, body);
    }
  });
});
