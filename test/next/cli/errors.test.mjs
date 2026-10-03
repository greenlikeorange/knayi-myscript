// The exit status of knayi on each kind of error, and its message: one line on standard error, 'knayi: ...'
// (bin/cli/errors.js; README.md, "Command line").

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnKnayi, fixture } from './helpers.mjs';

// Runs knayi and checks that it stopped with this status and one line on standard error that matches `message`.
function assertStops(args, status, message, input) {
  const run = spawnKnayi(args, { input: input === undefined ? '' : input });
  assert.equal(run.status, status, args.join(' ') + ': ' + run.stderr);
  assert.match(run.stderr, /^knayi: [^\n]*\n$/, 'one line on standard error');
  assert.match(run.stderr, message);
  return run;
}

describe('knayi usage errors exit with 2, before reading any input', () => {
  it('a missing or unknown command', () => {
    assertStops([], 2, /no command given; usage: knayi <command>/);
    assertStops(['frob'], 2, /unknown command "frob"; the commands are normalize, to-unicode, /);
    assertStops(['--report'], 2, /no command given/);
  });

  it('an unknown option, a flag given a value, an option without its value', () => {
    assertStops(['normalize', '--nope'], 2, /Unknown option '--nope' \(knayi --help lists the options\)/);
    assertStops(['normalize', '--report=yes'], 2, /'--report' does not take an argument/);
    assertStops(['segment', '--separator'], 2, /'--separator <value>' argument missing/);
  });

  it('an option the command does not take', () => {
    assertStops(['normalize', '--tie', 'zawgyi'], 2, /--tie does not apply to normalize/);
    assertStops(['detect', '--policy', 'pairs'], 2, /--policy does not apply to detect/);
    assertStops(['to-zawgyi', '--detector', 'rules'], 2, /--detector does not apply to to-zawgyi/);
    assertStops(['detect', '--to', 'unicode'], 2, /--to is an option of convert; detect takes no --to/);
  });

  it('a value the command does not take: names are exact, as in the 3.0 API', () => {
    assertStops(['to-unicode', '--from', 'Zawgyi'], 2,
      /--from must be 'unicode', 'zawgyi' or 'win' for to-unicode, not "Zawgyi"/);
    assertStops(['convert', '--to', 'zawgyi', '--from', 'win'], 2,
      /--from must be 'unicode' or 'zawgyi' for convert --to zawgyi, not "win"/);
    assertStops(['convert'], 2, /convert needs --to, 'unicode' or 'zawgyi'/);
    assertStops(['convert', '--to', 'win'], 2, /--to must be 'unicode' or 'zawgyi' for convert, not "win"/);
    assertStops(['detect', '--encoding', 'latin1'], 2, /--encoding must be 'utf-8' or 'windows-1252'/);
    assertStops(['normalize', '--max-line-length', '1e3'], 2, /--max-line-length must be a whole number from 1/);
    assertStops(['normalize', '--max-line-length', '0'], 2, /--max-line-length must be a whole number from 1/);
  });

  it('writes nothing to standard output', () => {
    assert.equal(spawnKnayi(['segment', '--policy', 'all'], { input: 'abc\n' }).stdout, '');
  });
});

describe('knayi input errors exit with 3, naming the input and the line', () => {
  it('a file that cannot be read', () => {
    assertStops(['normalize', 'no-such-file.txt'], 3, /^knayi: no-such-file\.txt: cannot be read \(ENOENT: /);
    assertStops(['normalize', 'test'], 3, /^knayi: test: cannot be read \(EISDIR: /);
  });

  it('bytes that are not valid in --encoding, on the line they are in', () => {
    const run = assertStops(['normalize', fixture('invalid-utf8.txt')], 3,
      /invalid-utf8\.txt:2: the input is not valid utf-8/);
    assert.equal(run.stdout, 'ok\n', 'the lines before are written');
  });

  it('a line longer than --max-line-length, also before its line break arrives', () => {
    assertStops(['normalize', '--max-line-length', '3'], 3,
      /^knayi: <stdin>:2: the line is longer than 3 UTF-16 units, the limit --max-line-length sets/, 'abc\nabcd\n');
    assertStops(['normalize', '--max-line-length', '3'], 3, /<stdin>:1: the line is longer than 3/, 'abcd');
    assert.equal(spawnKnayi(['normalize', '--max-line-length', '3'], { input: 'abc\nabc' }).status, 0);
  });
});
