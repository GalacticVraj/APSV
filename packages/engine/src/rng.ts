/**
 * Deterministic pseudo-random number generation.
 *
 * Every stochastic element in TERRAFLUX — synthetic supply history, Monte Carlo
 * uncertainty draws, tie-breaking inside the solver — routes through here with an
 * explicit seed. Two runs with the same seed produce byte-identical results, which
 * is what makes the demo reproducible and the optimiser auditable.
 */

/** mulberry32 — small, fast, good enough statistically, fully deterministic. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 32-bit hash of a string — used to seed per-entity streams. */
export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Standard normal via Box–Muller. */
export function normal(rng: () => number, mean = 0, sd = 1): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Lognormal draw specified by the *arithmetic* mean and a relative standard
 * deviation. Emission factors are strictly positive and right-skewed, so a
 * lognormal is the correct family — a normal draw can go negative, which would
 * silently produce nonsense carbon numbers.
 */
export function lognormalAround(rng: () => number, mean: number, relSd: number): number {
  if (mean === 0) return 0;
  const sign = mean < 0 ? -1 : 1;
  const m = Math.abs(mean);
  const variance = (relSd * m) ** 2;
  const sigma2 = Math.log(1 + variance / (m * m));
  const mu = Math.log(m) - sigma2 / 2;
  return sign * Math.exp(normal(rng, mu, Math.sqrt(sigma2)));
}

/** Triangular draw on [lo, hi] with mode — used where only a range is defensible. */
export function triangular(rng: () => number, lo: number, mode: number, hi: number): number {
  const u = rng();
  const c = (mode - lo) / (hi - lo);
  if (u < c) return lo + Math.sqrt(u * (hi - lo) * (mode - lo));
  return hi - Math.sqrt((1 - u) * (hi - lo) * (hi - mode));
}

/** Percentile of an already-sorted ascending array, linear interpolation. */
export function percentileSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return Math.sqrt(s / (xs.length - 1));
}
