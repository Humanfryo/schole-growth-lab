// Tunable constants for the hidden data-generating process (DGP).
// These are calibrated (see scripts/calibrate.ts) so that:
//   - conversion rates land in a believable landing-page range (~3%–16%),
//   - one page wins overall, and
//   - different personas prefer clearly different pages (the targeting story).

export const DGP = {
  // logit weight on the persona·page angle-affinity term
  W_ANGLE: 4.2,
  // CTA match bonus / mismatch penalty (scaled by ctaStrength)
  CTA_MATCH: 0.55,
  CTA_MISMATCH: 0.45,
  // weights on scalar feature matches
  W_SPEC: 0.7,
  W_SOCIAL: 0.7,
  // penalty for a long page, scaled by (1 - persona length tolerance)
  W_LENGTH: 1.1,
  // per-visit logit noise (taste varies visit to visit)
  NOISE_SD: 0.45,

  // --- scroll / dwell behavior ---
  BASE_DWELL: 6, // seconds for a neutral section
  DWELL_SIGMA: 0.4, // lognormal noise on dwell
  CONT_BASE: 1.4, // baseline log-odds of scrolling past a section
  CONT_SLOPE: 1.6, // how much section interest changes that

  // conversion can only happen if the visitor engages enough to reach a CTA;
  // scroll depth gates it (hero CTA gives the 0.35 floor).
  SCROLL_GATE_FLOOR: 0.35,
} as const;

// Length is normalized as (#sections - LEN_REF) so an "average" page is neutral.
export const LEN_REF = 6;
