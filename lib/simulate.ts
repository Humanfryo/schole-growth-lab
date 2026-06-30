import { DGP, LEN_REF } from "./constants";
import { Persona, PERSONAS } from "./personas";
import { clamp, RNG, sigmoid, wilson } from "./rng";
import { PageSpec, PageStat, Visit } from "./types";

// True conversion propensity (logit) of a persona on a page. This is the latent
// utility the optimizer is NOT allowed to see — it only observes the clicks that
// result from it.
export function trueLogit(persona: Persona, page: PageSpec): number {
  const f = page.features;

  // angle affinity: persona's taste dotted with the page's emphasis
  let angle = 0;
  for (const a of Object.keys(f.angleWeights) as (keyof typeof f.angleWeights)[]) {
    angle += persona.anglePrefs[a] * f.angleWeights[a];
  }

  // CTA fit
  const ctaTerm =
    (persona.ctaPref === f.ctaType ? DGP.CTA_MATCH : -DGP.CTA_MISMATCH) *
    f.ctaStrength;

  // scalar feature fits
  const specTerm = DGP.W_SPEC * persona.specificityPref * f.specificity;
  const socialTerm = DGP.W_SOCIAL * persona.socialProofPref * f.socialProof;

  // length penalty: longer pages cost more for impatient personas
  const lengthNorm = clamp((f.length - LEN_REF) / 4, -1, 1);
  const lengthTerm = -DGP.W_LENGTH * (1 - persona.lengthTolerance) * lengthNorm;

  return (
    persona.baseLogit +
    DGP.W_ANGLE * angle +
    ctaTerm +
    specTerm +
    socialTerm +
    lengthTerm
  );
}

// Simulate one visit and return the observable signals.
export function simulateVisit(
  rng: RNG,
  page: PageSpec,
  persona: Persona
): Visit {
  const n = page.sections.length;
  const dwell = new Array<number>(n).fill(0);

  // Scroll through sections; a section's interest drives both how long the
  // visitor lingers and whether they keep going.
  let lastViewed = 0;
  for (let i = 0; i < n; i++) {
    const interest = persona.anglePrefs[page.sections[i].angle];
    const base = DGP.BASE_DWELL * (1 + 0.8 * interest);
    dwell[i] = Math.max(0.3, base * rng.lognormal(0, DGP.DWELL_SIGMA));
    lastViewed = i;
    const pContinue = sigmoid(DGP.CONT_BASE + DGP.CONT_SLOPE * interest);
    if (i < n - 1 && !rng.bernoulli(pContinue)) break;
  }
  // sections never reached have 0 dwell
  for (let i = lastViewed + 1; i < n; i++) dwell[i] = 0;

  const scrollDepth = (lastViewed + 1) / n;
  const timeOnPage = dwell.reduce((s, d) => s + d, 0);
  const bounced = scrollDepth <= 1 / n + 1e-9 && lastViewed === 0;

  // Conversion: latent propensity, gated by how far they engaged (you can't
  // click a CTA you never scrolled to; the hero CTA gives a floor).
  const p = sigmoid(trueLogit(persona, page) + rng.normal(0, DGP.NOISE_SD));
  const gate = DGP.SCROLL_GATE_FLOOR + (1 - DGP.SCROLL_GATE_FLOOR) * scrollDepth;
  const converted = rng.bernoulli(p * gate);

  return {
    pageId: page.id,
    segment: persona.id,
    sectionDwell: dwell,
    scrollDepth,
    timeOnPage,
    bounced,
    converted,
  };
}

export function samplePersona(rng: RNG): Persona {
  return rng.pick(
    PERSONAS,
    PERSONAS.map((p) => p.share)
  );
}

// An even-allocation exploration pass: every page gets the same traffic, drawn
// from the same persona mixture. This gives clean, unbiased behavioral data for
// the heatmap, per-segment tables, and credit assignment — separate from the
// bandit, which deliberately starves losers and so can't characterize them.
export function sampleBehavior(
  pages: PageSpec[],
  opts: { seed: number; perPage: number }
): { visits: Visit[]; stats: PageStat[] } {
  const rng = new RNG(opts.seed);
  const visits: Visit[] = [];
  for (const page of pages) {
    for (let i = 0; i < opts.perPage; i++) {
      const persona = samplePersona(rng);
      visits.push(simulateVisit(rng, page, persona));
    }
  }
  const stats = pages.map((p) => aggregate(p.id, visits, p.sections.length));
  return { visits, stats };
}

// Aggregate a batch of visits for one page into a stat block.
export function aggregate(pageId: string, visits: Visit[], nSections: number): PageStat {
  const mine = visits.filter((v) => v.pageId === pageId);
  const conv = mine.filter((v) => v.converted);
  const visitsN = mine.length;
  const convN = conv.length;

  const sectionDwellAll = new Array<number>(nSections).fill(0);
  const sectionDwellConv = new Array<number>(nSections).fill(0);
  for (const v of mine) {
    for (let i = 0; i < nSections; i++) sectionDwellAll[i] += v.sectionDwell[i] ?? 0;
  }
  for (const v of conv) {
    for (let i = 0; i < nSections; i++) sectionDwellConv[i] += v.sectionDwell[i] ?? 0;
  }
  for (let i = 0; i < nSections; i++) {
    sectionDwellAll[i] /= visitsN || 1;
    sectionDwellConv[i] /= convN || 1;
  }

  const bySegment: PageStat["bySegment"] = {};
  for (const v of mine) {
    const s = (bySegment[v.segment] ??= { visits: 0, conversions: 0, convRate: 0 });
    s.visits++;
    if (v.converted) s.conversions++;
  }
  for (const s of Object.values(bySegment)) s.convRate = s.conversions / (s.visits || 1);

  return {
    pageId,
    visits: visitsN,
    conversions: convN,
    convRate: convN / (visitsN || 1),
    ci: wilson(convN, visitsN),
    avgScrollDepth: mean(mine.map((v) => v.scrollDepth)),
    avgTimeOnPage: mean(mine.map((v) => v.timeOnPage)),
    bounceRate: mean(mine.map((v) => (v.bounced ? 1 : 0))),
    sectionDwellAll,
    sectionDwellConverters: sectionDwellConv,
    bySegment,
  };
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
