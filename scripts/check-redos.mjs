// Checks every regular expression the library ships for super-linear backtracking (ReDoS) with recheck.
//
// The library is src/ (its spec/ is not shipped: nothing in src/ imports it). The regexes come from four places, so
// that none is missed:
// - regex literals in src/**/*.js, and in bin/**/*.js, the knayi command, which reads untrusted input too
//   (SECURITY.md), found by parsing the files with acorn;
// - regexes built with RegExp(...), recorded by a hook on the global RegExp while the modules load and every
//   public call form of the 2.x API (compat) and the 3.0 API runs, and compat's legacyWinTables();
// - regexes in the modules' exports (the rule rows, the font sequences);
// - every regex a call form runs, recorded by hooks on RegExp.prototype. This also catches a regex that a
//   string method builds from a string, such as text.match('...'), which the RegExp hook cannot see.
// Every RegExp(...) call site in src/ must run while the hooks are on: a regex built from a string that never
// ran cannot be checked, so an unreached call site fails the check. The command's modules are not run here, so a
// RegExp(...) call site in bin/ always fails it: the command writes its regexes as literals.
//
// recheck must call each distinct pattern safe. A vulnerable verdict, or an unknown one (a timeout or an
// unsupported pattern), fails unless scripts/redos-allowlist.json lists the pattern with the reason it cannot
// take super-linear time in the library. An entry that matches no shipped pattern, or whose pattern recheck now
// calls safe, fails too, so the list only holds reviewed, current entries.
//
// Usage: node scripts/check-redos.mjs [--verbose] [--json <file>]
//   --verbose  print every pattern with its verdict and where it comes from
//   --json     write the full report to <file>

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.join(import.meta.dirname, '..');
const srcDir = path.join(root, 'src');
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

// The library files a stack frame may come from: src/**/*.js but spec/.
function shippedFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && full !== path.join(srcDir, 'spec')) files.push(...shippedFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}
const ownFiles = new Set(shippedFiles(srcDir));
// The command's files, read for their literals and call sites only (section 3).
const commandFiles = shippedFiles(path.join(root, 'bin'));

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

// The code that built or ran a regex: the first stack frame outside this script, skipping built-ins such as
// String.prototype.replace. Its site as 'src/x.js:line' when it is a library file, or null when it is not
// (myanmar-tools, which compat loads, has regexes of its own).
const FRAME = /\(?((?:file:\/\/)?[^\s()]+\.[cm]?js):(\d+):\d+\)?$/;
const thisScript = new URL(import.meta.url).pathname;
function librarySite() {
  const stack = new Error().stack.split('\n');
  for (const line of stack) {
    const match = FRAME.exec(line);
    if (!match) continue;
    const file = match[1].startsWith('file://') ? new URL(match[1]).pathname : match[1];
    if (file === thisScript) continue;
    return ownFiles.has(file) ? relative(file) + ':' + match[2] : null;
  }
  return null;
}

function keyOf(source, flags) {
  return '/' + source + '/' + flags;
}

// Every pattern found, by key: { source, flags, origins: Set of 'literal', 'built', 'export', 'run', sites }.
const patterns = new Map();
function addPattern(source, flags, origin, site) {
  const key = keyOf(source, flags);
  let entry = patterns.get(key);
  if (!entry) {
    entry = { key, source, flags, origins: new Set(), sites: new Set() };
    patterns.set(key, entry);
  }
  entry.origins.add(origin);
  if (site) entry.sites.add(site);
}

// ---- 1. Hooks on, load the library, run every call form, hooks off.

const NativeRegExp = globalThis.RegExp;
const builtSites = new Set(); // 'src/x.js:line' of each RegExp(...) call that ran
const savedStackLimit = Error.stackTraceLimit;
Error.stackTraceLimit = 50;

function recordBuilt(re) {
  const site = librarySite();
  if (!site) return;
  builtSites.add(site);
  addPattern(re.source, re.flags, 'built', site);
}

// While a hook records, the regexes it runs itself (FRAME) are not recorded.
let busy = false;

const RegExpHook = new Proxy(NativeRegExp, {
  construct(target, argList, newTarget) {
    const re = Reflect.construct(target, argList, newTarget === RegExpHook ? target : newTarget);
    if (!busy) record(recordBuilt, re);
    return re;
  },
  apply(target, thisArg, argList) {
    const re = Reflect.apply(target, thisArg, argList);
    if (!busy) record(recordBuilt, re);
    return re;
  }
});

function record(fn, re) {
  busy = true;
  try {
    fn(re);
  } finally {
    busy = false;
  }
}

// A call form runs the same regexes over and over, so each regex object, and each pattern already found in a
// library file, is looked up once: reading the stack every time would take most of the run.
const seenObjects = new WeakSet();
const runKeys = new Set();
function recordRun(re) {
  if (seenObjects.has(re)) return;
  seenObjects.add(re);
  const key = keyOf(re.source, re.flags);
  if (runKeys.has(key)) return;
  const site = librarySite();
  if (!site) return;
  runKeys.add(key);
  addPattern(re.source, re.flags, 'run', site);
}

const proto = NativeRegExp.prototype;
const hookedMethods = ['exec', 'test', Symbol.match, Symbol.matchAll, Symbol.replace, Symbol.search, Symbol.split];
const savedMethods = new Map(hookedMethods.map((name) => [name, proto[name]]));

function installHooks() {
  globalThis.RegExp = RegExpHook;
  for (const name of hookedMethods) {
    const original = savedMethods.get(name);
    proto[name] = function () {
      if (busy) return original.apply(this, arguments);
      record(recordRun, this);
      if (name !== Symbol.split) return original.apply(this, arguments);
      // split runs a sticky copy of the regex; the regex itself is recorded already. split takes no callback,
      // so no library regex runs inside it.
      busy = true;
      try {
        return original.apply(this, arguments);
      } finally {
        busy = false;
      }
    };
  }
}

function removeHooks() {
  globalThis.RegExp = NativeRegExp;
  for (const name of hookedMethods) proto[name] = savedMethods.get(name);
  Error.stackTraceLimit = savedStackLimit;
}

const ZWSP = String.fromCharCode(0x200B);
const ZWNJ = String.fromCharCode(0x200C);

// Short inputs that reach every branch of the public functions: Unicode, Zawgyi and Win text, numbers, spaces
// and zero-width characters, the other languages of the Myanmar blocks, and non-Myanmar text.
const INPUTS = [
  'မင်္ဂလာပါ', 'မဂၤလာပါ', 'ကျောင်းသား', 'ေက်ာင္းသား', 'မြန်မာ', 'ျမန္မာ', 'ဗုဒ္ဓ', 'ဗုဒၶ', 'တကၠသိုလ္',
  'နိုင်ငံ', 'သီဟိုဠ်', 'ၾကြ', 'ေၾကာင္း', 'ၿပီ', 'ႏိုင္ငံ', 'ညဥ့္', 'ဥ္', '၎', '၄င်း', 'ဝ၄င်း', '၁၀ ရက်',
  '၁၂:၃ဝ', '၇:၃၀', '၁၀.၅', 'က၀', 'က၀၁', 'ဝင်', 'ရက်', 'ကိီ', 'ကုူ', 'ဣ', 'ဩော်', 'ကြွှေိာ်', 'က္ကြွှေိာ်', 'ဿ', 'ႀကီး',
  'ၵႇ', '၀ႆ', 'သရၣ်', 'ၦ', 'ꩠꩡ', 'ꧠꧡ', 'ထွူလဲဥ်း', 'ေ', 'ြ', ' ့', 'က ့', 'က' + ZWSP + 'ာ', 'က' + ZWNJ + 'ာ',
  'jrefrm', 'aMomf', 'ps', 'OD', 'uydkf', String.fromCharCode(0xA1, 0xD3, 0x201A, 0x82), 'Hello world', '  ', '1.5',
  'မင်္ဂလာပါ ' + ZWSP + 'ကျေးဇူး - (ဗုဒ္ဓ) "ကို" [၁၂၃]', '>ကြ', '“ကြ', '‘ကြ', '—ကြ', '\tကြ\n'
];

// Some call forms throw (compat's syllBreak and truncate with the font name 'win' or an unknown one, the 3.0 API on
// an argument it refuses); the regexes they reach before throwing still count.
function attempt(fn) {
  try {
    fn();
  } catch (error) {
    if (!(error instanceof TypeError) && !(error instanceof RangeError)) throw error;
  }
}

// Every call form of the 2.x API, compat.
function runCallForms(knayi) {
  knayi.setGlobalOptions({ silent_mode: true });
  const fonts = ['unicode', 'zawgyi', 'win', null, undefined, 'uni', 'zaw', 'other'];
  for (const text of INPUTS) {
    knayi.normalize(text);
    knayi.fontDetect(text);
    knayi.fontDetect(text, 'unicode');
    knayi.fontDetect(text, null, { adapter: 'rules' });
    knayi.fontDetect(text, null, { adapter: 'myanmartools' });
    knayi.fontDetect(text, 'zawgyi', { use_myanmartools: true });
    for (const to of fonts) {
      for (const from of fonts) {
        attempt(() => knayi.fontConvert(text, to, from));
        attempt(() => knayi.fontConvert.debugging(text, to, from));
      }
    }
    for (const font of fonts) {
      attempt(() => knayi.syllBreak(text, font));
      attempt(() => knayi.syllBreak(text, font, '|'));
      attempt(() => knayi.spellingFix(text, font));
      for (const length of [3, 10, 30, 60, 120]) {
        attempt(() => knayi.truncate(text, { length, fontType: font }));
        attempt(() => knayi.truncate(text, { length, omission: '', fontType: font }));
      }
    }
  }
  // Missing and non-string content, and the options paths.
  for (const value of [null, undefined, '', 0, 42, true, {}, new String('ကြ')]) {
    attempt(() => knayi.normalize(value));
    attempt(() => knayi.fontDetect(value));
    attempt(() => knayi.fontConvert(value, 'unicode', 'zawgyi'));
    attempt(() => knayi.syllBreak(value));
    attempt(() => knayi.spellingFix(value));
    attempt(() => knayi.truncate(value));
  }
  knayi.setGlobalOptions({ detector: { myanmartools_zg_threshold: 'bad' } });
  knayi.setGlobalOptions({ detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] } });
}

// Every function of the 3.0 API, with each option that takes another path.
function runApiCallForms(api) {
  const detector = { getZawgyiProbability: (text) => (text.length % 2 ? 0.99 : 0.01) };
  for (const text of INPUTS) {
    api.isNormalized(text);
    api.normalize(text, { report: true, trace: api.createTrace() });
    api.explain(text, { zawgyiDetector: detector });
    api.detectEncoding(text);
    api.detectEncoding(text, { zawgyiDetector: detector, thresholds: [0.2, 0.8] });
    for (const from of ['zawgyi', 'win', undefined]) {
      attempt(() => api.toUnicode(text, { from, offsets: true, trace: api.createTrace() }));
      attempt(() => api.toUnicode(text, { from, tie: 'zawgyi', zawgyiDetector: detector }));
    }
    api.toZawgyi(text, { trace: api.createTrace() });
    for (const font of ['unicode', 'zawgyi']) {
      for (const policy of ['pairs', 'chains', 'separate']) {
        api.segmentSyllables(text, { font, policy });
        api.syllableBoundaries(text, { font, policy });
      }
      api.collapseRepeatedMarks(text, { font });
      for (const length of [3, 10, 30, 60]) api.truncate(text, { length, font, omission: '' });
    }
  }
  attempt(() => api.normalize(42));
  attempt(() => api.toUnicode('x', { from: 'Zawgyi' }));
}

// Loads the library with the hooks on (an import runs each module's top-level code, which builds its table rows),
// runs every call form, and keeps each module's exports.
installHooks();
const moduleExports = {};
const realConsole = { warn: console.warn, error: console.error };
try {
  console.warn = console.error = () => {};
  for (const file of [...ownFiles].sort()) moduleExports[relative(file)] = await import(pathToFileURL(file).href);
  runCallForms(moduleExports['src/compat/index.js'].default);
  runApiCallForms(moduleExports['src/index.js']);
  moduleExports['src/compat/legacy.js'].legacyWinTables();
} finally {
  removeHooks();
  console.warn = realConsole.warn;
  console.error = realConsole.error;
}

// ---- 2. Regexes in the modules' exports.

function findExportedRegexes(value, where, seen) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function') || seen.has(value)) return;
  seen.add(value);
  if (value instanceof NativeRegExp) {
    addPattern(value.source, value.flags, 'export', where);
    return;
  }
  for (const name of Object.getOwnPropertyNames(value)) {
    if (typeof value === 'function' && ['caller', 'callee', 'arguments', 'prototype'].includes(name)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (descriptor && 'value' in descriptor) findExportedRegexes(descriptor.value, where + '.' + name, seen);
  }
}
for (const [file, exported] of Object.entries(moduleExports)) findExportedRegexes(exported, file, new Set());

// ---- 3. Regex literals and RegExp(...) call sites in the source.

const acorn = require('acorn');
const callSites = []; // { site, reached }

function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) child.forEach((item) => walk(item, visit));
    else if (child && typeof child.type === 'string') walk(child, visit);
  }
}

for (const file of [...ownFiles].sort().concat(commandFiles.sort())) {
  const code = fs.readFileSync(file, 'utf8');
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true,
    allowHashBang: true });
  walk(ast, (node) => {
    const site = relative(file) + ':' + (node.loc && node.loc.start.line);
    if (node.type === 'Literal' && node.regex) {
      // Use the engine's own source text, which is what the other origins record.
      const re = new NativeRegExp(node.regex.pattern, node.regex.flags);
      addPattern(re.source, re.flags, 'literal', site);
    } else if ((node.type === 'NewExpression' || node.type === 'CallExpression') &&
      node.callee.type === 'Identifier' && node.callee.name === 'RegExp') {
      callSites.push({ site, reached: builtSites.has(site) });
    }
  });
}

// ---- 4. recheck every distinct pattern.

const { check } = await import('recheck');
const allowlistFile = path.join(import.meta.dirname, 'redos-allowlist.json');
const allowlist = JSON.parse(fs.readFileSync(allowlistFile, 'utf8')).allow;

// Fixed seed and generous limits, so verdicts do not depend on machine load.
const PARAMS = { randomSeed: 0, timeout: 60000 };
const entries = [...patterns.values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

async function checkAll(list, concurrency) {
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const entry = list[next++];
      const started = Date.now();
      try {
        entry.result = await check(entry.source, entry.flags, PARAMS);
      } catch (error) {
        entry.result = { status: 'unknown', error: { kind: 'unexpected', message: String(error && error.message) } };
      }
      entry.ms = Date.now() - started;
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

const startedAll = Date.now();
await checkAll(entries, 4);
const totalMs = Date.now() - startedAll;

// ---- 5. Report.

// Non-ASCII characters as \uXXXX, so patterns read the same in any terminal.
function printable(text) {
  return text.replace(/[^\x20-\x7e]/g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
}

function describe(entry) {
  const r = entry.result;
  if (r.status === 'safe') return 'safe (' + r.complexity.type + ', ' + r.checker + ')';
  if (r.status === 'vulnerable') {
    return 'VULNERABLE: ' + r.complexity.summary + ' (' + r.checker + '), attack ' + printable(r.attack.pattern);
  }
  return 'UNKNOWN: ' + (r.error ? r.error.kind + (r.error.message ? ' ' + r.error.message : '') : 'no result');
}

const failures = [];
for (const item of allowlist) {
  if (typeof item.source !== 'string' || typeof item.flags !== 'string' ||
    !['vulnerable', 'unknown'].includes(item.status) || typeof item.reason !== 'string' || item.reason.length < 40) {
    failures.push('allowlist entry ' + printable(JSON.stringify(item)).slice(0, 120) +
      ' needs source, flags, a status of vulnerable or unknown, and a reason');
  }
}
const allowed = new Set();
for (const entry of entries) {
  if (entry.result.status === 'safe') continue;
  const allow = allowlist.find((item) => item.source === entry.source && item.flags === entry.flags);
  if (allow && allow.status === entry.result.status) {
    allowed.add(allow);
    entry.allowed = allow.reason;
    continue;
  }
  failures.push(printable(entry.key) + ' from ' + [...entry.sites].sort().join(', ') + ': ' + describe(entry));
}
for (const item of allowlist) {
  if (allowed.has(item)) continue;
  const found = patterns.get(keyOf(item.source, item.flags));
  failures.push('allowlist entry ' + printable(keyOf(item.source, item.flags)) + ' is stale: ' +
    (found ? 'recheck now says ' + found.result.status : 'no shipped pattern matches it') + '; remove it');
}
for (const call of callSites) {
  if (!call.reached) failures.push('RegExp(...) at ' + call.site + ' never ran, so its pattern was not checked');
}

const byOrigin = {};
for (const entry of entries) for (const origin of entry.origins) byOrigin[origin] = (byOrigin[origin] || 0) + 1;
const byStatus = {};
for (const entry of entries) byStatus[entry.result.status] = (byStatus[entry.result.status] || 0) + 1;

if (verbose) {
  for (const entry of entries) {
    console.log(printable(entry.key));
    console.log('  ' + [...entry.origins].sort().join(', ') + ' at ' + [...entry.sites].sort().join(', '));
    console.log('  ' + describe(entry) + ' in ' + entry.ms + ' ms' +
      (entry.allowed ? '; allowed: ' + entry.allowed : ''));
  }
}

console.log('check:redos: ' + entries.length + ' distinct patterns (' +
  Object.entries(byOrigin).map(([origin, n]) => n + ' ' + origin).join(', ') + '), ' +
  callSites.length + ' RegExp(...) call sites, ' + callSites.filter((call) => call.reached).length + ' reached');
console.log('recheck ' + require('recheck/package.json').version + ' (backend ' +
  (process.env.RECHECK_BACKEND || 'auto') + '): ' +
  Object.entries(byStatus).map(([status, n]) => n + ' ' + status).join(', ') + ', ' + allowed.size +
  ' allowlisted, in ' + (totalMs / 1000).toFixed(1) + ' s');

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify(entries.map((entry) => ({
    source: entry.source,
    flags: entry.flags,
    origins: [...entry.origins].sort(),
    sites: [...entry.sites].sort(),
    status: entry.result.status,
    verdict: describe(entry),
    allowed: entry.allowed || null,
    ms: entry.ms
  })), null, 2) + '\n');
}

if (failures.length) {
  console.error('\n' + failures.length + ' problem(s):');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}
