// The command line of knayi: the command, its options and its input files (README.md, "Command line").
//
// node:util parseArgs reads the words; this file checks them against the command they are given to, so that an
// option a command would ignore, or a value it does not take, stops the run with a usage error before any input is
// read. Each option has one spelling, and a value one name, exactly as written, as in the 3.0 API (DESIGN.md §11.1).

import { parseArgs } from 'node:util';
import { usageError } from './errors.js';

// The commands, in the order the usage text lists them. convert is to-unicode or to-zawgyi, chosen by --to.
export const COMMANDS = Object.freeze(['normalize', 'to-unicode', 'to-zawgyi', 'convert', 'detect', 'segment',
  'check']);

// The longest line knayi reads by default, and the most --max-line-length may allow, in UTF-16 units. A line is
// held whole until its line break, so the limit keeps an input with no line break from filling the memory. It is
// generous, since a JSON Lines record holds a whole document and its other fields, and Python's json.dumps writes
// each Burmese character as an escape of 6 units.
export const DEFAULT_MAX_LINE_LENGTH = 16 * 1024 * 1024;
const MOST_MAX_LINE_LENGTH = 256 * 1024 * 1024;

// Every option, as parseArgs reads it.
const OPTION_TYPES = Object.freeze({
  from: { type: 'string' },
  to: { type: 'string' },
  tie: { type: 'string' },
  detector: { type: 'string' },
  policy: { type: 'string' },
  separator: { type: 'string' },
  jsonl: { type: 'boolean' },
  field: { type: 'string' },
  into: { type: 'string' },
  encoding: { type: 'string' },
  'max-line-length': { type: 'string' },
  report: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' }
});

const DETECTORS = Object.freeze(['rules', 'myanmar-tools']);

// The options only some commands take: for each, the commands that take it, with the values each one accepts. The
// values are the 3.0 API's: to-unicode's from and tie (toUnicode), segment's from (segmentSyllables' font) and
// policy. to-zawgyi reads Unicode, or Zawgyi, which it copies as it is.
const COMMAND_CHOICES = Object.freeze({
  from: { 'to-unicode': ['unicode', 'zawgyi', 'win'], 'to-zawgyi': ['unicode', 'zawgyi'],
    segment: ['unicode', 'zawgyi'] },
  tie: { 'to-unicode': ['unicode', 'zawgyi'] },
  detector: { 'to-unicode': DETECTORS, detect: DETECTORS, check: DETECTORS },
  policy: { segment: ['separate', 'chains', 'pairs'] },
  separator: { segment: null } // any text
});

// convert's --to, and the input encodings every command reads.
const TARGETS = Object.freeze(['unicode', 'zawgyi']);
const ENCODINGS = Object.freeze(['utf-8', 'windows-1252']);

// What a command line asks for: { kind: 'help' }, { kind: 'version' }, or { kind: 'run', command, settings, files },
// where command is never 'convert' (its --to has chosen) and files are the paths to read in turn, '-' being
// standard input. Throws a usage error for anything the command does not take.
export function parseCommandLine(argv) {
  const { values, positionals } = readWords(argv);
  if (values.help) return { kind: 'help' };
  if (values.version) return { kind: 'version' };
  if (positionals.length === 0) {
    throw usageError('no command given; usage: knayi <command> [options] [file ...], and knayi --help lists them');
  }
  const command = resolveCommand(positionals[0], values.to);
  const label = positionals[0] === 'convert' ? 'convert --to ' + values.to : command; // for messages
  checkCommandOptions(command, label, values);
  checkJsonlOptions(values);
  const files = positionals.length > 1 ? positionals.slice(1) : ['-'];
  return { kind: 'run', command: command, settings: readSettings(values), files: files };
}

// parseArgs, strict: an unknown option, a missing value or a value given to a flag is a usage error, with the
// first sentence of parseArgs' message.
function readWords(argv) {
  try {
    return parseArgs({ args: argv, options: OPTION_TYPES, allowPositionals: true, strict: true });
  } catch (error) {
    if (typeof error.code !== 'string' || error.code.indexOf('ERR_PARSE_ARGS_') !== 0) throw error;
    const firstSentence = error.message.split('\n')[0].split('. To specify')[0];
    throw usageError(firstSentence + ' (knayi --help lists the options)');
  }
}

// The command a name means: convert becomes to-unicode or to-zawgyi by its --to, which only convert takes.
function resolveCommand(name, to) {
  if (COMMANDS.indexOf(name) === -1) {
    throw usageError('unknown command ' + JSON.stringify(name) + '; the commands are ' + listOf(COMMANDS, false));
  }
  if (name !== 'convert') {
    if (to !== undefined) throw usageError('--to is an option of convert; ' + name + ' takes no --to');
    return name;
  }
  if (to === undefined) throw usageError('convert needs --to, ' + listOf(TARGETS, true));
  checkChoice('--to', to, TARGETS, 'convert');
  return 'to-' + to;
}

// Each option of COMMAND_CHOICES is given only to a command that takes it, with a value that command takes, and the
// input encoding is one knayi reads.
function checkCommandOptions(command, label, values) {
  for (const name of Object.keys(COMMAND_CHOICES)) {
    if (values[name] === undefined) continue;
    const choices = COMMAND_CHOICES[name][command];
    if (choices === undefined) throw usageError('--' + name + ' does not apply to ' + label);
    if (choices !== null) checkChoice('--' + name, values[name], choices, label);
  }
  if (values.encoding !== undefined) checkChoice('--encoding', values.encoding, ENCODINGS, label);
  if (values['max-line-length'] !== undefined) readLineLimit(values['max-line-length']);
}

// --field and --into name the fields of a JSON Lines record, so they need --jsonl, and a name.
function checkJsonlOptions(values) {
  for (const name of ['field', 'into']) {
    if (values[name] === undefined) continue;
    if (!values.jsonl) throw usageError('--' + name + ' names a field of a record, and needs --jsonl');
    if (values[name] === '') throw usageError('--' + name + ' needs a field name');
  }
}

function checkChoice(option, value, choices, command) {
  if (choices.indexOf(value) !== -1) return;
  throw usageError(option + ' must be ' + listOf(choices, true) + ' for ' + command + ', not ' + JSON.stringify(value));
}

// The settings of a run. An option not given is null where the 3.0 API has the default (from, tie, policy), and
// knayi's own default otherwise.
function readSettings(values) {
  return Object.freeze({
    from: orNull(values.from),
    tie: orNull(values.tie),
    detector: values.detector === undefined ? 'rules' : values.detector,
    policy: orNull(values.policy),
    separator: values.separator === undefined ? '|' : values.separator,
    jsonl: values.jsonl === true,
    field: values.field === undefined ? 'text' : values.field,
    into: orNull(values.into),
    encoding: values.encoding === undefined ? 'utf-8' : values.encoding,
    maxLineLength: values['max-line-length'] === undefined ? DEFAULT_MAX_LINE_LENGTH
      : readLineLimit(values['max-line-length']),
    report: values.report === true
  });
}

// --max-line-length: a whole number of UTF-16 units, from 1 to MOST_MAX_LINE_LENGTH, written in decimal digits.
function readLineLimit(text) {
  const limit = /^[0-9]{1,10}$/.test(text) ? Number(text) : NaN;
  if (limit >= 1 && limit <= MOST_MAX_LINE_LENGTH) return limit;
  throw usageError('--max-line-length must be a whole number from 1 to ' + MOST_MAX_LINE_LENGTH + ', not ' +
    JSON.stringify(text));
}

function orNull(value) {
  return value === undefined ? null : value;
}

// 'a', 'a or b', 'a, b or c'; quoted as the API's messages quote them, or bare for command names.
function listOf(values, quoted) {
  const words = quoted ? values.map((value) => '\'' + value + '\'') : values.slice();
  return words.length === 1 ? words[0] : words.slice(0, -1).join(', ') + ' or ' + words[words.length - 1];
}
