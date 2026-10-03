// The exit status of the knayi command, and the error that carries one. README.md, "Command line", lists them.

// Each run ends with one of these. A run that stops on an error writes one line to standard error, and nothing else
// there: --report's summary is written only by a run that reads all of its input.
export const EXIT = Object.freeze({
  OK: 0, // done; check found no issue
  ISSUES: 1, // check found at least one issue
  USAGE: 2, // an unknown command or option, a value the command does not take, a detector that is not installed
  INPUT: 3, // an input that cannot be read, or that is not what the options say it is
  FAILURE: 4 // anything else: standard output could not be written, or knayi has a bug
});

// An error the command reports in one line, 'knayi <command>: <message>', and exits with.
export class CliError extends Error {
  constructor(exitCode, message) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

export function usageError(message) {
  return new CliError(EXIT.USAGE, message);
}

// An input error names where the input is wrong: '<file>:<line>: <what is wrong>', or '<file>: ...' for the whole
// file. Standard input is named '<stdin>'.
export function inputError(where, message) {
  return new CliError(EXIT.INPUT, where + ': ' + message);
}
