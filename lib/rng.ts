// Deterministic, seedable PRNG so every experiment is exactly reproducible.
// This matters twice: (1) the demo/video shows the same run every time, and
// (2) in the live-edit interview we can reason about exact outputs.

export class RNG {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  // mulberry32
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(a = 0, b = 1): number {
    return a + (b - a) * this.next();
  }

  // Box–Muller
  normal(mean = 0, sd = 1): number {
    const u1 = Math.max(this.next(), 1e-12);
    const u2 = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  lognormal(mu = 0, sigma = 1): number {
    return Math.exp(this.normal(mu, sigma));
  }

  bernoulli(p: number): boolean {
    return this.next() < p;
  }

  // Marsaglia–Tsang gamma sampler (valid for shape >= 1, which always holds
  // for our Beta posteriors since alpha,beta start at 1 and only grow).
  gamma(shape: number): number {
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      const x = this.normal();
      const v = Math.pow(1 + c * x, 3);
      if (v <= 0) continue;
      const u = this.next();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  // Beta(a,b) via two gammas — the heart of Thompson sampling.
  beta(a: number, b: number): number {
    const ga = this.gamma(a);
    const gb = this.gamma(b);
    return ga / (ga + gb);
  }

  pick<T>(items: T[], weights: number[]): T {
    const sum = weights.reduce((s, w) => s + w, 0);
    let r = this.next() * sum;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
}

// Stable string -> 32-bit seed (FNV-1a). Lets each page own an independent RNG
// stream keyed by its id, so adding/removing/reordering a page never perturbs
// the others' simulated behavior.
export function hashStringToSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

export const clamp = (x: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, x));

// Wilson score interval for a binomial proportion — used for honest
// confidence bands on the leaderboard instead of naive +/- error.
export function wilson(successes: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}
