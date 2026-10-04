'use strict';
// The API contract matrix of the 2.x API: every public function and call form, run on fixed synthetic probes. Each
// call is one cell, which records the value the call returned and its type, the error it threw and what it wrote to
// the console. test/contract/api-matrix.test.js (Node) and scripts/bun-matrix.js (Bun) check compat (the 2.x API on
// the 3.0 core), the 3.0 builds that hold it and main.js at the 2.x reference against test/contract/api-matrix.json,
// and `npm run matrix:update` rewrites that file from that main.js.
//
// Errors. The library throws no error of its own today: every throw in the matrix is an accident of the code,
// such as a TypeError from reading a property of undefined. The wording of those messages belongs to the
// runtime and to the build (on Bun, main.js says "evaluating 'rules.length'" where min.js says "'r.length'"), so
// a cell records only their class. An error the library throws on purpose carries a string `code` property;
// for those a cell also records the code and the full message.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const SNAPSHOT = path.join(ROOT, 'test', 'contract', 'api-matrix.json');

// The builds the matrix runs on. main.js is the source of truth: 2.x's main.js at the reference, commit e5f6e24,
// frozen with the 2.x library in scripts/oracle/ (docs/next/DESIGN.md §1.1, D19). `compat` is the 2.x API on the 3.0
// core, src/compat/index.js (§5), imported as the ES module it is. The 3.0 dist files that hold the 2.x API come from
// a fresh build of this checkout in a temporary directory, or from KNAYI_DIST when it is set (`KNAYI_DIST=dist`
// checks the committed release build); see builtDist() in scripts/build.js: the compat module build, imported, and
// the two script builds, run in a vm: knayi.compat of knayi.min.js, and knayi of knayi-myscript.min.js, 2.x's name.
const BUILDS = ['main.js', 'compat', 'knayi-myscript-compat.min.mjs', 'knayi.min.js', 'knayi-myscript.min.js'];

// The 2.x API in the global of each script build (scripts/build.js).
const SCRIPT_COMPAT = { 'knayi.min.js': (knayi) => knayi.compat, 'knayi-myscript.min.js': (knayi) => knayi };

// The module of each build that is not a dist file.
const REFERENCE_MAIN = path.join(ROOT, 'scripts', 'oracle', 'main.js');
const COMPAT = path.join(ROOT, 'src', 'compat', 'index.js');

// A build whose known differences are exactly those of another build, so the snapshot records them once, under
// that build, which comes before it in BUILDS. The 3.0 builds are made from compat's sources and are strict like
// them, so they differ from main.js in the same cells, the same way (docs/next/DESIGN.md §5.4, D2).
// `npm run matrix:update` checks that this still holds.
const SHARES_RECORDED_DIFFERENCES = {
  'knayi-myscript-compat.min.mjs': 'compat', 'knayi.min.js': 'compat', 'knayi-myscript.min.js': 'compat'
};

// Cells in which a build is expected to differ from main.js, with the reason. `npm run matrix:update` refuses to
// record a build difference that no entry here explains.
const KNOWN_BUILD_DIFFERENCES = [
  {
    name: 'debug flag read from this',
    builds: ['compat', 'knayi-myscript-compat.min.mjs', 'knayi.min.js', 'knayi-myscript.min.js'],
    matches: (id) => id.indexOf('detached fontConvert(') === 0,
    reason: 'fontConvert reads its debug flag from `this` (2.x converter.js fontConvert). A detached call in ' +
      'sloppy code (2.x\'s CommonJS main.js) reads the global object, so a global `debug` variable turns on the ' +
      'debugging output. compat is a strict ES module, and its 3.0 builds are strict too: `this` is undefined ' +
      'there, and the call returns text.'
  }
];

// Probes. Synthetic values only: no corpus text goes into the repository.
const ZAWGYI = '\u103B\u1019\u1014\u1039\u1019\u102C'; // "Myanmar" in Zawgyi
const UNICODE = '\u1019\u103C\u1014\u103A\u1019\u102C'; // the same word in Unicode

const CONTENTS = [
  ['undefined', undefined],
  ['null', null],
  ['empty', ''],
  ['zero', 0],
  ['false', false],
  ['NaN', NaN],
  ['number', 123],
  ['true', true],
  ['object', {}],
  ['array', []],
  ['stringObject', new String(ZAWGYI)],
  ['ascii', '  abc  '],
  ['win', 'jrefrm'], // the same word typed for a Win Innwa font
  ['winSpaces', '  jrefrm '],
  ['zawgyi', ZAWGYI],
  ['unicode', UNICODE],
  ['tie', '\u1017\u102F\u1012\u1039\u1013'], // a Pali stack: the detector's rule scores tie
  ['spaced', ' \u1019\u103C\u1014\u103A\u200B\u1019\u102C '], // spaces around, a zero-width space inside
  ['extA', '\uAA60\uAA61'], // Myanmar Extended-A letters only, outside U+1000-U+109F
  ['mixed', ZAWGYI + '\n' + UNICODE]
];

const FONTS = [undefined, null, '', 'unicode', 'uni', 'zawgyi', 'zaw', 'win', 'Unicode', 'ZAWGYI', 'foo',
  'constructor', '__proto__', 'toString', 0, 1];

const DETECTOR_OPTIONS = [undefined, null, {}, { adapter: 'rules' }, { adapter: 'foo' },
  { myanmartools_zg_threshold: 'x' }, { myanmartools_zg_threshold: [NaN, NaN] }];

const TRUNCATE_OPTIONS = [undefined, null, 0, {}, { length: 0 }, { omission: '' }, { length: 4, omission: '\u2026' },
  { fontType: 'win' }, { fontType: 'Unicode' }];

const GLOBAL_OPTIONS = [undefined, null, {}, { silent_mode: false },
  { detector: null }, { detector: { myanmartools_zg_threshold: [1] } }];

// Targets and sources for the two debugging forms that the first section leaves out.
const DEBUG_FONTS = [undefined, null, 'unicode', 'zawgyi', 'win', 'foo', 'constructor'];

// Functions passed straight to Array#map, which calls them with (value, index, array).
const MAP_FUNCTIONS = [
  ['fontDetect', (k) => k.fontDetect],
  ['fontConvert', (k) => k.fontConvert],
  ['fontConvert.debugging', (k) => k.fontConvert.debugging],
  ['syllBreak', (k) => k.syllBreak],
  ['spellingFix', (k) => k.spellingFix],
  ['truncate', (k) => k.truncate],
  ['normalize', (k) => k.normalize]
];
// A document of mixed lines, as in lines.map(knayi.normalize).
const LINES = ['unicode', 'zawgyi', 'tie', 'win', 'ascii', 'empty', 'null', 'mixed'];

// Calls that write to the console, or would if silent mode did not stop them, run with silent mode on and off.
const SILENT_FORMS = [
  [(c) => `fontDetect(${c})`, (k, content) => k.fontDetect(content)],
  [(c) => `fontDetect(${c}, null, {myanmartools_zg_threshold: 'x'})`,
    (k, content, make) => k.fontDetect(content, null, make({ myanmartools_zg_threshold: 'x' }))],
  [(c) => `fontConvert(${c})`, (k, content) => k.fontConvert(content)],
  [(c) => `fontConvert(${c}, 'unicode')`, (k, content) => k.fontConvert(content, 'unicode')],
  [(c) => `fontConvert(${c}, 'foo', 'unicode')`, (k, content) => k.fontConvert(content, 'foo', 'unicode')],
  [(c) => `fontConvert(${c}, 'zawgyi', 'win')`, (k, content) => k.fontConvert(content, 'zawgyi', 'win')],
  [(c) => `fontConvert.debugging(${c}, 'unicode')`, (k, content) => k.fontConvert.debugging(content, 'unicode')],
  [(c) => `syllBreak(${c})`, (k, content) => k.syllBreak(content)],
  [(c) => `spellingFix(${c})`, (k, content) => k.spellingFix(content)],
  [(c) => `truncate(${c})`, (k, content) => k.truncate(content)],
  [(c) => `normalize(${c})`, (k, content) => k.normalize(content)]
];
// Other values for silent_mode: the option stores whatever it is given, and any truthy value is silent.
const SILENT_VALUES = [1, 0, 'false', '', null, undefined];

// The state every cell starts from.
const DEFAULT_OPTIONS = {
  silent_mode: false,
  detector: { use_myanmartools: false, myanmartools_zg_threshold: [0.05, 0.95] }
};

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace'];

let definedCells = null;

// The cells in their recorded order: { id, run(knayi, make, global) }. `make` copies a probe into the build's
// realm, fresh for every call; `global` is the build's global object.
function defineCells() {
  if (definedCells) return definedCells;
  const cells = [];
  const ids = new Set();
  function add(id, run) {
    if (ids.has(id)) throw new Error('two matrix cells have the id ' + id);
    ids.add(id);
    cells.push({ id: id, run: run });
  }

  // 1. Every function with every font name, options object and content probe.
  for (const [name, content] of CONTENTS) {
    for (const font of FONTS) {
      const f = show(font);
      add(`fontDetect(${name}, ${f})`, (k, make) => k.fontDetect(make(content), font));
      add(`fontConvert(${name}, ${f})`, (k, make) => k.fontConvert(make(content), font));
      add(`fontConvert(${name}, 'unicode', ${f})`, (k, make) => k.fontConvert(make(content), 'unicode', font));
      add(`fontConvert(${name}, 'zawgyi', ${f})`, (k, make) => k.fontConvert(make(content), 'zawgyi', font));
      add(`fontConvert.debugging(${name}, 'unicode', ${f})`,
        (k, make) => k.fontConvert.debugging(make(content), 'unicode', font));
      add(`syllBreak(${name}, ${f}, '|')`, (k, make) => k.syllBreak(make(content), font, '|'));
      add(`spellingFix(${name}, ${f})`, (k, make) => k.spellingFix(make(content), font));
    }
    for (const options of DETECTOR_OPTIONS) {
      add(`fontDetect(${name}, null, ${show(options)})`, (k, make) => k.fontDetect(make(content), null, make(options)));
    }
    for (const options of TRUNCATE_OPTIONS) {
      add(`truncate(${name}, ${show(options)})`, (k, make) => k.truncate(make(content), make(options)));
    }
    add(`normalize(${name})`, (k, make) => k.normalize(make(content)));
    add(`normalize(${name}, 1)`, (k, make) => k.normalize(make(content), 1));
  }

  // A detached call while the page or app has a global variable named `debug`.
  for (const [name, content] of CONTENTS) {
    add(`detached fontConvert(${name}, 'unicode'), global debug`, (k, make, global) => {
      const convert = k.fontConvert;
      return withGlobalDebug(global, () => convert(make(content), 'unicode'));
    });
    add(`detached fontConvert(${name}, 'zawgyi', 'unicode'), global debug`, (k, make, global) => {
      const convert = k.fontConvert;
      return withGlobalDebug(global, () => convert(make(content), 'zawgyi', 'unicode'));
    });
  }
  for (const options of GLOBAL_OPTIONS) {
    add(`setGlobalOptions(${show(options)})`, (k, make) => k.setGlobalOptions(make(options)));
  }

  // 2. The other two debugging forms: no source font, and Unicode to Zawgyi, whose rule labels are debug output.
  for (const [name, content] of CONTENTS) {
    for (const font of DEBUG_FONTS) {
      const f = show(font);
      add(`fontConvert.debugging(${name}, ${f})`, (k, make) => k.fontConvert.debugging(make(content), font));
      add(`fontConvert.debugging(${name}, 'zawgyi', ${f})`,
        (k, make) => k.fontConvert.debugging(make(content), 'zawgyi', font));
    }
  }

  // 3. Every function as an Array#map callback: the index arrives as the second argument, the array as the third.
  for (const [fn, pick] of MAP_FUNCTIONS) {
    for (const [name, content] of CONTENTS) {
      add(`[${name}, ${name}, ${name}].map(${fn})`, (k, make) => make([content, content, content]).map(pick(k)));
    }
    add(`[${LINES.join(', ')}].map(${fn})`, (k, make) => make(LINES.map(probe)).map(pick(k)));
  }

  // 4. Silent mode on and off.
  for (const silent of [true, false]) {
    const set = `setGlobalOptions({silent_mode: ${silent}}); `;
    for (const [name, content] of CONTENTS) {
      for (const [label, call] of SILENT_FORMS) {
        add(set + label(name), (k, make) => {
          k.setGlobalOptions(make({ silent_mode: silent }));
          return call(k, make(content), make);
        });
      }
    }
    add(set + 'setGlobalOptions({detector: {myanmartools_zg_threshold: [1]}})', (k, make) => {
      k.setGlobalOptions(make({ silent_mode: silent }));
      return k.setGlobalOptions(make({ detector: { myanmartools_zg_threshold: [1] } }));
    });
  }
  for (const value of SILENT_VALUES) {
    add(`setGlobalOptions({silent_mode: ${show(value)}}); fontConvert(undefined, 'unicode')`, (k, make) => {
      k.setGlobalOptions(make({ silent_mode: value }));
      return k.fontConvert(undefined, 'unicode');
    });
  }
  add("setGlobalOptions({silent_mode: true}); setGlobalOptions({detector: {}}); fontConvert(undefined, 'unicode')",
    (k, make) => {
      k.setGlobalOptions(make({ silent_mode: true }));
      k.setGlobalOptions(make({ detector: {} }));
      return k.fontConvert(undefined, 'unicode');
    });
  add("setGlobalOptions({silent_mode: true}); setGlobalOptions(); fontConvert(undefined, 'unicode')", (k, make) => {
    k.setGlobalOptions(make({ silent_mode: true }));
    k.setGlobalOptions();
    return k.fontConvert(undefined, 'unicode');
  });

  definedCells = cells;
  return cells;
}

function probe(name) {
  for (const [key, value] of CONTENTS) if (key === name) return value;
  throw new Error('no probe named ' + name);
}

function withGlobalDebug(global, call) {
  global.debug = true;
  try {
    return call();
  } finally {
    delete global.debug;
  }
}

// --- Builds ---------------------------------------------------------------------------------------------------

function distDir() {
  return require('../build').builtDist();
}

function runtimeName() {
  return typeof Bun !== 'undefined' ? 'Bun ' + Bun.version : 'Node ' + process.version;
}

// Loads one build: { name, label, knayi, global, make, logs, startCapture, stopCapture }.
async function loadBuild(name) {
  const logs = [];
  if (name === 'main.js') {
    return hostBuild(name, path.relative(ROOT, REFERENCE_MAIN), require(REFERENCE_MAIN), logs);
  }
  if (name === 'compat') {
    const module = await import(pathToFileURL(COMPAT).href);
    return hostBuild(name, path.relative(ROOT, COMPAT), module.default, logs);
  }
  const file = path.join(distDir(), name);
  const relative = path.relative(ROOT, file);
  const label = relative && relative.indexOf('..') !== 0 ? relative
    : process.env.KNAYI_DIST ? file : name + ' (temporary build)';
  if (name === 'knayi-myscript-compat.min.mjs') {
    const module = await import(pathToFileURL(file).href);
    return hostBuild(name, label, module.default, logs);
  }
  if (SCRIPT_COMPAT[name]) {
    // As a browser runs it: a classic script in its own global object, with no `process` or `require`. The global
    // `knayi` of knayi.min.js is the 3.0 API, and knayi.compat the 2.x API; that of knayi-myscript.min.js the 2.x
    // API, as in 2.x.
    const consoleObject = {};
    for (const method of CONSOLE_METHODS) {
      consoleObject[method] = function () { logs.push(consoleLine(method, arguments)); };
    }
    const sandbox = { console: consoleObject };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
    const realm = vm.runInContext('({ Object: Object, Array: Array, String: String })', sandbox);
    return {
      name: name,
      label: label + ' (in a vm)',
      knayi: SCRIPT_COMPAT[name](sandbox.knayi),
      global: sandbox,
      make: copier(realm),
      logs: logs,
      startCapture: () => {},
      stopCapture: () => {}
    };
  }
  throw new Error('unknown build ' + name);
}

function hostBuild(name, label, knayi, logs) {
  let saved = null;
  return {
    name: name,
    label: label,
    knayi: knayi,
    global: globalThis,
    make: copier({ Object: Object, Array: Array, String: String }),
    logs: logs,
    startCapture: () => {
      saved = {};
      for (const method of CONSOLE_METHODS) {
        saved[method] = console[method];
        console[method] = function () { logs.push(consoleLine(method, arguments)); };
      }
    },
    stopCapture: () => {
      for (const method of CONSOLE_METHODS) console[method] = saved[method];
      saved = null;
    }
  };
}

function consoleLine(method, args) {
  return method + ': ' + Array.prototype.map.call(args, (arg) => (typeof arg === 'string' ? arg : show(arg))).join(' ');
}

// Copies a probe into a realm, so that the min.js build sees objects, arrays and String objects of its own global
// object, as on a web page. Every call makes a fresh copy, so a call that changes its argument cannot reach the
// next cell.
function copier(realm) {
  function make(value) {
    if (value === null || typeof value !== 'object') return value;
    if (value instanceof String) return new realm.String(String(value));
    if (Array.isArray(value)) {
      const array = new realm.Array();
      for (const item of value) array.push(make(item));
      return array;
    }
    const object = new realm.Object();
    for (const key of Object.keys(value)) object[key] = make(value[key]);
    return object;
  }
  return make;
}

// --- Running cells --------------------------------------------------------------------------------------------

function resetOptions(build) {
  build.knayi.setGlobalOptions(build.make(DEFAULT_OPTIONS));
}

function runCell(build, cell) {
  const record = { id: cell.id };
  build.logs.length = 0;
  build.startCapture();
  try {
    const out = cell.run(build.knayi, build.make, build.global);
    record.type = typeof out;
    if (out !== undefined) record.out = encode(out);
  } catch (error) {
    Object.assign(record, describeError(error));
  } finally {
    build.stopCapture();
  }
  if (build.logs.length) record.console = build.logs.slice();
  resetOptions(build);
  return record;
}

// Runs every cell on a build and returns the records in recorded order. `reverse` runs them last to first, which
// shows whether one cell leaves state behind for another.
function runCells(build, options) {
  const cells = defineCells();
  const records = new Array(cells.length);
  const order = cells.map((cell, i) => i);
  if (options && options.reverse) order.reverse();
  resetOptions(build);
  for (const i of order) records[i] = runCell(build, cells[i]);
  return records;
}

function describeError(error) {
  if (error === null || (typeof error !== 'object' && typeof error !== 'function')) {
    return { throws: 'a ' + typeof error, message: String(error) };
  }
  const ctor = error.constructor;
  const name = ctor && typeof ctor.name === 'string' && ctor.name ? ctor.name : String(error.name);
  if (Object.prototype.hasOwnProperty.call(error, 'code') && typeof error.code === 'string') {
    return { throws: name, code: error.code, message: String(error.message) };
  }
  return { throws: name };
}

// A return value as JSON. Values JSON has no form for become { "$": ... }.
function encode(value) {
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value;
    case 'number':
      if (Object.is(value, -0)) return { $: '-0' };
      return isFinite(value) ? value : { $: String(value) };
    case 'undefined':
      return { $: 'undefined' };
    case 'object': {
      if (value === null) return null;
      if (Array.isArray(value)) return Array.from(value, encode);
      if (Object.prototype.toString.call(value) === '[object String]') return { $: 'String', value: String(value) };
      const out = {};
      for (const key of Object.keys(value)) out[key] = encode(value[key]);
      return out;
    }
    default:
      return { $: typeof value };
  }
}

function encodedProbes() {
  const probes = {};
  for (const [name, value] of CONTENTS) probes[name] = encode(value);
  return probes;
}

// --- Snapshot -------------------------------------------------------------------------------------------------

function readSnapshot(file) {
  return JSON.parse(fs.readFileSync(file || SNAPSHOT, 'utf8'));
}

// One cell per line, so that a change shows up in a diff as the cells it touched.
function formatSnapshot(cells, known) {
  const lines = [
    '{',
    '  "about": ' + JSON.stringify('API contract matrix of the 2.x API. Generated by `npm run matrix:update` from ' +
      'main.js at the 2.x reference (scripts/oracle/main.js); ' +
      'checked by test/contract/api-matrix.test.js and scripts/bun-matrix.js. Probes are synthetic.') + ',',
    '  "errors": ' + JSON.stringify('An accidental error is recorded by class only; an error the library ' +
      'throws on purpose has a string `code` and is recorded with its code and message.') + ',',
    '  "probes": ' + JSON.stringify(encodedProbes()) + ',',
    '  "cellCount": ' + cells.length + ',',
    '  "knownBuildDifferences": {'
  ];
  const reasons = {};
  for (const entry of known) {
    reasons[entry.reason] = KNOWN_BUILD_DIFFERENCES.find((rule) => rule.name === entry.reason).reason;
  }
  lines.push('    "reasons": ' + JSON.stringify(reasons) + ',');
  lines.push('    "cells": [');
  known.forEach((entry, i) => lines.push('      ' + JSON.stringify(entry) + (i < known.length - 1 ? ',' : '')));
  lines.push('    ]');
  lines.push('  },');
  lines.push('  "cells": [');
  cells.forEach((cell, i) => lines.push('    ' + JSON.stringify(cell) + (i < cells.length - 1 ? ',' : '')));
  lines.push('  ]');
  lines.push('}');
  return escapeInvisible(lines.join('\n')) + '\n';
}

// The cells a build should give: main.js's cells, with that build's known differences put in (those of the build
// it shares them with, if any).
function expectedCells(snapshot, buildName) {
  const recordedUnder = SHARES_RECORDED_DIFFERENCES[buildName] || buildName;
  const replaced = new Map();
  for (const entry of snapshot.knownBuildDifferences.cells) {
    if (entry.build === recordedUnder) replaced.set(entry.id, Object.assign({ id: entry.id }, entry.cell));
  }
  return snapshot.cells.map((cell) => replaced.get(cell.id) || cell);
}

// The known differences of a build that shares another build's (SHARES_RECORDED_DIFFERENCES) that are not exactly
// that build's, as cell ids: a cell one of them has and the other lacks, or has with another result.
function unsharedDifferences(known, sharedKnown) {
  const key = (entry) => entry.id + '\u0000' + entry.reason + '\u0000' + cellKey(entry.cell);
  const shared = new Set(sharedKnown.map(key));
  const own = new Set(known.map(key));
  return known.filter((entry) => !shared.has(key(entry))).map((entry) => entry.id)
    .concat(sharedKnown.filter((entry) => !own.has(key(entry))).map((entry) => entry.id));
}

// Differences between a build's cells and main.js's that KNOWN_BUILD_DIFFERENCES explains, and those it does not.
function buildDifferences(mainCells, buildName, buildCells) {
  const comparison = compareCells(mainCells, buildCells);
  const known = [];
  const unexplained = [];
  for (const change of comparison.changed) {
    const rule = KNOWN_BUILD_DIFFERENCES.find((r) => r.builds.indexOf(buildName) !== -1 && r.matches(change.id));
    if (rule) {
      const cell = Object.assign({}, change.actual);
      delete cell.id;
      known.push({ build: buildName, id: change.id, reason: rule.name, cell: cell });
    } else {
      unexplained.push(change);
    }
  }
  return { known: known, unexplained: unexplained, missing: comparison.missing, extra: comparison.extra };
}

// --- Comparing ------------------------------------------------------------------------------------------------

function cellKey(cell) {
  return JSON.stringify([cell.type, cell.out, cell.throws, cell.code, cell.message, cell.console]);
}

function compareCells(expected, actual) {
  const actualById = new Map(actual.map((cell) => [cell.id, cell]));
  const expectedIds = new Set(expected.map((cell) => cell.id));
  const changed = [];
  const missing = [];
  for (const cell of expected) {
    const got = actualById.get(cell.id);
    if (!got) missing.push(cell.id);
    else if (cellKey(got) !== cellKey(cell)) changed.push({ id: cell.id, expected: cell, actual: got });
  }
  const extra = actual.filter((cell) => !expectedIds.has(cell.id)).map((cell) => cell.id);
  return { total: expected.length, changed: changed, missing: missing, extra: extra };
}

// Checks one loaded build against the snapshot and returns { ok, text }.
function checkBuild(snapshot, build, options) {
  const problems = [];
  if (JSON.stringify(snapshot.probes) !== JSON.stringify(encodedProbes())) {
    problems.push('The probes in scripts/contract/matrix.js differ from those recorded in the snapshot.');
  }
  const comparison = compareCells(expectedCells(snapshot, build.name), runCells(build, options));
  const ok = !problems.length && !comparison.changed.length && !comparison.missing.length && !comparison.extra.length;
  const text = ok
    ? build.label + ': ' + formatCount(comparison.total) + ' cells match on ' + runtimeName() + '.'
    : formatReport(build.label, comparison, { problems: problems, advice: true });
  return { ok: ok, text: text, comparison: comparison };
}

// A readable list of the cells that differ. Options: `problems` (lines to print first), `limit` (how many kinds of
// change to show) and `advice` (end with what to do about a deliberate change).
function formatReport(label, comparison, options) {
  const settings = options || {};
  const max = settings.limit || 30;
  const out = [];
  const count = comparison.changed.length;
  out.push(`API contract matrix: ${formatCount(count)} of ${formatCount(comparison.total)} cells differ in ` +
    `${label} on ${runtimeName()}.`);
  for (const problem of settings.problems || []) out.push(problem);
  if (comparison.missing.length) {
    out.push(`${comparison.missing.length} recorded cells were not run: ${comparison.missing.slice(0, 5).join('; ')}` +
      (comparison.missing.length > 5 ? '; ...' : ''));
  }
  if (comparison.extra.length) {
    out.push(`${comparison.extra.length} cells are not recorded: ${comparison.extra.slice(0, 5).join('; ')}` +
      (comparison.extra.length > 5 ? '; ...' : ''));
  }
  if (count) {
    const byForm = new Map();
    for (const change of comparison.changed) {
      const form = formOf(change.id);
      byForm.set(form, (byForm.get(form) || 0) + 1);
    }
    const forms = Array.from(byForm).sort((a, b) => b[1] - a[1]);
    out.push('By call form: ' + forms.slice(0, 20).map(([form, n]) => form + ' ' + n).join(', ') +
      (forms.length > 20 ? `, and ${forms.length - 20} more forms` : '') + '.');
  }
  // Cells that changed the same way are listed together, under one description of the change.
  const kinds = new Map();
  for (const change of comparison.changed) {
    const text = describeChange(change.expected, change.actual).join('\n');
    if (!kinds.has(text)) kinds.set(text, []);
    kinds.get(text).push(change.id);
  }
  let shown = 0;
  for (const [text, ids] of kinds) {
    if (shown === max) break;
    shown++;
    out.push('');
    if (ids.length === 1) out.push('  ' + ids[0]);
    else out.push(`  ${formatCount(ids.length)} cells: ${ids.slice(0, 6).join('; ')}` +
      (ids.length > 6 ? `; and ${formatCount(ids.length - 6)} more` : ''));
    for (const line of text.split('\n')) out.push('    ' + line);
  }
  if (kinds.size > shown) out.push('', `  ... and ${formatCount(kinds.size - shown)} more kinds of change.`);
  out.push('');
  out.push('Probes: ' + CONTENTS.filter(([, value]) => typeof value === 'string' && /[^\x20-\x7e]/.test(value))
    .map(([name, value]) => name + ' = ' + quote(value)).join(', ') + '.');
  if (settings.advice) {
    out.push('If the change is deliberate, run `npm run matrix:update`, review the diff of ' +
      'test/contract/api-matrix.json, and list the changed cells in the pull request.');
  }
  return out.join('\n');
}

// "fontConvert(zawgyi, 'unicode', 'win')" -> "fontConvert(·, 'unicode', 'win')": the call without its content probe.
function formOf(id) {
  const probeNames = CONTENTS.map(([name]) => name).sort((a, b) => b.length - a.length);
  let form = id;
  for (const name of probeNames) form = form.split('(' + name + ',').join('(·,').split('(' + name + ')').join('(·)');
  return form.replace(/\[[^\]]*\]\.map/, '[...].map');
}

function describeChange(expected, actual) {
  const lines = [];
  if (resultKey(expected) !== resultKey(actual)) {
    lines.push('expected: ' + describeResult(expected));
    lines.push('actual:   ' + describeResult(actual));
  }
  const before = expected.console || [];
  const after = actual.console || [];
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    lines.push('console expected: ' + (before.length ? before.join(' | ') : '(nothing)'));
    lines.push('console actual:   ' + (after.length ? after.join(' | ') : '(nothing)'));
  }
  return lines;
}

function resultKey(cell) {
  return JSON.stringify([cell.type, cell.out, cell.throws, cell.code, cell.message]);
}

function describeResult(cell) {
  if (cell.throws) {
    return 'throws ' + cell.throws + (cell.code !== undefined ? ' ' + cell.code + ': ' + quote(cell.message) : '');
  }
  if (cell.type === 'undefined') return 'returns undefined';
  if (typeof cell.out === 'string') return 'returns ' + quote(cell.out) + codePoints(cell.out);
  return 'returns ' + cell.type + ' ' + escapeInvisible(JSON.stringify(cell.out));
}

// --- Text -----------------------------------------------------------------------------------------------------

// Characters that do not show in a terminal or a diff: C1 controls, spaces other than U+0020, zero-width and
// directional marks, variation selectors, the BOM. JSON already escapes the C0 controls.
const INVISIBLE = /[\u007f-\u00a0\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u202f\u205f-\u206f\u3000\u3164\ufe00-\ufe0f\ufeff\ufff0-\ufffb]/g;
const CONTROL = /[\u0000-\u001f]/g;

function escapeChar(ch) {
  return '\\u' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
}

function escapeInvisible(text) {
  return text.replace(INVISIBLE, escapeChar);
}

function quote(text) {
  const escaped = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(CONTROL, escapeChar);
  return "'" + escapeInvisible(escaped) + "'";
}

function codePoints(text) {
  if (!/[^\x20-\x7e]/.test(text)) return '';
  const points = Array.from(text, (ch) => ch.codePointAt(0).toString(16));
  return ' [' + points.slice(0, 32).join(' ') + (points.length > 32 ? ' ...' : '') + ']';
}

// A value as it would be written in JavaScript, for cell ids and messages.
function show(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value);
  if (typeof value !== 'object') return String(value);
  if (value instanceof String) return 'new String(' + quote(String(value)) + ')';
  if (Array.isArray(value)) return '[' + value.map(show).join(', ') + ']';
  return '{' + Object.keys(value).map((key) => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : quote(key)) + ': ' +
    show(value[key])).join(', ') + '}';
}

function formatCount(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

module.exports = {
  ROOT,
  SNAPSHOT,
  BUILDS,
  SHARES_RECORDED_DIFFERENCES,
  // The content probes, which scripts/eval/lib/inputs.mjs also hands to compare.
  CONTENTS,
  defineCells,
  loadBuild,
  runCells,
  readSnapshot,
  formatSnapshot,
  expectedCells,
  buildDifferences,
  unsharedDifferences,
  compareCells,
  checkBuild,
  formatReport,
  formatCount,
  runtimeName
};
