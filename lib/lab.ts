import { ExperimentResult, runExperiment } from "./bandit";
import { computeInsights, Insights } from "./insights";
import { sampleBehavior } from "./simulate";
import { PageSpec, PageStat, Visit } from "./types";

// One place for every experiment knob, so the whole run is reproducible and
// easy to reason about live.
export const LAB_CONFIG = {
  behaviorSeed: 99,
  behaviorPerPage: 1500,
  rounds: 14,
  visitorsPerRound: 300,
  expSeedPhase1: 42,
  expSeedPhase2: 7,
};

export interface PhaseResult {
  pages: PageSpec[];
  behaviorVisits: Visit[];
  behaviorStats: PageStat[];
  experiment: ExperimentResult;
  insights: Insights;
}

// Phase 1: characterize behavior with an even exploration pass, then let the
// bandit optimize. Insights are derived from the clean exploration data.
export function runPhase(
  pages: PageSpec[],
  opts: { behaviorSeed: number; expSeed: number }
): PhaseResult {
  const behavior = sampleBehavior(pages, {
    seed: opts.behaviorSeed,
    perPage: LAB_CONFIG.behaviorPerPage,
  });
  const experiment = runExperiment(pages, {
    seed: opts.expSeed,
    rounds: LAB_CONFIG.rounds,
    visitorsPerRound: LAB_CONFIG.visitorsPerRound,
  });
  const insights = computeInsights(pages, behavior.stats);
  return {
    pages,
    behaviorVisits: behavior.visits,
    behaviorStats: behavior.stats,
    experiment,
    insights,
  };
}

export function runPhase1(pages: PageSpec[]): PhaseResult {
  return runPhase(pages, {
    behaviorSeed: LAB_CONFIG.behaviorSeed,
    expSeed: LAB_CONFIG.expSeedPhase1,
  });
}

export function runPhase2(pages: PageSpec[]): PhaseResult {
  return runPhase(pages, {
    behaviorSeed: LAB_CONFIG.behaviorSeed + 1,
    expSeed: LAB_CONFIG.expSeedPhase2,
  });
}

export function statForPage(phase: PhaseResult, pageId: string): PageStat | undefined {
  return phase.behaviorStats.find((s) => s.pageId === pageId);
}

// Relative lift of the bandit over an even split, as a percentage.
export function banditLiftPct(exp: ExperimentResult): number {
  if (exp.uniformConvRate === 0) return 0;
  return ((exp.thompsonConvRate - exp.uniformConvRate) / exp.uniformConvRate) * 100;
}
