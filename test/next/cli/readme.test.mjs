// The examples of README.md, "Command line": each `console` block is a session of commands, `$ ` and the command,
// then the lines it writes. Each command runs here, and must write exactly those lines. A command is
// `knayi <args>`, or `echo '<text>' | knayi <args>` or `printf '<text>' | knayi <args>` for standard input; the
// number of commands is pinned, so an example the test stops reading fails it.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../helpers.mjs';
import { spawnKnayi } from './helpers.mjs';

const EXAMPLES = 7;

// The `console` blocks of the section, as [{ line, command, output }].
function readExamples() {
  const lines = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8').split('\n');
  const start = lines.indexOf('## Command line');
  const examples = [];
  let inConsole = false;
  for (let n = start + 1; n < lines.length && !lines[n].startsWith('## '); n++) {
    const line = lines[n];
    if (line.startsWith('```')) inConsole = !inConsole && line === '```console';
    else if (inConsole && line.startsWith('$ ')) examples.push({ line: n + 1, command: line.slice(2), output: '' });
    else if (inConsole) examples[examples.length - 1].output += line + '\n';
  }
  return examples;
}

// The words of a command: split at spaces, with '...' quoting, as a shell reads these examples.
function words(command) {
  const found = [];
  const word = /'([^']*)'|(\S+)/g;
  for (let match = word.exec(command); match !== null; match = word.exec(command)) {
    found.push(match[1] !== undefined ? match[1] : match[2]);
  }
  return found;
}

// { args, input } for spawnKnayi: echo writes its text and a line break; printf reads \n as one.
function invocation(command) {
  const all = words(command);
  const pipe = all.indexOf('|');
  const knayi = all.slice(pipe + 1);
  assert.equal(knayi[0], 'knayi', 'a command runs knayi: ' + command);
  if (pipe === -1) return { args: knayi.slice(1), input: '' };
  const [writer, text] = all.slice(0, pipe);
  assert.ok(writer === 'echo' || writer === 'printf', 'standard input comes from echo or printf: ' + command);
  return { args: knayi.slice(1), input: writer === 'echo' ? text + '\n' : text.split('\\n').join('\n') };
}

describe('README.md, "Command line": the examples', () => {
  const examples = readExamples();

  it('reads every example', () => {
    assert.equal(examples.length, EXAMPLES, 'README.md has ' + examples.length + ' command line examples; if you ' +
      'added or removed one, change EXAMPLES in test/next/cli/readme.test.mjs');
  });

  for (const example of examples) {
    it('README.md:' + example.line + ' ' + example.command, () => {
      const call = invocation(example.command);
      const run = spawnKnayi(call.args, { input: call.input });
      assert.equal(run.stderr, '');
      assert.equal(run.stdout, example.output);
    });
  }
});
