import { ExperimentResult, runExperiment } from "./bandit";
import { buildExplorationDesign } from "./design";
import { computeInsights, Insights } from "./insights";
import { fitResponseModel, ResponseModel } from "./learn";
import { sampleBehavior } from "./simulate";
import { PageSpec, PageStat } from "./types";
import { optimizeVariant, realizeVariant, VariantPlan } from "./variant";

export const LAB_CONFIG = {
  exploreSeed: 99,
  explorePerPage: 600,
  showcaseSeed: 1234,
  showcasePerPage: 1500,
  banditSeed: 42,
  rounds: 14,
  visitorsPerRound: 300,
  phase2Seed: 7,
  evolutionMaxRounds: 4,
  multiSeedK: 40,
  acceptEps: 0.003, // a variant must beat the incumbent by >0.3pt to be accepted
};

// ---- low-level primitives -------------------------------------------------

export function buildModel(seed = LAB_CONFIG.exploreSeed): {
  designPages: PageSpec[];
  model: ResponseModel;
} {
  const designPages = buildExplorationDesign();
  const { visits } = sampleBehavior(designPages, { seed, perPage: LAB_CONFIG.explorePerPage });
  const model = fitResponseModel(designPages, visits);
  return { designPages, model };
}

// Clean, equal-N evaluation of a field of pages. Returns per-page stats and the
// per-page true rates used as the honest baselines/regret reference.
export function evaluateField(
  pages: PageSpec[],
  seed: number,
  perPage = LAB_CONFIG.showcasePerPage
): { stats: PageStat[]; trueRates: Record<string, number> } {
  const { stats } = sampleBehavior(pages, { seed, perPage });
  const trueRates: Record<string, number> = {};
  for (const s of stats) trueRates[s.pageId] = s.convRate;
  return { stats, trueRates };
}

export function race(
  pages: PageSpec[],
  seed: number,
  trueRates: Record<string, number>
): ExperimentResult {
  return runExperiment(
    pages,
    { seed, rounds: LAB_CONFIG.rounds, visitorsPerRound: LAB_CONFIG.visitorsPerRound },
    { trueRates }
  );
}

// ---- phase 1 --------------------------------------------------------------

export interface LabState {
  designPages: PageSpec[];
  model: ResponseModel;
  showcasePages: PageSpec[];
  behaviorStats: PageStat[];
  trueRates: Record<string, number>;
  experiment: ExperimentResult;
  insights: Insights;
}

export function runLab(showcasePages: PageSpec[]): LabState {
  const { designPages, model } = buildModel();
  const { stats, trueRates } = evaluateField(showcasePages, LAB_CONFIG.showcaseSeed);
  const experiment = race(showcasePages, LAB_CONFIG.banditSeed, trueRates);
  const insights = computeInsights(showcasePages, stats, model);
  return { designPages, model, showcasePages, behaviorStats: stats, trueRates, experiment, insights };
}

// ---- variant generation + honest same-pass lift ---------------------------

export interface VariantEvaluation {
  field: PageSpec[];
  stats: PageStat[];
  trueRates: Record<string, number>;
  experiment: ExperimentResult;
  variantRate: number;
  baselineId: string;
  baselineName: string;
  baselineRate: number;
  liftPct: number;
}

// Measure the variant and the best original in the SAME pass / same field, so
// the lift number is honest (no cross-seed, cross-field comparison).
export function evaluateVariant(
  showcasePages: PageSpec[],
  variant: PageSpec,
  seed = LAB_CONFIG.phase2Seed
): VariantEvaluation {
  const field = [...showcasePages, variant];
  const { stats, trueRates } = evaluateField(field, seed);
  const byId = new Map(stats.map((s) => [s.pageId, s]));
  const variantRate = byId.get(variant.id)?.convRate ?? 0;

  let baselineId = showcasePages[0].id;
  let baselineRate = -1;
  for (const p of showcasePages) {
    const r = byId.get(p.id)?.convRate ?? 0;
    if (r > baselineRate) {
      baselineRate = r;
      baselineId = p.id;
    }
  }
  const baselineName = showcasePages.find((p) => p.id === baselineId)?.name ?? "best original";
  const experiment = race(field, seed, trueRates);
  return {
    field,
    stats,
    trueRates,
    experiment,
    variantRate,
    baselineId,
    baselineName,
    baselineRate,
    liftPct: baselineRate > 0 ? ((variantRate - baselineRate) / baselineRate) * 100 : 0,
  };
}

export function planAndRealize(
  insights: Insights,
  showcasePages: PageSpec[],
  opts: { id: string; forSegment?: string; rank?: number; segName?: string }
): { plan: VariantPlan; variant: PageSpec } {
  const plan = optimizeVariant(insights, showcasePages, opts);
  return { plan, variant: realizeVariant(plan) };
}

// ---- multi-round evolution -------------------------------------------------

export interface EvolutionRound {
  round: number;
  variant: PageSpec;
  predictedConv: number;
  observedRate: number;
  incumbentRate: number;
  accepted: boolean;
  frontier: number; // best accepted rate so far
}

export interface EvolutionResult {
  rounds: EvolutionRound[];
  acceptedVariants: PageSpec[];
  field: PageSpec[];
}

export function runEvolution(
  showcasePages: PageSpec[],
  insights: Insights,
  maxRounds = LAB_CONFIG.evolutionMaxRounds
): EvolutionResult {
  const field = [...showcasePages];
  const accepted: PageSpec[] = [];
  const rounds: EvolutionRound[] = [];

  // incumbent = best original, measured clean
  const base = evaluateField(showcasePages, LAB_CONFIG.phase2Seed);
  let frontier = Math.max(...showcasePages.map((p) => base.trueRates[p.id] ?? 0));

  for (let r = 0; r < maxRounds; r++) {
    const plan = optimizeVariant(insights, showcasePages, { id: `V${r + 1}`, rank: r });
    const variant = realizeVariant(plan);
    const { stats, trueRates } = evaluateField([...field, variant], LAB_CONFIG.phase2Seed + r);
    const observedRate = stats.find((s) => s.pageId === variant.id)?.convRate ?? 0;
    const incumbentRate = Math.max(...field.map((p) => trueRates[p.id] ?? 0));
    const accept = observedRate > incumbentRate + LAB_CONFIG.acceptEps;
    if (accept) {
      field.push(variant);
      accepted.push(variant);
      frontier = Math.max(frontier, observedRate);
    }
    rounds.push({
      round: r + 1,
      variant,
      predictedConv: plan.predictedConv,
      observedRate,
      incumbentRate,
      accepted: accept,
      frontier,
    });
  }
  return { rounds, acceptedVariants: accepted, field };
}

// ---- multi-seed lift distribution ------------------------------------------

export interface MultiSeedLift {
  meanLiftPct: number;
  ciLow: number;
  ciHigh: number;
  winRate: number;
  n: number;
}

export function multiSeedLift(
  showcasePages: PageSpec[],
  insights: Insights,
  k = LAB_CONFIG.multiSeedK
): MultiSeedLift {
  // the variant plan is fixed (model is fixed); only the evaluation seed varies.
  // Clean evaluation only (no bandit) so the distribution is cheap to compute.
  const { variant } = planAndRealize(insights, showcasePages, { id: "V1" });
  const field = [...showcasePages, variant];
  const lifts: number[] = [];
  let wins = 0;
  for (let i = 0; i < k; i++) {
    const { trueRates } = evaluateField(field, 5000 + i * 17, 700);
    const variantRate = trueRates[variant.id] ?? 0;
    const baselineRate = Math.max(...showcasePages.map((p) => trueRates[p.id] ?? 0));
    if (baselineRate > 0) lifts.push(((variantRate - baselineRate) / baselineRate) * 100);
    if (variantRate > baselineRate) wins++;
  }
  lifts.sort((a, b) => a - b);
  const mean = lifts.reduce((a, b) => a + b, 0) / (lifts.length || 1);
  const pct = (q: number) => lifts[Math.min(lifts.length - 1, Math.max(0, Math.floor(q * (lifts.length - 1))))];
  return {
    meanLiftPct: mean,
    ciLow: pct(0.025),
    ciHigh: pct(0.975),
    winRate: wins / (k || 1),
    n: k,
  };
}

// evaluateField runs at showcasePerPage; helper to read one page's rate
export function rateOf(stats: PageStat[], id: string): number {
  return stats.find((s) => s.pageId === id)?.convRate ?? 0;
}
