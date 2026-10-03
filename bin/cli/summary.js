// --report: what a run did, as one JSON object on standard error when the run has read all of its input.
//
// It names knayi's version and its OUTPUT_VERSION, which goes up with every deliberate change to what any function
// returns (decision 33), so a dataset can record which knayi wrote it, and know when to run it again.

import { VERSION, OUTPUT_VERSION } from '../../src/index.js';

// { add(text, result), counts, json() } for a command from commands.js. records counts the lines; the command adds
// its own counts:
//   normalize, to-unicode, to-zawgyi   changed: the texts the command changed
//   detect                             encodings: the texts of each encoding
//   segment                            syllables: how many syllables in all
//   check                              issues, recordsWithIssues, and rules: the issues of each rule
export function createSummary(name, command) {
  const counts = command.newCounts();
  let records = 0;
  return {
    counts: counts,
    add(text, result) {
      records++;
      command.tally(counts, text, result);
    },
    json() {
      const head = { command: name, version: VERSION, outputVersion: OUTPUT_VERSION, records: records };
      return JSON.stringify(Object.assign(head, sortedRules(counts)));
    }
  };
}

// The counts, with check's rules in the order of their names, so two runs on the same input write the same line.
function sortedRules(counts) {
  if (counts.rules === undefined) return counts;
  const rules = {};
  for (const rule of Object.keys(counts.rules).sort()) rules[rule] = counts.rules[rule];
  return Object.assign({}, counts, { rules: rules });
}
