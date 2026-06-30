// Verifies the whole rigor pipeline:
//   explore -> fit response model -> race (bandit) -> optimize variant ->
//   honest same-pass lift -> multi-seed lift -> evolution -> per-segment targeting.
// Run: npx tsx scripts/calibrate.ts
import {
  evaluateVariant,
  multiSeedLift,
  planAndRealize,
  runEvolution,
  runLab,
} from "../lib/lab";
import { SEED_PAGES } from "../lib/pages";
import { PERSONAS } from "../lib/personas";
import { FEATURE_NAMES } from "../lib/regression";
import { summarizeFit } from "../lib/insights";
import { evaluateField } from "../lib/lab";
import { ANGLE_LABEL } from "../lib/types";

const lab = runLab(SEED_PAGES);

console.log("=== Fitted response model (population) ===");
for (const name of FEATURE_NAMES) {
  const c = lab.model.population.coefByName[name];
  console.log(`  ${name.padEnd(16)} ${c.value.toFixed(3).padStart(7)} ± ${c.se.toFixed(3)}`);
}
console.log("converged:", lab.model.population.converged, "visits:", lab.model.visits);

console.log("\n=== Showcase leaderboard (clean equal-N) ===");
for (const s of [...lab.behaviorStats].sort((a, b) => b.convRate - a.convRate)) {
  console.log(`  ${s.pageId}  ${(s.convRate * 100).toFixed(2)}%  CI[${(s.ci[0] * 100).toFixed(1)}-${(s.ci[1] * 100).toFixed(1)}]`);
}

const e = lab.experiment;
console.log("\n=== Bandit ===");
console.log(`  thompson=${(e.thompsonConvRate * 100).toFixed(2)}%  even-split=${(e.uniformConvRate * 100).toFixed(2)}%  best-arm=${(e.bestArmRate * 100).toFixed(2)}%`);
console.log(`  cumulative regret=${e.cumRegret.toFixed(1)} conversions vs oracle`);
console.log(`  winner=${e.bestPageId}  significant=${e.winnerSignificant}  pBest=${Object.entries(e.pBest).map(([k, v]) => `${k}:${(v * 100).toFixed(0)}%`).join(" ")}`);

console.log("\n=== Insights (learned) ===");
console.log("  winning angle:", ANGLE_LABEL[lab.insights.winningAngle], "| losing:", ANGLE_LABEL[lab.insights.losingAngle], "| bestCTA:", lab.insights.bestCTA);
console.log("  segments differ?", lab.insights.segmentsDiffer);
for (const sw of lab.insights.segmentWinners) {
  console.log(`    ${sw.segmentName.padEnd(18)} -> ${sw.pageId} ${sw.pageName} (${(sw.convRate * 100).toFixed(1)}%)`);
}

console.log("\n=== Generated variant (optimized against the fit) ===");
const { plan, variant } = planAndRealize(lab.insights, SEED_PAGES, { id: "V1" });
console.log(`  ${variant.id}  primary=${plan.primaryAngle} secondary=${plan.secondaryAngle} cta=${plan.cta} proof=${plan.socialProof} spec=${plan.specificity} len=${plan.slots.length}`);
console.log(`  predicted conv (model) = ${(plan.predictedConv * 100).toFixed(2)}%`);
const ev = evaluateVariant(SEED_PAGES, variant);
console.log(`  observed: variant=${(ev.variantRate * 100).toFixed(2)}% vs baseline ${ev.baselineId}=${(ev.baselineRate * 100).toFixed(2)}%  lift=${ev.liftPct.toFixed(1)}%  (same pass)`);
console.log("  rationale:");
for (const n of variant.rationale ?? []) console.log(`    - ${n.change}`);

console.log("\n=== Multi-seed lift distribution ===");
const ms = multiSeedLift(SEED_PAGES, lab.insights, 40);
console.log(`  mean lift=${ms.meanLiftPct.toFixed(1)}%  95% CI[${ms.ciLow.toFixed(1)}, ${ms.ciHigh.toFixed(1)}]  win-rate=${(ms.winRate * 100).toFixed(0)}%  (n=${ms.n})`);

console.log("\n=== Evolution (rises then plateaus; rejects weak variants) ===");
const evo = runEvolution(SEED_PAGES, lab.insights, 4);
for (const r of evo.rounds) {
  console.log(`  round ${r.round}: ${r.variant.primaryAngle.padEnd(16)} pred=${(r.predictedConv * 100).toFixed(1)}% observed=${(r.observedRate * 100).toFixed(2)}% incumbent=${(r.incumbentRate * 100).toFixed(2)}% -> ${r.accepted ? "ACCEPT" : "reject"} (frontier ${(r.frontier * 100).toFixed(2)}%)`);
}

console.log("\n=== Per-segment targeting (optimized against each segment's fit) ===");
for (const p of PERSONAS) {
  const { plan: tp, variant: tv } = planAndRealize(lab.insights, SEED_PAGES, { id: `T-${p.id}`, forSegment: p.id, segName: p.name });
  const { trueRates } = evaluateField([tv], 321, 1500);
  console.log(`  ${p.name.padEnd(18)} -> lead ${tp.primaryAngle.padEnd(16)} cta=${tp.cta}`);
  void trueRates;
}

console.log("\n(verification done)");
void summarizeFit;
