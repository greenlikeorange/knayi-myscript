// Speed of this checkout next to the published baseline, on real text and on long inputs.
// Usage: node scripts/eval/bench.mjs [--sweep] [--skip-baseline-long] [--json bench.json]
//   --sweep               also run every Myanmar code point and mark pair as a long input (this checkout only)
//   --skip-baseline-long  skip the baseline on long inputs (2.8.3 takes several seconds on them)
import fs from 'node:fs';
import os from 'node:os';
import { loadAll } from './datasets.mjs';
import { loadEngines } from './engines.mjs';
import { codeState, REPO } from './lib/knayi.mjs';

const args = process.argv.slice(2);
function option(name) {
  const i = args.indexOf(name);
  if (i === -1) return null;
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(name + ' needs a file name');
  return args[i + 1];
}
const jsonOut = option('--json');
const data = await loadAll();
const E = await loadEngines();
const cp = (n) => String.fromCodePoint(n);

const ms = (fn) => { const start = process.hrtime.bigint(); fn(); return Number(process.hrtime.bigint() - start) / 1e6; };
function mean(fn, warmups = 3, runs = 10) {
  for (let i = 0; i < warmups; i++) fn();
  let total = 0;
  for (let i = 0; i < runs; i++) total += ms(fn);
  return total / runs;
}

const result = {
  generatedAt: new Date().toISOString(),
  // The code that produced these timings: commit, uncommitted changes, and a hash of the library code (main.js and
  // library/ of 2.x, src/ of 3.0).
  code: codeState(REPO),
  machine: (os.cpus()[0] ? os.cpus()[0].model : 'unknown CPU') + ', ' + os.type() + ' ' + os.release(),
  node: process.version,
  engines: { local: E.local.name, baseline: E.baseline.name }
};

// Real text: FLORES-200 and the Wikipedia sample, plus their Zawgyi form made by Rabbit.
const unicode = data.flores.concat(data.wikipedia);
const zawgyi = unicode.map(E.rabbit.toZawgyi);
const tasks = [
  ['fontDetect', (k) => () => unicode.forEach((t) => k.fontDetect(t))],
  ['fontConvert Zawgyi → Unicode, source detected', (k) => () => zawgyi.forEach((t) => k.fontConvert(t, 'unicode'))],
  ['fontConvert Unicode → Zawgyi', (k) => () => unicode.forEach((t) => k.fontConvert(t, 'zawgyi', 'unicode'))],
  ['syllBreak', (k) => () => unicode.forEach((t) => k.syllBreak(t, 'unicode'))],
  ['normalize', (k) => () => unicode.forEach((t) => k.normalize(t))]
];
result.realText = {
  lines: unicode.length,
  rows: tasks.map(([task, make]) => ({ task, local: mean(make(E.local.lib)), baseline: mean(make(E.baseline.lib)) }))
};

// Long inputs that took quadratic time in 2.8.3 and 2.9.0. One run each.
// A leading stacked ka (U+1060) or kinzi (U+1064) makes the conversion reach the rule that was quadratic.
const vowels = (n) => (cp(0x102c) + cp(0x102d)).repeat(n / 2);
const long = [
  ...[20000, 40000, 80000].map((n) => ['fontConvert Zawgyi → Unicode, stacked ka + ' + n / 1000 + 'k alternating vowel signs',
    (k) => k.fontConvert(cp(0x1000) + cp(0x1060) + vowels(n), 'unicode', 'zawgyi')]),
  ['fontConvert Zawgyi → Unicode, kinzi + 80k alternating vowel signs', (k) => k.fontConvert(cp(0x1064) + vowels(80000), 'unicode', 'zawgyi')],
  ...[50000, 100000, 200000].map((n) => ['normalize, ' + n / 1000 + 'k × ' + cp(0x101d), (k) => k.normalize(cp(0x101d).repeat(n))])
];
const skipBaseline = args.includes('--skip-baseline-long');
result.longInput = long.map(([input, run]) => ({
  input,
  local: ms(() => run(E.local.lib)),
  baseline: skipBaseline ? null : ms(() => run(E.baseline.lib))
}));

if (args.includes('--sweep')) {
  // Every Myanmar code point repeated, and every pair of marks alternating, through every call form.
  const k = E.local.lib;
  const calls = {
    fontDetect: (s) => k.fontDetect(s),
    'Zawgyi → Unicode': (s) => k.fontConvert(s, 'unicode', 'zawgyi'),
    'Unicode → Zawgyi': (s) => k.fontConvert(s, 'zawgyi', 'unicode'),
    'syllBreak unicode': (s) => k.syllBreak(s, 'unicode'),
    'syllBreak zawgyi': (s) => k.syllBreak(s, 'zawgyi'),
    spellingFix: (s) => k.spellingFix(s, 'unicode'),
    truncate: (s) => k.truncate(s, { fontType: 'unicode' }),
    normalize: (s) => k.normalize(s)
  };
  const marks = [];
  for (let c = 0x102b; c <= 0x103e; c++) marks.push(c);
  marks.push(0x105a, 0x1060, 0x1064, 0x107d, 0x107e, 0x1087, 0x108b, 0x1094, 0x1095);
  const inputs = [];
  for (let c = 0x1000; c <= 0x109f; c++) inputs.push(['U+' + c.toString(16).toUpperCase() + ' × 30000', cp(c).repeat(30000)]);
  for (const a of marks) for (const b of marks) if (a !== b) inputs.push(['U+' + a.toString(16) + ' U+' + b.toString(16) + ' × 10000', (cp(a) + cp(b)).repeat(10000)]);
  for (const base of [0x1000, 0x103b, 0x1031]) for (const m of marks) inputs.push(['U+' + base.toString(16) + ' U+' + m.toString(16) + ' × 10000', (cp(base) + cp(m)).repeat(10000)]);
  let runs = 0, slowest = 0;
  const slow = [];
  for (const [label, s] of inputs) {
    for (const [name, call] of Object.entries(calls)) {
      const t = ms(() => call(s));
      runs++;
      slowest = Math.max(slowest, t);
      if (t > 250) slow.push(name + ' on ' + label + ': ' + t.toFixed(0) + ' ms');
    }
  }
  result.sweep = { runs, inputs: inputs.length, marks: marks.length, slowest, limit: 250, slow };
}

// Markdown for the console.
const local = E.local.name + ' (this checkout)';
console.log('# knayi benchmark\n\n' + result.machine + ', Node ' + result.node + '\n');
console.log('## Real text (' + result.realText.lines.toLocaleString('en-US') + ' lines, mean of 10 runs after 3 warm-ups)\n');
console.log('| Task | ' + local + ' | ' + E.baseline.name + ' |\n| --- | ---: | ---: |');
for (const r of result.realText.rows) console.log('| ' + r.task + ' | ' + r.local.toFixed(1) + ' ms | ' + r.baseline.toFixed(1) + ' ms |');
console.log('\n## Long input (one run)\n');
console.log('| Input | ' + local + ' | ' + E.baseline.name + ' |\n| --- | ---: | ---: |');
for (const r of result.longInput) console.log('| ' + r.input + ' | ' + r.local.toFixed(0) + ' ms | ' + (r.baseline == null ? 'skipped' : r.baseline.toFixed(0) + ' ms') + ' |');
if (result.sweep) {
  console.log('\n## Sweep (' + local + ')\n');
  console.log(result.sweep.runs.toLocaleString('en-US') + ' runs, slowest ' + result.sweep.slowest.toFixed(0) + ' ms, over 250 ms: ' + result.sweep.slow.length);
  result.sweep.slow.slice(0, 20).forEach((line) => console.log('- ' + line));
}

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2) + '\n');
  console.error('wrote ' + jsonOut);
}
