'use strict';
// The 2.x behaviours that compat (src/compat/) does not have yet, and the tests that wait for them.
//
// The merge of the final 2.x line (branch detect-encoding, commit 8923365) into next brought 2.x's tests with it,
// pointed at compat, and moved the 2.x reference to that commit (docs/next/DESIGN.md §1.1, §8). compat still gives
// 2.10.0's output, so a test of a later 2.x change fails until that change is ported into src/. Such a test is
// written as `it(name, pendingPort(commit, fn))`: it passes while fn fails, and fails as soon as fn passes, saying
// which commit it waits for. So each port turns exactly its own tests red, and the port removes their pendingPort.
// A script that is not a test file checks the same way with pendingPortNow(commit, fn), which runs fn at once.
// Nothing else may fail: a test that fails for any other reason is not marked.
//
// KNAYI_PENDING_PORT=run runs every marked test as a plain test, to see why it fails, or to check it against the
// 2.x reference (scripts/reference/main.js), where each one passes.
//
// Each key is the 2.x commit that made the change; the port of a commit removes its key once no test names it.

const PENDING = Object.freeze({
  'd20027a': 'fontConvert reads no debug flag from this (PR 4.1)',
  'b6cbfca': 'fontConvert.debugging reports every exit with text (PR 4.2)',
  '41984eb': 'truncate returns a start of the text, and breaks only that start (PR 4.9)'
});

// The changes that change cells of the contract matrix (test/contract/api-matrix.json): debugging's reports and
// truncate's prefix. test/contract/api-matrix.test.js and scripts/bun-matrix.js check compat and its builds against
// the matrix as waiting for them.
const MATRIX_CHANGES = Object.freeze(['b6cbfca', '41984eb']);

// The examples of the 2.x API in the documents that show a change compat does not have yet, by file and code (as
// scripts/testing/readme-examples.js reads them), with the commit each waits for. test/readme.test.js and
// test/next/compat-index.test.mjs run them as waiting for it.
const PENDING_EXAMPLES = Object.freeze({
  "MIGRATION.md compat.fontConvert.debugging(' ကျ ', 'unicode', 'unicode')": 'b6cbfca',
  "MIGRATION.md compat.fontConvert.debugging('abc', 'unicode')": 'b6cbfca',
  "MIGRATION.md compat.truncate('အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။', { length: 30, omission: '...' })": '41984eb',
  "src/compat/index.d.ts compat.fontConvert.debugging(' ကျ ', 'unicode', 'unicode')": 'b6cbfca'
});

// The commits as a list, each checked against PENDING. commits: one commit, or a list of them when the test needs
// each.
function pendingList(commits) {
  const list = [].concat(commits);
  for (const commit of list) {
    if (!Object.prototype.hasOwnProperty.call(PENDING, commit)) {
      throw new Error('pendingPort: ' + commit + ' is not a 2.x change waiting for its port ' +
        '(scripts/testing/pending-port.js)');
    }
  }
  return list;
}

function passesNow(list) {
  return new Error('This test passes now: next has the 2.x ' + (list.length > 1 ? 'changes of commits ' :
    'change of commit ') + list.map((commit) => commit + ' (' + PENDING[commit] + ')').join(' and ') +
    '. Remove its pendingPort.');
}

// A test function that passes while fn fails, for it(name, ...).
function pendingPort(commits, fn) {
  const list = pendingList(commits);
  if (process.env.KNAYI_PENDING_PORT === 'run') return fn;
  return async function pending() {
    try {
      await fn.apply(this, arguments);
    } catch (error) {
      return;
    }
    throw passesNow(list);
  };
}

// Runs fn, a synchronous check, at once: it must fail while the commits wait for their port.
function pendingPortNow(commits, fn) {
  const list = pendingList(commits);
  if (process.env.KNAYI_PENDING_PORT === 'run') {
    fn();
    return;
  }
  try {
    fn();
  } catch (error) {
    return;
  }
  throw passesNow(list);
}

module.exports = { PENDING, MATRIX_CHANGES, PENDING_EXAMPLES, pendingPort, pendingPortNow };
