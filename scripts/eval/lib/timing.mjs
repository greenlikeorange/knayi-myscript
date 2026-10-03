// Timing helpers for perf.mjs. Two copies are always timed in one process and interleaved, and only their ratio
// is reported: absolute times drift between runs on the same machine (12-24% in the refactor plan's measurements),
// while the interleaved median ratio of two identical copies stayed within about 3%.

export const now = () => performance.now();

export function median(xs) {
  const s = xs.slice().sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function timeOnce(fn) {
  const start = now();
  fn();
  return now() - start;
}

// A full garbage collection where the runtime offers one: Bun.gc(true) under Bun, global.gc() under Node only when
// it runs with --expose-gc. Otherwise nothing.
export const collectGarbage = typeof Bun !== 'undefined' ? () => Bun.gc(true)
  : typeof globalThis.gc === 'function' ? () => globalThis.gc() : () => {};

// Runs a and b `runs` times each, alternating which of the two goes first, and returns both lists of times.
// `before` runs untimed before every timed run.
export function alternate(a, b, runs, startWithB = false, before = null) {
  const ta = [];
  const tb = [];
  const time = (fn) => {
    if (before) before();
    return timeOnce(fn);
  };
  for (let i = 0; i < runs; i++) {
    if ((i % 2 === 1) !== startWithB) {
      tb.push(time(b));
      ta.push(time(a));
    } else {
      ta.push(time(a));
      tb.push(time(b));
    }
  }
  return { a: ta, b: tb };
}

// The mean time of one call, over as many calls as fit in `minMs` (at least one).
export function perCall(fn, minMs) {
  let calls = 0;
  const start = now();
  let elapsed;
  do {
    fn();
    calls++;
    elapsed = now() - start;
  } while (elapsed < minMs);
  return elapsed / calls;
}

// How a call's time grows with its input, per doubling: 1 is linear, 2 quadratic. The plan's measure is
// log2(t(2n) / t(n)); this averages it over two doublings, log2(t(4n) / t(n)) / 2, because a single doubling reads
// anywhere from 0.9 to 1.3 on linear code under Bun. t(n), t(2n) and t(4n) are the medians of `samples` rotating
// per-call timings of at least `sampleMs` each, after `warmMs` of calls at each size. A call slower than `capMs`
// at n is reported without an exponent.
// The sizes stay small on purpose: n = 1,024 UTF-16 units, so 4n = 4,096. Linear code costs more per unit on
// longer strings. Under V8 the step is where strings pass 128 KB (64k units) and go to the large-object space: the
// Win reader took about 21 ns a unit up to 128k units and 60 ns at 1M, and a doubling across the step read 1.3-2.2.
// Under Bun the cost per unit starts to climb from about 4k units (1.1-1.3 a doubling up to 64k). Super-linear
// code shows long before either: the 2.10 quadratic normalize reads 2.0 at these sizes.
export function growthExponent(call, make, { n = 1024, samples = 3, sampleMs = 5, warmMs = 10, capMs = 1500 } = {}) {
  const sizes = [make(n), make(2 * n), make(4 * n)];
  call(sizes[0].slice(0, 64));
  const first = timeOnce(() => call(sizes[0]));
  if (first > capMs) return { n, units: sizes[0].length, ms: first, exponent: null };
  // Calls at every size first, so the engine has compiled the code paths each size takes before timing starts.
  for (const x of sizes) perCall(() => call(x), warmMs);
  const times = sizes.map(() => []);
  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < sizes.length; j++) {
      const k = (i + j) % sizes.length;
      times[k].push(perCall(() => call(sizes[k]), sampleMs));
    }
  }
  const [t1, t2, t4] = times.map(median);
  return { n, units: sizes[0].length, ms: t1, ms2: t2, ms4: t4, exponent: Math.log2(t4 / t1) / 2 };
}
