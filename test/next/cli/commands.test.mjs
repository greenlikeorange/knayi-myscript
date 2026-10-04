// The commands of knayi, run as a process on the fixtures of test/next/cli/fixtures/ (README.md, "Command line").
//
// Each command's output is the 3.0 API's on each line (src/index.js), written as plain text or JSON Lines; these
// tests pin the output for hand-written lines, the exit status of each kind of run, and --report.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnKnayi, fixture } from './helpers.mjs';
import { toUnicode, toZawgyi, normalize, segmentSyllables, VERSION, OUTPUT_VERSION } from '../../../src/index.js';

const UNICODE = '\u1014\u103E\u1004\u103A\u1038 \u1000\u103B\u1031\u102C\u1004\u103A\u1038';
const ZAWGYI = '\u1031\u1000\u102C\u1004\u1039\u1038 \u1031\u1019\u102C\u1004\u1039';
const ZAWGYI_IN_UNICODE = '\u1000\u1031\u102C\u1004\u103A\u1038 \u1019\u1031\u102C\u1004\u103A';
const TIE = '\u1000\u1001\u1002';
const MYANMAR = '\u1019\u103C\u1014\u103A\u1019\u102C\u1005\u102C'; // three syllables

const lines = (path) => fs.readFileSync(path, 'utf8').split('\n').slice(0, -1);

describe('knayi normalize, to-unicode, to-zawgyi and convert', () => {
  it('normalize writes normalize of each line, each with its line break', () => {
    const run = spawnKnayi(['normalize', fixture('issues.txt')]);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout, lines(fixture('issues.txt')).map((line) => normalize(line) + '\n').join(''));
  });

  it('to-unicode detects each line, converts the Zawgyi one, and leaves a tie as it is', () => {
    const run = spawnKnayi(['to-unicode', fixture('mixed.txt')]);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout, [UNICODE, ZAWGYI_IN_UNICODE, TIE, 'abc'].join('\n') + '\n');
    const tie = spawnKnayi(['to-unicode', '--tie', 'zawgyi', fixture('mixed.txt')]);
    assert.equal(tie.stdout.split('\n')[2], toUnicode(TIE, { from: 'zawgyi' }));
  });

  it('to-unicode --from converts every line from that font', () => {
    assert.equal(spawnKnayi(['to-unicode', '--from', 'zawgyi'], { input: ZAWGYI }).stdout, ZAWGYI_IN_UNICODE);
    assert.equal(spawnKnayi(['to-unicode', '--from', 'win', fixture('win.txt')]).stdout, '\u102A\n');
    assert.equal(spawnKnayi(['to-unicode', '--from', 'unicode'], { input: ZAWGYI }).stdout, ZAWGYI);
  });

  it('reads Win text saved in Windows-1252 with --encoding windows-1252, and refuses it as UTF-8', () => {
    const run = spawnKnayi(['to-unicode', '--from', 'win', '--encoding', 'windows-1252', fixture('win-1252.txt')]);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout, toUnicode('a\u00D3', { from: 'win' }) + '\n');
    assert.equal(run.stdout, '\u1009\u102C\u1031\n');
    const utf8 = spawnKnayi(['to-unicode', '--from', 'win', fixture('win-1252.txt')]);
    assert.equal(utf8.status, 3);
    assert.match(utf8.stderr, /win-1252\.txt:1: the input is not valid utf-8 .*--encoding windows-1252/);
  });

  it('to-zawgyi converts Unicode, one line at a time, and copies Zawgyi with --from zawgyi', () => {
    assert.equal(spawnKnayi(['to-zawgyi'], { input: ZAWGYI_IN_UNICODE + '\n' }).stdout, ZAWGYI + '\n');
    // An e at the start of a line stays on its line; toZawgyi on the whole text moves it to the line above.
    const run = spawnKnayi(['to-zawgyi'], { input: '\u1000\n\u1031' });
    assert.equal(run.stdout, '\u1000\n\u1031');
    assert.equal(toZawgyi('\u1000\n\u1031'), '\u1031\u1000\n');
    assert.equal(spawnKnayi(['to-zawgyi', '--from', 'zawgyi'], { input: ZAWGYI }).stdout, ZAWGYI);
  });

  it('convert --to unicode is to-unicode, and convert --to zawgyi is to-zawgyi', () => {
    assert.equal(spawnKnayi(['convert', '--to', 'unicode', fixture('mixed.txt')]).stdout,
      spawnKnayi(['to-unicode', fixture('mixed.txt')]).stdout);
    assert.equal(spawnKnayi(['convert', '--from', 'zawgyi', '--to', 'unicode'], { input: ZAWGYI }).stdout,
      ZAWGYI_IN_UNICODE);
    assert.equal(spawnKnayi(['convert', '--to', 'zawgyi'], { input: ZAWGYI_IN_UNICODE }).stdout, ZAWGYI);
  });
});

describe('knayi detect and segment', () => {
  it('detect writes the encoding of each line', () => {
    const run = spawnKnayi(['detect', fixture('mixed.txt')]);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout, 'unicode\nzawgyi\nunknown\nnone\n');
  });

  it('detect --detector myanmar-tools asks Google\'s ZawgyiDetector, installed next to knayi', () => {
    const run = spawnKnayi(['detect', '--detector', 'myanmar-tools', fixture('mixed.txt')]);
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(run.stdout.split('\n').slice(0, 2), ['unicode', 'zawgyi']);
  });

  it('segment writes the syllables of each line with --separator between them, | by default', () => {
    assert.equal(spawnKnayi(['segment'], { input: MYANMAR + '\n' }).stdout,
      '\u1019\u103C\u1014\u103A|\u1019\u102C|\u1005\u102C\n');
    assert.equal(spawnKnayi(['segment', '--separator', ' / '], { input: MYANMAR }).stdout,
      segmentSyllables(MYANMAR).join(' / '));
    const pairs = spawnKnayi(['segment', '--bare-consonants', 'pairs', '--separator', '\u200B'], { input: TIE });
    assert.equal(pairs.stdout, segmentSyllables(TIE, { bareConsonants: 'pairs' }).join('\u200B'));
    const zawgyi = spawnKnayi(['segment', '--from', 'zawgyi'], { input: ZAWGYI });
    assert.equal(zawgyi.stdout, segmentSyllables(ZAWGYI, { from: 'zawgyi' }).join('|'));
  });
});

describe('knayi check', () => {
  it('writes each issue as <file>:<line>:<column>: <rule>: <text> -> <fix>, and exits with 1', () => {
    const run = spawnKnayi(['check', 'test/next/cli/fixtures/issues.txt']);
    assert.equal(run.status, 1, run.stderr);
    assert.deepEqual(run.stdout.split('\n'), [
      'test/next/cli/fixtures/issues.txt:1:11: order.marks: "\u1000\u102F\u102D" -> "\u1000\u102D\u102F"',
      'test/next/cli/fixtures/issues.txt:2:3: mark.repeated: "\u1004\u103A\u103A\u1038" -> "\u1004\u103A\u1038"',
      'test/next/cli/fixtures/issues.txt:3:2: typo.lagaung: "\u1044" -> "\u104E"',
      'test/next/cli/fixtures/issues.txt:4:4: look-alike.zero-as-wa: "\u1040" -> "\u101D"',
      'test/next/cli/fixtures/issues.txt:6:1: encoding.zawgyi: "' + ZAWGYI + '" -> "' + ZAWGYI_IN_UNICODE + '"',
      // columns count characters: the emoji before the issue is one, though it is two UTF-16 units
      'test/next/cli/fixtures/issues.txt:7:5: mark.repeated: "\u1004\u103A\u103A\u1038" -> "\u1004\u103A\u1038"',
      ''
    ]);
  });

  it('exits with 0 and writes nothing for clean text, and names standard input <stdin>', () => {
    assert.deepEqual(spawnKnayi(['check'], { input: UNICODE + '\nabc\n' }), { status: 0, stdout: '', stderr: '' });
    assert.match(spawnKnayi(['check'], { input: ZAWGYI }).stdout, /^<stdin>:1:1: encoding\.zawgyi: /);
  });

  it('takes --from: unicode reads no line as Zawgyi, as explain does with from: \'unicode\'', () => {
    // S'gaw Karen's tone mark U+1064 reads as Zawgyi's kinzi: the line is Unicode, and has no issue.
    const karen = '\u1000\u1064\u1062\u103A';
    assert.match(spawnKnayi(['check'], { input: karen }).stdout, /^<stdin>:1:1: encoding\.zawgyi: /);
    assert.deepEqual(spawnKnayi(['check', '--from', 'unicode'], { input: karen + '\n' }),
      { status: 0, stdout: '', stderr: '' });
    assert.equal(spawnKnayi(['check', '--from', 'zawgyi'], { input: UNICODE + '\nabc\n' }).status, 1);
    assert.equal(spawnKnayi(['check', '--from', 'win'], { input: 'abc' }).status, 2);
  });
});

describe('knayi line breaks and inputs', () => {
  it('keeps each line\'s ending: none after a last line without one, and a carriage return before \\n', () => {
    assert.equal(spawnKnayi(['to-unicode', '--from', 'zawgyi'], { input: ZAWGYI + '\r\n' + ZAWGYI }).stdout,
      ZAWGYI_IN_UNICODE + '\r\n' + ZAWGYI_IN_UNICODE);
    assert.equal(spawnKnayi(['detect'], { input: '\n\n' }).stdout, 'none\nnone\n');
    assert.equal(spawnKnayi(['normalize'], { input: '' }).stdout, '');
  });

  it('reads its files in turn, - for standard input, ending each file\'s last line', () => {
    const run = spawnKnayi(['detect', fixture('win.txt'), '-', fixture('mixed.txt')], { input: ZAWGYI });
    assert.equal(run.stdout, 'none\nzawgyi\nunicode\nzawgyi\nunknown\nnone\n');
  });
  it('drops a byte order mark at the start of an input, which marks its encoding, and keeps U+FEFF elsewhere', () => {
    const run = spawnKnayi(['to-unicode', '--from', 'zawgyi'], { input: '\uFEFF' + ZAWGYI + '\n\uFEFF' });
    assert.equal(run.stdout, ZAWGYI_IN_UNICODE + '\n\uFEFF');
    assert.equal(spawnKnayi(['normalize', '--jsonl'], { input: '\uFEFF{"text":"a"}\n' }).stdout, '{"text":"a"}\n');
  });
});

describe('knayi --jsonl', () => {
  it('writes the result to --field, and passes every other byte through, a record it does not change whole', () => {
    const run = spawnKnayi(['to-unicode', '--jsonl', fixture('records.jsonl')]);
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(run.stdout.split('\n'), [
      '{"id": 12345678901234567890, "text": "' + ZAWGYI_IN_UNICODE + '", "meta": {"tags": ["a", "}"], "n": 1.50}}',
      '{"id":2,"text":"' + UNICODE + '","lang":"my"}',
      '',
      '{"id": 3, "text": "\u1000\u1031\u102C\u1004\u103A\u1038"}',
      '{"text": "abc", "n": 1.50}',
      ''
    ]);
  });

  it('writes detect, segment and check to a field of their own, or to --into; --field names the text', () => {
    const input = '{"body":"' + ZAWGYI + '","text":"' + UNICODE + '"}\n';
    assert.equal(spawnKnayi(['detect', '--jsonl'], { input }).stdout,
      '{"body":"' + ZAWGYI + '","text":"' + UNICODE + '","encoding":"unicode"}\n');
    assert.equal(spawnKnayi(['detect', '--jsonl', '--field', 'body', '--into', 'enc'], { input }).stdout,
      '{"body":"' + ZAWGYI + '","text":"' + UNICODE + '","enc":"zawgyi"}\n');
    const segmented = JSON.parse(spawnKnayi(['segment', '--jsonl'], { input: '{"text":"' + MYANMAR + '"}' }).stdout);
    assert.deepEqual(segmented, { text: MYANMAR, syllables: segmentSyllables(MYANMAR) });
    const converted = spawnKnayi(['to-unicode', '--jsonl', '--field', 'body', '--into', 'unicode'], { input });
    assert.equal(JSON.parse(converted.stdout).unicode, ZAWGYI_IN_UNICODE);
  });

  it('check writes every record with its issues, offsets in characters, and exits with 1 when any has one', () => {
    const input = '{"text":"\uD83D\uDE00 \u1014\u103E\u1004\u103A\u103A\u1038"}\n{"text":"abc"}\n';
    const run = spawnKnayi(['check', '--jsonl'], { input });
    assert.equal(run.status, 1);
    const records = run.stdout.trim().split('\n').map((line) => JSON.parse(line));
    assert.deepEqual(records[0].issues, [{ kind: 'mark', rule: 'mark.repeated', start: 4, end: 8,
      text: '\u1004\u103A\u103A\u1038', fix: '\u1004\u103A\u1038' }]);
    assert.deepEqual(records[1], { text: 'abc', issues: [] });
  });

  it('check writes the text and fix of an issue as whole characters, never half a surrogate pair', () => {
    // U+11131 U+11127, which NFC composes to U+1112E: Python reads the record and can encode both fields.
    const run = spawnKnayi(['check', '--jsonl'], { input: '{"text":"a\uD804\uDD31\uD804\uDD27"}\n' });
    assert.equal(run.status, 1);
    assert.doesNotMatch(run.stdout, /\\ud[89a-f]/i, 'no lone surrogate escaped');
    assert.deepEqual(JSON.parse(run.stdout).issues, [{ kind: 'nfc', rule: 'nfc.order', start: 1, end: 3,
      text: '\uD804\uDD31\uD804\uDD27', fix: '\uD804\uDD2E' }]);
  });
});

describe('knayi --report, --help and --version', () => {
  it('--report writes one JSON line to standard error, with the version and the output version', () => {
    const run = spawnKnayi(['detect', '--report', fixture('mixed.txt')]);
    assert.deepEqual(JSON.parse(run.stderr), { command: 'detect', version: VERSION, outputVersion: OUTPUT_VERSION,
      records: 4, encodings: { unicode: 1, zawgyi: 1, unknown: 1, none: 1 } });
    const check = spawnKnayi(['check', '--report', fixture('issues.txt')]);
    assert.deepEqual(JSON.parse(check.stderr), { command: 'check', version: VERSION, outputVersion: OUTPUT_VERSION,
      records: 7, issues: 6, recordsWithIssues: 6, rules: { 'encoding.zawgyi': 1, 'look-alike.zero-as-wa': 1,
        'mark.repeated': 2, 'order.marks': 1, 'typo.lagaung': 1 } });
    const jsonl = spawnKnayi(['to-unicode', '--jsonl', '--report', fixture('records.jsonl')]);
    assert.deepEqual(JSON.parse(jsonl.stderr), { command: 'to-unicode', version: VERSION,
      outputVersion: OUTPUT_VERSION, records: 4, changed: 2 });
    const segment = spawnKnayi(['segment', '--report'], { input: MYANMAR + '\n' + MYANMAR });
    assert.equal(JSON.parse(segment.stderr).syllables, 6);
  });

  it('--help and --version write to standard output and exit with 0', () => {
    const help = spawnKnayi(['--help']);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /^Usage: knayi <command> \[options\] \[file \.\.\.\]/);
    for (const command of ['normalize', 'to-unicode', 'to-zawgyi', 'convert', 'detect', 'segment', 'check']) {
      assert.match(help.stdout, new RegExp('\\n  ' + command + ' '));
    }
    assert.equal(spawnKnayi(['segment', '-h']).stdout, help.stdout);
    assert.deepEqual(spawnKnayi(['--version']), { status: 0, stdout: 'knayi ' + VERSION + ' (output version ' +
      OUTPUT_VERSION + ')\n', stderr: '' });
  });
});
