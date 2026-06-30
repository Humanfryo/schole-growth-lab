import { RNG } from "./rng";
import { aggregate, samplePersona, simulateVisit } from "./simulate";
import { PageSpec, PageStat, Visit } from "./types";

export interface ExperimentConfig {
  seed: number;
  rounds: number;
  visitorsPerRound: number;
}

export interface RoundRecord {
  round: number;
  allocation: Record<string, number>; // visitors sent to each page this round
  convThisRound: Record<string, { visits: number; conversions: number }>;
  posteriorMean: Record<string, number>; // Beta mean per page after this round
  cumConvRate: number; // overall cumulative conversion rate (Thompson)
}

export interface ExperimentResult {
  config: ExperimentConfig;
  pageIds: string[];
  rounds: RoundRecord[];
  visits: Visit[];
  stats: PageStat[];
  posterior: Record<string, { alpha: number; beta: number }>;
  uniformConvRate: number; // counterfactual: even traffic split
  thompsonConvRate: number; // what the bandit actually achieved
  bestPageId: string;
}

// Run a full Thompson-sampling experiment over a set of pages.
// Each visitor is allocated by sampling a conversion rate from every page's
// Beta posterior and serving the page with the highest draw — so traffic
// naturally concentrates on whatever is winning, round by round.
export function runExperiment(
  pages: PageSpec[],
  config: ExperimentConfig
): ExperimentResult {
  const rng = new RNG(config.seed);
  const ids = pages.map((p) => p.id);
  const alpha: Record<string, number> = {};
  const beta: Record<string, number> = {};
  for (const id of ids) {
    alpha[id] = 1;
    beta[id] = 1;
  }

  const visits: Visit[] = [];
  const rounds: RoundRecord[] = [];
  let totalVisits = 0;
  let totalConv = 0;

  for (let r = 0; r < config.rounds; r++) {
    const allocation: Record<string, number> = {};
    const convThisRound: Record<string, { visits: number; conversions: number }> = {};
    for (const id of ids) {
      allocation[id] = 0;
      convThisRound[id] = { visits: 0, conversions: 0 };
    }

    for (let v = 0; v < config.visitorsPerRound; v++) {
      // Thompson sampling: draw a plausible conversion rate per page, pick best
      let bestId = ids[0];
      let bestDraw = -1;
      for (const id of ids) {
        const draw = rng.beta(alpha[id], beta[id]);
        if (draw > bestDraw) {
          bestDraw = draw;
          bestId = id;
        }
      }

      const page = pages.find((p) => p.id === bestId)!;
      const persona = samplePersona(rng);
      const visit = simulateVisit(rng, page, persona);
      visits.push(visit);

      allocation[bestId]++;
      convThisRound[bestId].visits++;
      totalVisits++;
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
    });
  }

  const stats = pages.map((p) => aggregate(p.id, visits, p.sections.length));

  // Counterfactual: an even traffic split would converge to the average of the
  // per-page conversion rates. Each visit to a page is an independent draw, so
  // the observed per-page rate is an unbiased estimate regardless of how much
  // traffic the bandit happened to send there.
  const uniformConvRate = avg(stats.map((s) => s.convRate));
  const thompsonConvRate = totalConv / (totalVisits || 1);

  const posterior: Record<string, { alpha: number; beta: number }> = {};
  for (const id of ids) posterior[id] = { alpha: alpha[id], beta: beta[id] };

  const bestPageId = ids.reduce((a, b) =>
    posterior[a].alpha / (posterior[a].alpha + posterior[a].beta) >=
    posterior[b].alpha / (posterior[b].alpha + posterior[b].beta)
      ? a
      : b
  );

  return {
    config,
    pageIds: ids,
    rounds,
    visits,
    stats,
    posterior,
    uniformConvRate,
    thompsonConvRate,
    bestPageId,
  };
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
