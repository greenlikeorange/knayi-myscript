// How a call's time grows with its input: the measuring and the verdict that test/growth.timing.js,
// test/performance.test.js and the growth part of scripts/eval/perf.mjs share. CI blocks on real super-linear
// growth and on large regressions, never on noise (decision 24(b) of the refactor plan).
//
// The verdict has two steps:
//   1. A cheap screen, set by the caller: t(span·n) / t(n) at two sizes within the confirming span, read as an
//      exponent (1 is linear, 2 quadratic). A reading at or below the caller's soft bound passes.
//   2. A reading above the soft bound is confirmed over a wide span (CONFIRM): from N to 8N units, over which
//      linear code grows about 8 times and quadratic code about 64 times. The case fails only when the exponent
//      stays at 1.5 or more (a ratio of 22.6) over two confirmations in a row, or when one call takes longer than
//      CONFIRM.capMs, an absolute cap for catastrophic cases that also ends the measurement at once. A screen
//      reading above the soft bound that the confirmation does not uphold comes back as 'unconfirmed', for the
//      caller to report.
//
// Why. GitHub's shared ubuntu runners failed the earlier one-step gates on linear code, on the pull requests of
// the 2.x stack from #76 on:
//   - perf.mjs under Node 24.21 read 1.31-1.35 per doubling from 8,192 to 32,768 units (its bound was 1.3) for
//     detected-font conversion of runs of U+1050, U+1056 and U+1058, the same on all three of its readings, and
//     under Bun read 1.30 on a run of the ASCII letter h after ka.
//   - Under Bun 1.4.2, test/growth.timing.js read t(2n)/t(n) of 3-5 (its limit was 2.6) at 16k-32k characters on
//     many shapes, from medians of single calls of 1-8 ms, on different shapes in each run, while the same file
//     passed on macOS. Some were runs of one character that never reach NFC: normalize on U+1036 read 4.3-4.7 in
//     all three attempts (1.2 ms at 16,384 characters, 5.0 ms at 32,768), and detected-font conversion of ka and
//     a run of U+1041 read 3.2-3.9 from 8,192 to 16,384.
// So the cost per unit of linear code can step up between two sizes on those machines (a cache level, an
// allocation threshold), and one doubling cannot tell that from super-linear code. A span of 8 can: Node's 1.6
// times the cost per unit from 8k to 32k reads about 1.23 over it, and linear code reaches 1.5 only when its cost
// per unit grows 2.8 times from N to 8N. The confirming spans also stay below the sizes where the runners stepped
// hardest: 8,192 units under Bun, whose steps came from 8k-16k on, and 32,768 under Node, below 64k units, where V8
// puts two-byte strings in its large-object space.
//
// N. With 12 CPU-burning processes beside it on an M3 Max (a harsher machine than the runners: the test is moved
// between performance and efficiency cores), over 315 call-form and shape pairs, linear code read at most 1.21
// over N to 8N under Node 26 at every N from 1,024 to 8,192, and under Bun 1.4.2 at most 1.29 from 1,024 and
// 1.33-1.39 from 2,048 to 8,192, because Bun's cost per unit climbs with size even on a quiet machine (31 ns a unit
// at 1k to 77 ns at 64k for normalize on ASCII). String.prototype.normalize on a run of dot below and virama, which
// is quadratic, read 1.84-2.0 at every N in both. Hence N = 4,096 under Node, where a quadratic term with a small
// constant shows more than at 1,024, and N = 1,024 under Bun, below its climb.
// NOISE_PLACEHOLDER
//
// What it catches. DETECT_PLACEHOLDER
//
// The readings. Each time is the fastest of several readings, in an order that rotates between the sizes. A
// reading is calls of the same input until at least `minMs` have passed, divided by the number of calls, and a
// confirming reading lasts at least 20 ms and starts with a full garbage collection: another process, a collection
// or a timer tick only ever adds time, so the fastest reading is the least disturbed, and 20 ms spread a collection
// that falls into a reading over many calls instead of doubling one call of 2 ms (the earlier gate took the median
// of single calls of 1-8 ms, which is what read 3-5 under Bun). The collection is Bun.gc(true) under Bun and
// global.gc under Node, which needs --expose-gc: the npm scripts pass it. `node --test` drops the flag in the test's
// own process on Node 24 (Node 26 keeps it), so without it this file gets V8's gc through a new context, as Jest's
// leak detector does, and only when that fails do Node readings go without a collection (`gcAvailable` is then
// false).

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
// screen runs on every case and can only pass it or send it on: readings of 20 ms after a collection there too took
// test/growth.timing.js from 18 s to 175 s under Node 26 on a quiet M3 Max (with its screen from N to 2N then), and
// sent no more cases on: none either way.
// Under Bun each comes after a collection, which took the readings above its soft bound from 30 to 2 there (14 s
// against 18 s). Under Node it does not: a forced full collection leaves sweeping to finish while the next short
// reading runs, and with 12 CPU-burning processes beside it, 212 screen readings went above the soft bound with a
// collection against 23 without, in 98 s against 34 s; idle, both had 1. The confirming step's 20 ms readings
// spread that work out, so they always collect.
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

// Times make(n) and make(span·n): { n, units, ms, exponent, capped, cappedAt }. The exponent is
// log(t2 / t1) / log(units2 / units1), null when a first call passed capMs and ended the measurement; cappedAt is
// the index of the input whose time passed capMs (-1 for none).
function measure(call, make, { n, span, readings, minMs, collect, spent, capMs }) {
  const inputs = [make(n), make(span * n)];
  const units = inputs.map((s) => s.length);
  const t = timeInputs(call, inputs, { readings, minMs, collect, spent, capMs });
  const cappedAt = t.capped !== -1 ? t.capped : t.ms.findIndex((ms) => ms > capMs);
  const exponent = t.capped !== -1 ? null : Math.log(t.ms[1] / Math.max(t.ms[0], 1e-6)) / Math.log(units[1] / units[0]);
  return { n, units, ms: t.ms, exponent, capped: cappedAt !== -1, cappedAt };
}

// The two-step verdict for call(make(n)). `screen` is { n, span, soft } and optionally fields of SCREEN: the sizes
// of the cheap reading and the exponent above which it is confirmed. `confirm` overrides fields of CONFIRM; `spent`
// is as for reading(). Returns { verdict: 'linear' | 'unconfirmed' | 'super-linear', screen, confirm, soft, bound,
// capMs }, where screen and confirm are measure() results, confirm null when the screen passed or a call passed the
// cap, and soft, bound and capMs the limits that applied.
function checkGrowth(call, make, { screen, confirm = {}, spent = null }) {
  const c = Object.assign({}, CONFIRM, confirm);
  const s = Object.assign({}, SCREEN, screen);
  const limits = { soft: s.soft, bound: c.exponent, capMs: c.capMs };
  const first = measure(call, make, Object.assign({}, s, { spent, capMs: c.capMs }));
  if (first.capped) return Object.assign({ verdict: 'super-linear', screen: first, confirm: null }, limits);
  if (first.exponent <= s.soft) return Object.assign({ verdict: 'linear', screen: first, confirm: null }, limits);
  let second = measure(call, make, Object.assign({}, c, { spent }));
  // A confirmation at or above the bound is measured once more, and the lower reading counts: super-linear code
  // reads high every time, while a stretch of interference seldom spoils six readings at one size in a row.
  if (!second.capped && second.exponent >= c.exponent) {
    const again = measure(call, make, Object.assign({}, c, { spent }));
    if (again.capped || again.exponent < second.exponent) second = again;
  }
  const over = second.capped || second.exponent >= c.exponent;
  return Object.assign({ verdict: over ? 'super-linear' : 'unconfirmed', screen: first, confirm: second }, limits);
}

const fixed = (x) => (x < 0.1 ? x.toFixed(3) : x < 10 ? x.toFixed(2) : x.toFixed(0));

// One line about a checkGrowth() result, for messages and reports.
function describeGrowth(result) {
  const units = (u) => u.toLocaleString('en-US');
  const part = (m, label, limit) => {
    const over = m.capped ? 'a call at ' + units(m.units[m.cappedAt]) + ' units took ' + fixed(m.ms[m.cappedAt]) +
      ' ms, over the cap of ' + result.capMs + ' ms' : '';
    if (m.exponent == null) return label + ' ' + m.units.map(units).join(' to ') + ' units: ' + over;
    return label + ' ' + m.units.map(units).join(' to ') + ' units: ' + m.ms.map(fixed).join(' and ') + ' ms a call, ' +
      'exponent ' + m.exponent.toFixed(2) + ' (' + limit + ')' + (over ? '; ' + over : '');
  };
  return part(result.screen, 'screen', 'soft bound ' + result.soft.toFixed(2)) +
    (result.confirm ? '; confirm ' + part(result.confirm, '', 'fails at ' + result.bound).trim() : '');
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
