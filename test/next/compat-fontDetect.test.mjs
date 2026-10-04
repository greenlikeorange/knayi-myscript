// compat's fontDetect and the myanmar-tools loader (src/compat/fontDetect.js, src/compat/zawgyiModel.js;
// docs/next/DESIGN.md §5.2 C13, C14, C26, §5.4). The adapter cases of test/adapter.test.js are ported here: each
// builds its own loader with a stub require and passes it to fontDetectCore, so no case touches the shared loader
// (D21). The second known build difference, where myanmar-tools is looked up from, runs in child processes.

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './helpers.mjs';
import { assertSameAsReference, pendingPort, recordConsole, resetOptions } from './compat-helpers.mjs';
import { fontDetectCore } from '../../src/compat/fontDetect.js';
import { createZawgyiModelLoader } from '../../src/compat/zawgyiModel.js';
import { setGlobalOptions } from '../../src/compat/globalOptions.js';

const UNICODE = '\u1019\u1004\u103A\u1039\u1002\u101C\u102C\u1015\u102B';
const ZAWGYI = '\u1019\u1002\u1064\u101C\u102C\u1015\u102B';
const TIE = '\u1017\u102F\u1012\u1039\u1013';

const NOT_INSTALLED = 'myanmar-tools is not installed; fontDetect used the rule scorer. ' +
  'Install myanmar-tools@1.1.3 to use it.';
const NOT_AVAILABLE = 'myanmar-tools is not available in this environment; fontDetect used the rule scorer.';
const couldNotLoad = (firstLine) => 'myanmar-tools could not be loaded (' + firstLine + '); fontDetect used the rule ' +
  'scorer. Install myanmar-tools@1.1.3.';

// A require that fails as Node's does when the package is not installed.
function missingPackage() {
  const error = new Error('Cannot find module \'myanmar-tools\'\nRequire stack:\n- /app/index.js');
  error.code = 'MODULE_NOT_FOUND';
  throw error;
}

// A package whose model gives `probability` for every text, and counts how often it was loaded.
function fakePackage(probability, loads) {
  return () => {
    loads.push(1);
    return { ZawgyiDetector: function ZawgyiDetector() { this.getZawgyiProbability = () => probability; } };
  };
}

const MODEL = Object.freeze({ adapter: 'myanmartools' });

afterEach(resetOptions);

describe('compat: fontDetect (C13, C14)', () => {
  // 2.11 ignores a fallback that is not a string (86f0040), and takes null options and checks the detector options
  // (fb6594d).
  it('C13: answers every fallback and options value as main.js does, console included',
    pendingPort(['86f0040', 'fb6594d'], () => {
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
    }));

  it('C14: the rule scorer counts on the cleaned text, and a tie gives the fallback as given', () => {
    const fallback = { any: 'value' };
    assert.equal(fontDetectCore(TIE, fallback, {}), fallback);
    assert.equal(fontDetectCore(' ' + UNICODE + '\u200B', 'zawgyi', {}), 'unicode');
    assert.equal(fontDetectCore(ZAWGYI, 'unicode', {}), 'zawgyi');
    assert.throws(() => fontDetectCore(UNICODE, 'zawgyi', null), TypeError);
  });
});

describe('compat: the myanmar-tools adapter (C13, C26)', () => {
  it('scores with the model against the merged thresholds; both comparisons are strict', () => {
    const loader = createZawgyiModelLoader(fakePackage(0.5, []));
    const detect = (threshold, fallback) => fontDetectCore(UNICODE, fallback, { adapter: 'myanmartools',
      myanmartools_zg_threshold: threshold }, loader);
    assert.equal(detect([0.6, 1], 'en'), 'unicode');
    assert.equal(detect([0, 0.4], 'en'), 'zawgyi');
    assert.equal(detect([0.4, 0.6], 'en'), 'en');
    assert.equal(detect([0.5, 0.5], 'en'), 'en');
    setGlobalOptions({ detector: { myanmartools_zg_threshold: [0.6, 1] } });
    assert.equal(fontDetectCore(UNICODE, 'en', MODEL, loader), 'unicode');
  });

  it('chooses the model for adapter \'myanmartools\', or for use_myanmartools unless the rules are asked for', () => {
    const loader = createZawgyiModelLoader(fakePackage(1, []));
    assert.equal(fontDetectCore(UNICODE, 'en', MODEL, loader), 'zawgyi');
    assert.equal(fontDetectCore(UNICODE, 'en', { adapter: 'foo' }, loader), 'unicode');
    assert.equal(fontDetectCore(UNICODE, 'en', { adapter: 'foo', use_myanmartools: true }, loader), 'zawgyi');
    setGlobalOptions({ detector: { use_myanmartools: true } });
    assert.equal(fontDetectCore(UNICODE, 'en', {}, loader), 'zawgyi');
    assert.equal(fontDetectCore(UNICODE, 'en', { adapter: 'rules' }, loader), 'unicode');
  });

  it('loads the package once, by the first call that needs it', () => {
    const loads = [];
    const loader = createZawgyiModelLoader(fakePackage(1, loads));
    assert.equal(fontDetectCore(UNICODE, 'en', {}, loader), 'unicode');
    assert.equal(loads.length, 0);
    for (let i = 0; i < 3; i++) fontDetectCore(UNICODE, 'en', MODEL, loader);
    assert.equal(loads.length, 1);
  });

  const FAILURES = [
    ['a package that is not installed', missingPackage, NOT_INSTALLED],
    ['a package that fails inside', () => {
      const error = new Error('Cannot find module \'./build_node/index.js\'\nRequire stack:\n- x');
      error.code = 'MODULE_NOT_FOUND';
      throw error;
    }, couldNotLoad('Cannot find module \'./build_node/index.js\'')],
    ['a package without ZawgyiDetector', () => ({}), couldNotLoad('the package has no ZawgyiDetector export')],
    ['a model that fails to build', () => ({ ZawgyiDetector: function () { throw new TypeError('bad model'); } }),
      couldNotLoad('bad model')],
    ['a runtime with no Node-style require', () => null, NOT_AVAILABLE]
  ];
  for (const [what, requireFn, message] of FAILURES) {
    it('warns once and uses the rule scorer for ' + what, () => {
      const loader = createZawgyiModelLoader(requireFn);
      const first = recordConsole(() => fontDetectCore(ZAWGYI, 'en', MODEL, loader));
      const second = recordConsole(() => fontDetectCore(ZAWGYI, 'en', MODEL, loader));
      assert.deepEqual(first, { value: 'zawgyi', console: ['warn: ' + message] });
      assert.deepEqual(second, { value: 'zawgyi', console: [] });
      assert.equal(loader.missingMessage(), message);
    });
  }

  it('C26: a call in silent mode leaves the next call free to warn', () => {
    const loader = createZawgyiModelLoader(missingPackage);
    setGlobalOptions({ silent_mode: true });
    assert.deepEqual(recordConsole(() => fontDetectCore(UNICODE, 'en', MODEL, loader)).console, []);
    setGlobalOptions({ silent_mode: false });
    assert.deepEqual(recordConsole(() => fontDetectCore(UNICODE, 'en', MODEL, loader)).console,
      ['warn: ' + NOT_INSTALLED]);
    assert.deepEqual(recordConsole(() => fontDetectCore(UNICODE, 'en', MODEL, loader)).console, []);
  });
});

// The second known build difference (§5.4): main.js looks myanmar-tools up from the directory of its detector.js
// (library/ in the package; here the copy of the 2.x reference in scripts/reference/), compat from the working
// directory. Each run is a child process, so the shared loader of this process is never touched. 2.11 loads nothing
// by name outside main.js (649b2b4), and compat follows with its port: these cases then change.
describe('compat: where myanmar-tools is looked up from (§5.4)', () => {
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

  it('in a working directory that cannot resolve the package, main.js uses the model and compat the rules', () => {
    // Under the threshold [-1, -1], every model score means Zawgyi; the rules read this text as Unicode.
    assert.deepEqual(runIn(null), { main: 'zawgyi', compat: 'unicode', warnings: [NOT_INSTALLED] });
  });

  it('in the repository, both use the model', () => {
    assert.deepEqual(runIn(ROOT), { main: 'zawgyi', compat: 'zawgyi', warnings: [] });
  });
});
