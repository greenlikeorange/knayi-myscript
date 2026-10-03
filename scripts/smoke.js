// Smoke test for the Node versions below the test suite's floor. README says knayi runs on Node 16 or newer, but
// the suite needs Node 22 (node:test, the build tools), so CI builds on Node 22 and runs this on Node 16, 18 and 20.
// Plain Node only: no node:test, no dev dependencies.
//
//   node scripts/smoke.js [dist-dir]
//
// Runs README examples through main.js and the deep path library/converter. Given a directory of dist files, it
// also loads the script builds in a vm context and imports the .mjs build, and checks they return what main.js does.
// knayi-myscript.es.js is left out: it is for bundlers, and Node before 22 does not load ESM from a .js file here.

'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const url = require('url');
const vm = require('vm');

const root = path.join(__dirname, '..');
const knayi = require(path.join(root, 'main.js'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

// [label, call, expected result from main.js]. Examples from README.md.
const checks = [
  ['fontConvert Zawgyi to Unicode', (k) => k.fontConvert('မဂၤလာပါ', 'unicode', 'zawgyi'), 'မင်္ဂလာပါ'],
  ['fontConvert detected source', (k) => k.fontConvert('မဂၤလာပါ', 'unicode'), 'မင်္ဂလာပါ'],
  ['fontConvert Unicode to Zawgyi', (k) => k.fontConvert('မြန်မာ', 'zawgyi', 'unicode'), 'ျမန္မာ'],
  ['fontConvert Win to Unicode', (k) => k.fontConvert('jrefrm', 'unicode', 'win'), 'မြန်မာ'],
  ['fontConvert null', (k) => k.fontConvert(null, 'unicode'), ''],
  ['fontDetect Zawgyi', (k) => k.fontDetect('မဂၤလာပါ'), 'zawgyi'],
  ['fontDetect Unicode', (k) => k.fontDetect('မင်္ဂလာပါ'), 'unicode'],
  ['fontDetect null', (k) => k.fontDetect(null), 'en'],
  ['syllBreak', (k) => k.syllBreak('မြန်မာ', 'unicode', '|'), 'မြန်|မာ'],
  ['syllBreak Zawgyi', (k) => k.syllBreak('ၾကပါ', 'zawgyi', '|'), 'ၾက|ပါ'],
  ['syllBreak default breakpoint', (k) => k.syllBreak('မင်္ဂလာပါ'), 'မင်္ဂလာ' + String.fromCharCode(0x200b) + 'ပါ'],
  ['spellingFix', (k) => k.spellingFix('မင်္ဂလာာပါါ', 'unicode'), 'မင်္ဂလာပါ'],
  ['normalize order', (k) => k.normalize('ယောကျ်ား'), 'ယောက်ျား'],
  ['normalize lines', (k) => k.normalize('မိြုင်မိြုင်\nဆိုင်ဆုိင်'), 'မြိုင်မြိုင်\nဆိုင်ဆိုင်'],
  ['normalize digits', (k) => k.normalize('၂ဝ၁၉'), '၂၀၁၉'],
  ['truncate', (k) => k.truncate('က'), 'က...'],
  ['truncate long', (k) => k.truncate('အာယုဝဍ်ဎနဆေးညွှန်းစာကို ဇလွန်ဈေးဘေးဗာဒံပင်ထက် အဓိဋ္ဌာန်လျက် ဂဃနဏဖတ်ခဲ့သည်။', { length: 30, omission: '...' }), 'အာယုဝဍ်ဎနဆေးညွှန်းစာကို...'],
  ['debugging ends with the conversion', (k) => {
    const debug = k.fontConvert.debugging('ေယာက္်ား', 'unicode', 'zawgyi');
    return debug.steps[debug.steps.length - 1];
  }, 'ယောက်ျား']
];

let failures = 0;

function report(label, error) {
  if (error) {
    failures += 1;
    console.log('not ok - ' + label + '\n  ' + String(error.message).split('\n').join('\n  '));
  } else {
    console.log('ok - ' + label);
  }
}

function attempt(label, fn) {
  try {
    fn();
    report(label);
  } catch (error) {
    report(label, error);
  }
}

attempt('main.js exports', () => {
  for (const name of ['setGlobalOptions', 'fontDetect', 'fontConvert', 'syllBreak', 'spellingFix', 'truncate', 'normalize']) {
    assert.equal(typeof knayi[name], 'function', name);
  }
  assert.equal(knayi.version, pkg.version);
  assert.equal(knayi.default, knayi);
  assert.equal(typeof knayi.fontConvert.debugging, 'function');
});

attempt('library/converter deep path', () => {
  assert.equal(require(path.join(root, 'library', 'converter')), knayi.fontConvert);
});

// Silent mode stops the warning for a missing target font; the global options are restored afterwards.
attempt('setGlobalOptions silent_mode', () => {
  const warn = console.warn;
  const error = console.error;
  const logged = [];
  console.warn = console.error = function () { logged.push(Array.prototype.join.call(arguments, ' ')); };
  try {
    knayi.setGlobalOptions({ silent_mode: true });
    assert.equal(knayi.fontConvert('က'), 'က');
  } finally {
    knayi.setGlobalOptions({ silent_mode: false });
    console.warn = warn;
    console.error = error;
  }
  assert.deepEqual(logged, []);
});

// The checks pass null on purpose; silent mode keeps the warnings out of the output.
knayi.setGlobalOptions({ silent_mode: true });
const expected = checks.map((check) => check[2]);
for (const check of checks) {
  attempt('main.js ' + check[0], () => assert.equal(check[1](knayi), check[2]));
}

function compareBuild(name, build) {
  attempt(name + ' exports', () => {
    for (const key of Object.keys(knayi)) assert.equal(typeof build[key], typeof knayi[key], key);
    assert.equal(build.version, knayi.version);
  });
  build.setGlobalOptions({ silent_mode: true });
  checks.forEach((check, i) => {
    attempt(name + ' ' + check[0], () => assert.equal(check[1](build), expected[i]));
  });
}

function scriptBuild(dir, file) {
  const sandbox = { console: console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(dir, file), 'utf8'), sandbox, { filename: file });
  return sandbox.knayi;
}

async function main() {
  const dir = process.argv[2] ? path.resolve(process.argv[2]) : null;
  const builds = [];
  if (dir) {
    for (const file of ['knayi-myscript.min.js', 'knayi-myscript.js']) {
      attempt(file + ' loads', () => {
        const build = scriptBuild(dir, file);
        assert.equal(typeof build, 'object');
        builds.push([file, build]);
      });
    }
    try {
      const esm = await import(url.pathToFileURL(path.join(dir, 'knayi-myscript.mjs')).href);
      report('knayi-myscript.mjs loads');
      builds.push(['knayi-myscript.mjs', esm.default]);
    } catch (error) {
      report('knayi-myscript.mjs loads', error);
    }
    for (const entry of builds) compareBuild(entry[0], entry[1]);
  }
  console.log(
    'smoke on Node ' + process.versions.node + ': main.js' + (dir ? ' and ' + builds.length + ' builds from ' + dir : '') +
    ', ' + (failures ? failures + ' failed' : 'all passed')
  );
  if (failures) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
