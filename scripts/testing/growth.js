// How a call's time grows with its input: the measuring and the verdict that test/growth.timing.js,
// test/performance.test.js and the growth part of scripts/eval/perf.mjs share. CI blocks on real super-linear
// growth and on large regressions, never on noise (decision 24(b) of the refactor plan).
//
// The verdict has two steps:
//   1. A cheap screen, set by the caller: t(span·n) / t(n) at two sizes within the confirming span, read as an
//      exponent (1 is linear, 2 quadratic). A reading at or below the caller's soft bound passes.
//   2. A reading above the soft bound is confirmed over a wide span (CONFIRM): N, 4N and 8N units, where linear
//      code grows about 8 times from N to 8N and quadratic code about 64 times. The case fails only when the
//      exponent from N to 8N and the exponent of the top doubling, from 4N to 8N, are both 1.5 or more, in two
//      confirmations in a row, or when one call takes longer than CONFIRM.capMs, an absolute cap for catastrophic
//      cases that also ends the measurement at once. A screen reading above the soft bound that the confirmation
//      does not uphold comes back as 'unconfirmed', for the caller to report.
//
// Why. GitHub's shared ubuntu runners failed the earlier one-step gates on linear code, on the pull requests of
// the 2.x stack from #76 on:
//   - perf.mjs under Node 24.21 read 1.31-1.34 per doubling from 8,192 to 32,768 units (its bound was 1.3) for
//     detected-font conversion of runs of U+1050, U+1056 and U+1058 (#78), and under Bun read 1.30 on a run of the
//     ASCII letter h after ka (#79).
//   - Under Bun 1.4.2, test/growth.timing.js read t(2n)/t(n) of 3.8-5.1 (its limit was 2.6) from medians of single
//     calls of a few milliseconds: Win to Unicode on a run of U+1023 took 2.0 ms at 16,384 characters and 7.8 ms at
//     32,768 (#76).
// The cost per unit of linear code steps up between sizes (a cache level, an allocation threshold), and one
// doubling cannot tell that from super-linear code. On a 4-CPU Linux machine, Win to Unicode on a run of U+1058
// took 310 ns a unit at 1,024 units under Bun 1.4.2, 550 at 2,048, 650 at 8,192 and 1,060 at 32,768, and no more at
// 65,536; under Node 22 it took 67 ns a unit at 4,096, 135 at 16,384 and 131 at 32,768. A span of 8 dilutes such a
// step (the Bun run reads 1.35 from 1,024 to 8,192), and the top doubling, above it, reads it as linear (1.25 from
// 4,096 to 8,192), while super-linear time keeps growing to the top. The confirming spans also stay below 64k units,
// where V8 puts two-byte strings in its large-object space.
//
// N is 4,096 under Node and 1,024 under Bun, whose calls take several times as long (the Win reader above, four to
// eight times), so that a confirmation of super-linear code stays inside the time cap under Bun too.
//
// Noise. On a 4-CPU Linux machine with 4 CPU-burning processes beside the test (more runnable processes than CPUs),
// 14 runs of test/growth.timing.js, 7 under Node 22 and 7 under Bun 1.4.2, failed nothing: between 85 and 265 screen
// readings a run went above the soft bound, and none was confirmed. The highest exponent a confirmation read over
// its whole span was 1.48 under Node and 1.49 under Bun (12 of the runs were made before the top-doubling condition
// existed); on the idle machine, 1.39 and 1.45. So 1.5 sits just above what linear code reads on an overloaded
// machine, and the top doubling and the second confirmation are the margin.
//
// What it catches. 2.10.0's quadratic normalize (placeTypedFirst before #74): under Node one call on ka followed by
// 16,384 e took 2.9-3.9 s, past the cap; under Bun its confirmations read 1.94-2.00, with top doublings of 1.78-1.93.
// Linear normalize with a quadratic term added, through checkGrowth with the screens of the growth test and of
// perf.mjs, 10 trials each under both runtimes: a term costing 0.35 times the linear time at N, where the exponent
// from N to 8N reaches 1.5 ((8 + 64r) / (1 + r) = 22.6), failed in 8 to 10 trials; one costing half the linear
// time, in 7 to 10; three quarters, in 9 or 10; and linear normalize alone in none. A weaker term can pass.
//
// The readings. Each time is the fastest of several readings, in an order that rotates between the sizes. A
// reading is calls of the same input until at least `minMs` have passed, divided by the number of calls, and a
// confirming reading lasts at least 20 ms and starts with a full garbage collection: another process, a collection
// or a timer tick only ever adds time, so the fastest reading is the least disturbed, and 20 ms spread a collection
// that falls into a reading over many calls instead of doubling one call of 2 ms (the earlier gate took the median
// of single calls of a few milliseconds, which is what read 3.8-5.1 under Bun). The collection is Bun.gc(true) under
// Bun and global.gc under Node, which needs --expose-gc: the npm scripts pass it. Without the flag this file gets
// V8's gc through a new context, as Jest's leak detector does, and only when that fails do Node readings go without
// a collection (`gcAvailable` is then false).

const BUN = typeof Bun !== 'undefined';
const now = () => performance.now();

function findGc() {
  if (BUN) return () => Bun.gc(true);
  if (typeof globalThis.gc === 'function') return globalThis.gc;
  try {
    require('v8').setFlagsFromString('--expose-gc');
    const gc = require('vm').runInNewContext('gc');
    if (typeof gc === 'function') return gc;
  } catch (e) {
    // No collection; readings still work, with more noise.
  }
  return null;
}
const gc = findGc();
const collectGarbage = gc ? () => gc() : () => {};

// The screen's readings, unless the caller sets them: three of at least 1 ms per size. They are short because the
// screen runs on every case and can only pass it or send it on to the confirmation, whose readings of 20 ms after
// a collection would make the growth test many times slower if every case had them. Under Bun each screen reading
// comes after a collection too. Under Node it does not: a forced full collection leaves sweeping to finish while
// the next short reading runs. The confirming step's 20 ms readings spread that work out, so they always collect.
const SCREEN = { readings: 3, minMs: 1, collect: BUN };

// The confirming step, per runtime: inputs of about N and span·N units.
const CONFIRM = {
  n: BUN ? 1024 : 4096,
  span: 8,
  exponent: 1.5,
  readings: 3,
  minMs: 20,
  capMs: 1000
};

// One reading: ms per call of call(input), over calls that take at least minMs together, after a full garbage
// collection (with `collect`). `spent`, when given, returns a running total of milliseconds to leave out of the
// reading (time spent in String.prototype.normalize, say); the calls still run for minMs of wall time.
function reading(call, input, { minMs = 20, collect = true, spent = null } = {}) {
  if (collect) collectGarbage();
  const before = spent ? spent() : 0;
  let calls = 0;
  const start = now();
  let elapsed;
  do {
    call(input);
    calls++;
    elapsed = now() - start;
  } while (elapsed < minMs);
  return (elapsed - (spent ? spent() - before : 0)) / calls;
}

// The fastest of `readings` readings of each input, rotating which input goes first. Each input is first called
// once, in order, so that the engine has compiled the paths each size takes; a first call slower than capMs stops
// the measurement, and `capped` is then that input's index (-1 otherwise), with the first calls' times in `ms`.
function timeInputs(call, inputs, { readings = 3, minMs = 20, collect = true, spent = null, capMs = Infinity } = {}) {
  const ms = inputs.map(() => Infinity);
  const firsts = [];
  for (let i = 0; i < inputs.length; i++) {
    firsts.push(reading(call, inputs[i], { minMs: 0, collect, spent }));
    if (firsts[i] > capMs) return { ms: ms.map((x, j) => (j <= i ? firsts[j] : x)), capped: i };
  }
  for (let r = 0; r < readings; r++) {
    for (let j = 0; j < inputs.length; j++) {
      const i = (r + j) % inputs.length;
      ms[i] = Math.min(ms[i], reading(call, inputs[i], { minMs, collect, spent }));
    }
  }
  return { ms, capped: -1 };
}

// Times make(n) and make(span·n), and with `top` make(span·n / 2) between them: { n, units, ms, exponent, top,
// capped, cappedAt }. The exponent is log(t(span·n) / t(n)) / log(units ratio) over the whole span, and `top` the
// same over its top doubling (null without `top`); both are null when a first call passed capMs and ended the
// measurement. cappedAt is the index of the input whose time passed capMs (-1 for none).
function measure(call, make, { n, span, top = false, readings, minMs, collect, spent, capMs }) {
  const inputs = [make(n)].concat(top ? [make(span * n / 2)] : [], [make(span * n)]);
  const units = inputs.map((s) => s.length);
  const t = timeInputs(call, inputs, { readings, minMs, collect, spent, capMs });
  const cappedAt = t.capped !== -1 ? t.capped : t.ms.findIndex((ms) => ms > capMs);
  const growth = (i, j) => (t.capped !== -1 ? null : Math.log(t.ms[j] / Math.max(t.ms[i], 1e-6)) / Math.log(units[j] / units[i]));
  const last = inputs.length - 1;
  return { n, units, ms: t.ms, exponent: growth(0, last), top: top ? growth(last - 1, last) : null, capped: cappedAt !== -1, cappedAt };
}

// The two-step verdict for call(make(n)). `screen` is { n, span, soft } and optionally fields of SCREEN: the sizes
// of the cheap reading and the exponent above which it is confirmed. `confirm` overrides fields of CONFIRM; `spent`
// is as for reading(). Returns { verdict: 'linear' | 'unconfirmed' | 'super-linear', screen, confirm, soft, bound,
// capMs }, where screen and confirm are measure() results (confirm with `top`), confirm null when the screen passed
// or a call passed the cap, and soft, bound and capMs the limits that applied.
function checkGrowth(call, make, { screen, confirm = {}, spent = null }) {
  const c = Object.assign({}, CONFIRM, confirm);
  const s = Object.assign({}, SCREEN, screen);
  const limits = { soft: s.soft, bound: c.exponent, capMs: c.capMs };
  const first = measure(call, make, Object.assign({}, s, { spent, capMs: c.capMs }));
  if (first.capped) return Object.assign({ verdict: 'super-linear', screen: first, confirm: null }, limits);
  if (first.exponent <= s.soft) return Object.assign({ verdict: 'linear', screen: first, confirm: null }, limits);
  // A confirmation is over the bound when the whole span and its top doubling both read at or above it: a step in
  // the cost per unit of linear code sits at one size and lifts the exponent of the span that holds it, while
  // super-linear time keeps growing to the top.
  const score = (m) => (m.capped ? Infinity : Math.min(m.exponent, m.top));
  let second = measure(call, make, Object.assign({}, c, { top: true, spent }));
  // A confirmation over the bound is measured once more, and the lower reading counts: super-linear code reads high
  // every time, while a stretch of interference seldom spoils nine readings in a row.
  if (!second.capped && score(second) >= c.exponent) {
    const again = measure(call, make, Object.assign({}, c, { top: true, spent }));
    if (score(again) < score(second)) second = again;
  }
  const over = score(second) >= c.exponent;
  return Object.assign({ verdict: over ? 'super-linear' : 'unconfirmed', screen: first, confirm: second }, limits);
}

const fixed = (x) => (x < 0.1 ? x.toFixed(3) : x < 10 ? x.toFixed(2) : x.toFixed(0));

// One line about a checkGrowth() result, for messages and reports.
function describeGrowth(result) {
  const units = (u) => u.toLocaleString('en-US');
  const part = (m, label, limit) => {
    const over = m.capped ? 'a call at ' + units(m.units[m.cappedAt]) + ' units took ' + fixed(m.ms[m.cappedAt]) +
      ' ms, over the cap of ' + result.capMs + ' ms' : '';
    const list = (xs) => xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
    if (m.exponent == null) return label + ' ' + list(m.units.map(units)) + ' units: ' + over;
    return label + ' ' + list(m.units.map(units)) + ' units: ' + list(m.ms.map(fixed)) + ' ms a call, ' +
      'exponent ' + m.exponent.toFixed(2) + (m.top == null ? '' : ', top doubling ' + m.top.toFixed(2)) +
      ' (' + limit + ')' + (over ? '; ' + over : '');
  };
  return part(result.screen, 'screen', 'soft bound ' + result.soft.toFixed(2)) +
    (result.confirm ? '; confirm ' + part(result.confirm, '', 'fails when both reach ' + result.bound).trim() : '');
}

module.exports = {
  SCREEN,
  CONFIRM,
  gcAvailable: gc !== null,
  collectGarbage,
  reading,
  timeInputs,
  measure,
  checkGrowth,
  describeGrowth
};
