const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const knayi = require('../main');
const { readExamples, countCallLines } = require('../scripts/testing/readme-examples');

// Every `knayi.…` example in README.md runs against main.js, and returns the value in its comment. An example
// whose note says it warns must write a warning or an error to the console.

const examples = readExamples();

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

describe('README examples', () => {
  it('reads every example', (t) => {
    assert.equal(examples.length, countCallLines());
    assert.ok(examples.length > 0);
    t.diagnostic(examples.length + ' examples, ' + examples.filter((e) => e.expected !== null).length + ' with a value');
  });

  for (const example of examples) {
    it('README.md:' + example.line + ' ' + example.code.replace(/\s+/g, ' '), () => {
      const run = capture(() => new Function('knayi', 'return (' + example.code + ');')(knayi));
      if (example.expected === null) {
        // The calls without a value in the README are fontDetect calls with the myanmar-tools adapter.
        assert.ok(['unicode', 'zawgyi'].includes(run.value), 'returned ' + JSON.stringify(run.value));
      } else {
        const expected = new Function('return (' + example.expected + ');')();
        assert.deepEqual(run.value, expected);
      }
      if (example.note && /\bwarns\b/.test(example.note)) {
        assert.ok(run.messages.length > 0, 'the README says this call warns');
      }
    });
  }
});
