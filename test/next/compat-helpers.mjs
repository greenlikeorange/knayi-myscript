// Shared by compat's tests (test/next/compat-*.test.mjs, docs/next/DESIGN.md §7.10): the 2.x library at the
// reference and compat side by side, and a console recorder.
//
// compat's tests compare with the 2.x library at the 2.x reference, commit 8923365 (until v2.11.0 is tagged): its
// main.js and library/, byte for byte in scripts/reference/, which a port of the 2.x line moves to the new reference
// (DESIGN.md §8). A test of a 2.x change compat does not have yet waits for its port with pendingPort
// (scripts/testing/pending-port.js). Byte identity on every input is compare's and the matrix's job.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import compat from '../../src/compat/index.js';

const require = createRequire(import.meta.url);

// main.js at the reference (scripts/reference/main.js): the 2.x API compat reproduces.
export const reference = require('../../scripts/reference/main.js');
export { compat };

// A test of a 2.x change compat does not have yet, it(name, pendingPort(commit, fn)): it passes while fn fails.
export const { pendingPort } = require('../../scripts/testing/pending-port.js');

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace'];

// The state every test starts from and goes back to: the 2.x defaults (2.11's library/globalOptions.js OPTIONS).
export const DEFAULT_OPTIONS = Object.freeze({
  silent_mode: false,
  detector: Object.freeze({ use_myanmartools: false, myanmartools_zg_threshold: Object.freeze([0.05, 0.95]),
    zawgyiDetector: null })
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

// What a call gave, in a form two libraries can be compared by: the value, or the error class, and the console. An
// error knayi throws on purpose has a string code, and its code and message count too, as in the contract matrix.
export function outcome(call, knayi) {
  const run = recordConsole(() => call(knayi));
  if (!run.throws) return { value: run.value, console: run.console };
  if (!run.error || typeof run.error.code !== 'string') return { throws: run.throws, console: run.console };
  return { throws: run.throws, code: run.error.code, message: run.error.message, console: run.console };
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
