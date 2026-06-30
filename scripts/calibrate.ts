// Calibration harness: run the DGP and print the dynamics we care about, so we
// can tune constants before wiring the UI. Run with: npx tsx scripts/calibrate.ts
import { runExperiment } from "../lib/bandit";
import { computeInsights } from "../lib/insights";
import { SEED_PAGES } from "../lib/pages";
import { PERSONAS } from "../lib/personas";
import { sampleBehavior, trueLogit } from "../lib/simulate";
import { sigmoid } from "../lib/rng";
import { ANGLE_LABEL } from "../lib/types";
import { planVariant, realizeVariant } from "../lib/variant";

console.log("=== TRUE conversion logit -> prob (no scroll gate), persona x page ===");
const header = ["page".padEnd(20), ...PERSONAS.map((p) => p.name.slice(0, 10).padEnd(11))];
console.log(header.join(""));
for (const page of SEED_PAGES) {
  const row = [`${page.id} ${page.name}`.padEnd(20)];
  for (const persona of PERSONAS) {
    const p = sigmoid(trueLogit(persona, page));
    row.push((p * 100).toFixed(1).padEnd(11));
  }
  console.log(row.join(""));
}

console.log("\n=== Mixture true prob per page (share-weighted) ===");
for (const page of SEED_PAGES) {
  const mix = PERSONAS.reduce(
    (s, persona) => s + persona.share * sigmoid(trueLogit(persona, page)),
    0
  );
  console.log(`${page.id} ${page.name.padEnd(22)} ${(mix * 100).toFixed(2)}%`);
}

console.log("\n=== Experiment (5 seeds) ===");
const config = { seed: 42, rounds: 20, visitorsPerRound: 400 };
const result = runExperiment(SEED_PAGES, config);
console.log("Final per-page (observed):");
for (const s of [...result.stats].sort((a, b) => b.convRate - a.convRate)) {
  console.log(
    `  ${s.pageId}  conv=${(s.convRate * 100).toFixed(2)}%  visits=${s.visits}  ` +
      `scroll=${(s.avgScrollDepth * 100).toFixed(0)}%  time=${s.avgTimeOnPage.toFixed(0)}s  ` +
      `bounce=${(s.bounceRate * 100).toFixed(0)}%`
  );
}
console.log(
  `Thompson conv=${(result.thompsonConvRate * 100).toFixed(2)}%  ` +
    `uniform conv=${(result.uniformConvRate * 100).toFixed(2)}%  ` +
    `lift=${(((result.thompsonConvRate - result.uniformConvRate) / result.uniformConvRate) * 100).toFixed(0)}%`
);
console.log(
  "Cum conv by round:",
  result.rounds.map((r) => (r.cumConvRate * 100).toFixed(1)).join(" ")
);
console.log(
  "Final allocation share:",
  result.pageIds
    .map((id) => {
      const last = result.rounds[result.rounds.length - 1].allocation[id];
      return `${id}:${last}`;
    })
    .join("  ")
);

const behavior = sampleBehavior(SEED_PAGES, { seed: 99, perPage: 2000 });
const insights = computeInsights(SEED_PAGES, behavior.stats);
console.log("\n=== Behavior sample (uniform) per-page conv ===");
for (const s of [...behavior.stats].sort((a, b) => b.convRate - a.convRate)) {
  console.log(`  ${s.pageId} ${(s.convRate * 100).toFixed(2)}%  scroll=${(s.avgScrollDepth * 100).toFixed(0)}%  time=${s.avgTimeOnPage.toFixed(0)}s`);
}
console.log("\n=== Insights ===");
console.log("Overall winner:", insights.overallWinner, insights.overallWinnerName);
console.log(
  "Angle ranking:",
  insights.angleScores.map((a) => `${a.angle}=${(a.score * 100).toFixed(1)}%`).join("  ")
);
console.log(
  "CTA ranking:",
  insights.ctaScores.map((c) => `${c.type}=${(c.convRate * 100).toFixed(1)}%`).join("  ")
);
console.log("Hot angles:", insights.hotAngles.map((a) => `${a.angle}(+${a.lift.toFixed(1)}s)`).join("  "));
console.log("Cold angles:", insights.coldAngles.map((a) => `${a.angle}(${a.allDwell.toFixed(1)}s)`).join("  "));
console.log("Segments differ?", insights.segmentsDiffer);
for (const sw of insights.segmentWinners) {
  console.log(
    `  ${sw.segmentName.padEnd(18)} -> ${sw.pageId} ${sw.pageName.padEnd(22)} ${(sw.convRate * 100).toFixed(1)}%  [${ANGLE_LABEL[sw.topAngle]}]`
  );
}

console.log("\n=== Generate winner variant and re-run with 6 pages ===");
const plan = planVariant(insights, SEED_PAGES, { id: "V1" });
const variant = realizeVariant(plan);
console.log("Variant:", variant.id, variant.name, "primary=", variant.primaryAngle, "secondary=", variant.secondaryAngle, "cta=", variant.cta.type);
console.log("Variant true mixture prob:", (PERSONAS.reduce((s, p) => s + p.share * sigmoid(trueLogit(p, variant)), 0) * 100).toFixed(2) + "%");
const pages2 = [...SEED_PAGES, variant];
const result2 = runExperiment(pages2, { ...config, seed: 7 });
console.log("Phase 2 final per-page:");
for (const s of [...result2.stats].sort((a, b) => b.convRate - a.convRate)) {
  console.log(`  ${s.pageId}  conv=${(s.convRate * 100).toFixed(2)}%  visits=${s.visits}`);
}
console.log("Phase 2 best page:", result2.bestPageId, "(want V1)");
