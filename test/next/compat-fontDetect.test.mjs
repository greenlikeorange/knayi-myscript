// compat's fontDetect and the myanmar-tools adapter (src/compat/fontDetect.js, src/compat/zawgyiModel.js;
// docs/next/DESIGN.md §5.2 C13, C14, C26, §5.4). The adapter cases of test/adapter.test.js that need no package are
// ported here, with detectors that answer one probability; a case that checks the warning builds a notice of its own
// and passes it to fontDetectCore, so no case touches the shared one (D21). The one known build difference, that
// compat loads myanmar-tools by name nowhere, runs in child processes.

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './helpers.mjs';
import { assertSameAsReference, recordConsole, resetOptions } from './compat-helpers.mjs';
import { fontDetectCore } from '../../src/compat/fontDetect.js';
import { createNoDetectorNotice } from '../../src/compat/zawgyiModel.js';
import { setGlobalOptions, MESSAGES } from '../../src/compat/globalOptions.js';

const UNICODE = '\u1019\u1004\u103A\u1039\u1002\u101C\u102C\u1015\u102B';
const ZAWGYI = '\u1019\u1002\u1064\u101C\u102C\u1015\u102B';
const TIE = '\u1017\u102F\u1012\u1039\u1013';

const NOT_AVAILABLE = 'myanmar-tools is not available in this environment; fontDetect used the rule scorer.';

// A detector that answers one probability, and records the texts it was asked about.
function fixed(probability) {
  const asked = [];
  return { asked: asked, getZawgyiProbability: (text) => { asked.push(text); return probability; } };
}

const MODEL = Object.freeze({ adapter: 'myanmartools' });

afterEach(resetOptions);

describe('compat: fontDetect (C13, C14)', () => {
  // 2.11 ignores a fallback that is not a string (86f0040), and takes null options and checks the detector options
  // (fb6594d).
  it('C13: answers every fallback and options value as main.js does, console included',
    () => {
      const fallbacks = [undefined, null, '', 0, 'unicode', 'en', 5, {}];
      const options = [undefined, null, {}, 0, [], 'rules', { adapter: 'rules' }, { adapter: 'foo' },
        { myanmartools_zg_threshold: 'x' }, { myanmartools_zg_threshold: [NaN, NaN] }, { use_myanmartools: false }];
      for (const text of [UNICODE, ZAWGYI, TIE, ' \u200B' + TIE + ' ', 'abc', '']) {
        for (const fallback of fallbacks) {
          for (const option of options) {
            assertSameAsReference((k) => k.fontDetect(text, fallback, option),
              JSON.stringify([text, fallback, option]));
          }
        }
      }
    });

  it('C14: the rule scorer counts on the cleaned text, and a tie gives the fallback as given', () => {
    const fallback = { any: 'value' };
    assert.equal(fontDetectCore(TIE, fallback, {}), fallback);
    assert.equal(fontDetectCore(' ' + UNICODE + '\u200B', 'zawgyi', {}), 'unicode');
    assert.equal(fontDetectCore(ZAWGYI, 'unicode', {}), 'zawgyi');
    // null options are no options since 2.11 (fb6594d), where 2.10 threw a TypeError reading null.adapter.
    assert.equal(fontDetectCore(UNICODE, 'zawgyi', null), 'unicode');
  });
});

describe('compat: the myanmar-tools adapter (C13, C26)', () => {
  it('scores with the detector against the merged thresholds; both comparisons are strict', () => {
    const detect = (threshold, fallback) => fontDetectCore(UNICODE, fallback, { adapter: 'myanmartools',
      myanmartools_zg_threshold: threshold, zawgyiDetector: fixed(0.5) });
    assert.equal(detect([0.6, 1], 'en'), 'unicode');
    assert.equal(detect([0, 0.4], 'en'), 'zawgyi');
    assert.equal(detect([0.4, 0.6], 'en'), 'en');
    assert.equal(detect([0.5, 0.5], 'en'), 'en');
    setGlobalOptions({ detector: { myanmartools_zg_threshold: [0.6, 1], zawgyiDetector: fixed(0.5) } });
    assert.equal(fontDetectCore(UNICODE, 'en', MODEL), 'unicode');
  });

  it('chooses the detector for adapter \'myanmartools\', or for use_myanmartools unless the rules are asked for', () => {
    setGlobalOptions({ detector: { zawgyiDetector: fixed(1) } });
    assert.equal(fontDetectCore(UNICODE, 'en', MODEL), 'zawgyi');
    assert.equal(fontDetectCore(UNICODE, 'en', { adapter: 'foo' }), 'unicode');
    assert.equal(fontDetectCore(UNICODE, 'en', { adapter: 'foo', use_myanmartools: true }), 'zawgyi');
    setGlobalOptions({ detector: { use_myanmartools: true } });
    assert.equal(fontDetectCore(UNICODE, 'en', {}), 'zawgyi');
    assert.equal(fontDetectCore(UNICODE, 'en', { adapter: 'rules' }), 'unicode');
  });

  it('asks the detector of the call before the stored one, about the cleaned text', () => {
    const stored = fixed(1);
    const call = fixed(0);
    setGlobalOptions({ detector: { use_myanmartools: true, zawgyiDetector: stored } });
    assert.equal(fontDetectCore(' ' + ZAWGYI + '\u200B', 'en', { zawgyiDetector: call }), 'unicode');
    assert.deepEqual([call.asked, stored.asked], [[ZAWGYI], []]);
    assert.equal(fontDetectCore(UNICODE, 'en', {}), 'zawgyi');
    assert.deepEqual(stored.asked, [UNICODE]);
  });

  // 2.11 loads no package by name outside main.js (649b2b4), and compat, an ES module like 2.x's module build, loads
  // none at all: the adapter needs a detector.
  it('warns once and uses the rule scorer with no detector', () => {
    const notice = createNoDetectorNotice();
    const first = recordConsole(() => fontDetectCore(ZAWGYI, 'en', MODEL, notice));
    const second = recordConsole(() => fontDetectCore(ZAWGYI, 'en', MODEL, notice));
    assert.deepEqual(first, { value: 'zawgyi', console: ['warn: ' + NOT_AVAILABLE] });
    assert.deepEqual(second, { value: 'zawgyi', console: [] });
    assert.equal(MESSAGES.noDetector, NOT_AVAILABLE);
  });

  it('C26: a call in silent mode leaves the next call free to warn', () => {
    const notice = createNoDetectorNotice();
    setGlobalOptions({ silent_mode: true });
    assert.deepEqual(recordConsole(() => fontDetectCore(UNICODE, 'en', MODEL, notice)).console, []);
    setGlobalOptions({ silent_mode: false });
    assert.deepEqual(recordConsole(() => fontDetectCore(UNICODE, 'en', MODEL, notice)).console,
      ['warn: ' + NOT_AVAILABLE]);
    assert.deepEqual(recordConsole(() => fontDetectCore(UNICODE, 'en', MODEL, notice)).console, []);
  });
});

// The one known build difference (§5.4): main.js loads myanmar-tools by name, from the folder of its
// library/detection.js (here the copy of the 2.x reference in scripts/reference/, which finds the repository's
// node_modules), and compat loads it from nowhere, in any working directory, as 2.x's builds in dist/ do since
// 649b2b4. Each run is a child process, so the notice of this process is never touched.
describe('compat: myanmar-tools is loaded by name nowhere (§5.4)', () => {
  const script = [
    'import { createRequire } from \'node:module\';',
    'const require = createRequire(' + JSON.stringify(path.join(ROOT, 'package.json')) + ');',
    'const main = require(' + JSON.stringify(path.join(ROOT, 'scripts', 'reference', 'main.js')) + ');',
    'const compat = (await import(' + JSON.stringify(new URL('../../src/compat/index.js', import.meta.url).href) +
      ')).default;',
    'const warnings = [];',
    'console.warn = (message) => warnings.push(message);',
    'const options = () => ({ adapter: \'myanmartools\', myanmartools_zg_threshold: [-1, -1] });',
    'const text = ' + JSON.stringify(UNICODE) + ';',
    'const results = { main: main.fontDetect(text, null, options()),',
    '  compat: compat.fontDetect(text, null, options()) };',
    'console.log(JSON.stringify(Object.assign(results, { warnings })));'
  ].join('\n');

  // Bun installs a package it cannot resolve on the fly, from npm, where the current myanmar-tools (1.2.0) fails to
  // load; --no-install makes it fail to resolve, as Node does.
  const RUNTIME_FLAGS = process.versions.bun ? ['--no-install'] : [];

  function runIn(cwd) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knayi-compat-'));
    try {
      fs.writeFileSync(path.join(dir, 'lookup.mjs'), script);
      return JSON.parse(execFileSync(process.execPath, RUNTIME_FLAGS.concat([path.join(dir, 'lookup.mjs')]),
        { cwd: cwd || dir, encoding: 'utf8' }));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // Under the threshold [-1, -1], every model score means Zawgyi; the rules read this text as Unicode.
  for (const [where, cwd] of [['an empty working directory', null], ['the repository', ROOT]]) {
    it('in ' + where + ', main.js uses the model it loads, and compat the rules, with a warning', () => {
      assert.deepEqual(runIn(cwd), { main: 'zawgyi', compat: 'unicode', warnings: [NOT_AVAILABLE] });
    });
  }
});
