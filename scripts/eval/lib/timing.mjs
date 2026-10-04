// Timing helpers for perf.mjs's rows. Two copies are always timed in one process and interleaved, and only their
// ratio is reported: absolute times drift between runs on the same machine (12-24% in the refactor plan's
// measurements), while the interleaved median ratio of two identical copies stayed within 3% under Node and 6% under
// Bun. The growth exponents are measured by scripts/testing/growth.js, which test/growth.timing.js shares.

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

// A full garbage collection before each timed row run where the runtime offers one: Bun.gc(true) under Bun,
// global.gc() under Node only when it runs with --expose-gc. Otherwise nothing.
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
