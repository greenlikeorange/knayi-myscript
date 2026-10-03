// Runs test files and fails unless their tests ran and passed: at least --min tests (default 1), none skipped,
// none todo. CI runs it on test/syntax.test.js, the ES2015 gate for the dist builds, so that the gate cannot pass
// by being skipped (for example when acorn is missing from node_modules).
//
//   node scripts/check-tests-ran.mjs [--min <count>] <test file>...
//
// node --test counts a file without tests as one passing test, so give --min when a file must hold several.

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
let min = 1;
const minAt = args.indexOf("--min");
if (minAt !== -1) {
  min = Number(args[minAt + 1]);
  args.splice(minAt, 2);
}
const files = args;
if (!files.length || !(min >= 1)) {
  console.error("Usage: node scripts/check-tests-ran.mjs [--min <count>] <test file>...");
  process.exit(2);
}

const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...files], { encoding: "utf8" });
process.stdout.write(run.stdout);
process.stderr.write(run.stderr);

// The TAP reporter ends with "# tests 4", "# pass 4", "# fail 0", "# cancelled 0", "# skipped 0", "# todo 0".
const count = {};
for (const [, name, value] of run.stdout.matchAll(/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$/gm)) {
  count[name] = Number(value);
}

const problems = [];
if (run.status !== 0) problems.push("node --test exited with " + (run.status === null ? run.signal : run.status));
if (!(count.tests >= min)) problems.push((count.tests || 0) + " tests ran, fewer than " + min);
for (const name of ["fail", "cancelled", "skipped", "todo"]) {
  if (count[name] !== 0) problems.push(name + ": " + (count[name] === undefined ? "no count in the report" : count[name]));
}
if (count.pass !== count.tests) problems.push(count.pass + " of " + count.tests + " tests passed");

if (problems.length) {
  console.error(files.join(", ") + " did not run in full: " + problems.join("; ") + ".");
  process.exit(1);
}
console.log(files.join(", ") + ": all " + count.tests + " tests ran and passed.");
