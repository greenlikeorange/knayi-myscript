#!/usr/bin/env node
// knayi: the command line of knayi-myscript 3.0 (README.md, "Command line"). `knayi --help` lists its commands.
//
// It runs the 3.0 API (src/index.js) over files or standard input, line by line, as plain text or JSON Lines, for
// shell and Python pipelines. bin/cli/main.js holds the steps; this file hands it the process's streams and sets the
// exit status, without process.exit, so that all output is written first.

import { main } from './cli/main.js';

process.exitCode = await main(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr
});
