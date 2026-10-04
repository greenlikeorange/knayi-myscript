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
  '24f81c6': 'one font-name policy, with the coded TypeError ERR_KNAYI_INVALID_FONT (refactor plan PR 4.3)',
  '579be3d': 'font names in any letter case (PR 4.3b)',
  '86f0040': 'a fontDetect fallback that is not a string is no fallback (PR 4.4)',
  'fb6594d': 'null options, and checked detector options with coded console errors (PR 4.5)',
  'd20027a': 'fontConvert reads no debug flag from this (PR 4.1)',
  'b6cbfca': 'fontConvert.debugging reports every exit with text (PR 4.2)',
  'ab3676e': 'the font pipeline makes the typing fixes in normalize\'s order (PR 4.7)',
  '05de555': 'Unicode to Zawgyi writes stacked jha as U+1069 (PR 4.8)',
  '41984eb': 'truncate returns a start of the text, and breaks only that start (PR 4.9)',
  '31eb6b1': 'the detectEncoding export (Phase 5 item 1)',
  '840c8c5': 'the zawgyiDetector option (Phase 5 item 2)',
  '649b2b4': 'no package loaded by name outside main.js (decision 17 (c))'
});

// The changes that change cells of the contract matrix (test/contract/api-matrix.json): font names, a fallback that
// is not a string, the detector options, debugging's reports, truncate's prefix, detectEncoding, zawgyiDetector and
// the package load. test/contract/api-matrix.test.js and scripts/bun-matrix.js check compat and its builds against
// the matrix as waiting for them.
const MATRIX_CHANGES = Object.freeze(['24f81c6', '579be3d', '86f0040', 'fb6594d', 'b6cbfca', '41984eb', '31eb6b1',
  '840c8c5', '649b2b4']);

// The examples of the 2.x API in the documents that show a change compat does not have yet, by file and code (as
// scripts/testing/readme-examples.js reads them), with the commit each waits for. test/readme.test.js and
// test/next/compat-index.test.mjs run them as waiting for it.
const PENDING_EXAMPLES = Object.freeze({
  "MIGRATION.md compat.fontConvert('ျမန္မာ', 'unicode', 'zg')": '24f81c6',
  "MIGRATION.md compat.fontConvert('ျမန္မာ', 'Unicode', 'ZAWGYI')": '579be3d',
  "MIGRATION.md compat.fontDetect('က', 1)": '86f0040',
  "MIGRATION.md compat.fontDetect('ကျ', null, null)": 'fb6594d',
  "MIGRATION.md compat.fontDetect('ကျ', null, { adapter: 'rule' })": 'fb6594d',
  "MIGRATION.md compat.fontDetect('ကျ', null, { myanmartools_zg_threshold: [0.95, 0.05] })": 'fb6594d',
  "MIGRATION.md compat.detectEncoding('မဂၤလာပါ')": '31eb6b1',
  "MIGRATION.md compat.detectEncoding('မြန်မာ')": '31eb6b1',
  "MIGRATION.md compat.detectEncoding('က')": '31eb6b1',
  "MIGRATION.md compat.detectEncoding('ျမန္မာ မြန်မာ')": '31eb6b1',
  "MIGRATION.md compat.detectEncoding('abc')": '31eb6b1',
  "MIGRATION.md compat.detectEncoding(null)": '31eb6b1',
  "MIGRATION.md ['မြန်မာ', 'ျမန္မာ', 'abc'].map(compat.detectEncoding)": '31eb6b1',
  "MIGRATION.md compat.fontConvert('မဇ္ဈိမ', 'zawgyi', 'unicode')": '05de555',
  "MIGRATION.md compat.fontConvert.debugging(' ကျ ', 'unicode', 'unicode')": 'b6cbfca',
  "MIGRATION.md compat.fontConvert.debugging('abc', 'unicode')": 'b6cbfca',
  "MIGRATION.md ['မြန်မာ', 'ျမန္မာ'].map(compat.syllBreak)": '24f81c6',
  "MIGRATION.md compat.truncate('အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။', { length: 30, omission: '...' })": '41984eb',
  "src/compat/index.d.ts compat.detectEncoding('မဂၤလာပါ')": '31eb6b1',
  "src/compat/index.d.ts compat.detectEncoding('မြန်မာ')": '31eb6b1',
  "src/compat/index.d.ts compat.detectEncoding('က')": '31eb6b1',
  "src/compat/index.d.ts compat.detectEncoding('abc')": '31eb6b1',
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
