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
    assertStops(['detect', '--bare-consonants', 'pairs'], 2, /--bare-consonants does not apply to detect/);
    assertStops(['to-zawgyi', '--detector', 'rules'], 2, /--detector does not apply to to-zawgyi/);
    assertStops(['detect', '--to', 'unicode'], 2, /--to is an option of convert; detect takes no --to/);
    assertStops(['normalize', '--field', 'body'], 2, /--field names a field of a record, and needs --jsonl/);
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
    assertStops(['normalize', '--jsonl', '--into', ''], 2, /--into needs a field name/);
  });

  it('writes nothing to standard output', () => {
    assert.equal(spawnKnayi(['segment', '--bare-consonants', 'all'], { input: 'abc\n' }).stdout, '');
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

  it('a JSON Lines line that is not JSON, not an object, or has no string --field', () => {
    assertStops(['normalize', '--jsonl'], 3, /^knayi: <stdin>:2: not JSON \(/, '{"text":"a"}\n{"text":"a"\n');
    assertStops(['normalize', '--jsonl'], 3, /<stdin>:1: a record must be a JSON object, not an array/, '[1]\n');
    assertStops(['normalize', '--jsonl'], 3, /<stdin>:1: a record must be a JSON object, not a string/, '"a"\n');
    assertStops(['normalize', '--jsonl'], 3,
      /<stdin>:1: the record has no string field "text" \(it is missing\); --field names the field/, '{"body":"a"}');
    assertStops(['normalize', '--jsonl'], 3, /no string field "text" \(it is null\)/, '{"text":null}');
    assertStops(['normalize', '--jsonl', '--field', 'body'], 3, /no string field "body" \(it is a number\)/,
      '{"body":1}');
  });

  it('check stops with 3, not 1, when an input error follows an issue', () => {
    assertStops(['check', '--jsonl'], 3, /<stdin>:2: not JSON/, '{"text":"\u1000\u102D\u102D"}\nnot json\n');
  });

  it('writes every line before the one it names, though they came in the same chunk', () => {
    const records = '{"id":1,"text":"\u1031\u1000"}\n{"id":2,"text":null}\n{"id":3,"text":"a"}\n';
    const run = assertStops(['normalize', '--jsonl'], 3, /<stdin>:2: the record has no string field "text"/, records);
    assert.equal(run.stdout, '{"id":1,"text":"\u1000\u1031"}\n', 'record 1, and nothing of 2 or after');
    const long = assertStops(['normalize', '--max-line-length', '3'], 3, /<stdin>:3: the line is longer/,
      'ab\r\nabc\nabcd\nab\n');
    assert.equal(long.stdout, 'ab\r\nabc\n');
    const check = assertStops(['check', '--jsonl'], 3, /<stdin>:2: not JSON/, '{"text":"\u1000\u102D\u102D"}\nx\n');
    assert.equal(JSON.parse(check.stdout).issues.length, 1, 'the issue of record 1');
  });
});

describe('knayi --invalid: what --jsonl does with a line that is no record it can read', () => {
  // Record 2 has a null text, record 4 no text, line 5 is not JSON and line 6 not an object; 1 and 3 are records.
  const LINES = ['{"id":1,"text":"\u1031\u1000"}', '{"id":2,"text":null}', '{"id":3,"text":"\u1000\u102D\u102D"}',
    '{"id":4}', 'not json', '[1]'];
  const input = LINES.join('\r\n') + '\n';

  it('error, the default, stops at the first such line with status 3', () => {
    assertStops(['normalize', '--jsonl'], 3, /<stdin>:2: the record has no string field "text" \(it is null\)/, input);
    assertStops(['normalize', '--jsonl', '--invalid', 'error'], 3, /<stdin>:2: /, input);
  });

  it('keep writes each such line as it came, ending and all; --report counts them as invalid', () => {
    const run = spawnKnayi(['normalize', '--jsonl', '--invalid', 'keep', '--report'], { input });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout, ['{"id":1,"text":"\u1000\u1031"}', LINES[1], '{"id":3,"text":"\u1000\u102D"}', LINES[3],
      LINES[4], LINES[5]].join('\r\n') + '\n');
    const report = JSON.parse(run.stderr);
    assert.equal(report.records, 6);
    assert.equal(report.invalid, 4);
    assert.equal(report.changed, 2);
  });

  it('skip writes nothing of such a line, not even its line break', () => {
    const run = spawnKnayi(['segment', '--jsonl', '--invalid', 'skip', '--report'], { input: input + '{"id":7}' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^\{"id":1,[^\n]*\}\r\n\{"id":3,[^\n]*\}\r\n$/, 'records 1 and 3, each with its ending');
    assert.equal(JSON.parse(run.stderr).invalid, 5);
    const check = spawnKnayi(['check', '--jsonl', '--invalid', 'skip'], { input });
    assert.equal(check.status, 1, 'record 3 has an issue');
    assert.equal(check.stdout.split('\n').filter((line) => line !== '').length, 2);
  });

  it('needs --jsonl, and is error, keep or skip', () => {
    assertStops(['normalize', '--invalid', 'keep'], 2, /--invalid .*needs --jsonl/);
    assertStops(['normalize', '--jsonl', '--invalid', 'drop'], 2, /--invalid must be 'error', 'keep' or 'skip'/);
  });
});
