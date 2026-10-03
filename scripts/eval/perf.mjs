// Times two copies of knayi against each other in one process, interleaved, under Node and Bun, and measures how
// the head copy's time grows on adversarial inputs. Only ratios are reported: absolute times drift between runs.
//
// Usage: npm run perf -- [--base <spec>] [--head <spec>] [options]
//   --base <spec>          the copy to time against (default origin/main); --head <spec> the copy under test
//                          (default ., this working tree). Specs are those of compare.mjs (see lib/knayi.mjs).
//   --runtimes <list>      node, bun or both (default node,bun; a runtime that is not installed is skipped)
//   --rounds <n>           rounds over every row (default 3)
//   --runs <n>             timed runs per copy, per row and round, alternating which copy goes first (default 7)
//   --lines <n>            FLORES lines in the timed text (default 400)
//   --min-ms <n>           a timed run repeats the workload until it takes at least this long (default 10)
//   --forms a,b            only these call forms (a trailing * matches a prefix)
//   --workloads a,b        line, word, string, document (default all four)
//   --growth <which>       growth exponents for the head copy (head, the default), both copies, or none
//   --offline              growth exponents only; they need no corpus cache (the timed rows read only FLORES)
//   --max-exponent <x>     fail when a head growth exponent is above x (default 1.3)
//   --max-slowdown <x>     fail when a Node row's head/base time ratio is above 1 + x (default 0.2)
//   --json <file>          also write every timing as JSON
// Exit status: 0 within the limits, 1 when a limit failed or the head lacks a call form the base has, 2 on a usage or
// setup error.
//
// Rows: each call form (lib/callForms.mjs) on the same text in four shapes: a call per line, a call per word, one
// call on the lines joined by spaces (string) and one on the lines joined by line breaks (document). A row's
// ratio is the median over the rounds of head/base, each the ratio of the medians of that round's runs. Under Bun
// a full garbage collection runs before every timed run: without it, identical copies differed by up to a third
// on single calls that build long strings. Node needs no such step (identical copies stayed within 2%), but runs
// it too when started with --expose-gc.
//
// Growth exponents (lib/timing.mjs): every adversarial shape of lib/inputs.mjs through the forms of GROWTH_FORMS,
// at n, 2n and 4n units (n = 8,192 under Node, 1,024 under Bun). A reading above --max-exponent is measured twice
// more, and the run fails only when all three readings are above it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadAll } from './datasets.mjs';
import { prepareKnayi, instantiate, describe } from './lib/knayi.mjs';
import { selectForms, formById, available } from './lib/callForms.mjs';
import { perfTexts, workloads, WORKLOADS, SHAPES, GROWTH_FORMS } from './lib/inputs.mjs';
import { alternate, median, timeOnce, growthExponent, collectGarbage } from './lib/timing.mjs';

const RUNTIME = typeof Bun !== 'undefined' ? 'bun' : 'node';
const HERE = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const opts = { base: 'origin/main', head: '.', runtimes: ['node', 'bun'], rounds: 3, runs: 7, lines: 400, minMs: 10, forms: [],
    workloads: WORKLOADS.slice(), growth: 'head', offline: false, maxExponent: 1.3, maxSlowdown: 0.2, json: null };
  const value = (i) => {
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(argv[i] + ' needs a value');
    return argv[i + 1];
  };
  const whole = (name, v) => {
    if (!/^[1-9]\d*$/.test(v)) throw new Error(name + ' needs a positive whole number, not ' + v);
    return Number(v);
  };
  const decimal = (name, v) => {
    if (!/^\d+(\.\d+)?$/.test(v)) throw new Error(name + ' needs a number, not ' + v);
    return Number(v);
  };
  const list = (v) => v.split(',').map((x) => x.trim()).filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--base': opts.base = value(i++); break;
      case '--head': opts.head = value(i++); break;
      case '--runtimes': opts.runtimes = list(value(i++)); break;
      case '--rounds': opts.rounds = whole(arg, value(i++)); break;
      case '--runs': opts.runs = whole(arg, value(i++)); break;
      case '--lines': opts.lines = whole(arg, value(i++)); break;
      case '--min-ms': opts.minMs = decimal(arg, value(i++)); break;
      case '--forms': opts.forms.push(...list(value(i++))); break;
      case '--workloads': opts.workloads = list(value(i++)); break;
      case '--growth': opts.growth = value(i++); break;
      case '--offline': opts.offline = true; break;
      case '--max-exponent': opts.maxExponent = decimal(arg, value(i++)); break;
      case '--max-slowdown': opts.maxSlowdown = decimal(arg, value(i++)); break;
      case '--json': opts.json = value(i++); break;
      case '--help': case '-h': opts.help = true; break;
      default: throw new Error('unknown option ' + arg + ' (see --help)');
    }
  }
  const bad = opts.runtimes.filter((r) => r !== 'node' && r !== 'bun');
  if (bad.length || opts.runtimes.length === 0) throw new Error('--runtimes takes node and bun, not ' + opts.runtimes.join(','));
  const badLoads = opts.workloads.filter((w) => !WORKLOADS.includes(w));
  if (badLoads.length) throw new Error('unknown workload ' + badLoads.join(', ') + '; the workloads are ' + WORKLOADS.join(', '));
  if (!['head', 'both', 'none'].includes(opts.growth)) throw new Error('--growth takes head, both or none');
  return opts;
}

const progress = (text) => process.stderr.write(text + '\n');
const chars = (xs) => xs.reduce((n, s) => n + s.length, 0);

// Measures in this runtime. Returns plain data, so a child runtime can hand it back as JSON.
async function measure({ base, head, opts }) {
  const A = await instantiate(base);
  const B = await instantiate(head);
  const version = RUNTIME === 'bun' ? Bun.version : process.versions.node;
  const result = { runtime: RUNTIME, version, workloads: {}, rows: [], growth: [] };
  const forms = selectForms(opts.forms).filter((f) => available(f, A) && available(f, B));
  // A form the base has and the head lacks is a lost part of the API (report() fails the run); a form the base
  // lacks is an old release's, and is left out.
  result.lost = selectForms(opts.forms).filter((f) => available(f, A) && !available(f, B)).map((f) => f.id);
  let last;

  if (!opts.offline && opts.workloads.length) {
    const flores = (await loadAll({ only: ['flores'] })).flores;
    const texts = perfTexts(flores, A, opts.lines);
    // The same calls on the head copy, whose results are not used: both copies then start the timing with the
    // same history of calls, which the engine's optimisations depend on.
    perfTexts(flores, B, opts.lines);
    const loads = { unicode: workloads(texts.unicode), zawgyi: workloads(texts.zawgyi), win: workloads(texts.win) };
    for (const text of Object.keys(loads)) {
      result.workloads[text] = Object.fromEntries(opts.workloads.map((w) => [w, { calls: loads[text][w].length, chars: chars(loads[text][w]) }]));
    }
    const rows = [];
    for (const form of forms.filter((f) => f.text)) {
      for (const workload of opts.workloads) {
        const inputs = loads[form.text][workload];
        const row = { form: form.id, workload, text: form.text, reps: 1, base: [], head: [], ratios: [] };
        // One timed run passes over the workload `reps` times, so that a run takes at least --min-ms.
        const timed = (lib) => () => {
          for (let r = 0; r < row.reps; r++) {
            for (let i = 0; i < inputs.length; i++) last = form.call(lib, inputs[i]);
          }
        };
        row.a = timed(A);
        row.b = timed(B);
        rows.push(row);
      }
    }
    for (let round = 0; round < opts.rounds; round++) {
      progress(RUNTIME + ': round ' + (round + 1) + ' of ' + opts.rounds + ', ' + rows.length + ' rows');
      for (const row of rows) {
        if (round === 0) {
          for (let w = 0; w < 2; w++) { row.a(); row.b(); }
          row.reps = Math.max(1, Math.ceil(opts.minMs / Math.min(timeOnce(row.a), timeOnce(row.b))));
        }
        const t = alternate(row.a, row.b, opts.runs, round % 2 === 1, collectGarbage);
        row.base.push(...t.a.map((ms) => ms / row.reps));
        row.head.push(...t.b.map((ms) => ms / row.reps));
        row.ratios.push(median(t.b) / median(t.a));
      }
    }
    result.rows = rows.map((r) => ({
      form: r.form, workload: r.workload, text: r.text, reps: r.reps,
      baseMs: median(r.base), headMs: median(r.head), ratio: median(r.ratios),
      low: Math.min(...r.ratios), high: Math.max(...r.ratios), roundRatios: r.ratios
    }));
  }

  if (opts.growth !== 'none') {
    const growthForms = GROWTH_FORMS.map(formById).filter((f) => forms.includes(f));
    progress(RUNTIME + ': growth exponents, ' + SHAPES.length + ' shapes × ' + growthForms.length + ' call forms');
    for (const shape of SHAPES) {
      for (const form of growthForms) {
        const headGrowth = confirmedGrowth((s) => { last = form.call(B, s); }, shape.make, opts.maxExponent);
        const baseGrowth = opts.growth === 'both' ? confirmedGrowth((s) => { last = form.call(A, s); }, shape.make, opts.maxExponent) : null;
        result.growth.push({ shape: shape.id, form: form.id, head: headGrowth, base: baseGrowth });
      }
    }
  }
  return result;
}

// A reading above the limit is measured twice more and the lowest of the three kept, so a cell fails only when all
// three are above the limit, as in test/growth.test.js: super-linear code reads high every time, while another
// process or a garbage-collection pause (JavaScriptCore under Bun has more of them than V8) seldom spoils three
// measurements in a row.
function confirmedGrowth(call, make, limit) {
  const first = growthExponent(call, make);
  if (first.exponent != null && first.exponent <= limit) return first;
  const tries = [first, growthExponent(call, make), growthExponent(call, make)];
  const value = (g) => (g.exponent == null ? Infinity : g.exponent);
  const kept = tries.slice().sort((x, y) => value(x) - value(y))[0];
  return { ...kept, tries: tries.map((g) => g.exponent) };
}

// Runs the measurement in another runtime: that runtime runs this file with --child and writes its result to a file.
function measureIn(runtime, config) {
  const exe = runtime === 'bun' ? 'bun' : 'node';
  const probe = spawnSync(exe, ['--version'], { encoding: 'utf8' });
  if (probe.status !== 0) return { runtime, skipped: exe + ' is not installed' };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knayi-perf-'));
  try {
    const configFile = path.join(dir, 'config.json');
    const out = path.join(dir, 'result.json');
    fs.writeFileSync(configFile, JSON.stringify({ ...config, out }));
    const child = spawnSync(exe, [HERE, '--child', configFile], { stdio: ['ignore', 'inherit', 'inherit'] });
    if (child.status !== 0 || !fs.existsSync(out)) throw new Error(runtime + ' measurement failed (exit ' + child.status + ')');
    return JSON.parse(fs.readFileSync(out, 'utf8'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const fixed = (x, digits = 2) => (x == null || !isFinite(x) ? '—' : x.toFixed(digits));
const num = (n) => n.toLocaleString('en-US');

function report(results, opts, base, head) {
  const failures = [];
  const notes = [];
  console.log('knayi perf');
  console.log('  base  ' + describe(base));
  console.log('  head  ' + describe(head));
  for (const r of results) {
    if (r.skipped) {
      console.log('\n' + r.runtime + ': skipped, ' + r.skipped);
      continue;
    }
    for (const id of r.lost || []) failures.push(r.runtime + ': the head lost the call form ' + id + ', which the base has');
    if (r.rows.length) {
      console.log('\n' + r.runtime + ' ' + r.version + ': head/base time, median of ' + opts.rounds + ' rounds × ' + opts.runs +
        ' interleaved runs (below 1 is faster; the round range in brackets)');
      const sizes = r.workloads.unicode;
      console.log('  text: ' + opts.lines + ' FLORES lines; ' + opts.workloads.map((w) => w + ' ' + num(sizes[w].calls) + ' call' +
        (sizes[w].calls === 1 ? '' : 's') + ', ' + num(sizes[w].chars) + ' chars').join('; '));
      console.log('  ' + 'call form'.padEnd(30) + opts.workloads.map((w) => w.padStart(19)).join(''));
      const forms = [...new Set(r.rows.map((x) => x.form))];
      for (const form of forms) {
        const cells = opts.workloads.map((w) => {
          const row = r.rows.find((x) => x.form === form && x.workload === w);
          let mark = ' ';
          if (r.runtime === 'node' && row.ratio > 1 + opts.maxSlowdown) {
            mark = '!';
            failures.push('node ' + form + ' per ' + w + ': ' + fixed(row.ratio) + ' times the base');
          } else if (r.runtime === 'bun' && row.ratio > 1.1) {
            mark = '?';
            notes.push('bun ' + form + ' per ' + w + ': ' + fixed(row.ratio) + ' times the base');
          }
          return (fixed(row.ratio) + ' (' + fixed(row.low) + '-' + fixed(row.high) + ')' + mark).padStart(19);
        });
        console.log('  ' + form.padEnd(30) + cells.join(''));
      }
      const all = r.rows.map((x) => x.ratio);
      console.log('  rows: ' + all.length + ', ratios ' + fixed(Math.min(...all)) + ' to ' + fixed(Math.max(...all)) +
        '; ! marks a Node row over ' + fixed(1 + opts.maxSlowdown) + ', ? a Bun row over 1.10');
    }
    if (r.growth.length) {
      const cells = r.growth.filter((g) => g.head);
      const over = cells.filter((g) => g.head.exponent == null || g.head.exponent > opts.maxExponent);
      const highest = cells.filter((g) => g.head.exponent != null).sort((x, y) => y.head.exponent - x.head.exponent);
      const n = cells.length ? cells[0].head.n : 0;
      console.log('\n' + r.runtime + ' ' + r.version + ': growth exponents of the head, per doubling from ' + num(n) + ' to ' +
        num(4 * n) + ' units (1 is linear, 2 quadratic; the lowest of three readings when one is high)');
      console.log('  ' + cells.length + ' cells (' + SHAPES.length + ' shapes × ' + (cells.length / SHAPES.length) + ' call forms), ' +
        over.length + ' above ' + opts.maxExponent + '; highest:');
      for (const g of highest.slice(0, 5)) {
        console.log('    ' + fixed(g.head.exponent) + '  ' + g.form + ' on ' + g.shape + ' (' + num(g.head.units) + ' units in ' +
          fixed(g.head.ms * 1000, 0) + ' µs)' + (g.base ? ', base ' + fixed(g.base.exponent) : ''));
      }
      for (const g of over) {
        failures.push(r.runtime + ' ' + g.form + ' on ' + g.shape + ': growth exponent ' +
          (g.head.exponent == null ? 'not measured, ' + fixed(g.head.ms, 0) + ' ms at ' + num(g.head.units) + ' units' : fixed(g.head.exponent)));
      }
      const baseOver = r.growth.filter((g) => g.base && (g.base.exponent == null || g.base.exponent > opts.maxExponent));
      if (baseOver.length) {
        console.log('  base above ' + opts.maxExponent + ' (for reference): ' + baseOver.map((g) =>
          g.form + ' on ' + g.shape + ' ' + (g.base.exponent == null ? 'too slow' : fixed(g.base.exponent))).join('; '));
      }
    }
  }
  if (notes.length) console.log('\nBun rows over 1.10 (report a reason in the PR):\n  ' + notes.join('\n  '));
  console.log('\n' + (failures.length ? 'FAIL' : 'OK') + (failures.length ? ':\n  ' + failures.join('\n  ') : ': within the limits (Node rows at most ' +
    fixed(1 + opts.maxSlowdown) + ' times the base, growth exponents at most ' + opts.maxExponent + ')'));
  return failures;
}

async function main(argv) {
  if (argv[0] === '--child') {
    const config = JSON.parse(fs.readFileSync(argv[1], 'utf8'));
    fs.writeFileSync(config.out, JSON.stringify(await measure(config)));
    return 0;
  }
  const opts = parseArgs(argv);
  if (opts.help) {
    const lines = fs.readFileSync(HERE, 'utf8').split('\n');
    console.log(lines.slice(0, lines.findIndex((l) => !l.startsWith('//'))).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    return 0;
  }
  const base = prepareKnayi(opts.base);
  const head = prepareKnayi(opts.head);
  const config = { base, head, opts };
  const results = [];
  for (const runtime of opts.runtimes) results.push(runtime === RUNTIME ? await measure(config) : measureIn(runtime, config));
  const failures = report(results, opts, base, head);
  if (opts.json) {
    fs.writeFileSync(opts.json, JSON.stringify({ base, head, options: opts, results, failures }, null, 1) + '\n');
    console.error('wrote ' + opts.json);
  }
  return failures.length ? 1 : 0;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (e) {
  console.error('perf: ' + (e && e.message ? e.message : e));
  process.exitCode = 2;
}
