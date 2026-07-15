import { Persona } from "./personas";
import { hashStringToSeed, RNG } from "./rng";
import { aggregate, samplePersona, simulateVisit } from "./simulate";
import { PageSpec, PageStat, Visit } from "./types";

export interface ExperimentConfig {
  seed: number;
  rounds: number;
  visitorsPerRound: number;
}

export interface RoundRecord {
  round: number;
  allocation: Record<string, number>;
  convThisRound: Record<string, { visits: number; conversions: number }>;
  posteriorMean: Record<string, number>;
  cumConvRate: number;
  cumRegret: number; // cumulative regret vs the oracle best arm
}

export interface ExperimentResult {
  config: ExperimentConfig;
  pageIds: string[];
  rounds: RoundRecord[];
  visits: Visit[];
  stats: PageStat[];
  posterior: Record<string, { alpha: number; beta: number }>;
  // honest baselines, computed from the clean equal-N true rates
  uniformConvRate: number; // even split
  bestArmRate: number; // always-serve-the-best-arm
  oracleRate: number; // same as bestArmRate; named for the regret story
  thompsonConvRate: number; // what the bandit achieved
  cumRegret: number;
  bestPageId: string;
  pBest: Record<string, number>; // posterior P(arm is the best)
  winnerSignificant: boolean; // max pBest >= pBestThreshold (default 0.95)
  pBestThreshold: number; // the significance gate this run was judged against
}

// Thompson-sampling experiment. Allocation decisions use one RNG stream; each
// page's simulated visits draw from their own id-keyed stream, so a page's
// outcomes don't depend on allocation order or on what other pages are present.
// `trueRates` (clean equal-N per-page rates) are used for the honest even-split
// baseline and for regret vs the oracle — never the bandit's own starved data.
export function runExperiment(
  pages: PageSpec[],
  config: ExperimentConfig,
  opts: {
    trueRates?: Record<string, number>;
    personas?: Persona[]; // override traffic mixture (Lab Controls)
    pBestThreshold?: number; // significance gate, default 0.95
    mcSamples?: number; // Monte-Carlo samples for P(best), default 3000
  } = {}
): ExperimentResult {
  const rngAlloc = new RNG(config.seed);
  const pageRng = new Map<string, RNG>(
    pages.map((p) => [p.id, new RNG(config.seed ^ hashStringToSeed(p.id))])
  );
  const pageById = new Map(pages.map((p) => [p.id, p]));
  const ids = pages.map((p) => p.id);

  const alpha: Record<string, number> = {};
  const beta: Record<string, number> = {};
  for (const id of ids) {
    alpha[id] = 1;
    beta[id] = 1;
  }

  const trueRates = opts.trueRates ?? {};
  const oracleRate = ids.length ? Math.max(...ids.map((id) => trueRates[id] ?? 0)) : 0;

  const visits: Visit[] = [];
  const rounds: RoundRecord[] = [];
  let totalVisits = 0;
  let totalConv = 0;
  let cumRegret = 0;

  for (let r = 0; r < config.rounds; r++) {
    const allocation: Record<string, number> = {};
    const convThisRound: Record<string, { visits: number; conversions: number }> = {};
    for (const id of ids) {
      allocation[id] = 0;
      convThisRound[id] = { visits: 0, conversions: 0 };
    }

    for (let v = 0; v < config.visitorsPerRound; v++) {
      let bestId = ids[0];
      let bestDraw = -1;
      for (const id of ids) {
        const draw = rngAlloc.beta(alpha[id], beta[id]);
        if (draw > bestDraw) {
          bestDraw = draw;
          bestId = id;
        }
      }

      const page = pageById.get(bestId)!;
      const rng = pageRng.get(bestId)!;
      const persona = samplePersona(rng, opts.personas);
      const visit = simulateVisit(rng, page, persona);
      visits.push(visit);

      allocation[bestId]++;
      convThisRound[bestId].visits++;
      totalVisits++;
      cumRegret += oracleRate - (trueRates[bestId] ?? 0);
      if (visit.converted) {
        alpha[bestId] += 1;
        convThisRound[bestId].conversions++;
        totalConv++;
      } else {
        beta[bestId] += 1;
      }
    }

    const posteriorMean: Record<string, number> = {};
    for (const id of ids) posteriorMean[id] = alpha[id] / (alpha[id] + beta[id]);

    rounds.push({
      round: r + 1,
      allocation,
      convThisRound,
      posteriorMean,
      cumConvRate: totalConv / (totalVisits || 1),
      cumRegret,
    });
  }

  const stats = pages.map((p) => aggregate(p.id, visits, p.sections.length));

  const rateVals = ids.map((id) => trueRates[id] ?? 0);
  const uniformConvRate = rateVals.length ? avg(rateVals) : 0;
  const bestArmRate = oracleRate;
  const thompsonConvRate = totalConv / (totalVisits || 1);

  const posterior: Record<string, { alpha: number; beta: number }> = {};
  for (const id of ids) posterior[id] = { alpha: alpha[id], beta: beta[id] };

  const bestPageId = ids.reduce((a, b) =>
    posterior[a].alpha / (posterior[a].alpha + posterior[a].beta) >=
    posterior[b].alpha / (posterior[b].alpha + posterior[b].beta)
      ? a
      : b
  );

  // posterior P(arm is best) by Monte Carlo over the Beta posteriors
  const pBestThreshold = opts.pBestThreshold ?? 0.95;
  const pBest = estimatePBest(rngAlloc, ids, alpha, beta, opts.mcSamples ?? 3000);
  const winnerSignificant = Math.max(...ids.map((id) => pBest[id])) >= pBestThreshold;

  return {
    config,
    pageIds: ids,
    rounds,
    visits,
    stats,
    posterior,
    uniformConvRate,
    bestArmRate,
    oracleRate,
    thompsonConvRate,
    cumRegret,
    bestPageId,
    pBest,
    winnerSignificant,
    pBestThreshold,
  };
}

function estimatePBest(
  rng: RNG,
  ids: string[],
  alpha: Record<string, number>,
  beta: Record<string, number>,
  samples: number
): Record<string, number> {
  const count: Record<string, number> = {};
  for (const id of ids) count[id] = 0;
  for (let s = 0; s < samples; s++) {
    let bestId = ids[0];
    let best = -1;
    for (const id of ids) {
      const d = rng.beta(alpha[id], beta[id]);
      if (d > best) {
        best = d;
        bestId = id;
      }
    }
    count[bestId]++;
  }
  const out: Record<string, number> = {};
  for (const id of ids) out[id] = count[id] / samples;
  return out;
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
