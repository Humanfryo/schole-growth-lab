import { LEN_REF } from "./constants";
import { inverse, Matrix, Vector, zeros } from "./linalg";
import { sigmoid } from "./rng";
import { ANGLES, CTAType, PageSpec } from "./types";

// Feature encoding for the response model. Angle emphasis enters as the page's
// angle weights; CTA as two dummies (soft = baseline); proof/specificity/length
// as scalars. Ridge handles the angle-weights-sum-to-1 collinearity.
export const FEATURE_NAMES = [
  "intercept",
  "roi",
  "pain",
  "personalization",
  "research",
  "speed",
  "cta_demo",
  "cta_trial",
  "socialProof",
  "specificity",
  "lengthNorm",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];
export const N_FEATURES = FEATURE_NAMES.length;

export function featurize(page: PageSpec): number[] {
  const f = page.features;
  return [
    1, // intercept
    f.angleWeights.roi,
    f.angleWeights.pain,
    f.angleWeights.personalization,
    f.angleWeights.research,
    f.angleWeights.speed,
    f.ctaType === "demo" ? 1 : 0,
    f.ctaType === "trial" ? 1 : 0,
    f.socialProof,
    f.specificity,
    (f.length - LEN_REF) / 4,
  ];
}

// Build a feature vector from raw design parameters (for the variant optimizer,
// which searches over parameters rather than over rendered pages).
export function featurizeParams(p: {
  angleWeights: Record<(typeof ANGLES)[number], number>;
  cta: CTAType;
  socialProof: number;
  specificity: number;
  length: number;
}): number[] {
  return [
    1,
    p.angleWeights.roi,
    p.angleWeights.pain,
    p.angleWeights.personalization,
    p.angleWeights.research,
    p.angleWeights.speed,
    p.cta === "demo" ? 1 : 0,
    p.cta === "trial" ? 1 : 0,
    p.socialProof,
    p.specificity,
    (p.length - LEN_REF) / 4,
  ];
}

export interface Coefficient {
  name: FeatureName;
  value: number;
  se: number;
  ci: [number, number];
}

export interface FitResult {
  coef: number[];
  coefByName: Record<FeatureName, Coefficient>;
  n: number;
  iters: number;
  converged: boolean;
  predict: (x: number[]) => number;
}

// Ridge logistic regression by IRLS / Newton–Raphson. The intercept is not
// penalized. Standard errors are read off the inverse penalized Hessian
// (approximate — we flag them as such in the UI).
export function fitLogistic(
  X: number[][],
  y: number[],
  opts: { ridge?: number; maxIter?: number; tol?: number } = {}
): FitResult {
  const ridge = opts.ridge ?? 1.0;
  const maxIter = opts.maxIter ?? 50;
  const tol = opts.tol ?? 1e-7;
  const n = X.length;
  const p = X[0]?.length ?? N_FEATURES;

  const beta = zeros(p);
  let iters = 0;
  let converged = false;
  let cov: Matrix | null = null;

  for (let it = 0; it < maxIter; it++) {
    iters = it + 1;
    // Hessian H = XᵀWX + λI (λ on non-intercept), gradient g = Xᵀ(y-mu) - λβ
    const H: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    const g: Vector = zeros(p);

    for (let i = 0; i < n; i++) {
      const xi = X[i];
      let eta = 0;
      for (let j = 0; j < p; j++) eta += xi[j] * beta[j];
      const mu = sigmoid(eta);
      const w = Math.max(mu * (1 - mu), 1e-6);
      const r = y[i] - mu;
      for (let j = 0; j < p; j++) {
        g[j] += xi[j] * r;
        const wxij = w * xi[j];
        for (let k = j; k < p; k++) H[j][k] += wxij * xi[k];
      }
    }
    // symmetrize + ridge (skip intercept at index 0)
    for (let j = 0; j < p; j++) {
      for (let k = j + 1; k < p; k++) H[k][j] = H[j][k];
      if (j > 0) {
        H[j][j] += ridge;
        g[j] -= ridge * beta[j];
      }
    }

    const Hinv = inverse(H);
    if (!Hinv) break;
    cov = Hinv;

    // beta_new = beta + Hinv · g
    let maxDelta = 0;
    for (let j = 0; j < p; j++) {
      let d = 0;
      for (let k = 0; k < p; k++) d += Hinv[j][k] * g[k];
      beta[j] += d;
      maxDelta = Math.max(maxDelta, Math.abs(d));
    }
    if (maxDelta < tol) {
      converged = true;
      break;
    }
  }

  const coefByName = {} as Record<FeatureName, Coefficient>;
  for (let j = 0; j < p; j++) {
    const variance = cov ? Math.max(cov[j][j], 0) : 0;
    const se = Math.sqrt(variance);
    coefByName[FEATURE_NAMES[j]] = {
      name: FEATURE_NAMES[j],
      value: beta[j],
      se,
      ci: [beta[j] - 1.96 * se, beta[j] + 1.96 * se],
    };
  }

  return {
    coef: beta,
    coefByName,
    n,
    iters,
    converged,
    predict: (x: number[]) => {
      let eta = 0;
      for (let j = 0; j < x.length; j++) eta += x[j] * beta[j];
      return sigmoid(eta);
    },
  };
}
