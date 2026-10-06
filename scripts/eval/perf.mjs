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
//   --soft-exponent <x>    confirm a growth exponent that the screen reads above x (default 1.3)
//   --max-exponent <x>     fail when a confirmed head growth exponent, and that of its top doubling, are x or more
//                          (default 1.5)
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
// Growth exponents: every adversarial shape of lib/inputs.mjs through the forms of GROWTH_FORMS, and every
// single-character run of PUMPS through PUMP_FORMS, by the two steps of scripts/testing/growth.js, which
// test/growth.timing.js shares. A screen reads log(t(4n) / t(n)) / log(4) (1 is linear, 2 quadratic) from n to 4n
// units (SCREEN_N); a reading above --soft-exponent is confirmed at N, 4N and 8N (growth.js's CONFIRM: 4,096 to
// 32,768 under Node, 1,024 to 8,192 under Bun), and the run fails only when the confirmed exponent from N to 8N and
// that of the top doubling, from 4N to 8N, are both at least --max-exponent, or when one call takes more than a
// second. Screen readings that the confirmation does not uphold
// are listed, not failed. growth.js holds the runner evidence behind these numbers.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadAll } from './datasets.mjs';
import { prepareKnayi, instantiate, describe } from './lib/knayi.mjs';
import { selectForms, formById, available } from './lib/callForms.mjs';
import { perfTexts, workloads, WORKLOADS, SHAPES, GROWTH_FORMS, PUMPS, PUMP_FORMS } from './lib/inputs.mjs';
import { alternate, median, timeOnce, collectGarbage } from './lib/timing.mjs';

const require = createRequire(import.meta.url);
const growthCheck = require('../testing/growth.js');

const RUNTIME = typeof Bun !== 'undefined' ? 'bun' : 'node';
const HERE = fileURLToPath(import.meta.url);

// The screen's n. A quadratic term with a small constant reads close to linear while the linear part dominates: a
// normalize that rescanned its prefix at every eighth character took 5 ms at 25k units against 1.9 ms for the
// linear code; on the 36 shapes it read at most 1.25 at n = 1,024, and 1.3 to 1.65 on 17 of them at n = 8,192. So
// under V8, n = 8,192 (4n = 32,768), below 64k units, where two-byte strings pass 128 KB and go to the large-object
// space (the Win reader took about 21 ns a unit up to 128k units and 60 ns at 1M). Under Bun the cost per unit of
// linear code climbs from about 4k units, so n stays 1,024 there. Either way the screen reads a quadratic term at
// least as strongly as the confirmation: the weakest term the confirmation fails, which costs 0.35 times the linear
// time at N, reads 1.58 on Node's screen and 1.42 on Bun's, both above the soft bound of 1.3.
const SCREEN_N = RUNTIME === 'bun' ? 1024 : 8192;

function parseArgs(argv) {
  const opts = { base: 'origin/main', head: '.', runtimes: ['node', 'bun'], rounds: 3, runs: 7, lines: 400, minMs: 10, forms: [],
    workloads: WORKLOADS.slice(), growth: 'head', offline: false, softExponent: 1.3, maxExponent: growthCheck.CONFIRM.exponent,
    maxSlowdown: 0.2, json: null };
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
      case '--soft-exponent': opts.softExponent = decimal(arg, value(i++)); break;
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
  const result = { runtime: RUNTIME, version, workloads: {}, rows: [], growth: [], confirmN: growthCheck.CONFIRM.n };
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
    const pumpForms = PUMP_FORMS.map(formById).filter((f) => forms.includes(f));
    progress(RUNTIME + ': growth exponents, ' + SHAPES.length + ' shapes × ' + growthForms.length + ' call forms and ' +
      PUMPS.length + ' single-character runs × ' + pumpForms.length + ' call forms');
    const cells = SHAPES.flatMap((shape) => growthForms.map((form) => ({ shape, form, kind: 'shape' })))
      .concat(PUMPS.flatMap((shape) => pumpForms.map((form) => ({ shape, form, kind: 'pump' }))));
    for (const { shape, form, kind } of cells) {
      const headGrowth = cellGrowth((s) => { last = form.call(B, s); }, shape.make, opts);
      const baseGrowth = opts.growth === 'both' ? cellGrowth((s) => { last = form.call(A, s); }, shape.make, opts) : null;
      result.growth.push({ shape: shape.id, form: form.id, kind, head: headGrowth, base: baseGrowth });
    }
  }
  return result;
}

// One cell's growth, as plain data: the screen's exponent (null when a call passed the time cap), the confirmed
// exponent when the screen read above the soft bound, and the verdict. Linear code reads low on the screen, so the
// 2,264 cells take about 25 s per runtime on a quiet laptop, and a confirmation adds about a quarter of a second.
function cellGrowth(call, make, opts) {
  const r = growthCheck.checkGrowth(call, make, {
    screen: { n: SCREEN_N, span: 4, soft: opts.softExponent },
    confirm: { exponent: opts.maxExponent }
  });
  const c = r.confirm;
  return {
    n: r.screen.n, units: r.screen.units[0], ms: r.screen.ms[0], exponent: r.screen.exponent, verdict: r.verdict,
    confirmed: c ? c.exponent : null, confirmedTop: c ? c.top : null, confirmUnits: c ? c.units : null, confirmMs: c ? c.ms : null,
    capped: r.screen.capped || Boolean(c && c.capped), describe: growthCheck.describeGrowth(r)
  };
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
      const high = cells.filter((g) => g.head.verdict !== 'linear');
      const over = cells.filter((g) => g.head.verdict === 'super-linear');
      const unconfirmed = cells.filter((g) => g.head.verdict === 'unconfirmed');
      const highest = cells.filter((g) => g.head.exponent != null).sort((x, y) => y.head.exponent - x.head.exponent);
      const n = cells.length ? cells[0].head.n : 0;
      const c = growthCheck.CONFIRM;
      console.log('\n' + r.runtime + ' ' + r.version + ': growth exponents of the head (1 is linear, 2 quadratic): a screen from ' +
        num(n) + ' to ' + num(4 * n) + ' units, and for a screen reading above ' + opts.softExponent + ' a confirmation from ' +
        num(r.confirmN) + ' to ' + num(c.span * r.confirmN) + ' units that fails when it and its top doubling reach ' + opts.maxExponent + ', or a call over ' + c.capMs + ' ms');
      const shapeCells = cells.filter((g) => g.kind !== 'pump').length;
      console.log('  ' + cells.length + ' cells (' + SHAPES.length + ' shapes × ' + (shapeCells / SHAPES.length) + ' call forms, ' +
        PUMPS.length + ' single-character runs × ' + ((cells.length - shapeCells) / PUMPS.length) + '), ' +
        high.length + ' above ' + opts.softExponent + ' on the screen, ' + over.length + ' failed (confirmed, or a call over the time cap); highest screen readings:');
      for (const g of highest.slice(0, 5)) {
        console.log('    ' + fixed(g.head.exponent) + '  ' + g.form + ' on ' + g.shape + ' (' + num(g.head.units) + ' units in ' +
          fixed(g.head.ms * 1000, 0) + ' µs)' + (g.head.confirmed != null ? ', confirmed ' + fixed(g.head.confirmed) + ', top doubling ' + fixed(g.head.confirmedTop) : '') +
          (g.base ? ', base ' + fixed(g.base.exponent) : ''));
      }
      // Readings above the soft bound that the confirmation did not uphold: listed so they stay visible.
      for (const g of unconfirmed) {
        console.log('  above ' + opts.softExponent + ', not confirmed: ' + g.form + ' on ' + g.shape + ': ' + g.head.describe);
      }
      for (const g of over) failures.push(r.runtime + ' ' + g.form + ' on ' + g.shape + ': ' + g.head.describe);
      const baseOver = r.growth.filter((g) => g.base && g.base.verdict === 'super-linear');
      if (baseOver.length) {
        console.log('  base confirmed super-linear (for reference): ' + baseOver.map((g) =>
          g.form + ' on ' + g.shape + ' ' + (g.base.confirmed == null ? 'too slow' : fixed(g.base.confirmed))).join('; '));
      }
    }
  }
  if (notes.length) console.log('\nBun rows over 1.10 (report a reason in the PR):\n  ' + notes.join('\n  '));
  console.log('\n' + (failures.length ? 'FAIL' : 'OK') + (failures.length ? ':\n  ' + failures.join('\n  ') : ': within the limits (Node rows at most ' +
    fixed(1 + opts.maxSlowdown) + ' times the base, no growth exponent confirmed at ' + opts.maxExponent + ' or more)'));
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
