// Compares the output of two copies of knayi call by call: every public call form (lib/callForms.mjs) on every
// cached corpus, on generated inputs and on seeded fuzz (lib/inputs.mjs). A refactor must show 0 differences; a
// deliberate change lists its exact counts with --expect.
//
// Usage: npm run compare -- [--base <spec>] [--head <spec>] [options]
//   --base <spec>         the copy to compare against (default origin/main; CI must fetch it first)
//   --head <spec>         the copy under test (default ., this working tree)
//                         A spec is a path, git:<ref> or a bare ref, npm:<version> (installed only), or min:/mjs:
//                         followed by a dist file or by any of those (built in a temporary directory); see lib/knayi.mjs.
//   --offline             generated and fuzz inputs only: needs no corpus cache and no network
//   --without a,b         corpora not to read, so they are neither downloaded nor compared (CI passes mc4)
//   --expect form:set=n   a deliberate difference: exactly n differences in that cell; set `all` (or a quoted *)
//                         counts the form's total over every set. Repeat it, or separate entries with commas.
//                         Every other cell must show 0.
//   --forms a,b           only these call forms (a trailing * matches a prefix, as in debugging.*)
//   --sets a,b            only these input sets (same matching)
//   --fuzz <n>            fuzz strings per generator (default 20000; 0 for none)
//   --seed <n>            fuzz seed (default 20261003)
//   --jobs <n>            worker threads (default: one per CPU, at most 16; 1 runs in this thread)
//   --examples <n>        examples shown per differing cell (default 3)
//   --json <file>         also write the full result as JSON
// A call form that the base lacks (an old release) is skipped; one that the base has and the head lacks fails the run.
// Exit status: 0 when every cell matches, 1 when a cell differs from what was expected or the head lost a call form,
// 2 on a usage or setup error.
import fs from 'node:fs';
import os from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { prepareKnayi, instantiate, describe } from './lib/knayi.mjs';
import { selectForms, formById, available, outcome } from './lib/callForms.mjs';
import { generatedSets, fuzzSets, corpusSets, DEFAULT_SEED } from './lib/inputs.mjs';

function parseArgs(argv) {
  const opts = { base: 'origin/main', head: '.', offline: false, without: [], expect: [], forms: [], sets: [], fuzz: 20000,
    seed: DEFAULT_SEED, jobs: Math.min(16, (os.availableParallelism ? os.availableParallelism() : os.cpus().length) || 1),
    examples: 3, json: null };
  const value = (i) => {
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(argv[i] + ' needs a value');
    return argv[i + 1];
  };
  const count = (name, v) => {
    if (!/^\d+$/.test(v)) throw new Error(name + ' needs a whole number, not ' + v);
    return Number(v);
  };
  const list = (v) => v.split(',').map((x) => x.trim()).filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--base': opts.base = value(i++); break;
      case '--head': opts.head = value(i++); break;
      case '--offline': opts.offline = true; break;
      case '--without': opts.without.push(...list(value(i++))); break;
      case '--expect': opts.expect.push(...list(value(i++))); break;
      case '--forms': opts.forms.push(...list(value(i++))); break;
      case '--sets': opts.sets.push(...list(value(i++))); break;
      case '--fuzz': opts.fuzz = count(arg, value(i++)); break;
      case '--seed': opts.seed = count(arg, value(i++)); break;
      case '--jobs': opts.jobs = Math.max(1, count(arg, value(i++))); break;
      case '--examples': opts.examples = count(arg, value(i++)); break;
      case '--json': opts.json = value(i++); break;
      case '--help': case '-h': opts.help = true; break;
      default: throw new Error('unknown option ' + arg + ' (see --help)');
    }
  }
  return opts;
}

function parseExpect(entries, forms, sets) {
  const expected = new Map();
  for (const entry of entries) {
    const m = /^([^:=]+):([^:=]+)=(\d+)$/.exec(entry);
    if (!m) throw new Error('--expect takes form:set=n, not ' + entry);
    const [, form, given, n] = m;
    const set = given === 'all' ? '*' : given;
    if (!forms.some((f) => f.id === form)) throw new Error('--expect ' + entry + ': no call form ' + form + ' in this run');
    if (set !== '*' && !sets.some((s) => s.id === set)) throw new Error('--expect ' + entry + ': no input set ' + set + ' in this run');
    expected.set(form + ':' + set, Number(n));
  }
  return expected;
}

const matches = (id, patterns) => patterns.length === 0 ||
  patterns.some((p) => (p.endsWith('*') ? id.startsWith(p.slice(0, -1)) : id === p));

const applies = (form, set) => (form.input === 'win' ? set.kind === 'win' || set.origin !== 'corpus' : set.kind === 'myanmar');

// Splits each set into chunks of about 150,000 characters; a job runs every applicable form on one chunk.
function makeJobs(sets, forms) {
  const jobs = [];
  sets.forEach((set, setIndex) => {
    const formIds = forms.filter((f) => applies(f, set)).map((f) => f.id);
    if (formIds.length === 0) return;
    let start = 0;
    let chars = 0;
    for (let i = 0; i < set.lines.length; i++) {
      chars += set.lines[i].length + 16;
      if (chars >= 150000 || i - start >= 4000) {
        jobs.push({ setIndex, start, end: i + 1, formIds, cost: chars * formIds.length });
        start = i + 1;
        chars = 0;
      }
    }
    if (start < set.lines.length) jobs.push({ setIndex, start, end: set.lines.length, formIds, cost: chars * formIds.length });
  });
  // Big jobs first, so the last ones to finish are small.
  return jobs.sort((a, b) => b.cost - a.cost).map((job, id) => ({ ...job, id }));
}

// Runs one job: returns, per form, the number of differences and the first `examples` of them.
function runJob(job, lines, A, B, examples) {
  return job.formIds.map((formId) => {
    const form = formById(formId);
    let differ = 0;
    const found = [];
    for (let i = 0; i < lines.length; i++) {
      const a = outcome(form, A, lines[i]);
      const b = outcome(form, B, lines[i]);
      if (a === b) continue;
      differ++;
      if (found.length < examples) found.push({ index: job.start + i, input: lines[i], base: a, head: b });
    }
    return { form: formId, differ, examples: found };
  });
}

async function workerMain() {
  const { base, head, examples } = workerData;
  const A = await instantiate(base);
  const B = await instantiate(head);
  parentPort.on('message', (job) => {
    if (job === null) process.exit(0);
    parentPort.postMessage({ id: job.id, results: runJob(job, job.lines, A, B, examples) });
  });
  parentPort.postMessage({ ready: true });
}

// Runs the jobs here with --jobs 1, otherwise on worker threads that each load both copies themselves.
async function runJobs(jobs, sets, copies, opts) {
  const done = [];
  const { base, head, A, B } = copies;
  if (opts.jobs === 1) {
    for (const job of jobs) done.push({ job, results: runJob(job, sets[job.setIndex].lines.slice(job.start, job.end), A, B, opts.examples) });
    return done;
  }
  const queue = jobs.slice();
  const workers = Math.min(opts.jobs, jobs.length);
  const pool = [];
  await new Promise((resolve, reject) => {
    let running = workers;
    const fail = (error) => {
      pool.forEach((w) => w.terminate());
      reject(error);
    };
    for (let w = 0; w < workers; w++) {
      const worker = new Worker(new URL(import.meta.url), { workerData: { base, head, examples: opts.examples } });
      pool.push(worker);
      const inFlight = new Map();
      const next = () => {
        const job = queue.shift();
        if (!job) {
          worker.postMessage(null);
          return;
        }
        inFlight.set(job.id, job);
        worker.postMessage({ ...job, lines: sets[job.setIndex].lines.slice(job.start, job.end) });
      };
      worker.on('message', (msg) => {
        if (!msg.ready) {
          done.push({ job: inFlight.get(msg.id), results: msg.results });
          inFlight.delete(msg.id);
        }
        next();
      });
      worker.on('error', fail);
      worker.on('exit', (code) => {
        if (code !== 0 && inFlight.size) fail(new Error('a worker stopped with exit code ' + code));
        if (--running === 0) resolve();
      });
    }
  });
  if (done.length !== jobs.length) throw new Error('only ' + done.length + ' of ' + jobs.length + ' jobs finished');
  return done;
}

const codePoints = (s, max = 24) => {
  const cps = Array.from(s, (c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
  return cps.slice(0, max).join(' ') + (cps.length > max ? ' …' : '');
};
const shown = (v, max = 160) => {
  const text = v.startsWith('\u0000') ? v.slice(1) : JSON.stringify(v);
  return text.length > max ? text.slice(0, max) + '…' : text;
};
const num = (n) => n.toLocaleString('en-US');

async function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    const lines = fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n');
    const end = lines.findIndex((l) => !l.startsWith('//'));
    console.log(lines.slice(0, end).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    return 0;
  }
  const started = performance.now();
  const forms = selectForms(opts.forms);
  const base = prepareKnayi(opts.base);
  const head = prepareKnayi(opts.head);
  const A = await instantiate(base);
  const B = await instantiate(head);
  // A form the base lacks is skipped (an old release); a form the base has and the head lacks is a lost part of the
  // API, and fails the run.
  const skipped = forms.filter((f) => !available(f, A));
  const lost = forms.filter((f) => available(f, A) && !available(f, B));
  const run = forms.filter((f) => available(f, A) && available(f, B));

  let sets = [...generatedSets(), ...(opts.fuzz ? fuzzSets({ seed: opts.seed, count: opts.fuzz }) : [])];
  if (!opts.offline) sets = (await corpusSets({ without: opts.without })).sets.concat(sets);
  sets = sets.filter((s) => matches(s.id, opts.sets));
  if (sets.length === 0) throw new Error('no input set matches --sets ' + opts.sets.join(','));
  const unknownSets = opts.sets.filter((p) => !sets.some((s) => matches(s.id, [p])));
  if (unknownSets.length) throw new Error('no input set matches ' + unknownSets.join(', '));
  const expected = parseExpect(opts.expect, run, sets);

  console.log('knayi compare');
  console.log('  base  ' + describe(base));
  console.log('  head  ' + describe(head));
  if (base.libraryHash && base.libraryHash === head.libraryHash) console.log('  (base and head have the same main.js and library/)');
  console.log('\ninput sets (distinct strings)');
  for (const s of sets) console.log('  ' + s.id.padEnd(20) + num(s.lines.length).padStart(8) + '  ' + s.about);
  if (skipped.length) console.log('\nskipped (missing in the base): ' + skipped.map((f) => f.id).join(', '));
  if (lost.length) console.log('\nmissing in the head: ' + lost.map((f) => f.id).join(', '));

  const jobs = makeJobs(sets, run);
  const done = await runJobs(jobs, sets, { base, head, A, B }, opts);

  // Merge chunk results into one cell per form and set.
  const cells = new Map();
  let comparisons = 0;
  for (const { job, results } of done) {
    const set = sets[job.setIndex];
    for (const r of results) {
      const key = r.form + ':' + set.id;
      const cell = cells.get(key) || { form: r.form, set: set.id, inputs: 0, differ: 0, examples: [] };
      cell.inputs += job.end - job.start;
      cell.differ += r.differ;
      cell.examples.push(...r.examples);
      cells.set(key, cell);
      comparisons += job.end - job.start;
    }
  }
  const ordered = [];
  for (const f of run) for (const s of sets) if (cells.has(f.id + ':' + s.id)) ordered.push(cells.get(f.id + ':' + s.id));
  for (const cell of ordered) cell.examples = cell.examples.sort((a, b) => a.index - b.index).slice(0, opts.examples);

  // Check every cell against --expect: listed cells and form totals must match exactly, all others must be 0.
  const problems = lost.map((f) => 'the head lost the call form ' + f.id + ', which the base has');
  const totals = new Map();
  for (const cell of ordered) {
    totals.set(cell.form, (totals.get(cell.form) || 0) + cell.differ);
    const want = expected.get(cell.form + ':' + cell.set);
    if (want !== undefined) {
      cell.expected = want;
      if (cell.differ !== want) problems.push(cell.form + ' on ' + cell.set + ': ' + cell.differ + ' differences, ' + want + ' expected');
    } else if (!expected.has(cell.form + ':*') && cell.differ !== 0) {
      problems.push(cell.form + ' on ' + cell.set + ': ' + cell.differ + ' unexpected differences');
    }
  }
  for (const [key, want] of expected) {
    const [form, set] = key.split(':');
    if (set !== '*') continue;
    const got = totals.get(form) || 0;
    if (got !== want) problems.push(form + ' (all sets): ' + got + ' differences, ' + want + ' expected');
  }

  const seconds = (performance.now() - started) / 1000;
  const differing = ordered.filter((c) => c.differ > 0 || c.expected !== undefined);
  console.log('\n' + run.length + ' call forms, ' + sets.length + ' input sets: ' + num(comparisons) + ' comparisons in ' +
    seconds.toFixed(1) + ' s (' + (opts.jobs === 1 ? 'this thread' : Math.min(opts.jobs, jobs.length) + ' workers') + ')');
  if (differing.length) {
    console.log('\n' + 'call form'.padEnd(30) + 'input set'.padEnd(20) + 'differ'.padStart(8) + 'expected'.padStart(10) + 'of'.padStart(10));
    for (const c of differing) {
      console.log(c.form.padEnd(30) + c.set.padEnd(20) + num(c.differ).padStart(8) +
        (c.expected === undefined ? '' : num(c.expected)).padStart(10) + num(c.inputs).padStart(10));
    }
    for (const [form, total] of totals) {
      const want = expected.get(form + ':*');
      if (total || want !== undefined) console.log('  ' + form + ': ' + num(total) + ' in all' + (want === undefined ? '' : ', ' + num(want) + ' expected'));
    }
    if (differing.some((x) => x.examples.length)) console.log('\nexamples');
    for (const c of differing.filter((x) => x.examples.length)) {
      console.log('  ' + c.form + ' on ' + c.set);
      for (const e of c.examples) {
        console.log('    input ' + JSON.stringify(e.input) + '  ' + codePoints(e.input));
        console.log('      base ' + shown(e.base));
        console.log('      head ' + shown(e.head));
      }
    }
  }
  const total = ordered.reduce((n, c) => n + c.differ, 0);
  console.log('\n' + (problems.length ? 'FAIL' : 'OK') + ': ' + num(total) + ' differences' +
    (expected.size ? ', ' + expected.size + ' expectation' + (expected.size === 1 ? '' : 's') : ''));
  for (const p of problems) console.log('  ' + p);

  if (opts.json) {
    fs.writeFileSync(opts.json, JSON.stringify({
      base, head, offline: opts.offline, seed: opts.seed, fuzz: opts.fuzz,
      sets: sets.map((s) => ({ id: s.id, kind: s.kind, origin: s.origin, inputs: s.lines.length, total: s.total, about: s.about })),
      forms: run.map((f) => f.id), skipped: skipped.map((f) => f.id), lost: lost.map((f) => f.id),
      cells: ordered, comparisons, seconds, ok: problems.length === 0, problems
    }, null, 1) + '\n');
    console.error('wrote ' + opts.json);
  }
  return problems.length ? 1 : 0;
}

if (isMainThread) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (e) {
    console.error('compare: ' + (e && e.message ? e.message : e));
    process.exitCode = 2;
  }
} else {
  await workerMain();
}
