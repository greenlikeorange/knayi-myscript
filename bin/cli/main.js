// The knayi command, step by step (README.md, "Command line"): read the command line, load the detector it asks
// for, run the command over every line or record of the input, then write the summary and return the exit status.
//
// io is { stdin, stdout, stderr }: the process's streams in bin/knayi.js, stand-ins in a test. main never calls
// process.exit, so standard output is written out before the process ends.

import { parseCommandLine } from './options.js';
import { loadZawgyiDetector } from './detector.js';
import { createCommand } from './commands.js';
import { createSummary } from './summary.js';
import { createOutput } from './output.js';
import { readLines } from './lines.js';
import { plainLine, jsonLine } from './records.js';
import { USAGE, versionText } from './usage.js';
import { EXIT, CliError } from './errors.js';

// The exit status of the run (errors.js EXIT). An error stops the run with one line on standard error.
export async function main(argv, io) {
  try {
    return await run(parseCommandLine(argv), io);
  } catch (error) {
    return reportError(error, io.stderr);
  }
}

async function run(request, io) {
  if (request.kind === 'help') return writeText(io.stdout, USAGE);
  if (request.kind === 'version') return writeText(io.stdout, versionText());
  const settings = request.settings;
  const command = createCommand(request.command, settings, await loadZawgyiDetector(settings.detector));
  const summary = createSummary(request.command, command);
  const output = createOutput(io.stdout);
  await readLines(request.files, io.stdin, settings, lineHandler(command, settings, summary), output);
  await output.finish();
  if (output.closed) return EXIT.OK; // the reader went away: nothing more to say
  if (settings.report) io.stderr.write(summary.json() + '\n');
  return summary.counts.issues > 0 ? EXIT.ISSUES : EXIT.OK;
}

// The handler lines.js gives each line to: map(line, where) is the command's output for the line, tallied for
// --report; written(mapped) what to write of what mapLines made of a chunk's lines; and dropped() whether the line
// just mapped is to be left out, ending and all (a record --invalid skip drops). A command that writes one line for
// each line writes that, each line with its ending; check's plain text is a report of whole lines, none for a clean
// line, so its map collects them and returns '', and the endings mapLines puts after each '' are dropped.
function lineHandler(command, settings, summary) {
  let drop = false;
  const map = (line, where) => {
    const done = settings.jsonl ? jsonLine(command, line, where, settings) : plainLine(command, line, where);
    if (done.invalid) summary.addInvalid();
    else if (done.text !== null) summary.add(done.text, done.result);
    drop = done.skipped === true;
    return done.output;
  };
  const dropped = () => {
    const was = drop;
    drop = false;
    return was;
  };
  if (settings.jsonl || command.writesLines) return { map: map, written: (mapped) => mapped, dropped: dropped };
  let report = '';
  return {
    map: (line, where) => {
      report += map(line, where);
      return '';
    },
    written: () => {
      const lines = report;
      report = '';
      return lines;
    },
    dropped: dropped
  };
}

function writeText(stream, text) {
  stream.write(text);
  return EXIT.OK;
}

// One line on standard error, and the status: the error's own for a CliError; FAILURE for anything else, which is
// a bug in knayi, so its stack is written too.
function reportError(error, stderr) {
  if (error instanceof CliError) {
    stderr.write('knayi: ' + error.message + '\n');
    return error.exitCode;
  }
  stderr.write('knayi: unexpected error, please report it at ' +
    'https://github.com/greenlikeorange/knayi-myscript/issues\n' + (error && error.stack ? error.stack : error) + '\n');
  return EXIT.FAILURE;
}
