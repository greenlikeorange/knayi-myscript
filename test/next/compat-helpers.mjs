// Shared by compat's tests (test/next/compat-*.test.mjs, docs/next/DESIGN.md §7.10): the live 2.x library and
// compat side by side, and a console recorder.
//
// compat's tests compare with the live main.js and library/, not with scripts/oracle/: compat follows the 2.x line
// port by port (D19). Byte identity with the reference commit itself is compare's and the matrix's job.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import compat from '../../src/compat/index.js';

const require = createRequire(import.meta.url);

// main.js of this checkout: the 2.x API compat reproduces.
export const reference = require('../../main.js');
export { compat };

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace'];

// The state every test starts from and goes back to: the 2.x defaults (globalOptions.js:1-7).
export const DEFAULT_OPTIONS = Object.freeze({
  silent_mode: false,
  detector: Object.freeze({ use_myanmartools: false, myanmartools_zg_threshold: Object.freeze([0.05, 0.95]) })
});

// Sets both libraries back to the defaults. Each store keeps a copy of the threshold it is given.
export function resetOptions() {
  for (const knayi of [reference, compat]) knayi.setGlobalOptions(DEFAULT_OPTIONS);
}

// Runs fn with the console recorded instead of printed: { value } or { throws, error }, and console, the lines
// written, as 'level: text'.
export function recordConsole(fn) {
  const lines = [];
  const saved = {};
  for (const method of CONSOLE_METHODS) {
    saved[method] = console[method];
    console[method] = (...args) => lines.push(method + ': ' + args.map(String).join(' '));
  }
  try {
    return { value: fn(), console: lines };
  } catch (error) {
    return { throws: error && error.constructor ? error.constructor.name : typeof error, error, console: lines };
  } finally {
    for (const method of CONSOLE_METHODS) console[method] = saved[method];
  }
}

// What a call gave, in a form two libraries can be compared by: the value (or the error class) and the console.
export function outcome(call, knayi) {
  const run = recordConsole(() => call(knayi));
  return run.throws ? { throws: run.throws, console: run.console } : { value: run.value, console: run.console };
}

// Asserts that compat gives what main.js gives for call, from the default options.
export function assertSameAsReference(call, what) {
  resetOptions();
  const expected = outcome(call, reference);
  resetOptions();
  const actual = outcome(call, compat);
  resetOptions();
  assert.deepEqual(actual, expected, what);
}
