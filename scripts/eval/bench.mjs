// Speed of this checkout next to the published baseline, on real text and on long inputs.
// Usage: node scripts/eval/bench.mjs [--sweep] [--skip-baseline-long]
//   --sweep               also run every Myanmar code point and mark pair as a long input (this checkout only)
//   --skip-baseline-long  skip the baseline on long inputs (2.8.3 takes several seconds on them)
import os from 'node:os';
import { loadAll } from './datasets.mjs';
import { loadEngines } from './engines.mjs';

const args = process.argv.slice(2);
const data = await loadAll();
const E = loadEngines();
const versions = [E.local, E.baseline];
const cp = (n) => String.fromCodePoint(n);

const ms = (fn) => { const start = process.hrtime.bigint(); fn(); return Number(process.hrtime.bigint() - start) / 1e6; };
function mean(fn, warmups = 3, runs = 10) {
  for (let i = 0; i < warmups; i++) fn();
  let total = 0;
  for (let i = 0; i < runs; i++) total += ms(fn);
  return total / runs;
}

console.log('# knayi benchmark\n');
console.log(os.cpus()[0].model + ', ' + os.type() + ' ' + os.release() + ', Node ' + process.version + '\n');

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
console.log('## Real text (' + unicode.length.toLocaleString('en-US') + ' lines, mean of 10 runs after 3 warm-ups)\n');
console.log('| Task | ' + versions.map((v) => v.name).join(' | ') + ' |');
console.log('| --- | ' + versions.map(() => '---:').join(' | ') + ' |');
for (const [name, make] of tasks) {
  console.log('| ' + name + ' | ' + versions.map((v) => mean(make(v.lib)).toFixed(1) + ' ms').join(' | ') + ' |');
}

// Long inputs that took quadratic time in 2.8.3 and 2.9.0. One run each.
// The leading stacked ka (U+1060) makes the conversion reach the rule that was quadratic.
const long = [
  ...[20000, 40000, 80000].map((n) => ['fontConvert Zawgyi → Unicode, stacked ka + ' + n / 1000 + 'k alternating vowel signs',
    (k) => k.fontConvert(cp(0x1000) + cp(0x1060) + (cp(0x102c) + cp(0x102d)).repeat(n / 2), 'unicode', 'zawgyi')]),
  ...[50000, 100000, 200000].map((n) => ['normalize, ' + n / 1000 + 'k × ' + cp(0x101d), (k) => k.normalize(cp(0x101d).repeat(n))])
];
const longVersions = args.includes('--skip-baseline-long') ? [E.local] : versions;
console.log('\n## Long input (one run)\n');
console.log('| Input | ' + longVersions.map((v) => v.name).join(' | ') + ' |');
console.log('| --- | ' + longVersions.map(() => '---:').join(' | ') + ' |');
for (const [name, run] of long) {
  console.log('| ' + name + ' | ' + longVersions.map((v) => ms(() => run(v.lib)).toFixed(0) + ' ms').join(' | ') + ' |');
}

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
  console.log('\n## Sweep (' + E.local.name + ')\n');
  console.log(runs.toLocaleString('en-US') + ' runs, slowest ' + slowest.toFixed(0) + ' ms, over 250 ms: ' + slow.length);
  slow.slice(0, 20).forEach((line) => console.log('- ' + line));
}
